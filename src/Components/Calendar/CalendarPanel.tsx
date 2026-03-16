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
  const [monthLabel, setMonthLabel] = useState(() =>
    new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  )

  const { medics: allMedics } = useClinicMedics()
  const { ownClinicMedics } = useClinicGroupedMedics(allMedics)

  const {
    viewMode, setViewMode,
    events, addEvent, updateEvent, removeEvent,
    selectedEventId, selectEvent,
    assignPersonnel, unassignPersonnel,
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
  })))

  const selectedDateKey = toDateKey(selectedDate)

  const dayEvents = useMemo(() =>
    events
      .filter(e => eventFallsOnDate(e, selectedDateKey))
      .sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [events, selectedDateKey]
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

  const handleMonthChange = useCallback((label: string) => {
    setMonthLabel(label)
  }, [])

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

  // ── Toolbar label ──

  const toolbarLabel = viewMode === 'month'
    ? monthLabel
    : selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

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
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-primary/10">
        <span className="text-sm font-semibold text-primary">
          {toolbarLabel}
        </span>

        {/* View mode toggle */}
        <div className="flex items-center gap-0.5 rounded-full bg-themewhite border border-tertiary/20 p-0.5">
          <button
            onClick={() => setViewMode('month')}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 active:scale-95 ${
              viewMode === 'month' ? 'bg-themeblue3 text-white' : 'text-tertiary hover:text-primary'
            }`}
            title="Month"
          >
            <CalendarDays className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('day')}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 active:scale-95 ${
              viewMode === 'day' ? 'bg-themeblue3 text-white' : 'text-tertiary hover:text-primary'
            }`}
            title="Day"
          >
            <Clock className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('troops')}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 active:scale-95 ${
              viewMode === 'troops' ? 'bg-themeblue3 text-white' : 'text-tertiary hover:text-primary'
            }`}
            title="Troops to Task"
          >
            <Users2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* View content */}
      <div className="flex-1 min-h-0 flex flex-col">
        {viewMode === 'month' && (
          <InfiniteScrollCalendar
            events={events}
            selectedDate={selectedDate}
            onSelectDate={handleSelectDate}
            onMonthChange={handleMonthChange}
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

      {/* FAB */}
      <button
        onClick={handleNewEvent}
        className="absolute bottom-4 right-4 w-12 h-12 rounded-full bg-themeblue3 text-white shadow-lg flex items-center justify-center active:scale-95 transition-all duration-200 hover:shadow-xl z-10"
      >
        <Plus size={24} />
      </button>
    </div>
  )
}
