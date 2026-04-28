import { memo, useMemo, useState, useEffect } from 'react'
import { BaseDrawer } from '../BaseDrawer'
import { BarcodeDisplay } from '../Barcode'
import { ActionIconButton } from '../WriteNoteHelpers'
import { useTC3Store } from '../../stores/useTC3Store'
import { useAuthStore, selectIsAuthenticated } from '../../stores/useAuthStore'
import { formatTC3Note, formatMISTReport } from '../../Utilities/TC3Formatter'
import { getRegionLabel } from '../../Utilities/bodyRegionMap'
import { encodeTC3Card } from '../../Utilities/tc3Codec'
import { encryptBarcode } from '../../Utilities/barcodeCodec'
import { TC3BodyDiagramSvg } from './TC3BodyDiagramSvg'
import type { TC3Card } from '../../Types/TC3Types'
import type { UserTypes } from '../../Data/User'
import { ActionPill } from '../ActionPill'

const INJURY_COLORS: Record<string, string> = {
  GSW: '#ef4444',
  blast: '#f97316',
  burn: '#eab308',
  laceration: '#3b82f6',
  fracture: '#8b5cf6',
  amputation: '#dc2626',
  other: '#6b7280',
}

const PRIORITY_COLOR: Record<string, string> = {
  Urgent: 'bg-themeredred',
  Priority: 'bg-amber-500',
  Routine: 'bg-themegreen',
}

// ── Single-card section — owns its own encode/copy/share state ────────────

interface TC3CardSectionProps {
  card: TC3Card
  profile: UserTypes
  userId: string | undefined
  isAuthenticated: boolean
  /** When set, renders a labeled header above the content (bulk mode) */
  label?: string
}

function TC3CardSection({ card, profile, userId, isAuthenticated, label }: TC3CardSectionProps) {
  const [copiedTarget, setCopiedTarget] = useState<'preview' | 'encoded' | null>(null)
  const [copiedMist, setCopiedMist] = useState(false)
  const [shareStatus, setShareStatus] = useState<'idle' | 'sharing' | 'shared'>('idle')
  const [encodedText, setEncodedText] = useState('')

  const noteText = useMemo(() => formatTC3Note(card, profile), [card, profile])
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

  const handleCopy = async (text: string, target: 'preview' | 'encoded') => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    setCopiedTarget(target)
    setTimeout(() => setCopiedTarget(null), 2000)
  }

  const handleCopyMist = async () => {
    const mistText = formatMISTReport(card)
    try {
      await navigator.clipboard.writeText(mistText)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = mistText
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopiedMist(true)
    setTimeout(() => setCopiedMist(false), 2000)
  }

  const handleShare = async () => {
    if (!navigator.share) return
    setShareStatus('sharing')
    try {
      await navigator.share({ title: 'TC3 Casualty Card', text: noteText })
      setShareStatus('shared')
    } catch {
      setShareStatus('idle')
      return
    }
    setTimeout(() => setShareStatus('idle'), 2000)
  }

  const hasMarkers = card.markers.length > 0
  const priority = card.evacuation.priority

  return (
    <div className="space-y-4">
      {/* Bulk mode label */}
      {label && (
        <div className="flex items-center gap-2 px-1">
          <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${priority ? PRIORITY_COLOR[priority] : 'bg-tertiary/30'}`} />
          <p className="text-sm font-semibold text-primary">{label}</p>
          {priority && <span className="text-[9pt] text-secondary">— {priority}</span>}
        </div>
      )}

      {/* Body diagram with markers */}
      {hasMarkers && (
        <div className="rounded-xl border border-tertiary/15 bg-themewhite p-3">
          <p className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase mb-2">Injury Diagram</p>
          <TC3BodyDiagramSvg markers={card.markers} readOnly compact />
          <div className="mt-2 pt-2 border-t border-tertiary/10 flex flex-wrap gap-x-3 gap-y-1">
            {card.markers.map((m, i) => {
              const region = m.bodyRegion ? getRegionLabel(m.bodyRegion) : `(${Math.round(m.x)}%, ${Math.round(m.y)}%)`
              const markerLabel = [...m.injuries, ...m.procedures].join(', ') || 'Marker'
              const color = m.injuries.length > 0
                ? (INJURY_COLORS[m.injuries[0]] ?? '#6b7280')
                : m.procedures.length > 0 ? '#22c55e' : '#f59e0b'
              return (
                <div key={m.id} className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-[9pt] md:text-[9pt] text-tertiary">{i + 1}. {markerLabel} ({region})</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Note text */}
      <div className="relative rounded-xl bg-themewhite2 overflow-hidden">
        <pre className="px-4 pt-14 pb-4 text-tertiary text-[9pt] whitespace-pre-wrap">
          {noteText || 'No content'}
        </pre>
        <ActionPill shadow="sm" className="absolute top-2 right-2">
          <ActionIconButton onClick={handleCopyMist} status={copiedMist ? 'done' : 'idle'} variant="pdf" title="Copy MIST Handoff" />
          <ActionIconButton onClick={() => handleCopy(noteText, 'preview')} status={copiedTarget === 'preview' ? 'done' : 'idle'} variant="copy" title="Copy note text" />
        </ActionPill>
      </div>

      {/* Encoded barcode */}
      <div className="relative rounded-xl bg-themewhite2 overflow-hidden">
        <div className="px-3 pt-14 pb-4">
          {encodedText && <BarcodeDisplay encodedText={encodedText} layout={encodedText.length > 300 ? 'col' : 'row'} />}
        </div>
        <ActionPill shadow="sm" className="absolute top-2 right-2">
          <ActionIconButton onClick={() => handleCopy(encodedText, 'encoded')} status={copiedTarget === 'encoded' ? 'done' : 'idle'} variant="copy" title="Copy encoded text" />
          {typeof navigator.share === 'function' && (
            <ActionIconButton onClick={handleShare} status={shareStatus === 'shared' ? 'done' : shareStatus === 'sharing' ? 'busy' : 'idle'} variant="share" title="Share note" />
          )}
        </ActionPill>
      </div>
    </div>
  )
}

// ── Drawer shell ──────────────────────────────────────────────────────────

interface TC3WriteNoteProps {
  isVisible: boolean
  onClose: () => void
  /** Preview a specific card (single, from queue) */
  card?: TC3Card
  /** Preview multiple cards (bulk export) */
  cards?: TC3Card[]
}

export const TC3WriteNote = memo(function TC3WriteNote({ isVisible, onClose, card: cardProp, cards }: TC3WriteNoteProps) {
  const storeCard = useTC3Store((s) => s.card)
  const profile = useAuthStore((s) => s.profile)
  const userId = useAuthStore((s) => s.user?.id)
  const isAuthenticated = useAuthStore(selectIsAuthenticated)

  const isBulk = cards && cards.length > 1
  const effectiveCards = isBulk ? cards : [cardProp ?? storeCard]

  const title = isBulk
    ? `TC3 Export — ${cards.length} Casualties`
    : cardProp
    ? `TC3 — ${[cardProp.casualty.lastName, cardProp.casualty.firstName].filter(Boolean).join(', ') || 'Unknown'}`
    : 'TC3 Card — Export'

  return (
    <BaseDrawer
      isVisible={isVisible}
      onClose={onClose}
      fullHeight="90dvh"
      mobileClassName="flex flex-col bg-themewhite2"
      header={{ title }}
      contentPadding="standard"
    >
      <div className="space-y-8">
        {effectiveCards.map((c, i) => {
          const name = [c.casualty.lastName, c.casualty.firstName].filter(Boolean).join(', ') || `Casualty #${i + 1}`
          return (
            <div key={c.id}>
              {isBulk && i > 0 && <div className="border-t border-tertiary/10 -mt-4 mb-8" />}
              <TC3CardSection
                card={c}
                profile={profile}
                userId={userId}
                isAuthenticated={isAuthenticated}
                label={isBulk ? name : undefined}
              />
            </div>
          )
        })}
      </div>
    </BaseDrawer>
  )
})
