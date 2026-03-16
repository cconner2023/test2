import { useState, useCallback, useMemo } from 'react'
import { Clock, Plus, Users2, CalendarDays } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useIsMobile } from '../../Hooks/useIsMobile'
import { EventForm } from './EventForm'
import { EventDetailPanel } from './EventDetailPanel'
import { DayView } from './DayView'
import { TroopsToTaskView } from './TroopsToTaskView'
import { InfiniteScrollCalendar } from './InfiniteScrollCalendar'
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

  // ── Sub-views (form / detail) ──

  if (panelView === 'form') {
    return (
      <EventForm
        initialData={editingEvent ? eventToFormData(editingEvent) : undefined}
        onSave={handleSaveEvent}
        onCancel={handleFormCancel}
        isEditing={!!editingEvent}
      />
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

  return (
    <div className="flex flex-col h-full relative">
      {/* View content */}
      <div className="flex-1 min-h-0 flex flex-col">
        {viewMode === 'month' && (
          <InfiniteScrollCalendar
            events={filteredEvents}
            selectedDate={selectedDate}
            onSelectDate={handleSelectDate}
            onMonthChange={setMonthLabel}
          />
        )}

        {viewMode === 'day' && (
          <DayView
            date={selectedDate}
            events={dayEvents}
            onSelectEvent={handleSelectEvent}
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
            hideNameColumn={!isMobile}
          />
        )}
      </div>

      <div className="absolute bottom-4 inset-x-0 flex items-center justify-center z-10 pointer-events-none pb-[max(0rem,var(--sab,0px))]">
        <div className="flex items-center gap-0.5 rounded-full bg-themewhite border border-tertiary/20 p-0.5 shadow-lg pointer-events-auto">
          <button
            onClick={() => setViewMode('month')}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 active:scale-95 ${
              viewMode === 'month' ? 'bg-themeblue3 text-white' : 'text-tertiary hover:text-primary'
            }`}
            title="Month"
          >
            <CalendarDays className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('day')}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 active:scale-95 ${
              viewMode === 'day' ? 'bg-themeblue3 text-white' : 'text-tertiary hover:text-primary'
            }`}
            title="Day"
          >
            <Clock className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('troops')}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 active:scale-95 ${
              viewMode === 'troops' ? 'bg-themeblue3 text-white' : 'text-tertiary hover:text-primary'
            }`}
            title="Troops to Task"
          >
            <Users2 className="w-4 h-4" />
          </button>
        </div>
        <button
          onClick={handleNewEvent}
          className="absolute right-4 w-10 h-10 rounded-full bg-themeblue3 text-white shadow-lg flex items-center justify-center active:scale-95 transition-all duration-200 hover:shadow-xl pointer-events-auto"
        >
          <Plus size={20} />
        </button>
      </div>
    </div>
  )
}
