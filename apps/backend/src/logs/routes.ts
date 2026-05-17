/**
 * Log API endpoints (plan.md §19):
 *   GET  /api/logs/download?type=access|error&lines=N
 *   POST /api/logs/truncate?type=access|error
 */

import fs from 'fs'
import path from 'path'
import type { FastifyPluginAsync } from 'fastify'
import { LOGS_DIR } from '@unginx/shared'

const logsApi: FastifyPluginAsync = async (fastify) => {
  // GET /api/logs/download
  fastify.get('/api/logs/download', async (request, reply) => {
    const query = request.query as { type?: string; lines?: string }
    const type = query.type === 'error' ? 'error' : 'access'
    const lines = Math.min(parseInt(query.lines ?? '1000', 10) || 1000, 100_000)

    const filePath = path.join(LOGS_DIR, `${type}.log`)

    if (!fs.existsSync(filePath)) {
      reply.header('Content-Type', 'text/plain')
      return reply.send('')
    }

    const content = readLastNLines(filePath, lines)

    reply
      .header('Content-Type', 'text/plain; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${type}.log"`)
      .send(content)
  })

  // POST /api/logs/truncate
  fastify.post('/api/logs/truncate', async (request, reply) => {
    const query = request.query as { type?: string }
    const type = query.type === 'error' ? 'error' : 'access'
    const filePath = path.join(LOGS_DIR, `${type}.log`)

    try {
      fs.mkdirSync(LOGS_DIR, { recursive: true })
      fs.writeFileSync(filePath, '', 'utf8')
      return reply.send({ ok: true })
    } catch (err) {
      return reply.code(500).send({ error: 'Failed to truncate log file' })
    }
  })
}

/**
 * Reads the last `n` lines from a file efficiently using a reverse scan.
 */
function readLastNLines(filePath: string, n: number): string {
  const CHUNK = 65_536 // 64 KB
  const fd = fs.openSync(filePath, 'r')
  const size = fs.fstatSync(fd).size

  let pos = size
  let lines: string[] = []
  let remainder = ''

  while (pos > 0 && lines.length < n) {
    const readSize = Math.min(CHUNK, pos)
    pos -= readSize
    const buf = Buffer.alloc(readSize)
    fs.readSync(fd, buf, 0, readSize, pos)
    const chunk = buf.toString('utf8') + remainder
    const parts = chunk.split('\n')
    remainder = parts.shift() ?? ''
    // parts are in forward order; prepend in reverse
    lines = parts.concat(lines)
  }

  if (remainder) lines.unshift(remainder)
  fs.closeSync(fd)

  const out = lines.slice(-n).join('\n')
  return out
}

export default logsApi
