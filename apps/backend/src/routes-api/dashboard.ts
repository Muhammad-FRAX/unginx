import type { FastifyPluginAsync } from 'fastify'
import fs from 'fs'
import db from '../db/client.js'
import { NGINX_PID_FILE } from '@unginx/shared'
import { getCachedHealth } from '../health/index.js'

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

  // GET /api/health-status — latest cached health from the Phase 5 scheduler
  fastify.get('/api/health-status', async () => {
    const routes = db
      .prepare('SELECT id, name FROM route WHERE enabled = 1')
      .all() as Array<{ id: string; name: string }>

    const fileRoutes = db
      .prepare('SELECT id, name FROM file_route WHERE enabled = 1')
      .all() as Array<{ id: string; name: string }>

    const cache = getCachedHealth()
    const byId = new Map(cache.map((h) => [h.id, h.status]))

    return {
      routes: routes.map((r) => ({
        id: r.id,
        name: r.name,
        kind: 'route' as const,
        status: byId.get(r.id) ?? 'unknown',
      })),
      fileRoutes: fileRoutes.map((fr) => ({
        id: fr.id,
        name: fr.name,
        kind: 'file_route' as const,
        status: byId.get(fr.id) ?? 'unknown',
      })),
    }
  })
}

export default dashboardApi
