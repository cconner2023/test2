import { useCallback, useState, useEffect, useRef, useMemo } from 'react'
import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Pencil, Pin, Plus, Trash2, Users, MessageSquare, Map as MapIcon } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '../../Hooks/useAuth'
import { useNavigationStore } from '../../stores/useNavigationStore'
import { useCalendarStore } from '../../stores/useCalendarStore'
import { useCalendarVault } from '../../Hooks/useCalendarVault'
import { useCalendarSync } from '../../Hooks/useCalendarSync'
import { useAuthStore } from '../../stores/useAuthStore'
import { getOverlays } from '../../lib/mapOverlayService'
import type { OverlayFeature } from '../../Types/MapOverlayTypes'
import type { CalendarEvent, EventStatus } from '../../Types/CalendarTypes'
import { toDateKey, eventFallsOnDate, formatShortDayLabel, isEventEditable, isTemplateStructureMutable } from '../../Types/CalendarTypes'
import { useCalendarWrite } from '../../Hooks/useCalendarWrite'
import { ConfirmDialog } from '../ConfirmDialog'
import type { OverviewWidgetId } from '../../Data/User'
import { GESTURE_THRESHOLDS } from '../../Utilities/GestureUtils'
import { useMessagingStore } from '../../stores/useMessagingStore'
import { useClinicMedics } from '../../Hooks/useClinicMedics'
import { useClinicHuddleTasks } from '../../Hooks/useClinicHuddleTasks'
import { useLongPress } from '../../Hooks/useLongPress'
import { getDisplayName } from '../../Utilities/nameUtils'
import { UserAvatar } from '../Settings/UserAvatar'
import { useProfileAvatar } from '../../Hooks/useProfileAvatar'
import type { ClinicMedic } from '../../Types/SupervisorTestTypes'
import type { GroupInfo } from '../../lib/signal/groupTypes'
import { MissionMapCard } from './MissionMapCard'
import { WeatherWidget } from './WeatherWidget'
import {
  TaskRow, statusMenuItems,
  offsetDate,
} from './MissionGantt'
import { useCategoryColors } from '../../Hooks/useCategoryColors'
import { useClinicCategoryColorsSync } from '../../Hooks/useClinicCategoryColors'
import { ContextMenu } from '../ContextMenu'
import type { ContextMenuItem } from '../ContextMenu'
import { LiftedRowMenu } from '../LiftedRowMenu'
import { ActionButton } from '../ActionButton'
import { ActionPill } from '../ActionPill'
import { EmptyState } from '../EmptyState'

const TASK_PREVIEW_LIMIT = 4
const KANBAN_PREVIEW_LIMIT = 3
const WEEK_PREVIEW_LIMIT = 3

// ── Messages widget ──────────────────────────────────────────────────────────

type ConvEntry = {
  key: string
  type: 'contact' | 'group'
  lastMessageTime: string
  isSelf?: boolean
  medic?: ClinicMedic
  group?: GroupInfo
}

/** Presentational conversation row — reused both inline and as the lifted clone. */
function ConvRowContent({ entry, lastText, unread, isPinned }: {
  entry: ConvEntry
  lastText?: string
  unread: number
  isPinned: boolean
}) {
  const name = entry.isSelf
    ? 'Notes to Self'
    : entry.type === 'group' && entry.group
      ? entry.group.name
      : entry.medic ? getDisplayName(entry.medic) : '?'

  return (
    <div className="flex items-center gap-4 px-3 py-3 active:bg-themeblue2/5">
      {entry.type === 'group' ? (
        <div className="w-8 h-8 rounded-full bg-themeblue2/10 flex items-center justify-center shrink-0">
          <Users size={15} className="text-themeblue2" />
        </div>
      ) : (
        <UserAvatar avatarId={entry.medic?.avatarId} avatarBlob={entry.medic?.avatarBlob} userId={entry.medic?.id} firstName={entry.medic?.firstName} lastName={entry.medic?.lastName} className="w-8 h-8" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          {isPinned && <Pin size={9} className="text-themeblue2 shrink-0" />}
          <p className="text-[10pt] font-medium text-primary truncate">{name}</p>
        </div>
        {lastText && <p className="text-[9pt] text-secondary truncate">{lastText}</p>}
      </div>
      {unread > 0 && (
        <div className="min-w-[18px] h-[18px] px-1 rounded-full bg-themeblue2 flex items-center justify-center shrink-0">
          <span className="text-[9pt] md:text-[9pt] font-semibold text-white leading-none">{unread > 9 ? '9+' : unread}</span>
        </div>
      )}
    </div>
  )
}

/** Pressable wrapper — long-press (mobile) / right-click (desktop) lifts the row. */
function ConvRow({ children, onTap, onOpenMenu }: {
  children: ReactNode
  onTap: () => void
  onOpenMenu: (rect: DOMRect) => void
}) {
  const rowRef = useRef<HTMLDivElement>(null)
  const firedRef = useRef(false)

  const handleLongPress = useCallback(() => {
    firedRef.current = true
    if (rowRef.current) onOpenMenu(rowRef.current.getBoundingClientRect())
  }, [onOpenMenu])

  const { isPressing, ...longPressHandlers } = useLongPress(handleLongPress)

  const handleClick = useCallback(() => {
    if (firedRef.current) { firedRef.current = false; return }
    onTap()
  }, [onTap])

  return (
    <div
      ref={rowRef}
      className={`cursor-pointer select-none transition-opacity duration-100 ${isPressing ? 'opacity-60' : ''}`}
      // iOS Safari: suppress the native long-press callout/selection that fires a
      // touchcancel and kills the long-press timer. touch-action keeps scroll.
      style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', touchAction: 'manipulation' }}
      onClick={handleClick}
      onContextMenu={(e) => { e.preventDefault(); if (rowRef.current) onOpenMenu(rowRef.current.getBoundingClientRect()) }}
      {...longPressHandlers}
    >
      {children}
    </div>
  )
}

type WidgetActionDescriptor = { icon: LucideIcon; label: string; onClick: () => void }

function MessagesWidget({ action }: { action: WidgetActionDescriptor | null }) {
  const conversations = useMessagingStore(s => s.conversations)
  const groups = useMessagingStore(s => s.groups)
  const unreadCounts = useMessagingStore(s => s.unreadCounts)
  const pinnedKeysArr = useMessagingStore(s => s.pinnedConversationKeys)
  const togglePinConversation = useMessagingStore(s => s.togglePinConversation)
  const deleteConversation = useMessagingStore(s => s.deleteConversation)
  const localUserId = useMessagingStore(s => s.localUserId)
  const openMessagesConversation = useNavigationStore(s => s.openMessagesConversation)
  const { medics } = useClinicMedics()
  const profile = useAuthStore(s => s.profile)
  const { currentAvatar } = useProfileAvatar(localUserId ?? undefined)
  const [liftedMenu, setLiftedMenu] = useState<{ rect: DOMRect; row: ReactNode; items: ContextMenuItem[] } | null>(null)
  const closeMenu = useCallback(() => setLiftedMenu(null), [])
  const [pendingDeleteKey, setPendingDeleteKey] = useState<string | null>(null)

  const pinnedKeys = useMemo(() => new Set(pinnedKeysArr), [pinnedKeysArr])

  const recentEntries = useMemo<ConvEntry[]>(() => {
    const entries: ConvEntry[] = []
    const medicMap = new Map(medics.map(m => [m.id, m]))
    for (const [key, msgs] of Object.entries(conversations)) {
      if (groups[key]?.systemType) continue
      const visibleMsgs = msgs.filter(m => m.messageType !== 'request-accepted' && !m.threadId)
      if (visibleMsgs.length === 0) continue
      const lastTime = visibleMsgs.at(-1)?.createdAt ?? ''
      if (key === localUserId) {
        const selfMedic: ClinicMedic = {
          id: key,
          firstName: profile?.firstName ?? null,
          lastName: profile?.lastName ?? null,
          middleInitial: null,
          rank: null,
          credential: null,
          avatarId: currentAvatar.id,
        }
        entries.push({ key, type: 'contact', lastMessageTime: lastTime, isSelf: true, medic: selfMedic })
      } else if (groups[key]) {
        entries.push({ key, type: 'group', lastMessageTime: lastTime, group: groups[key] })
      } else {
        const medic = medicMap.get(key)
        if (medic) entries.push({ key, type: 'contact', lastMessageTime: lastTime, medic })
      }
    }
    entries.sort((a, b) => {
      const aPin = pinnedKeys.has(a.key) ? 1 : 0
      const bPin = pinnedKeys.has(b.key) ? 1 : 0
      if (aPin !== bPin) return bPin - aPin
      return b.lastMessageTime.localeCompare(a.lastMessageTime)
    })
    return entries
  }, [conversations, medics, groups, localUserId, pinnedKeys])

  const pinned = recentEntries.filter(e => pinnedKeys.has(e.key))
  const displayed = pinned.length > 0 ? pinned.slice(0, 2) : recentEntries.slice(0, 2)

  const openConversation = useCallback((entry: ConvEntry) => {
    if (entry.isSelf && localUserId) {
      openMessagesConversation(localUserId, null, 'Notes to Self')
    } else if (entry.type === 'group' && entry.group) {
      openMessagesConversation(null, entry.group.groupId, entry.group.name)
    } else if (entry.medic) {
      openMessagesConversation(entry.medic.id, null, getDisplayName(entry.medic))
    }
  }, [openMessagesConversation, localUserId])

  if (displayed.length === 0) {
    return <EmptyState title="No conversations" action={action ?? undefined} bordered={false} />
  }

  return (
    <div className="divide-y divide-themeblue3/8 relative">
      {action && (
        <ActionPill shadow="sm" placement="overlay">
          <ActionButton icon={action.icon} label={action.label} onClick={action.onClick} />
        </ActionPill>
      )}
      {displayed.map(entry => {
        const msgs = conversations[entry.key]
        const lastMsg = msgs?.filter(m => m.messageType !== 'request-accepted' && !m.threadId).at(-1)
        const isPinned = pinnedKeys.has(entry.key)
        const content = (
          <ConvRowContent
            entry={entry}
            lastText={lastMsg?.plaintext}
            unread={unreadCounts[entry.key] ?? 0}
            isPinned={isPinned}
          />
        )
        const items: ContextMenuItem[] = [
          { key: 'pin', label: isPinned ? 'Unpin' : 'Pin', icon: Pin, onAction: () => togglePinConversation(entry.key) },
          { key: 'delete', label: 'Delete', icon: Trash2, destructive: true, onAction: () => setPendingDeleteKey(entry.key) },
        ]
        return (
          <ConvRow
            key={entry.key}
            onTap={() => openConversation(entry)}
            onOpenMenu={(rect) => setLiftedMenu({ rect, row: content, items })}
          >
            {content}
          </ConvRow>
        )
      })}
      <LiftedRowMenu
        isOpen={!!liftedMenu}
        anchorRect={liftedMenu?.rect ?? null}
        row={liftedMenu?.row}
        items={liftedMenu?.items ?? []}
        onClose={closeMenu}
        layout="list"
      />
      <ConfirmDialog
        visible={!!pendingDeleteKey}
        title="Permanently delete this conversation?"
        subtitle="All messages in this conversation will be removed from this device."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => { if (pendingDeleteKey) deleteConversation(pendingDeleteKey); setPendingDeleteKey(null) }}
        onCancel={() => setPendingDeleteKey(null)}
      />
    </div>
  )
}

function KanbanCard({ event, onTap, onContext }: {
  event: CalendarEvent
  onTap: () => void
  onContext: (x: number, y: number) => void
}) {
  const { isPressing, ...longPressHandlers } = useLongPress(onContext)
  const { resolve: resolveCategoryColor } = useCategoryColors()
  const stripe = resolveCategoryColor(event.category, event.color).solid
  const isDone = event.status === 'completed' || event.status === 'cancelled'
  return (
    <button
      onClick={onTap}
      onContextMenu={(e) => { e.preventDefault(); onContext(e.clientX, e.clientY) }}
      {...longPressHandlers}
      className={`flex items-stretch text-left rounded overflow-hidden border border-themeblue3/10 active:scale-[0.98] w-full transition-opacity duration-100 ${isDone ? 'opacity-50' : isPressing ? 'opacity-60' : ''}`}
    >
      <div className={`w-1 shrink-0 ${stripe}`} />
      <div className="flex-1 min-w-0 px-1.5 py-1 bg-themewhite2">
        <p className="text-[9pt] font-medium text-primary truncate leading-tight">{event.title}</p>
        <p className="text-[9pt] text-secondary tabular-nums leading-tight">{event.start_time.slice(11, 16)}</p>
      </div>
    </button>
  )
}

function getWeekDays(date: Date): Date[] {
  const d = new Date(date)
  const day = d.getDay()
  const monday = new Date(d)
  monday.setDate(d.getDate() - ((day + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(monday)
    dd.setDate(monday.getDate() + i)
    return dd
  })
}

interface MissionBoardPanelProps {
  standalone?: boolean
}

export function MissionBoardPanel({ standalone = false }: MissionBoardPanelProps) {
  const { isAuthenticated, clinicId } = useAuth()
  useCalendarSync() // hydrate events from IDB on home mount, not only when the Calendar drawer opens
  useClinicCategoryColorsSync(clinicId)
  const { resolve: resolveCategoryColor } = useCategoryColors()
  const setShowCalendarDrawer = useNavigationStore(s => s.setShowCalendarDrawer)
  const openCalendarEvent = useNavigationStore(s => s.openCalendarEvent)
  const openCalendarEventForEdit = useNavigationStore(s => s.openCalendarEventForEdit)
  const requestNewCalendarEvent = useNavigationStore(s => s.requestNewCalendarEvent)
  const setShowMapOverlayDrawer = useNavigationStore(s => s.setShowMapOverlayDrawer)
  const setShowMessagesDrawer = useNavigationStore(s => s.setShowMessagesDrawer)
  const allEvents = useCalendarStore(s => s.events)
  const updateEvent = useCalendarStore(s => s.updateEvent)
  const userId = useAuthStore(s => s.user?.id)
  const isDevRole = useAuthStore(s => s.isDevRole)
  const events = allEvents
  const isSupervisor = useAuthStore(s => s.isSupervisorRole)
  const overviewWidgets = useAuthStore(s => s.profile?.overviewWidgets)
  const { sendEvent: vaultSendEvent, deleteEvents: vaultDeleteEvents } = useCalendarVault()
  const { deleteEvent: calendarDeleteEvent } = useCalendarWrite()
  const huddleTasks = useClinicHuddleTasks()
  const { medics: clinicMedics } = useClinicMedics()
  const medicById = useMemo(() => {
    const m = new Map<string, ClinicMedic>()
    for (const med of clinicMedics) m.set(med.id, med)
    return m
  }, [clinicMedics])
  const [confirmDeleteEvent, setConfirmDeleteEvent] = useState<string | null>(null)

  const [missionOverlayFeatures, setMissionOverlayFeatures] = useState<OverlayFeature[]>([])
  const [missionOverlayId, setMissionOverlayId] = useState<string | undefined>(undefined)
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [contextMenu, setContextMenu] = useState<{ event: CalendarEvent; x: number; y: number } | null>(null)

  const weekViewElRef = useRef<HTMLDivElement | null>(null)
  const [weekViewMounted, setWeekViewMounted] = useState(false)
  const weekViewRef = useCallback((el: HTMLDivElement | null) => {
    weekViewElRef.current = el
    setWeekViewMounted(el !== null)
  }, [])

  useEffect(() => {
    if (!clinicId) {
      setMissionOverlayFeatures([])
      setMissionOverlayId(undefined)
      return
    }
    let cancelled = false
    getOverlays(clinicId).then(result => {
      if (cancelled) return
      const first = result.ok && result.data.length > 0 ? result.data[0] : undefined
      setMissionOverlayFeatures(first?.features ?? [])
      setMissionOverlayId(first?.id)
    })
    return () => { cancelled = true }
  }, [clinicId])

  // Week-view swipe: attach native pointer listeners so stopPropagation fires
  // before @use-gesture/react's listener on the parent ColumnA carousel.
  useEffect(() => {
    const el = weekViewElRef.current
    if (!el) return
    let startX = 0, startY = 0, active = false, locked: boolean | null = null
    const onPointerDown = (e: PointerEvent) => {
      e.stopPropagation()
      startX = e.clientX; startY = e.clientY; active = true; locked = null
    }
    const onPointerMove = (e: PointerEvent) => {
      if (!active) return
      const dx = Math.abs(e.clientX - startX), dy = Math.abs(e.clientY - startY)
      if (locked === null && (dx > GESTURE_THRESHOLDS.DIRECTION_LOCK || dy > GESTURE_THRESHOLDS.DIRECTION_LOCK)) {
        locked = dx > dy
      }
      if (locked) e.stopPropagation()
    }
    const onPointerUp = (e: PointerEvent) => {
      if (!active || !locked) { active = false; return }
      const dx = e.clientX - startX
      active = false
      if (Math.abs(dx) > GESTURE_THRESHOLDS.PAGE_SWIPE_THRESHOLD) {
        setSelectedDate(d => offsetDate(d, dx > 0 ? -7 : 7))
      }
    }
    const onPointerCancel = () => { active = false }
    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', onPointerUp)
    el.addEventListener('pointercancel', onPointerCancel)
    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', onPointerUp)
      el.removeEventListener('pointercancel', onPointerCancel)
    }
  }, [weekViewMounted]) // re-run when week-view widget mounts/unmounts

  const dateKey = toDateKey(selectedDate)
  const isToday = dateKey === toDateKey(new Date())
  const allDayEvents = events.filter(e => eventFallsOnDate(e, dateKey))
  const myTasks = allDayEvents
    .filter(e => !!userId && e.assigned_to.includes(userId))
    .sort((a, b) => a.start_time.localeCompare(b.start_time))

  const previewTasks = myTasks.slice(0, TASK_PREVIEW_LIMIT)
  const extraCount = Math.max(0, myTasks.length - TASK_PREVIEW_LIMIT)

  const navigate = (dir: -1 | 1) => setSelectedDate(d => offsetDate(d, dir))

  const openCalendarOnDate = useCallback((d: Date) => {
    setShowCalendarDrawer(true, toDateKey(d))
  }, [setShowCalendarDrawer])

  const handleEventClick = useCallback((eventId: string) => {
    openCalendarEvent(eventId)
  }, [openCalendarEvent])

  const handleStatusChange = useCallback((eventId: string, status: EventStatus) => {
    const event = events.find((e: CalendarEvent) => e.id === eventId)
    if (!event) return
    const updatedEvent: CalendarEvent = { ...event, status, updated_at: new Date().toISOString() }
    const oldOriginIds = event.originId ? [event.originId] : []
    if (oldOriginIds.length > 0) vaultDeleteEvents(oldOriginIds).catch(() => {})
    vaultSendEvent('c', updatedEvent).then(newOriginId => {
      if (newOriginId) updateEvent(eventId, { originId: newOriginId })
    }).catch(() => {})
    updateEvent(eventId, { status })
  }, [events, updateEvent, vaultSendEvent, vaultDeleteEvents])

  if (!isAuthenticated) return null
  if (overviewWidgets === null) return null

  const DEFAULT_WIDGETS: OverviewWidgetId[] = ['kanban', 'messages']
  const VALID_IDS: OverviewWidgetId[] = ['task-list', 'map-overlay', 'kanban', 'week-view', 'messages', 'weather', 'huddle']
  const widgets: OverviewWidgetId[] = Array.from(new Set(
    (overviewWidgets ?? DEFAULT_WIDGETS)
      .map(id => (id as string) === 'gantt' ? 'kanban' : id)
      .filter((id): id is OverviewWidgetId => (VALID_IDS as string[]).includes(id))
  )).filter(id => id !== 'map-overlay' || isDevRole)

  const renderActionOverlay = (id: OverviewWidgetId) => {
    const action = widgetAction(id)
    if (!action) return null
    return (
      <ActionPill shadow="sm" placement="overlay">
        <ActionButton icon={action.icon} label={action.label} onClick={action.onClick} />
      </ActionPill>
    )
  }

  const renderWidget = (id: OverviewWidgetId) => {
    switch (id) {
      case 'task-list': {
        if (myTasks.length === 0) {
          const action = widgetAction(id)
          return <EmptyState key="task-list" title="No tasks today" action={action ?? undefined} bordered={false} />
        }
        return (
          <div key="task-list" className="px-2.5 py-2 flex flex-col gap-1.5 min-h-[90px]">
            {previewTasks.map(event => (
              <TaskRow
                key={event.id}
                event={event}
                onClick={() => handleEventClick(event.id)}
                onContextMenu={(x, y) => setContextMenu({ event, x, y })}
              />
            ))}
            {extraCount > 0 && (
              <button
                onClick={() => setShowCalendarDrawer(true)}
                className="text-[9pt] font-medium text-secondary text-left pl-2 py-0.5 active:text-themeblue1"
              >
                +{extraCount} more
              </button>
            )}
            {renderActionOverlay(id)}
          </div>
        )
      }

      case 'map-overlay':
        return (
          <div key="map-overlay" className="h-[120px] p-1.5 relative">
            <div className="w-full h-full rounded-lg overflow-hidden">
              <MissionMapCard
                overlayFeatures={missionOverlayFeatures}
                overlayId={missionOverlayId}
                onClick={() => setShowMapOverlayDrawer(true, missionOverlayId)}
              />
            </div>
            {renderActionOverlay(id)}
          </div>
        )

      case 'kanban': {
        if (allDayEvents.length === 0) {
          const action = widgetAction(id)
          return <EmptyState key="kanban" title={`No events ${isToday ? 'today' : 'this day'}`} action={action} bordered={false} />
        }
        const byStart = (a: CalendarEvent, b: CalendarEvent) => a.start_time.localeCompare(b.start_time)
        const cols = [
          { id: 'pending', label: 'Pending', events: allDayEvents.filter(e => e.status === 'pending').sort(byStart) },
          { id: 'active',  label: 'Active',  events: allDayEvents.filter(e => e.status === 'in_progress').sort(byStart) },
          { id: 'done',    label: 'Done',    events: allDayEvents.filter(e => e.status === 'completed' || e.status === 'cancelled').sort(byStart) },
        ]
        return (
          <div key="kanban" className="flex flex-col relative">
            <div className="flex divide-x divide-themeblue3/8">
              {cols.map(col => (
                <div key={col.id} className="flex-1 min-w-0 flex items-center justify-center gap-1 px-2 py-1.5 border-b border-themeblue3/8">
                  <span className="text-[9pt] font-semibold text-secondary uppercase tracking-wide leading-none">{col.label}</span>
                  {col.events.length > 0 && (
                    <span className="text-[9pt] text-tertiary tabular-nums">{col.events.length}</span>
                  )}
                </div>
              ))}
            </div>
            <div className="flex divide-x divide-themeblue3/8 min-h-[70px]">
              {cols.map(col => {
                const shown = col.events.slice(0, KANBAN_PREVIEW_LIMIT)
                const extra = col.events.length - shown.length
                return (
                  <div key={col.id} className="flex-1 min-w-0 flex flex-col gap-px p-1">
                    {col.events.length === 0 ? (
                      <div className="flex items-center justify-center py-3">
                        <span className="text-[9pt] text-tertiary/40">—</span>
                      </div>
                    ) : (
                      <>
                        {shown.map(event => (
                          <KanbanCard
                            key={event.id}
                            event={event}
                            onTap={() => handleEventClick(event.id)}
                            onContext={(x, y) => setContextMenu({ event, x, y })}
                          />
                        ))}
                        {extra > 0 && (
                          <button
                            onClick={() => openCalendarOnDate(selectedDate)}
                            className="text-[9pt] font-medium text-secondary text-left px-1 py-0.5 active:text-themeblue1"
                          >
                            +{extra} more
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )
              })}
            </div>
            {renderActionOverlay(id)}
          </div>
        )
      }

      case 'week-view': {
        const weekDays = getWeekDays(selectedDate)
        const todayKey = toDateKey(new Date())

        type WeekEvent = { event: CalendarEvent; startCol: number; span: number }
        const weekEvents: WeekEvent[] = []
        for (const e of events) {
          let startCol = -1, endCol = -1
          for (let i = 0; i < 7; i++) {
            if (eventFallsOnDate(e, toDateKey(weekDays[i]))) {
              if (startCol === -1) startCol = i
              endCol = i
            }
          }
          if (startCol === -1) continue
          weekEvents.push({ event: e, startCol: startCol + 1, span: endCol - startCol + 1 })
        }
        // Cap to the earliest WEEK_PREVIEW_LIMIT events by start time (all-day first),
        // matching the task-list/kanban preview-limit pattern.
        const totalWeekEvents = weekEvents.length
        weekEvents.sort((a, b) =>
          (a.event.all_day === b.event.all_day ? 0 : a.event.all_day ? -1 : 1) ||
          a.event.start_time.localeCompare(b.event.start_time)
        )
        const shownWeekEvents = weekEvents.slice(0, WEEK_PREVIEW_LIMIT)
        const weekExtra = totalWeekEvents - shownWeekEvents.length

        // Spatial order for greedy lane packing of the capped set.
        shownWeekEvents.sort((a, b) =>
          a.startCol - b.startCol ||
          b.span - a.span ||
          (a.event.all_day === b.event.all_day ? 0 : a.event.all_day ? -1 : 1) ||
          a.event.start_time.localeCompare(b.event.start_time)
        )

        const lanes: WeekEvent[][] = []
        for (const we of shownWeekEvents) {
          const weEnd = we.startCol + we.span - 1
          let laneIdx = 0
          while (
            lanes[laneIdx]?.some(o => we.startCol <= o.startCol + o.span - 1 && o.startCol <= weEnd)
          ) laneIdx++
          if (!lanes[laneIdx]) lanes[laneIdx] = []
          lanes[laneIdx].push(we)
        }

        const weekHasEvents = totalWeekEvents > 0

        return (
          <div key="week-view" ref={weekViewRef} className="px-3 pt-0.5 pb-3.5 relative">
            <div className="grid grid-cols-7 mb-0.5">
              {weekDays.map((day, i) => {
                const isWeekend = i >= 5
                return (
                  <div key={i} className="flex justify-center">
                    <span className={`text-[9pt] font-semibold uppercase ${isWeekend ? 'text-themeredred/80' : 'text-secondary'}`}>
                      {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'][i]}
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="border-t border-themeblue3/10 mb-0.5" />
            <div className="grid grid-cols-7 mb-2.5">
              {weekDays.map((day, i) => {
                const key = toDateKey(day)
                const isTodayDay = key === todayKey
                const isSelected = key === dateKey
                const isWeekend = i >= 5
                return (
                  <div key={key} className="flex justify-center">
                    <button
                      onClick={() => openCalendarOnDate(day)}
                      className={`w-6 h-6 flex items-center justify-center rounded-full active:opacity-60 transition-opacity ${
                        isSelected ? 'bg-themeblue3' : isTodayDay ? 'ring-1 ring-themeblue3' : ''
                      }`}
                    >
                      <span className={`text-[10pt] font-medium tabular-nums leading-none ${
                        isSelected ? 'text-white' :
                        isWeekend ? 'text-themeredred' :
                        'text-primary'
                      }`}>
                        {day.getDate()}
                      </span>
                    </button>
                  </div>
                )
              })}
            </div>
            {weekHasEvents ? (
              <div className="flex flex-col gap-0.5">
                {lanes.map((lane, li) => (
                  <div key={li} className="grid grid-cols-7 gap-0.5">
                    {lane.map(we => {
                      const stripe = resolveCategoryColor(we.event.category, we.event.color).solid
                      const isDone = we.event.status === 'completed' || we.event.status === 'cancelled'
                      return (
                        <button
                          key={we.event.id}
                          type="button"
                          onClick={() => handleEventClick(we.event.id)}
                          onContextMenu={(e) => { e.preventDefault(); setContextMenu({ event: we.event, x: e.clientX, y: e.clientY }) }}
                          style={{ gridColumn: `${we.startCol} / span ${we.span}` }}
                          className={`min-w-0 px-1.5 py-0.5 rounded text-left overflow-hidden active:opacity-60 ${stripe} ${isDone ? 'opacity-50' : ''}`}
                        >
                          <span className="block text-[9pt] font-normal text-white truncate whitespace-nowrap leading-tight">
                            {we.event.title}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                ))}
                {weekExtra > 0 && (
                  <button
                    onClick={() => openCalendarOnDate(selectedDate)}
                    className="text-[9pt] font-medium text-secondary text-left px-1 py-0.5 active:text-themeblue1"
                  >
                    +{weekExtra} more
                  </button>
                )}
              </div>
            ) : (
              <EmptyState title="No events this week" bordered={false} />
            )}
            {renderActionOverlay(id)}
          </div>
        )
      }

      case 'messages':
        return <MessagesWidget key="messages" action={widgetAction(id)} />

      case 'weather':
        return (
          <div key="weather" className="relative">
            <WeatherWidget />
            {renderActionOverlay(id)}
          </div>
        )

      case 'huddle': {
        const huddleEvents = allDayEvents
          .filter(e => e.category === 'huddle')
          .sort((a, b) => a.start_time.localeCompare(b.start_time))
        if (huddleEvents.length === 0) {
          const action = widgetAction(id)
          return <EmptyState key="huddle" title={`No huddle ${isToday ? 'today' : 'this day'}`} action={action} bordered={false} />
        }
        const taskOrder = new Map(huddleTasks.map((t, i) => [t.id, { name: t.name, sort: t.sort_order ?? i }]))
        const groups = new Map<string, { label: string; sort: number; events: CalendarEvent[] }>()
        for (const ev of huddleEvents) {
          const tid = ev.huddle_task_id ?? null
          if (tid && taskOrder.has(tid)) {
            const { name, sort } = taskOrder.get(tid)!
            if (!groups.has(tid)) groups.set(tid, { label: name, sort, events: [] })
            groups.get(tid)!.events.push(ev)
          } else {
            const key = '__pairing__'
            if (!groups.has(key)) groups.set(key, { label: 'Provider pairing', sort: -1, events: [] })
            groups.get(key)!.events.push(ev)
          }
        }
        const ordered = Array.from(groups.values()).sort((a, b) => a.sort - b.sort)
        return (
          <div key="huddle" className="px-2.5 py-2 flex flex-col gap-2 relative">
            {renderActionOverlay(id)}
            {ordered.map((g, gi) => (
              <div key={gi} className="flex flex-col gap-0.5">
                <div className="text-[9pt] font-semibold uppercase tracking-wide text-secondary px-0.5">{g.label}</div>
                {g.events.map(ev => {
                  const assignedNames = ev.assigned_to
                    .map(uid => medicById.get(uid))
                    .filter((m): m is ClinicMedic => !!m)
                    .map(getDisplayName)
                  const titleDiffers = ev.title && ev.title.trim() && ev.title.trim() !== g.label.trim()
                  const primary = assignedNames.length > 0
                    ? assignedNames.join(', ')
                    : (titleDiffers ? ev.title : 'Unassigned')
                  const primaryClass = assignedNames.length === 0 && !titleDiffers
                    ? 'text-[10pt] text-tertiary italic truncate'
                    : 'text-[10pt] text-primary truncate'
                  return (
                    <button
                      key={ev.id}
                      onClick={() => handleEventClick(ev.id)}
                      onContextMenu={(e) => { e.preventDefault(); setContextMenu({ event: ev, x: e.clientX, y: e.clientY }) }}
                      className="flex items-center gap-2 text-left rounded px-1.5 py-1 active:bg-themeblue2/10"
                    >
                      <span className="text-[9pt] text-secondary tabular-nums shrink-0">{ev.start_time.slice(11, 16)}</span>
                      <span className={primaryClass}>{primary}</span>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        )
      }

      default:
        return null
    }
  }

  const dateNavRow = (
    <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-themeblue3/8">
      <button className="p-1 rounded active:bg-themeblue2/10 text-tertiary" onClick={() => navigate(-1)}>
        <ChevronLeft size={13} />
      </button>
      <button
        className="text-[10pt] font-medium text-primary py-0.5 px-1 rounded active:bg-themeblue2/10 whitespace-nowrap"
        onClick={() => openCalendarOnDate(selectedDate)}
      >
        {isToday ? 'Today' : formatShortDayLabel(selectedDate)}
      </button>
      <button className="p-1 rounded active:bg-themeblue2/10 text-tertiary" onClick={() => navigate(1)}>
        <ChevronRight size={13} />
      </button>
    </div>
  )

  const widgetAction = (id: OverviewWidgetId): WidgetActionDescriptor | null => {
    switch (id) {
      case 'task-list':
      case 'kanban':
      case 'week-view':
      case 'huddle':
        return { icon: Plus, label: 'New Event', onClick: requestNewCalendarEvent }
      case 'messages':
        return { icon: MessageSquare, label: 'Open Messages', onClick: () => setShowMessagesDrawer(true) }
      case 'map-overlay':
        return { icon: MapIcon, label: 'Open Map', onClick: () => setShowMapOverlayDrawer(true, missionOverlayId) }
      case 'weather':
        return null
      default:
        return null
    }
  }

  return (
    <div className="rounded-xl overflow-hidden border border-themeblue3/10 bg-themewhite2" data-tour="mission-overview-panel">
      {widgets.length === 0 ? (
        <div className="flex items-center justify-center h-[80px]">
          <span className="text-[10pt] text-secondary">No widgets selected</span>
        </div>
      ) : (
        <>
          {/* Date nav is the panel's permanent header — riding above EVERY first
              widget (calendar or not) so the first widget's overlay action pill
              has a bar to sit on instead of being clipped by the card's overflow-hidden. */}
          {dateNavRow}
          <div className="divide-y divide-themeblue3/8" data-tour="mission-overview-widgets">
            {widgets.map(id => (
              <div key={id}>
                {renderWidget(id)}
              </div>
            ))}
          </div>
        </>
      )}

      {contextMenu && (() => {
        const ev = contextMenu.event
        const editable = isEventEditable(ev, isSupervisor)
        const deletable = isTemplateStructureMutable(ev, isSupervisor)
        const items = [
          ...(editable ? statusMenuItems(ev, (status) => {
            handleStatusChange(ev.id, status)
            setContextMenu(null)
          }) : []),
          ...(editable ? [{ key: 'edit', label: 'Edit', icon: Pencil, onAction: () => { openCalendarEventForEdit(ev.id); setContextMenu(null) } }] : []),
          ...(deletable ? [{ key: 'delete', label: 'Delete', icon: Trash2, destructive: true, onAction: () => { setConfirmDeleteEvent(ev.id); setContextMenu(null) } }] : []),
        ]
        if (items.length === 0) { setContextMenu(null); return null }
        return (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
            items={items}
          />
        )
      })()}

      <ConfirmDialog
        visible={!!confirmDeleteEvent}
        title="Delete event?"
        subtitle="Permanent. Removed for all cluster members."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          const id = confirmDeleteEvent
          setConfirmDeleteEvent(null)
          if (id) calendarDeleteEvent(id).catch(() => {})
        }}
        onCancel={() => setConfirmDeleteEvent(null)}
      />

      {!standalone && (
        <div className="mt-2 border-t border-themeblue3/8" />
      )}
    </div>
  )
}
