import { useState, useEffect } from 'react'

/**
 * Skeleton — the LEAF-level loading treatment, for section cards nested inside a
 * surface that already ran its own loader (panel LoadingOverlay, or the sheet /
 * popover puck-morph). NO HUD here — a second HUD washing over a small card inside
 * an already-painted surface is double-loading. Quiet placeholder rows instead.
 *
 * Doctrine: surface = HUD/puck-morph · panel = LoadingOverlay · leaf card = this.
 *
 * Show ONLY when the card is genuinely empty AND fetching (`loading && total===0`).
 * If cached rows exist (the offline-first common case) render them — no skeleton.
 */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-tertiary/10 ${className}`} />
}

/**
 * SkeletonRows — N placeholder rows mirroring the icon + two-line + meta row shape
 * shared by the timeline / history cards. Self-delays so fast/cached loads that
 * resolve within `delay` ms never flash a skeleton (renders nothing until then).
 */
export function SkeletonRows({ count = 3, delay = 140 }: { count?: number; delay?: number }) {
  const [show, setShow] = useState(delay === 0)
  useEffect(() => {
    if (delay === 0) return
    const t = setTimeout(() => setShow(true), delay)
    return () => clearTimeout(t)
  }, [delay])
  if (!show) return null

  return (
    <div className="divide-y divide-tertiary/8" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="w-7 h-7 rounded-lg shrink-0" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <Skeleton className="h-3 w-1/2 rounded-full" />
            <Skeleton className="h-2.5 w-1/3 rounded-full" />
          </div>
          <Skeleton className="h-2.5 w-10 shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  )
}
