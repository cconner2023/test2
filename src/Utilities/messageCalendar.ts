// Utilities/messageCalendar.ts
// Shared builder for the "add to calendar" deep-link args derived from a chat
// message + a detected date. Used by both the inline MessageBubble affordance
// and the lifted context-menu item so they round-trip back to the same message.

import { toLocalISOString } from '../Types/CalendarTypes'
import type { DetectedDate } from './dateDetect'
import type { CalendarPrefill, CalendarReturn } from '../stores/useNavigationStore'

export interface MessageConvCtx {
  conversationId?: string
  conversationIsGroup?: boolean
  conversationPeerName?: string | null
  messageId: string
}

/** Build the (prefill, returnTo) tuple for useNavigationStore.requestNewCalendarEvent. */
export function calendarArgsForMessage(
  plaintext: string,
  detected: DetectedDate,
  ctx: MessageConvCtx,
): [CalendarPrefill, CalendarReturn | undefined] {
  const prefill: CalendarPrefill = {
    title: (plaintext ?? '').trim().slice(0, 80),
    startISO: toLocalISOString(detected.date),
  }
  const returnTo: CalendarReturn | undefined = ctx.conversationId
    ? {
        conversationId: ctx.conversationId,
        isGroup: !!ctx.conversationIsGroup,
        peerName: ctx.conversationPeerName ?? null,
        messageId: ctx.messageId,
      }
    : undefined
  return [prefill, returnTo]
}
