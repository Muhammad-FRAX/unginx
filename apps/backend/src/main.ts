import Fastify from 'fastify'
import fs from 'fs'
import path from 'path'
import { SOCKET_PATH } from '@unginx/shared'
import { runMigrations } from './db/migrate.js'
import { seedDatabase } from './db/seed.js'
import { verifyToken } from './auth/jwt.js'
import { parseCookies } from './auth/cookie.js'
import db from './db/client.js'
import authRoutes from './auth/routes.js'
import nginxRoutes from './pipeline/routes.js'
import groupsApi from './routes-api/groups.js'
import routesApi from './routes-api/routes.js'
import fileRoutesApi from './routes-api/file-routes.js'
import versionsApi from './routes-api/versions.js'
import dataApi from './routes-api/data.js'
import settingsApi from './routes-api/settings.js'
import dashboardApi from './routes-api/dashboard.js'
import ssePlugin from './sse/index.js'
import logsApi from './logs/routes.js'
import { startHealthScheduler } from './health/index.js'
import { startLogRotation } from './logs/rotate.js'

declare module 'fastify' {
  interface FastifyRequest {
    jwtUser: {
      id: number
      username: string
      must_change_password: boolean
    } | null
  }
}

const socketPath = process.env['SOCKET_PATH'] ?? SOCKET_PATH

const app = Fastify({
  logger: {
    level: process.env['LOG_LEVEL'] ?? 'info',
  },
})

app.decorateRequest('jwtUser', null)

const PUBLIC_PREFIXES = ['/api/auth/login', '/api/health']

async function start() {
  runMigrations()
  await seedDatabase()

  app.addHook('onRequest', async (request, reply) => {
    if (PUBLIC_PREFIXES.some((p) => request.url.startsWith(p))) return

    const cookies = parseCookies(request)
    const token = cookies['unginx_token']
    if (!token) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    try {
      const claims = await verifyToken(token)
      const userId = parseInt(claims.sub ?? '', 10)
      if (isNaN(userId)) throw new Error('invalid sub')

      const user = db
        .prepare('SELECT id, username, must_change_password FROM user WHERE id = ?')
        .get(userId) as { id: number; username: string; must_change_password: number } | undefined

      if (!user) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      request.jwtUser = {
        id: user.id,
        username: user.username,
        must_change_password: user.must_change_password === 1,
      }
    } catch {
      return reply.code(401).send({ error: 'Unauthorized' })
    }
  })

  await app.register(authRoutes)
  await app.register(nginxRoutes)
  await app.register(groupsApi)
  await app.register(routesApi)
  await app.register(fileRoutesApi)
  await app.register(versionsApi)
  await app.register(dataApi)
  await app.register(settingsApi)
  await app.register(dashboardApi)
  await app.register(ssePlugin)
  await app.register(logsApi)

  // Phase 5 background services
  startHealthScheduler()
  startLogRotation()

  app.get('/api/health', async () => {
    return { ok: true, version: process.env['APP_VERSION'] ?? 'dev' }
  })

  app.setNotFoundHandler((_req, reply) => {
    reply.code(404).send({ error: 'Not found' })
  })

  const devPort = process.env['DEV_PORT']
  if (devPort) {
    await app.listen({ port: parseInt(devPort, 10), host: '127.0.0.1' })
    app.log.info(`Backend listening on http://127.0.0.1:${devPort}`)
    return
  }

  if (fs.existsSync(socketPath)) {
    fs.unlinkSync(socketPath)
  }

  fs.mkdirSync(path.dirname(socketPath), { recursive: true })

  await app.listen({ path: socketPath })
  fs.chmodSync(socketPath, '666')

  app.log.info(`Backend listening on ${socketPath}`)
}

start().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
