/**
 * Health scheduler (plan.md §14).
 *
 * Ticks every 30 seconds:
 *   - For each enabled route: TCP-connect to upstream_host:upstream_port (2s timeout)
 *   - For each enabled file_route: stat the folder_path
 *   - Cache results in memory
 *   - Emit SSE health events
 */

import net from 'net'
import fs from 'fs'
import db from '../db/client.js'
import { sseBus } from '../sse/bus.js'
import { HEALTH_CHECK_INTERVAL_MS } from '@unginx/shared'
import type { HealthStatus } from '@unginx/shared'

interface RouteHealth {
  kind: 'route' | 'file_route'
  id: string
  status: HealthStatus
  checkedAt: number
}

// In-memory cache — keyed by id
const healthCache = new Map<string, RouteHealth>()

let timer: ReturnType<typeof setInterval> | null = null

export function startHealthScheduler(): void {
  if (timer) return
  timer = setInterval(runHealthChecks, HEALTH_CHECK_INTERVAL_MS)
  // Run once at startup (don't await — fire and forget)
  void runHealthChecks()
}

export function stopHealthScheduler(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

export function getCachedHealth(): RouteHealth[] {
  return Array.from(healthCache.values())
}

export function getCachedHealthById(id: string): RouteHealth | undefined {
  return healthCache.get(id)
}

async function runHealthChecks(): Promise<void> {
  const routes = db
    .prepare('SELECT id, upstream_host, upstream_port FROM route WHERE enabled = 1')
    .all() as Array<{ id: string; upstream_host: string; upstream_port: number }>

  const fileRoutes = db
    .prepare('SELECT id, folder_path FROM file_route WHERE enabled = 1')
    .all() as Array<{ id: string; folder_path: string }>

  // Run all checks in parallel
  await Promise.all([
    ...routes.map((r) => checkRoute(r.id, r.upstream_host, r.upstream_port)),
    ...fileRoutes.map((fr) => checkFileRoute(fr.id, fr.folder_path)),
  ])
}

async function checkRoute(
  id: string,
  host: string,
  port: number
): Promise<void> {
  const status = await tcpConnect(host, port, 2000)
  updateCache({ kind: 'route', id, status, checkedAt: Date.now() })
}

async function checkFileRoute(id: string, folderPath: string): Promise<void> {
  let status: HealthStatus
  try {
    const stat = fs.statSync(folderPath)
    status = stat.isDirectory() ? 'up' : 'missing'
  } catch {
    status = 'missing'
  }
  updateCache({ kind: 'file_route', id, status, checkedAt: Date.now() })
}

function updateCache(entry: RouteHealth): void {
  const prev = healthCache.get(entry.id)
  healthCache.set(entry.id, entry)

  // Only emit SSE if status changed (reduces noise)
  if (!prev || prev.status !== entry.status) {
    sseBus.broadcast({
      event: 'health',
      data: { kind: entry.kind, id: entry.id, status: entry.status },
    })
  }
}

function tcpConnect(host: string, port: number, timeoutMs: number): Promise<HealthStatus> {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    let settled = false

    function finish(status: HealthStatus): void {
      if (settled) return
      settled = true
      socket.destroy()
      resolve(status)
    }

    socket.setTimeout(timeoutMs)
    socket.connect(port, host, () => finish('up'))
    socket.on('error', () => finish('down'))
    socket.on('timeout', () => finish('down'))
  })
}
