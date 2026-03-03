import { useRef, useCallback, useEffect } from 'react'
import { ClipboardCheck, Eye, Pencil, Star, CheckCircle, Check } from 'lucide-react'
import { GESTURE_THRESHOLDS } from '../../../Utilities/GestureUtils'
import { formatMedicName, getExpirationStatus, certBadgeColors } from './supervisorHelpers'
import { UserAvatar } from '../UserAvatar'
import type { ClinicMedic } from '../../../Types/SupervisorTestTypes'
import type { Certification } from '../../../Data/User'

const ACTION_WIDTH = 156
const OPEN_THRESHOLD = ACTION_WIDTH * 0.3

interface SwipeableRosterCardProps {
  soldier: ClinicMedic
  certs: Certification[]
  overdueCount: number
  /** Swipe-open state (mobile) */
  isOpen: boolean
  /** Selection state */
  isSelected: boolean
  /** Inline menu open state (desktop tap) */
  menuOpen: boolean
  onOpen: () => void
  onClose: () => void
  /** Tap handler — toggles inline menu on desktop, same as swipe-reveal on mobile */
  onTap?: () => void
  onEvaluate: () => void
  onView: () => void
  onModify: () => void
}

export function SwipeableRosterCard({
  soldier,
  certs,
  overdueCount,
  isOpen,
  isSelected,
  menuOpen,
  onOpen,
  onClose,
  onTap,
  onEvaluate,
  onView,
  onModify,
}: SwipeableRosterCardProps) {
  const rowRef = useRef<HTMLDivElement>(null)
  const touchRef = useRef<{
    startX: number
    startY: number
    swiping: boolean
    dirDecided: boolean
  } | null>(null)

  const snapTo = useCallback((x: number) => {
    const el = rowRef.current
    if (!el) return
    el.style.transition = 'transform 200ms ease-out'
    el.style.transform = `translateX(${x}px)`
  }, [])

  // Sync with external isOpen state
  useEffect(() => {
    snapTo(isOpen ? -ACTION_WIDTH : 0)
  }, [isOpen, snapTo])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0]
    touchRef.current = { startX: t.clientX, startY: t.clientY, swiping: false, dirDecided: false }
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const state = touchRef.current
    if (!state) return
    const t = e.touches[0]
    const dx = t.clientX - state.startX
    const dy = t.clientY - state.startY

    if (!state.dirDecided) {
      if (Math.abs(dx) < GESTURE_THRESHOLDS.DIRECTION_LOCK && Math.abs(dy) < GESTURE_THRESHOLDS.DIRECTION_LOCK) return
      state.dirDecided = true
      if (Math.abs(dy) > Math.abs(dx)) { touchRef.current = null; return }
      state.swiping = true
    }
    if (!state.swiping) return

    const base = isOpen ? -ACTION_WIDTH : 0
    const offset = Math.max(-ACTION_WIDTH, Math.min(0, base + dx))
    const el = rowRef.current
    if (el) {
      el.style.transition = 'none'
      el.style.transform = `translateX(${offset}px)`
    }
  }, [isOpen])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const state = touchRef.current
    if (!state) return
    touchRef.current = null

    if (state.swiping) {
      const dx = e.changedTouches[0].clientX - state.startX
      const base = isOpen ? -ACTION_WIDTH : 0
      const shouldOpen = Math.abs(base + dx) > OPEN_THRESHOLD
      snapTo(shouldOpen ? -ACTION_WIDTH : 0)
      if (shouldOpen && !isOpen) onOpen()
      else if (!shouldOpen && isOpen) onClose()
      return
    }

    // Tap — close if swiped open, otherwise toggle action menu
    if (!state.dirDecided) {
      if (isOpen) {
        snapTo(0)
        onClose()
      } else {
        onTap?.()
      }
    }
  }, [isOpen, snapTo, onOpen, onClose, onTap])

  const handleTouchCancel = useCallback(() => {
    touchRef.current = null
    snapTo(isOpen ? -ACTION_WIDTH : 0)
  }, [isOpen, snapTo])

  // Click handler for desktop — touch devices use the touch handlers instead
  const wasTouchRef = useRef(false)

  const handleClick = useCallback(() => {
    if (wasTouchRef.current) { wasTouchRef.current = false; return }
    if (isOpen) { snapTo(0); onClose() }
    else { onTap?.() }
  }, [isOpen, snapTo, onClose, onTap])

  const handleTouchStartWrapper = useCallback((e: React.TouchEvent) => {
    wasTouchRef.current = true
    handleTouchStart(e)
  }, [handleTouchStart])

  const handleSwipeAction = (action: () => void) => {
    onClose()
    action()
  }

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Swipe action icons — revealed on drag */}
      <div className="absolute inset-y-0 right-0 flex items-center justify-evenly gap-1 px-2" style={{ width: ACTION_WIDTH }}>
        <button
          onClick={() => handleSwipeAction(onEvaluate)}
          className="flex flex-col items-center gap-1 active:scale-95 transition-transform"
        >
          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-themeblue2/15">
            <ClipboardCheck size={18} className="text-themeblue2" />
          </div>
          <span className="text-[8px] font-medium text-tertiary/60">Evaluate</span>
        </button>
        <button
          onClick={() => handleSwipeAction(onView)}
          className="flex flex-col items-center gap-1 active:scale-95 transition-transform"
        >
          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-themegreen/15">
            <Eye size={18} className="text-themegreen" />
          </div>
          <span className="text-[8px] font-medium text-tertiary/60">View</span>
        </button>
        <button
          onClick={() => handleSwipeAction(onModify)}
          className="flex flex-col items-center gap-1 active:scale-95 transition-transform"
        >
          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-themeyellow/15">
            <Pencil size={16} className="text-themeyellow" />
          </div>
          <span className="text-[8px] font-medium text-tertiary/60">Modify</span>
        </button>
      </div>

      {/* Swipeable card layer */}
      <div
        ref={rowRef}
        onClick={handleClick}
        onTouchStart={handleTouchStartWrapper}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        style={{ touchAction: 'pan-y', cursor: 'pointer' }}
      >
        <div
          className={`relative rounded-xl px-4 py-3 select-none transition-colors bg-themewhite2
            ${isSelected ? 'ring-1 ring-inset ring-themeblue2/30' : ''}`}
        >
          {/* Soldier info */}
          <div className="flex items-center gap-3">
            {isSelected ? (
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-themeblue2 shrink-0">
                <Check size={14} className="text-white" />
              </div>
            ) : (
              <UserAvatar avatarId={soldier.avatarId} firstName={soldier.firstName} lastName={soldier.lastName} className="w-8 h-8" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-primary">{formatMedicName(soldier)}</p>
              {soldier.credential && (
                <p className="text-[9pt] text-tertiary/50">{soldier.credential}</p>
              )}
            </div>
            {overdueCount > 0 && !menuOpen && (
              <span className="shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold bg-themeredred/15 text-themeredred">
                {overdueCount} overdue
              </span>
            )}

            {/* Inline actions (tap to reveal on desktop) */}
            {menuOpen && (
              <div className="flex items-center gap-2.5">
                <button
                  onClick={(e) => { e.stopPropagation(); onEvaluate() }}
                  className="flex flex-col items-center gap-0.5 active:scale-90 transition-all"
                >
                  <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-themeblue2/15">
                    <ClipboardCheck size={16} className="text-themeblue2" />
                  </div>
                  <span className="text-[8px] font-medium text-tertiary/60">Evaluate</span>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onView() }}
                  className="flex flex-col items-center gap-0.5 active:scale-90 transition-all"
                >
                  <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-themegreen/15">
                    <Eye size={16} className="text-themegreen" />
                  </div>
                  <span className="text-[8px] font-medium text-tertiary/60">View</span>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onModify() }}
                  className="flex flex-col items-center gap-0.5 active:scale-90 transition-all"
                >
                  <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-themeyellow/15">
                    <Pencil size={14} className="text-themeyellow" />
                  </div>
                  <span className="text-[8px] font-medium text-tertiary/60">Modify</span>
                </button>
              </div>
            )}
          </div>

          {/* Cert badges */}
          {certs.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 mt-2">
              {certs.map((cert) => {
                const status = getExpirationStatus(cert.exp_date)
                const color = certBadgeColors[status]
                return (
                  <span
                    key={cert.id}
                    className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium border ${color}`}
                  >
                    {cert.title}
                    {cert.is_primary && <Star size={8} className="fill-current" />}
                    {cert.verified && <CheckCircle size={8} />}
                  </span>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
