import { Pencil, Move, MessageSquare, Share2, FileText, Ban, Trash2, CircleDashed, Play, CheckCircle2 } from 'lucide-react'
import type { ContextMenuItem } from '../ContextMenu'
import type { CalendarEvent, EventStatus } from '../../Types/CalendarTypes'

/**
 * SINGLE SOURCE OF TRUTH for the calendar-event action menu.
 *
 * Every surface that shows event actions — CalendarPanel's lifted-row peek
 * (right-click / long-press on a pill) AND EventDetailPanel's header ellipsis —
 * builds its menu from these helpers so an event offers the SAME actions
 * everywhere. Each surface gates an action by PASSING or OMITTING its handler:
 * an absent handler means the item isn't applicable here (e.g. not editable, no
 * linked geometry for CONOP). Do not add a bespoke per-surface item list — extend
 * the union here instead.
 */
export interface EventMenuHandlers {
  /** Editable events only — omit to hide Edit. */
  onEdit?: () => void
  /** Editable events only — omit to hide Move. */
  onMove?: () => void
  /** Read-only, always available. */
  onShareToChat?: () => void
  /** Export single event to the device calendar (.ics share). */
  onAddToPhoneCalendar?: () => void
  /** Pass only when the event has linked map geometry (canExportConop). */
  onExportConop?: () => void
  /** Pass only for scheduled templated events (showCancelTemplate). */
  onCancelTemplate?: () => void
  /** Pass only when the event's structure is mutable (deletable). */
  onDelete?: () => void
}

/**
 * Status reaction strip — the horizontal icon row that rides the top of the list
 * card (Pending / Active / Done / Cancel), current status color-lit. Returns []
 * unless `onStatus` is supplied (editable events only).
 */
export function buildEventStatusReactions(
  event: CalendarEvent,
  onStatus?: (status: EventStatus) => void,
): ContextMenuItem[] {
  if (!onStatus) return []
  return [
    { key: 'st-pending', label: 'Pending', node: <CircleDashed size={18} className={event.status === 'pending'     ? 'text-themeblue3'  : 'text-tertiary'} />, onAction: () => onStatus('pending') },
    { key: 'st-active',  label: 'Active',  node: <Play         size={18} className={event.status === 'in_progress' ? 'text-themeblue1'  : 'text-tertiary'} />, onAction: () => onStatus('in_progress') },
    { key: 'st-done',    label: 'Done',    node: <CheckCircle2 size={18} className={event.status === 'completed'   ? 'text-themegreen'  : 'text-tertiary'} />, onAction: () => onStatus('completed') },
    { key: 'st-cancel',  label: 'Cancel',  node: <Ban          size={18} className={event.status === 'cancelled'   ? 'text-themeredred' : 'text-tertiary'} />, onAction: () => onStatus('cancelled') },
  ]
}

/**
 * Vertical action rows for the list-card. Fixed order across surfaces:
 * Edit · Move · Share to chat · Add to phone calendar · CONOP PDF ·
 * Cancel appointment · Delete. Each item is included only when its handler is
 * provided.
 */
export function buildEventMenuItems(h: EventMenuHandlers): ContextMenuItem[] {
  const items: ContextMenuItem[] = []
  if (h.onEdit)              items.push({ key: 'edit',        label: 'Edit',                  icon: Pencil,        onAction: h.onEdit })
  if (h.onMove)              items.push({ key: 'move',        label: 'Move',                  icon: Move,          onAction: h.onMove })
  if (h.onShareToChat)       items.push({ key: 'share-chat',  label: 'Share to chat',         icon: MessageSquare, onAction: h.onShareToChat })
  if (h.onAddToPhoneCalendar) items.push({ key: 'share-cal',  label: 'Add to phone calendar', icon: Share2,        onAction: h.onAddToPhoneCalendar })
  if (h.onExportConop)       items.push({ key: 'conop',       label: 'CONOP PDF',             icon: FileText,      onAction: h.onExportConop })
  if (h.onCancelTemplate)    items.push({ key: 'cancel-appt', label: 'Cancel appointment',    icon: Ban,           onAction: h.onCancelTemplate })
  if (h.onDelete)            items.push({ key: 'delete',      label: 'Delete',                icon: Trash2,        destructive: true, onAction: h.onDelete })
  return items
}
