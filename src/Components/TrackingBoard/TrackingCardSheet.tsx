import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Scrim } from '@/Components/primitives/Scrim'
import { OverlayStackContext, STACK_BUMP } from '@/Components/primitives/BaseOverlay'
import { LoadingOverlay } from '@/Components/primitives/LoadingOverlay'
import { DesktopChrome } from '@/Components/primitives/HeaderPill'
import { BrnSheetHead, accentFor, brnCardFace, type TrackingEntry } from './TrackingBoardPanel'

const GUTTER = 12
const FADE_MS = 120
const OPEN_MS = 420
const CLOSE_MS = 340
const EASE_OPEN = 'cubic-bezier(.2,.9,.25,1)'
const EASE_CLOSE = 'cubic-bezier(.4,0,.2,1)'
const CARD_RADIUS = 16
const SHEET_RADIUS = 24
const GEO = ['left', 'top', 'width', 'height', 'border-radius']

interface Rect { left: number; top: number; width: number; height: number }

const place = (el: HTMLElement, r: Rect) =>
  Object.assign(el.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` })
const geo = (ms: number, ease: string) => GEO.map(p => `${p} ${ms}ms ${ease}`).join(',')
const later = (ms: number) => new Promise<void>(res => setTimeout(res, ms))

interface TrackingCardSheetProps {
  entry: TrackingEntry | null
  open: boolean
  onClose: () => void
  headRight?: ReactNode
  footer?: ReactNode
  overlays?: ReactNode
  children: ReactNode
  loading?: boolean
  zIndex?: number
}

export function TrackingCardSheet({
  entry, open, onClose, headRight, footer, overlays, children, loading = false, zIndex = 1200,
}: TrackingCardSheetProps) {
  const [mounted, setMounted] = useState(false)
  const [stage, setStage] = useState<'enter' | 'open' | 'leave'>('enter')
  const [scrimOn, setScrimOn] = useState(false)
  const [seq, setSeq] = useState(0)
  const shellRef = useRef<HTMLDivElement>(null)
  const satRef = useRef<HTMLDivElement>(null)
  const sabRef = useRef<HTMLDivElement>(null)
  const fromRef = useRef<Rect | null>(null)
  const idRef = useRef<string | null>(null)
  const tokenRef = useRef(0)

  const full = (): Rect => {
    const vv = window.visualViewport
    const vh = vv?.height ?? window.innerHeight
    const sat = satRef.current?.offsetHeight ?? 0
    const sab = window.innerHeight - vh > 80 ? 0 : sabRef.current?.offsetHeight ?? 0
    return { left: GUTTER, top: (vv?.offsetTop ?? 0) + sat + GUTTER, width: window.innerWidth - GUTTER * 2, height: vh - sat - sab - GUTTER * 2 }
  }

  useEffect(() => {
    if (!open || !entry) return
    const token = ++tokenRef.current
    idRef.current = entry.id
    const face = brnCardFace(entry.id)
    void (async () => {
      if (face && face.dataset.morph !== 'hidden') {
        face.dataset.morph = 'out'
        await later(FADE_MS)
      }
      if (token !== tokenRef.current) return
      const r = face?.getBoundingClientRect()
      fromRef.current = r ? { left: r.left, top: r.top, width: r.width, height: r.height } : null
      setStage('enter')
      setMounted(true)
      setSeq(token)
    })()
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    const el = shellRef.current
    if (!seq || !el) return
    const from = fromRef.current
    el.style.transition = 'none'
    if (from) {
      place(el, from)
      el.style.borderRadius = `${CARD_RADIUS}px`
      el.style.opacity = '1'
      el.style.transform = ''
    } else {
      place(el, full())
      el.style.borderRadius = `${SHEET_RADIUS}px`
      el.style.opacity = '0'
      el.style.transform = 'scale(.96)'
    }
    const face = idRef.current ? brnCardFace(idRef.current) : null
    if (face) face.dataset.morph = 'hidden'
    void el.offsetHeight
    el.style.transition = from
      ? geo(OPEN_MS, EASE_OPEN)
      : `opacity ${OPEN_MS}ms ${EASE_OPEN}, transform ${OPEN_MS}ms ${EASE_OPEN}`
    place(el, full())
    el.style.borderRadius = `${SHEET_RADIUS}px`
    el.style.opacity = '1'
    el.style.transform = ''
    const raf = requestAnimationFrame(() => setScrimOn(true))
    const t = setTimeout(() => { if (seq === tokenRef.current) setStage('open') }, OPEN_MS)
    return () => { cancelAnimationFrame(raf); clearTimeout(t) }
  }, [seq]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (stage !== 'open') return
    const vv = window.visualViewport
    const fit = () => {
      const el = shellRef.current
      if (!el) return
      el.style.transition = 'none'
      place(el, full())
    }
    vv?.addEventListener('resize', fit)
    vv?.addEventListener('scroll', fit)
    window.addEventListener('resize', fit)
    return () => {
      vv?.removeEventListener('resize', fit)
      vv?.removeEventListener('scroll', fit)
      window.removeEventListener('resize', fit)
    }
  }, [stage]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open) return
    if (!mounted) {
      ++tokenRef.current
      const pending = idRef.current ? brnCardFace(idRef.current) : null
      if (pending) delete pending.dataset.morph
      return
    }
    const token = ++tokenRef.current
    const id = idRef.current
    setStage('leave')
    void (async () => {
      await later(FADE_MS)
      const el = shellRef.current
      if (token !== tokenRef.current || !el) return
      setScrimOn(false)
      const face = id ? brnCardFace(id) : null
      const r = face?.getBoundingClientRect()
      const onScreen = !!r && r.bottom > 0 && r.top < window.innerHeight
      if (r && onScreen) {
        el.style.transition = geo(CLOSE_MS, EASE_CLOSE)
        place(el, r)
        el.style.borderRadius = `${CARD_RADIUS}px`
      } else {
        el.style.transition = `opacity ${CLOSE_MS}ms ease, transform ${CLOSE_MS}ms ease`
        el.style.opacity = '0'
        el.style.transform = 'scale(.96)'
      }
      await later(CLOSE_MS)
      if (token !== tokenRef.current) return
      setMounted(false)
      setSeq(0)
      if (!face) return
      if (!onScreen) { delete face.dataset.morph; return }
      face.dataset.morph = 'in'
      await later(FADE_MS * 2.5)
      if (face.dataset.morph === 'in') delete face.dataset.morph
    })()
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!mounted || !entry) return null
  const content = stage === 'open' ? 'morph-content-in' : stage === 'leave' ? 'morph-content-out' : 'opacity-0'

  return createPortal(
    <OverlayStackContext.Provider value={zIndex + STACK_BUMP}>
      <div ref={satRef} aria-hidden className="fixed top-0 left-0 w-0 pointer-events-none" style={{ height: 'var(--sat, 0px)' }} />
      <div ref={sabRef} aria-hidden className="fixed top-0 left-0 w-0 pointer-events-none" style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
      <Scrim
        progress={scrimOn ? 1 : 0}
        zIndex={zIndex}
        onClick={onClose}
        transition={`opacity ${scrimOn ? OPEN_MS : CLOSE_MS}ms ${scrimOn ? EASE_OPEN : EASE_CLOSE}`}
      />
      <div
        ref={shellRef}
        role="dialog"
        aria-label={entry.brnLabel}
        className="fixed flex flex-col bg-themewhite overflow-hidden"
        style={{ zIndex: zIndex + 15, boxShadow: '0 18px 44px rgba(0,0,0,0.28)', willChange: 'left, top, width, height' }}
      >
        <div className={`h-1 shrink-0 ${accentFor(entry).bg} ${content}`} />
        <div className={`relative shrink-0 px-4 pt-3 pb-2.5 ${content}`}>
          <BrnSheetHead entry={entry} reserveRight={!!headRight} />
          {headRight && (
            <div className="absolute top-2 right-2 z-10">
              <DesktopChrome>{headRight}</DesktopChrome>
            </div>
          )}
        </div>
        <div className={`flex-1 min-h-0 overflow-y-auto overscroll-contain ${content}`}>
          <div className="px-4 pt-1 pb-4">{children}</div>
        </div>
        {footer && <div className={`shrink-0 px-3 pt-2 pb-2.5 border-t border-primary/5 ${content}`}>{footer}</div>}
        <LoadingOverlay visible={loading} className="rounded-3xl" />
      </div>
      {overlays}
    </OverlayStackContext.Provider>,
    document.body,
  )
}
