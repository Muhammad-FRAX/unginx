import Fastify from 'fastify'
import fs from 'fs'
import path from 'path'
import { SOCKET_PATH } from '@unginx/shared'

const socketPath = process.env['SOCKET_PATH'] ?? SOCKET_PATH

const app = Fastify({
  logger: {
    level: process.env['LOG_LEVEL'] ?? 'info',
  },
})

app.get('/api/health', async () => {
  return { ok: true, version: process.env['APP_VERSION'] ?? 'dev' }
})

app.setNotFoundHandler((_req, reply) => {
  reply.code(404).send({ error: 'Not found' })
})

async function start() {
  if (fs.existsSync(socketPath)) {
    fs.unlinkSync(socketPath)
  }

  const socketDir = path.dirname(socketPath)
  fs.mkdirSync(socketDir, { recursive: true })

  await app.listen({ path: socketPath })

  fs.chmodSync(socketPath, '666')

  app.log.info(`Backend listening on ${socketPath}`)
}

start().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
