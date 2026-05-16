import { EventEmitter } from 'events'
import type { SSEEvent } from '@unginx/shared'

class SSEBus extends EventEmitter {
  broadcast(event: SSEEvent): void {
    this.emit('sse', event)
  }
}

// Singleton event bus — Phase 5 wires the actual SSE endpoint subscribers here.
export const sseBus = new SSEBus()
sseBus.setMaxListeners(100)
