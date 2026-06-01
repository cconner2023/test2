import { useCallback, useMemo, useRef } from 'react'
import { useLongPress } from '../../Hooks/useLongPress'
import { UserAvatar } from '../Settings/UserAvatar'
import { getDisplayName } from '../../Utilities/nameUtils'
import { SYSTEM_USER_ID } from '../../lib/signal/systemIdentity'
import type { AdminSystemConversation } from '../../Hooks/useAdminSystemConversations'

export interface SystemConversationCardProps {
  conversation: AdminSystemConversation
  onSelect: (peerId: string) => void
  setContextMenu: (v: { peerId: string; x: number; y: number } | null) => void
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 7) return d.toLocaleDateString(undefined, { weekday: 'short' })
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function SystemConversationCard({ conversation, onSelect, setContextMenu }: SystemConversationCardProps) {
  const { peerId, peerProfile, lastMessage, unreadCount } = conversation
  const cardRef = useRef<HTMLDivElement>(null)

  const { isPressing, ...longPress } = useLongPress((x: number, y: number) => {
    setContextMenu({ peerId, x, y })
  }, { delay: 500 })

  const handleTap = useCallback(() => {
    onSelect(peerId)
  }, [onSelect, peerId])

  const displayName = useMemo(() => {
    if (peerProfile) return getDisplayName(peerProfile)
    return 'Unknown user'
  }, [peerProfile])

  // System-channel preview: dev-authored messages are outbound, user replies
  // (recipient=SYSTEM) are inbound. Prefix inbound with the peer name so a
  // dev can scan the feed without opening every thread.
  const previewText = useMemo(() => {
    const isInboundReply = lastMessage.recipientId === SYSTEM_USER_ID
    const body = lastMessage.plaintext || (lastMessage.content?.type === 'image' ? 'Photo' : '')
    return isInboundReply ? body : `You: ${body}`
  }, [lastMessage])

  return (
    <div
      ref={cardRef}
      onClick={handleTap}
      onContextMenu={(e) => {
        e.preventDefault()
        setContextMenu({ peerId, x: e.clientX, y: e.clientY })
      }}
      {...longPress}
      className={`transition-all hover:bg-themeblue2/5 cursor-pointer select-none ${isPressing ? 'scale-[0.98]' : ''}`}
    >
      <div className="flex items-center gap-3 px-4 py-3.5">
        <UserAvatar
          avatarId={peerProfile?.avatarId ?? null}
          avatarBlob={peerProfile?.avatarBlob ?? null}
          userId={peerProfile?.id ?? null}
          firstName={peerProfile?.firstName ?? null}
          lastName={peerProfile?.lastName ?? null}
          className="w-9 h-9"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-primary truncate">{displayName}</p>
            {unreadCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-themeblue3 shrink-0" aria-label={`${unreadCount} unread`} />
            )}
          </div>
          {previewText && (
            <p className="text-[10pt] text-tertiary truncate mt-0.5">{previewText}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-[9pt] text-tertiary">{formatTimestamp(lastMessage.createdAt)}</span>
          <span className="text-[9pt] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border bg-themeblue2/10 text-themeblue2 border-themeblue2/30">
            System
          </span>
        </div>
      </div>
    </div>
  )
}
