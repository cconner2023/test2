import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Send, MessageSquare, X } from 'lucide-react'
import { PreviewOverlay } from '../PreviewOverlay'
import { UserAvatar } from '../Settings/UserAvatar'
import { useAuthStore } from '../../stores/useAuthStore'
import { useClinicMedics } from '../../Hooks/useClinicMedics'
import { useMessagesContext } from '../../Hooks/MessagesContext'
import { useAvatar } from '../../Utilities/AvatarContext'
import { SYSTEM_USER_ID } from '../../lib/signal/systemIdentity'
import { getDisplayName } from '../../Utilities/nameUtils'
import type { SharedRefContent } from '../../lib/signal/messageContent'
import type { ClinicMedic } from '../../Types/SupervisorTestTypes'

interface ShareToChatPickerProps {
  isOpen: boolean
  content: SharedRefContent | null
  onClose: () => void
}

type Phase = 'pick' | 'sending' | 'done'

interface SendResult {
  medic: ClinicMedic
  ok: boolean
}

/**
 * Centered modal that lets a user share a SharedRefContent (calendar event,
 * map overlay, map feature, or property item) into one or more cluster
 * conversations. Roster is cluster-scoped (allMedics from useClinicMedics)
 * plus a self row routed to the existing self-conversation path. Multi-select
 * → loop sendStructured → completion modal listing succeeded / failed.
 *
 * No PHI on the wire — only the opaque refId + operator-supplied label travel.
 * No groups in v1.
 */
export function ShareToChatPicker({ isOpen, content, onClose }: ShareToChatPickerProps) {
  const ctx = useMessagesContext()
  const { medics } = useClinicMedics()
  const userId = useAuthStore(s => s.user?.id ?? null)
  const { currentAvatar } = useAvatar()

  const [phase, setPhase] = useState<Phase>('pick')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [results, setResults] = useState<SendResult[]>([])

  // Reset internal state on open/close.
  useEffect(() => {
    if (!isOpen) return
    setPhase('pick')
    setSelected(new Set())
    setResults([])
  }, [isOpen])

  // Self row — first in the list. Routes through sendStructured's self-notes
  // branch (peerId === userId) so it always works without an open conversation.
  // Shape mirrors MessagesPanel's selfMedic (currentAvatar + placeholder name).
  const selfMedic = useMemo<ClinicMedic | null>(() => {
    if (!userId) return null
    return {
      id: userId,
      firstName: null,
      lastName: 'You',
      middleInitial: null,
      rank: null,
      credential: null,
      avatarId: currentAvatar.id,
    }
  }, [userId, currentAvatar.id])

  // Cluster roster: self + medics, minus SYSTEM, minus duplicates of self.
  const roster = useMemo<ClinicMedic[]>(() => {
    const out: ClinicMedic[] = []
    if (selfMedic) out.push(selfMedic)
    for (const m of medics) {
      if (m.id === SYSTEM_USER_ID) continue
      if (selfMedic && m.id === selfMedic.id) continue
      out.push(m)
    }
    return out
  }, [selfMedic, medics])

  const applyFilter = (q: string): ClinicMedic[] => {
    const trimmed = q.trim().toLowerCase()
    if (!trimmed) return roster
    return roster.filter(m =>
      (m.firstName ?? '').toLowerCase().includes(trimmed) ||
      (m.lastName ?? '').toLowerCase().includes(trimmed) ||
      (m.rank ?? '').toLowerCase().includes(trimmed) ||
      [m.rank, m.lastName].filter(Boolean).join(' ').toLowerCase().includes(trimmed)
    )
  }

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSend = async () => {
    if (!content || !ctx || selected.size === 0) return
    setPhase('sending')
    const targets = roster.filter(m => selected.has(m.id))
    const out: SendResult[] = []
    for (const medic of targets) {
      const originId = crypto.randomUUID()
      try {
        const ok = await ctx.sendStructured(medic.id, content, originId, content.label)
        out.push({ medic, ok })
      } catch {
        out.push({ medic, ok: false })
      }
    }
    setResults(out)
    setPhase('done')
  }

  // ── Render ──────────────────────────────────────────────────────────
  const selfId = selfMedic?.id ?? null

  const pickList = (q: string) => {
    const filtered = applyFilter(q)
    if (filtered.length === 0) {
      return (
        <p className="text-[10pt] text-tertiary text-center py-10">
          {roster.length === 0 ? 'No cluster contacts' : 'No matches'}
        </p>
      )
    }
    return (
      <div className="py-1">
        {filtered.map(medic => {
          const isSelected = selected.has(medic.id)
          const isSelf = medic.id === selfId
          return (
            <button
              key={medic.id}
              onClick={() => toggle(medic.id)}
              className="flex items-center w-full px-4 py-2.5 gap-3 text-left hover:bg-themewhite2 active:scale-95 transition-all"
            >
              <UserAvatar
                avatarId={medic.avatarId}
                avatarBlob={medic.avatarBlob}
                userId={medic.id}
                firstName={medic.firstName}
                lastName={medic.lastName}
                className="w-8 h-8"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-primary truncate">
                  {isSelf ? 'Me' : getDisplayName(medic)}
                </p>
                {isSelf && (
                  <p className="text-[9pt] text-tertiary">Saved to your conversation</p>
                )}
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors shrink-0
                             ${isSelected ? 'bg-themeblue2 border-themeblue2' : 'border-tertiary/30'}`}>
                {isSelected && <Check size={12} className="text-white" />}
              </div>
            </button>
          )
        })}
      </div>
    )
  }

  const sendingView = (
    <div className="px-6 py-10 flex flex-col items-center gap-3">
      <div className="w-10 h-10 rounded-full border-2 border-themeblue2/30 border-t-themeblue2 animate-spin" />
      <p className="text-[10pt] text-tertiary">
        Sending to {selected.size} {selected.size === 1 ? 'recipient' : 'recipients'}…
      </p>
    </div>
  )

  const doneView = (() => {
    const succeeded = results.filter(r => r.ok)
    const failed = results.filter(r => !r.ok)
    return (
      <div className="px-4 py-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-themegreen/15 flex items-center justify-center shrink-0">
            <Check size={20} className="text-themegreen" />
          </div>
          <div className="min-w-0">
            <p className="text-[11pt] font-medium text-primary">
              Shared with {succeeded.length} {succeeded.length === 1 ? 'recipient' : 'recipients'}
            </p>
            <p className="text-[9pt] text-tertiary truncate">{content?.label ?? ''}</p>
          </div>
        </div>

        {succeeded.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {succeeded.map(r => (
              <div key={r.medic.id} className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-themewhite2">
                <UserAvatar
                  avatarId={r.medic.avatarId}
                  avatarBlob={r.medic.avatarBlob}
                  userId={r.medic.id}
                  firstName={r.medic.firstName}
                  lastName={r.medic.lastName}
                  className="w-5 h-5"
                />
                <span className="text-[10pt] text-primary truncate max-w-[140px]">
                  {r.medic.id === selfId ? 'Me' : getDisplayName(r.medic)}
                </span>
              </div>
            ))}
          </div>
        )}

        {failed.length > 0 && (
          <div className="rounded-xl border border-themeredred/20 bg-themeredred/5 px-3 py-2.5">
            <p className="text-[10pt] font-medium text-themeredred mb-1">
              Couldn't share with {failed.length} {failed.length === 1 ? 'recipient' : 'recipients'}
            </p>
            <p className="text-[9pt] text-tertiary">
              Open a conversation with them in Messages first.
            </p>
            <ul className="mt-2 space-y-0.5">
              {failed.map(r => (
                <li key={r.medic.id} className="text-[10pt] text-primary truncate">
                  {r.medic.id === selfId ? 'Me' : getDisplayName(r.medic)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  })()

  const title = phase === 'done' ? 'Shared'
    : phase === 'sending' ? 'Sending'
    : `Share ${content?.label ?? ''}`.trim()

  return (
    <PreviewOverlay
      isOpen={isOpen && !!content}
      onClose={onClose}
      anchorRect={null}
      title={title}
      maxWidth={360}
      previewMaxHeight="55dvh"
      {...(phase === 'pick'
        ? {
            searchPlaceholder: 'Search cluster…',
            preview: (q: string) => pickList(q),
            actions: [
              {
                key: 'send',
                label: selected.size > 0 ? `Send to ${selected.size}` : 'Send',
                icon: Send,
                onAction: handleSend,
                closesOnAction: false,
                variant: (!ctx || selected.size === 0) ? 'disabled' : 'default',
              },
            ],
          }
        : phase === 'sending'
        ? { preview: () => sendingView }
        : {
            preview: () => doneView,
            actions: [
              { key: 'done', label: 'Done', icon: X, onAction: onClose, closesOnAction: false },
            ],
          })}
    />
  )
}

/**
 * Convenience hook: lets a source surface manage one picker instance with
 * minimal local state. Returns `{ share, picker }` — call `share(content)` to
 * open, render `{picker}` in the tree.
 */
export function useShareToChat() {
  const [content, setContent] = useState<SharedRefContent | null>(null)
  const share = useCallback((next: SharedRefContent) => setContent(next), [])
  const close = useCallback(() => setContent(null), [])
  const picker = <ShareToChatPicker isOpen={!!content} content={content} onClose={close} />
  return { share, picker }
}

/** Shared icon for "Share to chat" entry points across surfaces. */
export const SHARE_TO_CHAT_ICON = MessageSquare
