import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { Clock, Users2, CalendarDays, X, Check, Pencil, Trash2, CalendarPlus, Play, CheckCircle2, Ban, CircleDashed, Move, MessageSquare } from 'lucide-react'
import { type ContextMenuItem } from '../ContextMenu'
import { LiftedRowMenu } from '../LiftedRowMenu'
import { useShallow } from 'zustand/react/shallow'
import { useIsMobile } from '../../Hooks/useIsMobile'
import { EventForm } from './EventForm'
import type { EventFormHandle } from './EventForm'
import { EventDetailPanel } from './EventDetailPanel'
import { DayView } from './DayView'
import { TripleDayView } from './TripleDayView'
import { TroopsToTaskView } from './TroopsToTaskView'
import { InfiniteScrollCalendar } from './InfiniteScrollCalendar'
import { useShareToChat } from '../Messages/ShareToChatPicker'
import { ConfirmDialog } from '../ConfirmDialog'
import { ActionSheet } from '../ActionSheet'
import { BaseDrawer } from '../BaseDrawer'
import { Sheet } from '../Sheet'
import { BottomIsland, IslandButton } from '../BottomIsland'
import { AddFab } from '../AddFab'
import { CalendarCSVImportDrawer } from './CalendarCSVImportDrawer'
import { TemplateGeneratorPanel, type TemplateGeneratorHandle } from './TemplateGeneratorPanel'
import { BlockTemplatedPanel, type BlockTemplatedHandle } from './BlockTemplatedPanel'
import { useAuthStore } from '../../stores/useAuthStore'
import { HeaderPill, PillButton } from '../HeaderPill'
import { useCalendarStore } from '../../stores/useCalendarStore'
import { useNavigationStore } from '../../stores/useNavigationStore'
import type { CalendarPrefill } from '../../stores/useNavigationStore'
import { useClinicMedics } from '../../Hooks/useClinicMedics'
import { useClinicGroupedMedics } from '../../Hooks/useClinicGroupedMedics'
import { useClinicZones, defaultZoneId } from '../../Hooks/useClinicZones'
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
import type { CalendarEvent, EventFormData, EventStatus, EventSubtask } from '../../Types/CalendarTypes'
import {
  eventToFormData, toDateKey, eventFallsOnDate, generateId, createEmptyFormData,
  PROVIDER_HUDDLE_TASK_ID, isEventEditable, isTemplateStructureMutable, toLocalISOString,
} from '../../Types/CalendarTypes'
import { useClinicAppointmentTypes } from '../../Hooks/useClinicAppointmentTypes'
import { useClinicCategoryColorsSync } from '../../Hooks/useClinicCategoryColors'
import { shareCalendar, shareTroopsToTaskCsv } from '../../lib/calendarExport'

type PanelView = 'calendar' | 'detail' | 'form' | 'template' | 'block'
type DayDrawerView = 'detail' | 'edit'

/**
 * Normalize a pressed element's rect into a compact, on-screen anchor for the
 * LiftedRowMenu clone/raise peek. The generic clone is a fixed-size card (not a
 * faithful copy of the pressed row), so we re-center a `w`×`h` box on the press
 * point and clamp it inside the viewport — a tiny month pill and a tall day cell
 * both lift as the same tidy card.
 */
function compactAnchorRect(r: DOMRect, w: number, h: number): DOMRect {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const left = Math.max(12, Math.min(r.left + r.width / 2 - w / 2, vw - w - 12))
  const top = Math.max(12, Math.min(r.top, vh - h - 80))
  return { x: left, y: top, left, top, width: w, height: h, right: left + w, bottom: top + h, toJSON() {} } as DOMRect
}

function cloneTime(event: CalendarEvent): string {
  const day = new Date(event.start_time).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  if (event.all_day) return `${day} · All day`
  const fmt = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  return `${day} · ${fmt(event.start_time)} – ${fmt(event.end_time)}`
}

/** Estimate the rendered clone height so the menu drops in just below it (the
 *  lift math anchors off anchorRect.bottom — a wrong height overlaps the two). */
function estimateEventCloneHeight(e: CalendarEvent): number {
  // Err slightly high — an over-estimate leaves a small gap, an under-estimate
  // lets the menu overlap the clone (the menu anchors off anchorRect.bottom).
  let h = 80 // p-3 padding + title (text-sm) + date/time line
  if (e.location) h += 24
  if (e.assigned_to.length) h += 24
  const n = e.subtasks?.length ?? 0
  if (n) h += 12 + n * 26 // space-y-2 gap + per-row checklist line
  return h
}

/** Generic lifted-row clone for an event — title, date/time, location, assigned,
 *  and the full subtask checklist. Same card regardless of which view (month
 *  pill / day card / T2T bar) was pressed. */
function EventClone({ event, assigned, subtaskLines, onToggleSubtask }: {
  event: CalendarEvent
  assigned: string[]
  subtaskLines: { id: string; label: string; done: boolean }[]
  /** When provided, subtask rows are tappable (assignee may tick). The clone is
   *  otherwise pointer-events-none in the lifted menu, so these rows opt back in. */
  onToggleSubtask?: (subtaskId: string) => void
}) {
  return (
    <div className="w-full rounded-xl border border-primary/10 bg-themewhite p-3 space-y-2">
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-semibold text-primary truncate">{event.title || 'Untitled event'}</p>
        <p className="text-[10pt] text-tertiary truncate">{cloneTime(event)}</p>
        {event.location && (
          <p className="text-[10pt] text-tertiary truncate">{event.location}</p>
        )}
        {assigned.length > 0 && (
          <p className="text-[10pt] text-tertiary truncate">{assigned.join(', ')}</p>
        )}
      </div>
      {subtaskLines.length > 0 && (
        <div className="space-y-1 pl-0.5">
          {subtaskLines.map((t) => {
            const box = (
              <>
                <span className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center ${t.done ? 'bg-themeblue3 border-themeblue3' : 'border-tertiary/30'}`}>
                  {t.done && <Check size={10} className="text-white" />}
                </span>
                <span className={`flex-1 min-w-0 truncate text-[10pt] text-left ${t.done ? 'text-tertiary line-through' : 'text-primary'}`}>{t.label}</span>
              </>
            )
            return onToggleSubtask ? (
              <button
                key={t.id}
                type="button"
                onClick={(e) => { e.stopPropagation(); onToggleSubtask(t.id) }}
                className="w-full flex items-center gap-2 pointer-events-auto active:scale-[0.98] transition-transform"
              >
                {box}
              </button>
            ) : (
              <div key={t.id} className="flex items-center gap-2">{box}</div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Generic lifted-row clone for a day cell — a date chip. */
function DayClone({ dateKey }: { dateKey: string }) {
  const label = new Date(dateKey + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  return (
    <div className="w-full rounded-xl border border-primary/10 bg-themewhite px-3 py-2.5 flex items-center gap-2">
      <CalendarDays size={14} className="text-tertiary shrink-0" />
      <span className="text-sm font-semibold text-primary truncate">{label}</span>
    </div>
  )
}

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
  useClinicCategoryColorsSync(activeClinicId)
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
  const templatePanelRef = useRef<TemplateGeneratorHandle>(null)
  const blockPanelRef = useRef<BlockTemplatedHandle>(null)
  const [templateNonce, setTemplateNonce] = useState(0)
  const [blockNonce, setBlockNonce] = useState(0)

  const [confirmDeleteEvent, setConfirmDeleteEvent] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ eventId: string; rect: DOMRect } | null>(null)
  const [dayContextMenu, setDayContextMenu] = useState<{ dateKey: string; rect: DOMRect } | null>(null)
  const [moveModeEventId, setMoveModeEventId] = useState<string | null>(null)
  const moveToDateRef = useRef<(eventId: string, targetDateKey: string) => void>(() => {})
  const { share: shareToChat, picker: shareToChatPicker } = useShareToChat()
  const [newEventDateKey, setNewEventDateKey] = useState<string | undefined>(undefined)
  const [newEventHuddleTaskId, setNewEventHuddleTaskId] = useState<string | null>(null)
  const [newEventPrefill, setNewEventPrefill] = useState<CalendarPrefill | null>(null)

  const [duplicateHuddle, setDuplicateHuddle] = useState<{ eventId: string; rowName: string; medicLabel: string } | null>(null)

  const [showDayDrawer, setShowDayDrawer] = useState(false)
  const [dayDrawerView, setDayDrawerView] = useState<DayDrawerView>('detail')
  const [dayDrawerEventId, setDayDrawerEventId] = useState<string | null>(null)

  const { medics: allMedics } = useClinicMedics()
  const { ownClinicMedics } = useClinicGroupedMedics(allMedics)
  // Calendar "rooms" are structural property zones (BAS + sub-zones); see useClinicZones.
  const clinicZones = useClinicZones(activeClinicId)
  const roomFormOptions: RoomOption[] = useMemo(
    () => clinicZones.map(z => ({ id: z.id, name: z.name })),
    [clinicZones],
  )
  // Resolve an event's scheduling zone (room_id) to its map anchor, when that
  // zone is linked to an overlay (Phase 2) — feeds EventDetailPanel's Where map.
  const roomAnchorFor = (roomId: string | null | undefined) => {
    if (!roomId) return undefined
    const z = clinicZones.find(z => z.id === roomId)
    if (!z?.overlay_id) return undefined
    return { name: z.name, overlay_id: z.overlay_id, overlay_feature_id: z.overlay_feature_id ?? null }
  }
  // New events default to the cluster's standing zone (BAS).
  const defaultRoomId = useMemo(() => defaultZoneId(clinicZones), [clinicZones])
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
  const propertyStoreLocations = usePropertyStore(s => s.locations)
  // Subtask → display label (mirrors EventTasksCard.labelFor) for the lifted clone.
  const subtaskLabel = useCallback((sub: EventSubtask): string => {
    switch (sub.kind) {
      case 'task':              return sub.label
      case 'property_item':     return sub.label_override ?? propertyStoreItems.find(p => p.id === sub.ref)?.name ?? '(deleted item)'
      case 'property_location': return propertyStoreLocations.find(p => p.id === sub.ref)?.name ?? '(deleted location)'
    }
  }, [propertyStoreItems, propertyStoreLocations])
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
    t2tZoom,
    categoryFilter, setCategoryFilter,
    clusterFilter,
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
    t2tZoom: s.t2tZoom,
    categoryFilter: s.categoryFilter,
    setCategoryFilter: s.setCategoryFilter,
    clusterFilter: s.clusterFilter,
  })))

  const handleEventStatusChange = useCallback(async (id: string, next: import('../../Types/CalendarTypes').EventStatus) => {
    const event = events.find(e => e.id === id)
    if (!event) return
    await writeEvent({ ...event, status: next, updated_at: new Date().toISOString() })
  }, [events, writeEvent])

  const handleUpdateEventSubtasks = useCallback(async (id: string, next: import('../../Types/CalendarTypes').EventSubtask[]) => {
    const event = events.find(e => e.id === id)
    if (!event) return
    await writeEvent({ ...event, subtasks: next, updated_at: new Date().toISOString() })
  }, [events, writeEvent])

  // Tick a single subtask straight from the lifted clone. Tick is assignee-gated
  // (same rule as EventTasksCard). OPTIMISTIC + BATCHED: each tick writes the new
  // state to the store/IDB immediately (so the clone and everything else read it)
  // but does NOT fan out to the vault — that would be one egress message per tap.
  // The deferred vault fanout is flushed ONCE when the menu closes / the next
  // action runs (flushCloneSubtasks). dirtyCloneEventRef marks the event awaiting
  // that flush.
  const dirtyCloneEventRef = useRef<string | null>(null)

  const handleToggleCloneSubtask = useCallback((eventId: string, subtaskId: string) => {
    const event = useCalendarStore.getState().events.find(e => e.id === eventId)
    if (!event) return
    const uid = user?.id ?? null
    if (!uid || !event.assigned_to.includes(uid)) return
    const next = (event.subtasks ?? []).map(s =>
      s.id !== subtaskId
        ? s
        : s.done_at
          ? { ...s, done_by: null, done_at: null }
          : { ...s, done_by: uid, done_at: new Date().toISOString() },
    )
    // Store-only update (optimistic, persists to IDB) — no vaultUpdate here.
    useCalendarStore.getState().updateEvent(eventId, { ...event, subtasks: next, updated_at: new Date().toISOString() })
    dirtyCloneEventRef.current = eventId
  }, [user])

  // Fan out the batched subtask edits once. Called on menu close (and folded into
  // the status path, which fans out the full event itself). Cleared on delete.
  const flushCloneSubtasks = useCallback(() => {
    const id = dirtyCloneEventRef.current
    dirtyCloneEventRef.current = null
    if (!id) return
    const event = useCalendarStore.getState().events.find(e => e.id === id)
    if (event) vaultUpdate(event)
  }, [vaultUpdate])

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
        (userId !== null && e.assigned_to.includes(userId)) ||
        // Cross-cluster: an event distributed to any clinic I reach (its
        // assignee is loaned into / a home member of one of my clinics) is
        // mine to see, even though its authoring clinic_id is foreign. Mirrors
        // the fan-out target set so distribution and visibility stay symmetric.
        (e.target_clinic_ids?.some(c => reachableClinicIds.has(c)) ?? false)
      )
    }
    // Render-only cluster narrowing (loaned users). null = all reachable.
    // An event belongs to a cluster if it was authored there or fanned there.
    if (clusterFilter !== null && clusterFilter.length > 0) {
      out = out.filter(e =>
        clusterFilter.includes(e.clinic_id) ||
        (e.target_clinic_ids?.some(c => clusterFilter.includes(c)) ?? false)
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
  }, [events, personnelFilter, categoryFilter, clusterFilter, reachableClinicIds, userId])

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
    if (moveModeEventId) {
      moveToDateRef.current(moveModeEventId, toDateKey(date))
      setMoveModeEventId(null)
      return
    }
    setSelectedDate(date)
    if (viewMode === 'month') {
      setViewMode('day')
    }
  }, [viewMode, moveModeEventId, setSelectedDate, setViewMode])

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

  const handleNewEvent = useCallback((forDateKey?: string, prefill?: CalendarPrefill | null) => {
    setEditingEvent(null)
    setNewEventDateKey(forDateKey ?? selectedDateStr)
    setNewEventHuddleTaskId(null)
    setNewEventPrefill(prefill ?? null)
    setPanelView('form')
  }, [selectedDateStr])

  // Deep-link from external sources (Mission Board "+", a detected date in a
  // message, etc.) — open the new-event form on mount, applying any prefill.
  useEffect(() => {
    if (pendingCalendarAction !== 'new') return
    const prefill = useNavigationStore.getState().calendarPrefill
    const dateKey = prefill?.startISO ? prefill.startISO.slice(0, 10) : undefined
    handleNewEvent(dateKey, prefill)
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
    let base = { ...createEmptyFormData(newEventDateKey), clinic_id: activeClinicId ?? null, room_id: null }
    // Prefill from a deep-link (e.g. a detected date in a message). Seeds the
    // title and pins start_time to the parsed datetime; end defaults to +1h.
    if (newEventPrefill) {
      if (newEventPrefill.title) base = { ...base, title: newEventPrefill.title }
      if (newEventPrefill.category) base = { ...base, category: newEventPrefill.category }
      // Tag the scheduled event with its ADTMC algorithm so it rolls up as an
      // algorithm encounter (no STP cascade — completion logs the algorithm only).
      if (newEventPrefill.encounterAlgorithmId) {
        base = { ...base, encounter_algorithm_id: newEventPrefill.encounterAlgorithmId }
      }
      if (newEventPrefill.assignedTo && newEventPrefill.assignedTo.length > 0) {
        base = { ...base, assigned_to: newEventPrefill.assignedTo }
      }
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
      return { ...base, category: 'huddle' as const, huddle_task_id: newEventHuddleTaskId, room_id: defaultRoomId }
    }
    return base
  }, [newEventDateKey, newEventHuddleTaskId, newEventPrefill, activeClinicId, defaultRoomId])

  // Force EventForm to remount whenever the form session changes. EventForm
  // seeds its internal state from initialData ONCE (useState), so a prefill that
  // lands a tick after the form first mounts (e.g. the deep-link "new event"
  // effect setting newEventPrefill, or a message-detected date) would otherwise
  // never reach the inputs — the form would render blank. Keying by the data
  // identity guarantees a clean remount with the current initialData; it only
  // changes when a new session opens, so it never clobbers in-progress edits.
  const formKey = editingEvent
    ? `edit-${editingEvent.id}`
    : `new-${newEventDateKey ?? ''}-${newEventHuddleTaskId ?? ''}-${newEventPrefill?.startISO ?? ''}-${newEventPrefill?.title ?? ''}-${newEventPrefill?.encounterAlgorithmId ?? ''}`

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
          color: data.color ?? null,
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
          subtasks: data.subtasks ?? [],
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
          color: data.color ?? null,
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
          subtasks: data.subtasks ?? [],
          encounter_algorithm_id: data.encounter_algorithm_id ?? null,
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

  // handleSelectDate (declared earlier) reaches move-to-date through this ref to
  // avoid a temporal-dead-zone reference to the later-defined callback.
  moveToDateRef.current = handleMoveEventToDate

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

  const handleEventContextMenu = useCallback((eventId: string, rect: DOMRect) => {
    const ev = useCalendarStore.getState().events.find(e => e.id === eventId)
    const w = Math.min(Math.max(rect.width, 240), 340)
    const h = ev ? estimateEventCloneHeight(ev) : 72
    setContextMenu({ eventId, rect: compactAnchorRect(rect, w, h) })
  }, [])

  const handleDayContextMenu = useCallback((dateKey: string, rect: DOMRect) => {
    setDayContextMenu({ dateKey, rect: compactAnchorRect(rect, 200, 44) })
  }, [])

  // "Move" from the event menu: enter move mode and drop to the month grid so the
  // next day tap relocates the event (replaces touch drag-to-reschedule).
  const enterMoveMode = useCallback((eventId: string) => {
    setContextMenu(null)
    setMoveModeEventId(eventId)
    setViewMode('month')
  }, [setViewMode])

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
      color: data.color ?? null,
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
      subtasks: data.subtasks ?? [],
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
        {/* Move-mode banner — tap a day to relocate the chosen event */}
        {moveModeEventId && (() => {
          const mv = events.find(e => e.id === moveModeEventId)
          return (
            <div className="absolute top-0 inset-x-0 z-30 flex items-center justify-between gap-2 px-3 py-2 bg-themeblue3/15 border-b border-themeblue2/30 text-[10pt]">
              <span className="text-themeblue1 font-medium truncate">
                Tap a day to move{mv ? ` “${mv.title}”` : ' the event'}
              </span>
              <button
                onClick={() => setMoveModeEventId(null)}
                className="shrink-0 text-themeblue2 hover:text-themeblue1 font-semibold"
              >
                Cancel
              </button>
            </div>
          )
        })()}
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
                key={`t2t-${t2tZoom}`}
                date={selectedDate}
                events={filteredEvents}
                medics={ownClinicMedics}
                huddleTasks={sortedHuddleTasks}
                zoom={t2tZoom}
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

          <BottomIsland
            glass
            tour="calendar-view-switcher"
            fab={
              <AddFab tour="calendar-add-event" label="Add event" onClick={() => setShowAddSheet(true)} className="absolute right-4" />
            }
          >
            <IslandButton active={viewMode === 'month'} onClick={() => setViewMode('month')} label="Month" tour="calendar-view-month">
              <CalendarDays className="w-5 h-5" />
            </IslandButton>
            <IslandButton active={viewMode === 'day'} onClick={() => setViewMode('day')} label="Day" tour="calendar-view-day">
              <Clock className="w-5 h-5" />
            </IslandButton>
            <IslandButton active={viewMode === 'troops'} onClick={() => setViewMode('troops')} label="Troops to Task" tour="calendar-view-troops">
              <Users2 className="w-5 h-5" />
            </IslandButton>
          </BottomIsland>

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
                key={formKey}
                ref={eventFormRef}
                initialData={editingEvent ? eventToFormData(editingEvent) : newEventInitialData}
                onSave={handleSaveEvent}
                isEditing={!!editingEvent}
                medics={medicList}
                propertyItems={propertyItems}
                overlayOptions={overlayOptions}
                roomOptions={roomFormOptions}
                huddleTaskOptions={huddleTaskFormOptions}
                checklistTemplates={sortedPccTemplates}
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

          {/* Mobile event detail + edit — ONE Sheet, mirroring the map feature
              editor (FeatureEditor): read and edit share a single surface and
              the header pills swap by mode, rather than the edit being a separate
              drawer. Detail mode: EventDetailPanel renders its own ellipsis-left /
              close-right header (hideClose + draggable). Edit mode: the Sheet owns
              the header (title + Save/Delete pills, built-in Close = Cancel) and
              drag-dismiss is disabled so a stray drag can't discard form input.
              backdrop="block" dims the day drawer underneath so the sheet reads as
              distinct from it (their themewhite3 backgrounds are identical).
              Cancel is an EXPLICIT header pill (not the Sheet's built-in Close):
              it flips dayDrawerView back to 'detail' while showDayDrawer stays
              true, so the Sheet must NOT run its slide-down/unmount close path —
              that would set isMounted=false while isOpen stays true, desyncing the
              [isOpen]-keyed mount effect and stranding the sheet off-screen (which
              also froze further event selection). hideClose stays on in both modes. */}
          <Sheet
            isOpen={showDayDrawer && (dayDrawerView === 'detail' || dayDrawerView === 'edit')}
            onClose={dayDrawerView === 'edit' ? handleDayDrawerEditCancel : handleDayDrawerDetailBack}
            height="fit"
            maxHeight={60}
            backdrop="block"
            zIndex={1200}
            hideClose
            draggable={dayDrawerView === 'detail'}
            title={dayDrawerView === 'edit' ? 'Edit Event' : undefined}
            rightContent={dayDrawerView === 'edit' && editingEvent ? (
              <HeaderPill>
                <PillButton icon={Trash2} iconSize={18} onClick={() => setConfirmDeleteEvent(editingEvent.id)} label="Delete" variant="danger" />
                <PillButton icon={X} iconSize={18} onClick={handleDayDrawerEditCancel} label="Cancel" />
                <PillButton
                  icon={Check}
                  iconSize={18}
                  accent="success"
                  onClick={() => eventFormRef.current?.submit()}
                  label="Save"
                />
              </HeaderPill>
            ) : undefined}
          >
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
                onUpdateSubtasks={handleUpdateEventSubtasks}
                checklistTemplates={sortedPccTemplates}
                assignedNames={resolveAssigned(dayDrawerEvent.assigned_to)}
                linkedPropertyItems={resolvePropertyItems(dayDrawerEvent.property_item_ids ?? [])}
                overlayOptions={overlayOptions}
                roomAnchor={roomAnchorFor(dayDrawerEvent.room_id)}
                inSheet
              />
            )}
            {dayDrawerView === 'edit' && editingEvent && (
              <div className="relative">
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
                  checklistTemplates={sortedPccTemplates}
                  clinicOptions={clinicFormOptions}
                  onCreateOverlay={handleCreateOverlayForEvent}
                />
                <LoadingOverlay visible={isFormPending || isWriting || isDeleting} className="rounded-xl" />
              </div>
            )}
          </Sheet>

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
                        accent="success"
                        onClick={() => eventFormRef.current?.submit()}
                        label="Save"
                      />
                    </HeaderPill>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto">
                    <EventForm
                      key={formKey}
                      ref={eventFormRef}
                      initialData={editingEvent ? eventToFormData(editingEvent) : newEventInitialData}
                      onSave={handleSaveEvent}
                      isEditing={!!editingEvent}
                      medics={medicList}
                      propertyItems={propertyItems}
                      overlayOptions={overlayOptions}
                      roomOptions={roomFormOptions}
                huddleTaskOptions={huddleTaskFormOptions}
                checklistTemplates={sortedPccTemplates}
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
                  onUpdateSubtasks={handleUpdateEventSubtasks}
                  checklistTemplates={sortedPccTemplates}
                    assignedNames={resolveAssigned(selectedEvent.assigned_to)}
                    linkedPropertyItems={resolvePropertyItems(selectedEvent.property_item_ids ?? [])}
                    overlayOptions={overlayOptions}
                    roomAnchor={roomAnchorFor(selectedEvent.room_id)}
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
          ...(isSupervisor ? [
            { key: 'template', label: 'Provider Template…', onAction: () => { setTemplateNonce(n => n + 1); setPanelView('template') } },
            { key: 'clear-templates', label: 'Clear Templates…', onAction: () => { setBlockNonce(n => n + 1); setPanelView('block') } },
          ] : []),
          { key: 'import', label: 'Import CSV', onAction: () => setShowImportSheet(true), tourTag: 'calendar-export-import' },
          { key: 'export', label: 'Export .ics', onAction: () => shareCalendar(events).catch(() => {}) },
          { key: 'export-t2t', label: 'Export Troops-to-Task .csv', onAction: () => shareTroopsToTaskCsv(events, { medics: ownClinicMedics, huddleTasks: sortedHuddleTasks }).catch(() => {}) },
        ]}
        onClose={() => setShowAddSheet(false)}
      />

      {showImportSheet && activeClinicId && user && (
        <CalendarCSVImportDrawer
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
        // Status options as a horizontal icon strip in the top row of the menu
        // (same affordance as message reactions). Current status is color-lit;
        // the rest are tertiary. Editable events only. A status change fans out
        // the WHOLE event (incl. any pending subtask ticks), so clear the dirty
        // flag — its fanout already covers the batched subtasks (no double send).
        const applyCloneStatus = (status: EventStatus) => { handleStatusChange(contextMenu.eventId, status); dirtyCloneEventRef.current = null }
        const statusReactions: ContextMenuItem[] = ctxEvent && ctxEditable ? [
          { key: 'st-pending',  label: 'Pending', node: <CircleDashed size={18} className={ctxEvent.status === 'pending'     ? 'text-themeblue3'  : 'text-tertiary'} />, onAction: () => applyCloneStatus('pending') },
          { key: 'st-active',   label: 'Active',  node: <Play         size={18} className={ctxEvent.status === 'in_progress' ? 'text-themeblue1'  : 'text-tertiary'} />, onAction: () => applyCloneStatus('in_progress') },
          { key: 'st-done',     label: 'Done',    node: <CheckCircle2 size={18} className={ctxEvent.status === 'completed'   ? 'text-themegreen'  : 'text-tertiary'} />, onAction: () => applyCloneStatus('completed') },
          { key: 'st-cancel',   label: 'Cancel',  node: <Ban          size={18} className={ctxEvent.status === 'cancelled'   ? 'text-themeredred' : 'text-tertiary'} />, onAction: () => applyCloneStatus('cancelled') },
        ] : []
        const editItems: ContextMenuItem[] = [
          ...(ctxEditable ? [{ key: 'edit', label: 'Edit', icon: Pencil, onAction: () => handleEditEvent(contextMenu.eventId) }] : []),
          ...(ctxEditable ? [{ key: 'move', label: 'Move', icon: Move, onAction: () => enterMoveMode(contextMenu.eventId) }] : []),
          // Share is read-only — available on any event regardless of edit gating.
          // Reuses the same live-ref share as the EventDetailPanel "Share to chat".
          { key: 'share', label: 'Share to chat', icon: MessageSquare, onAction: () => {
            const ev = ctxEvent
            setContextMenu(null)
            if (ev) shareToChat(
              { type: 'shared_ref', refKind: 'calendar-event', refId: ev.id, label: ev.title || 'Event', subLabel: cloneTime(ev) },
              { kind: 'calendar-event', event: ev },
            )
          } },
          // Delete fans out 'd' on its own — drop any pending subtask flush.
          ...(ctxDeletable ? [{ key: 'delete', label: 'Delete', icon: Trash2, destructive: true, onAction: () => { dirtyCloneEventRef.current = null; setConfirmDeleteEvent(contextMenu.eventId) } }] : []),
        ]
        if (!ctxEvent) return null
        const ctxAssigned = ctxEvent.assigned_to
          .map(id => medicLookup.get(id)?.name)
          .filter((n): n is string => !!n)
        const ctxSubLines = [...(ctxEvent.subtasks ?? [])]
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .map(s => ({ id: s.id, label: subtaskLabel(s), done: !!s.done_at }))
        const canTickClone = !!userId && ctxEvent.assigned_to.includes(userId)
        const cloneEventId = ctxEvent.id
        return (
          <LiftedRowMenu
            isOpen
            anchorRect={contextMenu.rect}
            row={(
              <EventClone
                event={ctxEvent}
                assigned={ctxAssigned}
                subtaskLines={ctxSubLines}
                onToggleSubtask={canTickClone ? (sid) => handleToggleCloneSubtask(cloneEventId, sid) : undefined}
              />
            )}
            layout="list"
            reactions={statusReactions}
            items={editItems}
            onClose={() => { flushCloneSubtasks(); setContextMenu(null) }}
          />
        )
      })()}

      {dayContextMenu && (
        <LiftedRowMenu
          isOpen
          anchorRect={dayContextMenu.rect}
          row={<DayClone dateKey={dayContextMenu.dateKey} />}
          layout="list"
          items={[
            { key: 'add', label: 'Add Event', icon: CalendarPlus, onAction: () => handleNewEvent(dayContextMenu.dateKey) },
          ]}
          onClose={() => setDayContextMenu(null)}
        />
      )}

      {/* Share to chat: live deep-link ref (same flow as EventDetailPanel) */}
      {shareToChatPicker}
    </>
  )
}
