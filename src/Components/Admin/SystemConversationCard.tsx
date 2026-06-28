import { useCallback, useMemo, useRef, type ReactNode } from 'react'
import { UserAvatar } from '../Settings/UserAvatar'
import { getDisplayName } from '../../Utilities/nameUtils'
import { SYSTEM_USER_ID } from '../../lib/signal/systemIdentity'
import type { AdminSystemConversation } from '../../Hooks/useAdminSystemConversations'

export interface SystemConversationCardProps {
  conversation: AdminSystemConversation
  onSelect: (peerId: string) => void
  setContextMenu: (v: { peerId: string; rect: DOMRect; clone: ReactNode } | null) => void
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

  const longPressTimer = useRef<number | null>(null)
  const preventTap = useRef(false)
  const openMenu = () => {
    if (!cardRef.current) return
    setContextMenu({
      peerId,
      rect: cardRef.current.getBoundingClientRect(),
      clone: (
        <div className="bg-themewhite">
          <div className="flex items-center gap-3 px-4 py-3.5">
            <UserAvatar
              avatarId={peerProfile?.avatarId ?? null}
              avatarBlob={peerProfile?.avatarBlob ?? null}
              userId={peerProfile?.id ?? null}
              firstName={peerProfile?.firstName ?? null}
              lastName={peerProfile?.lastName ?? null}
              className="w-9 h-9"
            />
            <span className="flex-1 min-w-0 text-sm font-medium text-primary truncate">{displayName}</span>
          </div>
        </div>
      ),
    })
  }
  const clearLongPress = () => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null }
  }

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
      onClick={() => { if (preventTap.current) { preventTap.current = false; return } handleTap() }}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); openMenu() }}
      onTouchStart={() => { preventTap.current = false; longPressTimer.current = window.setTimeout(() => { preventTap.current = true; openMenu() }, 500) }}
      onTouchEnd={clearLongPress}
      onTouchMove={clearLongPress}
      className="transition-all hover:bg-themeblue2/5 cursor-pointer select-none"
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
        <span className="text-[9pt] text-tertiary shrink-0">{formatTimestamp(lastMessage.createdAt)}</span>
      </div>
    </div>
  )
}
