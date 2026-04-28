import { useState, useRef } from 'react'
import { Pencil, X, CalendarPlus, Map, Copy, Check, Printer, Image } from 'lucide-react'
import type { CalendarEvent } from '../../Types/CalendarTypes'
import { getCategoryMeta, formatShortDayLabel } from '../../Types/CalendarTypes'
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
  onOpenMissionBoard?: () => void
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

export function EventDetailPanel({ event, onClose, onEdit, onDelete: _onDelete, onOpenMissionBoard, assignedNames = [], linkedPropertyItems = [], hideHeader }: EventDetailPanelProps) {
  const isMobile = useIsMobile()
  const cat = getCategoryMeta(event.category)
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
            <PillButton icon={Pencil} iconSize={16} onClick={() => onEdit(event.id)} label="Edit" />
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
          </div>

          {event.description && (
            <div className="pt-3 border-t border-primary/8">
              <p className={`text-secondary whitespace-pre-wrap ${isMobile ? 'text-sm' : 'text-[10pt]'}`}>{event.description}</p>
            </div>
          )}
        </div>

        {/* Personnel card */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">Personnel</span>
            <span className="text-[9pt] px-1.5 py-0.5 rounded-full bg-tertiary/10 text-tertiary font-medium">
              {assignedNames.length}
            </span>
          </div>
          <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
            {assignedNames.length === 0 ? (
              <p className={`text-tertiary ${isMobile ? 'text-sm px-4 py-4' : 'text-[10pt] px-3 py-3'}`}>Unassigned</p>
            ) : (
              assignedNames.map((person) => (
                <div key={person.id} className={`flex items-center ${isMobile ? 'gap-3 px-4 py-3' : 'gap-2 px-3 py-2'}`}>
                  <UserAvatar
                    avatarId={person.avatarId}
                    firstName={person.firstName}
                    lastName={person.lastName}
                    className={isMobile ? 'w-10 h-10' : 'w-7 h-7'}
                  />
                  <span className={`font-medium text-primary ${isMobile ? 'text-sm' : 'text-[10pt]'}`}>{person.name}</span>
                </div>
              ))
            )}
          </div>
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

        {/* Add to phone calendar */}
        <button
          onClick={() => shareSingleEvent(event).catch(() => {})}
          className={`w-full flex items-center justify-center gap-2 rounded-2xl border border-themeblue2/20 bg-themewhite2 font-medium text-themeblue2 active:scale-95 transition-all duration-200 ${
            isMobile ? 'px-4 py-3 text-sm' : 'px-3 py-2 text-[10pt]'
          }`}
        >
          <CalendarPlus className={isMobile ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
          Add to Phone Calendar
        </button>

        <div className={isMobile ? 'h-16 shrink-0' : 'h-8 shrink-0'} />
      </div>
    </div>
  )
}
