import type { ErrorCode } from './errorCodes'

export interface ErrorEvent {
  code: ErrorCode
  message: string
  source: string
  timestamp: number
  metadata?: Record<string, unknown>
}

type ErrorHandler = (event: ErrorEvent) => void

const MAX_BUFFER_SIZE = 100
const buffer: ErrorEvent[] = []
const handlers = new Set<ErrorHandler>()

export const errorBus = {
  emit(event: ErrorEvent): void {
    buffer.push(event)
    if (buffer.length > MAX_BUFFER_SIZE) {
      buffer.shift()
    }
    for (const handler of handlers) {
      handler(event)
    }
  },

  subscribe(handler: ErrorHandler): () => void {
    handlers.add(handler)
    return () => {
      handlers.delete(handler)
    }
  },

  getRecent(count: number = MAX_BUFFER_SIZE): ErrorEvent[] {
    return buffer.slice(-count)
  },
}
