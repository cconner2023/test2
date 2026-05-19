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

import { createContext, useContext, useEffect, useMemo, useRef } from 'react'
import { useMessages, type UseMessagesReturn } from './useMessages'
import { useAuth } from './useAuth'
import { useClinicMedics } from './useClinicMedics'
import { useMessageNotifications, type MessageNotification } from './useMessageNotifications'
import { useMessagingStore } from '../stores/useMessagingStore'
import { supabase } from '../lib/supabase'
import { createLogger } from '../Utilities/Logger'
import type { DecryptedSignalMessage } from '../lib/signal/transportTypes'
import type { ClinicMedic } from '../Types/SupervisorTestTypes'

const peerLogger = createLogger('PeerProfileResolver')

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
  const peerProfiles = useMessagingStore(s => s.peerProfiles)
  const conversations = useMessagingStore(s => s.conversations)
  const setPeerProfile = useMessagingStore(s => s.setPeerProfile)
  const groupsForResolver = useMessagingStore(s => s.groups)
  const { notification, notify, dismiss } = useMessageNotifications()

  // Reactively resolve profiles for any conversation peer we don't yet know.
  // Replaces useOrphanedProfiles: writes results to peerProfiles (IDB-backed)
  // so resolution survives refresh and the same map serves every consumer
  // (notifications, list, chat header).
  const inflightRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return
    const selfId = user.id
    const medicIdSet = new Set(medics.map(m => m.id))
    const unresolved: string[] = []
    for (const key of Object.keys(conversations)) {
      if (key === selfId) continue
      if (groupsForResolver[key]) continue
      if (medicIdSet.has(key)) continue
      if (peerProfiles[key]) continue
      if (inflightRef.current.has(key)) continue
      unresolved.push(key)
    }
    if (unresolved.length === 0) return
    for (const id of unresolved) inflightRef.current.add(id)
    supabase
      .rpc('fetch_profiles_by_ids', { user_ids: unresolved })
      .then(({ data, error }) => {
        if (error || !data) return
        for (const p of data as Array<{
          id: string
          first_name: string | null
          last_name: string | null
          middle_initial: string | null
          rank: string | null
          credential: string | null
          avatar_id: string | null
          clinic_id: string | null
          clinic_name: string | null
        }>) {
          const medic: ClinicMedic = {
            id: p.id,
            firstName: p.first_name,
            lastName: p.last_name,
            middleInitial: p.middle_initial,
            rank: p.rank,
            credential: p.credential,
            avatarId: p.avatar_id ?? null,
            clinicId: p.clinic_id ?? undefined,
            clinicName: p.clinic_name ?? undefined,
          }
          setPeerProfile(medic)
        }
      })
      .catch(err => peerLogger.warn('fetch_profiles_by_ids failed:', err))
      .finally(() => {
        for (const id of unresolved) inflightRef.current.delete(id)
      })
  }, [isAuthenticated, user?.id, conversations, medics, peerProfiles, groupsForResolver, setPeerProfile])

  // Build a name lookup map from clinic medics AND resolved peer profiles —
  // cluster-agnostic, matches the discovery model: cluster is suggestions,
  // peerProfiles persists everyone we've ever messaged.
  const nameMap = useMemo(() => {
    const map = new Map<string, string>()
    const buildLabel = (m: ClinicMedic): string => {
      const parts: string[] = []
      if (m.rank) parts.push(m.rank)
      if (m.lastName) {
        let name = m.lastName
        if (m.firstName) name += ', ' + m.firstName.charAt(0) + '.'
        parts.push(name)
      }
      return parts.join(' ') || m.firstName || 'Unknown'
    }
    for (const m of medics) map.set(m.id, buildLabel(m))
    for (const m of Object.values(peerProfiles)) {
      if (!map.has(m.id)) map.set(m.id, buildLabel(m))
    }
    return map
  }, [medics, peerProfiles])

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
