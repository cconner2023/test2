import { ClipboardCheck, Eye, Pencil } from 'lucide-react'
import { SwipeableCard, type SwipeAction } from '../../SwipeableCard'
import { formatMedicName } from './supervisorHelpers'
import { UserAvatar } from '../UserAvatar'
import type { ClinicMedic } from '../../../Types/SupervisorTestTypes'
import type { Certification } from '../../../Data/User'

interface SwipeableRosterCardProps {
  soldier: ClinicMedic
  certs: Certification[]
  overdueCount: number
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
  onTap?: () => void
  onContextMenu?: (e: React.MouseEvent) => void
  onLongPress?: (x: number, y: number) => void
  onEvaluate: () => void
  onView: () => void
  onModify: () => void
}

export function SwipeableRosterCard({
  soldier,
  certs,
  overdueCount,
  isOpen,
  onOpen,
  onClose,
  onTap,
  onContextMenu,
  onLongPress,
  onEvaluate,
  onView,
  onModify,
}: SwipeableRosterCardProps) {
  const actions: SwipeAction[] = [
    { key: 'evaluate', label: 'Evaluate', icon: ClipboardCheck, iconBg: 'bg-themeblue2/15', iconColor: 'text-themeblue2', onAction: onEvaluate },
    { key: 'view', label: 'View', icon: Eye, iconBg: 'bg-themegreen/15', iconColor: 'text-themegreen', onAction: onView },
    { key: 'modify', label: 'Modify', icon: Pencil, iconBg: 'bg-themeyellow/15', iconColor: 'text-themeyellow', onAction: onModify },
  ]

  return (
    <SwipeableCard
      actions={actions}
      isOpen={isOpen}
      enabled
      onOpen={onOpen}
      onClose={onClose}
      onTap={onTap}
      onContextMenu={onContextMenu}
      onLongPress={onLongPress}
    >
      <div className="relative rounded-xl px-4 py-3 select-none bg-themewhite2">
        {/* Soldier info */}
        <div className="flex items-center gap-3">
          <UserAvatar avatarId={soldier.avatarId} firstName={soldier.firstName} lastName={soldier.lastName} className="w-8 h-8" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-primary">{formatMedicName(soldier)}</p>
            {(() => {
              const allCreds = [soldier.credential, ...certs.map(c => c.title)].filter(Boolean)
              return allCreds.length > 0 && (
                <p className="text-[9pt] text-tertiary/50 truncate">{allCreds.join(', ')}</p>
              )
            })()}
          </div>
          {overdueCount > 0 && (
            <span className="shrink-0 px-2 py-0.5 rounded-full text-[9pt] font-bold bg-themeredred/15 text-themeredred">
              {overdueCount} overdue
            </span>
          )}
        </div>
      </div>
    </SwipeableCard>
  )
}
