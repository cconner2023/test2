import { useCallback, useState, useEffect, useRef, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Pin, Trash2, Users, MessageSquare } from 'lucide-react'
import { useAuth } from '../../Hooks/useAuth'
import { useNavigationStore } from '../../stores/useNavigationStore'
import { useCalendarStore } from '../../stores/useCalendarStore'
import { useCalendarVault } from '../../Hooks/useCalendarVault'
import { useAuthStore } from '../../stores/useAuthStore'
import { getOverlay } from '../../lib/mapOverlayService'
import type { OverlayFeature } from '../../Types/MapOverlayTypes'
import type { CalendarEvent, EventStatus } from '../../Types/CalendarTypes'
import { toDateKey, eventFallsOnDate } from '../../Types/CalendarTypes'
import type { OverviewWidgetId } from '../../Data/User'
import { GESTURE_THRESHOLDS } from '../../Utilities/GestureUtils'
import { useMessagingStore } from '../../stores/useMessagingStore'
import { useClinicMedics } from '../../Hooks/useClinicMedics'
import { useLongPress } from '../../Hooks/useLongPress'
import { getDisplayName } from '../../Utilities/nameUtils'
import { UserAvatar } from '../Settings/UserAvatar'
import { useProfileAvatar } from '../../Hooks/useProfileAvatar'
import type { ClinicMedic } from '../../Types/SupervisorTestTypes'
import type { GroupInfo } from '../../lib/signal/groupTypes'
import { MissionMapCard } from './MissionMapCard'
import {
  TaskRow, GanttBody, statusMenuItems,
  formatDateLabel, offsetDate, CATEGORY_STRIPE,
} from './MissionGantt'
import { DatePickerCalendar } from '../FormInputs'
import { PreviewOverlay } from '../PreviewOverlay'
import { ContextMenu } from '../ContextMenu'

const TASK_PREVIEW_LIMIT = 4

// ── Messages widget ──────────────────────────────────────────────────────────

type ConvEntry = {
  key: string
  type: 'contact' | 'group'
  lastMessageTime: string
  isSelf?: boolean
  medic?: ClinicMedic
  group?: GroupInfo
}

function ConvRow({ entry, lastText, unread, isPinned, onTap, onContext }: {
  entry: ConvEntry
  lastText?: string
  unread: number
  isPinned: boolean
  onTap: () => void
  onContext: (x: number, y: number) => void
}) {
  const longPress = useLongPress(onContext)
  const name = entry.isSelf
    ? 'Notes to Self'
    : entry.type === 'group' && entry.group
      ? entry.group.name
      : entry.medic ? getDisplayName(entry.medic) : '?'

  return (
    <div
      className="flex items-center gap-4 px-3 py-3 active:bg-themeblue2/5 cursor-pointer select-none"
      onClick={onTap}
      onContextMenu={(e) => { e.preventDefault(); onContext(e.clientX, e.clientY) }}
      {...longPress}
    >
      {entry.type === 'group' ? (
        <div className="w-8 h-8 rounded-full bg-themeblue2/10 flex items-center justify-center shrink-0">
          <Users size={15} className="text-themeblue2" />
        </div>
      ) : (
        <UserAvatar avatarId={entry.medic?.avatarId} firstName={entry.medic?.firstName} lastName={entry.medic?.lastName} className="w-8 h-8" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          {isPinned && <Pin size={9} className="text-themeblue2 shrink-0" />}
          <p className="text-xs font-medium text-primary truncate">{name}</p>
        </div>
        {lastText && <p className="text-[10px] text-secondary truncate">{lastText}</p>}
      </div>
      {unread > 0 && (
        <div className="min-w-[18px] h-[18px] px-1 rounded-full bg-themeblue2 flex items-center justify-center shrink-0">
          <span className="text-[9px] font-semibold text-white leading-none">{unread > 9 ? '9+' : unread}</span>
        </div>
      )}
    </div>
  )
}

function MessagesWidget() {
  const conversations = useMessagingStore(s => s.conversations)
  const groups = useMessagingStore(s => s.groups)
  const unreadCounts = useMessagingStore(s => s.unreadCounts)
  const pinnedKeysArr = useMessagingStore(s => s.pinnedConversationKeys)
  const togglePinConversation = useMessagingStore(s => s.togglePinConversation)
  const deleteConversation = useMessagingStore(s => s.deleteConversation)
  const localUserId = useMessagingStore(s => s.localUserId)
  const openMessagesConversation = useNavigationStore(s => s.openMessagesConversation)
  const setShowMessagesDrawer = useNavigationStore(s => s.setShowMessagesDrawer)
  const { medics } = useClinicMedics()
  const profile = useAuthStore(s => s.profile)
  const { currentAvatar } = useProfileAvatar(localUserId ?? undefined)
  const [contextMenu, setContextMenu] = useState<{ key: string; x: number; y: number } | null>(null)

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
  const displayed = pinned.length > 0 ? pinned.slice(0, 3) : recentEntries.slice(0, 3)

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
    return (
      <div
        className="flex flex-col items-center justify-center gap-1.5 px-3 py-4 cursor-pointer active:bg-themeblue2/5"
        onClick={() => setShowMessagesDrawer(true)}
      >
        <MessageSquare size={18} className="text-tertiary/30" />
        <span className="text-xs text-secondary">No conversations</span>
        <span className="text-[10px] font-medium text-themeblue1">Open Messages</span>
      </div>
    )
  }

  return (
    <div className="divide-y divide-themeblue3/8">
      {displayed.map(entry => {
        const msgs = conversations[entry.key]
        const lastMsg = msgs?.filter(m => m.messageType !== 'request-accepted' && !m.threadId).at(-1)
        return (
          <ConvRow
            key={entry.key}
            entry={entry}
            lastText={lastMsg?.plaintext}
            unread={unreadCounts[entry.key] ?? 0}
            isPinned={pinnedKeys.has(entry.key)}
            onTap={() => openConversation(entry)}
            onContext={(x, y) => setContextMenu({ key: entry.key, x, y })}
          />
        )
      })}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            {
              key: 'pin',
              label: pinnedKeys.has(contextMenu.key) ? 'Unpin' : 'Pin',
              icon: Pin,
              onAction: () => { togglePinConversation(contextMenu.key); setContextMenu(null) },
            },
            {
              key: 'delete',
              label: 'Delete',
              icon: Trash2,
              destructive: true,
              onAction: () => { deleteConversation(contextMenu.key); setContextMenu(null) },
            },
          ]}
        />
      )}
    </div>
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
  const { isAuthenticated } = useAuth()
  const setShowCalendarDrawer = useNavigationStore(s => s.setShowCalendarDrawer)
  const openCalendarEvent = useNavigationStore(s => s.openCalendarEvent)
  const setShowMapOverlayDrawer = useNavigationStore(s => s.setShowMapOverlayDrawer)
  const events = useCalendarStore(s => s.events)
  const updateEvent = useCalendarStore(s => s.updateEvent)
  const userId = useAuthStore(s => s.user?.id)
  const isDevRole = useAuthStore(s => s.isDevRole)
  const overviewWidgets = useAuthStore(s => s.profile?.overviewWidgets)
  const { sendEvent: vaultSendEvent, deleteEvents: vaultDeleteEvents } = useCalendarVault()

  const [missionOverlayFeatures, setMissionOverlayFeatures] = useState<OverlayFeature[]>([])
  const [missionOverlayId, setMissionOverlayId] = useState<string | undefined>(undefined)
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [pickerOpen, setPickerOpen] = useState(false)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)
  const [contextMenu, setContextMenu] = useState<{ event: CalendarEvent; x: number; y: number } | null>(null)

  const dateBtnRef = useRef<HTMLButtonElement>(null)
  const ganttScrollRef = useRef<HTMLDivElement>(null)
  const weekViewElRef = useRef<HTMLDivElement | null>(null)
  const [weekViewMounted, setWeekViewMounted] = useState(false)
  const weekViewRef = useCallback((el: HTMLDivElement | null) => {
    weekViewElRef.current = el
    setWeekViewMounted(el !== null)
  }, [])

  useEffect(() => {
    const overlayIds = Array.from(
      new Set(
        events
          .filter(e => e.structured_location?.overlay_id)
          .map(e => e.structured_location!.overlay_id!)
      )
    )
    if (overlayIds.length === 0) {
      setMissionOverlayFeatures([])
      setMissionOverlayId(undefined)
      return
    }
    let cancelled = false
    Promise.all(overlayIds.map(id => getOverlay(id))).then(results => {
      if (cancelled) return
      const allFeatures: OverlayFeature[] = []
      for (const result of results) {
        if (result.ok && result.data) allFeatures.push(...result.data.features)
      }
      setMissionOverlayFeatures(allFeatures)
      setMissionOverlayId(overlayIds[0])
    })
    return () => { cancelled = true }
  }, [events])

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

  const openPicker = () => {
    setAnchorRect(dateBtnRef.current?.getBoundingClientRect() ?? null)
    setPickerOpen(true)
  }

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

  const DEFAULT_WIDGETS: OverviewWidgetId[] = ['gantt', 'messages']
  const widgets: OverviewWidgetId[] = (overviewWidgets ?? DEFAULT_WIDGETS).filter(
    id => id !== 'map-overlay' || isDevRole
  )

  const renderWidget = (id: OverviewWidgetId) => {
    switch (id) {
      case 'task-list':
        return (
          <div key="task-list" className="px-2.5 py-2 flex flex-col gap-1.5 min-h-[90px]">
            {myTasks.length === 0 ? (
              <div
                className="flex-1 flex flex-col items-center justify-center gap-1 cursor-pointer active:bg-themeblue2/5 rounded-lg py-2"
                onClick={() => setShowCalendarDrawer(true)}
              >
                <span className="text-xs text-secondary">No tasks today</span>
                <span className="text-[10px] font-medium text-themeblue1">Open Calendar</span>
              </div>
            ) : (
              <>
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
                    className="text-[10px] font-medium text-secondary text-left pl-2 py-0.5 active:text-themeblue1"
                  >
                    +{extraCount} more
                  </button>
                )}
              </>
            )}
          </div>
        )

      case 'map-overlay':
        return (
          <div key="map-overlay" className="h-[120px] p-1.5">
            <div className="w-full h-full rounded-lg overflow-hidden">
              <MissionMapCard
                overlayFeatures={missionOverlayFeatures}
                overlayId={missionOverlayId}
                onClick={() => setShowMapOverlayDrawer(true, missionOverlayId)}
              />
            </div>
          </div>
        )

      case 'gantt':
        return (
          <div key="gantt" className="overflow-hidden">
            <div className="h-[100px] overflow-hidden">
              <GanttBody
                scrollRef={ganttScrollRef}
                events={events}
                userId={userId}
                onEventClick={handleEventClick}
                onEventContextMenu={(event, x, y) => setContextMenu({ event, x, y })}
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
              />
            </div>
          </div>
        )

      case 'week-view': {
        const weekDays = getWeekDays(selectedDate)
        const todayKey = toDateKey(new Date())
        return (
          <div key="week-view" ref={weekViewRef} className="px-3 pt-1.5 pb-2">
            <div className="grid grid-cols-7 mb-1">
              {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((d, i) => (
                <div key={i} className="flex justify-center">
                  <span className="text-[9px] font-semibold uppercase text-secondary">{d}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-themeblue3/10 mb-1.5" />
            <div className="grid grid-cols-7">
              {weekDays.map((day) => {
                const key = toDateKey(day)
                const dayEvents = events.filter(e => eventFallsOnDate(e, key))
                const isTodayDay = key === todayKey
                const isSelected = key === dateKey
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedDate(day)}
                    className="flex flex-col items-center gap-1 py-px active:opacity-60 transition-opacity"
                  >
                    <div className={`w-8 h-8 flex items-center justify-center rounded-full ${
                      isSelected ? 'bg-themeblue3' : isTodayDay ? 'ring-1 ring-themeblue3' : ''
                    }`}>
                      <span className={`text-base font-medium tabular-nums leading-none ${
                        isSelected ? 'text-white' : 'text-primary'
                      }`}>
                        {day.getDate()}
                      </span>
                    </div>
                    <div className="flex flex-col gap-px w-full px-0.1 mt-1">
                      {dayEvents.slice(0, 3).map(e => (
                        <div
                          key={e.id}
                          className="flex items-center gap-1 w-full overflow-hidden py-0.5 px-0.5 rounded bg-themewhite2/60 active:opacity-60"
                          onClick={(ev) => { ev.stopPropagation(); handleEventClick(e.id) }}
                        >
                          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            e.status === 'completed'   ? 'bg-themegreen' :
                            e.status === 'in_progress' ? 'bg-themeyellow' :
                            e.status === 'cancelled'   ? 'bg-themeredred' :
                            'bg-secondary/50'
                          }`} />
                          <span className="text-[9px] leading-tight text-primary truncate">{e.title}</span>
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <span className="text-[10px] leading-tight text-secondary pl-1">+{dayEvents.length - 3}</span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )
      }

      case 'messages':
        return (
          <div key="messages">
            <MessagesWidget />
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="rounded-xl overflow-hidden border border-themeblue3/10 bg-themewhite2" data-tour="mission-overview-panel">

      {/* Header */}
      <div className="flex items-center px-2 py-1.5 border-b border-themeblue3/8">
        <div className="flex items-center gap-0.5">
          <button className="p-1 rounded active:bg-themeblue2/10 text-tertiary" onClick={() => navigate(-1)}>
            <ChevronLeft size={13} />
          </button>
          <button
            ref={dateBtnRef}
            className="text-xs font-medium text-primary py-0.5 px-1 rounded active:bg-themeblue2/10 whitespace-nowrap"
            onClick={openPicker}
          >
            {isToday ? 'Today' : formatDateLabel(selectedDate)}
          </button>
          <button className="p-1 rounded active:bg-themeblue2/10 text-tertiary" onClick={() => navigate(1)}>
            <ChevronRight size={13} />
          </button>
        </div>
      </div>

      {widgets.length === 0 ? (
        <div className="flex items-center justify-center h-[80px]">
          <span className="text-xs text-secondary">No widgets selected</span>
        </div>
      ) : (
        <div className="divide-y divide-themeblue3/8" data-tour="mission-overview-widgets">
          {widgets.map(id => renderWidget(id))}
        </div>
      )}

      <PreviewOverlay isOpen={pickerOpen} onClose={() => setPickerOpen(false)} anchorRect={anchorRect}>
        <DatePickerCalendar
          value={dateKey}
          onChange={(iso) => { setSelectedDate(new Date(iso + 'T00:00:00')); setPickerOpen(false) }}
          onClose={() => setPickerOpen(false)}
        />
      </PreviewOverlay>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={statusMenuItems(contextMenu.event, (status) => {
            handleStatusChange(contextMenu.event.id, status)
            setContextMenu(null)
          })}
        />
      )}

      {!standalone && (
        <div className="mt-2 border-t border-themeblue3/8" />
      )}
    </div>
  )
}
