import { useState, useCallback, useMemo, useRef } from 'react'
import { Clock, Plus, Users2, CalendarDays, X, Check } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useIsMobile } from '../../Hooks/useIsMobile'
import { EventForm } from './EventForm'
import type { EventFormHandle } from './EventForm'
import { EventDetailPanel } from './EventDetailPanel'
import { DayView } from './DayView'
import { TroopsToTaskView } from './TroopsToTaskView'
import { InfiniteScrollCalendar } from './InfiniteScrollCalendar'
import { BaseDrawer } from '../BaseDrawer'
import { HeaderPill, PillButton } from '../HeaderPill'
import { useCalendarStore } from '../../stores/useCalendarStore'
import { useClinicMedics } from '../../Hooks/useClinicMedics'
import { useClinicGroupedMedics } from '../../Hooks/useClinicGroupedMedics'
import type { CalendarEvent, EventFormData } from '../../Types/CalendarTypes'
import {
  eventToFormData, toDateKey, eventFallsOnDate, generateId,
} from '../../Types/CalendarTypes'

type PanelView = 'calendar' | 'detail' | 'form'

interface CalendarPanelProps {
  onBack: () => void
}

export function CalendarPanel({ onBack }: CalendarPanelProps) {
  const isMobile = useIsMobile()
  const [panelView, setPanelView] = useState<PanelView>('calendar')
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
  const eventFormRef = useRef<EventFormHandle>(null)

  const { medics: allMedics } = useClinicMedics()
  const { ownClinicMedics } = useClinicGroupedMedics(allMedics)

  const {
    viewMode, setViewMode,
    events, addEvent, updateEvent, removeEvent,
    selectedEventId, selectEvent,
    assignPersonnel, unassignPersonnel,
    personnelFilter,
    setMonthLabel,
  } = useCalendarStore(useShallow(s => ({
    viewMode: s.currentView,
    setViewMode: s.setView,
    events: s.events,
    addEvent: s.addEvent,
    updateEvent: s.updateEvent,
    removeEvent: s.removeEvent,
    selectedEventId: s.selectedEventId,
    selectEvent: s.selectEvent,
    assignPersonnel: s.assignPersonnel,
    unassignPersonnel: s.unassignPersonnel,
    personnelFilter: s.personnelFilter,
    setMonthLabel: s.setMonthLabel,
  })))

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

  // ── Event CRUD ──

  const handleSelectEvent = useCallback((id: string) => {
    selectEvent(id)
    setPanelView('detail')
  }, [selectEvent])

  const handleNewEvent = useCallback(() => {
    setEditingEvent(null)
    setPanelView('form')
  }, [])

  const handleEditEvent = useCallback((id: string) => {
    const event = events.find(e => e.id === id)
    if (event) {
      setEditingEvent(event)
      setPanelView('form')
    }
  }, [events])

  const handleSaveEvent = useCallback((data: EventFormData) => {
    if (editingEvent) {
      updateEvent(editingEvent.id, {
        title: data.title,
        description: data.description || null,
        category: data.category,
        start_time: data.start_time,
        end_time: data.end_time,
        all_day: data.all_day,
        location: data.location || null,
        uniform: data.uniform || null,
        report_time: data.report_time || null,
      })
    } else {
      const now = new Date().toISOString()
      addEvent({
        id: generateId(),
        clinic_id: '',
        title: data.title,
        description: data.description || null,
        category: data.category,
        status: 'planned',
        start_time: data.start_time,
        end_time: data.end_time,
        all_day: data.all_day,
        location: data.location || null,
        opord_notes: null,
        uniform: data.uniform || null,
        report_time: data.report_time || null,
        assigned_to: [],
        created_by: '',
        created_at: now,
        updated_at: now,
      })
    }
    setEditingEvent(null)
    setPanelView('calendar')
  }, [editingEvent, addEvent, updateEvent])

  const handleMoveEvent = useCallback((eventId: string, newStartTime: string) => {
    const event = events.find(e => e.id === eventId)
    if (!event) return
    const originalStart = new Date(event.start_time)
    const originalEnd = new Date(event.end_time)
    const durationMs = originalEnd.getTime() - originalStart.getTime()
    const newStart = new Date(newStartTime)
    const newEnd = new Date(newStart.getTime() + durationMs)
    updateEvent(eventId, {
      start_time: newStartTime,
      end_time: newEnd.toISOString().slice(0, 16),
    })
  }, [events, updateEvent])

  const handleMoveEventToDate = useCallback((eventId: string, targetDateKey: string) => {
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
    updateEvent(eventId, {
      start_time: toISO(newStart),
      end_time: toISO(newEnd),
    })
  }, [events, updateEvent])

  const handleDeleteEvent = useCallback((id: string) => {
    removeEvent(id)
    selectEvent(null)
    setPanelView('calendar')
  }, [removeEvent, selectEvent])

  const handleFormCancel = useCallback(() => {
    setEditingEvent(null)
    setPanelView(selectedEventId ? 'detail' : 'calendar')
  }, [selectedEventId])

  const handleDetailBack = useCallback(() => {
    selectEvent(null)
    setPanelView('calendar')
  }, [selectEvent])

  // ── Sub-views (form / detail) — desktop: full panel replacement ──

  if (!isMobile && panelView === 'form') {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-5 py-3 border-b border-tertiary/10">
          <h2 className="text-base font-semibold text-primary">
            {editingEvent ? 'Edit Event' : 'New Event'}
          </h2>
          <HeaderPill>
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
        <EventForm
          ref={eventFormRef}
          initialData={editingEvent ? eventToFormData(editingEvent) : undefined}
          onSave={handleSaveEvent}
          isEditing={!!editingEvent}
        />
      </div>
    )
  }

  if (panelView === 'detail' && selectedEvent) {
    return (
      <EventDetailPanel
        event={selectedEvent}
        onBack={handleDetailBack}
        onEdit={handleEditEvent}
        onDelete={handleDeleteEvent}
      />
    )
  }

  // ── Calendar views ──

  const showFormDrawer = isMobile && panelView === 'form'

  return (
    <div className="relative h-full">
      {/* View content — fills entire area, island floats over */}
      <div className="absolute inset-0 flex flex-col">
        {viewMode === 'month' && (
          <InfiniteScrollCalendar
            events={filteredEvents}
            selectedDate={selectedDate}
            onSelectDate={handleSelectDate}
            onMonthChange={setMonthLabel}
            onMoveEvent={handleMoveEventToDate}
          />
        )}

        {viewMode === 'day' && (
          <DayView
            date={selectedDate}
            events={dayEvents}
            onSelectEvent={handleSelectEvent}
            onMoveEvent={handleMoveEvent}
          />
        )}

        {viewMode === 'troops' && (
          <TroopsToTaskView
            date={selectedDate}
            events={dayEvents}
            medics={ownClinicMedics}
            onSelectEvent={handleSelectEvent}
            onAssign={assignPersonnel}
            onUnassign={unassignPersonnel}
          />
        )}
      </div>

      <div className="absolute bottom-4 inset-x-0 flex items-center justify-center z-20 pointer-events-none pb-[max(0rem,var(--sab,0px))]">
        <div className="flex items-center gap-1.5 rounded-full bg-themewhite border border-tertiary/20 px-0.5 py-0.5 shadow-lg pointer-events-auto">
          <button
            onClick={() => setViewMode('month')}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 active:scale-95 ${
              viewMode === 'month' ? 'bg-themeblue3 text-white' : 'text-tertiary hover:text-primary'
            }`}
            title="Month"
          >
            <CalendarDays className="w-5 h-5" />
          </button>
          <button
            onClick={() => setViewMode('day')}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 active:scale-95 ${
              viewMode === 'day' ? 'bg-themeblue3 text-white' : 'text-tertiary hover:text-primary'
            }`}
            title="Day"
          >
            <Clock className="w-5 h-5" />
          </button>
          <button
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
            onClick={handleNewEvent}
            className="w-11 h-11 rounded-full bg-themeblue3 text-white flex items-center justify-center active:scale-95 transition-all duration-200"
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
        <EventForm
          ref={eventFormRef}
          initialData={editingEvent ? eventToFormData(editingEvent) : undefined}
          onSave={handleSaveEvent}
          isEditing={!!editingEvent}
        />
      </BaseDrawer>
    </div>
  )
}
