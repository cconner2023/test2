import { useEffect } from 'react'
import { useSpring, animated } from '@react-spring/web'
import { useDrag } from '@use-gesture/react'
import { ClipboardCheck, Eye, Pencil, Star, CheckCircle, Check } from 'lucide-react'
import { GESTURE_THRESHOLDS, SPRING_CONFIGS } from '../../../Utilities/GestureUtils'
import { formatMedicName, getExpirationStatus, certBadgeColors } from './supervisorHelpers'
import { UserAvatar } from '../UserAvatar'
import type { ClinicMedic } from '../../../Types/SupervisorTestTypes'
import type { Certification } from '../../../Data/User'

const ACTION_WIDTH = 156
const OPEN_THRESHOLD = ACTION_WIDTH * 0.4

interface SwipeableRosterCardProps {
  soldier: ClinicMedic
  certs: Certification[]
  overdueCount: number
  /** Screen-resize driven mobile flag */
  isMobile: boolean
  /** Swipe-open state */
  isOpen: boolean
  /** Selection state */
  isSelected: boolean
  onOpen: () => void
  onClose: () => void
  /** Toggle selection */
  onSelect: () => void
  onEvaluate: () => void
  onView: () => void
  onModify: () => void
}

export function SwipeableRosterCard({
  soldier,
  certs,
  overdueCount,
  isMobile,
  isOpen,
  isSelected,
  onOpen,
  onClose,
  onSelect,
  onEvaluate,
  onView,
  onModify,
}: SwipeableRosterCardProps) {
  // Spring for horizontal swipe translation
  const [style, api] = useSpring(() => ({
    x: 0,
    config: SPRING_CONFIGS.snap,
  }))

  // Sync spring with external isOpen state
  useEffect(() => {
    api.start({
      x: isOpen ? -ACTION_WIDTH : 0,
      config: SPRING_CONFIGS.snap,
    })
  }, [isOpen, api])

  // Drag gesture
  const bind = useDrag(
    ({ active, movement: [mx], velocity: [vx], direction: [dx], tap, first, xy: [startX] }) => {
      if (tap) {
        onSelect()
        if (isOpen) onClose()
        return
      }

      // Edge-swipe safety (mobile only — prevents iOS back gesture conflicts)
      if (isMobile && first && startX < GESTURE_THRESHOLDS.EDGE_ZONE) return

      if (active) {
        const baseX = isOpen ? -ACTION_WIDTH : 0
        const clampedX = Math.min(0, Math.max(-ACTION_WIDTH, baseX + mx))
        api.start({ x: clampedX, immediate: true })
      } else {
        const baseX = isOpen ? -ACTION_WIDTH : 0
        const finalX = baseX + mx
        const shouldOpen =
          Math.abs(finalX) > OPEN_THRESHOLD ||
          (vx > GESTURE_THRESHOLDS.FLING_VELOCITY && dx < 0)
        const shouldClose =
          (!shouldOpen && !isOpen) ||
          (vx > GESTURE_THRESHOLDS.FLING_VELOCITY && dx > 0)

        if (shouldOpen && !isOpen) {
          api.start({ x: -ACTION_WIDTH, config: SPRING_CONFIGS.fling })
          onOpen()
        } else if (shouldClose || !shouldOpen) {
          api.start({ x: 0, config: SPRING_CONFIGS.snap })
          if (isOpen) onClose()
        } else {
          api.start({ x: -ACTION_WIDTH, config: SPRING_CONFIGS.snap })
        }
      }
    },
    {
      axis: 'x',
      filterTaps: true,
      pointer: { touch: true },
      from: () => [isOpen ? -ACTION_WIDTH : 0, 0],
    }
  )

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

      {/* Card layer */}
      <animated.div
        {...bind()}
        style={{ x: style.x, touchAction: 'pan-y' }}
        className={`relative rounded-xl px-4 py-3 cursor-pointer select-none transition-colors bg-themewhite2
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
          {overdueCount > 0 && (
            <span className="shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold bg-themeredred/15 text-themeredred">
              {overdueCount} overdue
            </span>
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

      </animated.div>
    </div>
  )
}
