/**
 * MessagesContext — Keeps messaging state alive across Settings drawer open/close.
 *
 * The useMessages() hook lives here at the app level, so conversations,
 * unread counts, and the realtime subscription persist even when
 * MessagesPanel unmounts.
 *
 * Also wires up message notifications (toast + sound) for incoming messages.
 */

import { createContext, useContext, useEffect, useMemo, useRef } from 'react'
import { useMessages, type UseMessagesReturn } from './useMessages'
import { useAuth } from './useAuth'
import { useClinicMedics } from './useClinicMedics'
import { useMessageNotifications, type MessageNotification } from './useMessageNotifications'
import type { DecryptedSignalMessage } from '../lib/signal/transportTypes'

interface MessagesContextValue extends UseMessagesReturn {
  notification: MessageNotification | null
  dismissNotification: () => void
}

const MessagesContext = createContext<MessagesContextValue | null>(null)

export function MessagesProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth()
  const messages = useMessages()
  const { medics } = useClinicMedics()
  const { notification, notify, dismiss } = useMessageNotifications()

  // Build a name lookup map from clinic medics
  const nameMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const m of medics) {
      const parts: string[] = []
      if (m.rank) parts.push(m.rank)
      if (m.lastName) {
        let name = m.lastName
        if (m.firstName) name += ', ' + m.firstName.charAt(0) + '.'
        parts.push(name)
      }
      map.set(m.id, parts.join(' ') || m.firstName || 'Unknown')
    }
    return map
  }, [medics])

  // Wire the incoming message ref to fire notifications
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return

    messages.onIncomingRef.current = (msg: DecryptedSignalMessage) => {
      // Skip if the user is currently viewing this conversation
      const conversationKey = msg.groupId ?? msg.senderId
      if (messages.activePeerRef.current === conversationKey) return

      const senderName = nameMap.get(msg.senderId) ?? 'Unknown'
      const isGroup = !!msg.groupId
      const groupName = isGroup ? (messages.groups[msg.groupId!]?.name ?? 'Group') : undefined
      const preview = msg.plaintext || 'Photo'

      notify({
        peerId: msg.senderId,
        groupId: msg.groupId,
        senderName,
        preview,
        isGroup,
        groupName,
      })
    }

    return () => { messages.onIncomingRef.current = null }
  }, [isAuthenticated, user?.id, nameMap, messages.onIncomingRef, messages.activePeerRef, messages.groups, notify])

  // Hold messages via ref so we always spread the latest value without
  // depending on the (unstable) messages object identity itself.
  const messagesRef = useRef(messages)
  messagesRef.current = messages

  // Memoize context value using fine-grained deps that actually change —
  // conversations, unreadCounts, sending, and groups are the mutable parts.
  // Also track sendMessage identity: it changes when localDeviceId loads
  // (null → real ID), which is critical for sends to work. Without this,
  // the context can hold a stale sendMessage that silently returns false.
  const value = useMemo<MessagesContextValue | null>(() => {
    if (!isAuthenticated) return null
    return { ...messagesRef.current, notification, dismissNotification: dismiss }
  }, [isAuthenticated, messages.conversations, messages.unreadCounts, messages.sending, messages.groups, messages.sendMessage, notification, dismiss])

  return (
    <MessagesContext.Provider value={value}>
      {children}
    </MessagesContext.Provider>
  )
}

/** Consume the app-level messaging state. Returns null if not authenticated. */
export function useMessagesContext(): MessagesContextValue | null {
  return useContext(MessagesContext)
}
