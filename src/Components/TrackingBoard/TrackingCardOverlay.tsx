import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useSpring, animated } from '@react-spring/web'
import { Scrim } from '@/Components/primitives/Scrim'
import { OverlayStackContext, STACK_BUMP } from '@/Components/primitives/BaseOverlay'
import { LoadingOverlay } from '@/Components/primitives/LoadingOverlay'
import { DesktopChrome } from '@/Components/primitives/HeaderPill'
import { BrnCardHead, BrnStationLine, BrnCardFoot, tintFor, measureBrnCard, type CardOrigin, type TrackingEntry } from './TrackingBoardPanel'

/** Viewport gutter around the expanded card (on top of the safe areas). */
const GUTTER = 12
/** Shell padding (p-1.5) — top + bottom, for the natural-height sum. */
const SHELL_PAD = 6
const SPRING = { tension: 280, friction: 30 }
/** Desktop (centered) card — max width and top offset. */
const CENTER_MAX_W = 480
const CENTER_TOP = 64

interface TrackingCardOverlayProps {
  /** Entry to show — kept populated by the caller through the collapse. */
  entry: TrackingEntry | null
  open: boolean
  /** Captured at open; the card's rest rect is re-measured at close. */
  origin: CardOrigin | null
  onClose: () => void
  /** Collapse finished — the caller un-hides the list card. */
  onSettled: () => void
  /** Pill group that fades in at the head's top-right
   *  (right only — a left group would collide with the BRN). */
  headRight?: ReactNode
  /** Detail or edit form. Height re-springs when it changes. */
  children: ReactNode
  loading?: boolean
  zIndex?: number
  /** 'column' (mobile): stays in the card's column, top springs to the safe
   *  area. 'center' (desktop): moves to a centered fixed-width card. */
  placement?: 'column' | 'center'
  /** Rest rect for the collapse (null = gone → fade). Defaults to the list card. */
  measureRest?: (id: string) => DOMRect | null
}

/**
 * Card → lifted → overlay as one object (Tracking Board). Desktop uses
 * placement 'center': the rail card / grid row grows into a centered card.
 * Mobile (placement 'column'): The BRN card
 * container-transforms in place: same column (left/width — no reflow), the top
 * springs to the safe-area edge and the height grows to fit the detail, which
 * fades in under the card head. Opened from the long-press menu it starts at the
 * lifted clone (raised + scale 1.05, scrim already down) and settles to scale 1.
 * Close runs it back into the card's CURRENT rest rect (re-measured: moves /
 * scroll / category change); a card that's gone or off-screen fades out instead.
 * The list card is held invisible while this is mounted.
 */
export function TrackingCardOverlay({
  entry, open, origin, onClose, onSettled, headRight, children, loading = false, zIndex = 1200,
  placement = 'column', measureRest = measureBrnCard,
}: TrackingCardOverlayProps) {
  const [mounted, setMounted] = useState(false)
  const [scrimOn, setScrimOn] = useState(false)
  // Origin column — the 'column' placement keeps it for the whole open.
  const colRef = useRef({ left: 0, width: 0 })
  const openRef = useRef(open)
  openRef.current = open

  const headRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const footRef = useRef<HTMLDivElement>(null)
  const satRef = useRef<HTMLDivElement>(null)
  const sabRef = useRef<HTMLDivElement>(null)

  // Declarative: the goal lives in state and the spring follows it. `immediate`
  // snaps the seed frame (the origin) before the first animated move.
  const [goal, setGoal] = useState({ left: 0, width: 0, top: 0, height: 0, scale: 1, p: 0, o: 1, immediate: true })
  const closingRef = useRef(false)
  const finish = () => {
    if (!closingRef.current || openRef.current) return // reopened mid-collapse
    closingRef.current = false
    setMounted(false)
    onSettled()
  }
  const { immediate, ...to } = goal
  const s = useSpring({ ...to, immediate, config: SPRING, onRest: finish })

  const target = () => {
    const center = placement === 'center'
    const top = center ? CENTER_TOP : (satRef.current?.offsetHeight ?? 0) + GUTTER
    const bottom = (sabRef.current?.offsetHeight ?? 0) + GUTTER
    const natural = (headRef.current?.offsetHeight ?? 0) + (bodyRef.current?.offsetHeight ?? 0)
      + (footRef.current?.offsetHeight ?? 0) + SHELL_PAD * 2
    const width = center ? Math.min(CENTER_MAX_W, window.innerWidth - GUTTER * 2) : colRef.current.width
    const left = center ? (window.innerWidth - width) / 2 : colRef.current.left
    return { left, width, top, height: Math.min(natural, window.innerHeight - top - bottom) }
  }

  // Open: seed at the origin (rest card or lifted clone), then mount.
  useLayoutEffect(() => {
    if (!open) return
    closingRef.current = false
    // No captured origin (card not found) — rise from mid-screen instead.
    const o = origin ?? { left: GUTTER, width: window.innerWidth - GUTTER * 2, top: window.innerHeight / 2, height: 0, scale: 1 }
    colRef.current = { left: o.left, width: o.width }
    setGoal({ left: o.left, width: o.width, top: o.top, height: o.height, scale: o.scale, p: 0, o: 1, immediate: true })
    const fromLifted = o.scale > 1.001
    // Lifted menu already dimmed the screen — keep it down, no re-fade.
    setScrimOn(fromLifted)
    setMounted(true)
    if (!fromLifted) {
      const raf = requestAnimationFrame(() => setScrimOn(true))
      return () => cancelAnimationFrame(raf)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Expand once mounted (content measurable); re-spring the height whenever the
  // body resizes (detail ↔ edit form, comments added).
  useLayoutEffect(() => {
    if (!mounted || !open) return
    setGoal({ ...target(), scale: 1, p: 1, o: 1, immediate: false })
    const ro = new ResizeObserver(() => {
      if (openRef.current) setGoal(g => ({ ...g, ...target(), immediate: false }))
    })
    if (bodyRef.current) ro.observe(bodyRef.current)
    return () => ro.disconnect()
  }, [mounted, open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Close: run back into the card, or fade if it's gone / off-screen.
  useEffect(() => {
    if (open || !mounted) return
    setScrimOn(false)
    closingRef.current = true
    const rest = entry ? measureRest(entry.id) : null
    const onScreen = !!rest && rest.bottom > 0 && rest.top < window.innerHeight
    setGoal(g => onScreen
      ? { left: rest!.left, width: rest!.width, top: rest!.top, height: rest!.height, scale: 1, p: 0, o: 1, immediate: false }
      : { ...g, o: 0, scale: 0.96, p: 0, immediate: false })
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!mounted || !entry) return null
  const fadeIn = { opacity: s.p }

  return createPortal(
    <OverlayStackContext.Provider value={zIndex + STACK_BUMP}>
      {/* Safe-area probes — CSS env() isn't readable from JS directly. */}
      <div ref={satRef} aria-hidden className="fixed top-0 left-0 w-0 pointer-events-none" style={{ height: 'var(--sat, 0px)' }} />
      <div ref={sabRef} aria-hidden className="fixed top-0 left-0 w-0 pointer-events-none" style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
      <Scrim progress={scrimOn ? 1 : 0} zIndex={zIndex} onClick={onClose} transition="opacity 280ms ease-out" />
      <animated.div
        role="dialog"
        aria-label={entry.brn}
        className="fixed rounded-2xl bg-themewhite2 overflow-hidden"
        style={{
          zIndex: zIndex + 15,
          left: s.left,
          width: s.width,
          top: s.top,
          height: s.height,
          opacity: s.o,
          transform: s.scale.to(v => `scale(${v})`),
          transformOrigin: 'center top',
          boxShadow: '0 18px 44px rgba(0,0,0,0.28)',
        }}
      >
        <div className={`h-full flex flex-col p-1.5 ${tintFor(entry).shell}`}>
          <div className="relative flex-1 min-h-0 flex flex-col rounded-xl bg-themewhite shadow-sm overflow-hidden">
            <div ref={headRef} className="shrink-0 px-4 pt-3 pb-3 min-w-0">
              <BrnCardHead entry={entry} />
              <animated.div style={fadeIn}><BrnStationLine entry={entry} /></animated.div>
            </div>
            {/* Un-pilled, primitive header chrome (Sheet idiom): DesktopChrome drops the
                capsule bubble and sizes PillButtons as bare 36px icon buttons. */}
            {headRight && (
              <animated.div style={fadeIn} className="absolute top-2 right-2 z-10">
                <DesktopChrome>{headRight}</DesktopChrome>
              </animated.div>
            )}
            <animated.div style={fadeIn} className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
              <div ref={bodyRef} className="px-4 pt-1 pb-5">{children}</div>
            </animated.div>
            <LoadingOverlay visible={loading} className="rounded-xl" />
          </div>
          <div ref={footRef} className="shrink-0">
            <BrnCardFoot entry={entry} />
          </div>
        </div>
      </animated.div>
    </OverlayStackContext.Provider>,
    document.body,
  )
}
