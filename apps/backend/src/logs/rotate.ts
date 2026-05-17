/**
 * Log rotation — runs on a 60-second tick.
 *
 * Policy (from plan.md §15.2):
 *   - Rotate when file >= 50 MB → access.log.1, gzip after one cycle.
 *   - Keep the last 10 rotations.
 *   - Delete rotations older than 14 days.
 *   - Send USR1 to nginx after rename so it reopens the file.
 *   - Same policy applies to error.log.
 */

import fs from 'fs'
import zlib from 'zlib'
import path from 'path'
import { LOGS_DIR, LOG_MAX_SIZE_MB, LOG_MAX_ROTATIONS, LOG_MAX_AGE_DAYS, LOG_ROTATE_INTERVAL_MS, NGINX_PID_FILE } from '@unginx/shared'
import { reopenLogFiles } from './tail.js'

let timer: ReturnType<typeof setInterval> | null = null

export function startLogRotation(): void {
  if (timer) return
  fs.mkdirSync(LOGS_DIR, { recursive: true })
  timer = setInterval(rotateTick, LOG_ROTATE_INTERVAL_MS)
  // Run once at startup to clean up any old rotations
  rotateTick()
}

export function stopLogRotation(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

function rotateTick(): void {
  rotateLog('access.log')
  rotateLog('error.log')
}

function rotateLog(filename: string): void {
  const filePath = path.join(LOGS_DIR, filename)

  if (!fs.existsSync(filePath)) return

  const stat = fs.statSync(filePath)
  const sizeMB = stat.size / (1024 * 1024)

  if (sizeMB >= LOG_MAX_SIZE_MB) {
    doRotate(filename)
  }

  pruneOldRotations(filename)
}

function doRotate(filename: string): void {
  const filePath = path.join(LOGS_DIR, filename)

  // Gzip the previous .1 rotation (if it exists and isn't already compressed)
  const prev1 = `${filePath}.1`
  if (fs.existsSync(prev1)) {
    gzipFile(prev1, `${prev1}.gz`)
    fs.unlinkSync(prev1)
  }

  // Shift existing numbered rotations up: .2 → .3, .1 → .2, etc.
  for (let i = LOG_MAX_ROTATIONS - 1; i >= 1; i--) {
    const src = `${filePath}.${i}.gz`
    const dst = `${filePath}.${i + 1}.gz`
    if (fs.existsSync(src)) {
      fs.renameSync(src, dst)
    }
  }

  // Rename the live log → .1 (nginx will write to a fresh file after USR1)
  fs.renameSync(filePath, prev1)

  // Signal nginx to reopen its log file handles
  signalNginxUsr1()

  // Let tail.ts reopen its read handles
  reopenLogFiles()
}

function gzipFile(src: string, dst: string): void {
  try {
    const input = fs.readFileSync(src)
    const compressed = zlib.gzipSync(input)
    fs.writeFileSync(dst, compressed)
  } catch {
    // Non-fatal — the uncompressed file remains
  }
}

function pruneOldRotations(filename: string): void {
  const filePath = path.join(LOGS_DIR, filename)
  const cutoffMs = LOG_MAX_AGE_DAYS * 24 * 60 * 60 * 1000

  // Delete rotations beyond the count limit
  for (let i = LOG_MAX_ROTATIONS + 1; i <= LOG_MAX_ROTATIONS + 20; i++) {
    const gz = `${filePath}.${i}.gz`
    if (fs.existsSync(gz)) fs.unlinkSync(gz)
    else break
  }

  // Delete rotations older than retention window
  const dir = LOGS_DIR
  const prefix = `${filename}.`
  for (const entry of fs.readdirSync(dir)) {
    if (!entry.startsWith(prefix)) continue
    const full = path.join(dir, entry)
    try {
      const mtime = fs.statSync(full).mtimeMs
      if (Date.now() - mtime > cutoffMs) {
        fs.unlinkSync(full)
      }
    } catch {
      // ignore
    }
  }
}

function signalNginxUsr1(): void {
  try {
    const pidStr = fs.readFileSync(NGINX_PID_FILE, 'utf8').trim()
    const pid = parseInt(pidStr, 10)
    if (!isNaN(pid)) {
      process.kill(pid, 'SIGUSR1')
    }
  } catch {
    // nginx may not be running in dev — ignore
  }
}
