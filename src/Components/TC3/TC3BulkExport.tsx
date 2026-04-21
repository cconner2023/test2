import { memo, useState, useEffect, useMemo } from 'react'
import { BaseDrawer } from '../BaseDrawer'
import { BarcodeDisplay } from '../Barcode'
import { useAuthStore, selectIsAuthenticated } from '../../stores/useAuthStore'
import { encodeTC3Card } from '../../Utilities/tc3Codec'
import { encryptBarcode } from '../../Utilities/barcodeCodec'
import type { TC3Card } from '../../Types/TC3Types'

const PRIORITY_COLOR: Record<string, string> = {
  Urgent: 'bg-themeredred',
  Priority: 'bg-amber-500',
  Routine: 'bg-themegreen',
}

function casualtyLabel(card: TC3Card, index: number): string {
  const name = [card.casualty.lastName, card.casualty.firstName].filter(Boolean).join(', ')
  return name || `Casualty #${index + 1}`
}

// ── Per-casualty item that manages its own async encoding ─────────────────

interface CasualtyExportItemProps {
  card: TC3Card
  index: number
  userId: string | undefined
  isAuthenticated: boolean
}

const CasualtyExportItem = memo(function CasualtyExportItem({
  card,
  index,
  userId,
  isAuthenticated,
}: CasualtyExportItemProps) {
  const [encodedText, setEncodedText] = useState('')

  const compactString = useMemo(() => encodeTC3Card(card, userId), [card, userId])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const encrypted = isAuthenticated ? await encryptBarcode(compactString) : null
      if (cancelled) return
      setEncodedText(encrypted ?? compactString)
    })()
    return () => { cancelled = true }
  }, [compactString, isAuthenticated])

  const priority = card.evacuation.priority
  const dotColor = priority ? PRIORITY_COLOR[priority] : 'bg-tertiary/30'

  return (
    <div className="border-b border-tertiary/10 last:border-0">
      {/* Casualty header */}
      <div className="flex items-center gap-2.5 px-4 pt-4 pb-2">
        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotColor}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-primary truncate">{casualtyLabel(card, index)}</p>
          {priority && (
            <p className="text-[9pt] text-secondary mt-0.5">{priority}</p>
          )}
        </div>
        <span className="text-[9pt] text-tertiary shrink-0">#{index + 1}</span>
      </div>

      {/* Barcode */}
      <div className="px-3 pb-4">
        {encodedText
          ? <BarcodeDisplay encodedText={encodedText} layout={encodedText.length > 300 ? 'col' : 'row'} />
          : <div className="h-16 flex items-center justify-center text-[9pt] text-tertiary">Encoding…</div>
        }
      </div>
    </div>
  )
})

// ── Bulk export drawer ────────────────────────────────────────────────────

interface TC3BulkExportProps {
  isVisible: boolean
  onClose: () => void
  cards: TC3Card[]
}

export const TC3BulkExport = memo(function TC3BulkExport({ isVisible, onClose, cards }: TC3BulkExportProps) {
  const userId = useAuthStore((s) => s.user?.id)
  const isAuthenticated = useAuthStore(selectIsAuthenticated)

  return (
    <BaseDrawer
      isVisible={isVisible}
      onClose={onClose}
      fullHeight="90dvh"
      mobileClassName="flex flex-col bg-themewhite2"
      header={{ title: `Export All — ${cards.length} Casualties` }}
    >
      <div className="rounded-xl bg-themewhite overflow-hidden mx-4 my-4">
        {cards.map((card, i) => (
          <CasualtyExportItem
            key={card.id}
            card={card}
            index={i}
            userId={userId}
            isAuthenticated={isAuthenticated}
          />
        ))}
      </div>
    </BaseDrawer>
  )
})
