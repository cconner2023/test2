import { createContext, useContext, useState, type ReactNode } from 'react'
import { UnderlineTabs } from '@/Components/primitives/UnderlineTabs'
import { ArrowRightLeft, ArrowRight, Eye, Forward, Trash2, Ban, Pencil, Check, Navigation, MapPinCheck, MapPin, X } from 'lucide-react'
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
import { formatDtg } from '../../Utilities/propertyDates'
import { ToggleSwitch } from '../Settings/ToggleSwitch'
import type { LinkedFeatureRef } from '../../Types/MissionTypes'
import {
  MOCK_CLUSTERS, MOCK_OVERLAYS, derivePlaces, clusterById, positionOf, sinceAt, placeKey, samePlace, placeLabel, stationLabel,
  destinationLabel, placeOwnerLabel, originUic, moveTargets, boardLayout, knownPlaces, refOf,
  type MockEntry, type MockComment, type TrackingPosition, type TrackingNetwork, type BoardGroupDef,
} from './trackingModel'

export { buildMockEntries, type MockEntry, type MockComment } from './trackingModel'

/**
 * Tracking Board — SKELETON. Patient-flow board (BRN across places),
 * echelon-aware. Mock data only (trackingModel.ts); no store, no vault send.
 *
 * Every BRN sits at one station — a map pin marked "Add to tracking board"
 * (AXPs included), shown by the pin's cluster plus related clusters that toggled
 * it on — or at none (Unassigned: the lack of a station, not a pin). In transit
 * is a card marker ("→ destination"), not a place. A board shows patients ORIGINATED in the viewer's
 * cluster or below (origin + ancestors visibility), so a Role II board carries
 * its Role Is' patients and follows them up to Role III.
 * Desktop: T2T-style grid — one column group per cluster along the patient flow
 * (Role I → Role III) after a leading Unassigned column, the stations it shows
 * under it (a shared station listed once, under the first cluster showing it); the
 * current place's whole cell is the marker. Rail / mobile tabs: the viewer's own
 * places one by one, every other cluster as one group.
 *
 * Final shape: one hidden `tracking` calendar event per visit carrying
 * tracking_data { brn, origin_clinic_id, moves[{ to: place }], transit?, comments[] },
 * fanned to origin + ancestors. Stations are pins in E2E map overlays
 * rows — names only; entries reference them by id.
 * Comments ride the same E2E event payload (free text may carry PHI — never a
 * plaintext column, log or push body). moves[] / comments[] union-merge by id;
 * BRN last-write-wins.
 */

// ── Board scope (viewer cluster) ──

interface BoardScope {
  net: TrackingNetwork
  viewerId: string
}
const BoardScopeContext = createContext<BoardScope>({ net: { clusters: MOCK_CLUSTERS, places: derivePlaces(MOCK_OVERLAYS) }, viewerId: MOCK_CLUSTERS[0].id })
export const TrackingBoardScope = BoardScopeContext.Provider
const useBoardScope = () => useContext(BoardScopeContext)

// ── Helpers ──

export const fmtTime = (ms: number) =>
  new Date(ms).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }).replace(':', '')
/** Military date-time — 31OCT26 1423. */
const fmtDateTime = (ms: number) => `${formatDtg(new Date(ms).toISOString())} ${fmtTime(ms)}`
const MIN = 60 * 1000
const dwellMin = (e: MockEntry, now: number) => Math.max(0, Math.round((now - sinceAt(e)) / MIN))

export const filterEntries = (entries: MockEntry[], query: string) => {
  const q = query.trim().toUpperCase()
  return q ? entries.filter(e => e.brn.includes(q)) : entries
}

/** A board group's stations. */
const groupPlaces = (g: BoardGroupDef) => g.places
const groupKey = (g: BoardGroupDef) => `cluster:${g.cluster.id}`
const groupLabel = (g: BoardGroupDef) => g.cluster.label

interface ListProps {
  entries: MockEntry[]
  now: number
  activeId: string | null
  /** `origin` = the clicked card / row rect, for the overlay container transform. */
  onSelect: (entry: MockEntry, origin?: CardOrigin) => void
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
  // Column groups along the patient flow (Role I → Role III).
  // Unassigned leads (no cluster band over it), then one band per cluster.
  const groups = boardLayout(net, viewerId, entries).map(g => ({ def: g, places: groupPlaces(g) }))
  const columns: { pos: TrackingPosition; label: string; first: boolean }[] = [
    { pos: null, label: 'Unassigned', first: true },
    ...groups.flatMap(g => g.places.map((pl, i) => ({ ...pl, first: i === 0 }))),
  ]
  const cols = `${BRN_COL_WIDTH}px repeat(${columns.length}, minmax(${CELL_MIN_WIDTH}px, 1fr))`
  return (
    <div className="h-full overflow-auto bg-themewhite">
      <div className="min-w-max pb-8">
        {/* Column header — sticky, like the T2T time header: cluster band over its places */}
        <div className="sticky top-0 z-10 grid bg-themewhite border-b border-primary/10" style={{ gridTemplateColumns: cols }}>
          <div className="sticky left-0 z-20 row-span-2 flex items-end px-2 py-1.5 border-r border-primary/10 bg-themewhite">
            <span className="text-[9pt] font-semibold uppercase tracking-wider text-tertiary">BRN</span>
          </div>
          <div className="border-l border-l-primary/10" />
          {groups.map(g => (
            <div
              key={groupKey(g.def)}
              className="flex items-center px-2 pt-1.5 border-l border-l-primary/10"
              style={{ gridColumn: `span ${g.places.length}` }}
            >
              <span className={`text-[9pt] font-semibold truncate ${g.def.cluster.id === viewerId ? 'text-primary' : 'text-secondary'}`}>{groupLabel(g.def)}</span>
            </div>
          ))}
          {columns.map(c => (
            <div
              key={placeKey(c.pos)}
              className={`flex items-center px-2 pb-1.5 pt-0.5 border-l ${c.first ? 'border-l-primary/10' : 'border-l-primary/5'}`}
            >
              <span className="text-[8.5pt] font-semibold uppercase tracking-wider text-tertiary truncate">{c.label}</span>
            </div>
          ))}
        </div>

        {/* BRN rows — the current place's whole cell is the marker */}
        {entries.map(e => {
          const at = positionOf(e)
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
                <span className="text-[10pt] font-mono font-medium text-primary truncate flex-1">{e.brn}</span>
              </div>
              {/* Current cell wears the place tint — same shell + text as the cards */}
              {columns.map(c => {
                const here = samePlace(c.pos, at)
                return (
                  <div
                    key={placeKey(c.pos)}
                    className={`flex items-center px-2 border-l ${c.first ? 'border-l-primary/10' : 'border-l-primary/5'} ${here ? tint.shell : ''}`}
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
// Unassigned first; the viewer's own cluster splits into its stations;
// every other cluster on the board is ONE group (the card footer names the place).

/** 'all', 'unassigned', a station key (own cluster) or `cluster:<id>`. */
export type TrackingCategory = string

interface BoardGroup {
  key: TrackingCategory
  label: string
  match: (e: MockEntry) => boolean
}

function boardGroups(net: TrackingNetwork, viewerId: string, entries: MockEntry[]): BoardGroup[] {
  const out: BoardGroup[] = [{ key: 'unassigned', label: 'Unassigned', match: e => positionOf(e) === null }]
  for (const g of boardLayout(net, viewerId, entries)) {
    if (g.cluster.id === viewerId) {
      for (const pl of groupPlaces(g)) out.push({ key: placeKey(pl.pos), label: pl.label, match: e => samePlace(positionOf(e), pl.pos) })
    } else {
      const keys = new Set(groupPlaces(g).map(pl => placeKey(pl.pos)))
      out.push({ key: groupKey(g), label: groupLabel(g), match: e => keys.has(placeKey(positionOf(e))) })
    }
  }
  return out
}

// ── Desktop left rail: list grouped by place ──
// Calendar personnel-filter idiom: collapsible PersonnelGroupBand per group,
// condensed BRN cards (BrnRailCard) under it. No counts / dwell indicators.

export function TrackingBoardList({ entries, onSelect, expandedId }: ListProps) {
  const { net, viewerId } = useBoardScope()
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
                {rows.map(e => <BrnRailCard key={e.id} entry={e} hidden={expandedId === e.id} onSelect={onSelect} />)}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Mobile: category strip + BRN cards ──

/** Horizontal-scroll category strip: All, own places, then other clusters.
 *  Plain text tabs; the active one alone carries a themeblue3 underline. */
export function TrackingCategoryBar({ entries, value, onChange }: { entries: MockEntry[]; value: TrackingCategory; onChange: (v: TrackingCategory) => void }) {
  const { net, viewerId } = useBoardScope()
  const tabs = [{ key: 'all', label: 'All' }, ...boardGroups(net, viewerId, entries).map(g => ({ key: g.key, label: g.label }))]
  return <UnderlineTabs tabs={tabs} value={value} onChange={onChange} ariaLabel="Location" />
}

export function filterByCategory(entries: MockEntry[], cat: TrackingCategory, net: TrackingNetwork, viewerId: string): MockEntry[] {
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
function originFor(id: string): CardOrigin | undefined {
  const rest = measureBrnCard(id)
  if (!rest) return undefined
  const v = document.querySelector<HTMLElement>('[data-lifted-clone]')?.getBoundingClientRect() ?? rest
  const scale = v.width / rest.width || 1
  return { left: rest.left, width: rest.width, top: v.top, height: v.height / scale, scale }
}

interface CardListProps {
  entries: MockEntry[]
  onSelect: (entry: MockEntry, origin?: CardOrigin) => void
  /** Open the BRN straight into its edit form. */
  onEdit: (entry: MockEntry, origin?: CardOrigin) => void
  /** Move a BRN to a station its origin's chain shows, or Unassigned (null). */
  onMove: (entry: MockEntry, to: TrackingPosition) => void
  /** Set / clear (null) the "leaving → destination station" marker. */
  onTransit: (entry: MockEntry, to: LinkedFeatureRef | null) => void
  /** Hand the BRN off to another member/cluster. */
  onForward: (entry: MockEntry) => void
  /** Remove the BRN from the board — called after the ConfirmDialog. */
  onDelete: (entry: MockEntry) => void
  /** Card currently expanded into the overlay — held invisible in the list so
   *  the overlay reads as the card itself, not a copy. */
  expandedId?: string | null
}

/** Swipe-binding display — shared by the card reveal and the settings picker. */
export const TRACKING_SWIPE_DISPLAY: Record<TrackingSwipeBinding, SwipeBindingDisplay> = {
  open: { label: 'Open', icon: Eye, panel: 'bg-themeblue2' },
  move: { label: 'Move', icon: ArrowRightLeft, panel: 'bg-themeblue3' },
  forward: { label: 'Forward', icon: Forward, panel: 'bg-themeblue1' },
  delete: { label: 'Delete', icon: Trash2, panel: 'bg-themeredred' },
  off: { label: 'None', icon: Ban, panel: null },
}

/** Station shell tints, by pin-id hash — the card sits
 *  on its place's color (footer band reads on it), so the board scans by color
 *  before text. Unassigned is always gray. */
const UNASSIGNED_TINT = { shell: 'bg-themegray1/30', foot: 'text-secondary' }
const STATION_TINTS: { shell: string; foot: string }[] = [
  { shell: 'bg-themeblue1/30', foot: 'text-themeblue3' },
  { shell: 'bg-themeyellow/30', foot: 'text-primary' },
  { shell: 'bg-themeblue2/25', foot: 'text-themeblue3' },
  { shell: 'bg-themepurple/25', foot: 'text-themepurple' },
  { shell: 'bg-themered/30', foot: 'text-themeredred' },
  { shell: 'bg-themegreen/25', foot: 'text-themegreen' },
]
export function tintFor(e: MockEntry) {
  const p = positionOf(e)
  if (!p) return UNASSIGNED_TINT
  // Hash of the place id — stable on every device and board, no lookup, and a
  // place added later gets a color too.
  let h = 0
  for (const ch of p.feature_id) h = (h * 31 + ch.charCodeAt(0)) | 0
  return STATION_TINTS[Math.abs(h) % STATION_TINTS.length]
}

/** Card comment preview — clipped past this many characters. */
const COMMENT_PREVIEW_CHARS = 80
const clip = (t: string, n: number) => (t.length > n ? `${t.slice(0, n).trimEnd()}…` : t)

/** Card head — UIC · check-in time over the BRN. Shared by the list card and
 *  the expanded overlay (which swaps `inTime` for a fading copy). */
export function BrnCardHead({ entry, inTime }: { entry: MockEntry; inTime?: ReactNode }) {
  const { net } = useBoardScope()
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[9pt] font-mono font-medium text-tertiary truncate">{originUic(net.clusters, entry)}</span>
        {inTime ?? <span className="text-[9pt] font-mono text-tertiary shrink-0">In {fmtTime(entry.checkedInAt)}</span>}
      </div>
      <p className="mt-1 text-[16pt] leading-tight font-mono font-bold tracking-wide text-primary truncate">{entry.brn}</p>
    </>
  )
}

/** Footer band on the tint: location · since — or, while in transit, the
 *  "→ destination" marker and when they left. */
export function BrnCardFoot({ entry }: { entry: MockEntry }) {
  const { net, viewerId } = useBoardScope()
  const t = entry.transit
  return (
    <div className={`flex items-center justify-between gap-3 px-3 pt-1.5 pb-0.5 text-[8pt] font-semibold uppercase tracking-wider ${tintFor(entry).foot}`}>
      <span className="truncate">
        {placeLabel(net, positionOf(entry), viewerId)}
        {t && <> <ArrowRight size={10} className="inline -mt-px" /> {destinationLabel(net, t.to)}</>}
      </span>
      <span className="font-mono shrink-0">{t ? `En route ${fmtTime(t.at)}` : `Since ${fmtDateTime(sinceAt(entry))}`}</span>
    </div>
  )
}

/** Card body — rendered in the list AND as the lifted clone in the menu, and
 *  the collapsed state of TrackingCardOverlay. Tinted shell → white inner card
 *  (head + latest comment) → footer band on the tint. */
function BrnCard({ entry }: { entry: MockEntry }) {
  const latest = entry.comments[entry.comments.length - 1]
  const more = entry.comments.length - 1
  return (
    <div className={`p-1.5 ${tintFor(entry).shell}`}>
      <div className="rounded-xl bg-themewhite px-4 pt-3 pb-3.5 shadow-sm min-w-0">
        <BrnCardHead entry={entry} />
        {latest && (
          <p className="mt-1.5 text-[9.5pt] leading-snug text-secondary break-words">
            {clip(latest.text, COMMENT_PREVIEW_CHARS)}
            {more > 0 && <span className="text-tertiary"> · {more} more</span>}
          </p>
        )}
      </div>
      <BrnCardFoot entry={entry} />
    </div>
  )
}

/** Condensed BrnCard for the desktop rail — same tinted shell → white inner →
 *  footer band, at one BRN line + one sub line. The group band already names
 *  the place, so the footer carries only the since stamp. Click grows it into
 *  the centered TrackingCardOverlay. */
function BrnRailCard({ entry, hidden, onSelect }: {
  entry: MockEntry
  /** Expanded into the overlay — held invisible so the overlay reads as the card. */
  hidden: boolean
  onSelect: (entry: MockEntry, origin?: CardOrigin) => void
}) {
  const { net } = useBoardScope()
  const latest = entry.comments[entry.comments.length - 1]
  const tint = tintFor(entry)
  return (
    <button
      type="button"
      data-brn-rail={entry.id}
      onClick={() => onSelect(entry, rectOrigin(measureRailCard(entry.id)))}
      className={`block w-full text-left rounded-xl overflow-hidden transition-shadow hover:shadow-md ${
        hidden ? 'invisible' : ''
      }`}
    >
      <div className={`p-1 ${tint.shell}`}>
        <div className="rounded-lg bg-themewhite px-3 py-1.5 shadow-sm min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[11pt] leading-tight font-mono font-bold tracking-wide text-primary truncate">{entry.brn}</span>
            <span className="text-[8pt] font-mono text-tertiary shrink-0">In {fmtTime(entry.checkedInAt)}</span>
          </div>
          <p className="mt-0.5 text-[8.5pt] text-tertiary truncate">
            <span className="font-mono font-medium">{originUic(net.clusters, entry)}</span>
            {latest && <span className="text-secondary"> · {latest.text}</span>}
          </p>
        </div>
        <div className={`flex items-center justify-between gap-2 px-2 pt-1 text-[7.5pt] font-semibold uppercase tracking-wider ${tint.foot}`}>
          <span className="truncate">{entry.transit
            ? `→ ${destinationLabel(net, entry.transit.to)}`
            : entry.comments.length > 0 ? `${entry.comments.length} comment${entry.comments.length > 1 ? 's' : ''}` : ''}</span>
          <span className="font-mono shrink-0">{entry.transit ? `En route ${fmtTime(entry.transit.at)}` : `Since ${fmtDateTime(sinceAt(entry))}`}</span>
        </div>
      </div>
    </button>
  )
}

/** "Move to" targets — Unassigned, then every station the origin's chain shows
 *  (Role I → Role III), minus the BRN's current spot. One cluster = flat list;
 *  several = a submenu per cluster. */
export function trackingMoveItems(e: MockEntry, onMove: (entry: MockEntry, to: TrackingPosition) => void, net: TrackingNetwork): ContextMenuItem[] {
  const at = positionOf(e)
  const placeItems = (g: BoardGroupDef): ContextMenuItem[] => groupPlaces(g)
    .filter(pl => !samePlace(pl.pos, at))
    .map(pl => ({ key: placeKey(pl.pos), label: pl.label, icon: ArrowRight, onAction: () => onMove(e, pl.pos) }))
  const unassigned: ContextMenuItem[] = at ? [{ key: 'unassigned', label: 'Unassigned', icon: ArrowRight, onAction: () => onMove(e, null) }] : []
  const groups = moveTargets(net, e)
  if (groups.length === 1) return [...unassigned, ...placeItems(groups[0])]
  return [...unassigned, ...groups.map(g => ({ key: groupKey(g), label: groupLabel(g), icon: ArrowRightLeft, submenu: placeItems(g) }))]
}

/** "Send to" destinations — every station the origin's chain shows, minus where
 *  the BRN sits / is already headed. Submenu per cluster when there are several. */
export function trackingTransitItems(e: MockEntry, onTransit: (entry: MockEntry, to: LinkedFeatureRef | null) => void, net: TrackingNetwork): ContextMenuItem[] {
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
export function buildTrackingMenuItems(e: MockEntry, h: {
  onOpen?: (entry: MockEntry) => void
  onEdit: (entry: MockEntry) => void
  onMove: (entry: MockEntry, to: TrackingPosition) => void
  /** Set (or clear, null) the "leaving → destination station" marker. */
  onTransit: (entry: MockEntry, to: LinkedFeatureRef | null) => void
  onForward: (entry: MockEntry) => void
  onDelete: (entry: MockEntry) => void
  net: TrackingNetwork
}): ContextMenuItem[] {
  const t = e.transit
  const sendTo = trackingTransitItems(e, h.onTransit, h.net)
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
    { key: 'forward', label: 'Forward', icon: Forward, onAction: () => h.onForward(e) },
    { key: 'delete', label: 'Delete', icon: Trash2, destructive: true, onAction: () => h.onDelete(e) },
  ]
}

/**
 * BRN cards with the chat gesture set (SwipeActionRow): tap opens, long-press /
 * right-click lifts the card into the LiftedRowMenu (Open / Move to… / Forward /
 * Delete); swipe left/right fire the user's Tracking swipe bindings (same four,
 * picked in board settings via Messaging's picker).
 */
export function TrackingCardList({ entries, onSelect, onEdit, onMove, onTransit, onForward, onDelete, expandedId }: CardListProps) {
  const { net } = useBoardScope()
  const swipe = useTrackingSwipeActions()
  // mode 'all' = long-press menu; 'move' = swipe-bound Move, straight to the places.
  const [menu, setMenu] = useState<{ entry: MockEntry; rect: DOMRect; mode: 'all' | 'move' } | null>(null)
  const [pendingDelete, setPendingDelete] = useState<MockEntry | null>(null)

  const moveItems = (e: MockEntry) => trackingMoveItems(e, onMove, net)
  // Open / Edit from the lifted menu grow out of the lifted clone (still mounted
  // when onAction fires); tap / swipe-open grow out of the rest card.
  const open = (e: MockEntry) => onSelect(e, originFor(e.id))
  const edit = (e: MockEntry) => onEdit(e, originFor(e.id))
  const menuItems = (e: MockEntry) => buildTrackingMenuItems(e, { onOpen: open, onEdit: edit, onMove, onTransit, onForward, onDelete: setPendingDelete, net })

  const fire = (b: TrackingSwipeBinding, e: MockEntry, rect: DOMRect) => {
    if (b === 'open') open(e)
    else if (b === 'move') setMenu({ entry: e, rect, mode: 'move' })
    else if (b === 'forward') onForward(e)
    else if (b === 'delete') setPendingDelete(e)
  }

  const sideFor = (b: TrackingSwipeBinding, e: MockEntry): SwipeSide | null => {
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
            onClick={() => open(e)}
            onLongPress={rect => setMenu({ entry: e, rect, mode: 'all' })}
          >
            <BrnCard entry={e} />
          </SwipeActionRow>
        </div>
      ))}
      <LiftedRowMenu
        isOpen={!!menu}
        anchorRect={menu?.rect ?? null}
        row={menu && <div className="rounded-2xl bg-themewhite2 overflow-hidden"><BrnCard entry={menu.entry} /></div>}
        items={menu ? (menu.mode === 'move' ? moveItems(menu.entry) : menuItems(menu.entry)) : []}
        header={menu?.mode === 'move' ? 'Move to' : undefined}
        onClose={() => setMenu(null)}
        layout="list"
      />
      <ConfirmDialog
        visible={!!pendingDelete}
        title={`Remove ${pendingDelete?.brn ?? ''} from the board?`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => { if (pendingDelete) onDelete(pendingDelete); setPendingDelete(null) }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}

// ── Detail ──

/** Comments — read-only thread in the detail (Calendar "Notes" idiom). All
 *  writes (add / change / remove) go through the form: check-in or ellipsis Edit. */
function TrackingComments({ entry }: { entry: MockEntry }) {
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
function CommentMeta({ comment }: { comment: MockComment }) {
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

/** Draft the drawer owns — the Save pill lives in the surface header. */
export interface TrackingEditDraft {
  brn: string
  /** Existing comments by id; cleared text = removed on save. */
  comments: { id: string; text: string }[]
  /** New comment appended on save (blank = none). */
  newComment: string
}

export const emptyDraft = (): TrackingEditDraft => ({ brn: '', comments: [], newComment: '' })

export const draftFromEntry = (e: MockEntry): TrackingEditDraft => ({
  brn: e.brn,
  comments: e.comments.map(c => ({ id: c.id, text: c.text })),
  newComment: '',
})

export const draftIsValid = (d: TrackingEditDraft) => BRN_PATTERN.test(d.brn)

/** Apply a saved draft — last-write-wins over the whole entry. */
export function applyDraft(e: MockEntry, d: TrackingEditDraft, by: string, at: number): MockEntry {
  const byId = new Map(d.comments.map(c => [c.id, c.text.trim()]))
  const added = d.newComment.trim()
  return {
    ...e,
    brn: d.brn,
    comments: [
      ...e.comments
        .filter(c => byId.get(c.id))
        .map(c => {
          const text = byId.get(c.id)!
          return text === c.text ? c : { ...c, text, editedAt: at, editedBy: by }
        }),
      ...(added ? [{ id: `c-${at}`, text: added, by, at }] : []),
    ],
  }
}

const commentAreaClass = 'w-full bg-transparent px-4 pt-1 pb-2.5 text-base md:text-[10pt] text-primary placeholder:text-tertiary focus:outline-none resize-none'

/** BRN + comments. `entry` omitted = check-in (new BRN, focus the pin cells). */
export function TrackingEditForm({ entry, draft, onChange }: {
  entry?: MockEntry
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

export function TrackingBoardDetail({ entry, now }: { entry: MockEntry; now: number }) {
  const { net } = useBoardScope()
  const clusterName = (id: string) => clusterById(net.clusters, id)?.label ?? id
  const where = (p: TrackingPosition) => placeOwnerLabel(net, p) || undefined
  return (
    <div className="space-y-4">
      <SectionCard>
        <div className="px-4 py-3">
          <p className="text-[9pt] text-tertiary">Current location</p>
          <p className="text-[10pt] font-semibold text-primary">{placeLabel(net, positionOf(entry))}</p>
          <p className="text-[9pt] text-tertiary tabular-nums">{dwellMin(entry, now)}m · since {fmtTime(sinceAt(entry))}</p>
          {entry.transit && (
            <p className="mt-1 text-[9pt] font-semibold text-themeblue3">
              En route → {destinationLabel(net, entry.transit.to)} · {fmtTime(entry.transit.at)} · {entry.transit.by}
            </p>
          )}
        </div>
      </SectionCard>

      {/* One journey across the chain — every step names its cluster. */}
      <CardLabel label="History">
        <SectionCard>
          {[...entry.moves].reverse().map(m => (
            <ListItemRow
              key={m.id}
              as="div"
              className="px-4 py-2.5 border-b border-primary/5"
              center={
                <div className="min-w-0">
                  <p className="text-[10pt] text-primary truncate">{stationLabel(net, m.to)}</p>
                  <p className="text-[9pt] text-tertiary truncate">{where(m.to)}</p>
                </div>
              }
              right={<span className="text-[9pt] font-mono text-tertiary shrink-0">{fmtDateTime(m.at)}</span>}
            />
          ))}
          <ListItemRow
            as="div"
            className="px-4 py-2.5"
            center={
              <div className="min-w-0">
                <p className="text-[10pt] text-primary truncate">Checked in</p>
                <p className="text-[9pt] text-tertiary truncate">{clusterName(entry.originClinicId)}</p>
              </div>
            }
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
  /** SKELETON: switch the viewing cluster to demo echelon visibility. Goes away
   *  with real data (viewer = the member's own cluster). */
  onViewerChange?: (clusterId: string) => void
  /** Show / hide a known station on this cluster's board (writes the pin's
   *  tracking_clinic_ids). Stations themselves are made / renamed / removed on
   *  the map ("Add to tracking board" on a pin). */
  onTogglePlace?: (ref: LinkedFeatureRef) => void
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
                  left={
                    <span className="w-9 h-9 rounded-full bg-themewhite2 flex items-center justify-center text-themeblue3 shrink-0">
                      <MapPin size={15} />
                    </span>
                  }
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

      {h.onViewerChange && (
        <section>
          <PageSectionHeader>Viewing as (mock)</PageSectionHeader>
          <SectionCard>
            {[...net.clusters].sort((x, y) => y.echelon - x.echelon).map(c => (
              <ListItemRow
                key={c.id}
                onClick={() => h.onViewerChange!(c.id)}
                className="px-4 py-2.5 border-b border-primary/5 last:border-b-0"
                center={
                  <div className="min-w-0">
                    <p className="text-[10pt] text-primary truncate">{c.label}</p>
                    <p className="text-[9pt] text-tertiary truncate">Role {'I'.repeat(c.echelon)} · {c.uic}</p>
                  </div>
                }
                right={c.id === viewerId && <Check size={16} className="text-themeblue3 shrink-0" />}
              />
            ))}
          </SectionCard>
        </section>
      )}
    </div>
  )
}
