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
  const devPort = process.env['DEV_PORT']
  if (devPort) {
    // In dev mode, listen on TCP so the Vite dev server proxy can reach us
    await app.listen({ port: parseInt(devPort, 10), host: '127.0.0.1' })
    app.log.info(`Backend listening on http://127.0.0.1:${devPort}`)
    return
  }

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
