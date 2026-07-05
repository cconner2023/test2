import { useCallback, useMemo } from 'react'
import { useAuthStore } from '../stores/useAuthStore'
import { useClinicMedics } from './useClinicMedics'
import { useAvatar } from '../Utilities/AvatarContext'
import { SYSTEM_USER_ID } from '../lib/signal/systemIdentity'
import type { ClinicMedic } from '../Types/SupervisorTestTypes'
import type { DecryptedSignalMessage } from '../lib/signal/transportTypes'

/**
 * SINGLE SOURCE for "who can I message" — the recipient roster shared by every
 * recipient-selection surface (new message, forward, share-to-chat). Assembles
 * the cluster roster (from the shared useClinicMedics store) plus an optional
 * self row and any code-added out-cluster peers, drops SYSTEM + duplicates, and
 * hands back the same name/rank/id filter every picker used to hand-roll.
 *
 * Consumers own the ACTION on select (open conversation / forward plaintext /
 * sendStructured); this hook only owns the list.
 */
export interface MessageRosterOptions {
  /** Prepend a self row (self-notes conversation). Off by default. */
  includeSelf?: boolean
  /** Last-name shown for the self row (e.g. 'You' | 'Notes'). */
  selfLabel?: string
  /** Recipient ids to omit (e.g. the current conversation peer for forward). */
  excludeIds?: string[]
  /** Out-cluster peers resolved via user-code lookup — pinned after self. */
  extraPeers?: ClinicMedic[]
  /** When provided, contacts that already have a conversation sort first. */
  conversations?: Record<string, DecryptedSignalMessage[]>
}

export interface MessageRoster {
  roster: ClinicMedic[]
  selfMedic: ClinicMedic | null
  applyFilter: (query: string) => ClinicMedic[]
}

export function useMessageRoster(options: MessageRosterOptions = {}): MessageRoster {
  const { includeSelf = false, selfLabel = 'You', excludeIds, extraPeers, conversations } = options
  const { medics } = useClinicMedics()
  const userId = useAuthStore(s => s.user?.id ?? null)
  const { currentAvatar } = useAvatar()

  const selfMedic = useMemo<ClinicMedic | null>(() => {
    if (!userId) return null
    return { id: userId, firstName: null, lastName: selfLabel, middleInitial: null, rank: null, credential: null, avatarId: currentAvatar.id }
  }, [userId, selfLabel, currentAvatar.id])

  const roster = useMemo<ClinicMedic[]>(() => {
    const excluded = new Set(excludeIds ?? [])
    const seen = new Set<string>()
    const out: ClinicMedic[] = []
    const push = (m: ClinicMedic) => {
      if (m.id === SYSTEM_USER_ID || excluded.has(m.id) || seen.has(m.id)) return
      seen.add(m.id)
      out.push(m)
    }
    // Self row first (opt-in), then code-added out-cluster peers, then cluster.
    if (includeSelf && selfMedic) push(selfMedic)
    for (const m of extraPeers ?? []) push(m)
    for (const m of medics) {
      // The real-user row from the cluster roster is never a plain contact —
      // self only appears via the pinned row above (or not at all).
      if (selfMedic && m.id === selfMedic.id) continue
      push(m)
    }
    if (conversations) {
      const selfId = selfMedic?.id
      out.sort((a, b) => {
        if (a.id === selfId) return -1  // keep self pinned on top
        if (b.id === selfId) return 1
        const aHas = conversations[a.id]?.length ? 1 : 0
        const bHas = conversations[b.id]?.length ? 1 : 0
        if (aHas !== bHas) return bHas - aHas
        return (a.lastName ?? '').localeCompare(b.lastName ?? '')
      })
    }
    return out
  }, [includeSelf, selfMedic, extraPeers, medics, excludeIds, conversations])

  const applyFilter = useCallback((query: string): ClinicMedic[] => {
    const q = query.trim().toLowerCase()
    if (!q) return roster
    return roster.filter(m =>
      m.id.toLowerCase() === q ||
      (m.firstName ?? '').toLowerCase().includes(q) ||
      (m.lastName ?? '').toLowerCase().includes(q) ||
      (m.rank ?? '').toLowerCase().includes(q) ||
      [m.rank, m.lastName].filter(Boolean).join(' ').toLowerCase().includes(q)
    )
  }, [roster])

  return { roster, selfMedic, applyFilter }
}
