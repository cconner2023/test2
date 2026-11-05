import { memo, useMemo, useState } from 'react'
import { FileText, RotateCcw, Trash2 } from 'lucide-react'
import { useTC3Store } from '../../stores/useTC3Store'
import { SearchInput } from '@/Components/primitives/SearchInput'
import { RailSearchRow } from '@/Components/primitives/RailSearchRow'
import { LiftedRowMenu } from '@/Components/primitives/LiftedRowMenu'
import { type ContextMenuItem } from '@/Components/primitives/ContextMenu'
import { SwipeActionRow } from '@/Components/primitives/SwipeActionRow'
import { TintedCard } from '@/Components/primitives/TintedCard'
import { formatDtg } from '../../Utilities/propertyDates'
import type { TC3Card } from '../../Types/TC3Types'
import { orderByPriority, buildCasualtyStops, bandOf, BAND_META } from './casualtyOrder'

function casualtyName(card: TC3Card): string {
  return [card.casualty.lastName, card.casualty.firstName].filter(Boolean).join(', ')
}

/** Military date-time — 31OCT26 1423. */
function fmtDtgTime(iso: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return ''
  const t = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }).replace(':', '')
  return `${formatDtg(iso)} ${t}`
}

/** Roster card — the Tracking Board's TintedCard, tinted by triage band:
 *  triage code + BRN, name · mechanism, band · injury (or opened) time. */
function CasualtyCard({ card, code, compact, selected }: { card: TC3Card; code: string; compact: boolean; selected: boolean }) {
  const meta = BAND_META[bandOf(card)] ?? BAND_META['']
  const mech = card.mechanism.types
    .map((t) => (t === 'Other' && card.mechanism.otherDescription ? card.mechanism.otherDescription : t))
    .join(', ')
  const note = [casualtyName(card) || 'Unknown', mech].filter(Boolean).join(' · ')
  const inj = card.casualty.dateTimeOfInjury
  return (
    <TintedCard
      compact={compact}
      selected={selected}
      tint={meta.tint}
      title={code}
      subtitle={card.casualty.battleRosterNo || undefined}
      note={note}
      footLeft={meta.label}
      footRight={inj ? `Inj ${fmtDtgTime(inj)}` : `Since ${fmtDtgTime(card.createdAt)}`}
    />
  )
}

interface CasualtyListProps {
  /** Fired after a card is made active (mobile closes the sheet; desktop no-op). */
  onAfterSelect?: () => void
  /** 'pane' = desktop rail (compact cards, fills height, own scroll); 'sheet' =
   *  mobile bottom sheet (full cards, the Sheet scrolls). Default 'pane'. */
  variant?: 'pane' | 'sheet'
}

/**
 * Casualty roster — the desktop LEFT rail (compact cards) and the mobile roster
 * Sheet (full cards). Same card as the Tracking Board (TintedCard, shell tinted
 * by triage band) with its gesture set: tap makes the casualty active (the main
 * pane / wizard follows), long-press / right-click lifts the card into the
 * LiftedRowMenu (View note / Reset / Discard). Active card carries a check badge, top right.
 */
export const CasualtyList = memo(function CasualtyList({ onAfterSelect, variant = 'pane' }: CasualtyListProps) {
  const card = useTC3Store((s) => s.card)
  const casualtyQueue = useTC3Store((s) => s.casualtyQueue)
  const restoreFromQueue = useTC3Store((s) => s.restoreFromQueue)
  const discardFromQueue = useTC3Store((s) => s.discardFromQueue)
  const discardActive = useTC3Store((s) => s.discardActive)
  const resetCard = useTC3Store((s) => s.resetCard)
  const openExportForCard = useTC3Store((s) => s.openExportForCard)

  const [query, setQuery] = useState('')
  const [menu, setMenu] = useState<{ cardId: string; rect: DOMRect } | null>(null)

  // Triage order: sort by evac-priority band, then creation time within a band.
  const all = useMemo(
    () =>
      orderByPriority([
        { card, isActive: true },
        ...casualtyQueue.map((e) => ({ card: e.card, isActive: false })),
      ]),
    [card, casualtyQueue],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return all
    return all.filter(({ card: c }) =>
      `${casualtyName(c) || 'unknown'} ${c.casualty.battleRosterNo}`.toLowerCase().includes(q))
  }, [all, query])

  // Evac-priority label (U1, P1, R2, …) per casualty — same convention as the slider.
  const labelById = useMemo(
    () => new Map(buildCasualtyStops(all.map(({ card: c }) => c)).map((s) => [s.id, s.label])),
    [all],
  )

  const handleSelect = (cardId: string, isActive: boolean) => {
    if (!isActive) restoreFromQueue(cardId)
    onAfterSelect?.()
  }

  const menuCard = menu ? all.find((a) => a.card.id === menu.cardId) : null
  const menuItems: ContextMenuItem[] = menuCard
    ? [
        { key: 'view', label: 'View note', icon: FileText, onAction: () => openExportForCard(menuCard.card) },
        {
          key: 'reset',
          label: 'Reset card',
          icon: RotateCcw,
          onAction: () => {
            if (!menuCard.isActive) restoreFromQueue(menuCard.card.id)
            resetCard()
          },
        },
        {
          key: 'discard',
          label: 'Discard',
          icon: Trash2,
          destructive: true,
          onAction: () => {
            if (menuCard.isActive) {
              discardActive()
              onAfterSelect?.()
            } else {
              discardFromQueue(menuCard.card.id)
            }
          },
        },
      ]
    : []

  const compact = variant === 'pane'
  // Reveal surface under the swipe content — match the host so the tint reads the same.
  const surface = variant === 'sheet' ? 'bg-themewhite3' : 'bg-themewhite'

  // In a sheet the Sheet's own fit-body is the scroll region (it has the iOS
  // scroll-region fix) — nesting a second capped scroller here fights it: the
  // sheet's overflow-hidden card clips the inner region before its cap is hit,
  // so rows past what fits are unreachable. Let the rows flow and the Sheet
  // scroll them; the search pins via sticky. The pane keeps its own flex scroll.
  const bodyClass = variant === 'sheet' ? '' : 'flex-1 min-h-0 overflow-y-auto'

  return (
    <div className={`flex flex-col min-h-0${variant === 'pane' ? ' h-full' : ''}`}>
      {variant === 'pane' ? (
        <RailSearchRow value={query} onChange={setQuery} placeholder="Search casualties…" />
      ) : (
        <div className="shrink-0 px-3 pt-3 pb-2 sticky top-0 z-10 bg-themewhite3">
          <SearchInput value={query} onChange={setQuery} placeholder="Search casualties…" />
        </div>
      )}

      <div className={bodyClass}>
        <div className={compact ? 'px-3 pt-1 pb-4 space-y-2' : 'px-3 pt-1 pb-8 space-y-3'}>
          {filtered.map(({ card: c, isActive }) => (
            <SwipeActionRow
              key={c.id}
              className={compact ? 'rounded-xl' : 'rounded-2xl'}
              surfaceClassName={surface}
              onClick={() => handleSelect(c.id, isActive)}
              onLongPress={(rect) => setMenu({ cardId: c.id, rect })}
            >
              <CasualtyCard card={c} code={labelById.get(c.id) ?? ''} compact={compact} selected={isActive} />
            </SwipeActionRow>
          ))}
          {filtered.length === 0 && (
            <p className="px-4 py-6 text-center text-[10pt] text-tertiary">No casualties match.</p>
          )}
        </div>
      </div>

      {menu && menuCard && (
        <LiftedRowMenu
          isOpen
          layout="list"
          anchorRect={menu.rect}
          onClose={() => setMenu(null)}
          items={menuItems}
          row={
            <div className={`${compact ? 'rounded-xl' : 'rounded-2xl'} ${surface} overflow-hidden`}>
              <CasualtyCard card={menuCard.card} code={labelById.get(menuCard.card.id) ?? ''} compact={compact} selected={menuCard.isActive} />
            </div>
          }
        />
      )}
    </div>
  )
})
