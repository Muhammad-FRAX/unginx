import type { FastifyPluginAsync } from 'fastify'
import db from '../db/client.js'
import { runSavePipeline, SaveError } from '../pipeline/save.js'
import type { Route, FileRoute } from '@unginx/shared'

interface DbVersion {
  id: number
  version: number
  summary: string
  db_snapshot_json: string
  created_at: number
  created_by: string | null
}

interface Snapshot {
  routes: Route[]
  fileRoutes: FileRoute[]
  exportedAt?: string
}

function diffSnapshots(
  prev: Snapshot | null,
  curr: Snapshot
): { added: unknown[]; removed: unknown[]; changed: unknown[] } {
  if (!prev) {
    return {
      added: [...curr.routes, ...curr.fileRoutes],
      removed: [],
      changed: [],
    }
  }

  const prevRouteMap = new Map(prev.routes.map((r) => [r.id, r]))
  const currRouteMap = new Map(curr.routes.map((r) => [r.id, r]))
  const prevFileMap = new Map(prev.fileRoutes.map((r) => [r.id, r]))
  const currFileMap = new Map(curr.fileRoutes.map((r) => [r.id, r]))

  const added: unknown[] = []
  const removed: unknown[] = []
  const changed: unknown[] = []

  for (const [id, route] of currRouteMap) {
    if (!prevRouteMap.has(id)) {
      added.push({ kind: 'route', ...route })
    } else {
      const prev = prevRouteMap.get(id)!
      if (JSON.stringify(prev) !== JSON.stringify(route)) {
        changed.push({ kind: 'route', before: prev, after: route })
      }
    }
  }
  for (const [id, route] of prevRouteMap) {
    if (!currRouteMap.has(id)) {
      removed.push({ kind: 'route', ...route })
    }
  }
  for (const [id, fr] of currFileMap) {
    if (!prevFileMap.has(id)) {
      added.push({ kind: 'file_route', ...fr })
    } else {
      const prev = prevFileMap.get(id)!
      if (JSON.stringify(prev) !== JSON.stringify(fr)) {
        changed.push({ kind: 'file_route', before: prev, after: fr })
      }
    }
  }
  for (const [id, fr] of prevFileMap) {
    if (!currFileMap.has(id)) {
      removed.push({ kind: 'file_route', ...fr })
    }
  }

  return { added, removed, changed }
}

const versionsApi: FastifyPluginAsync = async (fastify) => {
  // GET /api/versions
  fastify.get('/api/versions', async () => {
    const rows = db
      .prepare(
        'SELECT id, version, summary, created_at, created_by FROM config_version ORDER BY version DESC'
      )
      .all() as Omit<DbVersion, 'db_snapshot_json'>[]
    return rows
  })

  // GET /api/versions/:v
  fastify.get('/api/versions/:v', async (request, reply) => {
    const { v } = request.params as { v: string }
    const vNum = parseInt(v, 10)
    if (isNaN(vNum)) return reply.code(400).send({ error: 'Invalid version number' })

    const row = db
      .prepare('SELECT * FROM config_version WHERE version = ?')
      .get(vNum) as DbVersion | undefined

    if (!row) return reply.code(404).send({ error: 'Version not found' })

    const currSnapshot: Snapshot = JSON.parse(row.db_snapshot_json) as Snapshot

    const prevRow = db
      .prepare('SELECT db_snapshot_json FROM config_version WHERE version = ?')
      .get(vNum - 1) as { db_snapshot_json: string } | undefined

    const prevSnapshot: Snapshot | null = prevRow
      ? (JSON.parse(prevRow.db_snapshot_json) as Snapshot)
      : null

    const diff = diffSnapshots(prevSnapshot, currSnapshot)

    return {
      id: row.id,
      version: row.version,
      summary: row.summary,
      created_at: row.created_at,
      created_by: row.created_by,
      snapshot: currSnapshot,
      diff,
    }
  })

  // POST /api/versions/:v/rollback
  fastify.post('/api/versions/:v/rollback', async (request, reply) => {
    const { v } = request.params as { v: string }
    const vNum = parseInt(v, 10)
    if (isNaN(vNum)) return reply.code(400).send({ error: 'Invalid version number' })

    const row = db
      .prepare('SELECT * FROM config_version WHERE version = ?')
      .get(vNum) as DbVersion | undefined

    if (!row) return reply.code(404).send({ error: 'Version not found' })

    const snapshot: Snapshot = JSON.parse(row.db_snapshot_json) as Snapshot
    const username = request.jwtUser?.username ?? null

    try {
      const result = await runSavePipeline(
        () => {
          // Restore routes
          db.prepare('DELETE FROM route').run()
          for (const route of snapshot.routes) {
            db.prepare(
              `INSERT OR REPLACE INTO route (id, group_id, name, path, upstream_host,
               upstream_port, upstream_scheme, strip_prefix, websocket, enabled,
               description, advanced_json, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).run(
              route.id,
              route.group_id,
              route.name,
              route.path,
              route.upstream_host,
              route.upstream_port,
              route.upstream_scheme,
              route.strip_prefix ? 1 : 0,
              route.websocket ? 1 : 0,
              route.enabled ? 1 : 0,
              route.description,
              JSON.stringify(route.advanced_json),
              route.created_at,
              route.updated_at
            )
          }

          // Restore file routes
          db.prepare('DELETE FROM file_route').run()
          for (const fr of snapshot.fileRoutes) {
            db.prepare(
              `INSERT OR REPLACE INTO file_route (id, group_id, name, path, folder_path,
               index_files, dir_listing, try_files, spa_mode, enabled, description,
               advanced_json, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).run(
              fr.id,
              fr.group_id,
              fr.name,
              fr.path,
              fr.folder_path,
              fr.index_files,
              fr.dir_listing ? 1 : 0,
              fr.try_files,
              fr.spa_mode ? 1 : 0,
              fr.enabled ? 1 : 0,
              fr.description,
              JSON.stringify(fr.advanced_json),
              fr.created_at,
              fr.updated_at
            )
          }
        },
        { summary: `Rolled back to version v${String(vNum).padStart(4, '0')} ("${row.summary}")`, username }
      )

      return { ok: true, newVersion: result.version }
    } catch (err) {
      if (err instanceof SaveError) {
        return reply.code(422).send({ error: err.friendlyMessage, rawOutput: err.rawOutput })
      }
      throw err
    }
  })
}

export default versionsApi
