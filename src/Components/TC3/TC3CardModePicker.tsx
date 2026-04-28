import { RotateCcw, Users } from 'lucide-react'
import { ActionButton } from '../ActionButton'
import { ActionPill } from '../ActionPill'

interface TC3CardToolbarProps {
  totalCount: number
  onOpenQueue: () => void
  onClearCard: () => void
}

/**
 * Inline pill toolbar — always visible, single tap for each action.
 * MASCAL button: fills red + shows total casualty count when > 1.
 * Clear button: danger ActionButton → triggers confirm overlay upstream.
 */
export function TC3CardToolbar({ totalCount, onOpenQueue, onClearCard }: TC3CardToolbarProps) {
  const isMASCAL = totalCount > 1

  return (
    <ActionPill shadow="sm" className="gap-0">
      {/* MASCAL queue — shows total count when active, Users icon when idle */}
      <button
        onClick={onOpenQueue}
        aria-label={isMASCAL ? `MASCAL — ${totalCount} casualties` : 'MASCAL Queue'}
        title={isMASCAL ? `${totalCount} casualties` : 'MASCAL Queue'}
        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95 ${
          isMASCAL
            ? 'bg-themeredred text-white'
            : 'bg-themeblue2/8 text-primary'
        }`}
      >
        {isMASCAL ? (
          <span className="text-[9pt] font-bold leading-none">{totalCount}</span>
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
    </ActionPill>
  )
}
