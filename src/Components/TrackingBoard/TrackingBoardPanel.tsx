import { createContext, useContext, useState, type ReactNode } from 'react'
import { UnderlineTabs } from '@/Components/primitives/UnderlineTabs'
import { ArrowRightLeft, ArrowRight, Eye, Forward, Trash2, Ban, Pencil, Check, Navigation, MapPinCheck, X, Plus, LogOut } from 'lucide-react'
import { ListItemRow } from '@/Components/primitives/ListItemRow'
import { PersonnelGroupBand } from '@/Components/primitives/PersonnelRow'
import { BrnPinInput, BRN_PATTERN } from '@/Components/DomainInputs'
import { LiftedRowMenu, AnchoredMenu } from '@/Components/primitives/LiftedRowMenu'
import { ConfirmDialog } from '@/Components/primitives/ConfirmDialog'
import type { ContextMenuItem } from '@/Components/primitives/ContextMenu'
import { SwipeActionRow, type SwipeSide } from '@/Components/primitives/SwipeActionRow'
import { SwipeBindingPicker, type SwipeBindingDisplay } from '@/Components/Settings/SwipeActionsSection'
import {
  TRACKING_SWIPE_POOL, useTrackingSwipeActions, setTrackingSwipeActions, type TrackingSwipeBinding,
} from '../../Utilities/trackingSwipeActions'
import { SectionCard, CardLabel, PageSectionHeader } from '@/Components/primitives/Section'
import { TextArea, TextInput } from '@/Components/primitives/FormInputs'
import { formatDtg } from '../../Utilities/propertyDates'
import {
  MOCK_CLUSTERS, MOCK_STATIONS, MOCK_AXPS, clusterById, positionOf, sinceAt, placeKey, samePlace, placeLabel, stationLabel,
  destinationLabel, placeOwnerLabel, originUic, moveTargets, boardLayout, boardAxps, atUnassigned, stationsOf, availableStations,
  type MockEntry, type MockComment, type TrackingPosition, type TrackingNetwork, type BoardGroupDef,
} from './trackingModel'

export { buildMockEntries, type MockEntry, type MockComment } from './trackingModel'

/**
 * Tracking Board — SKELETON. Patient-flow board (BRN across cluster stations),
 * echelon-aware. Mock data only (trackingModel.ts); no store, no vault send.
 *
 * Every BRN sits in exactly one place: a cluster station (station null =
 * Unassigned at that cluster) or an AXP (unowned exchange point, scoped to the
 * cluster it hands into; AXP columns sit just before that cluster). In transit
 * is a card marker ("→ destination"), not a place. A board shows patients ORIGINATED in the viewer's
 * cluster or below (origin + ancestors visibility), so a Role II board carries
 * its Role Is' patients and follows them up to Role III.
 * Desktop: T2T-style grid — one column group per cluster along the patient flow
 * (Role I → Role III), Unassigned + that cluster's stations under it; the
 * current place's whole cell is the marker. Rail / mobile tabs: the viewer's own
 * places one by one, every other cluster as one group.
 *
 * Final shape: one hidden `tracking` calendar event per visit carrying
 * tracking_data { brn, origin_clinic_id, moves[{ to: place }], transit?, comments[] },
 * fanned to origin + ancestors. Places (stations + members, AXPs) are plaintext
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
const BoardScopeContext = createContext<BoardScope>({ net: { clusters: MOCK_CLUSTERS, stations: MOCK_STATIONS, axps: MOCK_AXPS }, viewerId: MOCK_CLUSTERS[0].id })
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

/** A board group's places — cluster: Unassigned + the stations it lists; AXP group: each AXP. */
const groupPlaces = (g: BoardGroupDef) => g.places
const groupKey = (g: BoardGroupDef) => (g.kind === 'axps' ? `axps:${g.scope.id}` : `cluster:${g.cluster.id}`)
const groupLabel = (g: BoardGroupDef) => (g.kind === 'axps' ? `AXPs → ${g.scope.label}` : g.cluster.label)

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
  // Column groups along the patient flow (Role I → Role III); a cluster's AXPs sit just before it.
  const groups = boardLayout(net, viewerId, entries).map(g => ({ def: g, places: groupPlaces(g) }))
  const columns = groups.flatMap(g => g.places.map((pl, i) => ({ ...pl, first: i === 0 })))
  const cols = `${BRN_COL_WIDTH}px repeat(${columns.length}, minmax(${CELL_MIN_WIDTH}px, 1fr))`
  return (
    <div className="h-full overflow-auto bg-themewhite">
      <div className="min-w-max pb-8">
        {/* Column header — sticky, like the T2T time header: cluster band over its places */}
        <div className="sticky top-0 z-10 grid bg-themewhite border-b border-primary/10" style={{ gridTemplateColumns: cols }}>
          <div className="sticky left-0 z-20 row-span-2 flex items-end px-2 py-1.5 border-r border-primary/10 bg-themewhite">
            <span className="text-[9pt] font-semibold uppercase tracking-wider text-tertiary">BRN</span>
          </div>
          {groups.map(g => (
            <div
              key={groupKey(g.def)}
              className="flex items-center px-2 pt-1.5 border-l border-l-primary/10"
              style={{ gridColumn: `span ${g.places.length}` }}
            >
              <span className={`text-[9pt] font-semibold truncate ${g.def.kind === 'cluster' && g.def.cluster.id === viewerId ? 'text-primary' : 'text-secondary'}`}>{groupLabel(g.def)}</span>
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
// The viewer's own cluster splits into its places (Unassigned + stations);
// every other cluster / AXP group on the board is ONE group (the card footer names the place).

/** 'all', a place key (own cluster), `cluster:<id>` or `axps:<scope id>`. */
export type TrackingCategory = string

interface BoardGroup {
  key: TrackingCategory
  label: string
  match: (e: MockEntry) => boolean
}

function boardGroups(net: TrackingNetwork, viewerId: string, entries: MockEntry[]): BoardGroup[] {
  const out: BoardGroup[] = []
  for (const g of boardLayout(net, viewerId, entries)) {
    if (g.kind === 'cluster' && g.cluster.id === viewerId) {
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
  /** Move a BRN to a place in its origin's chain (station null = Unassigned there). */
  onMove: (entry: MockEntry, to: TrackingPosition) => void
  /** Set / clear the "leaving → destination" marker. */
  onTransit: (entry: MockEntry, to: TrackingPosition | null) => void
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

/** Station shell tints, by station-id hash — the card sits
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
const AXP_TINT = { shell: 'bg-themeblue3/20', foot: 'text-themeblue3' }
export function tintFor(e: MockEntry) {
  const p = positionOf(e)
  if (p.kind === 'axp') return AXP_TINT
  if (p.kind === 'unassigned') return UNASSIGNED_TINT
  // Hash of the station id — stable on every device and board, no lookup, and a
  // station added later gets a color too.
  let h = 0
  for (const ch of p.stationId) h = (h * 31 + ch.charCodeAt(0)) | 0
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

/** "Move to" targets — every place in the origin's chain (Role I → Role III,
 *  each cluster's AXPs just before it) except the BRN's current one. One group
 *  = flat list; several = a submenu per group. */
export function trackingMoveItems(e: MockEntry, onMove: (entry: MockEntry, to: TrackingPosition) => void, net: TrackingNetwork): ContextMenuItem[] {
  const at = positionOf(e)
  const placeItems = (g: BoardGroupDef): ContextMenuItem[] => groupPlaces(g)
    .filter(pl => !samePlace(pl.pos, at))
    .map(pl => ({ key: placeKey(pl.pos), label: pl.label, icon: ArrowRight, onAction: () => onMove(e, pl.pos) }))
  const groups = moveTargets(net, e)
  if (groups.length === 1) return placeItems(groups[0])
  return groups.map(g => ({ key: groupKey(g), label: groupLabel(g), icon: ArrowRightLeft, submenu: placeItems(g) }))
}

/** "Send to" destinations — every cluster in the origin's chain (lands in its
 *  Unassigned) and every AXP into one, minus where the BRN sits / is headed. */
export function trackingTransitItems(e: MockEntry, onTransit: (entry: MockEntry, to: TrackingPosition | null) => void, net: TrackingNetwork): ContextMenuItem[] {
  const at = positionOf(e)
  const items: ContextMenuItem[] = []
  for (const g of moveTargets(net, e)) {
    const dest = g.kind === 'axps' ? g.places : [{ pos: atUnassigned(g.cluster.id), label: g.cluster.label }]
    for (const d of dest) {
      if (samePlace(d.pos, at) || (e.transit && samePlace(d.pos, e.transit.to))) continue
      items.push({ key: placeKey(d.pos), label: d.label, icon: Navigation, onAction: () => onTransit(e, d.pos) })
    }
  }
  return items
}

/** BRN action menu — shared by the card long-press, the mobile detail Sheet
 *  ellipsis and the desktop header ellipsis. `onOpen` omitted = already open. */
export function buildTrackingMenuItems(e: MockEntry, h: {
  onOpen?: (entry: MockEntry) => void
  onEdit: (entry: MockEntry) => void
  onMove: (entry: MockEntry, to: TrackingPosition) => void
  /** Set (or clear, null) the "leaving → destination" marker. */
  onTransit: (entry: MockEntry, to: TrackingPosition | null) => void
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
  // mode 'all' = long-press menu; 'move' = swipe-bound Move, straight to the stations.
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
  const where = (p: TrackingPosition) => placeOwnerLabel(net, p)
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

const ROUND_BTN = 'w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-all shrink-0'

/** Inline add — primitive TextInput + circular + (shown once there's text). */
function PlaceAddRow({ placeholder, ariaLabel, onAdd }: { placeholder: string; ariaLabel: string; onAdd: (label: string) => void }) {
  const [draft, setDraft] = useState('')
  const add = () => {
    const label = draft.trim()
    if (!label) return
    onAdd(label)
    setDraft('')
  }
  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <div className="flex-1 min-w-0">
        <TextInput value={draft} onChange={setDraft} placeholder={placeholder} maxLength={40} ariaLabel={ariaLabel} />
      </div>
      {draft.trim() && (
        <button type="button" aria-label={ariaLabel} onClick={add} className={`${ROUND_BTN} bg-themeblue3 text-white`}>
          <Plus size={16} />
        </button>
      )}
    </div>
  )
}

/** Rename form — the row swapped for an input after menu → Rename (never tap-to-edit). */
function PlaceRenameRow({ label, onChange, onCancel, onSave }: {
  label: string
  onChange: (label: string) => void
  onCancel: () => void
  onSave: () => void
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-primary/5">
      <div className="flex-1 min-w-0">
        <TextInput value={label} onChange={onChange} maxLength={40} ariaLabel="Name" autoFocus />
      </div>
      <button type="button" aria-label="Cancel rename" onClick={onCancel} className={`${ROUND_BTN} bg-themegray1/40 text-secondary`}>
        <X size={16} />
      </button>
      {label.trim() && (
        <button type="button" aria-label="Save name" onClick={onSave} className={`${ROUND_BTN} bg-themeblue3 text-white`}>
          <Check size={16} />
        </button>
      )}
    </div>
  )
}

/** Tappable place row (opens the row menu, anchored to the row). */
function PlaceRow({ id, title, sub, onOpen }: { id: string; title: string; sub?: string; onOpen?: (rect: DOMRect) => void }) {
  return (
    <div data-place-row={id}>
      <ListItemRow
        as={onOpen ? 'button' : 'div'}
        onClick={onOpen ? () => {
          const rect = document.querySelector<HTMLElement>(`[data-place-row="${CSS.escape(id)}"]`)?.getBoundingClientRect()
          if (rect) onOpen(rect)
        } : undefined}
        className="px-4 py-2.5 border-b border-primary/5"
        center={
          <div className="min-w-0">
            <p className="text-[10pt] text-primary truncate">{title}</p>
            {sub && <p className="text-[9pt] text-tertiary truncate">{sub}</p>}
          </div>
        }
      />
    </div>
  )
}

type PlaceKind = 'station' | 'axp'

export interface TrackingSettingsHandlers {
  /** SKELETON: switch the viewing cluster to demo echelon visibility. Goes away
   *  with real data (viewer = the member's own cluster). */
  onViewerChange?: (clusterId: string) => void
  /** Stations — the creating cluster adds / renames / removes its own. A removed
   *  station's patients read as Unassigned (boardEntries → resolvePlaces). */
  onAddStation?: (label: string) => void
  onRenameStation?: (id: string, label: string) => void
  onRemoveStation?: (id: string) => void
  /** Use a station another related cluster made (same physical place, no duplicate). */
  onOptIn?: (stationId: string) => void
  /** Stop using an opted-in station (the creator can't leave its own). */
  onLeave?: (stationId: string) => void
  /** AXPs — unowned: anyone who sees one adds / renames / removes it. New ones
   *  hand into the viewer's parent (or the viewer at the top). */
  onAddAxp?: (label: string) => void
  onRenameAxp?: (id: string, label: string) => void
  onRemoveAxp?: (id: string) => void
}

export function TrackingBoardSettings(h: TrackingSettingsHandlers) {
  const { net, viewerId } = useBoardScope()
  const swipe = useTrackingSwipeActions()
  const used = stationsOf(net, viewerId)
  const available = availableStations(net, viewerId)
  const axps = boardAxps(net, viewerId)
  const clusterName = (id: string) => clusterById(net.clusters, id)?.label ?? ''

  // One row menu / rename / remove-confirm across stations and AXPs.
  const [menu, setMenu] = useState<{ kind: PlaceKind; id: string; rect: DOMRect } | null>(null)
  const [renaming, setRenaming] = useState<{ kind: PlaceKind; id: string; label: string } | null>(null)
  const [pendingRemove, setPendingRemove] = useState<{ kind: PlaceKind; id: string; label: string } | null>(null)

  const labelOf = (kind: PlaceKind, id: string) =>
    (kind === 'axp' ? axps.find(a => a.id === id)?.label : net.stations.find(s => s.id === id)?.label) ?? ''

  const saveRename = () => {
    const label = renaming?.label.trim()
    if (renaming && label) (renaming.kind === 'axp' ? h.onRenameAxp : h.onRenameStation)?.(renaming.id, label)
    setRenaming(null)
  }

  const menuItems = (): ContextMenuItem[] => {
    if (!menu) return []
    const { kind, id } = menu
    const close = () => setMenu(null)
    const own = kind === 'axp' || net.stations.find(s => s.id === id)?.createdByClinicId === viewerId
    if (!own) {
      return h.onLeave ? [{ key: 'leave', label: 'Stop using', icon: LogOut, destructive: true, onAction: () => { h.onLeave!(id); close() } }] : []
    }
    const rename = kind === 'axp' ? h.onRenameAxp : h.onRenameStation
    const remove = kind === 'axp' ? h.onRemoveAxp : h.onRemoveStation
    return [
      ...(rename ? [{ key: 'rename', label: 'Rename', icon: Pencil, onAction: () => { setRenaming({ kind, id, label: labelOf(kind, id) }); close() } }] : []),
      ...(remove ? [{ key: 'remove', label: 'Remove', icon: Trash2, destructive: true, onAction: () => { setPendingRemove({ kind, id, label: labelOf(kind, id) }); close() } }] : []),
    ]
  }

  const openMenu = (kind: PlaceKind, id: string) => (rect: DOMRect) => setMenu({ kind, id, rect })
  const renameRow = (kind: PlaceKind, id: string) => renaming?.kind === kind && renaming.id === id && (
    <PlaceRenameRow
      key={id}
      label={renaming.label}
      onChange={label => setRenaming({ kind, id, label })}
      onCancel={() => setRenaming(null)}
      onSave={saveRename}
    />
  )

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

      {/* Stations this cluster uses — its own plus ones opted in to (same place,
          no duplicate). Own: Rename / Remove. Opted in: Stop using. */}
      <section>
        <PageSectionHeader>Stations</PageSectionHeader>
        <SectionCard>
          {used.map(st => {
            const mine = st.createdByClinicId === viewerId
            const others = st.memberClinicIds.filter(id => id !== viewerId).map(clusterName)
            const sub = mine ? (others.length > 0 ? `Shared with ${others.join(', ')}` : undefined) : `From ${clusterName(st.createdByClinicId)}`
            const canAct = mine ? !!(h.onRenameStation || h.onRemoveStation) : !!h.onLeave
            return renameRow('station', st.id) || (
              <PlaceRow key={st.id} id={st.id} title={st.label} sub={sub} onOpen={canAct ? openMenu('station', st.id) : undefined} />
            )
          })}
          {h.onAddStation && <PlaceAddRow placeholder="Add a station" ariaLabel="Add station" onAdd={h.onAddStation} />}
        </SectionCard>
      </section>

      {/* Stations related clusters made — opt in to use the same place. */}
      {h.onOptIn && available.length > 0 && (
        <section>
          <PageSectionHeader>Available stations</PageSectionHeader>
          <SectionCard>
            {available.map(st => (
              <ListItemRow
                key={st.id}
                as="div"
                className="px-4 py-2 border-b border-primary/5 last:border-b-0"
                center={
                  <div className="min-w-0">
                    <p className="text-[10pt] text-primary truncate">{st.label}</p>
                    <p className="text-[9pt] text-tertiary truncate">From {clusterName(st.createdByClinicId)}</p>
                  </div>
                }
                right={
                  <button type="button" aria-label={`Use ${st.label}`} onClick={() => h.onOptIn!(st.id)} className={`${ROUND_BTN} bg-themeblue3 text-white`}>
                    <Plus size={16} />
                  </button>
                }
              />
            ))}
          </SectionCard>
        </section>
      )}

      {/* AXPs — unowned exchange points into a cluster; anyone who sees one edits it. */}
      <section>
        <PageSectionHeader>Exchange points</PageSectionHeader>
        <SectionCard>
          {axps.map(a => renameRow('axp', a.id) || (
            <PlaceRow
              key={a.id}
              id={a.id}
              title={a.label}
              sub={`Into ${clusterName(a.scopeClinicId)}`}
              onOpen={h.onRenameAxp || h.onRemoveAxp ? openMenu('axp', a.id) : undefined}
            />
          ))}
          {h.onAddAxp && <PlaceAddRow placeholder="Add an AXP" ariaLabel="Add AXP" onAdd={h.onAddAxp} />}
        </SectionCard>
      </section>

      <AnchoredMenu
        isOpen={!!menu}
        anchorRect={menu?.rect ?? null}
        onClose={() => setMenu(null)}
        layout="list"
        align="right"
        items={menuItems()}
      />
      <ConfirmDialog
        visible={!!pendingRemove}
        title={`Remove ${pendingRemove?.label ?? ''}?`}
        subtitle="Patients there move to Unassigned."
        confirmLabel="Remove"
        variant="danger"
        onConfirm={() => {
          const r = pendingRemove
          setPendingRemove(null)
          if (r) (r.kind === 'axp' ? h.onRemoveAxp : h.onRemoveStation)?.(r.id)
        }}
        onCancel={() => setPendingRemove(null)}
      />

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
