import { memo, useState } from 'react'
import { RotateCcw, Trash2, Users } from 'lucide-react'
import { useTC3Store } from '../../stores/useTC3Store'
import { useIsMobile } from '../../Hooks/useIsMobile'
import { PreviewOverlay } from '../PreviewOverlay'
import { CasualtyQueue } from './CasualtyQueue'

/**
 * TC3 chrome injected into NavTop's right area on both mobile and desktop.
 * Mobile: rendered inside the messages/info HeaderPill (sized 43px round).
 * Desktop: rendered next to the Import button (sized 36px round).
 * Overlays portal via BaseOverlay, so NavTop's stacking context is a non-issue.
 */
export const TC3NavSlot = memo(function TC3NavSlot() {
  const isMobile = useIsMobile()
  const resetCard = useTC3Store((s) => s.resetCard)
  const casualtyQueue = useTC3Store((s) => s.casualtyQueue)
  const totalCount = casualtyQueue.length + 1
  const isMASCAL = totalCount > 1

  const [queueOpen, setQueueOpen] = useState(false)
  const [showConfirmReset, setShowConfirmReset] = useState(false)

  const sizeClass = isMobile ? 'w-[2.6875rem] h-[2.6875rem]' : 'w-9 h-9'
  const iconSize = isMobile ? 20 : 18

  const handleReset = () => {
    resetCard()
    setShowConfirmReset(false)
  }

  return (
    <>
      <button
        onClick={() => setQueueOpen(true)}
        aria-label={isMASCAL ? `MASCAL — ${totalCount} casualties` : 'MASCAL Queue'}
        title={isMASCAL ? `${totalCount} casualties` : 'MASCAL Queue'}
        className={`${sizeClass} rounded-full flex items-center justify-center transition-all active:scale-95 ${
          isMASCAL ? 'bg-themeredred text-white' : 'text-tertiary hover:text-primary'
        }`}
      >
        {isMASCAL ? (
          <span className="text-[9pt] font-bold leading-none">{totalCount}</span>
        ) : (
          <Users style={{ width: iconSize, height: iconSize }} />
        )}
      </button>

      <button
        onClick={() => setShowConfirmReset(true)}
        aria-label="Clear card"
        title="Clear card"
        className={`${sizeClass} rounded-full flex items-center justify-center transition-all active:scale-95 text-themeredred hover:text-themeredred/80`}
      >
        <RotateCcw style={{ width: iconSize, height: iconSize }} />
      </button>

      <CasualtyQueue isOpen={queueOpen} onClose={() => setQueueOpen(false)} />

      <PreviewOverlay
        isOpen={showConfirmReset}
        onClose={() => setShowConfirmReset(false)}
        anchorRect={null}
        maxWidth={280}
        title="Clear card?"
        actions={[
          { key: 'clear', label: 'Clear card', icon: Trash2, onAction: handleReset, variant: 'danger' },
        ]}
      >
        <p className="px-4 pb-4 text-[10pt] text-secondary">Current entries will be lost.</p>
      </PreviewOverlay>
    </>
  )
})
