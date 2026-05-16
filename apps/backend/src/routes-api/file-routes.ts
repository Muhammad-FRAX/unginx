import type { FastifyPluginAsync } from 'fastify'
import { randomUUID } from 'crypto'
import fs from 'fs'
import db from '../db/client.js'
import { runSavePipeline, SaveError } from '../pipeline/save.js'
import { createFileRouteSchema, updateFileRouteSchema, bulkActionSchema } from '@unginx/shared'
import type { FileRoute } from '@unginx/shared'

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

function mapFileRoute(r: DbFileRoute): FileRoute {
  return {
    ...r,
    dir_listing: r.dir_listing === 1,
    spa_mode: r.spa_mode === 1,
    enabled: r.enabled === 1,
    advanced_json: (() => {
      try { return JSON.parse(r.advanced_json || '{}') } catch { return {} }
    })(),
  }
}

const fileRoutesApi: FastifyPluginAsync = async (fastify) => {
  // GET /api/file-routes?group_id=...&enabled=true|false
  fastify.get('/api/file-routes', async (request) => {
    const query = request.query as { group_id?: string; enabled?: string }
    let sql = 'SELECT * FROM file_route WHERE 1=1'
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
    const rows = db.prepare(sql).all(...params) as DbFileRoute[]
    return rows.map(mapFileRoute)
  })

  // POST /api/file-routes
  fastify.post('/api/file-routes', async (request, reply) => {
    const parsed = createFileRouteSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.errors })
    }

    const data = parsed.data
    const id = randomUUID()
    const now = Date.now()
    const username = request.jwtUser?.username ?? null

    // Non-blocking folder existence warning
    const folderWarning = !fs.existsSync(data.folder_path)
      ? `Folder "${data.folder_path}" not found — you can still save; mount it before the route is needed.`
      : undefined

    // SPA mode preset: sets try_files to '/index.html'
    const tryFiles = data.spa_mode ? '/index.html' : (data.try_files ?? null)

    try {
      await runSavePipeline(
        () => {
          db.prepare(
            `INSERT INTO file_route (id, group_id, name, path, folder_path, index_files,
             dir_listing, try_files, spa_mode, enabled, description, advanced_json,
             created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).run(
            id,
            data.group_id ?? null,
            data.name,
            data.path,
            data.folder_path,
            data.index_files,
            data.dir_listing ? 1 : 0,
            tryFiles,
            data.spa_mode ? 1 : 0,
            data.enabled ? 1 : 0,
            data.description ?? null,
            JSON.stringify(data.advanced_json ?? {}),
            now,
            now
          )
        },
        { summary: `Created file route "${data.name}"`, username }
      )
    } catch (err) {
      if (err instanceof SaveError) {
        return reply.code(422).send({ error: err.friendlyMessage, rawOutput: err.rawOutput })
      }
      throw err
    }

    const created = db.prepare('SELECT * FROM file_route WHERE id = ?').get(id) as DbFileRoute
    const result = mapFileRoute(created)
    return reply.code(201).send(folderWarning ? { ...result, warning: folderWarning } : result)
  })

  // GET /api/file-routes/:id
  fastify.get('/api/file-routes/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const row = db.prepare('SELECT * FROM file_route WHERE id = ?').get(id) as DbFileRoute | undefined
    if (!row) return reply.code(404).send({ error: 'File route not found' })
    return mapFileRoute(row)
  })

  // PATCH /api/file-routes/:id
  fastify.patch('/api/file-routes/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const existing = db.prepare('SELECT * FROM file_route WHERE id = ?').get(id) as DbFileRoute | undefined
    if (!existing) return reply.code(404).send({ error: 'File route not found' })

    const parsed = updateFileRouteSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.errors })
    }

    const data = parsed.data
    const now = Date.now()
    const username = request.jwtUser?.username ?? null

    const spaMode = data.spa_mode !== undefined ? data.spa_mode : existing.spa_mode === 1
    const tryFiles = spaMode
      ? '/index.html'
      : (data.try_files !== undefined ? (data.try_files ?? null) : existing.try_files)

    const merged = {
      group_id: 'group_id' in data ? (data.group_id ?? null) : existing.group_id,
      name: data.name ?? existing.name,
      path: data.path ?? existing.path,
      folder_path: data.folder_path ?? existing.folder_path,
      index_files: data.index_files ?? existing.index_files,
      dir_listing: data.dir_listing !== undefined ? data.dir_listing : existing.dir_listing === 1,
      try_files: tryFiles,
      spa_mode: spaMode,
      enabled: data.enabled !== undefined ? data.enabled : existing.enabled === 1,
      description: 'description' in data ? (data.description ?? null) : existing.description,
      advanced_json: data.advanced_json !== undefined
        ? JSON.stringify(data.advanced_json)
        : existing.advanced_json,
    }

    // Non-blocking folder warning
    const folderWarning = !fs.existsSync(merged.folder_path)
      ? `Folder "${merged.folder_path}" not found — mount it before the route is needed.`
      : undefined

    try {
      await runSavePipeline(
        () => {
          db.prepare(
            `UPDATE file_route SET group_id = ?, name = ?, path = ?, folder_path = ?,
             index_files = ?, dir_listing = ?, try_files = ?, spa_mode = ?,
             enabled = ?, description = ?, advanced_json = ?, updated_at = ?
             WHERE id = ?`
          ).run(
            merged.group_id,
            merged.name,
            merged.path,
            merged.folder_path,
            merged.index_files,
            merged.dir_listing ? 1 : 0,
            merged.try_files,
            merged.spa_mode ? 1 : 0,
            merged.enabled ? 1 : 0,
            merged.description,
            merged.advanced_json,
            now,
            id
          )
        },
        { summary: `Updated file route "${merged.name}"`, username }
      )
    } catch (err) {
      if (err instanceof SaveError) {
        return reply.code(422).send({ error: err.friendlyMessage, rawOutput: err.rawOutput })
      }
      throw err
    }

    const updated = db.prepare('SELECT * FROM file_route WHERE id = ?').get(id) as DbFileRoute
    const result = mapFileRoute(updated)
    return folderWarning ? { ...result, warning: folderWarning } : result
  })

  // POST /api/file-routes/:id/duplicate
  fastify.post('/api/file-routes/:id/duplicate', async (request, reply) => {
    const { id } = request.params as { id: string }
    const existing = db.prepare('SELECT * FROM file_route WHERE id = ?').get(id) as DbFileRoute | undefined
    if (!existing) return reply.code(404).send({ error: 'File route not found' })

    const newId = randomUUID()
    const now = Date.now()
    const username = request.jwtUser?.username ?? null
    const newName = `${existing.name}-copy`
    const newPath = `${existing.path}-copy`

    try {
      await runSavePipeline(
        () => {
          db.prepare(
            `INSERT INTO file_route (id, group_id, name, path, folder_path, index_files,
             dir_listing, try_files, spa_mode, enabled, description, advanced_json,
             created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`
          ).run(
            newId,
            existing.group_id,
            newName,
            newPath,
            existing.folder_path,
            existing.index_files,
            existing.dir_listing,
            existing.try_files,
            existing.spa_mode,
            existing.description,
            existing.advanced_json,
            now,
            now
          )
        },
        { summary: `Duplicated file route "${existing.name}" as "${newName}"`, username }
      )
    } catch (err) {
      if (err instanceof SaveError) {
        return reply.code(422).send({ error: err.friendlyMessage, rawOutput: err.rawOutput })
      }
      throw err
    }

    const created = db.prepare('SELECT * FROM file_route WHERE id = ?').get(newId) as DbFileRoute
    return reply.code(201).send(mapFileRoute(created))
  })

  // POST /api/file-routes/:id/enable
  fastify.post('/api/file-routes/:id/enable', async (request, reply) => {
    const { id } = request.params as { id: string }
    const existing = db.prepare('SELECT * FROM file_route WHERE id = ?').get(id) as DbFileRoute | undefined
    if (!existing) return reply.code(404).send({ error: 'File route not found' })

    const username = request.jwtUser?.username ?? null

    try {
      await runSavePipeline(
        () => {
          db.prepare('UPDATE file_route SET enabled = 1, updated_at = ? WHERE id = ?').run(Date.now(), id)
        },
        { summary: `Enabled file route "${existing.name}"`, username }
      )
    } catch (err) {
      if (err instanceof SaveError) {
        return reply.code(422).send({ error: err.friendlyMessage, rawOutput: err.rawOutput })
      }
      throw err
    }

    return { ok: true }
  })

  // POST /api/file-routes/:id/disable
  fastify.post('/api/file-routes/:id/disable', async (request, reply) => {
    const { id } = request.params as { id: string }
    const existing = db.prepare('SELECT * FROM file_route WHERE id = ?').get(id) as DbFileRoute | undefined
    if (!existing) return reply.code(404).send({ error: 'File route not found' })

    const username = request.jwtUser?.username ?? null

    try {
      await runSavePipeline(
        () => {
          db.prepare('UPDATE file_route SET enabled = 0, updated_at = ? WHERE id = ?').run(Date.now(), id)
        },
        { summary: `Disabled file route "${existing.name}"`, username }
      )
    } catch (err) {
      if (err instanceof SaveError) {
        return reply.code(422).send({ error: err.friendlyMessage, rawOutput: err.rawOutput })
      }
      throw err
    }

    return { ok: true }
  })

  // POST /api/file-routes/:id/move
  fastify.post('/api/file-routes/:id/move', async (request, reply) => {
    const { id } = request.params as { id: string }
    const existing = db.prepare('SELECT * FROM file_route WHERE id = ?').get(id) as DbFileRoute | undefined
    if (!existing) return reply.code(404).send({ error: 'File route not found' })

    const body = request.body as { group_id?: string | null }
    const groupId = body.group_id ?? null
    const username = request.jwtUser?.username ?? null

    if (groupId !== null) {
      const group = db.prepare('SELECT id FROM group_ WHERE id = ? AND kind = ?').get(groupId, 'file')
      if (!group) return reply.code(404).send({ error: 'Group not found' })
    }

    try {
      await runSavePipeline(
        () => {
          db.prepare('UPDATE file_route SET group_id = ?, updated_at = ? WHERE id = ?').run(
            groupId, Date.now(), id
          )
        },
        { summary: `Moved file route "${existing.name}"`, username, skipNginxReload: true }
      )
    } catch (err) {
      if (err instanceof SaveError) {
        return reply.code(422).send({ error: err.friendlyMessage })
      }
      throw err
    }

    return { ok: true }
  })

  // DELETE /api/file-routes/:id
  fastify.delete('/api/file-routes/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const existing = db.prepare('SELECT * FROM file_route WHERE id = ?').get(id) as DbFileRoute | undefined
    if (!existing) return reply.code(404).send({ error: 'File route not found' })

    const username = request.jwtUser?.username ?? null

    try {
      await runSavePipeline(
        () => { db.prepare('DELETE FROM file_route WHERE id = ?').run(id) },
        { summary: `Deleted file route "${existing.name}"`, username }
      )
    } catch (err) {
      if (err instanceof SaveError) {
        return reply.code(422).send({ error: err.friendlyMessage, rawOutput: err.rawOutput })
      }
      throw err
    }

    return { ok: true }
  })

  // POST /api/file-routes/bulk
  fastify.post('/api/file-routes/bulk', async (request, reply) => {
    const parsed = bulkActionSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.errors })
    }

    const { ids, action, group_id } = parsed.data
    const username = request.jwtUser?.username ?? null

    if (action === 'move' && group_id !== undefined && group_id !== null) {
      const group = db.prepare('SELECT id FROM group_ WHERE id = ? AND kind = ?').get(group_id, 'file')
      if (!group) return reply.code(404).send({ error: 'Group not found' })
    }

    const placeholders = ids.map(() => '?').join(',')
    const existingRoutes = db
      .prepare(`SELECT * FROM file_route WHERE id IN (${placeholders})`)
      .all(...ids) as DbFileRoute[]

    if (existingRoutes.length === 0) {
      return reply.code(404).send({ error: 'No matching file routes found' })
    }

    const now = Date.now()
    const summary = `Bulk ${action} on ${ids.length} file route(s)`
    const skipNginxReload = action === 'move'

    try {
      await runSavePipeline(
        () => {
          for (const id of ids) {
            if (action === 'enable') {
              db.prepare('UPDATE file_route SET enabled = 1, updated_at = ? WHERE id = ?').run(now, id)
            } else if (action === 'disable') {
              db.prepare('UPDATE file_route SET enabled = 0, updated_at = ? WHERE id = ?').run(now, id)
            } else if (action === 'delete') {
              db.prepare('DELETE FROM file_route WHERE id = ?').run(id)
            } else if (action === 'move') {
              db.prepare('UPDATE file_route SET group_id = ?, updated_at = ? WHERE id = ?').run(
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

  // GET /api/files/browse?path=/data/sites
  fastify.get('/api/files/browse', async (request, reply) => {
    const query = request.query as { path?: string }
    const browsePath = query.path ?? '/data/sites'

    if (!browsePath.startsWith('/') || browsePath.includes('..')) {
      return reply.code(400).send({ error: 'Invalid path' })
    }

    try {
      const entries = fs.readdirSync(browsePath, { withFileTypes: true })
      return {
        path: browsePath,
        entries: entries.map((e) => ({
          name: e.name,
          isDirectory: e.isDirectory(),
          fullPath: `${browsePath}/${e.name}`,
        })),
      }
    } catch {
      return reply.code(404).send({ error: `Path "${browsePath}" not found or not readable` })
    }
  })
}

export default fileRoutesApi
