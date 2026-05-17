import type { FastifyPluginAsync } from 'fastify'
import { randomUUID } from 'crypto'
import db from '../db/client.js'
import { runSavePipeline, SaveError } from '../pipeline/save.js'
import { createRouteSchema, updateRouteSchema, bulkActionSchema } from '@unginx/shared'
import type { Route } from '@unginx/shared'

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

function mapRoute(r: DbRoute): Route {
  return {
    ...r,
    strip_prefix: r.strip_prefix === 1,
    websocket: r.websocket === 1,
    enabled: r.enabled === 1,
    upstream_scheme: r.upstream_scheme as 'http' | 'https',
    advanced_json: (() => {
      try { return JSON.parse(r.advanced_json || '{}') } catch { return {} }
    })(),
  }
}

const routesApi: FastifyPluginAsync = async (fastify) => {
  // GET /api/routes?group_id=...&enabled=true|false
  fastify.get('/api/routes', async (request) => {
    const query = request.query as { group_id?: string; enabled?: string }
    let sql = 'SELECT * FROM route WHERE 1=1'
    const params: unknown[] = []

    if (query.group_id !== undefined) {
      if (query.group_id === 'null' || query.group_id === '') {
        sql += ' AND group_id IS NULL'
      } else {
        sql += ' AND group_id = ?'
        params.push(query.group_id)
      }
    }

    if (query.enabled === 'true') {
      sql += ' AND enabled = 1'
    } else if (query.enabled === 'false') {
      sql += ' AND enabled = 0'
    }

    sql += ' ORDER BY path ASC'
    const rows = db.prepare(sql).all(...params) as DbRoute[]
    return rows.map(mapRoute)
  })

  // POST /api/routes
  fastify.post('/api/routes', async (request, reply) => {
    const parsed = createRouteSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.errors })
    }

    const data = parsed.data
    const id = randomUUID()
    const now = Date.now()
    const username = request.jwtUser?.username ?? null

    try {
      await runSavePipeline(
        () => {
          db.prepare(
            `INSERT INTO route (id, group_id, name, path, upstream_host, upstream_port,
             upstream_scheme, strip_prefix, websocket, enabled, description, advanced_json,
             created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).run(
            id,
            data.group_id ?? null,
            data.name,
            data.path,
            data.upstream_host,
            data.upstream_port,
            data.upstream_scheme,
            data.strip_prefix ? 1 : 0,
            data.websocket ? 1 : 0,
            data.enabled ? 1 : 0,
            data.description ?? null,
            JSON.stringify(data.advanced_json ?? {}),
            now,
            now
          )
        },
        { summary: `Created route "${data.name}"`, username }
      )
    } catch (err) {
      if (err instanceof SaveError) {
        return reply.code(422).send({ error: err.friendlyMessage, rawOutput: err.rawOutput })
      }
      throw err
    }

    const created = db.prepare('SELECT * FROM route WHERE id = ?').get(id) as DbRoute
    return reply.code(201).send(mapRoute(created))
  })

  // GET /api/routes/:id
  fastify.get('/api/routes/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const row = db.prepare('SELECT * FROM route WHERE id = ?').get(id) as DbRoute | undefined
    if (!row) return reply.code(404).send({ error: 'Route not found' })
    return mapRoute(row)
  })

  // PATCH /api/routes/:id
  fastify.patch('/api/routes/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const existing = db.prepare('SELECT * FROM route WHERE id = ?').get(id) as DbRoute | undefined
    if (!existing) return reply.code(404).send({ error: 'Route not found' })

    const parsed = updateRouteSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.errors })
    }

    const data = parsed.data
    const now = Date.now()
    const username = request.jwtUser?.username ?? null

    const merged = {
      group_id: 'group_id' in data ? (data.group_id ?? null) : existing.group_id,
      name: data.name ?? existing.name,
      path: data.path ?? existing.path,
      upstream_host: data.upstream_host ?? existing.upstream_host,
      upstream_port: data.upstream_port ?? existing.upstream_port,
      upstream_scheme: data.upstream_scheme ?? existing.upstream_scheme,
      strip_prefix: data.strip_prefix !== undefined ? data.strip_prefix : existing.strip_prefix === 1,
      websocket: data.websocket !== undefined ? data.websocket : existing.websocket === 1,
      enabled: data.enabled !== undefined ? data.enabled : existing.enabled === 1,
      description: 'description' in data ? (data.description ?? null) : existing.description,
      advanced_json: data.advanced_json !== undefined
        ? JSON.stringify(data.advanced_json)
        : existing.advanced_json,
    }

    try {
      await runSavePipeline(
        () => {
          db.prepare(
            `UPDATE route SET group_id = ?, name = ?, path = ?, upstream_host = ?,
             upstream_port = ?, upstream_scheme = ?, strip_prefix = ?, websocket = ?,
             enabled = ?, description = ?, advanced_json = ?, updated_at = ?
             WHERE id = ?`
          ).run(
            merged.group_id,
            merged.name,
            merged.path,
            merged.upstream_host,
            merged.upstream_port,
            merged.upstream_scheme,
            merged.strip_prefix ? 1 : 0,
            merged.websocket ? 1 : 0,
            merged.enabled ? 1 : 0,
            merged.description,
            merged.advanced_json,
            now,
            id
          )
        },
        { summary: `Updated route "${merged.name}"`, username }
      )
    } catch (err) {
      if (err instanceof SaveError) {
        return reply.code(422).send({ error: err.friendlyMessage, rawOutput: err.rawOutput })
      }
      throw err
    }

    const updated = db.prepare('SELECT * FROM route WHERE id = ?').get(id) as DbRoute
    return mapRoute(updated)
  })

  // POST /api/routes/:id/duplicate
  fastify.post('/api/routes/:id/duplicate', async (request, reply) => {
    const { id } = request.params as { id: string }
    const existing = db.prepare('SELECT * FROM route WHERE id = ?').get(id) as DbRoute | undefined
    if (!existing) return reply.code(404).send({ error: 'Route not found' })

    const newId = randomUUID()
    const now = Date.now()
    const username = request.jwtUser?.username ?? null
    const newName = `${existing.name}-copy`
    // Duplicate gets a modified path to avoid uniqueness conflicts
    const newPath = `${existing.path}-copy`

    try {
      await runSavePipeline(
        () => {
          db.prepare(
            `INSERT INTO route (id, group_id, name, path, upstream_host, upstream_port,
             upstream_scheme, strip_prefix, websocket, enabled, description, advanced_json,
             created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`
          ).run(
            newId,
            existing.group_id,
            newName,
            newPath,
            existing.upstream_host,
            existing.upstream_port,
            existing.upstream_scheme,
            existing.strip_prefix,
            existing.websocket,
            existing.description,
            existing.advanced_json,
            now,
            now
          )
        },
        { summary: `Duplicated route "${existing.name}" as "${newName}"`, username }
      )
    } catch (err) {
      if (err instanceof SaveError) {
        return reply.code(422).send({ error: err.friendlyMessage, rawOutput: err.rawOutput })
      }
      throw err
    }

    const created = db.prepare('SELECT * FROM route WHERE id = ?').get(newId) as DbRoute
    return reply.code(201).send(mapRoute(created))
  })

  // POST /api/routes/:id/enable
  fastify.post('/api/routes/:id/enable', async (request, reply) => {
    const { id } = request.params as { id: string }
    const existing = db.prepare('SELECT * FROM route WHERE id = ?').get(id) as DbRoute | undefined
    if (!existing) return reply.code(404).send({ error: 'Route not found' })

    const username = request.jwtUser?.username ?? null

    try {
      await runSavePipeline(
        () => {
          db.prepare('UPDATE route SET enabled = 1, updated_at = ? WHERE id = ?').run(
            Date.now(), id
          )
        },
        { summary: `Enabled route "${existing.name}"`, username }
      )
    } catch (err) {
      if (err instanceof SaveError) {
        return reply.code(422).send({ error: err.friendlyMessage, rawOutput: err.rawOutput })
      }
      throw err
    }

    return { ok: true }
  })

  // POST /api/routes/:id/disable
  fastify.post('/api/routes/:id/disable', async (request, reply) => {
    const { id } = request.params as { id: string }
    const existing = db.prepare('SELECT * FROM route WHERE id = ?').get(id) as DbRoute | undefined
    if (!existing) return reply.code(404).send({ error: 'Route not found' })

    const username = request.jwtUser?.username ?? null

    try {
      await runSavePipeline(
        () => {
          db.prepare('UPDATE route SET enabled = 0, updated_at = ? WHERE id = ?').run(
            Date.now(), id
          )
        },
        { summary: `Disabled route "${existing.name}"`, username }
      )
    } catch (err) {
      if (err instanceof SaveError) {
        return reply.code(422).send({ error: err.friendlyMessage, rawOutput: err.rawOutput })
      }
      throw err
    }

    return { ok: true }
  })

  // POST /api/routes/:id/move
  fastify.post('/api/routes/:id/move', async (request, reply) => {
    const { id } = request.params as { id: string }
    const existing = db.prepare('SELECT * FROM route WHERE id = ?').get(id) as DbRoute | undefined
    if (!existing) return reply.code(404).send({ error: 'Route not found' })

    const body = request.body as { group_id?: string | null }
    const groupId = body.group_id ?? null
    const username = request.jwtUser?.username ?? null

    if (groupId !== null) {
      const group = db.prepare('SELECT id FROM group_ WHERE id = ? AND kind = ?').get(groupId, 'proxy')
      if (!group) return reply.code(404).send({ error: 'Group not found' })
    }

    try {
      await runSavePipeline(
        () => {
          db.prepare('UPDATE route SET group_id = ?, updated_at = ? WHERE id = ?').run(
            groupId, Date.now(), id
          )
        },
        { summary: `Moved route "${existing.name}"`, username, skipNginxReload: true }
      )
    } catch (err) {
      if (err instanceof SaveError) {
        return reply.code(422).send({ error: err.friendlyMessage })
      }
      throw err
    }

    return { ok: true }
  })

  // DELETE /api/routes/:id
  fastify.delete('/api/routes/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const existing = db.prepare('SELECT * FROM route WHERE id = ?').get(id) as DbRoute | undefined
    if (!existing) return reply.code(404).send({ error: 'Route not found' })

    const username = request.jwtUser?.username ?? null

    try {
      await runSavePipeline(
        () => { db.prepare('DELETE FROM route WHERE id = ?').run(id) },
        { summary: `Deleted route "${existing.name}"`, username }
      )
    } catch (err) {
      if (err instanceof SaveError) {
        return reply.code(422).send({ error: err.friendlyMessage, rawOutput: err.rawOutput })
      }
      throw err
    }

    return { ok: true }
  })

  // POST /api/routes/bulk
  fastify.post('/api/routes/bulk', async (request, reply) => {
    const parsed = bulkActionSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.errors })
    }

    const { ids, action, group_id } = parsed.data
    const username = request.jwtUser?.username ?? null

    if (action === 'move' && group_id !== undefined && group_id !== null) {
      const group = db.prepare('SELECT id FROM group_ WHERE id = ? AND kind = ?').get(group_id, 'proxy')
      if (!group) return reply.code(404).send({ error: 'Group not found' })
    }

    const placeholders = ids.map(() => '?').join(',')
    const existingRoutes = db
      .prepare(`SELECT * FROM route WHERE id IN (${placeholders})`)
      .all(...ids) as DbRoute[]

    if (existingRoutes.length === 0) {
      return reply.code(404).send({ error: 'No matching routes found' })
    }

    const now = Date.now()
    const summary = `Bulk ${action} on ${ids.length} route(s)`
    const skipNginxReload = action === 'move'

    try {
      await runSavePipeline(
        () => {
          for (const id of ids) {
            if (action === 'enable') {
              db.prepare('UPDATE route SET enabled = 1, updated_at = ? WHERE id = ?').run(now, id)
            } else if (action === 'disable') {
              db.prepare('UPDATE route SET enabled = 0, updated_at = ? WHERE id = ?').run(now, id)
            } else if (action === 'delete') {
              db.prepare('DELETE FROM route WHERE id = ?').run(id)
            } else if (action === 'move') {
              db.prepare('UPDATE route SET group_id = ?, updated_at = ? WHERE id = ?').run(
                group_id ?? null, now, id
              )
            }
          }
        },
        { summary, username, skipNginxReload }
      )
    } catch (err) {
      if (err instanceof SaveError) {
        return reply.code(422).send({ error: err.friendlyMessage, rawOutput: err.rawOutput })
      }
      throw err
    }

    return { ok: true, affected: existingRoutes.length }
  })
}

export default routesApi
