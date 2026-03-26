/**
 * useMessagingStore — Zustand store for all messaging state.
 *
 * Replaces the useState + Context pattern in useMessages.ts.
 * Provides granular selectors so consumers only re-render on the
 * slice of state they actually need.
 *
 * State is hydrated from IndexedDB via hydrateFromIdb().
 * Tombstones are loaded at hydration time and respected on every
 * addMessage call — this is the primary guard against resurrection.
 */

import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import {
  loadAllConversations,
  loadUnreadCounts,
  getAllTombstones,
  saveTombstone,
  deleteTombstone,
  deleteConversation as deleteConversationFromDb,
  deleteMessages as deleteMessagesFromDb,
} from '../lib/signal/messageStore'
import { getLocalDeviceId } from '../lib/signal/keyManager'
import { createLogger } from '../Utilities/Logger'
import type { DecryptedSignalMessage } from '../lib/signal/transportTypes'
import type { GroupInfo } from '../lib/signal/groupTypes'

const logger = createLogger('MessagingStore')

// ── State shape ────────────────────────────────────────────────────────────

interface MessagingState {
  /** All conversations keyed by peerId or groupId, messages sorted oldest-first. */
  conversations: Record<string, DecryptedSignalMessage[]>
  /** Unread count per peer/group. */
  unreadCounts: Record<string, number>
  /** Group metadata keyed by groupId. */
  groups: Record<string, GroupInfo>
  /** Per-conversation sending flags (replaces the single global boolean). */
  sendingMap: Record<string, boolean>
  /** Tombstones: conversationKey → deletedAt ISO string.
   *  Messages with createdAt < deletedAt are suppressed. */
  deletedConversations: Record<string, string>
  /** Local device ID — loaded async from keyManager. */
  localDeviceId: string | null
  /** Clinic device ID — set after clinic device init. */
  clinicDeviceId: string | null
  /** Local user ID — set during hydration for correct incoming/outgoing checks. */
  localUserId: string | null
  /** Group IDs that are system-managed (e.g. clinic vault) — excluded from unread totals. */
  systemGroupIds: Set<string>
  /** True once the initial IDB hydration is complete. */
  hydrated: boolean
}

// ── Actions ────────────────────────────────────────────────────────────────

interface MessagingActions {
  /**
   * Add a message to state with tombstone guard.
   * - If a tombstone exists and msg.createdAt < deletedAt → skip.
   * - If a tombstone exists and msg.createdAt >= deletedAt → clear tombstone (genuinely new).
   */
  addMessage: (msg: DecryptedSignalMessage) => void

  /** Update message ID and status after server confirms (optimistic → confirmed). */
  updateMessageStatus: (conversationKey: string, localId: string, serverId: string) => void

  /** Update an optimistic message's content field (e.g. after upload completes). */
  updateMessageContent: (conversationKey: string, localId: string, content: DecryptedSignalMessage['content']) => void

  /** Remove an optimistic message (on send failure). */
  removeOptimisticMessage: (conversationKey: string, localId: string) => void

  /** Mark messages from a peer as read (local state only — IDB/network handled by hook). */
  markAsRead: (conversationKey: string, messageIds: string[], readAt: string) => void

  /** Apply a remote read-sync: update readAt on specific messages and clear unread. */
  applyReadSync: (peerId: string, messageIds: string[], readAt: string) => void

  /** Update delivery status on outgoing messages. */
  applyDeliveryReceipt: (messageIds: string[]) => void

  /** Remove messages from state by their IDs. */
  deleteMessages: (conversationKey: string, messageIds: string[]) => void

  /** Remove messages from all conversations by originId. */
  removeMessagesByOriginIds: (originIds: string[]) => void

  /**
   * Delete an entire conversation:
   * - Writes tombstone with deletedAt = now (state + IDB)
   * - Removes messages from state
   * - Removes unread count
   */
  deleteConversation: (conversationKey: string) => Promise<void>

  /** Bulk-set conversations (for hydration). Does NOT overwrite with empty. */
  setConversations: (conversations: Record<string, DecryptedSignalMessage[]>) => void

  /** Set per-conversation sending flag. */
  setSending: (conversationKey: string, isSending: boolean) => void

  /** Set the full groups map. */
  setGroups: (groups: Record<string, GroupInfo>) => void

  /** Add or update a single group. */
  addGroup: (group: GroupInfo) => void

  /** Remove a group and its conversation from state. */
  removeGroup: (groupId: string) => void

  /** Set unread count for a single conversation. */
  setUnreadCount: (conversationKey: string, count: number) => void

  /** Set the local device ID. */
  setLocalDeviceId: (id: string) => void

  /** Set the clinic device ID. */
  setClinicDeviceId: (id: string | null) => void

  /** Set system group IDs (e.g. clinic vault group) — excluded from unread totals. */
  setSystemGroupIds: (ids: Set<string>) => void

  /**
   * Load conversations and tombstones from IndexedDB.
   * Respects tombstones: filters out messages created before deletedAt.
   * Also attempts to load the local device ID if not yet set.
   */
  hydrateFromIdb: (userId: string) => Promise<void>

  /** Full reset — called on sign-out. */
  clearAll: () => void
}

export type MessagingStore = MessagingState & MessagingActions

// ── Store ──────────────────────────────────────────────────────────────────

export const useMessagingStore = create<MessagingStore>()((set, get) => ({
  // ── Initial state ──
  conversations: {},
  unreadCounts: {},
  groups: {},
  sendingMap: {},
  deletedConversations: {},
  localDeviceId: null,
  clinicDeviceId: null,
  localUserId: null,
  systemGroupIds: new Set(),
  hydrated: false,

  // ── Actions ──

  addMessage: (msg) => {
    const { deletedConversations, conversations, localUserId, systemGroupIds } = get()
    const userId = localUserId

    const conversationKey = msg.groupId ?? msg.senderId

    const tombstoneAt = deletedConversations[conversationKey]
    if (tombstoneAt) {
      if (msg.createdAt < tombstoneAt) {
        // Pre-deletion message — suppress
        return
      }
      // Post-deletion message — genuinely new, clear tombstone
      set(s => {
        const next = { ...s.deletedConversations }
        delete next[conversationKey]
        return { deletedConversations: next }
      })
      deleteTombstone(conversationKey).catch(() => {})
    }

    const existing = conversations[conversationKey] ?? []

    // Deduplicate by ID
    if (existing.some(m => m.id === msg.id)) return

    // Deduplicate by originId
    if (msg.originId && existing.some(m => m.originId === msg.originId)) return

    // Deduplicate request-accepted by sender (fan-out creates one per device)
    if (msg.messageType === 'request-accepted') {
      if (existing.some(m => m.messageType === 'request-accepted' && m.senderId === msg.senderId)) {
        return
      }
    }

    const updated = [...existing, msg].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    )

    set(s => {
      const unreadKey = msg.groupId ?? msg.senderId
      const isIncoming = !userId || msg.senderId !== userId
      const isSystemGroup = msg.groupId ? systemGroupIds.has(msg.groupId) : false
      const newUnread =
        isIncoming && !msg.readAt && !isSystemGroup && msg.messageType !== 'request-accepted'
          ? { ...s.unreadCounts, [unreadKey]: (s.unreadCounts[unreadKey] ?? 0) + 1 }
          : s.unreadCounts

      return {
        conversations: { ...s.conversations, [conversationKey]: updated },
        unreadCounts: newUnread,
      }
    })
  },

  updateMessageStatus: (conversationKey, localId, serverId) => {
    set(s => {
      const msgs = s.conversations[conversationKey]
      if (!msgs) return s
      const updated = msgs.map(m => {
        if (m.id !== localId) return m
        return { ...m, id: serverId, status: undefined }
      })
      return { conversations: { ...s.conversations, [conversationKey]: updated } }
    })
  },

  updateMessageContent: (conversationKey, localId, content) => {
    set(s => {
      const msgs = s.conversations[conversationKey]
      if (!msgs) return s
      const updated = msgs.map(m => m.id === localId ? { ...m, content } : m)
      return { conversations: { ...s.conversations, [conversationKey]: updated } }
    })
  },

  removeOptimisticMessage: (conversationKey, localId) => {
    set(s => {
      const msgs = s.conversations[conversationKey]
      if (!msgs) return s
      const filtered = msgs.filter(m => m.id !== localId)
      if (filtered.length === 0) {
        const next = { ...s.conversations }
        delete next[conversationKey]
        return { conversations: next }
      }
      return { conversations: { ...s.conversations, [conversationKey]: filtered } }
    })
  },

  markAsRead: (conversationKey, messageIds, readAt) => {
    const idSet = new Set(messageIds)
    set(s => {
      const msgs = s.conversations[conversationKey]
      if (!msgs) return s
      const updated = msgs.map(m => idSet.has(m.id) ? { ...m, readAt } : m)
      const unreadCounts = { ...s.unreadCounts }
      delete unreadCounts[conversationKey]
      return {
        conversations: { ...s.conversations, [conversationKey]: updated },
        unreadCounts,
      }
    })
  },

  applyReadSync: (peerId, messageIds, readAt) => {
    const idSet = new Set(messageIds)
    set(s => {
      const msgs = s.conversations[peerId]
      if (!msgs) return s
      const updated = msgs.map(m => idSet.has(m.id) ? { ...m, readAt } : m)
      const unreadCounts = { ...s.unreadCounts }
      delete unreadCounts[peerId]
      return {
        conversations: { ...s.conversations, [peerId]: updated },
        unreadCounts,
      }
    })
  },

  applyDeliveryReceipt: (messageIds) => {
    const idSet = new Set(messageIds)
    set(s => {
      let changed = false
      const next = { ...s.conversations }
      for (const [peerId, msgs] of Object.entries(next)) {
        if (msgs.some(m => idSet.has(m.id))) {
          next[peerId] = msgs.map(m =>
            idSet.has(m.id) ? { ...m, status: 'delivered' as const } : m,
          )
          changed = true
        }
      }
      return changed ? { conversations: next } : s
    })
  },

  deleteMessages: (conversationKey, messageIds) => {
    const idSet = new Set(messageIds)
    set(s => {
      const existing = s.conversations[conversationKey]
      if (!existing) return s
      const filtered = existing.filter(m => !idSet.has(m.id))
      if (filtered.length === 0) {
        const next = { ...s.conversations }
        delete next[conversationKey]
        return { conversations: next }
      }
      return { conversations: { ...s.conversations, [conversationKey]: filtered } }
    })
  },

  removeMessagesByOriginIds: (originIds) => {
    const originSet = new Set(originIds)
    set(s => {
      let changed = false
      const next: Record<string, DecryptedSignalMessage[]> = {}
      for (const [key, msgs] of Object.entries(s.conversations)) {
        const filtered = msgs.filter(m => !(m.originId && originSet.has(m.originId)))
        if (filtered.length !== msgs.length) changed = true
        if (filtered.length > 0) {
          next[key] = filtered
        } else {
          changed = true
        }
      }
      return changed ? { conversations: next } : s
    })
  },

  deleteConversation: async (conversationKey) => {
    const deletedAt = new Date().toISOString()

    // Write tombstone to state and IDB immediately (offline-safe)
    set(s => {
      const next = { ...s.conversations }
      delete next[conversationKey]
      const unread = { ...s.unreadCounts }
      delete unread[conversationKey]
      return {
        conversations: next,
        unreadCounts: unread,
        deletedConversations: { ...s.deletedConversations, [conversationKey]: deletedAt },
      }
    })

    await saveTombstone(conversationKey, deletedAt)
    await deleteConversationFromDb(conversationKey).catch(e =>
      logger.warn('Failed to delete conversation from IDB:', e),
    )
  },

  setConversations: (conversations) => {
    if (Object.keys(conversations).length === 0) return
    set({ conversations })
  },

  setSending: (conversationKey, isSending) => {
    set(s => ({
      sendingMap: isSending
        ? { ...s.sendingMap, [conversationKey]: true }
        : (() => {
            const next = { ...s.sendingMap }
            delete next[conversationKey]
            return next
          })(),
    }))
  },

  setGroups: (groups) => set({ groups }),

  addGroup: (group) => set(s => ({
    groups: { ...s.groups, [group.groupId]: group },
  })),

  removeGroup: (groupId) => set(s => {
    const groups = { ...s.groups }
    delete groups[groupId]
    const conversations = { ...s.conversations }
    delete conversations[groupId]
    return { groups, conversations }
  }),

  setUnreadCount: (conversationKey, count) => set(s => ({
    unreadCounts: { ...s.unreadCounts, [conversationKey]: count },
  })),

  setLocalDeviceId: (id) => set({ localDeviceId: id }),

  setClinicDeviceId: (id) => set({ clinicDeviceId: id }),

  setSystemGroupIds: (ids) => set({ systemGroupIds: ids }),

  hydrateFromIdb: async (userId) => {
    try {
      const [convos, counts, tombstones] = await Promise.all([
        loadAllConversations(),
        loadUnreadCounts(userId),
        getAllTombstones(),
      ])

      // Filter out conversations that have active tombstones
      const filtered: Record<string, DecryptedSignalMessage[]> = {}
      for (const [key, msgs] of Object.entries(convos)) {
        const tombstoneAt = tombstones[key]
        if (tombstoneAt) {
          // Keep only messages genuinely newer than the tombstone
          const newer = msgs.filter(m => m.createdAt >= tombstoneAt)
          if (newer.length > 0) filtered[key] = newer
        } else {
          filtered[key] = msgs
        }
      }

      // Load localDeviceId if not yet set
      const current = get()
      let deviceId = current.localDeviceId
      if (!deviceId) {
        deviceId = await getLocalDeviceId()
      }

      // Strip system group unread counts (e.g. clinic vault group)
      const sysIds = get().systemGroupIds
      if (sysIds.size > 0) {
        for (const key of Object.keys(counts)) {
          if (sysIds.has(key)) delete counts[key]
        }
      }

      set(s => {
        // Merge: IDB data + any messages already in state (from concurrent catch-up)
        const merged = { ...filtered }
        for (const [key, msgs] of Object.entries(s.conversations)) {
          if (!merged[key]) {
            merged[key] = msgs
            continue
          }
          const ids = new Set(merged[key].map(m => m.id))
          const origins = new Set(merged[key].map(m => m.originId).filter(Boolean))
          for (const msg of msgs) {
            if (ids.has(msg.id)) continue
            if (msg.originId && origins.has(msg.originId)) continue
            merged[key].push(msg)
            ids.add(msg.id)
            if (msg.originId) origins.add(msg.originId)
          }
          merged[key].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          )
        }

        return {
          conversations: Object.keys(merged).length > 0 ? merged : s.conversations,
          unreadCounts: Object.keys(counts).length > 0 ? counts : s.unreadCounts,
          deletedConversations: tombstones,
          localDeviceId: deviceId ?? s.localDeviceId,
          localUserId: userId,
          hydrated: true,
        }
      })

      logger.info(`Hydrated ${Object.keys(filtered).length} conversations from IDB`)
    } catch (err) {
      logger.warn('IDB hydration failed:', err)
      set({ hydrated: true })
    }
  },

  clearAll: () => set({
    conversations: {},
    unreadCounts: {},
    groups: {},
    sendingMap: {},
    deletedConversations: {},
    localDeviceId: null,
    clinicDeviceId: null,
    localUserId: null,
    systemGroupIds: new Set(),
    hydrated: false,
  }),
}))

// ── Selectors (exported as hooks) ─────────────────────────────────────────

/** Single conversation array for a given key. Stable reference when unchanged. */
export function useConversation(key: string): DecryptedSignalMessage[] {
  return useMessagingStore(s => s.conversations[key] ?? [])
}

/** Unread count for a single conversation. */
export function useUnreadCount(key: string): number {
  return useMessagingStore(s => s.unreadCounts[key] ?? 0)
}

/** Sum of all unread counts across non-system conversations.
 *  Used for nav badge — only re-renders when total changes.
 *  Automatically excludes systemGroupIds stored in the store. */
export function useTotalUnread(): number {
  return useMessagingStore(s => {
    let total = 0
    for (const [key, count] of Object.entries(s.unreadCounts)) {
      if (!s.systemGroupIds.has(key)) total += count
    }
    return total
  })
}

/** Per-conversation sending flag. */
export function useIsSending(key: string): boolean {
  return useMessagingStore(s => s.sendingMap[key] ?? false)
}

/** Full groups map. Uses useShallow to prevent re-renders on reference churn. */
export function useGroups(): Record<string, GroupInfo> {
  return useMessagingStore(useShallow(s => s.groups))
}

/** Delete specific messages from IDB (exposed for hook use). */
export { deleteMessagesFromDb }
