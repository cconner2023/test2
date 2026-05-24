import { useState, useMemo, useCallback } from 'react'
import { Mail, Check, X } from 'lucide-react'
import { useAuth } from '../../Hooks/useAuth'
import { useCalendarWrite } from '../../Hooks/useCalendarWrite'
import { useMessagesContext } from '../../Hooks/MessagesContext'
import { useMessagingStore } from '../../stores/useMessagingStore'
import { ConfirmDialog } from '../ConfirmDialog'
import { ActionPill } from '../ActionPill'
import { ActionButton } from '../ActionButton'
import { purgeIntake } from '../../lib/eventIntakeService'
import { deleteMessagesByOriginId as deleteMessagesByOriginIdFromDb } from '../../lib/signal/messageStore'
import { formatSignature } from '../../Utilities/NoteFormatter'
import { createLogger } from '../../Utilities/Logger'
import type { DecryptedSignalMessage } from '../../lib/signal/transportTypes'
import type { IntakeRequestContent, IntakeStatusContent } from '../../lib/signal/messageContent'
import type { CalendarEvent } from '../../Types/CalendarTypes'

const logger = createLogger('IntakeRequestCard')

interface IntakeRequestCardProps {
  message: DecryptedSignalMessage
  content: IntakeRequestContent
  isOwn: boolean
  avatar?: React.ReactNode
  senderName?: string
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
 * the mint/rotate/kill toggle UI in IntakeMintSection stays dev-gated so
 * unfinished features don't accidentally surface clinic-wide.
 */
export function IntakeRequestCard({ message, content, isOwn, avatar, senderName }: IntakeRequestCardProps) {
  const { user, profile, clinicId } = useAuth()
  const { writeEvent } = useCalendarWrite()
  const messages = useMessagesContext()
  const [confirmDecline, setConfirmDecline] = useState(false)
  const [busy, setBusy] = useState(false)

  // Card-folding: scan the current conversation for a matching intake-approved
  // reply by intake_id and collapse the action row when found.
  const groupId = message.groupId ?? null
  const status = useMessagingStore(s => {
    if (!groupId) return null
    const msgs = s.conversations[groupId] ?? []
    for (const m of msgs) {
      if (
        m.content?.type === 'intake_status'
        && m.content.kind === 'intake-approved'
        && m.content.intake_id === content.intake_id
      ) {
        return m.content as IntakeStatusContent
      }
    }
    return null
  })

  const onEmail = useCallback(() => {
    const subject = `Event request — ${content.title}`
    const summary =
      `From: ${content.requester_name}${content.requester_org ? ` — ${content.requester_org}` : ''}\n`
      + `Email: ${content.requester_email}\n`
      + `Window: ${formatWindow(content.requested_start, content.requested_end)}\n`
      + `Title: ${content.title}`
    const signature = profile ? formatSignature(profile) : ''
    const body = `Team member,\n\n${summary}\n\n${signature}`
    const url = `mailto:${encodeURIComponent(content.requester_email)}`
      + `?subject=${encodeURIComponent(subject)}`
      + `&body=${encodeURIComponent(body)}`
    window.open(url, '_blank')
  }, [content, profile])

  const onApprove = useCallback(async () => {
    if (!user || !clinicId) return
    setBusy(true)
    try {
      // Build a minimal CalendarEvent prefilled from the intake. v1 lands the
      // event with category='appointment' and no room/assignees; the supervisor
      // can edit it on the calendar afterwards. The intake_id field is what
      // triggers useCalendarWrite.writeEvent's auto-flip (mark approved + post
      // intake-approved reply to the clinic system group).
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
    } catch (e) {
      logger.warn('approve failed:', e instanceof Error ? e.message : e)
    } finally {
      setBusy(false)
    }
  }, [user, clinicId, content, writeEvent])

  const onDeclineConfirm = useCallback(async () => {
    setBusy(true)
    try {
      const res = await purgeIntake(content.intake_id)
      const serverOriginIds = res.ok ? res.data.deleted_origin_ids : []
      if (!res.ok) {
        // Server may legitimately 404 if a prior decline already purged the
        // row server-side; still fall through and nuke the local copy so
        // poisoned cards from before the local-cleanup fix can be dismissed.
        logger.warn('purge_intake failed (still cleaning local copy):', res.error)
      }
      const originIds = Array.from(new Set([
        ...serverOriginIds,
        ...(message.originId ? [message.originId] : []),
      ]))
      if (originIds.length > 0) {
        useMessagingStore.getState().removeMessagesByOriginIds(originIds)
        deleteMessagesByOriginIdFromDb(originIds, new Date().toISOString()).catch(() => {})
      }
      // Fan out the standard messageType='delete' envelope so offline peers
      // reconcile their local state. Intake-scoped: uses originIds returned by
      // the RPC, never broadens to other group messages.
      if (groupId && messages && serverOriginIds.length > 0) {
        try {
          // The existing deleteMessages primitive operates per-peer; for a
          // group purge we walk the group's member ids from the store. The
          // store's groupMembers[] is populated by useGroups; if absent we
          // still hard-deleted server-side so peers will reconcile on next
          // catch-up via the existing delete-envelope receive path elsewhere.
          const { groupMembers } = useMessagingStore.getState()
          const memberIds = groupMembers[groupId] ?? []
          for (const peerId of memberIds) {
            if (peerId === user?.id) continue
            messages.deleteMessages(peerId, []).catch(() => {})
          }
        } catch {
          // Best-effort fanout; server delete already succeeded.
        }
      }
    } catch (e) {
      logger.warn('decline failed:', e instanceof Error ? e.message : e)
    } finally {
      setBusy(false)
      setConfirmDecline(false)
    }
  }, [content.intake_id, groupId, messages, user?.id, message.originId])

  const windowLabel = useMemo(
    () => formatWindow(content.requested_start, content.requested_end),
    [content.requested_start, content.requested_end],
  )

  const labelCx = isOwn ? 'text-white/60' : 'text-primary/50'
  const linkCx = isOwn ? 'underline text-white' : 'underline text-primary'
  const statusCx = isOwn ? 'text-white/70' : 'text-tertiary'
  const timeCx = isOwn ? 'text-white/60' : 'text-tertiary'

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

            {status && (
              <p className={`text-[9pt] mt-1 ${statusCx}`}>
                Approved by {status.approved_by_name} ·{' '}
                {new Date(status.approved_at).toLocaleString([], {
                  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                })}
              </p>
            )}

            <div className={`flex items-center gap-1 mt-0.5 ${timeCx}`}>
              <p className="text-[9pt]">{formatTime(message.createdAt)}</p>
            </div>
          </div>

          {!status && (
            <ActionPill shadow="sm" placement="overlay">
              <ActionButton icon={Mail} label="Email requester" onClick={onEmail} variant={busy ? 'disabled' : 'default'} />
              <ActionButton icon={Check} label="Approve and create event" onClick={onApprove} variant={busy ? 'disabled' : 'success'} />
              <ActionButton icon={X} label="Decline and remove request" onClick={() => setConfirmDecline(true)} variant={busy ? 'disabled' : 'danger'} />
            </ActionPill>
          )}
        </div>
      </div>

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
    </>
  )
}
