import { createContext, useContext, useState, type ReactNode } from 'react'
import { UnderlineTabs } from '@/Components/primitives/UnderlineTabs'
import { ArrowRightLeft, ArrowRight, CircleCheck, Eye, Trash2, Ban, Pencil, Navigation, MapPinCheck, MapPin, X } from 'lucide-react'
import { ListItemRow } from '@/Components/primitives/ListItemRow'
import { PersonnelGroupBand } from '@/Components/primitives/PersonnelRow'
import { BrnPinInput, BRN_PATTERN } from '@/Components/DomainInputs'
import { LiftedRowMenu } from '@/Components/primitives/LiftedRowMenu'
import { ConfirmDialog } from '@/Components/primitives/ConfirmDialog'
import type { ContextMenuItem } from '@/Components/primitives/ContextMenu'
import { SwipeActionRow, type SwipeSide } from '@/Components/primitives/SwipeActionRow'
import { SwipeBindingPicker, type SwipeBindingDisplay } from '@/Components/Settings/SwipeActionsSection'
import {
  TRACKING_SWIPE_POOL, useTrackingSwipeActions, setTrackingSwipeActions, type TrackingSwipeBinding,
} from '../../Utilities/trackingSwipeActions'
import { SectionCard, CardLabel, PageSectionHeader } from '@/Components/primitives/Section'
import { TextArea } from '@/Components/primitives/FormInputs'
import { TintedCard, TintedCardHead, TintedCardFoot, type CardTint } from '@/Components/primitives/TintedCard'
import { formatDtg } from '../../Utilities/propertyDates'
import { ToggleSwitch } from '../Settings/ToggleSwitch'
import type { LinkedFeatureRef } from '../../Types/MissionTypes'
import {
  clusterById, positionOf, sinceAt, placeKey, samePlace, stationLabel, placeLabel, originUic,
  destinationLabel, moveTargets, boardLayout, knownPlaces, refOf, isComplete, isPending, COMPLETE,
  type TrackingEntry, type TrackingComment, type TrackingTarget, type TrackingNetwork, type BoardGroupDef,
  type TrackingEditDraft,
} from './trackingModel'

export type { TrackingEntry, TrackingComment, TrackingEditDraft } from './trackingModel'

/**
 * Tracking Board — patient-flow board (BRN across places), echelon-aware.
 * Pure presentation over trackingModel.ts; data + writes live in the drawer
 * (useTrackingBoardData / useTrackingWrite).
 *
 * Every BRN sits at one station — a map pin marked "Add to tracking board"
 * (AXPs included), shown by the pin's cluster plus related clusters that toggled
 * it on — or at none (Pending: the lack of a station, not a pin). Complete =
 * dispositioned, a place of its own at the far end. In transit
 * is a card marker ("→ destination"), not a place. A board shows patients ORIGINATED in the viewer's
 * cluster or below (origin + ancestors visibility), so a Role II board carries
 * its Role Is' patients and follows them up to Role III.
 * Desktop: T2T-style grid — a leading Pending column, then one flat column per
 * station along the patient flow (Role I → Role III; a shared station listed once),
 * then a trailing Complete column; the current place's whole cell is the marker. Rail / mobile tabs: the viewer's own
 * places one by one, every other cluster as one group.
 *
 * Data: one hidden calendar event per visit carrying tracking_data
 * { brn, moves[{ to: pin ref }], transit, comments[] } (Types/TrackingTypes.ts),
 * fanned to origin + ancestors. Stations are pins in E2E map overlays — names
 * only; entries reference them by id.
 * Comments ride the same E2E event payload (free text may carry PHI — never a
 * plaintext column, log or push body). moves[] / comments[] union-merge by id;
 * BRN last-write-wins.
 */

// ── Board scope ──
// viewerId = operating-as cluster: its stations are the board's columns / groups.

interface BoardScope {
  net: TrackingNetwork
  viewerId: string
}
const BoardScopeContext = createContext<BoardScope>({ net: { clusters: [], places: [] }, viewerId: '' })
export const TrackingBoardScope = BoardScopeContext.Provider
const useBoardScope = () => useContext(BoardScopeContext)

// ── Helpers ──

export const fmtTime = (ms: number) =>
  new Date(ms).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }).replace(':', '')
/** Military date-time — 31OCT26 1423. */
const fmtDateTime = (ms: number) => `${formatDtg(new Date(ms).toISOString())} ${fmtTime(ms)}`

export const filterEntries = (entries: TrackingEntry[], query: string) => {
  const q = query.trim().toUpperCase()
  return q ? entries.filter(e => e.brn.includes(q)) : entries
}

/** A board group's stations. */
const groupPlaces = (g: BoardGroupDef) => g.places
const groupKey = (g: BoardGroupDef) => `cluster:${g.cluster.id}`
const groupLabel = (g: BoardGroupDef) => g.cluster.label

interface ListProps {
  entries: TrackingEntry[]
  now: number
  activeId: string | null
  /** `origin` = the clicked card / row rect, for the overlay container transform. */
  onSelect: (entry: TrackingEntry, origin?: CardOrigin) => void
  /** Entry expanded into the overlay — its rail card is held invisible. */
  expandedId?: string | null
}

/** Rest rect of a desktop rail card / grid row (null = not rendered). */
export const measureRailCard = (id: string): DOMRect | null =>
  document.querySelector<HTMLElement>(`[data-brn-rail="${CSS.escape(id)}"]`)?.getBoundingClientRect() ?? null
export const measureGridRow = (id: string): DOMRect | null =>
  document.querySelector<HTMLElement>(`[data-brn-row="${CSS.escape(id)}"]`)?.getBoundingClientRect() ?? null
const rectOrigin = (r: DOMRect | null): CardOrigin | undefined =>
  r ? { left: r.left, width: r.width, top: r.top, height: r.height, scale: 1 } : undefined

// ── Desktop: main-pane overview grid (T2T idiom — BRN rows × place columns) ──

const BRN_COL_WIDTH = 140
const CELL_MIN_WIDTH = 110
const ROW_HEIGHT = 36

export function TrackingGrid({ entries, activeId, onSelect }: ListProps) {
  const { net, viewerId } = useBoardScope()
  // Pending leads, stations along the patient flow (Role I → Role III), Complete last.
  const columns: { key: string; label: string; here: (e: TrackingEntry) => boolean }[] = [
    { key: 'pending', label: 'Pending', here: isPending },
    ...boardLayout(net, viewerId, entries).flatMap(g => groupPlaces(g)).map(pl => ({
      key: placeKey(pl.pos), label: pl.label, here: (e: TrackingEntry) => samePlace(positionOf(e), pl.pos),
    })),
    { key: COMPLETE, label: 'Complete', here: isComplete },
  ]
  const cols = `${BRN_COL_WIDTH}px repeat(${columns.length}, minmax(${CELL_MIN_WIDTH}px, 1fr))`
  return (
    <div className="h-full overflow-auto bg-themewhite">
      <div className="min-w-max pb-8">
        {/* Column header — sticky, like the T2T time header */}
        <div className="sticky top-0 z-10 grid bg-themewhite border-b border-primary/10" style={{ gridTemplateColumns: cols }}>
          <div className="sticky left-0 z-20 flex items-center px-2 py-1.5 border-r border-primary/10 bg-themewhite">
            <span className="text-[9pt] font-semibold uppercase tracking-wider text-tertiary">BRN</span>
          </div>
          {columns.map(c => (
            <div key={c.key} className="flex items-center px-2 py-1.5 border-l border-l-primary/5">
              <span className="text-[8.5pt] font-semibold uppercase tracking-wider text-tertiary truncate">{c.label}</span>
            </div>
          ))}
        </div>

        {/* BRN rows — the current place's whole cell is the marker */}
        {entries.map(e => {
          const active = activeId === e.id
          const tint = tintFor(e)
          return (
            <button
              key={e.id}
              type="button"
              data-brn-row={e.id}
              onClick={() => onSelect(e, rectOrigin(measureGridRow(e.id)))}
              className="grid w-full text-left border-b border-primary/5"
              style={{ gridTemplateColumns: cols, height: ROW_HEIGHT }}
            >
              <div className={`sticky left-0 z-[5] flex items-center gap-2 px-2 border-r border-primary/10 ${
                active ? 'bg-themeblue3/20' : 'bg-themewhite'
              }`}>
                <span className="text-[10pt] font-mono font-medium text-primary truncate flex-1">{e.brnLabel}</span>
              </div>
              {/* Current cell wears the place tint — same shell + text as the cards */}
              {columns.map(c => {
                const here = c.here(e)
                return (
                  <div
                    key={c.key}
                    className={`flex items-center px-2 border-l border-l-primary/5 ${here ? tint.shell : ''}`}
                  >
                    {here && (e.transit
                      ? <span className={`text-[9pt] font-semibold truncate ${tint.foot}`}>→ {destinationLabel(net, e.transit.to)}</span>
                      : <span className={`text-[9pt] font-mono font-semibold truncate ${tint.foot}`}>{fmtDateTime(sinceAt(e))}</span>)}
                  </div>
                )
              })}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Grouping shared by the desktop rail and the mobile tabs ──
// Pending first, stations along the patient flow (the grid's columns, same
// labels), Complete last.

/** 'all', 'pending', 'complete' or a station key. */
export type TrackingCategory = string

export interface BoardGroup {
  key: TrackingCategory
  label: string
  match: (e: TrackingEntry) => boolean
}

export function boardGroups(net: TrackingNetwork, viewerId: string, entries: TrackingEntry[]): BoardGroup[] {
  const out: BoardGroup[] = [{ key: 'pending', label: 'Pending', match: isPending }]
  for (const g of boardLayout(net, viewerId, entries)) {
    for (const pl of groupPlaces(g)) out.push({ key: placeKey(pl.pos), label: pl.label, match: e => samePlace(positionOf(e), pl.pos) })
  }
  out.push({ key: COMPLETE, label: 'Complete', match: isComplete })
  return out
}

// ── Desktop left rail: list grouped by place ──
// Calendar personnel-filter idiom: collapsible PersonnelGroupBand per group,
// condensed BRN cards (BrnRailCard) under it. No counts / dwell indicators.

export function TrackingBoardList({ entries, onSelect, onEdit, onMove, onTransit, onDelete, expandedId }: ListProps & CardActions) {
  const { net, viewerId } = useBoardScope()
  const cardMenu = useBrnCardMenu({ onSelect, onEdit, onMove, onTransit, onDelete }, measureRailCard, e => (
    <div className="rounded-xl bg-themewhite overflow-hidden"><BrnRailCardBody entry={e} /></div>
  ))
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const toggle = (key: string) => setCollapsed(prev => {
    const next = new Set(prev)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })
  return (
    <div className="pb-8">
      {boardGroups(net, viewerId, entries).map(g => {
        const rows = entries.filter(g.match)
        const open = !collapsed.has(g.key)
        return (
          <div key={g.key}>
            <PersonnelGroupBand
              label={g.label}
              expanded={open}
              onToggle={() => toggle(g.key)}
            />
            {open && rows.length > 0 && (
              <div className="px-2 py-2 space-y-1.5">
                {rows.map(e => (
                  <BrnRailCard
                    key={e.id}
                    entry={e}
                    hidden={expandedId === e.id}
                    onOpen={() => cardMenu.open(e)}
                    onMenu={rect => cardMenu.setMenu({ entry: e, rect, mode: 'all' })}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}
      {cardMenu.surfaces}
    </div>
  )
}

// ── Mobile: category strip + BRN cards ──

/** Horizontal-scroll category strip: All, own places, then other clusters.
 *  Plain text tabs; the active one alone carries a themeblue3 underline. */
export function TrackingCategoryBar({ entries, value, onChange }: { entries: TrackingEntry[]; value: TrackingCategory; onChange: (v: TrackingCategory) => void }) {
  const { net, viewerId } = useBoardScope()
  const tabs = [{ key: 'all', label: 'All' }, ...boardGroups(net, viewerId, entries).map(g => ({ key: g.key, label: g.label }))]
  return <UnderlineTabs tabs={tabs} value={value} onChange={onChange} ariaLabel="Location" />
}

export function filterByCategory(entries: TrackingEntry[], cat: TrackingCategory, net: TrackingNetwork, viewerId: string): TrackingEntry[] {
  if (cat === 'all') return entries
  const g = boardGroups(net, viewerId, entries).find(x => x.key === cat)
  return g ? entries.filter(g.match) : entries
}

/** Where the expanded overlay grows from: the card's rest column (left/width)
 *  plus its current visual top/height/scale — the rest card on tap, the lifted
 *  clone (scaled, raised) when opened from the long-press menu. */
export interface CardOrigin {
  left: number
  width: number
  top: number
  /** Unscaled height. */
  height: number
  scale: number
}

const cardEl = (id: string) => document.querySelector<HTMLElement>(`[data-brn-card="${CSS.escape(id)}"]`)

/** Rest rect of a list card (null = not rendered, e.g. filtered out / deleted). */
export const measureBrnCard = (id: string): DOMRect | null => cardEl(id)?.getBoundingClientRect() ?? null

/** Origin for an open: the lifted clone when the long-press menu is up, else the rest card. */
function originFor(id: string, measure: (id: string) => DOMRect | null): CardOrigin | undefined {
  const rest = measure(id)
  if (!rest) return undefined
  const v = document.querySelector<HTMLElement>('[data-lifted-clone]')?.getBoundingClientRect() ?? rest
  const scale = v.width / rest.width || 1
  return { left: rest.left, width: rest.width, top: v.top, height: v.height / scale, scale }
}

interface CardActions {
  onSelect: (entry: TrackingEntry, origin?: CardOrigin) => void
  /** Open the BRN straight into its edit form. */
  onEdit: (entry: TrackingEntry, origin?: CardOrigin) => void
  /** Move a BRN to a station its origin's chain shows, Pending (null) or Complete. */
  onMove: (entry: TrackingEntry, to: TrackingTarget) => void
  /** Set / clear (null) the "leaving → destination station" marker. */
  onTransit: (entry: TrackingEntry, to: LinkedFeatureRef | null) => void
  /** Remove the BRN from the board — called after the ConfirmDialog. */
  onDelete: (entry: TrackingEntry) => void
}

interface CardListProps extends CardActions {
  entries: TrackingEntry[]
  /** Card currently expanded into the overlay — held invisible in the list so
   *  the overlay reads as the card itself, not a copy. */
  expandedId?: string | null
}

/** Swipe-binding display — shared by the card reveal and the settings picker. */
export const TRACKING_SWIPE_DISPLAY: Record<TrackingSwipeBinding, SwipeBindingDisplay> = {
  open: { label: 'Open', icon: Eye, panel: 'bg-themeblue2' },
  move: { label: 'Move', icon: ArrowRightLeft, panel: 'bg-themeblue3' },
  delete: { label: 'Delete', icon: Trash2, panel: 'bg-themeredred' },
  off: { label: 'None', icon: Ban, panel: null },
}

/** Station shell tints, by pin-id hash — the card sits
 *  on its place's color (footer band reads on it), so the board scans by color
 *  before text. Pending is always gray, Complete always green. Footer text is always the theme's
 *  text-primary — accent tokens (themeblue3, themeredred…) stay dark in dark
 *  themes and vanish on the tinted shell; the shell carries the color. */
const PENDING_TINT: CardTint = { shell: 'bg-themegray1/30', foot: 'text-primary' }
const COMPLETE_TINT: CardTint = { shell: 'bg-themegreen/25', foot: 'text-primary' }
const STATION_TINTS: CardTint[] = [
  { shell: 'bg-themeblue1/30', foot: 'text-primary' },
  { shell: 'bg-themeyellow/30', foot: 'text-primary' },
  { shell: 'bg-themeblue2/25', foot: 'text-primary' },
  { shell: 'bg-themepurple/25', foot: 'text-primary' },
  { shell: 'bg-themered/30', foot: 'text-primary' },
]
export function tintFor(e: TrackingEntry): CardTint {
  if (isComplete(e)) return COMPLETE_TINT
  const p = positionOf(e)
  if (!p) return PENDING_TINT
  // Hash of the place id — stable on every device and board, no lookup, and a
  // place added later gets a color too.
  let h = 0
  for (const ch of p.feature_id) h = (h * 31 + ch.charCodeAt(0)) | 0
  return STATION_TINTS[Math.abs(h) % STATION_TINTS.length]
}

/** Card head — BRN with the origin UIC under it. Shared by the list card and
 *  the expanded overlay. */
export function BrnCardHead({ entry }: { entry: TrackingEntry }) {
  const { net } = useBoardScope()
  return <TintedCardHead title={entry.brnLabel} subtitle={originUic(net.clusters, entry)} />
}

/** Current station — the overlay's third head line, same rhythm as the UIC. */
export function BrnStationLine({ entry }: { entry: TrackingEntry }) {
  const { net } = useBoardScope()
  return (
    <p className="mt-0.5 text-[9pt] font-medium text-secondary truncate">
      {placeLabel(net, entry)}
      {entry.transit && <span className="text-themeblue2"> → {destinationLabel(net, entry.transit.to)}</span>}
    </p>
  )
}

const latestNote = (e: TrackingEntry) => e.comments[e.comments.length - 1]?.text

/** Footer parts: location (→ destination while in transit) · since / en-route stamp. */
function useBrnFoot(entry: TrackingEntry, arrowIcon: boolean) {
  const { net } = useBoardScope()
  const t = entry.transit
  const left = (
    <>
      {placeLabel(net, entry)}
      {t && (arrowIcon
        ? <> <ArrowRight size={10} className="inline -mt-px" /> {destinationLabel(net, t.to)}</>
        : ` → ${destinationLabel(net, t.to)}`)}
    </>
  )
  const right = t ? `En route ${fmtTime(t.at)}` : `Since ${fmtDateTime(sinceAt(entry))}`
  return { left, right }
}

/** Footer band on the tint: location · since — or, while in transit, the
 *  "→ destination" marker and when they left. */
export function BrnCardFoot({ entry }: { entry: TrackingEntry }) {
  const { left, right } = useBrnFoot(entry, true)
  return <TintedCardFoot tint={tintFor(entry)} left={left} right={right} />
}

/** Card body — rendered in the list AND as the lifted clone in the menu, and
 *  the collapsed state of TrackingCardOverlay. Tinted shell → white inner card
 *  (BRN, UIC, latest note) → footer band (location) on the tint. */
function BrnCard({ entry }: { entry: TrackingEntry }) {
  const { net } = useBoardScope()
  const { left, right } = useBrnFoot(entry, true)
  return (
    <TintedCard
      tint={tintFor(entry)}
      title={entry.brnLabel}
      subtitle={originUic(net.clusters, entry)}
      note={latestNote(entry)}
      footLeft={left}
      footRight={right}
    />
  )
}

/** Condensed BrnCard — same tinted shell → white inner (BRN · UIC, latest note)
 *  → footer band (location · since). Rail card and its lifted clone. */
function BrnRailCardBody({ entry }: { entry: TrackingEntry }) {
  const { net } = useBoardScope()
  const { left, right } = useBrnFoot(entry, false)
  return (
    <TintedCard
      compact
      tint={tintFor(entry)}
      title={entry.brnLabel}
      subtitle={originUic(net.clusters, entry)}
      note={latestNote(entry)}
      footLeft={left}
      footRight={right}
    />
  )
}

/** Desktop rail card. Click grows it into the centered TrackingCardOverlay;
 *  right-click / long-press lifts it into the shared card menu. */
function BrnRailCard({ entry, hidden, onOpen, onMenu }: {
  entry: TrackingEntry
  /** Expanded into the overlay — held invisible so the overlay reads as the card. */
  hidden: boolean
  onOpen: () => void
  onMenu: (rect: DOMRect) => void
}) {
  return (
    <div data-brn-rail={entry.id} className={hidden ? 'invisible' : undefined}>
      <SwipeActionRow
        className="rounded-xl transition-shadow hover:shadow-md"
        surfaceClassName="bg-themewhite"
        onClick={onOpen}
        onLongPress={onMenu}
      >
        <BrnRailCardBody entry={entry} />
      </SwipeActionRow>
    </div>
  )
}

/** "Move to" targets — Pending, every station the origin's chain shows
 *  (Role I → Role III), then Complete, minus the BRN's current spot. One cluster
 *  = flat list; several = a submenu per cluster. Moving a Complete BRN reopens it. */
export function trackingMoveItems(e: TrackingEntry, onMove: (entry: TrackingEntry, to: TrackingTarget) => void, net: TrackingNetwork): ContextMenuItem[] {
  const at = positionOf(e)
  const placeItems = (g: BoardGroupDef): ContextMenuItem[] => groupPlaces(g)
    .filter(pl => !samePlace(pl.pos, at))
    .map(pl => ({ key: placeKey(pl.pos), label: pl.label, icon: ArrowRight, onAction: () => onMove(e, pl.pos) }))
  const pending: ContextMenuItem[] = isPending(e) ? [] : [{ key: 'pending', label: 'Pending', icon: ArrowRight, onAction: () => onMove(e, null) }]
  const complete: ContextMenuItem[] = isComplete(e) ? [] : [{ key: COMPLETE, label: 'Complete', icon: CircleCheck, onAction: () => onMove(e, COMPLETE) }]
  const groups = moveTargets(net, e)
  if (groups.length === 1) return [...pending, ...placeItems(groups[0]), ...complete]
  return [...pending, ...groups.map(g => ({ key: groupKey(g), label: groupLabel(g), icon: ArrowRightLeft, submenu: placeItems(g) })), ...complete]
}

/** "Send to" destinations — every station the origin's chain shows, minus where
 *  the BRN sits / is already headed. Submenu per cluster when there are several. */
export function trackingTransitItems(e: TrackingEntry, onTransit: (entry: TrackingEntry, to: LinkedFeatureRef | null) => void, net: TrackingNetwork): ContextMenuItem[] {
  const at = positionOf(e)
  const items = (g: BoardGroupDef): ContextMenuItem[] => g.places
    .filter(d => !samePlace(d.pos, at) && !(e.transit && samePlace(d.pos, e.transit.to)))
    .map(d => ({ key: placeKey(d.pos), label: d.label, icon: Navigation, onAction: () => onTransit(e, d.pos) }))
  const groups = moveTargets(net, e)
  if (groups.length === 1) return items(groups[0])
  return groups
    .map(g => ({ key: groupKey(g), label: groupLabel(g), icon: Navigation, submenu: items(g) }))
    .filter(g => g.submenu.length > 0)
}

/** BRN action menu — shared by the card long-press, the mobile detail Sheet
 *  ellipsis and the desktop header ellipsis. `onOpen` omitted = already open. */
export function buildTrackingMenuItems(e: TrackingEntry, h: {
  onOpen?: (entry: TrackingEntry) => void
  onEdit: (entry: TrackingEntry) => void
  onMove: (entry: TrackingEntry, to: TrackingTarget) => void
  /** Set (or clear, null) the "leaving → destination station" marker. */
  onTransit: (entry: TrackingEntry, to: LinkedFeatureRef | null) => void
  onDelete: (entry: TrackingEntry) => void
  net: TrackingNetwork
}): ContextMenuItem[] {
  const t = e.transit
  // Complete = done moving; reopen through Move to… first.
  const sendTo = isComplete(e) ? [] : trackingTransitItems(e, h.onTransit, h.net)
  return [
    ...(h.onOpen ? [{ key: 'open', label: 'Open', icon: Eye, onAction: () => h.onOpen!(e) }] : []),
    { key: 'edit', label: 'Edit', icon: Pencil, onAction: () => h.onEdit(e) },
    { key: 'move', label: 'Move to…', icon: ArrowRightLeft, submenu: trackingMoveItems(e, h.onMove, h.net) },
    // In transit: land them (move to the destination) or call it off.
    ...(t ? [
      { key: 'arrived', label: 'Arrived', icon: MapPinCheck, onAction: () => h.onMove(e, t.to) },
      { key: 'cancel-transit', label: 'Cancel en route', icon: X, onAction: () => h.onTransit(e, null) },
    ] : []),
    ...(sendTo.length > 0 ? [{ key: 'send', label: t ? 'Redirect to…' : 'Send to…', icon: Navigation, submenu: sendTo }] : []),
    { key: 'delete', label: 'Delete', icon: Trash2, destructive: true, onAction: () => h.onDelete(e) },
  ]
}

/**
 * Right-click / long-press card menu: the LiftedRowMenu over a clone of the card
 * plus its delete confirm. Shared by the mobile cards and the desktop rail.
 * `measure` = the card's rest rect; `row` = the lifted clone.
 */
function useBrnCardMenu(
  { onSelect, onEdit, onMove, onTransit, onDelete }: CardActions,
  measure: (id: string) => DOMRect | null,
  row: (entry: TrackingEntry) => ReactNode,
) {
  const { net } = useBoardScope()
  // mode 'all' = full menu; 'move' = swipe-bound Move, straight to the places.
  const [menu, setMenu] = useState<{ entry: TrackingEntry; rect: DOMRect; mode: 'all' | 'move' } | null>(null)
  const [pendingDelete, setPendingDelete] = useState<TrackingEntry | null>(null)

  // Open / Edit from the lifted menu grow out of the lifted clone (still mounted
  // when onAction fires); tap / swipe-open grow out of the rest card.
  const open = (e: TrackingEntry) => onSelect(e, originFor(e.id, measure))
  const edit = (e: TrackingEntry) => onEdit(e, originFor(e.id, measure))
  const moveItems = (e: TrackingEntry) => trackingMoveItems(e, onMove, net)
  const menuItems = (e: TrackingEntry) => buildTrackingMenuItems(e, { onOpen: open, onEdit: edit, onMove, onTransit, onDelete: setPendingDelete, net })

  const surfaces = (
    <>
      <LiftedRowMenu
        isOpen={!!menu}
        anchorRect={menu?.rect ?? null}
        row={menu && row(menu.entry)}
        items={menu ? (menu.mode === 'move' ? moveItems(menu.entry) : menuItems(menu.entry)) : []}
        header={menu?.mode === 'move' ? 'Move to' : undefined}
        onClose={() => setMenu(null)}
        layout="list"
      />
      <ConfirmDialog
        visible={!!pendingDelete}
        title={`Remove ${pendingDelete?.brnLabel ?? ''} from the board?`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => { if (pendingDelete) onDelete(pendingDelete); setPendingDelete(null) }}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  )

  return { open, setMenu, setPendingDelete, surfaces }
}

/**
 * BRN cards with the chat gesture set (SwipeActionRow): tap opens, long-press /
 * right-click lifts the card into the LiftedRowMenu (Open / Move to… /
 * Delete); swipe left/right fire the user's Tracking swipe bindings (same set,
 * picked in board settings via Messaging's picker).
 */
export function TrackingCardList({ entries, onSelect, onEdit, onMove, onTransit, onDelete, expandedId }: CardListProps) {
  const swipe = useTrackingSwipeActions()
  const cardMenu = useBrnCardMenu({ onSelect, onEdit, onMove, onTransit, onDelete }, measureBrnCard, e => (
    <div className="rounded-2xl bg-themewhite2 overflow-hidden"><BrnCard entry={e} /></div>
  ))

  const fire = (b: TrackingSwipeBinding, e: TrackingEntry, rect: DOMRect) => {
    if (b === 'open') cardMenu.open(e)
    else if (b === 'move') cardMenu.setMenu({ entry: e, rect, mode: 'move' })
    else if (b === 'delete') cardMenu.setPendingDelete(e)
  }

  const sideFor = (b: TrackingSwipeBinding, e: TrackingEntry): SwipeSide | null => {
    const d = TRACKING_SWIPE_DISPLAY[b]
    return d.panel ? { icon: d.icon, panel: d.panel, onFire: rect => fire(b, e, rect) } : null
  }

  return (
    <div className="px-3 pb-8 space-y-3">
      {entries.map(e => (
        <div key={e.id} data-brn-card={e.id} className={expandedId === e.id ? 'invisible' : undefined}>
          <SwipeActionRow
            className="rounded-2xl"
            ltr={sideFor(swipe.ltr, e)}
            rtl={sideFor(swipe.rtl, e)}
            onClick={() => cardMenu.open(e)}
            onLongPress={rect => cardMenu.setMenu({ entry: e, rect, mode: 'all' })}
          >
            <BrnCard entry={e} />
          </SwipeActionRow>
        </div>
      ))}
      {cardMenu.surfaces}
    </div>
  )
}

// ── Detail ──

/** Comments — read-only thread in the detail (Calendar "Notes" idiom). All
 *  writes (add / change / remove) go through the form: check-in or ellipsis Edit. */
function TrackingComments({ entry }: { entry: TrackingEntry }) {
  if (entry.comments.length === 0) return null
  return (
    <CardLabel label="Comments">
      <SectionCard>
        {entry.comments.map(c => (
          <div key={c.id} className="px-4 py-2.5 border-b border-primary/5 last:border-b-0">
            <CommentMeta comment={c} />
            <p className="text-[10pt] text-primary whitespace-pre-wrap break-words">{c.text}</p>
          </div>
        ))}
      </SectionCard>
    </CardLabel>
  )
}

/** Author · edited marker on the left, DTG (last write) on the right. */
function CommentMeta({ comment }: { comment: TrackingComment }) {
  const edited = comment.editedAt
    ? ` · edited${comment.editedBy && comment.editedBy !== comment.by ? ` by ${comment.editedBy}` : ''}`
    : ''
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[9pt] text-tertiary truncate">{comment.by}{edited}</span>
      <span className="text-[9pt] font-mono text-tertiary shrink-0">{fmtDateTime(comment.editedAt ?? comment.at)}</span>
    </div>
  )
}

// ── Form (check-in create + ellipsis Edit; Calendar EventForm idiom) ──

export const emptyDraft = (): TrackingEditDraft => ({ brn: '', comments: [], newComment: '' })

export const draftFromEntry = (e: TrackingEntry): TrackingEditDraft => ({
  brn: e.brn,
  comments: e.comments.map(c => ({ id: c.id, text: c.text })),
  newComment: '',
})

export const draftIsValid = (d: TrackingEditDraft) => BRN_PATTERN.test(d.brn)

const commentAreaClass = 'w-full bg-transparent px-4 pt-1 pb-2.5 text-base md:text-[10pt] text-primary placeholder:text-tertiary focus:outline-none resize-none'

/** Check-in — self-rowing primitives straight in the PreviewOverlay card
 *  (no section chrome); Save rides the overlay's right footer. */
export function TrackingCheckInFields({ draft, onChange }: {
  draft: TrackingEditDraft
  onChange: (d: TrackingEditDraft) => void
}) {
  return (
    <>
      <BrnPinInput value={draft.brn} onChange={brn => onChange({ ...draft, brn })} spread autoFocus />
      <TextArea
        value={draft.newComment}
        onChange={newComment => onChange({ ...draft, newComment })}
        placeholder="Comment"
        maxLength={500}
        rows={3}
      />
    </>
  )
}

/** BRN + comments — the open BRN's ellipsis Edit form. */
export function TrackingEditForm({ entry, draft, onChange }: {
  entry?: TrackingEntry
  draft: TrackingEditDraft
  onChange: (d: TrackingEditDraft) => void
}) {
  const setComment = (id: string, text: string) =>
    onChange({ ...draft, comments: draft.comments.map(c => c.id === id ? { ...c, text } : c) })
  return (
    <div className="space-y-4">
      <section>
        <PageSectionHeader>BRN</PageSectionHeader>
        <SectionCard>
          <BrnPinInput
            value={draft.brn}
            onChange={brn => onChange({ ...draft, brn })}
            spread
            autoFocus={!entry}
          />
        </SectionCard>
      </section>

      <section>
        <PageSectionHeader>Comments</PageSectionHeader>
        <SectionCard>
          {draft.comments.map(dc => {
            const c = entry?.comments.find(x => x.id === dc.id)
            return (
              <div key={dc.id} className="border-b border-primary/5">
                {c && <div className="px-4 pt-2.5"><CommentMeta comment={c} /></div>}
                <TextArea
                  bare
                  autoGrow
                  rows={1}
                  value={dc.text}
                  onChange={t => setComment(dc.id, t)}
                  placeholder="Cleared — removed on save"
                  maxLength={500}
                  ariaLabel="Comment"
                  inputClassName={commentAreaClass}
                />
              </div>
            )
          })}
          <TextArea
            value={draft.newComment}
            onChange={newComment => onChange({ ...draft, newComment })}
            placeholder="Add a comment"
            maxLength={500}
            rows={2}
          />
        </SectionCard>
      </section>
    </div>
  )
}

export function TrackingBoardDetail({ entry }: { entry: TrackingEntry }) {
  const { net } = useBoardScope()
  return (
    <div className="space-y-4">
      <CardLabel label="History">
        <SectionCard>
          {[...entry.moves].reverse().map(m => (
            <ListItemRow
              key={m.id}
              as="div"
              className="px-4 py-2.5 border-b border-primary/5"
              center={<p className="text-[10pt] text-primary truncate">{m.complete ? 'Complete' : stationLabel(net, m.to)}</p>}
              right={<span className="text-[9pt] font-mono text-tertiary shrink-0">{fmtDateTime(m.at)}</span>}
            />
          ))}
          <ListItemRow
            as="div"
            className="px-4 py-2.5"
            center={<p className="text-[10pt] text-primary truncate">Checked in</p>}
            right={<span className="text-[9pt] font-mono text-tertiary shrink-0">{fmtDateTime(entry.checkedInAt)}</span>}
          />
        </SectionCard>
      </CardLabel>

      <TrackingComments entry={entry} />
    </div>
  )
}

// ── Settings (mirrors Messaging settings: section header + card, in Sheet / PreviewOverlay) ──

export interface TrackingSettingsHandlers {
  /** Show / hide a known station on this cluster's board (writes the pin's
   *  tracking_clinic_ids). Stations themselves are made / renamed / removed on
   *  the map ("Add to tracking board" on a pin). */
  onTogglePlace?: (ref: LinkedFeatureRef) => void
  /** This cluster's sharing toggles. null = hidden (not a supervisor, or not loaded). */
  sharing?: { send: boolean; receive: boolean } | null
  onSetSharing?: (next: { send: boolean; receive: boolean }) => void
}

export function TrackingBoardSettings(h: TrackingSettingsHandlers) {
  const { net, viewerId } = useBoardScope()
  const swipe = useTrackingSwipeActions()
  const known = knownPlaces(net, viewerId)
  const own = known.filter(p => p.clinicId === viewerId)
  const others = known.filter(p => p.clinicId !== viewerId)
  const clusterName = (id: string) => clusterById(net.clusters, id)?.label ?? ''

  return (
    <div className="px-5 py-4 space-y-6">
      {/* Card swipe bindings — Messaging's swipe picker, tracking actions. */}
      <SwipeBindingPicker
        value={swipe}
        pool={TRACKING_SWIPE_POOL}
        display={TRACKING_SWIPE_DISPLAY}
        off="off"
        onChange={setTrackingSwipeActions}
      />

      {/* Sharing — a link runs only when the lower cluster sends AND the upper
          cluster receives. Both off = this cluster's board stays internal. */}
      {h.sharing && h.onSetSharing && (
        <section>
          <PageSectionHeader>Sharing</PageSectionHeader>
          <SectionCard>
            {[
              { key: 'send' as const, label: 'Sending', sub: 'Your parent cluster sees your board when it is receiving' },
              { key: 'receive' as const, label: 'Receiving', sub: 'You see the boards of clusters under you that are sending' },
            ].map(row => (
              <ListItemRow
                key={row.key}
                onClick={() => h.onSetSharing!({ ...h.sharing!, [row.key]: !h.sharing![row.key] })}
                className="px-4 py-2.5 border-b border-primary/5 last:border-b-0"
                center={
                  <div className="min-w-0">
                    <p className="text-[10pt] text-primary truncate">{row.label}</p>
                    <p className="text-[9pt] text-tertiary">{row.sub}</p>
                  </div>
                }
                right={<ToggleSwitch checked={h.sharing![row.key]} />}
              />
            ))}
          </SectionCard>
        </section>
      )}

      {/* Stations — every tracking pin this cluster knows: its own, then related
          clusters'. Toggle = show on this board (same physical spot, no duplicate).
          Made / renamed / removed on the map. */}
      {[{ title: 'Your stations', rows: own }, { title: 'Other clusters', rows: others }].map(sec => sec.rows.length > 0 && (
        <section key={sec.title}>
          <PageSectionHeader>{sec.title}</PageSectionHeader>
          <SectionCard>
            {sec.rows.map(pl => {
              const on = pl.targetClinicIds.includes(viewerId)
              const alsoOn = pl.targetClinicIds.filter(id => id !== viewerId && id !== pl.clinicId).map(clusterName)
              const sub = pl.clinicId === viewerId
                ? (alsoOn.length > 0 ? `Also on ${alsoOn.join(', ')}` : undefined)
                : clusterName(pl.clinicId)
              return (
                <ListItemRow
                  key={pl.featureId}
                  onClick={h.onTogglePlace ? () => h.onTogglePlace!(refOf(pl)) : undefined}
                  className="px-4 py-2.5 border-b border-primary/5 last:border-b-0"
                  left={pl.clinicId === viewerId ? undefined : (
                    <span className="w-9 h-9 rounded-full bg-themewhite2 flex items-center justify-center text-themeblue3 shrink-0">
                      <MapPin size={15} />
                    </span>
                  )}
                  center={
                    <div className="min-w-0">
                      <p className="text-[10pt] text-primary truncate">{pl.label}</p>
                      {sub && <p className="text-[9pt] text-tertiary truncate">{sub}</p>}
                    </div>
                  }
                  right={<ToggleSwitch checked={on} />}
                />
              )
            })}
          </SectionCard>
        </section>
      ))}
      {known.length === 0 && (
        <p className="text-[9pt] text-tertiary px-1">No stations yet — on the map, open a pin and turn on “Add to tracking board”.</p>
      )}

    </div>
  )
}
