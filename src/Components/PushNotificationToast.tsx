/**
 * PushNotificationToast — iOS-style banner for foreground push notifications.
 *
 * Drops in at the top (shared surface motion). Auto-dismisses after 6s. Tap to dismiss.
 * Used for dev alerts (login, feedback, account requests) and other
 * push notifications received while the app is in the foreground.
 */

import { useRef, useEffect, useState } from 'react'
import { X, Bell } from 'lucide-react'
import type { ForegroundPush } from '../Hooks/usePushNotifications'

interface Props {
  notification: ForegroundPush | null
  onDismiss: () => void
}

export function PushNotificationToast({ notification, onDismiss }: Props) {
  const [visible, setVisible] = useState(false)
  const [current, setCurrent] = useState<ForegroundPush | null>(null)
  const touchStartY = useRef(0)
  const touchDeltaY = useRef(0)
  const bannerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (notification) {
      setCurrent(notification)
      // Drop any transform left by a swipe-dismiss of the previous banner
      if (bannerRef.current) bannerRef.current.style.transform = ''
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true))
      })
    } else {
      setVisible(false)
      const t = setTimeout(() => setCurrent(null), 350)
      return () => clearTimeout(t)
    }
  }, [notification])

  if (!current) return null

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
      // On dismiss, keep the drag offset so the banner fades out where it was let go
      if (!dismissing) bannerRef.current.style.transform = ''
    }
    if (dismissing) onDismiss()
  }

  return (
    <div className="fixed inset-x-0 top-0 z-[79] pointer-events-none" role="status" aria-live="polite" style={{ paddingTop: 'var(--sat)' }}>
      <div
        ref={bannerRef}
        onClick={() => { if (Math.abs(touchDeltaY.current) < 10) onDismiss() }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`pointer-events-auto mx-3 mt-2 rounded-2xl bg-themewhite border border-tertiary/10 shadow-2xl
          surface-motion cursor-pointer
          ${visible ? '' : 'surface-hidden-above'}`}
      >
        <div className="flex items-start gap-3 px-4 py-3">
          <div className="w-10 h-10 rounded-xl bg-themeyellow/15 flex items-center justify-center shrink-0 mt-0.5">
            <Bell size={20} className="text-themeyellow" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-primary truncate">{current.title}</p>
            <p className="text-[10pt] text-secondary truncate mt-0.5">
              {current.body.length > 80 ? current.body.slice(0, 80) + '\u2026' : current.body}
            </p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onDismiss() }}
            className="shrink-0 mt-0.5 p-1 rounded-full hover:bg-tertiary/10 transition-colors"
          >
            <X size={16} className="text-tertiary" />
          </button>
        </div>
      </div>
    </div>
  )
}
