import { AlertTriangle, PackageCheck, Truck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '../../Hooks/useAuth'
import { useNavigationStore } from '../../stores/useNavigationStore'
import { usePropertyReadiness } from '../../Hooks/usePropertyReadiness'
import { ActionButton } from '@/Components/primitives/ActionButton'
import { ActionPill } from '@/Components/primitives/ActionPill'

type WidgetActionDescriptor = { icon: LucideIcon; label: string; onClick: () => void }

/** A single readiness row — icon chip + label + optional urgent count. */
function ReadinessRow({ icon: Icon, label, count, urgent, onClick }: {
  icon: LucideIcon
  label: string
  count?: number
  urgent?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 w-full text-left rounded-lg px-1.5 py-1.5 active:bg-themeblue2/10 transition-colors"
    >
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${urgent ? 'bg-themered/15' : 'bg-themeblue2/15'}`}>
        <Icon size={16} className={urgent ? 'text-themered' : 'text-themeblue2'} />
      </div>
      <span className="flex-1 min-w-0 text-[10pt] text-primary truncate">{label}</span>
      {count != null && count > 0 && (
        <span className={`min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center shrink-0 ${urgent ? 'bg-themered' : 'bg-themeblue2'}`}>
          <span className="text-[9pt] font-semibold text-white leading-none tabular-nums">{count > 9 ? '9+' : count}</span>
        </span>
      )}
    </button>
  )
}

/**
 * Mission-overview property readiness — two glanceable rows (shortages + expiring
 * dispatches) over the already-warm local projection (usePropertyReadiness). Each
 * row deep-links into the relevant property flow. Gated upstream by the mission
 * board on `propertyAccountability`; assumes the gate is on when mounted.
 */
export function PropertyWidget({ action }: { action: WidgetActionDescriptor | null }) {
  const { clinicId } = useAuth()
  const { shortLines, expiringVehicleIds } = usePropertyReadiness(clinicId)
  const openPropertyShortages = useNavigationStore(s => s.openPropertyShortages)
  const openPropertyZone = useNavigationStore(s => s.openPropertyZone)
  const setShowPropertyDrawer = useNavigationStore(s => s.setShowPropertyDrawer)

  const expiring = expiringVehicleIds.length
  const allClear = shortLines === 0 && expiring === 0

  const openDispatches = () => {
    // One expiring vehicle → pan straight to it; several → open the book.
    if (expiringVehicleIds.length === 1) openPropertyZone(expiringVehicleIds[0])
    else setShowPropertyDrawer(true)
  }

  return (
    <div className="relative px-2.5 py-2 flex flex-col gap-1">
      {action && (
        <ActionPill shadow="sm" placement="overlay">
          <ActionButton icon={action.icon} label={action.label} onClick={action.onClick} />
        </ActionPill>
      )}
      {allClear ? (
        <ReadinessRow
          icon={PackageCheck}
          label="All accounted for"
          onClick={() => openPropertyShortages()}
        />
      ) : (
        <>
          {shortLines > 0 && (
            <ReadinessRow
              icon={AlertTriangle}
              label={`${shortLines} line${shortLines === 1 ? '' : 's'} short`}
              count={shortLines}
              urgent
              onClick={() => openPropertyShortages()}
            />
          )}
          {expiring > 0 && (
            <ReadinessRow
              icon={Truck}
              label={`${expiring} dispatch${expiring === 1 ? '' : 'es'} expiring`}
              count={expiring}
              urgent
              onClick={openDispatches}
            />
          )}
        </>
      )}
    </div>
  )
}
