import { useEffect, useRef } from 'react'
import type { SSEEvent } from '@unginx/shared'

type SSEHandler = (event: SSEEvent) => void

class SSEClient {
  private source: EventSource | null = null
  private handlers = new Set<SSEHandler>()
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null

  connect() {
    if (this.source) return
    this.source = new EventSource('/__unginx/api/events', { withCredentials: true })

    const eventTypes: Array<SSEEvent['event']> = ['health', 'log', 'config-changed', 'nginx-status', 'ping']
    for (const type of eventTypes) {
      this.source.addEventListener(type, (e: Event) => {
        const me = e as MessageEvent<string>
        try {
          const data = JSON.parse(me.data) as unknown
          this.handlers.forEach((h) => h({ event: type, data } as SSEEvent))
        } catch {
          // ignore parse errors
        }
      })
    }

    this.source.onerror = () => {
      this.source?.close()
      this.source = null
      this.reconnectTimeout = setTimeout(() => this.connect(), 3000)
    }
  }

  disconnect() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout)
    this.source?.close()
    this.source = null
  }

  subscribe(handler: SSEHandler) {
    this.handlers.add(handler)
    if (this.handlers.size === 1) this.connect()
    return () => {
      this.handlers.delete(handler)
      if (this.handlers.size === 0) this.disconnect()
    }
  }
}

export const sseClient = new SSEClient()

export function useSSE(handler: SSEHandler) {
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    const stableHandler: SSEHandler = (event) => handlerRef.current(event)
    return sseClient.subscribe(stableHandler)
  }, [])
}
