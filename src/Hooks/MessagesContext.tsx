/**
 * MessagesContext — Keeps messaging orchestration alive across Settings drawer open/close.
 *
 * The useMessages() hook lives here at the app level, so realtime subscriptions
 * and crypto state persist even when MessagesPanel unmounts.
 *
 * Messaging state (conversations, unreadCounts, groups, etc.) is in useMessagingStore.
 * This context only holds the hook's action API + notification state.
 *
 * Also wires up message notifications (toast + sound) for incoming messages.
 */

import { createContext, useContext, useEffect, useMemo } from 'react'
import { useMessages, type UseMessagesReturn } from './useMessages'
import { useAuth } from './useAuth'
import { useClinicMedics } from './useClinicMedics'
import { useMessageNotifications, type MessageNotification } from './useMessageNotifications'
import { useMessagingStore } from '../stores/useMessagingStore'
import type { DecryptedSignalMessage } from '../lib/signal/transportTypes'

interface MessagesContextValue extends UseMessagesReturn {
  notification: MessageNotification | null
  dismissNotification: () => void
}

const MessagesContext = createContext<MessagesContextValue | null>(null)

export function MessagesProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth()
  const messages = useMessages()
  const { onIncomingRef, activePeerRef } = messages
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

    onIncomingRef.current = (msg: DecryptedSignalMessage) => {
      // Skip if the user is currently viewing this conversation
      const conversationKey = msg.groupId ?? msg.senderId
      if (activePeerRef.current === conversationKey) return

      const senderName = nameMap.get(msg.senderId) ?? 'Unknown'
      const isGroup = !!msg.groupId
      const groups = useMessagingStore.getState().groups
      const groupName = isGroup ? (groups[msg.groupId!]?.name ?? 'Group') : undefined
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

    return () => { onIncomingRef.current = null }
  }, [isAuthenticated, user?.id, nameMap, onIncomingRef, activePeerRef, notify])

  // Memoize context value — only the action functions and notification state.
  // State reads go through useMessagingStore selectors directly.
  const value = useMemo<MessagesContextValue | null>(() => {
    if (!isAuthenticated) return null
    return {
      ...messages,
      notification,
      dismissNotification: dismiss,
    }
  }, [isAuthenticated, messages, notification, dismiss])

  return (
    <MessagesContext.Provider value={value}>
      {children}
    </MessagesContext.Provider>
  )
}

/** Consume the app-level messaging action API. Returns null if not authenticated. */
// eslint-disable-next-line react-refresh/only-export-components
export function useMessagesContext(): MessagesContextValue | null {
  return useContext(MessagesContext)
}
