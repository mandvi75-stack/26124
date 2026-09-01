type EventCallback = (data: unknown) => void

class PrahariWebSocket {
  private ws: WebSocket | null = null
  private handlers: Map<string, Set<EventCallback>> = new Map()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private shouldReconnect = false
  private reconnectDelay = 2000

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return
    this.shouldReconnect = true
    this._connect()
  }

  private _connect() {
    try {
      const configuredBase = (import.meta.env.VITE_WS_URL || import.meta.env.VITE_API_URL || window.location.origin).replace(/\/+$/, '')
      const normalizedBase = configuredBase.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:')
      this.ws = new WebSocket(`${normalizedBase}/ws/events`)

      this.ws.onopen = () => {
        this.reconnectDelay = 2000
        this._emit('connected', { connected: true })
      }

      this.ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data)
          this._emit(msg.type, msg.data ?? msg)
        } catch { /* ignore */ }
      }

      this.ws.onclose = () => {
        this._emit('disconnected', {})
        if (this.shouldReconnect) {
          this.reconnectTimer = setTimeout(() => {
            this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, 30000)
            this._connect()
          }, this.reconnectDelay)
        }
      }

      this.ws.onerror = () => {
        this.ws?.close()
      }
    } catch (e) {
      console.error('WS connection failed:', e)
    }
  }

  disconnect() {
    this.shouldReconnect = false
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.ws?.close()
    this.ws = null
  }

  on(event: string, callback: EventCallback): () => void {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set())
    this.handlers.get(event)!.add(callback)
    return () => this.handlers.get(event)?.delete(callback)
  }

  send(type: string, data: unknown = {}) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, data }))
    }
  }

  private _emit(event: string, data: unknown) {
    this.handlers.get(event)?.forEach(cb => {
      try { cb(data) } catch { /* ignore */ }
    })
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }
}

export const praharWS = new PrahariWebSocket()
