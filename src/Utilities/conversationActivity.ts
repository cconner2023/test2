/**
 * Conversation activity helpers — shared by the conversation list (MessagesPanel)
 * and the Overview "Messages" widget (MissionBoardPanel).
 *
 * WHY: thread replies (`m.threadId` set) are hidden from the main message list so
 * the conversation stays uncluttered. But the list-row preview + sort used to also
 * exclude them (`.filter(m => !m.threadId)`), so a fresh reply never updated the
 * row preview and never bumped the conversation up the list — while the unread
 * badge still incremented. Result: "unread but invisible" threads got overlooked.
 *
 * These helpers treat a thread reply as real conversation activity (it counts for
 * sort + preview) while marking it with a branch glyph so the user can tell the
 * new activity happened inside a thread.
 */

import type { DecryptedSignalMessage } from '../lib/signal/transportTypes'

/** Branch glyph prefixed to a reply preview so it reads as thread activity. */
export const THREAD_PREVIEW_PREFIX = '↳ '

/**
 * Messages that count as conversation activity. Excludes control-plane
 * (`request-accepted`) rows but KEEPS thread replies — matching the prior
 * visibility intent minus the thread exclusion.
 */
export function activityMessages(msgs: DecryptedSignalMessage[] | undefined): DecryptedSignalMessage[] {
  if (!msgs) return []
  return msgs.filter(m => m.messageType !== 'request-accepted')
}

/** Most recent activity message (thread replies included), or undefined. */
export function lastActivityMessage(msgs: DecryptedSignalMessage[] | undefined): DecryptedSignalMessage | undefined {
  return activityMessages(msgs).at(-1)
}

/**
 * Row preview text for a conversation. Thread replies get the branch prefix so
 * the user knows the latest activity is a reply inside a thread, not a top-level
 * message.
 */
export function activityPreview(msg: DecryptedSignalMessage | undefined): string | undefined {
  if (!msg) return undefined
  return msg.threadId ? `${THREAD_PREVIEW_PREFIX}${msg.plaintext}` : msg.plaintext
}

/** Compact relative time ("now" / "5m" / "2h" / "3d") for thread "last reply" labels. */
export function relativeShort(iso: string | undefined): string {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(ms) || ms < 0) return 'now'
  const min = Math.floor(ms / 60000)
  if (min < 1) return 'now'
  if (min < 60) return `${min}m`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h`
  const d = Math.floor(hr / 24)
  if (d < 7) return `${d}d`
  if (d < 30) return `${Math.floor(d / 7)}w`
  return `${Math.floor(d / 30)}mo`
}
