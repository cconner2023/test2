import { useEffect, useState, useRef } from 'react'
import { Pencil, X, Share2, Map as MapIcon, Copy, Check, Printer, Image, Ban, CircleDashed, Play, CheckCircle2, Clock, MessageSquare } from 'lucide-react'
import { reverseGeocode } from '../MapOverlay/searchResolver'
import { latLngToUTM } from '../MapOverlay/utmProjection'
import { OverlayTilePreview } from '../MapOverlay/OverlayTilePreview'
import { useMapOverlaysStore } from '../../stores/useMapOverlaysStore'
import type { LucideIcon } from 'lucide-react'
import type { OverlayFeature } from '../../Types/MapOverlayTypes'
import type { CalendarEvent, EventStatus, EventSubtask } from '../../Types/CalendarTypes'
import type { ClinicPreCombatCheck } from '../../lib/supervisorService'
import { EventTasksCard } from './EventTasksCard'
import { ContextMenu, type ContextMenuItem } from '../ContextMenu'
import { SectionHeader, SectionCard } from '../Section'
import { formatShortDayLabel, isEventEditable, isUnscheduledTemplate } from '../../Types/CalendarTypes'
import { useAuthStore } from '../../stores/useAuthStore'
import { useNavigationStore } from '../../stores/useNavigationStore'
import { HeaderPill, PillButton } from '../HeaderPill'
import { UserAvatar } from '../Settings/UserAvatar'
import { shareSingleEvent } from '../../lib/calendarExport'
import { useIsMobile } from '../../Hooks/useIsMobile'
import { useShareToChat } from '../Messages/ShareToChatPicker'
import { medevacToText, medevacToCompact, copyToClipboard, printReport } from '../../lib/reportExport'
import { BarcodeDisplay } from '../Barcode'

interface AssignedPerson {
  id: string
  initials: string
  name: string
  avatarId?: string | null
  firstName?: string | null
  lastName?: string | null
}

interface LinkedPropertyItem {
  id: string
  name: string
  nsn: string | null
}

interface EventDetailPanelProps {
  event: CalendarEvent
  onClose: () => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  /** Revert a templated event's title back to its appointment-type name (cancel without deleting). */
  onCancelTemplate?: (id: string) => void
  /** Names of the clinic's appointment types — drives unscheduled-vs-scheduled detection. */
  apptTypeNames?: readonly string[]
  /** Supervisor flag forwarded from CalendarPanel — gates the Delete affordance for templated events. */
  canDeleteTemplate?: boolean
  /** Tap-to-cycle status writer — wired in CalendarPanel. Renders the header status pill for any event when provided. */
  onStatusChange?: (id: string, next: EventStatus) => void
  /** Subtask writer. Receives the full next list to persist on the event. */
  onUpdateSubtasks?: (id: string, next: EventSubtask[]) => void
  /** Clinic Checklists available to seed standardized tasks. */
  checklistTemplates?: ClinicPreCombatCheck[]
  assignedNames?: AssignedPerson[]
  linkedPropertyItems?: LinkedPropertyItem[]
  /** Active clinic overlays — used to resolve names + coords for linked_overlays / linked_features. */
  overlayOptions?: {
    id: string
    name: string
    center?: [number, number]
    features?: { id: string; label: string; type: 'waypoint' | 'route' | 'area'; lat?: number; lng?: number }[]
  }[]
  hideHeader?: boolean
}

function formatDateTime(iso: string, allDay: boolean): string {
  const d = new Date(iso)
  if (allDay) {
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  }
  return formatShortDayLabel(d) +
    ' at ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

const STATUS_TRIGGER_ICON: Record<EventStatus, LucideIcon> = {
  pending:     CircleDashed,
  in_progress: Play,
  completed:   CheckCircle2,
  cancelled:   Ban,
}

const STATUS_TRIGGER_COLOR: Record<EventStatus, string> = {
  pending:     'text-tertiary',
  in_progress: 'text-themeblue1',
  completed:   'text-themegreen',
  cancelled:   'text-themeredred',
}

export function EventDetailPanel({ event, onClose, onEdit, onDelete: _onDelete, onCancelTemplate, apptTypeNames = [], canDeleteTemplate, onStatusChange, onUpdateSubtasks, checklistTemplates = [], assignedNames = [], linkedPropertyItems = [], overlayOptions, hideHeader }: EventDetailPanelProps) {
  const isMobile = useIsMobile()
  const txt = isMobile ? 'text-sm' : 'text-[10pt]'
  const rowPad = isMobile ? 'px-4 py-3' : 'px-3 py-2.5'
  const isSupervisor = useAuthStore(s => s.isSupervisorRole)
  const openMapOverlay = useNavigationStore(s => s.setShowMapOverlayDrawer)
  const overlaysCache = useMapOverlaysStore(s => s.overlays)
  const editable = isEventEditable(event, isSupervisor)
  const showCancelTemplate = event.category === 'templated' && !!onCancelTemplate && !isUnscheduledTemplate(event, apptTypeNames)
  const StatusIcon = STATUS_TRIGGER_ICON[event.status]
  const [statusMenu, setStatusMenu] = useState<{ x: number; y: number } | null>(null)
  const statusBtnRef = useRef<HTMLDivElement>(null)
  const openStatusMenu = () => {
    const rect = statusBtnRef.current?.getBoundingClientRect()
    if (!rect) return
    setStatusMenu({ x: rect.left, y: rect.bottom + 4 })
  }
  void canDeleteTemplate
  const [copied, setCopied] = useState(false)
  const [copiedDm, setCopiedDm] = useState<'image' | 'code' | null>(null)
  const barcodeRef = useRef<HTMLDivElement>(null)

  const { share: shareToChat, picker: shareToChatPicker } = useShareToChat()
  const handleShareToChat = () => {
    shareToChat({
      type: 'shared_ref',
      refKind: 'calendar-event',
      refId: event.id,
      label: event.title || 'Event',
      subLabel: formatDateTime(event.start_time, event.all_day),
    }, { kind: 'calendar-event', event })
  }

  function handleMedevacCopy() {
    if (!event.medevac_data) return
    copyToClipboard(medevacToText(event.medevac_data)).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleMedevacPrint() {
    if (!event.medevac_data) return
    printReport('9-Line MEDEVAC', medevacToText(event.medevac_data))
  }

  function handleCopyCode() {
    if (!event.medevac_data) return
    copyToClipboard(medevacToCompact(event.medevac_data)).then(() => {
      setCopiedDm('code')
      setTimeout(() => setCopiedDm(null), 2000)
    })
  }

  function handleCopyImage() {
    const canvas = barcodeRef.current?.querySelector('canvas')
    if (!canvas) return
    canvas.toBlob(blob => {
      if (!blob) return
      navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
        .then(() => { setCopiedDm('image'); setTimeout(() => setCopiedDm(null), 2000) })
        .catch(() => {})
    }, 'image/png')
  }

  return (
    <div className="flex flex-col h-full">
      {!hideHeader && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-primary/10 shrink-0">
          <div />
          <HeaderPill>
            {onStatusChange && (
              <div ref={statusBtnRef} className={STATUS_TRIGGER_COLOR[event.status]}>
                <PillButton icon={StatusIcon} iconSize={16} onClick={openStatusMenu} label="Status" />
              </div>
            )}
            <PillButton icon={MessageSquare} iconSize={16} onClick={handleShareToChat} label="Share to chat" />
            <PillButton icon={Share2} iconSize={16} onClick={() => shareSingleEvent(event).catch(() => {})} label="Add to phone calendar" />
            {showCancelTemplate && (
              <PillButton icon={Ban} iconSize={16} onClick={() => onCancelTemplate?.(event.id)} label="Cancel appointment" />
            )}
            {editable && <PillButton icon={Pencil} iconSize={16} onClick={() => onEdit(event.id)} label="Edit" />}
            <PillButton icon={X} iconSize={16} onClick={onClose} label="Close" />
          </HeaderPill>
        </div>
      )}

      <div className={`${hideHeader ? '' : 'flex-1 overflow-y-auto'} ${isMobile ? 'px-4 py-4 space-y-4' : 'px-3 py-3 space-y-3'}`}>
        {/* Event read-out */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-primary">{event.title}</h2>

          <SectionCard className="divide-y divide-themeblue3/10">
            <div className={rowPad}>
              <SectionHeader>Date</SectionHeader>
              <p className={`text-primary ${txt}`}>
                {formatDateTime(event.start_time, event.all_day)}
                {!event.all_day && (
                  <span className="text-tertiary"> — {formatDateTime(event.end_time, false)}</span>
                )}
                {event.report_time && (
                  <span className="text-tertiary"> · Report: {event.report_time}</span>
                )}
              </p>
            </div>

            <div className={rowPad}>
              <SectionHeader>Assigned</SectionHeader>
              <div className="flex items-center gap-2 flex-wrap">
                {assignedNames.length === 0 ? (
                  <span className={`text-tertiary ${txt}`}>Unassigned</span>
                ) : (
                  assignedNames.map((person) => (
                    <span key={person.id} className={`inline-flex items-center gap-1.5 text-primary ${txt}`}>
                      <UserAvatar
                        avatarId={person.avatarId}
                        firstName={person.firstName}
                        lastName={person.lastName}
                        className={isMobile ? 'w-6 h-6' : 'w-5 h-5'}
                      />
                      <span>{person.name}</span>
                    </span>
                  ))
                )}
              </div>
            </div>

            {(() => {
              const fullIds = event.linked_overlays ?? []
              const featureAnchors = (event.linked_features ?? []).filter(f => !fullIds.includes(f.overlay_id))
              const hasLocation = !!event.location
              const hasMaps = !!overlayOptions && (fullIds.length > 0 || featureAnchors.length > 0)
              if (!hasLocation && !hasMaps) return null
              const overlayFor = (id: string) => overlayOptions?.find(o => o.id === id)
              const cachedOverlay = (id: string) => overlaysCache.find(o => o.id === id)
              type Row = {
                key: string; name: string; lat?: number; lng?: number; onClick: () => void
                /** Overlay backing the offline tile cache. */
                overlayId: string
                /** Full-geometry features to draw on the preview — resolved from the overlays cache. */
                features: OverlayFeature[]
              }
              const rows: Row[] = []
              for (const id of fullIds) {
                const o = overlayFor(id)
                rows.push({
                  key: `full-${id}`,
                  name: o?.name ?? '—',
                  lat: o?.center?.[0],
                  lng: o?.center?.[1],
                  onClick: () => openMapOverlay(true, id),
                  overlayId: id,
                  features: cachedOverlay(id)?.features ?? [],
                })
              }
              for (const f of featureAnchors) {
                const o = overlayFor(f.overlay_id)
                const feat = o?.features?.find(x => x.id === f.feature_id)
                // Resolve FULL geometry from the cache — overlayOptions carries only the slim
                // {id,label,type,lat,lng} projection, which can't drive the map preview.
                const cachedFeat = cachedOverlay(f.overlay_id)?.features.find(x => x.id === f.feature_id)
                rows.push({
                  key: `feat-${f.overlay_id}-${f.feature_id}`,
                  name: feat?.label ?? '(feature)',
                  lat: feat?.lat,
                  lng: feat?.lng,
                  onClick: () => openMapOverlay(true, f.overlay_id, f.feature_id),
                  overlayId: f.overlay_id,
                  features: cachedFeat ? [cachedFeat] : [],
                })
              }
              return (
                <div className={rowPad}>
                  <SectionHeader>Where</SectionHeader>
                  {hasLocation && (
                    <p className={`text-primary ${txt}`}>{event.location}</p>
                  )}
                  {hasMaps && (
                    <div className={`flex flex-col gap-2 ${hasLocation ? 'mt-2' : ''}`}>
                      {rows.map(r => (
                        <div key={r.key} className="flex flex-col gap-1.5">
                          {r.features.length > 0 && (
                            <OverlayTilePreview
                              features={r.features}
                              overlayId={r.overlayId}
                              onClick={r.onClick}
                              className="rounded-xl h-[150px]"
                            />
                          )}
                          <LinkedLocationRow name={r.name} lat={r.lat} lng={r.lng} onClick={r.onClick} txt={txt} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })()}

            {event.uniform && (
              <div className={rowPad}>
                <SectionHeader>Uniform</SectionHeader>
                <p className={`text-primary ${txt}`}>{event.uniform}</p>
              </div>
            )}

            {event.description && (
              <div className={rowPad}>
                <SectionHeader>Notes</SectionHeader>
                <p className={`text-primary whitespace-pre-wrap ${txt}`}>{event.description}</p>
              </div>
            )}

            {/* Tasks */}
            {onUpdateSubtasks && (event.subtasks?.length ?? 0) > 0 && (
              <div className={rowPad}>
                <EventTasksCard
                  subtasks={event.subtasks ?? []}
                  templates={checklistTemplates}
                  assignedIds={event.assigned_to ?? []}
                  canEdit={false}
                  onChange={(next) => onUpdateSubtasks(event.id, next)}
                  isMobile={isMobile}
                />
              </div>
            )}

            {/* Equipment */}
            {linkedPropertyItems.length > 0 && (
              <div className={rowPad}>
                <SectionHeader>Equipment ({linkedPropertyItems.length})</SectionHeader>
                <div className="space-y-1.5">
                  {linkedPropertyItems.map((item) => (
                    <div key={item.id} className="min-w-0">
                      <p className={`font-medium text-primary truncate ${txt}`}>{item.name}</p>
                      {item.nsn && <p className="text-[9pt] text-tertiary">{item.nsn}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 9-line MEDEVAC */}
            {event.medevac_data && (
              <div className={rowPad}>
                <div className="flex items-center justify-between">
                  <SectionHeader>MEDEVAC Request</SectionHeader>
                  <div className="flex items-center gap-0.5 -mt-1">
                    <button
                      type="button"
                      onClick={handleMedevacCopy}
                      title="Copy"
                      className={`p-1.5 rounded-full transition-all active:scale-95 ${copied ? 'text-themegreen' : 'text-tertiary hover:text-primary hover:bg-themewhite3'}`}
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={handleMedevacPrint}
                      title="Print"
                      className="p-1.5 rounded-full text-tertiary hover:text-primary hover:bg-themewhite3 active:scale-95 transition-all"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className={`text-tertiary whitespace-pre-wrap leading-relaxed ${txt}`}>
                  {medevacToText(event.medevac_data)}
                </p>

                {/* Data Matrix */}
                <div className="mt-3">
                  <div className="flex items-center justify-between">
                    <SectionHeader>Data Matrix</SectionHeader>
                    <div className="flex items-center gap-0.5 -mt-1">
                      <button
                        type="button"
                        onClick={handleCopyImage}
                        title="Copy image"
                        className={`p-1.5 rounded-full transition-all active:scale-95 ${copiedDm === 'image' ? 'text-themegreen' : 'text-tertiary hover:text-primary hover:bg-themewhite3'}`}
                      >
                        {copiedDm === 'image' ? <Check className="w-4 h-4" /> : <Image className="w-4 h-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={handleCopyCode}
                        title="Copy code"
                        className={`p-1.5 rounded-full transition-all active:scale-95 ${copiedDm === 'code' ? 'text-themegreen' : 'text-tertiary hover:text-primary hover:bg-themewhite3'}`}
                      >
                        {copiedDm === 'code' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div ref={barcodeRef} className="rounded-xl overflow-hidden">
                    <BarcodeDisplay encodedText={medevacToCompact(event.medevac_data)} layout="col" />
                  </div>
                </div>
              </div>
            )}
          </SectionCard>
        </div>

        <div className={isMobile ? 'h-16 shrink-0' : 'h-8 shrink-0'} />
      </div>

      {statusMenu && onStatusChange && (() => {
        const apply = (next: EventStatus) => { onStatusChange(event.id, next); setStatusMenu(null) }
        const items: ContextMenuItem[] = []
        if (event.status !== 'pending')     items.push({ key: 'pending',    label: 'Pending', icon: Clock,        onAction: () => apply('pending') })
        if (event.status !== 'in_progress') items.push({ key: 'inprogress', label: 'Active',  icon: Play,         onAction: () => apply('in_progress') })
        if (event.status !== 'completed')   items.push({ key: 'completed',  label: 'Done',    icon: CheckCircle2, onAction: () => apply('completed') })
        if (event.status !== 'cancelled')   items.push({ key: 'cancelled',  label: 'Cancel',  icon: Ban,          onAction: () => apply('cancelled'), destructive: true })
        if (items.length === 0) { setStatusMenu(null); return null }
        return (
          <ContextMenu x={statusMenu.x} y={statusMenu.y} onClose={() => setStatusMenu(null)} items={items} />
        )
      })()}

      {shareToChatPicker}
    </div>
  )
}

interface LinkedLocationRowProps {
  name: string
  lat?: number
  lng?: number
  onClick: () => void
  /** Tailwind text-size class for the primary name line (matches surrounding content). */
  txt: string
}

function formatUtm(lat: number, lng: number): string {
  const u = latLngToUTM(lat, lng)
  return `${u.zone}${u.northern ? 'N' : 'S'} ${Math.round(u.easting)} ${Math.round(u.northing)}`
}

function LinkedLocationRow({ name, lat, lng, onClick, txt }: LinkedLocationRowProps) {
  const [address, setAddress] = useState<string | null>(null)
  useEffect(() => {
    if (lat === undefined || lng === undefined) return
    let cancelled = false
    reverseGeocode(lat, lng).then(result => {
      if (!cancelled) setAddress(result)
    })
    return () => { cancelled = true }
  }, [lat, lng])
  const hasCoord = lat !== undefined && lng !== undefined
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-start text-left active:scale-[0.99] transition-all"
    >
      <span className={`text-themeblue3 hover:underline ${txt}`}>{name}</span>
      {address && (
        <span className="text-[9pt] text-tertiary truncate max-w-full">{address}</span>
      )}
      {hasCoord && (
        <span className="text-[9pt] text-tertiary font-mono">{formatUtm(lat!, lng!)}</span>
      )}
    </button>
  )
}

