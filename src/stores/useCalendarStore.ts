import { create } from 'zustand'
import type { CalendarEvent, EventCategory } from '../Types/CalendarTypes'

type CalendarViewMode = 'month' | 'day' | 'troops'

interface CalendarState {
  currentView: CalendarViewMode
  selectedDate: string
  selectedEventId: string | null
  editingEventId: string | null
  showEventForm: boolean
  categoryFilter: EventCategory[] | null
  events: CalendarEvent[]
  rosterSearchQuery: string
  showRosterMobile: boolean
  personnelFilter: string[]
  monthLabel: string
}

interface CalendarActions {
  setView: (view: CalendarViewMode) => void
  setSelectedDate: (date: string) => void
  selectEvent: (id: string | null) => void
  setEditingEvent: (id: string | null) => void
  setShowEventForm: (show: boolean) => void
  setCategoryFilter: (categories: EventCategory[] | null) => void
  addEvent: (event: CalendarEvent) => void
  updateEvent: (id: string, updates: Partial<CalendarEvent>) => void
  removeEvent: (id: string) => void
  moveEvent: (id: string, daysDelta: number, newStartTime?: string) => void
  setEvents: (events: CalendarEvent[]) => void
  assignPersonnel: (eventId: string, userId: string) => void
  unassignPersonnel: (eventId: string, userId: string) => void
  setRosterSearchQuery: (query: string) => void
  setShowRosterMobile: (show: boolean) => void
  togglePersonnelFilter: (userId: string) => void
  clearPersonnelFilter: () => void
  setMonthLabel: (label: string) => void
}

export type CalendarStore = CalendarState & CalendarActions

export const useCalendarStore = create<CalendarStore>()((set) => ({
  currentView: 'month',
  selectedDate: new Date().toISOString().slice(0, 10),
  selectedEventId: null,
  editingEventId: null,
  showEventForm: false,
  categoryFilter: null,
  events: [],
  rosterSearchQuery: '',
  showRosterMobile: false,
  personnelFilter: [],
  monthLabel: new Date().toLocaleDateString('en-US', { month: 'long' }),

  setView: (view) => set({ currentView: view }),
  setSelectedDate: (date) => set({ selectedDate: date }),
  selectEvent: (id) => set({ selectedEventId: id }),
  setEditingEvent: (id) => set({ editingEventId: id, showEventForm: !!id }),
  setShowEventForm: (show) => set({ showEventForm: show, editingEventId: show ? undefined : null }),
  setCategoryFilter: (categories) => set({ categoryFilter: categories }),
  setRosterSearchQuery: (query) => set({ rosterSearchQuery: query }),
  setShowRosterMobile: (show) => set({ showRosterMobile: show }),

  addEvent: (event) => set((s) => ({ events: [...s.events, event] })),
  updateEvent: (id, updates) => set((s) => ({
    events: s.events.map(e => e.id === id ? { ...e, ...updates, updated_at: new Date().toISOString() } : e),
  })),
  removeEvent: (id) => set((s) => ({
    events: s.events.filter(e => e.id !== id),
    selectedEventId: s.selectedEventId === id ? null : s.selectedEventId,
  })),
  moveEvent: (id, daysDelta, newStartTime) => set((s) => ({
    events: s.events.map(e => {
      if (e.id !== id) return e
      const now = new Date().toISOString()
      if (newStartTime) {
        const originalStart = new Date(e.start_time).getTime()
        const originalEnd = new Date(e.end_time).getTime()
        const duration = originalEnd - originalStart
        const newEnd = new Date(new Date(newStartTime).getTime() + duration).toISOString()
        return { ...e, start_time: newStartTime, end_time: newEnd, updated_at: now }
      }
      const msPerDay = 24 * 60 * 60 * 1000
      const newStart = new Date(new Date(e.start_time).getTime() + daysDelta * msPerDay).toISOString()
      const newEnd = new Date(new Date(e.end_time).getTime() + daysDelta * msPerDay).toISOString()
      return { ...e, start_time: newStart, end_time: newEnd, updated_at: now }
    }),
  })),
  setEvents: (events) => set({ events }),

  assignPersonnel: (eventId, userId) => set((s) => ({
    events: s.events.map(e =>
      e.id === eventId && !e.assigned_to.includes(userId)
        ? { ...e, assigned_to: [...e.assigned_to, userId], updated_at: new Date().toISOString() }
        : e
    ),
  })),
  unassignPersonnel: (eventId, userId) => set((s) => ({
    events: s.events.map(e =>
      e.id === eventId
        ? { ...e, assigned_to: e.assigned_to.filter(id => id !== userId), updated_at: new Date().toISOString() }
        : e
    ),
  })),

  togglePersonnelFilter: (userId) => set((s) => ({
    personnelFilter: s.personnelFilter.includes(userId)
      ? s.personnelFilter.filter(id => id !== userId)
      : [...s.personnelFilter, userId],
  })),
  clearPersonnelFilter: () => set({ personnelFilter: [] }),
  setMonthLabel: (label) => set({ monthLabel: label }),
}))
