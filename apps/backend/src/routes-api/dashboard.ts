import type { FastifyPluginAsync } from 'fastify'
import fs from 'fs'
import db from '../db/client.js'
import { NGINX_PID_FILE } from '@unginx/shared'

interface DbVersion {
  version: number
  summary: string
  created_at: number
  created_by: string | null
}

function getNginxStatus(): { running: boolean; pid: number | null } {
  try {
    const pidStr = fs.readFileSync(NGINX_PID_FILE, 'utf8').trim()
    const pid = parseInt(pidStr, 10)
    if (isNaN(pid)) return { running: false, pid: null }
    // Check if process is alive
    process.kill(pid, 0)
    return { running: true, pid }
  } catch {
    return { running: false, pid: null }
  }
}

const dashboardApi: FastifyPluginAsync = async (fastify) => {
  // GET /api/dashboard
  fastify.get('/api/dashboard', async () => {
    const routeTotal = (db.prepare('SELECT COUNT(*) as c FROM route').get() as { c: number }).c
    const routeEnabled = (db.prepare('SELECT COUNT(*) as c FROM route WHERE enabled = 1').get() as { c: number }).c
    const fileRouteTotal = (db.prepare('SELECT COUNT(*) as c FROM file_route').get() as { c: number }).c
    const fileRouteEnabled = (db.prepare('SELECT COUNT(*) as c FROM file_route WHERE enabled = 1').get() as { c: number }).c
    const groupTotal = (db.prepare('SELECT COUNT(*) as c FROM group_').get() as { c: number }).c

    const currentVersion = (
      db.prepare('SELECT COALESCE(MAX(version), 0) as v FROM config_version').get() as { v: number }
    ).v

    const recentActivity = db
      .prepare(
        'SELECT version, summary, created_at, created_by FROM config_version ORDER BY version DESC LIMIT 5'
      )
      .all() as DbVersion[]

    const nginxStatus = getNginxStatus()

    const appVersion = process.env['APP_VERSION'] ?? 'dev'

    return {
      nginx: {
        running: nginxStatus.running,
        pid: nginxStatus.pid,
      },
      configVersion: currentVersion,
      appVersion,
      counts: {
        routes: { total: routeTotal, enabled: routeEnabled, disabled: routeTotal - routeEnabled },
        fileRoutes: { total: fileRouteTotal, enabled: fileRouteEnabled, disabled: fileRouteTotal - fileRouteEnabled },
        groups: groupTotal,
      },
      recentActivity,
    }
  })

  // GET /api/health-status — latest cached health (populated by Phase 5 scheduler)
  // For now returns current state from DB; Phase 5 will add SSE live status
  fastify.get('/api/health-status', async () => {
    const routes = db
      .prepare('SELECT id, name, upstream_host, upstream_port, enabled FROM route WHERE enabled = 1')
      .all() as Array<{ id: string; name: string; upstream_host: string; upstream_port: number; enabled: number }>

    const fileRoutes = db
      .prepare('SELECT id, name, folder_path, enabled FROM file_route WHERE enabled = 1')
      .all() as Array<{ id: string; name: string; folder_path: string; enabled: number }>

    return {
      routes: routes.map((r) => ({
        id: r.id,
        name: r.name,
        kind: 'route' as const,
        // Status is 'unknown' until Phase 5 health scheduler runs
        status: 'unknown' as const,
      })),
      fileRoutes: fileRoutes.map((fr) => ({
        id: fr.id,
        name: fr.name,
        kind: 'file_route' as const,
        status: 'unknown' as const,
      })),
    }
  })
}

export default dashboardApi
