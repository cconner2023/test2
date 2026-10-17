// diagLog.ts — on-device diagnostics ring buffer.
//
// iOS standalone has no reachable console without a Mac, so warnings, errors,
// uncaught exceptions and boot milestones are mirrored into localStorage and
// surfaced by DiagnosticsPill. Stays on the device; the user copies it out.
//
// Must be the FIRST import in main.tsx: createLogger() binds console.warn /
// console.error at module scope, so the patch has to land before any other
// module evaluates. Dependency-free for the same reason.

export type DiagLevel = 'boot' | 'info' | 'warn' | 'error'

export interface DiagEntry {
  t: number
  level: DiagLevel
  msg: string
  /** Boot sequence number — groups entries by cold load. */
  boot: number
}

const KEY = 'diag_log'
const BOOT_KEY = 'diag_boot'
const MAX_ENTRIES = 400
const MAX_MSG = 1500

let entries: DiagEntry[] = []
let bootSeq = 0
const listeners = new Set<() => void>()

function load(): void {
  try {
    const raw = localStorage.getItem(KEY)
    entries = raw ? JSON.parse(raw) as DiagEntry[] : []
    bootSeq = (parseInt(localStorage.getItem(BOOT_KEY) ?? '0', 10) || 0) + 1
    localStorage.setItem(BOOT_KEY, String(bootSeq))
  } catch { entries = [] }
}

let saveQueued = false
function save(): void {
  if (saveQueued) return
  saveQueued = true
  // Batch bursts; flush synchronously on pagehide below.
  setTimeout(flush, 250)
}

function flush(): void {
  saveQueued = false
  try { localStorage.setItem(KEY, JSON.stringify(entries)) } catch { /* quota / unavailable */ }
}

function fmt(arg: unknown): string {
  if (arg instanceof Error) {
    const stack = arg.stack ? `\n${arg.stack.split('\n').slice(0, 6).join('\n')}` : ''
    return `${arg.name}: ${arg.message}${stack}`
  }
  if (typeof arg === 'string') return arg
  try { return JSON.stringify(arg) } catch { return String(arg) }
}

export function diag(level: DiagLevel, ...args: unknown[]): void {
  const msg = args.map(fmt).join(' ').slice(0, MAX_MSG)
  entries.push({ t: Date.now(), level, msg, boot: bootSeq })
  if (entries.length > MAX_ENTRIES) entries = entries.slice(-MAX_ENTRIES)
  save()
  listeners.forEach(l => l())
}

export function getDiagEntries(): DiagEntry[] {
  return entries
}

export function getBootSeq(): number {
  return bootSeq
}

export function clearDiag(): void {
  entries = []
  flush()
  listeners.forEach(l => l())
}

export function subscribeDiag(fn: () => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

export function formatDiag(list: DiagEntry[] = entries): string {
  return list.map(e => {
    const d = new Date(e.t)
    const ts = `${d.toISOString().slice(11, 23)}`
    return `#${e.boot} ${ts} ${e.level.toUpperCase()} ${e.msg}`
  }).join('\n')
}

// ─── Install ─────────────────────────────────────────────────────────
load()

const origWarn = console.warn.bind(console)
const origError = console.error.bind(console)
console.warn = (...args: unknown[]) => { diag('warn', ...args); origWarn(...args) }
console.error = (...args: unknown[]) => { diag('error', ...args); origError(...args) }

window.addEventListener('error', (e) => {
  diag('error', 'window.onerror', e.message, e.filename ? `${e.filename}:${e.lineno}:${e.colno}` : '', e.error ?? '')
})
window.addEventListener('unhandledrejection', (e) => {
  diag('error', 'unhandledrejection', e.reason)
})
window.addEventListener('pagehide', flush)
document.addEventListener('visibilitychange', () => {
  diag('info', `visibility=${document.visibilityState}`)
  if (document.visibilityState === 'hidden') flush()
})

const standalone =
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as unknown as { standalone?: boolean }).standalone === true
diag('boot', `cold load standalone=${standalone} online=${navigator.onLine} swController=${!!navigator.serviceWorker?.controller} ua=${navigator.userAgent}`)
