import type { FastifyPluginAsync } from 'fastify'
import { runNginxTestOnActive } from '../nginx/test.js'
import { reloadNginx } from '../nginx/reload.js'
import { parseNginxErrors } from '../nginx/parse-errors.js'

const nginxRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/nginx/test — run nginx -t against the active config
  fastify.post('/api/nginx/test', async (_request, reply) => {
    const result = await runNginxTestOnActive()
    if (result.ok) {
      return { ok: true, output: result.rawOutput }
    }
    return reply.code(422).send({
      ok: false,
      error: parseNginxErrors(result.rawOutput),
      rawOutput: result.rawOutput,
    })
  })

  // POST /api/nginx/reload — manual SIGHUP
  fastify.post('/api/nginx/reload', async (_request, reply) => {
    const result = await reloadNginx()
    if (result.ok) {
      return { ok: true }
    }
    return reply.code(500).send({ ok: false, error: result.error })
  })
}

export default nginxRoutes
