import { CheckCircle, Check, ClipboardCheck, Eye, Pencil } from 'lucide-react'
import { SwipeableCard, type SwipeAction } from '../../SwipeableCard'
import { formatMedicName, getExpirationStatus, certBadgeColors } from './supervisorHelpers'
import { UserAvatar } from '../UserAvatar'
import type { ClinicMedic } from '../../../Types/SupervisorTestTypes'
import type { Certification } from '../../../Data/User'

interface SwipeableRosterCardProps {
  soldier: ClinicMedic
  certs: Certification[]
  overdueCount: number
  isOpen: boolean
  isSelected: boolean
  multiSelectMode: boolean
  onOpen: () => void
  onClose: () => void
  onTap?: () => void
  onContextMenu?: (e: React.MouseEvent) => void
  onToggleMultiSelect?: () => void
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
  multiSelectMode,
  onOpen,
  onClose,
  onTap,
  onContextMenu,
  onToggleMultiSelect,
  onEvaluate,
  onView,
  onModify,
}: SwipeableRosterCardProps) {
  const actions: SwipeAction[] = [
    { key: 'evaluate', label: 'Evaluate', icon: ClipboardCheck, iconBg: 'bg-themeblue2/15', iconColor: 'text-themeblue2', onAction: onEvaluate },
    { key: 'view', label: 'View', icon: Eye, iconBg: 'bg-themegreen/15', iconColor: 'text-themegreen', onAction: onView },
    { key: 'modify', label: 'Modify', icon: Pencil, iconBg: 'bg-themeyellow/15', iconColor: 'text-themeyellow', onAction: onModify },
  ]

  const handleTap = () => {
    if (multiSelectMode) { onToggleMultiSelect?.(); return }
    onTap?.()
  }

  return (
    <SwipeableCard
      actions={actions}
      isOpen={isOpen}
      enabled={!multiSelectMode}
      onOpen={onOpen}
      onClose={onClose}
      onTap={handleTap}
      onContextMenu={onContextMenu}
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
          {overdueCount > 0 && (
            <span className="shrink-0 px-2 py-0.5 rounded-full text-[9pt] font-bold bg-themeredred/15 text-themeredred">
              {overdueCount} overdue
            </span>
          )}
        </div>

        {/* Cert badges (non-primary only; primary is already shown as credential) */}
        {certs.filter(c => !c.is_primary).length > 0 && (
          <div className="flex flex-wrap items-center gap-1 mt-2">
            {certs.filter(c => !c.is_primary).map((cert) => {
              const status = getExpirationStatus(cert.exp_date)
              const color = certBadgeColors[status]
              return (
                <span
                  key={cert.id}
                  className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9pt] font-medium border ${color}`}
                >
                  {cert.title}
                  {cert.verified && <CheckCircle size={8} />}
                </span>
              )
            })}
          </div>
        )}
      </div>
    </SwipeableCard>
  )
}
