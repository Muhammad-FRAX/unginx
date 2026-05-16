import type { FastifyPluginAsync } from 'fastify'
import fs from 'fs'
import os from 'os'
import { execSync } from 'child_process'
import db from '../db/client.js'
import { runSavePipeline, SaveError } from '../pipeline/save.js'
import { z } from 'zod'

const SENSITIVE_KEY_PATTERN = /password|secret/i

function getNginxVersion(): string {
  try {
    const out = execSync('nginx -v 2>&1', { encoding: 'utf8', timeout: 5000 })
    return out.trim()
  } catch {
    return 'unknown'
  }
}

function detectEnvironment(): 'container' | 'host' {
  try {
    if (fs.existsSync('/.dockerenv')) return 'container'
    const cgroup = fs.readFileSync('/proc/1/cgroup', 'utf8')
    if (/docker|containerd|kubepods/.test(cgroup)) return 'container'
  } catch {
    // ignore
  }
  if (process.env['KUBERNETES_SERVICE_HOST']) return 'container'
  return 'host'
}

function getSetting(key: string): string | null {
  const row = db.prepare('SELECT value FROM setting WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  return row?.value ?? null
}

const settingsApi: FastifyPluginAsync = async (fastify) => {
  // GET /api/settings
  fastify.get('/api/settings', async () => {
    const adminPath = getSetting('admin_path') ?? '/__unginx'
    const themeDefault = getSetting('theme_default') ?? 'system'
    const nginxVersion = getSetting('nginx_version') ?? getNginxVersion()
    const schemaVersion = getSetting('schema_version') ?? '1'
    const envMode = detectEnvironment()

    // Collect env vars, redacting sensitive keys
    const envVars: Record<string, string> = {}
    for (const [key, val] of Object.entries(process.env)) {
      if (val !== undefined) {
        envVars[key] = SENSITIVE_KEY_PATTERN.test(key) ? '[REDACTED]' : val
      }
    }

    return {
      adminPath,
      themeDefault,
      nginxVersion,
      schemaVersion: parseInt(schemaVersion, 10),
      deployment: {
        mode: envMode,
        hostname: os.hostname(),
        platform: os.platform(),
        appVersion: process.env['APP_VERSION'] ?? 'dev',
      },
      envVars,
    }
  })

  // PATCH /api/settings/admin-path
  fastify.patch('/api/settings/admin-path', async (request, reply) => {
    const body = request.body as { newPath?: string } | undefined
    if (!body?.newPath) {
      return reply.code(400).send({ error: 'newPath is required' })
    }

    const adminPathSchema = z
      .string()
      .min(2)
      .max(256)
      .refine((v) => v.startsWith('/'), { message: 'Path must start with /' })
      .refine((v) => !v.includes('..'), { message: 'Path must not contain ..' })
      .refine((v) => !/[\x00-\x1F\s?#]/.test(v), {
        message: 'Path must not contain whitespace, control characters, ? or #',
      })

    const pathParsed = adminPathSchema.safeParse(body.newPath)
    if (!pathParsed.success) {
      return reply.code(400).send({ error: 'Invalid path', details: pathParsed.error.errors })
    }

    const newPath = pathParsed.data
    const segments = newPath.split('/').filter(Boolean)
    if (segments.length < 1) {
      return reply.code(400).send({ error: 'Admin path must have at least one path segment (/x minimum)' })
    }

    const username = request.jwtUser?.username ?? null

    try {
      await runSavePipeline(
        () => {
          db.prepare('INSERT OR REPLACE INTO setting (key, value) VALUES (?, ?)').run(
            'admin_path',
            newPath
          )
        },
        {
          summary: `Changed admin path to "${newPath}"`,
          username,
        }
      )
    } catch (err) {
      if (err instanceof SaveError) {
        return reply.code(422).send({ error: err.friendlyMessage, rawOutput: err.rawOutput })
      }
      throw err
    }

    return { ok: true, newPath }
  })

  // PATCH /api/settings/theme
  fastify.patch('/api/settings/theme', async (request, reply) => {
    const body = request.body as { theme?: string } | undefined
    const schema = z.enum(['light', 'dark', 'system'])
    const parsed = schema.safeParse(body?.theme)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'theme must be "light", "dark", or "system"' })
    }

    db.prepare('INSERT OR REPLACE INTO setting (key, value) VALUES (?, ?)').run(
      'theme_default',
      parsed.data
    )

    return { ok: true, theme: parsed.data }
  })

  // PATCH /api/settings/account — change username and/or password
  fastify.patch('/api/settings/account', async (request, reply) => {
    if (!request.jwtUser) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    const body = request.body as {
      current_password?: string
      new_username?: string
      new_password?: string
    } | undefined

    if (!body?.current_password) {
      return reply.code(400).send({ error: 'current_password is required' })
    }
    if (!body.new_username && !body.new_password) {
      return reply.code(400).send({ error: 'Provide new_username and/or new_password' })
    }

    // Dynamic import to avoid circular deps
    const { verifyPassword, hashPassword } = await import('../auth/password.js')

    const user = db
      .prepare('SELECT id, password_hash FROM user WHERE id = ?')
      .get(request.jwtUser.id) as { id: number; password_hash: string } | undefined

    if (!user) return reply.code(401).send({ error: 'Unauthorized' })

    const valid = await verifyPassword(user.password_hash, body.current_password)
    if (!valid) return reply.code(401).send({ error: 'Current password is incorrect' })

    const now = Date.now()

    if (body.new_username) {
      const conflict = db
        .prepare('SELECT id FROM user WHERE username = ? AND id != ?')
        .get(body.new_username, request.jwtUser.id)
      if (conflict) return reply.code(409).send({ error: 'Username already taken' })
      db.prepare('UPDATE user SET username = ?, updated_at = ? WHERE id = ?').run(
        body.new_username, now, user.id
      )
    }

    if (body.new_password) {
      if (body.new_password.length < 8) {
        return reply.code(400).send({ error: 'Password must be at least 8 characters' })
      }
      const newHash = await hashPassword(body.new_password)
      db.prepare('UPDATE user SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?').run(
        newHash, now, user.id
      )
    }

    return { ok: true }
  })
}

export default settingsApi
