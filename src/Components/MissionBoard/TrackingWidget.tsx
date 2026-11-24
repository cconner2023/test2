import { useMemo, useRef, useState } from 'react'
import { MoreHorizontal, Plus } from 'lucide-react'
import { useTrackingBoardData } from '../../Hooks/useTrackingBoardData'
import { useTrackingWrite } from '../../Hooks/useTrackingWrite'
import { useNavigationStore } from '../../stores/useNavigationStore'
import { useAuthStore } from '../../stores/useAuthStore'
import {
  boardEntries, sinceAt, isComplete, moveData, transitData, placeLabel, destinationLabel,
  type TrackingEntry,
} from '../TrackingBoard/trackingModel'
import { tintFor, buildTrackingMenuItems } from '../TrackingBoard/TrackingBoardPanel'
import { menuPressHandlers, type MenuPressState } from '../Calendar/menuPress'
import { LiftedRowMenu } from '@/Components/primitives/LiftedRowMenu'
import { ConfirmDialog } from '@/Components/primitives/ConfirmDialog'
import { ActionPill } from '@/Components/primitives/ActionPill'
import { ActionButton } from '@/Components/primitives/ActionButton'
import { EmptyState } from '@/Components/primitives/EmptyState'

const ROW_LIMIT = 5

const CLONE_W = 240
const CLONE_H = 52

/** Re-center a fixed clone box on the pressed pill and clamp to the viewport —
 *  the pills are too narrow to lift as themselves (week-view idiom). */
function cloneAnchor(r: DOMRect): DOMRect {
  const left = Math.max(12, Math.min(r.left + r.width / 2 - CLONE_W / 2, window.innerWidth - CLONE_W - 12))
  const top = Math.max(12, Math.min(r.top, window.innerHeight - CLONE_H - 80))
  return { x: left, y: top, left, top, width: CLONE_W, height: CLONE_H, right: left + CLONE_W, bottom: top + CLONE_H, toJSON() {} } as DOMRect
}

function stamp(at: number, todayStart: number): string {
  const d = new Date(at)
  return at >= todayStart
    ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/**
 * Mission overview: Tracking Board at a glance. One stack, newest activity
 * first: every open BRN plus those completed today. Tap a BRN = open it in the
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
  const [ellipsisMenu, setEllipsisMenu] = useState<{ entry: TrackingEntry; rect: DOMRect } | null>(null)
  const [pendingDelete, setPendingDelete] = useState<TrackingEntry | null>(null)
  // Expiry clock, read once per mount (the home screen remounts often).
  const [now] = useState(Date.now)

  const todayStart = useMemo(() => new Date(now).setHours(0, 0, 0, 0), [now])
  const rows = useMemo(() =>
    boardEntries(events, net, viewerIds, now, originFilter)
      .filter(e => !isComplete(e) || sinceAt(e) >= todayStart)
      .sort((a, b) => sinceAt(b) - sinceAt(a)),
  [events, net, viewerIds, originFilter, now, todayStart])

  const total = rows.length
  const shown = rows.slice(0, ROW_LIMIT)
  const extra = total - shown.length
  const action = { icon: Plus, label: 'Check in', onClick: openTrackingCheckIn }

  const menuItems = (e: TrackingEntry) => buildTrackingMenuItems(e, {
    onOpen: x => openTrackingEntry(x.id),
    onEdit: x => openTrackingEntry(x.id, true),
    onMove: (x, to) => { void updateEntry(x.id, d => moveData(d, to, Date.now())) },
    onTransit: (x, to) => { void updateEntry(x.id, d => transitData(d, to, me, Date.now())) },
    onDelete: setPendingDelete,
    net,
    viewerId,
  })

  if (total === 0) {
    return <EmptyState title="No patients on the board" action={action} bordered={false} />
  }

  return (
    <div className="relative">
      <div className="divide-y divide-themeblue3/8">
        {shown.map(e => (
          <div key={e.id} className="flex items-center">
            <button
              type="button"
              {...menuPressHandlers(rect => setMenu({ entry: e, rect: cloneAnchor(rect) }), pressRef, { onTap: () => openTrackingEntry(e.id) })}
              className="flex-1 min-w-0 flex items-center gap-3 px-3 py-2.5 text-left text-[10pt] text-primary active:bg-themeblue2/5"
            >
              <span className="truncate">{e.transit ? '→ ' : ''}{e.brnLabel}</span>
              <span className="truncate">{e.transit ? destinationLabel(net, e.transit.to) : placeLabel(net, e)}</span>
              <span className="shrink-0 tabular-nums">{stamp(sinceAt(e), todayStart)}</span>
            </button>
            <button
              type="button"
              onClick={(ev) => setEllipsisMenu({ entry: e, rect: ev.currentTarget.getBoundingClientRect() })}
              aria-label="BRN actions"
              className="w-7 h-7 mr-2 shrink-0 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all"
            >
              <MoreHorizontal size={15} />
            </button>
          </div>
        ))}
      </div>
      {extra > 0 && (
        <button
          type="button"
          onClick={open}
          className="w-full text-[9pt] font-medium text-secondary text-left px-3 py-1.5 border-t border-themeblue3/8 active:text-themeblue1"
        >
          +{extra} more
        </button>
      )}
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
      <LiftedRowMenu
        isOpen={!!ellipsisMenu}
        anchorRect={ellipsisMenu?.rect ?? null}
        items={ellipsisMenu ? menuItems(ellipsisMenu.entry) : []}
        onClose={() => setEllipsisMenu(null)}
        align="right"
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
