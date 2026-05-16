import type { FastifyPluginAsync } from 'fastify'
import { randomUUID } from 'crypto'
import db from '../db/client.js'
import { runSavePipeline, SaveError } from '../pipeline/save.js'

interface DbRoute {
  id: string
  group_id: string | null
  name: string
  path: string
  upstream_host: string
  upstream_port: number
  upstream_scheme: string
  strip_prefix: number
  websocket: number
  enabled: number
  description: string | null
  advanced_json: string
  created_at: number
  updated_at: number
}

interface DbFileRoute {
  id: string
  group_id: string | null
  name: string
  path: string
  folder_path: string
  index_files: string
  dir_listing: number
  try_files: string | null
  spa_mode: number
  enabled: number
  description: string | null
  advanced_json: string
  created_at: number
  updated_at: number
}

interface DbGroup {
  id: string
  kind: string
  name: string
  description: string | null
  created_at: number
}

interface ExportPayload {
  exportedAt: string
  groups: DbGroup[]
  routes: DbRoute[]
  fileRoutes: DbFileRoute[]
}

const dataApi: FastifyPluginAsync = async (fastify) => {
  // GET /api/data/export
  fastify.get('/api/data/export', async (request, reply) => {
    const groups = db.prepare('SELECT * FROM group_ ORDER BY kind, name').all() as DbGroup[]
    const routes = db.prepare('SELECT * FROM route ORDER BY path').all() as DbRoute[]
    const fileRoutes = db.prepare('SELECT * FROM file_route ORDER BY path').all() as DbFileRoute[]

    const payload: ExportPayload = {
      exportedAt: new Date().toISOString(),
      groups,
      routes,
      fileRoutes,
    }

    reply.header('Content-Type', 'application/json')
    reply.header(
      'Content-Disposition',
      `attachment; filename="unginx-export-${new Date().toISOString().split('T')[0]}.json"`
    )
    return payload
  })

  // POST /api/data/import?mode=merge|replace
  fastify.post('/api/data/import', async (request, reply) => {
    const query = request.query as { mode?: string }
    const mode = query.mode === 'replace' ? 'replace' : 'merge'
    const body = request.body as ExportPayload | undefined
    const username = request.jwtUser?.username ?? null

    if (!body || typeof body !== 'object') {
      return reply.code(400).send({ error: 'Request body must be a JSON export object' })
    }

    const groups: DbGroup[] = Array.isArray(body.groups) ? body.groups : []
    const routes: DbRoute[] = Array.isArray(body.routes) ? body.routes : []
    const fileRoutes: DbFileRoute[] = Array.isArray(body.fileRoutes) ? body.fileRoutes : []

    try {
      const result = await runSavePipeline(
        () => {
          if (mode === 'replace') {
            db.prepare('DELETE FROM route').run()
            db.prepare('DELETE FROM file_route').run()
            db.prepare('DELETE FROM group_').run()
          }

          // Import groups
          for (const g of groups) {
            db.prepare(
              `INSERT OR ${mode === 'replace' ? 'REPLACE' : 'IGNORE'} INTO group_
               (id, kind, name, description, created_at)
               VALUES (?, ?, ?, ?, ?)`
            ).run(g.id ?? randomUUID(), g.kind, g.name, g.description, g.created_at ?? Date.now())
          }

          // Import routes
          for (const r of routes) {
            db.prepare(
              `INSERT OR ${mode === 'replace' ? 'REPLACE' : 'IGNORE'} INTO route
               (id, group_id, name, path, upstream_host, upstream_port, upstream_scheme,
                strip_prefix, websocket, enabled, description, advanced_json, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).run(
              r.id ?? randomUUID(),
              r.group_id,
              r.name,
              r.path,
              r.upstream_host,
              r.upstream_port,
              r.upstream_scheme ?? 'http',
              typeof r.strip_prefix === 'boolean' ? (r.strip_prefix ? 1 : 0) : r.strip_prefix ?? 1,
              typeof r.websocket === 'boolean' ? (r.websocket ? 1 : 0) : r.websocket ?? 0,
              typeof r.enabled === 'boolean' ? (r.enabled ? 1 : 0) : r.enabled ?? 1,
              r.description,
              typeof r.advanced_json === 'string' ? r.advanced_json : JSON.stringify(r.advanced_json ?? {}),
              r.created_at ?? Date.now(),
              r.updated_at ?? Date.now()
            )
          }

          // Import file routes
          for (const fr of fileRoutes) {
            db.prepare(
              `INSERT OR ${mode === 'replace' ? 'REPLACE' : 'IGNORE'} INTO file_route
               (id, group_id, name, path, folder_path, index_files, dir_listing, try_files,
                spa_mode, enabled, description, advanced_json, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).run(
              fr.id ?? randomUUID(),
              fr.group_id,
              fr.name,
              fr.path,
              fr.folder_path,
              fr.index_files ?? 'index.html',
              typeof fr.dir_listing === 'boolean' ? (fr.dir_listing ? 1 : 0) : fr.dir_listing ?? 0,
              fr.try_files,
              typeof fr.spa_mode === 'boolean' ? (fr.spa_mode ? 1 : 0) : fr.spa_mode ?? 0,
              typeof fr.enabled === 'boolean' ? (fr.enabled ? 1 : 0) : fr.enabled ?? 1,
              fr.description,
              typeof fr.advanced_json === 'string' ? fr.advanced_json : JSON.stringify(fr.advanced_json ?? {}),
              fr.created_at ?? Date.now(),
              fr.updated_at ?? Date.now()
            )
          }
        },
        {
          summary: `Imported data (mode: ${mode}, ${groups.length} groups, ${routes.length} routes, ${fileRoutes.length} file routes)`,
          username,
        }
      )

      return { ok: true, mode, newVersion: result.version }
    } catch (err) {
      if (err instanceof SaveError) {
        return reply.code(422).send({ error: err.friendlyMessage, rawOutput: err.rawOutput })
      }
      throw err
    }
  })

  // POST /api/data/reset — body must be { confirmation: "RESET" }
  fastify.post('/api/data/reset', async (request, reply) => {
    const body = request.body as { confirmation?: string } | undefined
    if (!body || body.confirmation !== 'RESET') {
      return reply
        .code(400)
        .send({ error: 'Confirmation required. Send { "confirmation": "RESET" } to proceed.' })
    }

    const username = request.jwtUser?.username ?? null

    try {
      const result = await runSavePipeline(
        () => {
          db.prepare('DELETE FROM route').run()
          db.prepare('DELETE FROM file_route').run()
          db.prepare('DELETE FROM group_').run()
        },
        { summary: 'Factory reset — all routes, file routes, and groups deleted', username }
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

export default dataApi
