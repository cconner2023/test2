import { useMemo, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { useTrackingBoardData } from '../../Hooks/useTrackingBoardData'
import { useTrackingWrite } from '../../Hooks/useTrackingWrite'
import { useNavigationStore } from '../../stores/useNavigationStore'
import { useAuthStore } from '../../stores/useAuthStore'
import {
  boardEntries, sinceAt, moveData, transitData, placeLabel, destinationLabel,
  type TrackingEntry,
} from '../TrackingBoard/trackingModel'
import { boardGroups, tintFor, buildTrackingMenuItems } from '../TrackingBoard/TrackingBoardPanel'
import { menuPressHandlers, type MenuPressState } from '../Calendar/menuPress'
import { LiftedRowMenu } from '@/Components/primitives/LiftedRowMenu'
import { ConfirmDialog } from '@/Components/primitives/ConfirmDialog'
import { ActionPill } from '@/Components/primitives/ActionPill'
import { ActionButton } from '@/Components/primitives/ActionButton'
import { EmptyState } from '@/Components/primitives/EmptyState'

const LANE_LIMIT = 3

const CLONE_W = 240
const CLONE_H = 52

/** Re-center a fixed clone box on the pressed pill and clamp to the viewport —
 *  the pills are too narrow to lift as themselves (week-view idiom). */
function cloneAnchor(r: DOMRect): DOMRect {
  const left = Math.max(12, Math.min(r.left + r.width / 2 - CLONE_W / 2, window.innerWidth - CLONE_W - 12))
  const top = Math.max(12, Math.min(r.top, window.innerHeight - CLONE_H - 80))
  return { x: left, y: top, left, top, width: CLONE_W, height: CLONE_H, right: left + CLONE_W, bottom: top + CLONE_H, toJSON() {} } as DOMRect
}

/**
 * Mission overview: Tracking Board at a glance, laid out like the week view.
 * One column per board group (Pending → own stations → other clusters →
 * Complete), then up to LANE_LIMIT BRN lanes
 * (newest at the place first). Tap a BRN = open it in the Tracking Board
 * drawer; long-press / right-click = the board's card menu (Open, Edit, Move,
 * Send, Delete). Open / Edit deep-link into the drawer; moves write in place.
 * BRNs only, never comments: same on-device data the board already shows.
 */
export function TrackingWidget() {
  const setShowTrackingBoardDrawer = useNavigationStore(s => s.setShowTrackingBoardDrawer)
  const openTrackingEntry = useNavigationStore(s => s.openTrackingEntry)
  const openTrackingCheckIn = useNavigationStore(s => s.openTrackingCheckIn)
  const open = () => setShowTrackingBoardDrawer(true)
  const { viewerId, viewerIds, originFilter, net, events } = useTrackingBoardData(true)
  const { updateEntry, deleteEntry } = useTrackingWrite()
  const ownRank = useAuthStore(s => s.profile?.rank) ?? ''
  const ownLast = useAuthStore(s => s.profile?.lastName) ?? ''
  const me = [ownRank, ownLast].filter(Boolean).join(' ') || 'Member'
  const pressRef = useRef<MenuPressState | null>(null)
  const [menu, setMenu] = useState<{ entry: TrackingEntry; rect: DOMRect } | null>(null)
  const [pendingDelete, setPendingDelete] = useState<TrackingEntry | null>(null)
  // Expiry clock, read once per mount (the home screen remounts often).
  const [now] = useState(Date.now)

  const columns = useMemo(() => {
    const board = boardEntries(events, net, viewerIds, now, originFilter)
    return boardGroups(net, viewerId, board).map(g => ({
      ...g,
      rows: board.filter(g.match).sort((a, b) => sinceAt(b) - sinceAt(a)),
    }))
  }, [events, net, viewerId, viewerIds, originFilter, now])

  const total = columns.reduce((n, c) => n + c.rows.length, 0)
  const shown = columns.reduce((n, c) => n + Math.min(c.rows.length, LANE_LIMIT), 0)
  const extra = total - shown
  const laneCount = Math.min(LANE_LIMIT, Math.max(0, ...columns.map(c => c.rows.length)))
  const grid = { gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }
  const action = { icon: Plus, label: 'Check in', onClick: openTrackingCheckIn }

  const menuItems = (e: TrackingEntry) => buildTrackingMenuItems(e, {
    onOpen: x => openTrackingEntry(x.id),
    onEdit: x => openTrackingEntry(x.id, true),
    onMove: (x, to) => { void updateEntry(x.id, d => moveData(d, to, me, Date.now())) },
    onTransit: (x, to) => { void updateEntry(x.id, d => transitData(d, to, me, Date.now())) },
    onDelete: setPendingDelete,
    net,
  })

  if (total === 0) {
    return <EmptyState title="No patients on the board" action={action} bordered={false} />
  }

  return (
    <div className="px-3 relative">
      <div className="grid mb-0.5 gap-0.5" style={grid}>
        {columns.map(c => (
          <div key={c.key} className="flex justify-center min-w-0">
            <span className="text-[9pt] font-semibold uppercase text-secondary truncate">{c.label}</span>
          </div>
        ))}
      </div>
      <div className="border-t border-themeblue3/10" />
      <div className="flex flex-col gap-0.5">
        {Array.from({ length: laneCount }, (_, li) => (
          <div key={li} className="grid gap-0.5" style={grid}>
            {columns.map(c => {
              const e = c.rows[li]
              if (!e) return <div key={c.key} />
              return (
                <button
                  key={c.key}
                  type="button"
                  {...menuPressHandlers(rect => setMenu({ entry: e, rect: cloneAnchor(rect) }), pressRef, { onTap: () => openTrackingEntry(e.id) })}
                  className={`min-w-0 h-5 flex items-center px-1.5 rounded text-left overflow-hidden active:opacity-60 ${tintFor(e).shell}`}
                >
                  <span className="block min-w-0 text-[9pt] font-mono text-primary truncate whitespace-nowrap leading-tight">
                    {e.transit ? '→ ' : ''}{e.brnLabel}
                  </span>
                </button>
              )
            })}
          </div>
        ))}
        {extra > 0 && (
          <button
            type="button"
            onClick={open}
            className="h-5 flex items-center text-[9pt] font-medium text-secondary text-left px-1 active:text-themeblue1"
          >
            +{extra} more
          </button>
        )}
      </div>
      <ActionPill shadow="sm" placement="overlay">
        <ActionButton icon={action.icon} label={action.label} onClick={action.onClick} />
      </ActionPill>
      <LiftedRowMenu
        isOpen={!!menu}
        anchorRect={menu?.rect ?? null}
        row={menu && (
          <div className={`w-full rounded-lg px-2.5 py-2 ${tintFor(menu.entry).shell}`}>
            <p className="text-[10pt] font-mono font-medium text-primary truncate">{menu.entry.brnLabel}</p>
            <p className="text-[9pt] text-secondary truncate">
              {placeLabel(net, menu.entry)}
              {menu.entry.transit && ` → ${destinationLabel(net, menu.entry.transit.to)}`}
            </p>
          </div>
        )}
        items={menu ? menuItems(menu.entry) : []}
        onClose={() => setMenu(null)}
        layout="list"
      />
      <ConfirmDialog
        visible={!!pendingDelete}
        title={`Remove ${pendingDelete?.brnLabel ?? ''} from the board?`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => { if (pendingDelete) void deleteEntry(pendingDelete.id); setPendingDelete(null) }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
