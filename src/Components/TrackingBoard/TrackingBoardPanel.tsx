import { Check } from 'lucide-react'
import { ListItemRow } from '@/Components/primitives/ListItemRow'
import { ListGroupLabel, SectionCard, CardLabel, PageSectionHeader } from '@/Components/primitives/Section'
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
    { id: 'e1', brn: 'AB1234', checkedInAt: ago(3), moves: [] },
    { id: 'e7', brn: 'NP1357', checkedInAt: ago(9), moves: [] },
    { id: 'e2', brn: 'CD5678', checkedInAt: ago(125), moves: [{ to: 'checkin', at: ago(120) }, { to: 'triage', at: ago(100) }, { to: 'role1', at: ago(80) }, { to: 'role2', at: ago(55) }] },
    { id: 'e3', brn: 'EF9012', checkedInAt: ago(72), moves: [{ to: 'checkin', at: ago(70) }, { to: 'triage', at: ago(60) }, { to: 'role1', at: ago(35) }] },
    { id: 'e4', brn: 'GH3456', checkedInAt: ago(41), moves: [{ to: 'checkin', at: ago(40) }, { to: 'triage', at: ago(28) }] },
    { id: 'e5', brn: 'JK7890', checkedInAt: ago(23), moves: [{ to: 'checkin', at: ago(22) }] },
    { id: 'e6', brn: 'LM2468', checkedInAt: ago(7), moves: [{ to: 'checkin', at: ago(6) }] },
  ]
}

// ── Helpers ──

const stationLabel = (id: string | null) => (id ? STATIONS.find(s => s.id === id)?.label ?? id : 'Unassigned')
const lastMove = (e: MockEntry) => e.moves[e.moves.length - 1] as MockMove | undefined
export const stationOf = (e: MockEntry): string | null => lastMove(e)?.to ?? null
const sinceAt = (e: MockEntry) => lastMove(e)?.at ?? e.checkedInAt
const dwellMin = (e: MockEntry, now: number) => Math.max(0, Math.round((now - sinceAt(e)) / MIN))
const isWarn = (e: MockEntry, now: number) => {
  const warn = STATIONS.find(s => s.id === stationOf(e))?.warnMin
  return warn != null && dwellMin(e, now) >= warn
}
const fmtTime = (ms: number) =>
  new Date(ms).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }).replace(':', '')
/** Military date-time — 31OCT26 1423. */
const fmtDateTime = (ms: number) => `${formatDtg(new Date(ms).toISOString())} ${fmtTime(ms)}`

export const filterEntries = (entries: MockEntry[], query: string) => {
  const q = query.trim().toUpperCase()
  return q ? entries.filter(e => e.brn.includes(q)) : entries
}

// ── Row (shared by rail, station cells, and mobile list) ──

interface BrnRowProps {
  entry: MockEntry
  now: number
  active: boolean
  onSelect: (entry: MockEntry) => void
}

export function BrnRow({ entry, now, active, onSelect }: BrnRowProps) {
  return (
    <ListItemRow
      onClick={() => onSelect(entry)}
      className={`px-4 py-3 border-l-2 transition-colors ${
        active ? 'border-l-themeblue3 bg-themeblue3/8' : 'border-l-transparent hover:bg-secondary/5'
      }`}
      center={
        <>
          <p className="text-[10pt] font-mono font-medium text-primary truncate">{entry.brn}</p>
          <p className="text-[9pt] text-tertiary truncate">Since {fmtTime(sinceAt(entry))}</p>
        </>
      }
      right={
        <span className="flex items-center gap-2 shrink-0">
          <span className="text-[9pt] text-tertiary tabular-nums">{dwellMin(entry, now)}m</span>
          {isWarn(entry, now) && <span className="w-2 h-2 rounded-full bg-themeredred" />}
        </span>
      }
    />
  )
}

interface ListProps {
  entries: MockEntry[]
  now: number
  activeId: string | null
  onSelect: (entry: MockEntry) => void
}

// ── Desktop: rail location filter (mirrors the Messaging Chat | Calls lens rows) ──

/** 'all' = no filter; null = Unassigned; otherwise a station id. */
export type LocationFilter = 'all' | string | null

const FILTER_OPTIONS: { id: LocationFilter; label: string }[] = [{ id: 'all', label: 'All' }]

export const filterByLocation = (entries: MockEntry[], loc: LocationFilter) =>
  loc === 'all' ? entries : entries.filter(e => stationOf(e) === loc)

export function LocationFilterRows({ value, onChange }: { value: LocationFilter; onChange: (loc: LocationFilter) => void }) {
  return (
    <div className="shrink-0 border-b border-primary/10 pb-1">
      {[...FILTER_OPTIONS, ...GRID_COLUMNS].map(o => (
        <button
          key={o.id ?? 'unassigned'}
          onClick={() => onChange(o.id)}
          className={`w-full flex items-center gap-3 py-2.5 px-4 text-left transition-colors active:scale-95 ${
            value === o.id
              ? 'bg-themeblue3/8 border-l-2 border-l-themeblue3'
              : 'hover:bg-secondary/5'
          }`}
        >
          <span className="text-[10pt] font-medium text-primary truncate flex-1">{o.label}</span>
          {value === o.id && <Check size={14} className="text-themeblue2 shrink-0" />}
        </button>
      ))}
    </div>
  )
}

// ── Desktop: center grid (T2T idiom — BRN rows × location columns) ──

/** Unassigned leads, then the stations in order. */
const GRID_COLUMNS: { id: string | null; label: string }[] = [
  { id: null, label: 'Unassigned' },
  ...STATIONS.map(s => ({ id: s.id as string | null, label: s.label })),
]

const BRN_COL_WIDTH = 140
const CELL_MIN_WIDTH = 110
const ROW_HEIGHT = 36

export function TrackingGrid({ entries, now, activeId, onSelect }: ListProps) {
  const cols = `${BRN_COL_WIDTH}px repeat(${GRID_COLUMNS.length}, minmax(${CELL_MIN_WIDTH}px, 1fr))`
  return (
    <div className="h-full overflow-auto bg-themewhite">
      <div className="min-w-max">
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
                {isWarn(e, now) && <span className="w-2 h-2 rounded-full bg-themeredred shrink-0" />}
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

// ── Mobile: flat list grouped by place ──

export function TrackingBoardList({ entries, now, activeId, onSelect }: ListProps) {
  return (
    <div className="pb-8">
      {GRID_COLUMNS.map(g => {
        const rows = entries.filter(e => stationOf(e) === g.id)
        return (
          <div key={g.id ?? 'unassigned'}>
            <ListGroupLabel>{g.label}</ListGroupLabel>
            {rows.map(e => <BrnRow key={e.id} entry={e} now={now} active={activeId === e.id} onSelect={onSelect} />)}
          </div>
        )
      })}
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

// ── Settings (mirrors Messaging settings: section header + card, in Sheet / PreviewOverlay) ──

export function TrackingBoardSettings() {
  return (
    <div className="px-5 py-4 space-y-6">
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
