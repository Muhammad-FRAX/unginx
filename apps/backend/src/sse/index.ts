/**
 * SSE endpoint — GET /api/events (plan.md §16).
 *
 * Multiplexes: health, log, config-changed, nginx-status, ping events.
 * Sends a ping every 25 seconds to keep the connection alive.
 * Logs page subscribes via ?subscribe=log.
 */

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { sseBus } from './bus.js'
import { subscribeToLogs, unsubscribeFromLogs } from '../logs/tail.js'
import type { SSEEvent } from '@unginx/shared'

const PING_INTERVAL_MS = 25_000

function formatSSE(event: SSEEvent): string {
  return `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`
}

const ssePlugin: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/events', (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { subscribe?: string }
    const wantsLog = query.subscribe?.split(',').includes('log') ?? false

    // Hijack the connection so Fastify doesn't try to finalize the response
    reply.hijack()

    const res = reply.raw
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no') // disable nginx buffering for SSE
    res.writeHead(200)

    if (wantsLog) {
      subscribeToLogs()
    }

    // Send an initial ping so the client knows we're connected
    res.write(formatSSE({ event: 'ping', data: {} }))

    const onEvent = (event: SSEEvent): void => {
      // Filter: only forward log events to clients that subscribed
      if (event.event === 'log' && !wantsLog) return
      try {
        res.write(formatSSE(event))
      } catch {
        cleanup()
      }
    }

    const pingTimer = setInterval(() => {
      try {
        res.write(formatSSE({ event: 'ping', data: {} }))
      } catch {
        cleanup()
      }
    }, PING_INTERVAL_MS)

    let cleaned = false
    function cleanup(): void {
      if (cleaned) return
      cleaned = true
      clearInterval(pingTimer)
      sseBus.off('sse', onEvent)
      if (wantsLog) unsubscribeFromLogs()
      try { res.end() } catch { /* ignore */ }
    }

    sseBus.on('sse', onEvent)

    request.raw.on('close', cleanup)
    request.raw.on('error', cleanup)
  })
}

export default ssePlugin
