import { useState, useRef } from 'react'
import { Pencil, X, Share2, Map, Copy, Check, Printer, Image, Ban, CircleDashed, Play, CheckCircle2, Clock } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { CalendarEvent, EventStatus } from '../../Types/CalendarTypes'
import { ContextMenu, type ContextMenuItem } from '../ContextMenu'
import { getCategoryMeta, formatShortDayLabel, isEventEditable, isUnscheduledTemplate } from '../../Types/CalendarTypes'
import { useAuthStore } from '../../stores/useAuthStore'
import { HeaderPill, PillButton } from '../HeaderPill'
import { UserAvatar } from '../Settings/UserAvatar'
import { shareSingleEvent } from '../../lib/calendarExport'
import { useIsMobile } from '../../Hooks/useIsMobile'
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
  onOpenMissionBoard?: () => void
  /** Tap-to-cycle status writer — wired in CalendarPanel via useCalendarWrite. Only consumed by the task status pill today. */
  onStatusChange?: (id: string, next: EventStatus) => void
  assignedNames?: AssignedPerson[]
  linkedPropertyItems?: LinkedPropertyItem[]
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

export function EventDetailPanel({ event, onClose, onEdit, onDelete: _onDelete, onCancelTemplate, apptTypeNames = [], canDeleteTemplate, onOpenMissionBoard, onStatusChange, assignedNames = [], linkedPropertyItems = [], hideHeader }: EventDetailPanelProps) {
  const isMobile = useIsMobile()
  const cat = getCategoryMeta(event.category)
  const isSupervisor = useAuthStore(s => s.isSupervisorRole)
  const editable = isEventEditable(event, isSupervisor)
  const showCancelTemplate = event.category === 'templated' && !!onCancelTemplate && !isUnscheduledTemplate(event, apptTypeNames)
  const isTask = event.category === 'task'
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
            {isTask && onStatusChange && (
              <div ref={statusBtnRef} className={STATUS_TRIGGER_COLOR[event.status]}>
                <PillButton icon={StatusIcon} iconSize={16} onClick={openStatusMenu} label="Status" />
              </div>
            )}
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
        {/* Event card */}
        <div className={`rounded-2xl border border-themeblue3/10 bg-themewhite2 space-y-3 ${isMobile ? 'p-4' : 'p-3'}`}>
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${cat.color}`} />
            <span className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">{cat.label}</span>
          </div>

          <h2 className={`font-bold text-primary ${isMobile ? 'text-lg' : 'text-sm'}`}>{event.title}</h2>

          <div className={`space-y-2 ${isMobile ? 'text-sm' : 'text-[10pt]'}`}>
            <p className="text-primary">
              {formatDateTime(event.start_time, event.all_day)}
              {!event.all_day && (
                <span className="text-tertiary"> — {formatDateTime(event.end_time, false)}</span>
              )}
            </p>

            {event.location && (
              <p className="text-secondary">{event.location}</p>
            )}

            {event.uniform && (
              <p className="text-secondary">{event.uniform}</p>
            )}

            {event.report_time && (
              <p className="text-secondary">Report: {event.report_time}</p>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              {assignedNames.length === 0 ? (
                <span className="text-tertiary">Unassigned</span>
              ) : (
                assignedNames.map((person) => (
                  <span key={person.id} className="inline-flex items-center gap-1.5">
                    <UserAvatar
                      avatarId={person.avatarId}
                      firstName={person.firstName}
                      lastName={person.lastName}
                      className={isMobile ? 'w-6 h-6' : 'w-5 h-5'}
                    />
                    <span className="font-medium text-primary">{person.name}</span>
                  </span>
                ))
              )}
            </div>
          </div>

          {event.description && (
            <div className="pt-3 border-t border-primary/8">
              <p className={`text-secondary whitespace-pre-wrap ${isMobile ? 'text-sm' : 'text-[10pt]'}`}>{event.description}</p>
            </div>
          )}
        </div>

        {/* Equipment card */}
        {linkedPropertyItems.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">Equipment</span>
              <span className="text-[9pt] px-1.5 py-0.5 rounded-full bg-tertiary/10 text-tertiary font-medium">
                {linkedPropertyItems.length}
              </span>
            </div>
            <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
              {linkedPropertyItems.map((item) => (
                <div key={item.id} className={`flex items-center ${isMobile ? 'gap-3 px-4 py-3' : 'gap-2 px-3 py-2'}`}>
                  <div className="min-w-0">
                    <p className={`font-medium text-primary truncate ${isMobile ? 'text-sm' : 'text-[10pt]'}`}>{item.name}</p>
                    {item.nsn && <p className="text-[9pt] text-tertiary">{item.nsn}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 9-line MEDEVAC */}
        {event.medevac_data && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">MEDEVAC Request</span>
              <div className="flex items-center gap-0.5">
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
            <div className="rounded-xl bg-themewhite2 overflow-hidden">
              <div className="px-4 py-3 text-tertiary text-[10pt] whitespace-pre-wrap leading-relaxed">
                {medevacToText(event.medevac_data)}
              </div>
            </div>

            {/* Data Matrix */}
            <div className="mt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">Data Matrix</span>
                <div className="flex items-center gap-0.5">
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

        {/* Mission Board — shown when event has an overlay link */}
        {event.structured_location?.overlay_id && onOpenMissionBoard && (
          <button
            onClick={onOpenMissionBoard}
            className={`w-full flex items-center justify-center gap-2 rounded-2xl border border-themegreen/30 bg-themegreen/10 font-medium text-themegreen active:scale-95 transition-all duration-200 ${
              isMobile ? 'px-4 py-3 text-sm' : 'px-3 py-2 text-[10pt]'
            }`}
          >
            <Map className={isMobile ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
            Open Mission Board
          </button>
        )}

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
    </div>
  )
}
