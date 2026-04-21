import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { Clock, Plus, Users2, CalendarDays, X, Check, Pencil, Trash2, CalendarPlus, Play, CheckCircle2, Ban } from 'lucide-react'
import { ContextMenu, type ContextMenuItem } from '../ContextMenu'
import { useShallow } from 'zustand/react/shallow'
import { useIsMobile } from '../../Hooks/useIsMobile'
import { EventForm } from './EventForm'
import type { EventFormHandle } from './EventForm'
import { EventDetailPanel } from './EventDetailPanel'
import { DayView } from './DayView'
import { TroopsToTaskView } from './TroopsToTaskView'
import { InfiniteScrollCalendar } from './InfiniteScrollCalendar'
import { ConfirmDialog } from '../ConfirmDialog'
import { BaseDrawer } from '../BaseDrawer'
import { HeaderPill, PillButton } from '../HeaderPill'
import { useCalendarStore } from '../../stores/useCalendarStore'
import { useNavigationStore } from '../../stores/useNavigationStore'
import { useClinicMedics } from '../../Hooks/useClinicMedics'
import { useClinicGroupedMedics } from '../../Hooks/useClinicGroupedMedics'
import { usePropertyStore } from '../../stores/usePropertyStore'
import { useCalendarSync } from '../../Hooks/useCalendarSync'
import { useCalendarWrite } from '../../Hooks/useCalendarWrite'
import { LoadingSpinner } from '../LoadingSpinner'
import { useAuth } from '../../Hooks/useAuth'
import { getOverlays } from '../../lib/mapOverlayService'
import type { OverlayOption } from './EventForm'
import { MissionBoard } from '../Mission/MissionBoard'
import type { ResourceAllocation } from '../../Types/MissionTypes'
import { getInitials } from '../../Utilities/nameUtils'
import type { CalendarEvent, EventFormData, EventStatus } from '../../Types/CalendarTypes'
import {
  eventToFormData, toDateKey, eventFallsOnDate, generateId, createEmptyFormData,
} from '../../Types/CalendarTypes'

type PanelView = 'calendar' | 'detail' | 'form'
type DayDrawerView = 'detail' | 'edit'

interface CalendarPanelProps {
  onBack: () => void
  scrollNonce?: number
  onPanelStateChange?: (open: boolean) => void
  onOpenControls?: () => void
}

export function CalendarPanel({ onBack, scrollNonce, onPanelStateChange, onOpenControls }: CalendarPanelProps) {
  const isMobile = useIsMobile()
  const [panelView, setPanelView] = useState<PanelView>('calendar')
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)

  const calendarDrawerEventId = useNavigationStore(s => s.calendarDrawerEventId)
  const clearCalendarDrawerEventId = useNavigationStore(s => s.clearCalendarDrawerEventId)

  useEffect(() => {
    onPanelStateChange?.(panelView !== 'calendar')
  }, [panelView, onPanelStateChange])
  const eventFormRef = useRef<EventFormHandle>(null)

  const { clinicId, user } = useAuth()
  const { writeEvent, vaultUpdate, deleteEvent: calendarDeleteEvent, isWriting } = useCalendarWrite()
  const [isFormPending, setIsFormPending] = useState(false)

  // Kick off IDB hydration + vault subscription
  useCalendarSync()

  // Load overlay options for the event form
  useEffect(() => {
    if (!clinicId) return
    getOverlays(clinicId).then(result => {
      if (result.ok) {
        setOverlayOptions(result.data.map(o => ({ id: o.id, name: o.name })))
      }
    }).catch(() => {})
  }, [clinicId])

  const [overlayOptions, setOverlayOptions] = useState<OverlayOption[]>([])
  const [missionBoardEventId, setMissionBoardEventId] = useState<string | null>(null)

  const [confirmDeleteEvent, setConfirmDeleteEvent] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ eventId: string; x: number; y: number } | null>(null)
  const [dayContextMenu, setDayContextMenu] = useState<{ dateKey: string; x: number; y: number } | null>(null)
  const [newEventDateKey, setNewEventDateKey] = useState<string | undefined>(undefined)

  const [showDayDrawer, setShowDayDrawer] = useState(false)
  const [dayDrawerView, setDayDrawerView] = useState<DayDrawerView>('detail')
  const [dayDrawerEventId, setDayDrawerEventId] = useState<string | null>(null)

  const { medics: allMedics } = useClinicMedics()
  const { ownClinicMedics } = useClinicGroupedMedics(allMedics)

  // Medic name resolver — shared across detail panel and form
  const medicLookup = useMemo(() => {
    const map = new Map<string, { id: string; initials: string; name: string; credential?: string; avatarId?: string | null; firstName?: string | null; lastName?: string | null }>()
    for (const m of ownClinicMedics) {
      const rank = m.rank ? m.rank + ' ' : ''
      const last = m.lastName ?? ''
      const first = m.firstName ? ', ' + m.firstName.charAt(0) + '.' : ''
      map.set(m.id, {
        id: m.id,
        initials: getInitials(m.firstName, m.lastName),
        name: rank + last + first,
        credential: m.credential ?? undefined,
        avatarId: m.avatarId,
        firstName: m.firstName,
        lastName: m.lastName,
      })
    }
    return map
  }, [ownClinicMedics])

  const medicList = useMemo(() => Array.from(medicLookup.values()), [medicLookup])

  const propertyStoreItems = usePropertyStore(s => s.items)
  const propertyItems = useMemo(() =>
    propertyStoreItems.filter(i => !i.parent_item_id).map(i => ({
      id: i.id,
      name: i.name,
      nsn: i.nsn,
      serial_number: i.serial_number,
    })),
    [propertyStoreItems]
  )

  const resolveAssigned = useCallback((ids: string[]) =>
    ids.map(id => medicLookup.get(id) ?? { id, initials: '?', name: 'Unknown' }),
    [medicLookup]
  )

  const resolvePropertyItems = useCallback((ids: string[]) =>
    ids.map(id => {
      const item = propertyStoreItems.find(i => i.id === id)
      return item ? { id: item.id, name: item.name, nsn: item.nsn } : { id, name: 'Unknown Item', nsn: null }
    }),
    [propertyStoreItems]
  )

  const {
    viewMode, setViewMode,
    events,
    selectedEventId, selectEvent,
    assignPersonnel, unassignPersonnel,
    personnelFilter,
    setMonthLabel,
    selectedDateStr, storeSetSelectedDate,
    vaultReplayDone,
    hydrationError, clearHydrationError,
  } = useCalendarStore(useShallow(s => ({
    viewMode: s.currentView,
    setViewMode: s.setView,
    events: s.events,
    selectedEventId: s.selectedEventId,
    selectEvent: s.selectEvent,
    assignPersonnel: s.assignPersonnel,
    unassignPersonnel: s.unassignPersonnel,
    personnelFilter: s.personnelFilter,
    setMonthLabel: s.setMonthLabel,
    selectedDateStr: s.selectedDate,
    storeSetSelectedDate: s.setSelectedDate,
    vaultReplayDone: s.vaultReplayDone,
    hydrationError: s.hydrationError,
    clearHydrationError: s.clearHydrationError,
  })))

  // Deep-link from external sources (e.g. Mission Board) — open specific event in detail view
  useEffect(() => {
    if (!calendarDrawerEventId) return
    selectEvent(calendarDrawerEventId)
    if (isMobile) {
      setDayDrawerEventId(calendarDrawerEventId)
      setDayDrawerView('detail')
      setShowDayDrawer(true)
    } else {
      setPanelView('detail')
    }
    clearCalendarDrawerEventId()
  }, [calendarDrawerEventId]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectedDate = useMemo(() => new Date(selectedDateStr + 'T00:00:00'), [selectedDateStr])
  const setSelectedDate = useCallback((d: Date) => storeSetSelectedDate(toDateKey(d)), [storeSetSelectedDate])

  const selectedDateKey = toDateKey(selectedDate)

  const filteredEvents = useMemo(() => {
    if (personnelFilter.length === 0) return events
    return events.filter(e =>
      e.assigned_to.length === 0 || e.assigned_to.some(id => personnelFilter.includes(id))
    )
  }, [events, personnelFilter])

  const dayEvents = useMemo(() =>
    filteredEvents
      .filter(e => eventFallsOnDate(e, selectedDateKey))
      .sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [filteredEvents, selectedDateKey]
  )

  const selectedEvent = useMemo(() =>
    selectedEventId ? events.find(e => e.id === selectedEventId) ?? null : null,
    [events, selectedEventId]
  )

  // ── Date selection ──

  const handleSelectDate = useCallback((date: Date) => {
    setSelectedDate(date)
    if (viewMode === 'month') {
      setViewMode('day')
    }
  }, [viewMode])

  const handlePrevDay = useCallback(() => {
    const prev = new Date(selectedDate)
    prev.setDate(prev.getDate() - 1)
    setSelectedDate(prev)
  }, [selectedDate, setSelectedDate])

  const handleNextDay = useCallback(() => {
    const next = new Date(selectedDate)
    next.setDate(next.getDate() + 1)
    setSelectedDate(next)
  }, [selectedDate, setSelectedDate])


  // ── Event CRUD ──

  const handleSelectEvent = useCallback((id: string) => {
    if (isMobile) {
      setDayDrawerEventId(id)
      setDayDrawerView('detail')
      setShowDayDrawer(true)
    } else {
      selectEvent(id)
      setPanelView('detail')
    }
  }, [isMobile, selectEvent])

  const handleNewEvent = useCallback((forDateKey?: string) => {
    setEditingEvent(null)
    setNewEventDateKey(forDateKey ?? selectedDateStr)
    setPanelView('form')
  }, [selectedDateStr])

  const handleEditEvent = useCallback((id: string) => {
    const event = events.find(e => e.id === id)
    if (event) {
      setEditingEvent(event)
      setPanelView('form')
    }
  }, [events])

  const handleSaveEvent = useCallback(async (data: EventFormData) => {
    const now = new Date().toISOString()
    setIsFormPending(true)
    try {
      if (editingEvent) {
        const updatedEvent: CalendarEvent = {
          ...editingEvent,
          title: data.title,
          description: data.description || null,
          category: data.category,
          status: data.status,
          start_time: data.start_time,
          end_time: data.end_time,
          all_day: data.all_day,
          location: data.location || null,
          uniform: data.uniform || null,
          report_time: data.report_time || null,
          assigned_to: data.assigned_to,
          property_item_ids: data.property_item_ids,
          structured_location: data.structured_location ?? null,
          updated_at: now,
        }
        await writeEvent(updatedEvent)
      } else {
        const newEvent: CalendarEvent = {
          id: generateId(),
          clinic_id: clinicId ?? '',
          title: data.title,
          description: data.description || null,
          category: data.category,
          status: 'pending',
          start_time: data.start_time,
          end_time: data.end_time,
          all_day: data.all_day,
          location: data.location || null,
          opord_notes: null,
          uniform: data.uniform || null,
          report_time: data.report_time || null,
          assigned_to: data.assigned_to,
          property_item_ids: data.property_item_ids,
          structured_location: data.structured_location ?? null,
          created_by: user?.id ?? '',
          created_at: now,
          updated_at: now,
        }
        await writeEvent(newEvent)
      }
    } finally {
      setIsFormPending(false)
    }
    setEditingEvent(null)
    setPanelView('calendar')
  }, [editingEvent, writeEvent, clinicId, user])

  const handleMoveEvent = useCallback((eventId: string, newStartTime: string) => {
    const events = useCalendarStore.getState().events
    const event = events.find(e => e.id === eventId)
    if (!event) return
    const originalStart = new Date(event.start_time)
    const originalEnd = new Date(event.end_time)
    const durationMs = originalEnd.getTime() - originalStart.getTime()
    const newStart = new Date(newStartTime)
    const newEnd = new Date(newStart.getTime() + durationMs)
    const movedEvent: CalendarEvent = {
      ...event,
      start_time: newStartTime,
      end_time: newEnd.toISOString().slice(0, 16),
      updated_at: new Date().toISOString(),
    }
    useCalendarStore.getState().updateEvent(eventId, movedEvent)
    vaultUpdate(movedEvent)
  }, [vaultUpdate])

  const handleMoveEventToDate = useCallback((eventId: string, targetDateKey: string) => {
    const events = useCalendarStore.getState().events
    const event = events.find(e => e.id === eventId)
    if (!event) return
    const originalStart = new Date(event.start_time)
    const originalEnd = new Date(event.end_time)
    const durationMs = originalEnd.getTime() - originalStart.getTime()
    const [y, m, d] = targetDateKey.split('-').map(Number)
    const newStart = new Date(originalStart)
    newStart.setFullYear(y, m - 1, d)
    const newEnd = new Date(newStart.getTime() + durationMs)
    const pad = (n: number) => String(n).padStart(2, '0')
    const toISO = (dt: Date) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`
    const movedEvent: CalendarEvent = {
      ...event,
      start_time: toISO(newStart),
      end_time: toISO(newEnd),
      updated_at: new Date().toISOString(),
    }
    useCalendarStore.getState().updateEvent(eventId, movedEvent)
    vaultUpdate(movedEvent)
  }, [vaultUpdate])

  const handleDeleteEvent = useCallback((id: string) => {
    calendarDeleteEvent(id)
    setPanelView('calendar')
  }, [calendarDeleteEvent])

  const handleFormCancel = useCallback(() => {
    setEditingEvent(null)
    setPanelView(selectedEventId ? 'detail' : 'calendar')
  }, [selectedEventId])

  const handleDetailBack = useCallback(() => {
    selectEvent(null)
    setPanelView('calendar')
  }, [selectEvent])

  const handleOpenMissionBoard = useCallback((eventId: string) => {
    setMissionBoardEventId(eventId)
    if (!isMobile) setPanelView('detail') // keep detail open on desktop; board replaces it
  }, [isMobile])

  const handleCloseMissionBoard = useCallback(() => {
    setMissionBoardEventId(null)
  }, [])

  const handleSaveMissionBoard = useCallback((allocations: ResourceAllocation[]) => {
    if (!missionBoardEventId) return
    const event = useCalendarStore.getState().events.find(e => e.id === missionBoardEventId)
    if (!event) return
    const updatedEvent: CalendarEvent = {
      ...event,
      resource_allocations: allocations,
      updated_at: new Date().toISOString(),
    }
    useCalendarStore.getState().updateEvent(missionBoardEventId, updatedEvent)
    vaultUpdate(updatedEvent)
    setMissionBoardEventId(null)
  }, [missionBoardEventId, vaultUpdate])

  const handleStatusChange = useCallback((eventId: string, status: EventStatus) => {
    const event = useCalendarStore.getState().events.find(e => e.id === eventId)
    if (!event) return
    const updatedEvent: CalendarEvent = { ...event, status, updated_at: new Date().toISOString() }
    useCalendarStore.getState().updateEvent(eventId, updatedEvent)
    vaultUpdate(updatedEvent)
    setContextMenu(null)
  }, [vaultUpdate])

  const handleEventContextMenu = useCallback((eventId: string, x: number, y: number) => {
    if (isMobile) return
    setContextMenu({ eventId, x, y })
  }, [isMobile])

  const handleDayContextMenu = useCallback((dateKey: string, x: number, y: number) => {
    setDayContextMenu({ dateKey, x, y })
  }, [])

  // ── Day drawer handlers (mobile) ──

  const handleDayDrawerClose = useCallback(() => {
    setShowDayDrawer(false)
    setDayDrawerEventId(null)
    setDayDrawerView('detail')
  }, [])

  const handleDayDrawerEdit = useCallback((id: string) => {
    const event = events.find(e => e.id === id)
    if (event) {
      setEditingEvent(event)
      setDayDrawerView('edit')
    }
  }, [events])

  const handleDayDrawerSave = useCallback(async (data: EventFormData) => {
    if (!editingEvent) return
    const now = new Date().toISOString()
    const updatedEvent: CalendarEvent = {
      ...editingEvent,
      title: data.title,
      description: data.description || null,
      category: data.category,
      status: data.status,
      start_time: data.start_time,
      end_time: data.end_time,
      all_day: data.all_day,
      location: data.location || null,
      uniform: data.uniform || null,
      report_time: data.report_time || null,
      assigned_to: data.assigned_to,
      property_item_ids: data.property_item_ids,
      structured_location: data.structured_location ?? null,
      updated_at: now,
    }
    setIsFormPending(true)
    try {
      await writeEvent(updatedEvent)
    } finally {
      setIsFormPending(false)
    }
    setEditingEvent(null)
    setDayDrawerView('detail')
  }, [editingEvent, writeEvent])

  const handleDayDrawerEditCancel = useCallback(() => {
    setEditingEvent(null)
    setDayDrawerView('detail')
  }, [])

  const handleDayDrawerDetailBack = useCallback(() => {
    setShowDayDrawer(false)
    setDayDrawerEventId(null)
    setDayDrawerView('detail')
  }, [])

  const dayDrawerEvent = useMemo(() =>
    dayDrawerEventId ? events.find(e => e.id === dayDrawerEventId) ?? null : null,
    [events, dayDrawerEventId]
  )

  // ── Sub-views (form / detail) — desktop: full panel replacement ──

  // ConfirmDialog must render in every branch — extract as a shared element
  const deleteConfirmDialog = (
    <ConfirmDialog
      visible={!!confirmDeleteEvent}
      title="Delete event?"
      subtitle="Permanent. Removed for all clinic members."
      confirmLabel="Delete"
      variant="danger"
      onConfirm={() => {
        if (confirmDeleteEvent) {
          handleDeleteEvent(confirmDeleteEvent)
          setConfirmDeleteEvent(null)
          setEditingEvent(null)
          setShowDayDrawer(false)
        }
      }}
      onCancel={() => setConfirmDeleteEvent(null)}
    />
  )

  // ── Calendar views ──

  const showFormDrawer = isMobile && panelView === 'form'
  const showDesktopPanel = !isMobile && (panelView === 'detail' || panelView === 'form' || !!missionBoardEventId)

  return (
    <>
      <div className="relative h-full flex">
        {/* Vault sync banner — mirrors messaging's "Setting up encryption…" pattern */}
        {!vaultReplayDone && (
          <div className="absolute top-0 inset-x-0 z-30 flex items-center gap-2 px-3 py-2 bg-themeblue3/10 border-b border-themeblue3/20">
            <div className="w-3 h-3 border-2 border-themeblue3 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-themeblue3 font-medium">Syncing calendar…</span>
          </div>
        )}
        {/* Vault hydration error banner */}
        {hydrationError && (
          <div className="absolute top-0 inset-x-0 z-30 flex items-center justify-between gap-2 px-3 py-2 bg-amber-100 border-b border-amber-300 text-amber-900 text-xs">
            <span>Some calendar events could not be decrypted. They may appear after the next sync.</span>
            <button onClick={clearHydrationError} className="shrink-0 text-amber-700 hover:text-amber-900 font-medium">
              Dismiss
            </button>
          </div>
        )}
        {/* Calendar — always visible */}
        <div className="flex-1 min-w-0 relative">
          <div className="absolute inset-0 flex flex-col">
            {viewMode === 'month' && (
              <InfiniteScrollCalendar
                events={filteredEvents}
                selectedDate={selectedDate}
                onSelectDate={handleSelectDate}
                onMonthChange={setMonthLabel}
                onMoveEvent={handleMoveEventToDate}
                onSelectEvent={handleSelectEvent}
                onEventContextMenu={handleEventContextMenu}
                onDayContextMenu={handleDayContextMenu}
                scrollTargetDate={selectedDateStr}
                scrollNonce={scrollNonce}
              />
            )}

            {viewMode === 'day' && (
              <DayView
                date={selectedDate}
                events={dayEvents}
                onSelectEvent={handleSelectEvent}
                onMoveEvent={handleMoveEvent}
                onEventContextMenu={handleEventContextMenu}
                onDayContextMenu={handleDayContextMenu}
                {...(isMobile ? {
                  onPrevDay: handlePrevDay,
                  onNextDay: handleNextDay,
                  onDateTap: onOpenControls,
                } : {})}
              />
            )}

            {viewMode === 'troops' && (
              <TroopsToTaskView
                date={selectedDate}
                events={filteredEvents}
                medics={ownClinicMedics}
                onSelectEvent={handleSelectEvent}
                onAssign={assignPersonnel}
                onUnassign={unassignPersonnel}
                onDateChange={setSelectedDate}
              />
            )}
          </div>

          <div className="absolute bottom-4 inset-x-0 flex items-center justify-center z-20 pointer-events-none pb-[max(0rem,var(--sab,0px))]">
            <div data-tour="calendar-view-switcher" className="flex items-center gap-1.5 rounded-full bg-themewhite border border-tertiary/20 px-0.5 py-0.5 shadow-lg pointer-events-auto">
              <button
                data-tour="calendar-view-month"
                onClick={() => setViewMode('month')}
                className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 active:scale-95 ${
                  viewMode === 'month' ? 'bg-themeblue3 text-white' : 'text-tertiary hover:text-primary'
                }`}
                title="Month"
              >
                <CalendarDays className="w-5 h-5" />
              </button>
              <button
                data-tour="calendar-view-day"
                onClick={() => setViewMode('day')}
                className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 active:scale-95 ${
                  viewMode === 'day' ? 'bg-themeblue3 text-white' : 'text-tertiary hover:text-primary'
                }`}
                title="Day"
              >
                <Clock className="w-5 h-5" />
              </button>
              <button
                data-tour="calendar-view-troops"
                onClick={() => setViewMode('troops')}
                className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 active:scale-95 ${
                  viewMode === 'troops' ? 'bg-themeblue3 text-white' : 'text-tertiary hover:text-primary'
                }`}
                title="Troops to Task"
              >
                <Users2 className="w-5 h-5" />
              </button>
            </div>
            <div className="absolute right-4 rounded-full border border-tertiary/20 p-0.5 bg-themewhite shadow-lg pointer-events-auto">
              <button
                data-tour="calendar-add-event"
                onClick={() => handleNewEvent()}
                disabled={!vaultReplayDone}
                className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 ${
                  vaultReplayDone ? 'bg-themeblue3 text-white active:scale-95' : 'bg-tertiary/30 text-tertiary cursor-not-allowed'
                }`}
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Mobile form drawer — uses BaseDrawer for consistent animation/drag */}
          <BaseDrawer
            isVisible={showFormDrawer}
            onClose={handleFormCancel}
            mobileOnly
            fullHeight="85dvh"
            zIndex="z-50"
            header={{
              title: editingEvent ? 'Edit Event' : 'New Event',
              rightContent: (
                <HeaderPill>
                  {editingEvent && (
                    <PillButton icon={Trash2} iconSize={18} onClick={() => setConfirmDeleteEvent(editingEvent.id)} label="Delete" variant="danger" />
                  )}
                  <PillButton icon={X} iconSize={18} onClick={handleFormCancel} label="Cancel" />
                  <PillButton
                    icon={Check}
                    iconSize={18}
                    circleBg="bg-themegreen text-white"
                    onClick={() => eventFormRef.current?.submit()}
                    label="Save"
                  />
                </HeaderPill>
              ),
              hideDefaultClose: true,
            }}
          >
            <div className="relative h-full">
              <EventForm
                ref={eventFormRef}
                initialData={editingEvent ? eventToFormData(editingEvent) : createEmptyFormData(newEventDateKey)}
                onSave={handleSaveEvent}
                isEditing={!!editingEvent}
                medics={medicList}
                propertyItems={propertyItems}
                overlayOptions={overlayOptions}
              />
              {(isFormPending || isWriting) && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm rounded-xl">
                  <LoadingSpinner size="md" />
                </div>
              )}
            </div>
          </BaseDrawer>

          {/* Mobile event drawer — tap an event to view/edit */}
          <BaseDrawer
            isVisible={showDayDrawer}
            onClose={handleDayDrawerClose}
            mobileOnly
            fullHeight="85dvh"
            zIndex="z-50"
            header={dayDrawerView === 'edit' ? {
              title: 'Edit Event',
              rightContent: (
                <HeaderPill>
                  {editingEvent && (
                    <PillButton icon={Trash2} iconSize={18} onClick={() => setConfirmDeleteEvent(editingEvent.id)} label="Delete" variant="danger" />
                  )}
                  <PillButton icon={X} iconSize={18} onClick={handleDayDrawerEditCancel} label="Cancel" />
                  <PillButton
                    icon={Check}
                    iconSize={18}
                    circleBg="bg-themegreen text-white"
                    onClick={() => eventFormRef.current?.submit()}
                    label="Save"
                  />
                </HeaderPill>
              ),
              hideDefaultClose: true,
            } : {
              title: dayDrawerEvent?.title ?? '',
              rightContent: dayDrawerEvent ? (
                <HeaderPill>
                  <PillButton icon={Pencil} iconSize={16} onClick={() => handleDayDrawerEdit(dayDrawerEvent.id)} label="Edit" />
                  <PillButton icon={X} iconSize={16} onClick={handleDayDrawerDetailBack} label="Close" />
                </HeaderPill>
              ) : undefined,
              hideDefaultClose: true,
            }}
          >
            <div className="relative h-full">
              {dayDrawerView === 'detail' && dayDrawerEvent && (
                <EventDetailPanel
                  event={dayDrawerEvent}
                  onClose={handleDayDrawerDetailBack}
                  onEdit={handleDayDrawerEdit}
                  onDelete={(id) => {
                    handleDeleteEvent(id)
                    handleDayDrawerClose()
                  }}
                  onOpenMissionBoard={() => {
                    handleDayDrawerClose()
                    handleOpenMissionBoard(dayDrawerEvent.id)
                  }}
                  assignedNames={resolveAssigned(dayDrawerEvent.assigned_to)}
                  linkedPropertyItems={resolvePropertyItems(dayDrawerEvent.property_item_ids ?? [])}
                  hideHeader
                />
              )}

              {dayDrawerView === 'edit' && editingEvent && (
                <EventForm
                  ref={eventFormRef}
                  initialData={eventToFormData(editingEvent)}
                  onSave={handleDayDrawerSave}
                  isEditing
                  medics={medicList}
                />
              )}

              {(isFormPending || isWriting) && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm rounded-xl">
                  <LoadingSpinner size="md" />
                </div>
              )}
            </div>
          </BaseDrawer>

          {/* Mobile Mission Board drawer */}
          {(() => {
            const missionEvent = missionBoardEventId ? events.find(e => e.id === missionBoardEventId) : null
            return missionEvent ? (
              <BaseDrawer
                isVisible={!!missionBoardEventId}
                onClose={handleCloseMissionBoard}
                mobileOnly
                fullHeight="92dvh"
                zIndex="z-50"
                header={{ title: 'Mission Board', hideDefaultClose: true }}
              >
                <div className="h-full px-3 py-3">
                  <MissionBoard
                    event={missionEvent}
                    medics={medicList.map(m => ({ id: m.id, name: m.name }))}
                    onClose={handleCloseMissionBoard}
                    onSave={handleSaveMissionBoard}
                  />
                </div>
              </BaseDrawer>
            ) : null
          })()}

        </div>

        {/* Desktop right panel — form or detail alongside calendar */}
        {!isMobile && (
          <div className={`shrink-0 border-l border-primary/10 flex flex-col bg-themewhite3 transition-all duration-300 ${
            showDesktopPanel ? 'w-[380px] opacity-100' : 'w-0 opacity-0 overflow-hidden border-l-0'
          }`}>
            {showDesktopPanel && (
              panelView === 'form' ? (
                <div className="relative flex flex-col flex-1 min-h-0">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-tertiary/10">
                    <h2 className="text-sm font-semibold text-primary whitespace-nowrap">
                      {editingEvent ? 'Edit Event' : 'New Event'}
                    </h2>
                    <HeaderPill>
                      {editingEvent && (
                        <PillButton icon={Trash2} iconSize={18} onClick={() => setConfirmDeleteEvent(editingEvent.id)} label="Delete" variant="danger" />
                      )}
                      <PillButton icon={X} iconSize={18} onClick={handleFormCancel} label="Cancel" />
                      <PillButton
                        icon={Check}
                        iconSize={18}
                        circleBg="bg-themegreen text-white"
                        onClick={() => eventFormRef.current?.submit()}
                        label="Save"
                      />
                    </HeaderPill>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto">
                    <EventForm
                      ref={eventFormRef}
                      initialData={editingEvent ? eventToFormData(editingEvent) : createEmptyFormData(newEventDateKey)}
                      onSave={handleSaveEvent}
                      isEditing={!!editingEvent}
                      medics={medicList}
                      propertyItems={propertyItems}
                    />
                  </div>
                  {(isFormPending || isWriting) && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm rounded-xl">
                      <LoadingSpinner size="md" />
                    </div>
                  )}
                </div>
              ) : panelView === 'detail' && selectedEvent && !missionBoardEventId ? (
                <EventDetailPanel
                  event={selectedEvent}
                  onClose={handleDetailBack}
                  onEdit={handleEditEvent}
                  onDelete={handleDeleteEvent}
                  onOpenMissionBoard={() => handleOpenMissionBoard(selectedEvent.id)}
                  assignedNames={resolveAssigned(selectedEvent.assigned_to)}
                  linkedPropertyItems={resolvePropertyItems(selectedEvent.property_item_ids ?? [])}
                />
              ) : panelView === 'detail' && missionBoardEventId ? (() => {
                const missionEvent = events.find(e => e.id === missionBoardEventId)
                return missionEvent ? (
                  <MissionBoard
                    event={missionEvent}
                    medics={medicList.map(m => ({ id: m.id, name: m.name }))}
                    onClose={handleCloseMissionBoard}
                    onSave={handleSaveMissionBoard}
                  />
                ) : null
              })() : null
            )}
          </div>
        )}
      </div>

      {deleteConfirmDialog}

      {contextMenu && (() => {
        const ctxEvent = events.find(e => e.id === contextMenu.eventId)
        const statusItems: ContextMenuItem[] = ctxEvent ? [
          ...(ctxEvent.status !== 'pending'     ? [{ key: 'status-pending',     label: 'Pending',      icon: Clock,        onAction: () => handleStatusChange(contextMenu.eventId, 'pending') }] : []),
          ...(ctxEvent.status !== 'in_progress' ? [{ key: 'status-inprogress',  label: 'Active',       icon: Play,         onAction: () => handleStatusChange(contextMenu.eventId, 'in_progress') }] : []),
          ...(ctxEvent.status !== 'completed'   ? [{ key: 'status-completed',   label: 'Done',         icon: CheckCircle2, onAction: () => handleStatusChange(contextMenu.eventId, 'completed') }] : []),
          ...(ctxEvent.status !== 'cancelled'   ? [{ key: 'status-cancelled',   label: 'Cancel',       icon: Ban,          onAction: () => handleStatusChange(contextMenu.eventId, 'cancelled'), destructive: true }] : []),
        ] : []
        return (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
            items={[
              ...statusItems,
              { key: 'edit',   label: 'Edit',   icon: Pencil, onAction: () => handleEditEvent(contextMenu.eventId) },
              { key: 'delete', label: 'Delete', icon: Trash2, destructive: true, onAction: () => setConfirmDeleteEvent(contextMenu.eventId) },
            ]}
          />
        )
      })()}

      {dayContextMenu && (
        <ContextMenu
          x={dayContextMenu.x}
          y={dayContextMenu.y}
          onClose={() => setDayContextMenu(null)}
          items={[
            { key: 'add', label: 'Add Event', icon: CalendarPlus, onAction: () => handleNewEvent(dayContextMenu.dateKey) },
          ]}
        />
      )}
    </>
  )
}
