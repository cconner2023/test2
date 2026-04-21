import { RotateCcw, Users } from 'lucide-react'
import { ActionButton } from '../ActionButton'

interface TC3CardToolbarProps {
  queueCount: number
  onOpenQueue: () => void
  onClearCard: () => void
}

/**
 * Inline pill toolbar — always visible, single tap for each action.
 * MASCAL button: fills red + shows count when queue has entries.
 * Clear button: danger ActionButton → triggers confirm overlay upstream.
 */
export function TC3CardToolbar({ queueCount, onOpenQueue, onClearCard }: TC3CardToolbarProps) {
  const isMASCAL = queueCount > 0

  return (
    <div className="flex items-center px-1.5 py-1.5 rounded-2xl bg-themewhite shadow-sm border border-tertiary/15">
      {/* MASCAL queue — shows count inside when active, Users icon when idle */}
      <button
        onClick={onOpenQueue}
        aria-label={isMASCAL ? `MASCAL Queue — ${queueCount} queued` : 'MASCAL Queue'}
        title={isMASCAL ? `${queueCount} queued` : 'MASCAL Queue'}
        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95 ${
          isMASCAL
            ? 'bg-themeredred text-white'
            : 'bg-themeblue2/8 text-primary'
        }`}
      >
        {isMASCAL ? (
          <span className="text-[9pt] font-bold leading-none">{queueCount}</span>
        ) : (
          <Users size={16} />
        )}
      </button>

      {/* Clear card — still requires confirm overlay, but no sheet to open first */}
      <ActionButton
        icon={RotateCcw}
        label="Clear card"
        onClick={onClearCard}
        variant="danger"
      />
    </div>
  )
}
