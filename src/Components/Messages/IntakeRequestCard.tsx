import { useMemo, useCallback, useState } from 'react'
import { Mail, Check, X, ShieldAlert } from 'lucide-react'
import { useAuth } from '../../Hooks/useAuth'
import { useCalendarWrite } from '../../Hooks/useCalendarWrite'
import { useMessagesContext } from '../../Hooks/MessagesContext'
import { useMessagingStore } from '../../stores/useMessagingStore'
import { ConfirmDialog } from '@/Components/primitives/ConfirmDialog'
import { OverlayActionMenu } from '@/Components/primitives/OverlayActionMenu'
import { intakeAction } from '../../lib/eventIntakeService'
import { deleteMessagesByOriginId as deleteMessagesByOriginIdFromDb } from '../../lib/signal/messageStore'
import { formatSignature } from '../../Utilities/NoteFormatter'
import { buildMailtoHref } from '../../lib/mailto'
import { createLogger } from '../../Utilities/Logger'
import type { DecryptedSignalMessage } from '../../lib/signal/transportTypes'
import type { IntakeRequestContent } from '../../lib/signal/messageContent'
import type { CalendarEvent } from '../../Types/CalendarTypes'

const logger = createLogger('IntakeRequestCard')

interface IntakeRequestCardProps {
  message: DecryptedSignalMessage
  content: IntakeRequestContent
  isOwn: boolean
  avatar?: React.ReactNode
  senderName?: string
  /** When false, the card is read-only — no Email/Approve/Decline pill. The
   * dev's AdminDrawer system view sets this: intake actions belong to
   * supervisors in the clinic system group, not the dev from their drawer. */
  actionable?: boolean
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function formatWindow(startIso: string, endIso: string): string {
  const start = new Date(startIso)
  const end = new Date(endIso)
  const sameDay =
    start.getFullYear() === end.getFullYear()
    && start.getMonth() === end.getMonth()
    && start.getDate() === end.getDate()
  const dateStr = start.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
  const startTime = start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  const endTime = end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (sameDay) return `${dateStr}, ${startTime}–${endTime}`
  return `${dateStr} ${startTime} → ${end.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} ${endTime}`
}

/**
 * Outside event-intake REQUEST card. Rendered inline in the clinic system
 * group conversation. All supervisors-of-clinic see and can act on the card;
 * the mint/rotate/kill toggle UI in IntakeMintSection stays dev-gated.
 *
 * The request was authored by the intake edge function as a real SYSTEM group
 * message (per-device X3DH) and decrypted by the standard Signal pipeline — so
 * `content` already holds the cleartext detail; the card just renders it. The
 * server only ever stored ciphertext. The header is marked EXTERNAL · UNVERIFIED
 * so an outside-authored card can't be mistaken for a teammate's.
 */
export function IntakeRequestCard({ message, content, isOwn, avatar, senderName, actionable = true }: IntakeRequestCardProps) {
  const { user, profile, clinicId } = useAuth()
  const { writeEvent } = useCalendarWrite()
  const messages = useMessagesContext()
  const [confirmDecline, setConfirmDecline] = useState(false)
  const [busy, setBusy] = useState(false)

  const groupId = message.groupId ?? null

  const stripLocal = useCallback((originIds: string[]) => {
    if (originIds.length === 0) return
    useMessagingStore.getState().removeMessagesByOriginIds(originIds)
    deleteMessagesByOriginIdFromDb(originIds, new Date().toISOString()).catch(() => {})
  }, [])

  // A real <a href> anchor (built here, applied on the menu item) is the only form
  // that reliably launches the mail client in the installed shell. See src/lib/mailto.ts.
  const emailHref = useMemo(() => {
    const subject = '[event request] -  Medical Operations Web Application'
    const summary =
      `From: ${content.requester_name}${content.requester_org ? ` — ${content.requester_org}` : ''}\n`
      + `Email: ${content.requester_email}\n`
      + `Window: ${formatWindow(content.requested_start, content.requested_end)}\n`
      + `Title: ${content.title}`
    const signature = profile ? formatSignature(profile) : ''
    const body = `Team member,\n\n${summary}\n\n${signature}`
    return buildMailtoHref({ to: content.requester_email, subject, body })
  }, [content, profile])

  const onApprove = useCallback(async () => {
    if (!user || !clinicId || !groupId || !messages) return
    setBusy(true)
    try {
      // v1 lands a minimal event (category='appointment', no room/assignees);
      // supervisor edits it on the calendar afterwards. The intake_id field on
      // the event row preserves the linkage for forensics. The requester detail
      // moves from the (E2E-encrypted) wire message into the clinic-internal
      // (vault-encrypted) calendar event on explicit supervisor approval.
      const now = new Date().toISOString()
      const newEvent: CalendarEvent = {
        id: crypto.randomUUID(),
        clinic_id: clinicId,
        title: `${content.requester_name} — ${content.title}`,
        description: content.requester_org
          ? `Outside intake from ${content.requester_org} (${content.requester_email})`
          : `Outside intake — ${content.requester_email}`,
        category: 'appointment',
        status: 'scheduled',
        start_time: content.requested_start,
        end_time: content.requested_end,
        all_day: false,
        location: null,
        opord_notes: null,
        uniform: null,
        report_time: null,
        assigned_to: [],
        property_item_ids: [],
        created_by: user.id,
        created_at: now,
        updated_at: now,
        intake_id: content.intake_id,
      }
      await writeEvent(newEvent)
      // Visible supervisor reply in the system group thread.
      await messages.sendGroupMessage(groupId, `${content.title} accepted`)
      // Server stamps status='approved'+event_id, hard-deletes the original
      // intake-request rows, and fans out SYSTEM-authored intake-delete
      // envelopes that strip every live client's local state.
      const res = await intakeAction(content.intake_id, 'accepted', newEvent.id)
      if (!res.ok) {
        logger.warn('intake_action accepted failed:', res.error)
      }
      stripLocal(message.originId ? [message.originId] : [])
    } catch (e) {
      logger.warn('approve failed:', e instanceof Error ? e.message : e)
    } finally {
      setBusy(false)
    }
  }, [user, clinicId, content, writeEvent, messages, groupId, stripLocal, message.originId])

  const onDeclineConfirm = useCallback(async () => {
    if (!groupId || !messages) {
      setConfirmDecline(false)
      return
    }
    setBusy(true)
    try {
      await messages.sendGroupMessage(groupId, `${content.title} declined`)
      const res = await intakeAction(content.intake_id, 'declined')
      if (!res.ok) {
        logger.warn('intake_action declined failed:', res.error)
      }
      stripLocal(message.originId ? [message.originId] : [])
    } catch (e) {
      logger.warn('decline failed:', e instanceof Error ? e.message : e)
    } finally {
      setBusy(false)
      setConfirmDecline(false)
    }
  }, [content, groupId, messages, stripLocal, message.originId])

  const windowLabel = useMemo(
    () => formatWindow(content.requested_start, content.requested_end),
    [content.requested_start, content.requested_end],
  )

  const labelCx = isOwn ? 'text-white/60' : 'text-primary/50'
  const linkCx = isOwn ? 'underline text-white' : 'underline text-primary'
  const timeCx = isOwn ? 'text-white/60' : 'text-tertiary'
  const badgeCx = isOwn ? 'text-white/70 bg-white/10' : 'text-themeyellow bg-themeyellow/10'

  return (
    <>
      <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} items-end px-1 mb-1.5`} data-message-id={message.id}>
        {!isOwn && avatar && (
          <div className="shrink-0 mb-0.5 mr-1.5">{avatar}</div>
        )}

        <div className="relative max-w-[75%]">
          <div
            className={`rounded-2xl px-3.5 py-2
                       ${isOwn ? 'bg-themeblue3 text-white rounded-br-md' : 'bg-themewhite2 text-primary rounded-bl-md'}`}
          >
            {senderName && !isOwn && (
              <p className="text-[9pt] font-semibold text-themeblue2 mb-0.5">{senderName}</p>
            )}

            {/* Provenance marker — this card was authored by an outside party over
                the QR + passphrase, not a verified teammate. */}
            <div className={`inline-flex items-center gap-1 mb-1 px-1.5 py-0.5 rounded-md text-[8pt] font-semibold tracking-wide uppercase ${badgeCx}`}>
              <ShieldAlert size={10} />
              External · Unverified
            </div>

            <div className="space-y-1 text-[10pt]">
              <div>
                <span className={labelCx}>From:</span>{' '}
                {content.requester_name}
                {content.requester_org ? ` — ${content.requester_org}` : ''}
              </div>
              <div>
                <span className={labelCx}>Email:</span>{' '}
                <a className={linkCx} href={`mailto:${content.requester_email}`}>
                  {content.requester_email}
                </a>
              </div>
              <div>
                <span className={labelCx}>Window:</span> {windowLabel}
              </div>
              <div>
                <span className={labelCx}>Title:</span> {content.title}
              </div>
            </div>

            <div className={`flex items-center gap-1 mt-0.5 ${timeCx}`}>
              <p className="text-[9pt]">{formatTime(message.createdAt)}</p>
            </div>
          </div>

          {actionable && (
            <OverlayActionMenu
              items={[
                { key: 'email', label: 'Email requester', icon: Mail, href: busy ? undefined : emailHref, variant: busy ? 'disabled' : 'default' },
                { key: 'approve', label: 'Approve and create event', icon: Check, onAction: onApprove, variant: busy ? 'disabled' : 'success' },
                { key: 'decline', label: 'Decline and remove request', icon: X, onAction: () => setConfirmDecline(true), variant: busy ? 'disabled' : 'danger' },
              ]}
            />
          )}
        </div>
      </div>

      {actionable && (
        <ConfirmDialog
          visible={confirmDecline}
          title="Decline this event request?"
          subtitle="Decline and remove this request? The requester won't be notified automatically — use Email first if you want to respond."
          confirmLabel="Decline"
          cancelLabel="Cancel"
          variant="danger"
          processing={busy}
          onConfirm={onDeclineConfirm}
          onCancel={() => setConfirmDecline(false)}
        />
      )}
    </>
  )
}
