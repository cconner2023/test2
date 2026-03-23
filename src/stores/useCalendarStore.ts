import { create, type StateCreator } from 'zustand'
import type { CalendarEvent, EventCategory } from '../Types/CalendarTypes'
import { putCalendarEvent, deleteCalendarEvent, addCalendarTombstone } from '../lib/calendarEventStore'
import { createLogger } from '../Utilities/Logger'

const logger = createLogger('CalendarPersist')

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
  /** Cached ID of the clinic's system calendar group (set after lazy creation). */
  calendarGroupId: string | null
  /** True once the initial IDB hydration is complete. */
  hydrated: boolean
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
  setCalendarGroupId: (id: string) => void
  setHydrated: (h: boolean) => void
}

export type CalendarStore = CalendarState & CalendarActions

/**
 * Persistence middleware — intercepts event mutations and writes through to
 * IndexedDB with granular put/delete operations. Only active after hydration
 * completes (hydrated === true) to prevent write-before-read cycles.
 *
 * Wrapped actions: addEvent, updateEvent, removeEvent, moveEvent,
 * assignPersonnel, unassignPersonnel.
 * NOT wrapped: setEvents (used for hydration — would write stale data back).
 */
const calendarPersist = (
  creator: StateCreator<CalendarStore>,
): StateCreator<CalendarStore> => (set, get, api) => {
  const store = creator(set, get, api)

  const persistPut = (id: string) => {
    if (!get().hydrated) return
    const event = get().events.find(e => e.id === id)
    if (event) putCalendarEvent(event).catch(e => logger.warn('IDB put failed:', e))
  }

  const persistDelete = (id: string) => {
    if (!get().hydrated) return
    deleteCalendarEvent(id).catch(e => logger.warn('IDB delete failed:', e))
    addCalendarTombstone(id).catch(e => logger.warn('IDB tombstone failed:', e))
  }

  return {
    ...store,
    addEvent: (event) => {
      store.addEvent(event)
      if (get().hydrated) putCalendarEvent(event).catch(e => logger.warn('IDB put failed:', e))
    },
    updateEvent: (id, updates) => {
      store.updateEvent(id, updates)
      persistPut(id)
    },
    removeEvent: (id) => {
      store.removeEvent(id)
      persistDelete(id)
    },
    moveEvent: (id, daysDelta, newStartTime) => {
      store.moveEvent(id, daysDelta, newStartTime)
      persistPut(id)
    },
    assignPersonnel: (eventId, userId) => {
      store.assignPersonnel(eventId, userId)
      persistPut(eventId)
    },
    unassignPersonnel: (eventId, userId) => {
      store.unassignPersonnel(eventId, userId)
      persistPut(eventId)
    },
  }
}

export const useCalendarStore = create<CalendarStore>()(calendarPersist((set) => ({
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
  calendarGroupId: null,
  hydrated: false,

  setView: (view) => set({ currentView: view }),
  setSelectedDate: (date) => set({ selectedDate: date }),
  selectEvent: (id) => set({ selectedEventId: id }),
  setEditingEvent: (id) => set({ editingEventId: id, showEventForm: !!id }),
  setShowEventForm: (show) => set({ showEventForm: show, editingEventId: show ? undefined : null }),
  setCategoryFilter: (categories) => set({ categoryFilter: categories }),
  setRosterSearchQuery: (query) => set({ rosterSearchQuery: query }),
  setShowRosterMobile: (show) => set({ showRosterMobile: show }),

  addEvent: (event) => set((s) => {
    if (s.events.some(e => e.id === event.id)) return s
    return { events: [...s.events, event] }
  }),
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
  setCalendarGroupId: (id) => set({ calendarGroupId: id }),
  setHydrated: (h) => set({ hydrated: h }),
})))
