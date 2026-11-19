import { useState, useEffect, type CSSProperties } from 'react'
import { useSpring, animated } from '@react-spring/web'

/**
 * Skeleton — the first-load treatment for any list, tree, board or canvas that is
 * genuinely empty while its data is fetched. The HUD is reserved for the surface
 * itself (boot, sheet / card puck-morph via Sheet `loading` / PaneCard `loading`)
 * and for a save or mutation in flight (LoadingOverlay). A HUD over a panel's
 * content area while its rows arrive reads as a blocking modal; a skeleton says
 * "this is the shape that is coming" and lets the surrounding chrome stay live.
 *
 * Show ONLY when the region is empty AND fetching (`loading && total === 0`). If
 * cached rows exist (the offline-first common case) render them, no skeleton.
 * Never hold a skeleton up for a minimum time (the old useMinLoadTime pattern):
 * that makes fast loads slower. Every skeleton here self-delays instead, so a
 * cached / fast load that resolves inside `delay` ms never flashes.
 */
export function Skeleton({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return <div className={`animate-pulse bg-tertiary/10 ${className}`} style={style} />
}

const DEFAULT_DELAY = 140

function useDelayedShow(delay: number): boolean {
  const [show, setShow] = useState(delay === 0)
  useEffect(() => {
    if (delay === 0) return
    const t = setTimeout(() => setShow(true), delay)
    return () => clearTimeout(t)
  }, [delay])
  return show
}

/** Row shapes. `icon` = rounded-square glyph + two lines + trailing meta (timeline,
 *  history, tree rows). `avatar` = round avatar + two lines (contacts, personnel,
 *  search results). `text` = two lines only (settings-style lists). */
export type SkeletonRowVariant = 'icon' | 'avatar' | 'text'

function SkeletonRow({ variant, index }: { variant: SkeletonRowVariant; index: number }) {
  // Vary line widths a little so a stack of rows doesn't read as a barcode.
  const primary = ['w-1/2', 'w-2/5', 'w-3/5'][index % 3]
  const secondary = ['w-1/3', 'w-1/4', 'w-2/5'][index % 3]
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {variant === 'icon' && <Skeleton className="w-7 h-7 rounded-lg shrink-0" />}
      {variant === 'avatar' && <Skeleton className="w-10 h-10 rounded-full shrink-0" />}
      <div className="flex-1 min-w-0 space-y-1.5">
        <Skeleton className={`h-3 ${primary} rounded-full`} />
        <Skeleton className={`h-2.5 ${secondary} rounded-full`} />
      </div>
      {variant === 'icon' && <Skeleton className="h-2.5 w-10 shrink-0 rounded-full" />}
    </div>
  )
}

/** N placeholder rows. Renders nothing until `delay` ms have passed. */
export function SkeletonRows({
  count = 3,
  delay = DEFAULT_DELAY,
  variant = 'icon',
  divided = true,
  className = '',
}: {
  count?: number
  delay?: number
  variant?: SkeletonRowVariant
  /** Hairline dividers between rows (card lists). Off for flat rail trees. */
  divided?: boolean
  className?: string
}) {
  const show = useDelayedShow(delay)
  if (!show) return null
  return (
    <div className={`${divided ? 'divide-y divide-tertiary/8' : ''} ${className}`} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonRow key={i} variant={variant} index={i} />
      ))}
    </div>
  )
}

/** Sectioned list placeholder: a small section-label bar above each group of rows,
 *  mirroring the grouped lists (contacts, roster, board columns). */
export function SkeletonSections({
  sections = [3, 2],
  delay = DEFAULT_DELAY,
  variant = 'icon',
  className = '',
}: {
  /** Row count per section. */
  sections?: number[]
  delay?: number
  variant?: SkeletonRowVariant
  className?: string
}) {
  const show = useDelayedShow(delay)
  if (!show) return null
  return (
    <div className={`space-y-4 ${className}`} aria-hidden="true">
      {sections.map((n, s) => (
        <div key={s}>
          <Skeleton className="h-2.5 w-20 mx-4 mb-1 rounded-full" />
          <div className="divide-y divide-tertiary/8">
            {Array.from({ length: n }).map((_, i) => (
              <SkeletonRow key={i} variant={variant} index={i + s} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// Fixed tile layout for the canvas placeholder: [col-span, row-span]. Reads as a
// floor plan of zones without pretending to be any real layout.
const CANVAS_TILES: [number, number][] = [[2, 2], [1, 1], [1, 2], [1, 1], [2, 1], [1, 1]]

/**
 * SkeletonCanvas — opaque placeholder over a spatial surface (property zone canvas,
 * board) while it has nothing to draw. Always mounted and spring-faded like
 * LoadingOverlay, so it animates out as well as in and covers the surface's own
 * empty state ("no zones yet") during the fetch instead of letting it flash. Parent
 * must be `relative`. Pointer events pass through once hidden.
 */
export function SkeletonCanvas({
  visible,
  delay = DEFAULT_DELAY,
  className = '',
}: {
  visible: boolean
  delay?: number
  /** Extra padding / radius, e.g. top padding to clear a floating header. */
  className?: string
}) {
  // Delay only the appearance; hiding is immediate so loaded content is never held back.
  const [armed, setArmed] = useState(delay === 0)
  useEffect(() => {
    if (!visible) { setArmed(delay === 0); return }
    if (delay === 0) return
    const t = setTimeout(() => setArmed(true), delay)
    return () => clearTimeout(t)
  }, [visible, delay])
  const on = visible && armed
  const spring = useSpring({ opacity: on ? 1 : 0, config: { tension: 200, friction: 22 } })
  return (
    <animated.div
      aria-hidden="true"
      className={`absolute inset-0 z-40 bg-themewhite p-4 ${className}`}
      style={{ opacity: spring.opacity, pointerEvents: visible ? 'auto' : 'none' }}
    >
      <div className="grid grid-cols-3 auto-rows-[5.5rem] gap-3 max-w-3xl mx-auto">
        {CANVAS_TILES.map(([c, r], i) => (
          <Skeleton
            key={i}
            className="rounded-2xl"
            // Inline spans: Tailwind can't see dynamically built col-span classes.
            style={{ gridColumn: `span ${c}`, gridRow: `span ${r}` }}
          />
        ))}
      </div>
    </animated.div>
  )
}
