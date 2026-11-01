import { useState, type ReactNode } from 'react'
import { Plus, ArrowRightLeft, ArrowRight, Eye, Forward, Trash2, Ban } from 'lucide-react'
import { ListItemRow } from '@/Components/primitives/ListItemRow'
import { PersonnelRow, PersonnelGroupBand } from '@/Components/primitives/PersonnelRow'
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
import { formatDtg } from '../../Utilities/propertyDates'

/**
 * Tracking Board — SKELETON. Patient-flow board (BRN across clinic stations).
 * Static mock data only; no store, no vault send, no actions.
 *
 * Every BRN sits in exactly one place: Unassigned (no station yet) or one
 * station. Desktop: T2T-style grid (BRN rows × location columns, Unassigned
 * first) where the current location's whole cell is the marker. Mobile: one flat
 * list grouped the same way. Move history lives in the detail, not on the board.
 *
 * Final shape: one hidden `tracking` calendar event per visit carrying
 * tracking_data { brn, station_id, moves[] }; stations from clinics.tracking_stations.
 */

// ── Mock shapes (stand-ins for tracking_data / tracking_stations) ──

export interface MockStation {
  id: string
  label: string
  warnMin?: number
}

interface MockMove {
  to: string
  at: number // epoch ms
}

export interface MockEntry {
  id: string
  brn: string
  /** UIC of the cluster that checked the patient in (row subtitle). */
  uic: string
  checkedInAt: number
  /** Empty = Unassigned. */
  moves: MockMove[]
}

export const STATIONS: MockStation[] = [
  { id: 'checkin', label: 'Check-in', warnMin: 15 },
  { id: 'triage', label: 'Triage', warnMin: 20 },
  { id: 'role1', label: 'Role 1', warnMin: 45 },
  { id: 'role2', label: 'Role 2', warnMin: 60 },
  { id: 'role3', label: 'Role 3', warnMin: 60 },
  { id: 'dispo', label: 'Dispo' },
]

const MIN = 60 * 1000

/** Mock entries anchored to "now" so dwell timers read sensibly any time of day. */
export function buildMockEntries(now: number): MockEntry[] {
  const ago = (m: number) => now - m * MIN
  return [
    { id: 'e1', brn: 'AB1234', uic: 'WAB1C0', checkedInAt: ago(3), moves: [] },
    { id: 'e7', brn: 'NP1357', uic: 'WCD2E0', checkedInAt: ago(9), moves: [] },
    { id: 'e2', brn: 'CD5678', uic: 'WAB1C0', checkedInAt: ago(125), moves: [{ to: 'checkin', at: ago(120) }, { to: 'triage', at: ago(100) }, { to: 'role1', at: ago(80) }, { to: 'role2', at: ago(55) }] },
    { id: 'e3', brn: 'EF9012', uic: 'WFG3H0', checkedInAt: ago(72), moves: [{ to: 'checkin', at: ago(70) }, { to: 'triage', at: ago(60) }, { to: 'role1', at: ago(35) }] },
    { id: 'e4', brn: 'GH3456', uic: 'WCD2E0', checkedInAt: ago(41), moves: [{ to: 'checkin', at: ago(40) }, { to: 'triage', at: ago(28) }] },
    { id: 'e5', brn: 'JK7890', uic: 'WAB1C0', checkedInAt: ago(23), moves: [{ to: 'checkin', at: ago(22) }] },
    { id: 'e6', brn: 'LM2468', uic: 'WFG3H0', checkedInAt: ago(7), moves: [{ to: 'checkin', at: ago(6) }] },
  ]
}

// ── Helpers ──

const stationLabel = (id: string | null) => (id ? STATIONS.find(s => s.id === id)?.label ?? id : 'Unassigned')
const lastMove = (e: MockEntry) => e.moves[e.moves.length - 1] as MockMove | undefined
export const stationOf = (e: MockEntry): string | null => lastMove(e)?.to ?? null
const sinceAt = (e: MockEntry) => lastMove(e)?.at ?? e.checkedInAt
const dwellMin = (e: MockEntry, now: number) => Math.max(0, Math.round((now - sinceAt(e)) / MIN))
const fmtTime = (ms: number) =>
  new Date(ms).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }).replace(':', '')
/** Military date-time — 31OCT26 1423. */
const fmtDateTime = (ms: number) => `${formatDtg(new Date(ms).toISOString())} ${fmtTime(ms)}`

export const filterEntries = (entries: MockEntry[], query: string) => {
  const q = query.trim().toUpperCase()
  return q ? entries.filter(e => e.brn.includes(q)) : entries
}

// ── Row (rail + mobile list) — PersonnelRow, no avatar: BRN over cluster UIC ──

interface BrnRowProps {
  entry: MockEntry
  active: boolean
  onSelect: (entry: MockEntry) => void
}

export function BrnRow({ entry, active, onSelect }: BrnRowProps) {
  return (
    <PersonnelRow
      avatar={null}
      name={entry.brn}
      sub={entry.uic || undefined}
      selected={active}
      onClick={() => onSelect(entry)}
    />
  )
}

interface ListProps {
  entries: MockEntry[]
  now: number
  activeId: string | null
  onSelect: (entry: MockEntry) => void
}

// ── Desktop: main-pane overview grid (T2T idiom — BRN rows × location columns) ──

/** Unassigned leads, then the stations in order. */
const GRID_COLUMNS: { id: string | null; label: string }[] = [
  { id: null, label: 'Unassigned' },
  ...STATIONS.map(s => ({ id: s.id as string | null, label: s.label })),
]

const BRN_COL_WIDTH = 140
const CELL_MIN_WIDTH = 110
const ROW_HEIGHT = 36

export function TrackingGrid({ entries, activeId, onSelect }: ListProps) {
  const cols = `${BRN_COL_WIDTH}px repeat(${GRID_COLUMNS.length}, minmax(${CELL_MIN_WIDTH}px, 1fr))`
  return (
    <div className="h-full overflow-auto bg-themewhite">
      <div className="min-w-max pb-8">
        {/* Column header — sticky, like the T2T time header */}
        <div className="sticky top-0 z-10 grid bg-themewhite border-b border-primary/10" style={{ gridTemplateColumns: cols }}>
          <div className="sticky left-0 z-20 flex items-center px-2 py-1.5 border-r border-primary/10 bg-themewhite">
            <span className="text-[9pt] font-semibold uppercase tracking-wider text-tertiary">BRN</span>
          </div>
          {GRID_COLUMNS.map(c => (
            <div key={c.id ?? 'unassigned'} className="flex items-center gap-1.5 px-2 py-1.5 border-l border-l-primary/10">
              <span className="text-[9pt] font-semibold uppercase tracking-wider text-tertiary truncate flex-1">{c.label}</span>
            </div>
          ))}
        </div>

        {/* BRN rows — the current location's whole cell is the marker */}
        {entries.map(e => {
          const at = stationOf(e)
          const active = activeId === e.id
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => onSelect(e)}
              className="grid w-full text-left border-b border-primary/5"
              style={{ gridTemplateColumns: cols, height: ROW_HEIGHT }}
            >
              <div className={`sticky left-0 z-[5] flex items-center gap-2 px-2 border-r border-primary/10 ${
                active ? 'bg-themeblue3/20' : 'bg-themewhite'
              }`}>
                <span className="text-[10pt] font-mono font-medium text-primary truncate flex-1">{e.brn}</span>
              </div>
              {GRID_COLUMNS.map(c => (
                <div
                  key={c.id ?? 'unassigned'}
                  className={`flex items-center px-2 border-l border-l-primary/5 ${
                    c.id === at ? 'bg-themeblue3/15' : ''
                  }`}
                >
                  {c.id === at && <span className="text-[9pt] font-mono text-primary truncate">{fmtDateTime(sinceAt(e))}</span>}
                </div>
              ))}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── List grouped by place (mobile body · desktop left rail) ──
// Calendar personnel-filter idiom: collapsible PersonnelGroupBand per place,
// flush PersonnelRows under it. No counts / dwell indicators.

export function TrackingBoardList({ entries, activeId, onSelect }: ListProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const toggle = (key: string) => setCollapsed(prev => {
    const next = new Set(prev)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })
  return (
    <div className="pb-8">
      {GRID_COLUMNS.map(g => {
        const key = g.id ?? 'unassigned'
        const rows = entries.filter(e => stationOf(e) === g.id)
        const open = !collapsed.has(key)
        return (
          <div key={key}>
            <PersonnelGroupBand
              label={g.label}
              expanded={open}
              onToggle={() => toggle(key)}
            />
            {open && rows.map(e => <BrnRow key={e.id} entry={e} active={activeId === e.id} onSelect={onSelect} />)}
          </div>
        )
      })}
    </div>
  )
}

// ── Mobile: category strip + BRN cards ──

/** 'all' or a GRID_COLUMNS key ('unassigned' | station id). */
export type TrackingCategory = string
const colKey = (id: string | null) => id ?? 'unassigned'

/** Horizontal-scroll category strip: All, Unassigned, then stations. Plain
 *  text tabs; the active one alone carries a themeblue3 underline. */
export function TrackingCategoryBar({ value, onChange }: { value: TrackingCategory; onChange: (v: TrackingCategory) => void }) {
  const tabs = [{ key: 'all', label: 'All' }, ...GRID_COLUMNS.map(c => ({ key: colKey(c.id), label: c.label }))]
  return (
    <div role="tablist" aria-label="Location" className="flex gap-5 px-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
      {tabs.map(t => {
        const active = value === t.key
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={(e) => { onChange(t.key); e.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' }) }}
            className={`shrink-0 min-h-[44px] border-b-2 text-[10pt] transition-colors ${
              active ? 'border-themeblue3 text-primary font-semibold' : 'border-transparent text-tertiary font-medium'
            }`}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

export const filterByCategory = (entries: MockEntry[], cat: TrackingCategory) =>
  cat === 'all' ? entries : entries.filter(e => colKey(stationOf(e)) === cat)

interface CardListProps {
  entries: MockEntry[]
  onSelect: (entry: MockEntry) => void
  /** Move a BRN to a station (null = back to Unassigned). */
  onMove: (entry: MockEntry, stationId: string | null) => void
  /** Hand the BRN off to another member/cluster. */
  onForward: (entry: MockEntry) => void
  /** Remove the BRN from the board — called after the ConfirmDialog. */
  onDelete: (entry: MockEntry) => void
}

function CardField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[9pt] text-tertiary">{label}</span>
      <span className="text-[9pt] font-mono text-primary truncate">{children}</span>
    </div>
  )
}

/** Swipe-binding display — shared by the card reveal and the settings picker. */
export const TRACKING_SWIPE_DISPLAY: Record<TrackingSwipeBinding, SwipeBindingDisplay> = {
  open: { label: 'Open', icon: Eye, panel: 'bg-themeblue2' },
  move: { label: 'Move', icon: ArrowRightLeft, panel: 'bg-themeblue3' },
  forward: { label: 'Forward', icon: Forward, panel: 'bg-themeblue1' },
  delete: { label: 'Delete', icon: Trash2, panel: 'bg-themeredred' },
  off: { label: 'None', icon: Ban, panel: null },
}

/** Card body — rendered in the list AND as the lifted clone in the menu. */
function BrnCard({ entry }: { entry: MockEntry }) {
  return (
    <>
      <div className="px-4 pt-3 pb-1.5 min-w-0">
        <p className="text-[10pt] font-mono font-semibold text-primary truncate">{entry.brn}</p>
        {entry.uic && <p className="text-[9pt] text-tertiary truncate">{entry.uic}</p>}
      </div>
      <div className="px-4 pt-1.5 pb-3 space-y-1 border-t border-primary/5">
        <CardField label="Location">{stationLabel(stationOf(entry))}</CardField>
        <CardField label="Since">{fmtDateTime(sinceAt(entry))}</CardField>
        <CardField label="Checked in">{fmtDateTime(entry.checkedInAt)}</CardField>
      </div>
    </>
  )
}

/** "Move to" targets — every place except the BRN's current one. */
export const trackingMoveItems = (e: MockEntry, onMove: (entry: MockEntry, stationId: string | null) => void): ContextMenuItem[] =>
  GRID_COLUMNS
    .filter(c => c.id !== stationOf(e))
    .map(c => ({ key: colKey(c.id), label: c.label, icon: ArrowRight, onAction: () => onMove(e, c.id) }))

/** BRN action menu — shared by the card long-press, the mobile detail Sheet
 *  ellipsis and the desktop header ellipsis. `onOpen` omitted = already open. */
export function buildTrackingMenuItems(e: MockEntry, h: {
  onOpen?: (entry: MockEntry) => void
  onMove: (entry: MockEntry, stationId: string | null) => void
  onForward: (entry: MockEntry) => void
  onDelete: (entry: MockEntry) => void
}): ContextMenuItem[] {
  return [
    ...(h.onOpen ? [{ key: 'open', label: 'Open', icon: Eye, onAction: () => h.onOpen!(e) }] : []),
    { key: 'move', label: 'Move to…', icon: ArrowRightLeft, submenu: trackingMoveItems(e, h.onMove) },
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
export function TrackingCardList({ entries, onSelect, onMove, onForward, onDelete }: CardListProps) {
  const swipe = useTrackingSwipeActions()
  // mode 'all' = long-press menu; 'move' = swipe-bound Move, straight to the stations.
  const [menu, setMenu] = useState<{ entry: MockEntry; rect: DOMRect; mode: 'all' | 'move' } | null>(null)
  const [pendingDelete, setPendingDelete] = useState<MockEntry | null>(null)

  const moveItems = (e: MockEntry) => trackingMoveItems(e, onMove)
  const menuItems = (e: MockEntry) => buildTrackingMenuItems(e, { onOpen: onSelect, onMove, onForward, onDelete: setPendingDelete })

  const fire = (b: TrackingSwipeBinding, e: MockEntry, rect: DOMRect) => {
    if (b === 'open') onSelect(e)
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
        <SwipeActionRow
          key={e.id}
          className="rounded-2xl"
          ltr={sideFor(swipe.ltr, e)}
          rtl={sideFor(swipe.rtl, e)}
          onClick={() => onSelect(e)}
          onLongPress={rect => setMenu({ entry: e, rect, mode: 'all' })}
        >
          <BrnCard entry={e} />
        </SwipeActionRow>
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

export function TrackingBoardDetail({ entry, now }: { entry: MockEntry; now: number }) {
  return (
    <div className="space-y-4">
      <SectionCard>
        <div className="px-4 py-3">
          <p className="text-[9pt] text-tertiary">Current location</p>
          <p className="text-[10pt] font-semibold text-primary">{stationLabel(stationOf(entry))}</p>
          <p className="text-[9pt] text-tertiary tabular-nums">{dwellMin(entry, now)}m · since {fmtTime(sinceAt(entry))}</p>
        </div>
      </SectionCard>

      <CardLabel label="History">
        <SectionCard>
          {[...entry.moves].reverse().map((m, i) => (
            <ListItemRow
              key={i}
              as="div"
              className="px-4 py-2.5 border-b border-primary/5"
              center={<p className="text-[10pt] text-primary truncate">{stationLabel(m.to)}</p>}
              right={<span className="text-[9pt] font-mono text-tertiary shrink-0">{fmtTime(m.at)}</span>}
            />
          ))}
          <ListItemRow
            as="div"
            className="px-4 py-2.5"
            center={<p className="text-[10pt] text-primary truncate">Checked in</p>}
            right={<span className="text-[9pt] font-mono text-tertiary shrink-0">{fmtTime(entry.checkedInAt)}</span>}
          />
        </SectionCard>
      </CardLabel>
    </div>
  )
}

// ── Check-in (header popover) — BRN pin cells (UIC style) + circular + button ──

export function TrackingCheckIn({ onCheckIn }: { onCheckIn: (brn: string) => void }) {
  const [brn, setBrn] = useState('')
  const valid = BRN_PATTERN.test(brn)
  const submit = () => {
    if (!valid) return
    onCheckIn(brn)
    setBrn('')
  }
  return (
    <div className="px-5 py-4">
      <PageSectionHeader>New BRN</PageSectionHeader>
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <SectionCard>
            <BrnPinInput value={brn} onChange={setBrn} spread autoFocus onComplete={submit} />
          </SectionCard>
        </div>
        {valid && (
          <button
            type="button"
            aria-label="Check in"
            onClick={submit}
            className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center bg-themeblue3 text-white active:scale-95 transition-all"
          >
            <Plus size={16} />
          </button>
        )}
      </div>
    </div>
  )
}

// ── Settings (mirrors Messaging settings: section header + card, in Sheet / PreviewOverlay) ──

export function TrackingBoardSettings() {
  const swipe = useTrackingSwipeActions()
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
      <section>
        <PageSectionHeader>Stations</PageSectionHeader>
        <SectionCard>
          {STATIONS.map(s => (
            <ListItemRow
              key={s.id}
              as="div"
              className="px-4 py-2.5 border-b border-primary/5 last:border-b-0"
              center={<p className="text-[10pt] text-primary truncate">{s.label}</p>}
              right={s.warnMin != null && <span className="text-[9pt] text-tertiary tabular-nums shrink-0">Warn {s.warnMin}m</span>}
            />
          ))}
        </SectionCard>
      </section>
    </div>
  )
}
