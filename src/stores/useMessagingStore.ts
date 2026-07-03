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
  getAllOriginTombstones,
  saveTombstone,
  deleteTombstone,
  deleteConversation as deleteConversationFromDb,
  deleteMessages as deleteMessagesFromDb,
  loadAllPeerProfiles,
  savePeerProfile,
  deletePeerProfile,
} from '../lib/signal/messageStore'
import { getLocalDeviceId } from '../lib/signal/keyManager'
import { createLogger } from '../Utilities/Logger'
import type { DecryptedSignalMessage } from '../lib/signal/transportTypes'
import type { GroupInfo } from '../lib/signal/groupTypes'
import type { ClinicMedic } from '../Types/SupervisorTestTypes'
import { SYSTEM_USER_ID, SYSTEM_PEER_PROFILE } from '../lib/signal/systemIdentity'

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
  /** Per-origin tombstones: originId → deletedAt ISO string. The canonical,
   *  createdAt-independent delete identity. Mirrors messageStore's
   *  originTombstones so addMessage can suppress a deleted message synchronously
   *  (symmetric with saveMessage's IDB guard) — otherwise a vault/realtime echo
   *  renders in the live store while IDB refuses it ("shows but not saved"). */
  deletedOrigins: Record<string, string>
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
  /** Conversation keys pinned by the user — persisted to localStorage. */
  pinnedConversationKeys: string[]
  /** Profile cache for every user we've messaged — cluster-agnostic, persisted to IDB.
   *  Populated by email-lookup success and by inbound-envelope-from-unknown-sender.
   *  Read by every name-resolution consumer alongside useClinicMedics. */
  peerProfiles: Record<string, ClinicMedic>
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

  /**
   * Fold an emoji reaction onto a target message's `reactions` map. The target
   * is matched by originId (preferred, shared across fan-out copies) or id.
   * No-op if the target isn't in state. Reactions never become bubbles — this
   * is the only ingress that mutates them.
   */
  applyReaction: (conversationKey: string, targetId: string, emoji: string, reactorId: string, remove: boolean) => void

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

  /** Toggle pin state for a conversation key — persists to localStorage. */
  togglePinConversation: (key: string) => void
  /** Upsert a single peer profile and persist to IDB. Cluster-agnostic. */
  setPeerProfile: (profile: ClinicMedic) => void
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
  deletedOrigins: {},
  localDeviceId: null,
  clinicDeviceId: null,
  localUserId: null,
  systemGroupIds: new Set(),
  hydrated: false,
  pinnedConversationKeys: (() => {
    try {
      const raw = localStorage.getItem('beacon:pinnedConversations')
      return raw ? (JSON.parse(raw) as string[]) : []
    } catch { return [] }
  })(),
  // Synthetic 'System' profile is always present so any messageType='system'
  // (or any senderId === SYSTEM_USER_ID) resolves to "System" in name/avatar
  // lookups without requiring a profiles row (the sentinel has none — see
  // migration 20260522b_system_identity.sql).
  peerProfiles: { [SYSTEM_USER_ID]: SYSTEM_PEER_PROFILE },

  // ── Actions ──

  addMessage: (msg) => {
    // Control-plane transport types are never user-visible conversation
    // content. Normal receive paths already drop them (useSignalMessages
    // decryptRow returns null for 'sender-key-distribution'; 'sender-key-message'
    // is transformed to 'message' before reaching here). This is a store-boundary
    // backstop so no path — a stale cached bundle, an offline-queue replay, a
    // future drain branch — can ever render the raw sender-key-distribution JSON
    // (chainKey/signingPublicKey) as a chat bubble.
    if (msg.messageType === 'sender-key-distribution' || msg.messageType === 'sender-key-message') {
      return
    }
    const { deletedConversations, deletedOrigins, conversations, localUserId, systemGroupIds } = get()
    const userId = localUserId

    const conversationKey = msg.groupId ?? (userId && msg.senderId === userId ? msg.recipientId : msg.senderId)

    // Origin tombstone guard — symmetric with messageStore.saveMessage's IDB
    // guard. A message whose originId was deleted (individual OR conversation
    // delete) must never re-enter the live store, even via a vault drain /
    // realtime echo whose createdAt >= the conversation tombstone. Origin IDs
    // are unique UUIDs, so this only ever suppresses the exact deleted message.
    // Checked BEFORE the conversation-tombstone clear logic so a resurrected
    // origin can't clear the conversation tombstone. Without this, the message
    // renders in the conversation while saveMessage refuses it to IDB — the
    // "shows in the conversation but not in the actual messages" ghost.
    if (msg.originId && deletedOrigins[msg.originId]) return

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
      const unreadKey = conversationKey
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
        return { ...m, id: serverId, status: 'sent' as const }
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

  applyReaction: (conversationKey, targetId, emoji, reactorId, remove) => {
    set(s => {
      const msgs = s.conversations[conversationKey]
      if (!msgs) return s
      let changed = false
      const updated = msgs.map(m => {
        if (m.id !== targetId && m.originId !== targetId) return m
        changed = true
        const reactions: Record<string, string[]> = { ...(m.reactions ?? {}) }
        const set = new Set(reactions[emoji] ?? [])
        if (remove) set.delete(reactorId)
        else set.add(reactorId)
        if (set.size > 0) reactions[emoji] = Array.from(set)
        else delete reactions[emoji]
        return { ...m, reactions }
      })
      if (!changed) return s
      return { conversations: { ...s.conversations, [conversationKey]: updated } }
    })
  },

  removeMessagesByOriginIds: (originIds) => {
    if (originIds.length === 0) return
    const originSet = new Set(originIds)
    const deletedAt = new Date().toISOString()
    set(s => {
      const next: Record<string, DecryptedSignalMessage[]> = {}
      for (const [key, msgs] of Object.entries(s.conversations)) {
        const filtered = msgs.filter(m => !(m.originId && originSet.has(m.originId)))
        if (filtered.length > 0) next[key] = filtered
      }
      // Always mirror the origin tombstones into state (symmetric with the IDB
      // originTombstone written by the delete path) so a subsequent vault /
      // realtime echo of the same message is suppressed by addMessage — even if
      // the message wasn't currently in live state.
      const deletedOrigins = { ...s.deletedOrigins }
      for (const o of originIds) if (!deletedOrigins[o]) deletedOrigins[o] = deletedAt
      return { conversations: next, deletedOrigins }
    })
  },

  deleteConversation: async (conversationKey) => {
    const deletedAt = new Date().toISOString()
    const wasGroup = !!get().groups[conversationKey]
    // Origins currently in live state — tombstone them immediately so a
    // same-session vault/realtime echo can't resurrect the conversation before
    // the async IDB purge folds in the complete set below.
    const stateOrigins = (get().conversations[conversationKey] ?? [])
      .map(m => m.originId)
      .filter((o): o is string => !!o)

    // Write tombstone to state and IDB immediately (offline-safe)
    set(s => {
      const next = { ...s.conversations }
      delete next[conversationKey]
      const unread = { ...s.unreadCounts }
      delete unread[conversationKey]
      const peerProfiles = wasGroup ? s.peerProfiles : (() => {
        const p = { ...s.peerProfiles }
        delete p[conversationKey]
        return p
      })()
      const deletedOrigins = { ...s.deletedOrigins }
      for (const o of stateOrigins) deletedOrigins[o] = deletedAt
      return {
        conversations: next,
        unreadCounts: unread,
        peerProfiles,
        deletedConversations: { ...s.deletedConversations, [conversationKey]: deletedAt },
        deletedOrigins,
      }
    })

    await saveTombstone(conversationKey, deletedAt)
    // deleteConversationFromDb writes a per-origin tombstone for every message
    // it purges (the durable delete identity) and returns those origins.
    const purgedOrigins = await deleteConversationFromDb(conversationKey, deletedAt)
    // Fold in any origins that were in IDB but not live state (partial load).
    if (purgedOrigins.length > 0) {
      set(s => {
        const deletedOrigins = { ...s.deletedOrigins }
        let changed = false
        for (const o of purgedOrigins) {
          if (!deletedOrigins[o]) { deletedOrigins[o] = deletedAt; changed = true }
        }
        return changed ? { deletedOrigins } : s
      })
    }
    if (!wasGroup) {
      await deletePeerProfile(conversationKey).catch(e =>
        logger.warn('Failed to delete peer profile from IDB:', e),
      )
    }
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
      const [convos, counts, tombstones, originTombstones, peerProfileList] = await Promise.all([
        loadAllConversations(),
        loadUnreadCounts(userId),
        getAllTombstones(),
        getAllOriginTombstones(),
        loadAllPeerProfiles(),
      ])
      const peerProfiles: Record<string, ClinicMedic> = {}
      for (const p of peerProfileList) peerProfiles[p.id] = p

      // Filter out conversations that have active tombstones
      const filtered: Record<string, DecryptedSignalMessage[]> = {}
      // Control-plane transport types a pre-guard build may have persisted to
      // IDB. addMessage guards the live receive path, but hydration loads
      // straight from IDB and bypasses it — without this, stale
      // sender-key-distribution / sender-key-message rows render as raw-JSON
      // chat bubbles after logout/refresh even though the wire is clean.
      // Reaction content (messageType 'message', content.type 'reaction',
      // plaintext '[reaction]') is the same class of leak: the live receive
      // path folds reactions onto the target row out-of-band and returns
      // BEFORE addMessage/saveMessage, so they are never persisted today —
      // but a pre-fold build saved them as bubbles, and the real reaction
      // state already rides the target row. Drop the standalone '[reaction]'
      // cruft on hydrate. Collect all ids to purge from IDB so they don't accumulate.
      const staleControlPlaneIds: string[] = []
      const dropControlPlane = (msgs: DecryptedSignalMessage[]) =>
        msgs.filter(m => {
          if (m.messageType === 'sender-key-distribution' || m.messageType === 'sender-key-message') {
            staleControlPlaneIds.push(m.id)
            return false
          }
          if (m.content?.type === 'reaction' || m.plaintext === '[reaction]') {
            staleControlPlaneIds.push(m.id)
            return false
          }
          return true
        })
      for (const [key, msgs] of Object.entries(convos)) {
        // Drop control-plane cruft AND any message whose originId is tombstoned
        // (defensive: a pre-fix build, or saveMessage racing the tombstone, may
        // have persisted a since-deleted message — the origin tombstone is the
        // durable delete identity and outranks the coarse conversation gate).
        const visible = dropControlPlane(msgs).filter(
          m => !(m.originId && originTombstones[m.originId]),
        )
        const tombstoneAt = tombstones[key]
        if (tombstoneAt) {
          // Keep only messages genuinely newer than the tombstone
          const newer = visible.filter(m => m.createdAt >= tombstoneAt)
          if (newer.length > 0) filtered[key] = newer
        } else {
          filtered[key] = visible
        }
      }
      if (staleControlPlaneIds.length > 0) {
        deleteMessagesFromDb(staleControlPlaneIds).catch(() => {})
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
          deletedOrigins: originTombstones,
          localDeviceId: deviceId ?? s.localDeviceId,
          localUserId: userId,
          peerProfiles: Object.keys(peerProfiles).length > 0
            ? { ...peerProfiles, ...s.peerProfiles }
            : s.peerProfiles,
          hydrated: true,
        }
      })

      logger.info(`Hydrated ${Object.keys(filtered).length} conversations from IDB`)
    } catch (err) {
      logger.warn('IDB hydration failed:', err)
      set({ hydrated: true })
    }
  },

  togglePinConversation: (key) => {
    const current = get().pinnedConversationKeys
    const next = current.includes(key)
      ? current.filter(k => k !== key)
      : [...current, key]
    set({ pinnedConversationKeys: next })
    try { localStorage.setItem('beacon:pinnedConversations', JSON.stringify(next)) } catch {}
  },

  setPeerProfile: (profile) => {
    set(s => ({ peerProfiles: { ...s.peerProfiles, [profile.id]: profile } }))
    savePeerProfile(profile).catch(() => {})
  },

  clearAll: () => {
    try { localStorage.removeItem('beacon:pinnedConversations') } catch {}
    set({
      conversations: {},
      unreadCounts: {},
      groups: {},
      sendingMap: {},
      deletedConversations: {},
      deletedOrigins: {},
      localDeviceId: null,
      clinicDeviceId: null,
      localUserId: null,
      systemGroupIds: new Set(),
      hydrated: false,
      pinnedConversationKeys: [],
      peerProfiles: { [SYSTEM_USER_ID]: SYSTEM_PEER_PROFILE },
    })
  },
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
