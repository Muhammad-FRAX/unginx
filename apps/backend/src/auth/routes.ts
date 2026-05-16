import type { FastifyPluginAsync } from 'fastify'
import db from '../db/client.js'
import { signToken } from './jwt.js'
import { hashPassword, verifyPassword } from './password.js'
import { parseCookies, setCookie, clearCookie } from './cookie.js'
import {
  loginSchema,
  changePasswordSchema,
  BRUTE_FORCE_MAX_ATTEMPTS,
  BRUTE_FORCE_WINDOW_MS,
  BRUTE_FORCE_LOCKOUT_MS,
} from '@unginx/shared'

interface BruteForceRecord {
  count: number
  firstAt: number
  lockedUntil?: number
}

const failedAttempts = new Map<string, BruteForceRecord>()

function checkBruteForce(ip: string): { locked: boolean; retryAfterSecs?: number } {
  const now = Date.now()
  const record = failedAttempts.get(ip)
  if (!record) return { locked: false }

  if (record.lockedUntil !== undefined) {
    if (now < record.lockedUntil) {
      return { locked: true, retryAfterSecs: Math.ceil((record.lockedUntil - now) / 1000) }
    }
    failedAttempts.delete(ip)
    return { locked: false }
  }

  if (now - record.firstAt > BRUTE_FORCE_WINDOW_MS) {
    failedAttempts.delete(ip)
    return { locked: false }
  }

  return { locked: false }
}

function recordFailure(ip: string): void {
  const now = Date.now()
  const record = failedAttempts.get(ip)

  if (!record || now - record.firstAt > BRUTE_FORCE_WINDOW_MS) {
    failedAttempts.set(ip, { count: 1, firstAt: now })
    return
  }

  record.count++
  if (record.count >= BRUTE_FORCE_MAX_ATTEMPTS) {
    record.lockedUntil = now + BRUTE_FORCE_LOCKOUT_MS
  }
}

function clearFailures(ip: string): void {
  failedAttempts.delete(ip)
}

function getAdminPath(): string {
  const row = db
    .prepare('SELECT value FROM setting WHERE key = ?')
    .get('admin_path') as { value: string } | undefined
  return row?.value ?? '/__unginx'
}

interface DbUser {
  id: number
  username: string
  password_hash: string
  must_change_password: number
}

// Placeholder used to keep verify-time constant even when user not found
const DUMMY_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/api/auth/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid request', details: parsed.error.errors })
    }

    const ip = request.ip
    const bruteCheck = checkBruteForce(ip)
    if (bruteCheck.locked) {
      return reply
        .code(429)
        .send({ error: `Too many failed attempts. Try again in ${bruteCheck.retryAfterSecs}s.` })
    }

    const { username, password } = parsed.data

    const user = db
      .prepare(
        'SELECT id, username, password_hash, must_change_password FROM user WHERE username = ?'
      )
      .get(username) as DbUser | undefined

    const hashToVerify = user?.password_hash ?? DUMMY_HASH
    let valid = false
    try {
      valid = await verifyPassword(hashToVerify, password)
    } catch {
      valid = false
    }

    if (!user || !valid) {
      recordFailure(ip)
      return reply.code(401).send({ error: 'Invalid credentials' })
    }

    clearFailures(ip)

    const token = await signToken(user.id, user.username)
    const isHttps = request.headers['x-forwarded-proto'] === 'https'

    setCookie(reply, 'unginx_token', token, {
      httpOnly: true,
      sameSite: 'Strict',
      secure: isHttps,
      path: getAdminPath(),
    })

    return { ok: true, mustChangePassword: user.must_change_password === 1 }
  })

  fastify.post('/api/auth/logout', async (request, reply) => {
    clearCookie(reply, 'unginx_token', getAdminPath())
    return { ok: true }
  })

  fastify.post('/api/auth/change-password', async (request, reply) => {
    if (!request.jwtUser) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    const parsed = changePasswordSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid request', details: parsed.error.errors })
    }

    const { current_password, new_password } = parsed.data

    const user = db
      .prepare('SELECT password_hash FROM user WHERE id = ?')
      .get(request.jwtUser.id) as { password_hash: string } | undefined

    if (!user) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    const valid = await verifyPassword(user.password_hash, current_password)
    if (!valid) {
      return reply.code(401).send({ error: 'Current password is incorrect' })
    }

    const newHash = await hashPassword(new_password)
    db.prepare(
      'UPDATE user SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?'
    ).run(newHash, Date.now(), request.jwtUser.id)

    return { ok: true }
  })

  fastify.get('/api/me', async (request, reply) => {
    if (!request.jwtUser) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    return {
      id: request.jwtUser.id,
      username: request.jwtUser.username,
      mustChangePassword: request.jwtUser.must_change_password,
    }
  })
}

export default authRoutes
