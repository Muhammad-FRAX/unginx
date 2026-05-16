import fs from 'fs'
import { NGINX_PID_FILE } from '@unginx/shared'

const POLL_INTERVAL_MS = 100
const POLL_TIMEOUT_MS = 1000

export interface ReloadResult {
  ok: boolean
  error?: string
}

export async function reloadNginx(): Promise<ReloadResult> {
  const pid = readNginxPid()
  if (!pid) {
    return {
      ok: false,
      error: 'nginx pid file not found — is nginx running?',
    }
  }

  try {
    process.kill(pid, 'SIGHUP')
  } catch (err: unknown) {
    return {
      ok: false,
      error: `Failed to send SIGHUP to nginx (pid ${pid}): ${(err as NodeJS.ErrnoException).message}`,
    }
  }

  // Poll for POLL_TIMEOUT_MS to confirm master is still alive
  const deadline = Date.now() + POLL_TIMEOUT_MS
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS)
    try {
      // Signal 0 checks process existence without sending a signal
      process.kill(pid, 0)
    } catch {
      return { ok: false, error: 'nginx master exited after SIGHUP' }
    }
  }

  return { ok: true }
}

function readNginxPid(): number | null {
  try {
    const content = fs.readFileSync(NGINX_PID_FILE, 'utf8').trim()
    const pid = parseInt(content, 10)
    return isNaN(pid) ? null : pid
  } catch {
    return null
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
