/**
 * MessageNotificationToast — iOS-style notification banner.
 *
 * Slides down from the top of the screen. Auto-dismisses after 4s.
 * Tap to navigate to conversation. Swipe up to dismiss.
 */

import { useRef, useEffect, useState } from 'react'
import { X, MessageSquare } from 'lucide-react'
import type { MessageNotification } from '../Hooks/useMessageNotifications'

interface Props {
  notification: MessageNotification | null
  onDismiss: () => void
  onTap: (notification: MessageNotification) => void
}

export function MessageNotificationToast({ notification, onDismiss, onTap }: Props) {
  const [visible, setVisible] = useState(false)
  const [current, setCurrent] = useState<MessageNotification | null>(null)
  const touchStartY = useRef(0)
  const touchDeltaY = useRef(0)
  const bannerRef = useRef<HTMLDivElement>(null)

  // Animate in/out
  useEffect(() => {
    if (notification) {
      setCurrent(notification)
      // Force a frame so the initial -translate-y-full renders before we animate in
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true))
      })
    } else {
      setVisible(false)
      // Keep current for exit animation, clear after transition
      const t = setTimeout(() => setCurrent(null), 350)
      return () => clearTimeout(t)
    }
  }, [notification])

  if (!current) return null

  const title = current.isGroup && current.groupName
    ? `${current.groupName}`
    : current.senderName

  const subtitle = current.isGroup
    ? `${current.senderName}: ${current.preview}`
    : current.preview

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
    touchDeltaY.current = 0
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    touchDeltaY.current = e.touches[0].clientY - touchStartY.current
    // Apply live drag (only upward)
    if (bannerRef.current && touchDeltaY.current < 0) {
      bannerRef.current.style.transform = `translateY(${touchDeltaY.current}px)`
      bannerRef.current.style.transition = 'none'
    }
  }

  const handleTouchEnd = () => {
    if (bannerRef.current) {
      bannerRef.current.style.transition = ''
      bannerRef.current.style.transform = ''
    }
    // Swipe up threshold: -30px
    if (touchDeltaY.current < -30) {
      onDismiss()
    }
  }

  const handleClick = () => {
    // Only fire tap if not swiping
    if (Math.abs(touchDeltaY.current) < 10) {
      onTap(current)
    }
  }

  return (
    <div className="fixed inset-x-0 top-0 z-[80] pointer-events-none" role="status" aria-live="polite" style={{ paddingTop: 'var(--sat)' }}>
      <div
        ref={bannerRef}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`pointer-events-auto mx-3 mt-2 rounded-2xl bg-themewhite border border-tertiary/10 shadow-2xl
          transition-transform duration-300 ease-out cursor-pointer
          ${visible ? 'translate-y-0' : '-translate-y-[calc(100%+var(--sat,0px)+1rem)]'}`}
      >
        <div className="flex items-start gap-3 px-4 py-3">
          {/* Icon */}
          <div className="w-10 h-10 rounded-xl bg-themeblue/15 flex items-center justify-center shrink-0 mt-0.5">
            <MessageSquare size={20} className="text-themeblue" />
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-primary truncate">{title}</p>
            <p className="text-xs text-secondary truncate mt-0.5">
              {subtitle.length > 60 ? subtitle.slice(0, 60) + '\u2026' : subtitle}
            </p>
          </div>

          {/* Close button */}
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
