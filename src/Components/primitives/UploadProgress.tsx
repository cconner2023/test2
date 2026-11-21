import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Check, File as FileIcon, RotateCw, X, AlertCircle, type LucideIcon } from 'lucide-react'
import { useOverlay } from '../../Hooks/useOverlay'
import { useHeldWhileOpen } from '../../Hooks/useHeldWhileOpen'

/**
 * Upload progress: a ring around a file badge. 'preparing' covers encrypt + sign,
 * which report no bytes, so it sweeps instead of lying with a frozen 0%.
 */
export type UploadPhase = 'preparing' | 'uploading' | 'done' | 'error'

export interface UploadTask {
  name: string
  size: number
  phase: UploadPhase
  /** 0..1 of the transfer. */
  progress: number
  etaSeconds: number | null
  error?: string
  /** Image URL shown inside the ring in place of the file badge. Owner revokes it. */
  preview?: string
  /** Replaces the file badge for non-file items (events, map features, templates).
   *  Once done the ring drops away and the icon sits in a tinted disc. */
  icon?: LucideIcon
  /** Second line once ready, in place of the byte size. */
  detail?: string
}

type RunResult<T> = { ok: true; data: T } | { ok: false; error: string }
export interface UploadRunCtx {
  onProgress: (fraction: number) => void
  signal: AbortSignal
}

/**
 * Owns one upload's lifecycle. `start` resolves the runner's data, or null on
 * failure or cancel (cancel clears the task; failure leaves it showing the error).
 */
export function useUploadTask<T>() {
  const [task, setTask] = useState<UploadTask | null>(null)
  const ctrlRef = useRef<AbortController | null>(null)
  // ETA is measured from the first progress event, not from start: encrypt and
  // sign time would otherwise read as a slow link.
  const firstTickRef = useRef<{ t: number; p: number } | null>(null)

  const cancel = useCallback(() => {
    ctrlRef.current?.abort()
    ctrlRef.current = null
    setTask(null)
  }, [])

  useEffect(() => () => ctrlRef.current?.abort(), [])

  const start = useCallback(async (
    meta: Pick<UploadTask, 'name' | 'size' | 'preview' | 'icon' | 'detail'>,
    run: (ctx: UploadRunCtx) => Promise<RunResult<T>>,
  ): Promise<T | null> => {
    ctrlRef.current?.abort()
    const ctrl = new AbortController()
    ctrlRef.current = ctrl
    firstTickRef.current = null
    setTask({
      name: meta.name, size: meta.size, preview: meta.preview, icon: meta.icon, detail: meta.detail,
      phase: 'preparing', progress: 0, etaSeconds: null,
    })

    const onProgress = (p: number) => {
      if (ctrl.signal.aborted) return
      const now = performance.now()
      if (!firstTickRef.current) firstTickRef.current = { t: now, p }
      const first = firstTickRef.current
      const elapsed = (now - first.t) / 1000
      const rate = elapsed > 0 ? (p - first.p) / elapsed : 0
      const eta = elapsed > 1 && rate > 0 && p < 1 ? (1 - p) / rate : null
      setTask(prev => prev && { ...prev, phase: 'uploading', progress: p, etaSeconds: eta })
    }

    const res = await run({ onProgress, signal: ctrl.signal })
    if (ctrl.signal.aborted) return null
    ctrlRef.current = null
    if (!res.ok) {
      setTask(prev => prev && { ...prev, phase: 'error', error: res.error, etaSeconds: null })
      return null
    }
    setTask(prev => prev && { ...prev, phase: 'done', progress: 1, etaSeconds: null })
    return res.data
  }, [])

  return { task, start, cancel, clear: cancel }
}

// ---- Presentation ----

function extOf(name: string): string {
  const dot = name.lastIndexOf('.')
  if (dot <= 0 || dot === name.length - 1) return ''
  return name.slice(dot + 1).slice(0, 4).toUpperCase()
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

function etaLabel(s: number): string {
  if (s < 5) return 'A few seconds left'
  if (s < 60) return `${Math.ceil(s / 5) * 5} sec left`
  const m = Math.round(s / 60)
  return m <= 1 ? '1 min left' : `${m} min left`
}

function statusLine(t: UploadTask): string {
  switch (t.phase) {
    case 'preparing': return 'Encrypting…'
    case 'uploading': return t.etaSeconds != null
      ? etaLabel(t.etaSeconds)
      : `${formatBytes(Math.round(t.size * t.progress))} of ${formatBytes(t.size)}`
    case 'done': return t.detail ?? (t.size ? formatBytes(t.size) : '')
    case 'error': return t.error ?? 'Upload failed'
  }
}

/**
 * The ring. Progress eases along the stroke; on completion the arc turns green,
 * the badge flips to a check and one sonar ping goes out from the rim.
 */
export function UploadRing({ task, size = 96 }: { task: UploadTask; size?: number }) {
  const stroke = Math.max(3, Math.round(size / 14))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const { phase } = task
  const p = phase === 'done' ? 1 : phase === 'preparing' ? 0.22 : Math.max(0.02, task.progress)
  const ext = extOf(task.name)
  const compact = size < 64
  const arcColor = phase === 'done' ? 'text-themegreen'
    : phase === 'error' ? 'text-themeredred'
    : 'text-themeblue3'

  if (task.icon && phase === 'done') {
    const Icon = task.icon
    return (
      <div className="relative shrink-0 flex items-center justify-center" style={{ width: size, height: size }}>
        <span className="animate-spring-in flex items-center justify-center rounded-full bg-themeblue3/10"
          style={{ width: size - 4, height: size - 4 }}>
          <Icon size={Math.round(size * 0.4)} className="text-themeblue2" />
        </span>
      </div>
    )
  }

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={phase === 'preparing' ? undefined : Math.round(p * 100)}
      aria-label={`Uploading ${task.name}`}
    >
      {phase === 'done' && (
        <span key="ping" className="upload-ping absolute inset-0 rounded-full border-2 border-themegreen motion-reduce:hidden" />
      )}
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className={`absolute inset-0 -rotate-90 ${phase === 'preparing' ? 'upload-sweep' : ''}`}
      >
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke}
          className="stroke-current text-primary/10" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - p)}
          className={`stroke-current ${arcColor} transition-[stroke-dashoffset,color] duration-300 ease-out motion-reduce:transition-none`}
        />
      </svg>
      {task.preview && (
        <img
          src={task.preview}
          alt=""
          className={`absolute rounded-full object-cover transition-opacity duration-300
            ${phase === 'done' ? 'opacity-100' : 'opacity-70'}`}
          style={{ inset: stroke + 2, width: size - 2 * (stroke + 2), height: size - 2 * (stroke + 2) }}
        />
      )}
      <div className="absolute inset-0 flex items-center justify-center">
        {task.preview && phase !== 'error' ? (
          // The photo is its own badge; finishing still earns the check, smaller and
          // pinned to the rim so the picture stays readable.
          phase === 'done' && (
            <span key="done" className="animate-spring-in absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full bg-themegreen text-white ring-2 ring-themewhite2"
              style={{ width: Math.max(16, size * 0.36), height: Math.max(16, size * 0.36) }}>
              <Check size={Math.max(10, Math.round(size * 0.22))} strokeWidth={3} />
            </span>
          )
        ) : phase === 'done' ? (
          <span key="done" className="animate-spring-in flex items-center justify-center rounded-full bg-themegreen text-white"
            style={{ width: size * 0.42, height: size * 0.42 }}>
            <Check size={Math.round(size * 0.24)} strokeWidth={3} />
          </span>
        ) : phase === 'error' ? (
          <AlertCircle key="err" size={Math.round(size * 0.36)} className="animate-spring-in text-themeredred" />
        ) : task.icon ? (
          <task.icon key="icon" size={Math.round(size * 0.4)} className="text-tertiary" />
        ) : (
          <span key="file" className="relative flex items-center justify-center">
            <FileIcon size={Math.round(size * (compact ? 0.42 : 0.4))} strokeWidth={1.5} className="text-tertiary" />
            {ext && !compact && (
              <span className="absolute top-[52%] -translate-y-1/2 -left-2 px-1 rounded-sm bg-themeblue3 text-white text-[7pt] font-bold leading-[1.4] tracking-wide">
                {ext}
              </span>
            )}
          </span>
        )}
      </div>
    </div>
  )
}

/** Enter/exit wrapper: height collapses with the fade so neighbours glide, not jump. */
function Presence({ show, children }: { show: boolean; children: ReactNode }) {
  const { mounted, open } = useOverlay(show)
  if (!mounted) return null
  return (
    <div className={`grid transition-[grid-template-rows,opacity,transform] duration-300 ease-out motion-reduce:transition-none
      ${open ? 'grid-rows-[1fr] opacity-100 translate-y-0' : 'grid-rows-[0fr] opacity-0 translate-y-2'}`}>
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  )
}

interface UploadViewProps {
  task: UploadTask | null
  /** Cancels while in flight; removes once done or failed. */
  onDismiss: () => void
  onRetry?: () => void
}

/** Stacked card for forms and record panes. */
export function UploadCard({ task: live, onDismiss, onRetry }: UploadViewProps) {
  const task = useHeldWhileOpen(!!live, live)
  return (
    <Presence show={!!live}>
      {task && (
        <div className="relative rounded-2xl bg-themewhite2 px-4 pt-4 pb-5 flex flex-col items-center text-center">
          <button
            onClick={onDismiss}
            aria-label={task.phase === 'uploading' || task.phase === 'preparing' ? 'Cancel upload' : 'Dismiss'}
            className="absolute top-2.5 right-2.5 p-1.5 rounded-full hover:bg-primary/5 active:scale-95 transition-all"
          >
            <X size={16} className="text-tertiary" />
          </button>
          <p className="text-[11pt] font-semibold text-primary">
            {task.phase === 'done' ? 'Upload complete' : task.phase === 'error' ? 'Upload failed' : 'Uploading 1 item'}
          </p>
          <p aria-live="polite" className={`text-[9.5pt] mt-0.5 ${task.phase === 'error' ? 'text-themeredred' : 'text-tertiary'} tabular-nums`}>
            {statusLine(task)}
          </p>
          <div className="my-4"><UploadRing task={task} size={96} /></div>
          <p className="text-[10pt] text-primary max-w-full truncate">{task.name}</p>
          {task.phase === 'error' && onRetry && (
            <button
              onClick={onRetry}
              className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-themeblue3 text-white text-[9.5pt] font-medium active:scale-95 transition-all"
            >
              <RotateCw size={13} /> Retry
            </button>
          )}
        </div>
      )}
    </Presence>
  )
}

/** One-line chip that rests above a composer (or heads an import review).
 *  `doneLabel` is the suffix once ready — default 'Ready to send'. */
export function UploadChip({ task: live, onDismiss, onRetry, doneLabel = 'Ready to send' }: UploadViewProps & { doneLabel?: string }) {
  const task = useHeldWhileOpen(!!live, live)
  return (
    <Presence show={!!live}>
      {task && (
        <div className="pb-2">
          <div className="flex items-center gap-3 rounded-2xl bg-themewhite2 border border-themeblue3/10 pl-2 pr-1.5 py-2">
            <UploadRing task={task} size={44} />
            <div className="flex-1 min-w-0">
              <p className="text-[10pt] font-medium text-primary truncate">{task.name}</p>
              <p aria-live="polite" className={`text-[9pt] truncate tabular-nums ${task.phase === 'error' ? 'text-themeredred' : 'text-tertiary'}`}>
                {task.phase === 'done' ? [statusLine(task), doneLabel].filter(Boolean).join(' · ') : statusLine(task)}
              </p>
            </div>
            {task.phase === 'error' && onRetry && (
              <button onClick={onRetry} aria-label="Retry upload"
                className="p-2 rounded-full hover:bg-primary/5 active:scale-95 transition-all shrink-0">
                <RotateCw size={15} className="text-themeblue2" />
              </button>
            )}
            <button
              onClick={onDismiss}
              aria-label={task.phase === 'uploading' || task.phase === 'preparing' ? 'Cancel upload' : 'Remove attachment'}
              className="p-2 rounded-full hover:bg-primary/5 active:scale-95 transition-all shrink-0"
            >
              <X size={15} className="text-tertiary" />
            </button>
          </div>
        </div>
      )}
    </Presence>
  )
}
