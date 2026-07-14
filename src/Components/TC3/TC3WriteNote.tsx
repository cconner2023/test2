import { memo, useMemo, useState, useEffect } from 'react'
import { BaseDrawer } from '@/Components/primitives/BaseDrawer'
import { BarcodeDisplay } from '../Barcode'
import { ActionIconButton } from '../WriteNoteHelpers'
import { useTC3Store } from '../../stores/useTC3Store'
import { useAuthStore, selectIsAuthenticated } from '../../stores/useAuthStore'
import { formatTC3Note, formatMISTReport } from '../../Utilities/TC3Formatter'
import { getRegionLabel } from '../../Utilities/bodyRegionMap'
import { encodeTC3Card } from '../../Utilities/tc3Codec'
import { encryptBarcode } from '../../Utilities/barcodeCodec'
import { TC3BodyDiagramSvg } from './TC3BodyDiagramSvg'
import { TC3NineLine } from './TC3NineLine'
import { CasualtyQueue } from './CasualtyQueue'
import type { TC3Card } from '../../Types/TC3Types'
import type { UserTypes } from '../../Data/User'
import { ActionPill } from '@/Components/primitives/ActionPill'
import { Section, SectionCard } from '@/Components/primitives/Section'
import { BottomIsland, IslandButton } from '@/Components/primitives/BottomIsland'
import { ChevronDown, User, Layers } from 'lucide-react'

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
  /** True only for the live active card — renders the sticky casualty switcher. */
  activeContext?: boolean
  /** MASCAL 9-line scope, owned by the drawer's BottomIsland. Active card only. */
  scope?: 'this' | 'rollup'
}

function TC3CardSection({ card, profile, userId, isAuthenticated, label, activeContext, scope }: TC3CardSectionProps) {
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
        <Section title="Injury Diagram" className="">
          <SectionCard className="p-3">
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
          </SectionCard>
        </Section>
      )}

      {/* Note text */}
      <Section title="Note Preview" className="">
        <div className="relative">
          <SectionCard>
            <pre className="px-4 pt-3 pb-4 text-tertiary text-[9pt] whitespace-pre-wrap">
              {noteText || 'No content'}
            </pre>
          </SectionCard>
          <ActionPill shadow="sm" placement="overlay">
            <ActionIconButton onClick={handleCopyMist} status={copiedMist ? 'done' : 'idle'} variant="pdf" title="Copy MIST Handoff" />
            <ActionIconButton onClick={() => handleCopy(noteText, 'preview')} status={copiedTarget === 'preview' ? 'done' : 'idle'} variant="copy" title="Copy note text" />
          </ActionPill>
        </div>
      </Section>

      {/* Auto-derived 9-line MEDEVAC */}
      <Section title="9-Line MEDEVAC" className="">
        <TC3NineLine card={card} scope={activeContext ? scope : undefined} />
      </Section>

      {/* Encoded barcode */}
      <Section title="Encoded Note" className="">
        <div className="relative">
          <SectionCard>
            <div className="px-3 pt-3 pb-4">
              {encodedText && <BarcodeDisplay encodedText={encodedText} layout={encodedText.length > 300 ? 'col' : 'row'} />}
            </div>
          </SectionCard>
          <ActionPill shadow="sm" placement="overlay">
            <ActionIconButton onClick={() => handleCopy(encodedText, 'encoded')} status={copiedTarget === 'encoded' ? 'done' : 'idle'} variant="copy" title="Copy encoded text" />
            {typeof navigator.share === 'function' && (
              <ActionIconButton onClick={handleShare} status={shareStatus === 'shared' ? 'done' : shareStatus === 'sharing' ? 'busy' : 'idle'} variant="share" title="Share note" />
            )}
          </ActionPill>
        </div>
      </Section>
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
  const queue = useTC3Store((s) => s.casualtyQueue)
  const profile = useAuthStore((s) => s.profile)
  const userId = useAuthStore((s) => s.user?.id)
  const isAuthenticated = useAuthStore(selectIsAuthenticated)
  const [scope, setScope] = useState<'this' | 'rollup'>('rollup')
  const [queueOpen, setQueueOpen] = useState(false)

  const isBulk = cards && cards.length > 1
  const effectiveCards = isBulk ? cards : [cardProp ?? storeCard]

  // The live active card carries a casualty switcher in the drawer header itself.
  const isLiveActive = !isBulk && (cardProp ?? storeCard).id === storeCard.id

  // MASCAL scope island shows only for the live active card with a non-empty queue.
  const isMascal = !isBulk && !cardProp && queue.length > 0
  const total = queue.length + 1

  const activeNumber = useMemo(() => {
    const all = [storeCard, ...queue.map((q) => q.card)].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    return Math.max(1, all.findIndex((c) => c.id === storeCard.id) + 1)
  }, [storeCard, queue])
  const activeLabel = [storeCard.casualty.lastName, storeCard.casualty.firstName].filter(Boolean).join(', ') || 'Unknown'
  const activePriority = storeCard.evacuation.priority

  const title = isBulk
    ? `TC3 Export — ${cards.length} Casualties`
    : cardProp
    ? `TC3 — ${[cardProp.casualty.lastName, cardProp.casualty.firstName].filter(Boolean).join(', ') || 'Unknown'}`
    : 'TC3 Card — Export'

  // On the live card the header title becomes the casualty switcher (opens the
  // roster). Other cards use the plain title — no second in-body header needed.
  const titleNode = isLiveActive ? (
    <button
      type="button"
      onClick={() => setQueueOpen(true)}
      className="flex items-center gap-2 min-w-0 -ml-1 px-2 py-1 rounded-full hover:bg-themeblue2/5 active:scale-95 transition-transform"
    >
      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${activePriority ? PRIORITY_COLOR[activePriority] : 'bg-tertiary/30'}`} />
      <span className="truncate text-[13pt] md:text-[11pt] font-semibold text-primary">#{activeNumber} · {activeLabel}</span>
      <ChevronDown size={16} className="text-tertiary shrink-0" />
    </button>
  ) : undefined

  return (
    <BaseDrawer
      isVisible={isVisible}
      onClose={onClose}
      fullHeight="90dvh"
      mobileClassName="flex flex-col bg-themewhite2"
      header={{ title, titleNode }}
      scrollDisabled
    >
      {isLiveActive && <CasualtyQueue isOpen={queueOpen} onClose={() => setQueueOpen(false)} />}
      <div className="h-full relative flex flex-col">
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-4 py-3 md:p-5 pb-28">
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
                    activeContext={!isBulk && c.id === storeCard.id}
                    scope={scope}
                  />
                </div>
              )
            })}
          </div>
        </div>

        {isMascal && (
          <BottomIsland glass z="z-20" role="tablist" ariaLabel="9-line scope">
            <IslandButton role="tab" active={scope === 'this'} onClick={() => setScope('this')} label="This casualty">
              <User className="w-5 h-5" />
            </IslandButton>
            <IslandButton role="tab" active={scope === 'rollup'} onClick={() => setScope('rollup')} label={`Roll-up · ${total} casualties`}>
              <span className="relative">
                <Layers className="w-5 h-5" />
                <span className="absolute -top-1.5 -right-2 min-w-[15px] h-[15px] px-1 rounded-full bg-themeblue2 text-white text-[8pt] font-bold leading-[15px] text-center">{total}</span>
              </span>
            </IslandButton>
          </BottomIsland>
        )}
      </div>
    </BaseDrawer>
  )
})
