import { useCallback, useEffect, useState } from 'react'
import { Check, Send, MessageSquare, X, Plus, Globe } from 'lucide-react'
import { PreviewOverlay } from '../PreviewOverlay'
import { HudLoader } from '@/Components/primitives/HudLoader'
import { UserAvatar } from '../Settings/UserAvatar'
import { useAuthStore } from '../../stores/useAuthStore'
import { useMessageRoster } from '../../Hooks/useMessageRoster'
import { useMessagesContext } from '../../Hooks/MessagesContext'
import { getDisplayName } from '../../Utilities/nameUtils'
import { fetchProfileById } from '../../lib/peerLookup'
import { packBundle, bundleSourceToBundle, type BundleSource } from '../../lib/objectBundle'
import type { SharedRefContent, SharedBundleContent } from '../../lib/signal/messageContent'
import type { ClinicMedic } from '../../Types/SupervisorTestTypes'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface ShareToChatPickerProps {
  isOpen: boolean
  content: SharedRefContent | null
  /** Source object for cross-cluster recipients. When a selected recipient is
   *  in another cluster, the picker packs this into a frozen bundle (the live
   *  `content` ref can't resolve outside the sending cluster). Omit to restrict
   *  sharing to same-cluster recipients only. */
  bundleSource?: BundleSource | null
  onClose: () => void
  /** Override the PreviewOverlay z-tier. Bump above a host Sheet (body portal
   *  at z-1200) so the picker isn't trapped underneath it. */
  zIndex?: number
}

type Phase = 'pick' | 'sending' | 'done'

interface SendResult {
  medic: ClinicMedic
  ok: boolean
}

/**
 * Centered modal that lets a user share a SharedRefContent (calendar event,
 * map overlay, map feature, or property item) into one or more cluster
 * conversations. Roster is the shared useMessageRoster primitive (cluster +
 * self row + code-added out-cluster peers). Multi-select
 * → loop sendStructured → completion modal listing succeeded / failed.
 *
 * No PHI on the wire — only the opaque refId + operator-supplied label travel.
 * No groups in v1.
 */
export function ShareToChatPicker({ isOpen, content, bundleSource, onClose, zIndex }: ShareToChatPickerProps) {
  const ctx = useMessagesContext()
  const userId = useAuthStore(s => s.user?.id ?? null)
  const myClinicId = useAuthStore(s => s.clinicId)
  const myClinicName = useAuthStore(s => s.user?.clinicName ?? null)

  const [phase, setPhase] = useState<Phase>('pick')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [results, setResults] = useState<SendResult[]>([])
  // Out-cluster recipients added by user code (resolved via the global
  // fetch_profiles_by_ids resolver). These carry a foreign clinicId → the send
  // loop packs a bundle for them instead of a live ref.
  const [extraPeers, setExtraPeers] = useState<ClinicMedic[]>([])
  const [lookupBusy, setLookupBusy] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)

  // Shared roster primitive — self row + cluster + code-added peers, SYSTEM and
  // dupes dropped, plus the common name/rank/id filter. Same source the forward
  // and new-message pickers use; sharing just layers multi-select on top.
  const { roster, selfMedic, applyFilter } = useMessageRoster({ includeSelf: true, extraPeers })

  // Reset internal state on open/close.
  useEffect(() => {
    if (!isOpen) return
    setPhase('pick')
    setSelected(new Set())
    setResults([])
    setExtraPeers([])
    setLookupBusy(false)
    setLookupError(null)
  }, [isOpen])

  /** A recipient counts as cross-cluster when we know both clinic ids and they
   *  differ. Same-cluster (or unknown) → live ref; cross-cluster → frozen bundle. */
  const isCrossCluster = useCallback((m: ClinicMedic): boolean => {
    return !!m.clinicId && !!myClinicId && m.clinicId !== myClinicId
  }, [myClinicId])

  // Resolve a pasted user code (UUID) into an out-cluster recipient.
  const handleLookup = useCallback(async (code: string) => {
    const id = code.trim()
    if (!UUID_RE.test(id)) return
    if (id === userId || roster.some(m => m.id === id)) return
    setLookupBusy(true)
    setLookupError(null)
    try {
      const peer = await fetchProfileById(id)
      if (!peer) { setLookupError('No user found for that code.'); return }
      setExtraPeers(prev => prev.some(p => p.id === peer.id) ? prev : [...prev, peer])
      setSelected(prev => new Set(prev).add(peer.id))
    } catch {
      setLookupError('Lookup failed. Check the code and try again.')
    } finally {
      setLookupBusy(false)
    }
  }, [userId, roster])

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSend = async () => {
    if (!ctx || selected.size === 0) return
    if (!content && !bundleSource) return
    setPhase('sending')
    const targets = roster.filter(m => selected.has(m.id))

    // Bundle-only share: there's no live `shared_ref` (e.g. note-blocks config),
    // so EVERY recipient — same- or cross-cluster — receives the frozen bundle.
    const bundleOnly = !content

    // Pack the bundle ONCE if it's needed (bundle-only, or any cross-cluster
    // recipient). One ciphertext blob reused across recipients — each gets the
    // AES key inside their own E2E msg.
    let bundleContent: SharedBundleContent | null = null
    const needsBundle = bundleOnly || targets.some(isCrossCluster)
    if (needsBundle && bundleSource && userId) {
      const packed = await packBundle(
        userId,
        bundleSourceToBundle(bundleSource, myClinicName ?? 'another cluster', new Date().toISOString()),
      )
      if (packed.ok) {
        bundleContent = {
          type: 'shared_bundle',
          bundleKind: packed.data.kind,
          path: packed.data.path,
          key: packed.data.key,
          contentHash: packed.data.contentHash,
          label: packed.data.label,
          ...(packed.data.subLabel ? { subLabel: packed.data.subLabel } : {}),
          sourceCluster: packed.data.sourceCluster,
        }
      }
    }

    const out: SendResult[] = []
    for (const medic of targets) {
      const originId = crypto.randomUUID()
      try {
        const useBundle = bundleOnly || isCrossCluster(medic)
        if (useBundle) {
          if (!bundleContent) { out.push({ medic, ok: false }); continue }
          // Foreign-cluster recipients open a fresh request thread; same-cluster
          // bundle-only shares land in the normal conversation.
          const sendOpts = isCrossCluster(medic) ? { openAsRequest: true } : undefined
          const ok = await ctx.sendStructured(medic.id, bundleContent, originId, bundleContent.label, sendOpts)
          out.push({ medic, ok })
        } else if (content) {
          // Same-cluster: the live ref resolves in the shared vault.
          const ok = await ctx.sendStructured(medic.id, content, originId, content.label)
          out.push({ medic, ok })
        } else {
          out.push({ medic, ok: false })
        }
      } catch {
        out.push({ medic, ok: false })
      }
    }
    setResults(out)
    setPhase('done')
  }

  // ── Render ──────────────────────────────────────────────────────────
  const selfId = selfMedic?.id ?? null
  // Label for chrome — live ref carries its own; a bundle-only share (note-blocks)
  // takes it from the source.
  const shareLabel = content?.label ?? (bundleSource?.kind === 'note-blocks' ? bundleSource.label : '')

  const pickList = (q: string) => {
    const trimmed = q.trim()
    const isCode = UUID_RE.test(trimmed)
    const codeNotInRoster = isCode && !roster.some(m => m.id === trimmed) && trimmed !== userId
    const filtered = applyFilter(q)

    // Header affordance: paste a user code (QR payload) to reach a user in
    // another cluster. Only meaningful when we have source data to bundle.
    const addByCodeRow = codeNotInRoster && (
      <button
        onClick={() => void handleLookup(trimmed)}
        disabled={lookupBusy || !bundleSource}
        className="flex items-center w-full px-4 py-2.5 gap-3 text-left hover:bg-themewhite2 active:scale-95 transition-all disabled:opacity-50"
      >
        <div className="w-8 h-8 rounded-full bg-themeblue3/10 flex items-center justify-center shrink-0">
          {lookupBusy
            ? <div className="w-3.5 h-3.5 rounded-full border-2 border-themeblue3/60 border-t-transparent animate-spin" />
            : <Plus size={16} className="text-themeblue3" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-primary truncate">Add user by code</p>
          <p className="text-[9pt] text-tertiary truncate">
            {bundleSource ? 'Reach someone in another cluster' : 'Not shareable across clusters'}
          </p>
        </div>
      </button>
    )

    if (filtered.length === 0 && !addByCodeRow) {
      return (
        <p className="text-[10pt] text-tertiary text-center py-10">
          {roster.length === 0 ? 'No cluster contacts' : 'No matches'}
        </p>
      )
    }
    return (
      <div className="py-1">
        {addByCodeRow}
        {lookupError && (
          <p className="px-4 py-1.5 text-[9pt] text-themeredred">{lookupError}</p>
        )}
        {filtered.map(medic => {
          const isSelected = selected.has(medic.id)
          const isSelf = medic.id === selfId
          const cross = isCrossCluster(medic)
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
                {isSelf ? (
                  <p className="text-[9pt] text-tertiary">Saved to your conversation</p>
                ) : cross ? (
                  <p className="text-[9pt] text-themeblue3 truncate flex items-center gap-1">
                    <Globe size={10} /> {medic.clinicName || 'Another cluster'} · sends a copy
                  </p>
                ) : null}
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
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-12">
      <HudLoader size={96} />
      <div className="hud-breathe text-[10pt] tracking-[0.2em] text-themeblue2/80 font-semibold uppercase">
        Sending to {selected.size} {selected.size === 1 ? 'recipient' : 'recipients'}…
      </div>
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
            <p className="text-[9pt] text-tertiary truncate">{shareLabel}</p>
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
    : `Share ${shareLabel}`.trim()

  return (
    <PreviewOverlay
      isOpen={isOpen && (!!content || !!bundleSource)}
      onClose={onClose}
      anchorRect={null}
      title={title}
      maxWidth={360}
      previewMaxHeight="55dvh"
      {...(zIndex !== undefined ? { zIndex } : {})}
      {...(phase === 'pick'
        ? {
            searchPlaceholder: bundleSource ? 'Search or paste a user code…' : 'Search cluster…',
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
export function useShareToChat(options?: { zIndex?: number }) {
  const [content, setContent] = useState<SharedRefContent | null>(null)
  const [bundleSource, setBundleSource] = useState<BundleSource | null>(null)
  // share(ref) — same-cluster only. share(ref, source) — also enables sending a
  // frozen copy to a recipient in another cluster (added by user code).
  const share = useCallback((next: SharedRefContent, source?: BundleSource | null) => {
    setContent(next)
    setBundleSource(source ?? null)
  }, [])
  // Bundle-only share — no live ref. Sends a frozen copy to every selected
  // recipient (same- AND cross-cluster). Used for note-blocks config.
  const shareBundle = useCallback((source: BundleSource) => {
    setContent(null)
    setBundleSource(source)
  }, [])
  const close = useCallback(() => { setContent(null); setBundleSource(null) }, [])
  const picker = (
    <ShareToChatPicker isOpen={!!content || !!bundleSource} content={content} bundleSource={bundleSource} onClose={close} zIndex={options?.zIndex} />
  )
  return { share, shareBundle, picker }
}

/** Shared icon for "Share to chat" entry points across surfaces. */
export const SHARE_TO_CHAT_ICON = MessageSquare
