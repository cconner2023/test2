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
import { useMessagingStore } from '../../stores/useMessagingStore'
import { useClinicMedics } from '../../Hooks/useClinicMedics'
import { useLongPress } from '../../Hooks/useLongPress'
import { getDisplayName } from '../../Utilities/nameUtils'
import { UserAvatar } from '../Settings/UserAvatar'
import type { ClinicMedic } from '../../Types/SupervisorTestTypes'
import type { GroupInfo } from '../../lib/signal/groupTypes'
import { MissionMapCard } from './MissionMapCard'
import {
  TaskRow, GanttBody, statusMenuItems,
  formatDateLabel, offsetDate,
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
  const name = entry.type === 'group' && entry.group
    ? entry.group.name
    : entry.medic ? getDisplayName(entry.medic) : '?'

  return (
    <div
      className="flex items-center gap-2.5 px-3 py-2.5 active:bg-themeblue2/5 cursor-pointer select-none"
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
        {lastText && <p className="text-[10px] text-tertiary/60 truncate">{lastText}</p>}
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
  const [contextMenu, setContextMenu] = useState<{ key: string; x: number; y: number } | null>(null)

  const pinnedKeys = useMemo(() => new Set(pinnedKeysArr), [pinnedKeysArr])

  const recentEntries = useMemo<ConvEntry[]>(() => {
    const entries: ConvEntry[] = []
    const medicMap = new Map(medics.map(m => [m.id, m]))
    for (const [key, msgs] of Object.entries(conversations)) {
      if (key === localUserId) continue
      if (groups[key]?.systemType) continue
      const visibleMsgs = msgs.filter(m => m.messageType !== 'request-accepted' && !m.threadId)
      if (visibleMsgs.length === 0) continue
      const lastTime = visibleMsgs.at(-1)?.createdAt ?? ''
      if (groups[key]) {
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
    if (entry.type === 'group' && entry.group) {
      openMessagesConversation(null, entry.group.groupId, entry.group.name)
    } else if (entry.medic) {
      openMessagesConversation(entry.medic.id, null, getDisplayName(entry.medic))
    }
  }, [openMessagesConversation])

  if (displayed.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 px-3 py-4">
        <MessageSquare size={18} className="text-tertiary/30" />
        <span className="text-xs text-secondary">No conversations</span>
        <button
          onClick={() => setShowMessagesDrawer(true)}
          className="text-[10px] font-medium text-themeblue1 active:opacity-60"
        >
          Open Messages
        </button>
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
  const { isAuthenticated, isDevRole } = useAuth()
  const setShowCalendarDrawer = useNavigationStore(s => s.setShowCalendarDrawer)
  const setShowMapOverlayDrawer = useNavigationStore(s => s.setShowMapOverlayDrawer)
  const selectEvent = useCalendarStore(s => s.selectEvent)
  const events = useCalendarStore(s => s.events)
  const updateEvent = useCalendarStore(s => s.updateEvent)
  const userId = useAuthStore(s => s.user?.id)
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
    selectEvent(eventId)
    setShowCalendarDrawer(true)
  }, [selectEvent, setShowCalendarDrawer])

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

  if (!isAuthenticated || !isDevRole) return null
  if (overviewWidgets === null) return null

  // undefined = user hasn't customized → default side-by-side layout
  const widgets: OverviewWidgetId[] | undefined = overviewWidgets

  const renderWidget = (id: OverviewWidgetId) => {
    switch (id) {
      case 'task-list':
        return (
          <div key="task-list" className="px-2.5 py-2 flex flex-col gap-1.5 min-h-[90px]">
            {myTasks.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <span className="text-xs text-secondary">No tasks today</span>
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
            {allDayEvents.length === 0 ? (
              <div className="flex items-center justify-center h-[80px]">
                <span className="text-xs text-secondary">No events today</span>
              </div>
            ) : (
              <div className="h-[100px] overflow-hidden">
                <GanttBody
                  scrollRef={ganttScrollRef}
                  events={allDayEvents}
                  userId={userId}
                  onEventClick={handleEventClick}
                  onEventContextMenu={(event, x, y) => setContextMenu({ event, x, y })}
                  selectedDate={selectedDate}
                />
              </div>
            )}
          </div>
        )

      case 'week-view': {
        const weekDays = getWeekDays(selectedDate)
        const todayKey = toDateKey(new Date())
        return (
          <div key="week-view" className="px-3 pt-2.5 pb-3">
            <div className="grid grid-cols-7 mb-1">
              {['M','T','W','T','F','S','S'].map((d, i) => (
                <div key={i} className="flex justify-center">
                  <span className="text-[9px] font-semibold uppercase text-secondary">{d}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-themeblue3/10 mb-1.5" />
            <div className="grid grid-cols-7">
              {weekDays.map((day) => {
                const key = toDateKey(day)
                const count = events.filter(e => eventFallsOnDate(e, key)).length
                const isTodayDay = key === todayKey
                const isSelected = key === dateKey && !isTodayDay
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedDate(day)}
                    className="flex flex-col items-center gap-0.5 py-0.5 active:opacity-60 transition-opacity"
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
                    {count > 0 && (
                      <span className="w-1 h-1 rounded-full bg-secondary" />
                    )}
                  </button>
                )
              })}
            </div>
            <div className="border-t border-themeblue3/8 mt-2 pt-2 flex flex-col gap-1.5">
              {myTasks.length === 0 ? (
                <p className="text-xs text-secondary text-center py-1">No tasks</p>
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
    <div className="rounded-xl overflow-hidden border border-themeblue3/10 bg-themewhite2">

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

      {widgets === undefined ? (
        /* Default layout — side-by-side tasks + map */
        <div className="flex min-h-[110px]">
          <div className="flex-1 min-w-0 px-2.5 py-2 flex flex-col gap-1.5">
            {myTasks.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <span className="text-xs text-secondary">No tasks today</span>
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

          <div className="w-[128px] shrink-0 border-l border-themeblue3/10 p-1.5 bg-white dark:bg-themewhite2">
            <div className="w-full h-full rounded-lg overflow-hidden">
              <MissionMapCard
                overlayFeatures={missionOverlayFeatures}
                overlayId={missionOverlayId}
                onClick={() => setShowMapOverlayDrawer(true, missionOverlayId)}
              />
            </div>
          </div>
        </div>
      ) : widgets.length === 0 ? (
        <div className="flex items-center justify-center h-[80px]">
          <span className="text-xs text-secondary">No widgets selected</span>
        </div>
      ) : (
        /* Custom widget stack */
        <div className="divide-y divide-themeblue3/8">
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
