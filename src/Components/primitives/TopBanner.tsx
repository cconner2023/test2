import { useEffect, useRef, type ReactNode } from 'react'
import { X, MessageSquare, Bell, AlertTriangle, Info, type LucideIcon } from 'lucide-react'
import { useOverlay } from '../../Hooks/useOverlay'
import { useHeldWhileOpen } from '../../Hooks/useHeldWhileOpen'

export type TopBannerTone = 'message' | 'push' | 'error' | 'info'

const TONE: Record<TopBannerTone, { icon: LucideIcon; tile: string; fg: string; border: string }> = {
  message: { icon: MessageSquare, tile: 'bg-themeblue/15', fg: 'text-themeblue', border: 'border-tertiary/10' },
  push:    { icon: Bell, tile: 'bg-themeyellow/15', fg: 'text-themeyellow', border: 'border-tertiary/10' },
  error:   { icon: AlertTriangle, tile: 'bg-themeredred/15', fg: 'text-themeredred', border: 'border-themeredred/20' },
  info:    { icon: Info, tile: 'bg-themeblue2/15', fg: 'text-themeblue2', border: 'border-tertiary/10' },
}

interface TopBannerProps<T> {
  item: T | null
  tone: TopBannerTone
  title: (item: T) => ReactNode
  body: (item: T) => ReactNode
  onDismiss: () => void
  onTap?: (item: T) => void
  icon?: LucideIcon
  actions?: (item: T) => ReactNode
  autoDismissMs?: number
  zIndex?: number
}

export function TopBanner<T>({ item, tone, title, body, onDismiss, onTap, icon, actions, autoDismissMs, zIndex = 80 }: TopBannerProps<T>) {
  const { mounted, open } = useOverlay(!!item)
  const current = useHeldWhileOpen(!!item, item)
  const touchStartY = useRef(0)
  const touchDeltaY = useRef(0)
  const bannerRef = useRef<HTMLDivElement>(null)
  const dismissRef = useRef(onDismiss)
  dismissRef.current = onDismiss

  useEffect(() => {
    if (!item) return
    if (bannerRef.current) bannerRef.current.style.transform = ''
    if (!autoDismissMs) return
    const t = setTimeout(() => dismissRef.current(), autoDismissMs)
    return () => clearTimeout(t)
  }, [item, autoDismissMs])

  if (!mounted || !current) return null

  const { icon: toneIcon, tile, fg, border } = TONE[tone]
  const Icon = icon ?? toneIcon
  const isError = tone === 'error'
  const wraps = isError || tone === 'info' || !!actions

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
    touchDeltaY.current = 0
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    touchDeltaY.current = e.touches[0].clientY - touchStartY.current
    if (bannerRef.current && touchDeltaY.current < 0) {
      bannerRef.current.style.transform = `translateY(${touchDeltaY.current}px)`
      bannerRef.current.style.transition = 'none'
    }
  }

  const handleTouchEnd = () => {
    const dismissing = touchDeltaY.current < -30
    if (bannerRef.current) {
      bannerRef.current.style.transition = ''
      if (!dismissing) bannerRef.current.style.transform = ''
    }
    if (dismissing) onDismiss()
  }

  const handleClick = () => {
    if (Math.abs(touchDeltaY.current) >= 10) return
    if (onTap) onTap(current)
    else if (!actions) onDismiss()
  }

  return (
    <div
      className="fixed inset-x-0 top-0 pointer-events-none"
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      style={{ paddingTop: 'var(--sat)', zIndex }}
    >
      <div
        ref={bannerRef}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`pointer-events-auto mx-3 mt-2 rounded-2xl bg-themewhite border ${border} shadow-2xl
          surface-motion ${actions && !onTap ? '' : 'cursor-pointer'}
          ${open ? '' : 'surface-hidden-above'}`}
      >
        <div className="flex items-start gap-3 px-4 py-3">
          <div className={`w-10 h-10 rounded-xl ${tile} flex items-center justify-center shrink-0 mt-0.5`}>
            <Icon size={20} className={fg} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-primary truncate">{title(current)}</p>
            <p className={`text-[10pt] text-secondary mt-0.5 ${wraps ? 'line-clamp-3' : 'truncate'}`}>{body(current)}</p>
            {actions && <div className="flex items-center gap-2 mt-3" onClick={(e) => e.stopPropagation()}>{actions(current)}</div>}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onDismiss() }}
            aria-label="Dismiss"
            className="shrink-0 mt-0.5 p-1 rounded-full hover:bg-tertiary/10 transition-colors"
          >
            <X size={16} className="text-tertiary" />
          </button>
        </div>
      </div>
    </div>
  )
}
