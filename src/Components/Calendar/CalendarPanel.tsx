import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { Clock, Plus, Users2, CalendarDays, X, Check, Pencil, Trash2, CalendarPlus, Play, CheckCircle2, Ban, Share2, CircleDashed } from 'lucide-react'
import { ContextMenu, type ContextMenuItem } from '../ContextMenu'
import { useShallow } from 'zustand/react/shallow'
import { useIsMobile } from '../../Hooks/useIsMobile'
import { EventForm } from './EventForm'
import type { EventFormHandle } from './EventForm'
import { EventDetailPanel } from './EventDetailPanel'
import { DayView } from './DayView'
import { TripleDayView } from './TripleDayView'
import { TroopsToTaskView } from './TroopsToTaskView'
import { InfiniteScrollCalendar } from './InfiniteScrollCalendar'
import { ConfirmDialog } from '../ConfirmDialog'
import { ActionSheet } from '../ActionSheet'
import { BaseDrawer } from '../BaseDrawer'
import { CalendarCSVImportSheet } from './CalendarCSVImportSheet'
import { TemplateGeneratorPanel, type TemplateGeneratorHandle } from './TemplateGeneratorPanel'
import { BlockTemplatedPanel, type BlockTemplatedHandle } from './BlockTemplatedPanel'
import { useAuthStore } from '../../stores/useAuthStore'
import { HeaderPill, PillButton } from '../HeaderPill'
import { useCalendarStore } from '../../stores/useCalendarStore'
import { useNavigationStore } from '../../stores/useNavigationStore'
import { useClinicMedics } from '../../Hooks/useClinicMedics'
import { useClinicGroupedMedics } from '../../Hooks/useClinicGroupedMedics'
import { useClinicRooms } from '../../Hooks/useClinicRooms'
import { useClinicHuddleTasks } from '../../Hooks/useClinicHuddleTasks'
import { useClinicPreCombatChecks } from '../../Hooks/useClinicPreCombatChecks'
import { usePropertyStore } from '../../stores/usePropertyStore'
import { useCalendarSync } from '../../Hooks/useCalendarSync'
import { useCalendarWrite } from '../../Hooks/useCalendarWrite'
import { LoadingOverlay } from '../LoadingOverlay'
import { useAuth } from '../../Hooks/useAuth'
import { getOverlays } from '../../lib/mapOverlayService'
import { useMapOverlayWrite } from '../../Hooks/useMapOverlayWrite'
import type { OverlayOption, RoomOption, HuddleTaskOption } from './EventForm'
import { getInitials } from '../../Utilities/nameUtils'
import type { CalendarEvent, EventFormData, EventStatus } from '../../Types/CalendarTypes'
import {
  eventToFormData, toDateKey, eventFallsOnDate, generateId, createEmptyFormData,
  PROVIDER_HUDDLE_TASK_ID, isEventEditable, isTemplateStructureMutable, toLocalISOString,
} from '../../Types/CalendarTypes'
import { useClinicAppointmentTypes } from '../../Hooks/useClinicAppointmentTypes'
import { shareCalendar, shareSingleEvent } from '../../lib/calendarExport'

type PanelView = 'calendar' | 'detail' | 'form' | 'template' | 'block'
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
  const calendarDrawerEventEditMode = useNavigationStore(s => s.calendarDrawerEventEditMode)
  const clearCalendarDrawerEventId = useNavigationStore(s => s.clearCalendarDrawerEventId)
  const pendingCalendarAction = useNavigationStore(s => s.pendingCalendarAction)
  const clearPendingCalendarAction = useNavigationStore(s => s.clearPendingCalendarAction)
  const clearCalendarPrefill = useNavigationStore(s => s.clearCalendarPrefill)
  const returnFromCalendar = useNavigationStore(s => s.returnFromCalendar)

  useEffect(() => {
    onPanelStateChange?.(panelView !== 'calendar')
  }, [panelView, onPanelStateChange])

  // Tour-driven panel view override (used by provider-template guided tours).
  useEffect(() => {
    const onSet = (e: Event) => {
      const detail = (e as CustomEvent<PanelView>).detail
      if (!detail) return
      if (detail === 'template') setTemplateNonce(n => n + 1)
      if (detail === 'block') setBlockNonce(n => n + 1)
      setPanelView(detail)
    }
    window.addEventListener('tour:calendar-set-panel-view', onSet)
    return () => window.removeEventListener('tour:calendar-set-panel-view', onSet)
  }, [])
  const eventFormRef = useRef<EventFormHandle>(null)

  const { clinicId, surrogateClinicIds, supervisingClinicId, profile, user } = useAuth()
  // Active operating-as clinic — the single source of truth for clinic-scoped
  // sub-fetches (rooms, huddle tasks, appt types) and the default clinic_id on
  // new events. supervisingClinicId falls back to home on fresh sessions.
  const activeClinicId = supervisingClinicId ?? clinicId
  // Clinic options for the EventForm picker. Includes every active loan; the
  // form hides the picker entirely when length < 2.
  const clinicFormOptions = useMemo(() => {
    const opts: { id: string; name: string }[] = []
    if (clinicId) opts.push({ id: clinicId, name: profile.clinicName ?? 'Assigned' })
    const loans = profile.surrogateClinics ?? []
    for (const id of surrogateClinicIds) {
      opts.push({ id, name: loans.find((c) => c.id === id)?.name ?? 'Surrogate' })
    }
    return opts
  }, [clinicId, surrogateClinicIds, profile.clinicName, profile.surrogateClinics])
  const { writeEvent, vaultUpdate, deleteEvent: calendarDeleteEvent, isWriting, isDeleting } = useCalendarWrite()
  const { writeOverlay } = useMapOverlayWrite()
  const apptTypes = useClinicAppointmentTypes(activeClinicId)
  const apptTypeNames = useMemo(() => apptTypes.map(t => t.name), [apptTypes])
  const [isFormPending, setIsFormPending] = useState(false)

  // Kick off IDB hydration + vault subscription
  useCalendarSync()

  // Load overlay options for the event form — scoped to operating-as clinic
  useEffect(() => {
    if (!activeClinicId) return
    getOverlays(activeClinicId).then(result => {
      if (result.ok) {
        setOverlayOptions(result.data.map(o => ({
          id: o.id,
          name: o.name,
          center: o.center,
          features: o.features.map(f => ({
            id: f.id,
            label: f.label || '(unnamed)',
            type: f.type,
            lat: f.geometry[0]?.[0],
            lng: f.geometry[0]?.[1],
          })),
        })))
      }
    }).catch(() => {})
  }, [activeClinicId])

  const [overlayOptions, setOverlayOptions] = useState<OverlayOption[]>([])

  // Footer Add action for the Location picker — creates a new overlay with
  // the supplied name (falls back to a date-stamped placeholder when blank).
  const handleCreateOverlayForEvent = useCallback(async (rawName: string): Promise<string | null> => {
    if (!activeClinicId || !user) return null
    const overlayId = crypto.randomUUID()
    const today = new Date().toISOString().slice(0, 10)
    const name = rawName.trim() || `Field map · ${today}`
    const saved = await writeOverlay({
      overlayId,
      clinicId: activeClinicId,
      name,
      center: [0, 0],
      zoom: 13,
      features: [],
    })
    if (!saved) return null
    setOverlayOptions(prev => [...prev, { id: overlayId, name, features: [] }])
    return overlayId
  }, [activeClinicId, user, writeOverlay])

  const [showAddSheet, setShowAddSheet] = useState(false)
  const [showImportSheet, setShowImportSheet] = useState(false)
  const isSupervisor = useAuthStore(s => s.isSupervisorRole)
  const isDevRole = useAuthStore(s => s.isDevRole)
  const templatePanelRef = useRef<TemplateGeneratorHandle>(null)
  const blockPanelRef = useRef<BlockTemplatedHandle>(null)
  const [templateNonce, setTemplateNonce] = useState(0)
  const [blockNonce, setBlockNonce] = useState(0)

  const [confirmDeleteEvent, setConfirmDeleteEvent] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ eventId: string; x: number; y: number } | null>(null)
  const [dayContextMenu, setDayContextMenu] = useState<{ dateKey: string; x: number; y: number } | null>(null)
  const [newEventDateKey, setNewEventDateKey] = useState<string | undefined>(undefined)
  const [newEventHuddleTaskId, setNewEventHuddleTaskId] = useState<string | null>(null)
  const [newEventCategory, setNewEventCategory] = useState<'task' | null>(null)
  const [newEventPrefill, setNewEventPrefill] = useState<{ title?: string; startISO?: string } | null>(null)
  const formIsTask = editingEvent ? editingEvent.category === 'task' : newEventCategory === 'task'

  const [duplicateHuddle, setDuplicateHuddle] = useState<{ eventId: string; rowName: string; medicLabel: string } | null>(null)

  const [showDayDrawer, setShowDayDrawer] = useState(false)
  const [dayDrawerView, setDayDrawerView] = useState<DayDrawerView>('detail')
  const [dayDrawerEventId, setDayDrawerEventId] = useState<string | null>(null)

  const { medics: allMedics } = useClinicMedics()
  const { ownClinicMedics } = useClinicGroupedMedics(allMedics)
  const clinicRooms = useClinicRooms(activeClinicId)
  const activeRooms = useMemo(() => clinicRooms.filter(r => !r.archived_at), [clinicRooms])
  const roomFormOptions: RoomOption[] = useMemo(
    () => [...activeRooms]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(r => ({ id: r.id, name: r.name })),
    [activeRooms],
  )
  const huddleTasks = useClinicHuddleTasks(activeClinicId)
  const sortedHuddleTasks = useMemo(
    () => [...huddleTasks].sort((a, b) => a.sort_order - b.sort_order),
    [huddleTasks],
  )
  const huddleTaskFormOptions: HuddleTaskOption[] = useMemo(
    () => sortedHuddleTasks.map(t => ({ id: t.id, name: t.name })),
    [sortedHuddleTasks],
  )
  const pccTemplates = useClinicPreCombatChecks(activeClinicId)
  const sortedPccTemplates = useMemo(
    () => [...pccTemplates].sort((a, b) => a.sort_order - b.sort_order),
    [pccTemplates],
  )

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
    daySpan,
    categoryFilter, setCategoryFilter,
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
    daySpan: s.daySpan,
    categoryFilter: s.categoryFilter,
    setCategoryFilter: s.setCategoryFilter,
  })))

  const handleEventStatusChange = useCallback(async (id: string, next: import('../../Types/CalendarTypes').EventStatus) => {
    const event = events.find(e => e.id === id)
    if (!event) return
    await writeEvent({ ...event, status: next, updated_at: new Date().toISOString() })
  }, [events, writeEvent])

  const handleUpdateEventPcc = useCallback(async (id: string, next: import('../../Types/CalendarTypes').PCCAttachment) => {
    const event = events.find(e => e.id === id)
    if (!event) return
    await writeEvent({ ...event, pcc: next, updated_at: new Date().toISOString() })
  }, [events, writeEvent])

  // Deep-link from external sources (e.g. Mission Board) — open specific event in detail or edit view
  useEffect(() => {
    if (!calendarDrawerEventId) return
    const eventId = calendarDrawerEventId
    const editMode = calendarDrawerEventEditMode
    selectEvent(eventId)
    if (editMode) {
      const ev = useCalendarStore.getState().events.find(e => e.id === eventId)
      if (ev && isEventEditable(ev, isSupervisor)) {
        setEditingEvent(ev)
        if (isMobile) {
          setDayDrawerEventId(eventId)
          setDayDrawerView('edit')
          setShowDayDrawer(true)
        } else {
          setPanelView('form')
        }
        clearCalendarDrawerEventId()
        return
      }
    }
    if (isMobile) {
      setDayDrawerEventId(eventId)
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

  // Cluster scope: a loaned user can reach their home clinic plus every
  // active loan, so events from any of those clinics render regardless of
  // the operating-as toggle. The assigned_to clause is the safety net for
  // legacy / mis-tagged events that don't carry a reachable clinic_id.
  const userId = user?.id ?? null
  const reachableClinicIds = useMemo(() => {
    const set = new Set<string>()
    if (clinicId) set.add(clinicId)
    for (const id of surrogateClinicIds) set.add(id)
    return set
  }, [clinicId, surrogateClinicIds])
  const filteredEvents = useMemo(() => {
    let out = events
    if (reachableClinicIds.size > 0) {
      out = out.filter(e =>
        reachableClinicIds.has(e.clinic_id) ||
        (userId !== null && e.assigned_to.includes(userId))
      )
    }
    if (personnelFilter.length > 0) {
      out = out.filter(e =>
        e.assigned_to.length === 0 || e.assigned_to.some(id => personnelFilter.includes(id))
      )
    }
    if (categoryFilter !== null) {
      out = out.filter(e => categoryFilter.includes(e.category))
    }
    return out
  }, [events, personnelFilter, categoryFilter, reachableClinicIds, userId])

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

  const handleNewEvent = useCallback((forDateKey?: string, category?: 'task', prefill?: { title?: string; startISO?: string } | null) => {
    setEditingEvent(null)
    setNewEventDateKey(forDateKey ?? selectedDateStr)
    setNewEventHuddleTaskId(null)
    setNewEventCategory(category ?? null)
    setNewEventPrefill(prefill ?? null)
    setPanelView('form')
  }, [selectedDateStr])

  // Deep-link from external sources (Mission Board "+", a detected date in a
  // message, etc.) — open the new-event form on mount, applying any prefill.
  useEffect(() => {
    if (pendingCalendarAction !== 'new') return
    const prefill = useNavigationStore.getState().calendarPrefill
    const dateKey = prefill?.startISO ? prefill.startISO.slice(0, 10) : undefined
    handleNewEvent(dateKey, undefined, prefill)
    clearPendingCalendarAction()
    clearCalendarPrefill()
  }, [pendingCalendarAction, handleNewEvent, clearPendingCalendarAction, clearCalendarPrefill])

  const handleNewHuddleEvent = useCallback((forDateKey: string, taskId?: string) => {
    setEditingEvent(null)
    setNewEventDateKey(forDateKey)
    setNewEventHuddleTaskId(taskId ?? null)
    setNewEventPrefill(null)
    setPanelView('form')
  }, [])

  const handleAssignMedicToHuddle = useCallback(async (medicId: string, taskId: string, forDateKey: string, providerId?: string) => {
    if (!activeClinicId) return
    const medic = ownClinicMedics.find(m => m.id === medicId)
    const medicLabel = medic ? `${medic.lastName ?? ''}${medic.firstName ? ', ' + medic.firstName.charAt(0) + '.' : ''}`.trim() || 'Medic' : 'Medic'
    const provider = providerId ? ownClinicMedics.find(m => m.id === providerId) : null
    const rowName = taskId === PROVIDER_HUDDLE_TASK_ID
      ? (provider ? `${provider.lastName ?? 'Provider'} huddle` : 'Providers')
      : sortedHuddleTasks.find(t => t.id === taskId)?.name ?? 'Huddle'

    const allEvents = useCalendarStore.getState().events

    // Provider rows: pair the medic with the provider's existing huddle event for the day,
    // or create a new event with both [providerId, medicId]. Never create a standalone medic-only
    // entry — the medic is always coupled to the provider whose row was tapped.
    if (taskId === PROVIDER_HUDDLE_TASK_ID && providerId) {
      const providerEvent = allEvents.find(e =>
        e.category === 'huddle' &&
        (e.huddle_task_id ?? null) === PROVIDER_HUDDLE_TASK_ID &&
        e.start_time.slice(0, 10) === forDateKey &&
        e.assigned_to.includes(providerId)
      )
      if (providerEvent) {
        if (providerEvent.assigned_to.includes(medicId)) {
          setDuplicateHuddle({ eventId: providerEvent.id, rowName, medicLabel })
          return
        }
        const updated: CalendarEvent = {
          ...providerEvent,
          assigned_to: [...providerEvent.assigned_to, medicId],
          updated_at: new Date().toISOString(),
        }
        await writeEvent(updated)
        return
      }
      const now = new Date().toISOString()
      const newEvent: CalendarEvent = {
        id: generateId(),
        clinic_id: activeClinicId,
        title: rowName,
        description: null,
        category: 'huddle',
        status: 'pending',
        start_time: `${forDateKey}T00:00`,
        end_time: `${forDateKey}T23:59`,
        all_day: true,
        location: null,
        opord_notes: null,
        uniform: null,
        report_time: null,
        assigned_to: providerId === medicId ? [providerId] : [providerId, medicId],
        property_item_ids: [],
        structured_location: null,
        room_id: null,
        huddle_task_id: PROVIDER_HUDDLE_TASK_ID,
        created_by: user?.id ?? '',
        created_at: now,
        updated_at: now,
      }
      await writeEvent(newEvent)
      return
    }

    // Task rows: same medic, same task, same date is a duplicate.
    const existing = allEvents.find(e =>
      e.category === 'huddle' &&
      (e.huddle_task_id ?? null) === taskId &&
      e.start_time.slice(0, 10) === forDateKey &&
      e.assigned_to.includes(medicId)
    )
    if (existing) {
      setDuplicateHuddle({ eventId: existing.id, rowName, medicLabel })
      return
    }

    const now = new Date().toISOString()
    const newEvent: CalendarEvent = {
      id: generateId(),
      clinic_id: activeClinicId,
      title: rowName,
      description: null,
      category: 'huddle',
      status: 'pending',
      start_time: `${forDateKey}T00:00`,
      end_time: `${forDateKey}T23:59`,
      all_day: true,
      location: null,
      opord_notes: null,
      uniform: null,
      report_time: null,
      assigned_to: [medicId],
      property_item_ids: [],
      structured_location: null,
      room_id: null,
      huddle_task_id: taskId,
      created_by: user?.id ?? '',
      created_at: now,
      updated_at: now,
    }
    await writeEvent(newEvent)
  }, [activeClinicId, ownClinicMedics, sortedHuddleTasks, user, writeEvent])

  /** Initial form data for a NEW event — pre-populates category/task when launched from the huddle band.
   *  clinic_id defaults to the active (operating-as) clinic so a supervisor or
   *  loaned medic creating an event lands it in the cluster they're currently
   *  viewing. EventForm picker may override per-event on dual-membership users. */
  const newEventInitialData = useMemo(() => {
    let base = { ...createEmptyFormData(newEventDateKey), clinic_id: activeClinicId ?? null }
    // Prefill from a deep-link (e.g. a detected date in a message). Seeds the
    // title and pins start_time to the parsed datetime; end defaults to +1h.
    if (newEventPrefill) {
      if (newEventPrefill.title) base = { ...base, title: newEventPrefill.title }
      if (newEventPrefill.startISO) {
        const start = new Date(newEventPrefill.startISO)
        if (!Number.isNaN(start.getTime())) {
          const end = new Date(start)
          end.setHours(end.getHours() + 1)
          base = { ...base, start_time: toLocalISOString(start), end_time: toLocalISOString(end) }
        }
      }
    }
    if (newEventHuddleTaskId !== null) {
      return { ...base, category: 'huddle' as const, huddle_task_id: newEventHuddleTaskId }
    }
    if (newEventCategory === 'task') {
      return { ...base, category: 'task' as const }
    }
    return base
  }, [newEventDateKey, newEventHuddleTaskId, newEventCategory, newEventPrefill, activeClinicId])

  const handleEditEvent = useCallback((id: string) => {
    const event = events.find(e => e.id === id)
    if (event && isEventEditable(event, isSupervisor)) {
      setEditingEvent(event)
      setPanelView('form')
    }
  }, [events, isSupervisor])

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
          linked_overlays: data.linked_overlays ?? null,
          linked_features: data.linked_features ?? null,
          room_id: data.room_id ?? null,
          huddle_task_id: data.category === 'huddle' ? (data.huddle_task_id ?? null) : null,
          pcc: data.pcc ?? null,
          updated_at: now,
        }
        await writeEvent(updatedEvent)
      } else {
        const newEvent: CalendarEvent = {
          id: generateId(),
          // Form supplies clinic_id when the user has a surrogate (picker shown);
          // otherwise falls back to the active operating-as clinic.
          clinic_id: data.clinic_id ?? activeClinicId ?? '',
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
          linked_overlays: data.linked_overlays ?? null,
          linked_features: data.linked_features ?? null,
          room_id: data.room_id ?? null,
          huddle_task_id: data.category === 'huddle' ? (data.huddle_task_id ?? null) : null,
          pcc: data.pcc ?? null,
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
    // If this form was opened from a chat message (detected date), hop back to
    // that message; no-op otherwise.
    returnFromCalendar()
  }, [editingEvent, writeEvent, activeClinicId, user, returnFromCalendar])

  const handleMoveEvent = useCallback((eventId: string, newStartTime: string) => {
    const events = useCalendarStore.getState().events
    const event = events.find(e => e.id === eventId)
    if (!event) return
    if (!isEventEditable(event, isSupervisor)) return
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
  }, [vaultUpdate, isSupervisor])

  const handleMoveEventToDate = useCallback((eventId: string, targetDateKey: string) => {
    const events = useCalendarStore.getState().events
    const event = events.find(e => e.id === eventId)
    if (!event) return
    if (!isEventEditable(event, isSupervisor)) return
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
  }, [vaultUpdate, isSupervisor])

  const handleDeleteEvent = useCallback(async (id: string) => {
    const event = useCalendarStore.getState().events.find(e => e.id === id)
    if (event && !isTemplateStructureMutable(event, isSupervisor)) return
    await calendarDeleteEvent(id)
    setPanelView('calendar')
    setShowDayDrawer(false)
    setDayDrawerEventId(null)
    setDayDrawerView('detail')
  }, [calendarDeleteEvent, isSupervisor])

  /**
   * Cancel a scheduled templated slot without deleting it: revert the title back to the
   * matching appointment-type name so the slot reads as "unscheduled" again. We pick the
   * apptType whose duration matches the event's slot length; if none match (type was
   * deleted/edited after generation), fall back to the first apptType so the slot still
   * recovers a valid open state. Available to all auth users.
   */
  const handleCancelTemplate = useCallback(async (id: string) => {
    const event = useCalendarStore.getState().events.find(e => e.id === id)
    if (!event || event.category !== 'templated') return
    if (apptTypes.length === 0) return
    const durationMs = new Date(event.end_time).getTime() - new Date(event.start_time).getTime()
    const durationMin = Math.round(durationMs / 60000)
    const match = apptTypes.find(t => t.duration_min === durationMin) ?? apptTypes[0]
    if (event.title === match.name) return
    const reverted: CalendarEvent = {
      ...event,
      title: match.name,
      status: 'pending',
      updated_at: new Date().toISOString(),
    }
    await writeEvent(reverted)
  }, [apptTypes, writeEvent])

  const handleFormCancel = useCallback(() => {
    setEditingEvent(null)
    setPanelView(selectedEventId ? 'detail' : 'calendar')
    // Cancelling a message-originated event still returns to that message.
    returnFromCalendar()
  }, [selectedEventId, returnFromCalendar])

  const handleDetailBack = useCallback(() => {
    selectEvent(null)
    setPanelView('calendar')
  }, [selectEvent])

  const handleStatusChange = useCallback((eventId: string, status: EventStatus) => {
    const event = useCalendarStore.getState().events.find(e => e.id === eventId)
    if (!event) return
    if (!isEventEditable(event, isSupervisor)) return
    const updatedEvent: CalendarEvent = { ...event, status, updated_at: new Date().toISOString() }
    useCalendarStore.getState().updateEvent(eventId, updatedEvent)
    vaultUpdate(updatedEvent)
    setContextMenu(null)
  }, [vaultUpdate, isSupervisor])

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
      linked_overlays: data.linked_overlays ?? null,
      linked_features: data.linked_features ?? null,
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
      subtitle="Permanent. Removed for all cluster members."
      confirmLabel="Delete"
      variant="danger"
      onConfirm={() => {
        if (confirmDeleteEvent) {
          const id = confirmDeleteEvent
          setConfirmDeleteEvent(null)
          setEditingEvent(null)
          handleDeleteEvent(id)
        }
      }}
      onCancel={() => setConfirmDeleteEvent(null)}
    />
  )

  // ── Calendar views ──

  const showFormDrawer = isMobile && panelView === 'form'
  const showTemplateDrawer = isMobile && panelView === 'template'
  const showBlockDrawer = isMobile && panelView === 'block'
  const showDesktopPanel = !isMobile && (panelView === 'detail' || panelView === 'form' || panelView === 'template' || panelView === 'block')

  return (
    <>
      <div className="relative h-full flex">
        {/* Vault sync banner — mirrors messaging's "Setting up encryption…" pattern */}
        {!vaultReplayDone && (
          <div className="absolute top-0 inset-x-0 z-30 flex items-center gap-2 px-3 py-2 bg-themeblue2/10 border-b border-themeblue2/20">
            <div className="w-3 h-3 border-2 border-themeblue2 border-t-transparent rounded-full animate-spin" />
            <span className="text-[10pt] text-themeblue2 font-medium">Syncing calendar…</span>
          </div>
        )}
        {/* Vault hydration error banner */}
        {hydrationError && (
          <div className="absolute top-0 inset-x-0 z-30 flex items-center justify-between gap-2 px-3 py-2 bg-amber-100 border-b border-amber-300 text-amber-900 text-[10pt]">
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

            {viewMode === 'day' && daySpan === 1 && (
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

            {viewMode === 'day' && daySpan === 3 && (
              <TripleDayView
                date={selectedDate}
                events={filteredEvents}
                onSelectEvent={handleSelectEvent}
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
                rooms={activeRooms}
                huddleTasks={sortedHuddleTasks}
                onSelectEvent={handleSelectEvent}
                onEventContextMenu={handleEventContextMenu}
                onAssign={assignPersonnel}
                onUnassign={unassignPersonnel}
                onDateChange={setSelectedDate}
                onNewHuddleEvent={handleNewHuddleEvent}
                onAssignMedicToHuddle={handleAssignMedicToHuddle}
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
                onClick={() => setShowAddSheet(true)}
                className="w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 bg-themeblue3 text-white active:scale-95"
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
              title: editingEvent ? (formIsTask ? 'Edit Task' : 'Edit Event') : (formIsTask ? 'New Task' : 'New Event'),
              rightContent: (
                <HeaderPill>
                  {editingEvent && (
                    <PillButton icon={Trash2} iconSize={18} onClick={() => setConfirmDeleteEvent(editingEvent.id)} label="Delete" variant="danger" />
                  )}
                  <PillButton icon={X} iconSize={18} onClick={handleFormCancel} label="Cancel" />
                  <PillButton
                    icon={Check}
                    iconSize={18}
                    accent="success"
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
                initialData={editingEvent ? eventToFormData(editingEvent) : newEventInitialData}
                onSave={handleSaveEvent}
                isEditing={!!editingEvent}
                medics={medicList}
                propertyItems={propertyItems}
                overlayOptions={overlayOptions}
                roomOptions={roomFormOptions}
                huddleTaskOptions={huddleTaskFormOptions}
                pccTemplateOptions={sortedPccTemplates}
                isDev={isDevRole}
                clinicOptions={clinicFormOptions}
                onCreateOverlay={handleCreateOverlayForEvent}
              />
              <LoadingOverlay visible={isFormPending || isWriting || isDeleting} className="rounded-xl" />
            </div>
          </BaseDrawer>

          {/* Mobile template drawer — supervisor provider-template generator */}
          {activeClinicId && user && isSupervisor && (
            <BaseDrawer
              isVisible={showTemplateDrawer}
              onClose={() => setPanelView('calendar')}
              mobileOnly
              fullHeight="85dvh"
              zIndex="z-50"
              header={{
                title: 'Provider Template',
                rightContent: (
                  <HeaderPill>
                    <PillButton icon={X} iconSize={18} onClick={() => setPanelView('calendar')} label="Cancel" />
                    <PillButton
                      icon={Check}
                      iconSize={18}
                      accent="success"
                      onClick={() => templatePanelRef.current?.submit()}
                      label="Generate"
                      data-tour="template-generate"
                    />
                  </HeaderPill>
                ),
                hideDefaultClose: true,
              }}
            >
              <div className="relative h-full">
                <TemplateGeneratorPanel
                  key={templateNonce}
                  ref={templatePanelRef}
                  clinicId={activeClinicId}
                  userId={user.id}
                  onDone={() => setPanelView('calendar')}
                />
              </div>
            </BaseDrawer>
          )}

          {/* Mobile block-templates drawer — supervisor bulk-clear */}
          {activeClinicId && isSupervisor && (
            <BaseDrawer
              isVisible={showBlockDrawer}
              onClose={() => setPanelView('calendar')}
              mobileOnly
              fullHeight="85dvh"
              zIndex="z-50"
              header={{
                title: 'Clear Templates',
                rightContent: (
                  <HeaderPill>
                    <PillButton icon={X} iconSize={18} onClick={() => setPanelView('calendar')} label="Cancel" />
                    <PillButton
                      icon={Trash2}
                      iconSize={18}
                      accent="danger"
                      onClick={() => blockPanelRef.current?.submit()}
                      label="Clear"
                      variant="danger"
                      data-tour="block-clear"
                    />
                  </HeaderPill>
                ),
                hideDefaultClose: true,
              }}
            >
              <div className="relative h-full">
                <BlockTemplatedPanel
                  key={blockNonce}
                  ref={blockPanelRef}
                  clinicId={activeClinicId}
                  onDone={() => setPanelView('calendar')}
                />
              </div>
            </BaseDrawer>
          )}

          {/* Mobile event drawer — tap an event to view/edit */}
          <BaseDrawer
            isVisible={showDayDrawer}
            onClose={handleDayDrawerClose}
            mobileOnly
            fullHeight="85dvh"
            zIndex="z-50"
            header={dayDrawerView === 'edit' ? {
              title: formIsTask ? 'Edit Task' : 'Edit Event',
              rightContent: (
                <HeaderPill>
                  {editingEvent && (
                    <PillButton icon={Trash2} iconSize={18} onClick={() => setConfirmDeleteEvent(editingEvent.id)} label="Delete" variant="danger" />
                  )}
                  <PillButton icon={X} iconSize={18} onClick={handleDayDrawerEditCancel} label="Cancel" />
                  <PillButton
                    icon={Check}
                    iconSize={18}
                    accent="success"
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
                  <PillButton icon={Share2} iconSize={16} onClick={() => shareSingleEvent(dayDrawerEvent).catch(() => {})} label="Add to phone calendar" />
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
                  onCancelTemplate={handleCancelTemplate}
                  apptTypeNames={apptTypeNames}
                  canDeleteTemplate={isSupervisor}
                  onStatusChange={handleEventStatusChange}
                  onUpdatePcc={handleUpdateEventPcc}
                  assignedNames={resolveAssigned(dayDrawerEvent.assigned_to)}
                  linkedPropertyItems={resolvePropertyItems(dayDrawerEvent.property_item_ids ?? [])}
                  overlayOptions={overlayOptions}
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
                  propertyItems={propertyItems}
                  overlayOptions={overlayOptions}
                  roomOptions={roomFormOptions}
                huddleTaskOptions={huddleTaskFormOptions}
                pccTemplateOptions={sortedPccTemplates}
                isDev={isDevRole}
                clinicOptions={clinicFormOptions}
                onCreateOverlay={handleCreateOverlayForEvent}
                />
              )}

              <LoadingOverlay visible={isFormPending || isWriting || isDeleting} className="rounded-xl" />
            </div>
          </BaseDrawer>

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
                      {editingEvent ? (formIsTask ? 'Edit Task' : 'Edit Event') : (formIsTask ? 'New Task' : 'New Event')}
                    </h2>
                    <HeaderPill>
                      {editingEvent && (
                        <PillButton icon={Trash2} iconSize={18} onClick={() => setConfirmDeleteEvent(editingEvent.id)} label="Delete" variant="danger" />
                      )}
                      <PillButton icon={X} iconSize={18} onClick={handleFormCancel} label="Cancel" />
                      <PillButton
                        icon={Check}
                        iconSize={18}
                        accent="success"
                        onClick={() => eventFormRef.current?.submit()}
                        label="Save"
                      />
                    </HeaderPill>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto">
                    <EventForm
                      ref={eventFormRef}
                      initialData={editingEvent ? eventToFormData(editingEvent) : newEventInitialData}
                      onSave={handleSaveEvent}
                      isEditing={!!editingEvent}
                      medics={medicList}
                      propertyItems={propertyItems}
                      overlayOptions={overlayOptions}
                      roomOptions={roomFormOptions}
                huddleTaskOptions={huddleTaskFormOptions}
                pccTemplateOptions={sortedPccTemplates}
                isDev={isDevRole}
                clinicOptions={clinicFormOptions}
                onCreateOverlay={handleCreateOverlayForEvent}
                    />
                  </div>
                  <LoadingOverlay visible={isFormPending || isWriting || isDeleting} className="rounded-xl" />
                </div>
              ) : panelView === 'detail' && selectedEvent ? (
                <div className="relative flex flex-col flex-1 min-h-0">
                  <EventDetailPanel
                    event={selectedEvent}
                    onClose={handleDetailBack}
                    onEdit={handleEditEvent}
                    onDelete={handleDeleteEvent}
                    onCancelTemplate={handleCancelTemplate}
                    apptTypeNames={apptTypeNames}
                    canDeleteTemplate={isSupervisor}
                    onStatusChange={handleEventStatusChange}
                  onUpdatePcc={handleUpdateEventPcc}
                    assignedNames={resolveAssigned(selectedEvent.assigned_to)}
                    linkedPropertyItems={resolvePropertyItems(selectedEvent.property_item_ids ?? [])}
                    overlayOptions={overlayOptions}
                  />
                  <LoadingOverlay visible={isDeleting} className="rounded-xl" />
                </div>
              ) : panelView === 'template' && activeClinicId && user && isSupervisor ? (
                <div className="relative flex flex-col flex-1 min-h-0">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-tertiary/10">
                    <h2 className="text-sm font-semibold text-primary whitespace-nowrap">Provider Template</h2>
                    <HeaderPill>
                      <PillButton icon={X} iconSize={18} onClick={() => setPanelView('calendar')} label="Cancel" />
                      <PillButton
                        icon={Check}
                        iconSize={18}
                        accent="success"
                        onClick={() => templatePanelRef.current?.submit()}
                        label="Generate"
                        data-tour="template-generate"
                      />
                    </HeaderPill>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto">
                    <TemplateGeneratorPanel
                      key={templateNonce}
                      ref={templatePanelRef}
                      clinicId={activeClinicId}
                      userId={user.id}
                      onDone={() => setPanelView('calendar')}
                    />
                  </div>
                </div>
              ) : panelView === 'block' && activeClinicId && isSupervisor ? (
                <div className="relative flex flex-col flex-1 min-h-0">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-tertiary/10">
                    <h2 className="text-sm font-semibold text-primary whitespace-nowrap">Clear Templates</h2>
                    <HeaderPill>
                      <PillButton icon={X} iconSize={18} onClick={() => setPanelView('calendar')} label="Cancel" />
                      <PillButton
                        icon={Trash2}
                        iconSize={18}
                        accent="danger"
                        onClick={() => blockPanelRef.current?.submit()}
                        label="Clear"
                        variant="danger"
                        data-tour="block-clear"
                      />
                    </HeaderPill>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto">
                    <BlockTemplatedPanel
                      key={blockNonce}
                      ref={blockPanelRef}
                      clinicId={activeClinicId}
                      onDone={() => setPanelView('calendar')}
                    />
                  </div>
                </div>
              ) : null
            )}
          </div>
        )}
      </div>

      <ActionSheet
        visible={showAddSheet}
        title="Calendar"
        options={[
          { key: 'new', label: 'New Event', onAction: () => handleNewEvent() },
          { key: 'new-task', label: 'New Task', onAction: () => handleNewEvent(undefined, 'task') },
          ...(isSupervisor ? [
            { key: 'template', label: 'Provider Template…', onAction: () => { setTemplateNonce(n => n + 1); setPanelView('template') } },
            { key: 'clear-templates', label: 'Clear Templates…', onAction: () => { setBlockNonce(n => n + 1); setPanelView('block') } },
          ] : []),
          { key: 'import', label: 'Import CSV', onAction: () => setShowImportSheet(true), tourTag: 'calendar-export-import' },
          { key: 'export', label: 'Export .ics', onAction: () => shareCalendar(events).catch(() => {}) },
        ]}
        onClose={() => setShowAddSheet(false)}
      />

      {showImportSheet && activeClinicId && user && (
        <CalendarCSVImportSheet
          visible={showImportSheet}
          onClose={() => setShowImportSheet(false)}
          clinicId={activeClinicId}
          userId={user.id}
        />
      )}


      {deleteConfirmDialog}
      <ConfirmDialog
        visible={!!duplicateHuddle}
        title="Already assigned"
        subtitle={duplicateHuddle ? `${duplicateHuddle.medicLabel} is already on ${duplicateHuddle.rowName} for this day. Remove the existing assignment?` : ''}
        confirmLabel="Remove"
        cancelLabel="Keep"
        variant="danger"
        onConfirm={async () => {
          const id = duplicateHuddle?.eventId
          setDuplicateHuddle(null)
          if (id) await calendarDeleteEvent(id)
        }}
        onCancel={() => setDuplicateHuddle(null)}
      />

      {contextMenu && (() => {
        const ctxEvent = events.find(e => e.id === contextMenu.eventId)
        const ctxEditable = ctxEvent ? isEventEditable(ctxEvent, isSupervisor) : false
        const ctxDeletable = ctxEvent ? isTemplateStructureMutable(ctxEvent, isSupervisor) : false
        const statusSubmenu: ContextMenuItem[] = ctxEvent && ctxEditable ? [
          ...(ctxEvent.status !== 'pending'     ? [{ key: 'status-pending',     label: 'Pending',      icon: Clock,        onAction: () => handleStatusChange(contextMenu.eventId, 'pending') }] : []),
          ...(ctxEvent.status !== 'in_progress' ? [{ key: 'status-inprogress',  label: 'Active',       icon: Play,         onAction: () => handleStatusChange(contextMenu.eventId, 'in_progress') }] : []),
          ...(ctxEvent.status !== 'completed'   ? [{ key: 'status-completed',   label: 'Done',         icon: CheckCircle2, onAction: () => handleStatusChange(contextMenu.eventId, 'completed') }] : []),
          ...(ctxEvent.status !== 'cancelled'   ? [{ key: 'status-cancelled',   label: 'Cancel',       icon: Ban,          onAction: () => handleStatusChange(contextMenu.eventId, 'cancelled'), destructive: true }] : []),
        ] : []
        const STATUS_TRIGGER: Record<string, typeof Clock> = {
          pending: CircleDashed, in_progress: Play, completed: CheckCircle2, cancelled: Ban,
        }
        const statusItems: ContextMenuItem[] = statusSubmenu.length > 0 && ctxEvent
          ? [{ key: 'status', label: 'Status', icon: STATUS_TRIGGER[ctxEvent.status] ?? CircleDashed, submenu: statusSubmenu }]
          : []
        const editItems: ContextMenuItem[] = [
          ...(ctxEditable ? [{ key: 'edit', label: 'Edit', icon: Pencil, onAction: () => handleEditEvent(contextMenu.eventId) }] : []),
          ...(ctxDeletable ? [{ key: 'delete', label: 'Delete', icon: Trash2, destructive: true, onAction: () => setConfirmDeleteEvent(contextMenu.eventId) }] : []),
        ]
        if (statusItems.length === 0 && editItems.length === 0) {
          setContextMenu(null)
          return null
        }
        return (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
            items={[...statusItems, ...editItems]}
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
