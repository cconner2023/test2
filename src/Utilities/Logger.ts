/**
 * Structured logger with environment-aware filtering.
 *
 * development: all levels emit (debug, info, warn, error).
 * production: only warn and error emit; debug and info are suppressed.
 *
 * console.*.bind() to preserve DevTools call-site line numbers.
 */

interface Logger {
  debug: (...args: unknown[]) => void
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
}

const noop = () => { }

export function createLogger(module: string): Logger {
  const prefix = `[${module}]`

  if (import.meta.env.PROD) {
    return {
      debug: noop,
      info: noop,
      warn: console.warn.bind(console, prefix),
      error: console.error.bind(console, prefix),
    }
  }

  return {
    debug: console.log.bind(console, prefix),
    info: console.log.bind(console, prefix),
    warn: console.warn.bind(console, prefix),
    error: console.error.bind(console, prefix),
  }
}
