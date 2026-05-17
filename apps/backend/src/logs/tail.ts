/**
 * Tails access.log and error.log, parsing each new line and broadcasting
 * SSE log events via sseBus. Active only while at least one client has
 * subscribed with ?subscribe=log.
 */

import fs from 'fs'
import path from 'path'
import db from '../db/client.js'
import { sseBus } from '../sse/bus.js'
import { LOGS_DIR } from '@unginx/shared'
import { parseAccessLine, parseErrorLine } from './parse.js'

interface TailState {
  fd: number | null
  offset: number
  watcher: fs.FSWatcher | null
}

// How many subscribers have requested log events
let logSubscribers = 0

const accessState: TailState = { fd: null, offset: 0, watcher: null }
const errorState: TailState = { fd: null, offset: 0, watcher: null }

let routeNameCache: Map<string, string> = new Map()
let routeNameCacheTs = 0

function getRouteNames(): Map<string, string> {
  const now = Date.now()
  if (now - routeNameCacheTs < 5_000) return routeNameCache

  const rows = db
    .prepare('SELECT id, name FROM route')
    .all() as Array<{ id: string; name: string }>

  routeNameCache = new Map(rows.map((r) => [r.id, r.name]))
  routeNameCacheTs = now
  return routeNameCache
}

function openTail(state: TailState, filePath: string): void {
  if (state.fd !== null) return

  if (!fs.existsSync(filePath)) {
    // File may not exist yet — will be opened on first write
    return
  }

  const stat = fs.statSync(filePath)
  state.fd = fs.openSync(filePath, 'r')
  state.offset = stat.size // start at end, don't replay history

  state.watcher = fs.watch(filePath, { persistent: false }, () => {
    readNewLines(state, filePath)
  })
}

function closeTail(state: TailState): void {
  if (state.watcher) {
    state.watcher.close()
    state.watcher = null
  }
  if (state.fd !== null) {
    fs.closeSync(state.fd)
    state.fd = null
  }
  state.offset = 0
}

function readNewLines(state: TailState, filePath: string): void {
  if (state.fd === null) return

  let stat: fs.Stats
  try {
    stat = fs.statSync(filePath)
  } catch {
    // File was deleted (rotation) — reopen after a moment
    closeTail(state)
    setTimeout(() => {
      if (logSubscribers > 0) openTail(state, filePath)
    }, 500)
    return
  }

  if (stat.size < state.offset) {
    // File was truncated — reset offset
    state.offset = 0
  }

  const toRead = stat.size - state.offset
  if (toRead <= 0) return

  const buf = Buffer.alloc(toRead)
  const bytesRead = fs.readSync(state.fd, buf, 0, toRead, state.offset)
  state.offset += bytesRead

  const text = buf.slice(0, bytesRead).toString('utf8')
  const lines = text.split('\n').filter((l) => l.length > 0)

  const type = filePath.endsWith('error.log') ? 'error' : 'access'
  const names = getRouteNames()

  for (const line of lines) {
    const event =
      type === 'access'
        ? parseAccessLine(line, names)
        : parseErrorLine(line)

    if (event) {
      sseBus.broadcast({ event: 'log', data: event })
    }
  }
}

export function subscribeToLogs(): void {
  logSubscribers++
  if (logSubscribers === 1) {
    openTail(accessState, path.join(LOGS_DIR, 'access.log'))
    openTail(errorState, path.join(LOGS_DIR, 'error.log'))
  }
}

export function unsubscribeFromLogs(): void {
  logSubscribers = Math.max(0, logSubscribers - 1)
  if (logSubscribers === 0) {
    closeTail(accessState)
    closeTail(errorState)
  }
}

// Called after log rotation to reopen file handles
export function reopenLogFiles(): void {
  if (logSubscribers === 0) return
  closeTail(accessState)
  closeTail(errorState)
  openTail(accessState, path.join(LOGS_DIR, 'access.log'))
  openTail(errorState, path.join(LOGS_DIR, 'error.log'))
}
