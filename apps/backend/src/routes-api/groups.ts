import type { FastifyPluginAsync } from 'fastify'
import { randomUUID } from 'crypto'
import db from '../db/client.js'
import { runSavePipeline, SaveError } from '../pipeline/save.js'
import { createGroupSchema, updateGroupSchema } from '@unginx/shared'

interface DbGroup {
  id: string
  kind: string
  name: string
  description: string | null
  created_at: number
}

const groupsApi: FastifyPluginAsync = async (fastify) => {
  // GET /api/groups?kind=proxy|file
  fastify.get('/api/groups', async (request, reply) => {
    const query = request.query as { kind?: string }
    let rows: DbGroup[]

    if (query.kind === 'proxy' || query.kind === 'file') {
      rows = db
        .prepare('SELECT * FROM group_ WHERE kind = ? ORDER BY name ASC')
        .all(query.kind) as DbGroup[]
    } else {
      rows = db
        .prepare('SELECT * FROM group_ ORDER BY kind ASC, name ASC')
        .all() as DbGroup[]
    }

    return rows
  })

  // POST /api/groups
  fastify.post('/api/groups', async (request, reply) => {
    const parsed = createGroupSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.errors })
    }

    const { kind, name, description } = parsed.data
    const id = randomUUID()
    const now = Date.now()
    const username = request.jwtUser?.username ?? null

    try {
      await runSavePipeline(
        () => {
          const existing = db
            .prepare('SELECT id FROM group_ WHERE kind = ? AND name = ?')
            .get(kind, name)
          if (existing) {
            throw new SaveError(
              `Group "${name}" already exists`,
              `A ${kind} group named "${name}" already exists.`
            )
          }
          db.prepare(
            'INSERT INTO group_ (id, kind, name, description, created_at) VALUES (?, ?, ?, ?, ?)'
          ).run(id, kind, name, description ?? null, now)
        },
        { summary: `Created ${kind} group "${name}"`, username, skipNginxReload: true }
      )
    } catch (err) {
      if (err instanceof SaveError) {
        return reply.code(409).send({ error: err.friendlyMessage })
      }
      throw err
    }

    const created = db.prepare('SELECT * FROM group_ WHERE id = ?').get(id) as DbGroup
    return reply.code(201).send(created)
  })

  // PATCH /api/groups/:id
  fastify.patch('/api/groups/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const existing = db.prepare('SELECT * FROM group_ WHERE id = ?').get(id) as DbGroup | undefined
    if (!existing) {
      return reply.code(404).send({ error: 'Group not found' })
    }

    const parsed = updateGroupSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation failed', details: parsed.error.errors })
    }

    const { name, description } = parsed.data
    const username = request.jwtUser?.username ?? null
    const newName = name ?? existing.name
    const newDesc = description !== undefined ? description : existing.description

    try {
      await runSavePipeline(
        () => {
          if (name && name !== existing.name) {
            const conflict = db
              .prepare('SELECT id FROM group_ WHERE kind = ? AND name = ? AND id != ?')
              .get(existing.kind, name, id)
            if (conflict) {
              throw new SaveError(
                `Group "${name}" already exists`,
                `A ${existing.kind} group named "${name}" already exists.`
              )
            }
          }
          db.prepare('UPDATE group_ SET name = ?, description = ? WHERE id = ?').run(
            newName,
            newDesc,
            id
          )
        },
        {
          summary: `Renamed group "${existing.name}" → "${newName}"`,
          username,
          skipNginxReload: true,
        }
      )
    } catch (err) {
      if (err instanceof SaveError) {
        return reply.code(409).send({ error: err.friendlyMessage })
      }
      throw err
    }

    const updated = db.prepare('SELECT * FROM group_ WHERE id = ?').get(id) as DbGroup
    return updated
  })

  // DELETE /api/groups/:id?mode=move|delete
  fastify.delete('/api/groups/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const query = request.query as { mode?: string }
    const mode = query.mode === 'delete' ? 'delete' : 'move'

    const existing = db.prepare('SELECT * FROM group_ WHERE id = ?').get(id) as DbGroup | undefined
    if (!existing) {
      return reply.code(404).send({ error: 'Group not found' })
    }

    const username = request.jwtUser?.username ?? null

    try {
      await runSavePipeline(
        () => {
          if (mode === 'delete') {
            db.prepare('DELETE FROM route WHERE group_id = ?').run(id)
            db.prepare('DELETE FROM file_route WHERE group_id = ?').run(id)
          } else {
            db.prepare('UPDATE route SET group_id = NULL WHERE group_id = ?').run(id)
            db.prepare('UPDATE file_route SET group_id = NULL WHERE group_id = ?').run(id)
          }
          db.prepare('DELETE FROM group_ WHERE id = ?').run(id)
        },
        {
          summary: `Deleted group "${existing.name}" (children: ${mode === 'delete' ? 'deleted' : 'moved to ungrouped'})`,
          username,
          skipNginxReload: mode === 'move',
        }
      )
    } catch (err) {
      if (err instanceof SaveError) {
        return reply.code(422).send({ error: err.friendlyMessage })
      }
      throw err
    }

    return { ok: true }
  })
}

export default groupsApi
