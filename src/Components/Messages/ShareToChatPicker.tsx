import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Send, MessageSquare, X } from 'lucide-react'
import { OverlayStack, type StackNav, type StackScreen } from '@/Components/primitives/OverlayStack'
import { FooterPill } from '@/Components/primitives/FooterPill'
import { ActionButton } from '@/Components/primitives/ActionButton'
import { HudLoader } from '@/Components/primitives/HudLoader'
import { UserAvatar } from '../Settings/UserAvatar'
import { useAuthStore } from '../../stores/useAuthStore'
import { useMessagesContext } from '../../Hooks/MessagesContext'
import { useContactPicker, type ContactPickerTarget } from './useContactPicker'
import { getDisplayName } from '../../Utilities/nameUtils'
import { displayGroupName } from '../../lib/signal/groupTypes'
import { packBundle, bundleSourceToBundle, type BundleSource } from '../../lib/objectBundle'
import type { SharedRefContent, SharedBundleContent } from '../../lib/signal/messageContent'

interface ShareToChatPickerProps {
  isOpen: boolean
  content: SharedRefContent | null
  /** Source object for cross-cluster recipients. When a selected recipient is
   *  in another cluster, the picker packs this into a frozen bundle (the live
   *  `content` ref can't resolve outside the sending cluster). Omit to restrict
   *  sharing to same-cluster recipients only. */
  bundleSource?: BundleSource | null
  onClose: () => void
  /** Override the OverlayStack z-tier. Bump above a host Sheet (body portal
   *  at z-1200) so the picker isn't trapped underneath it. */
  zIndex?: number
}

type Phase = 'pick' | 'sending' | 'done'

interface SendResult {
  target: ContactPickerTarget
  ok: boolean
}

const targetId = (t: ContactPickerTarget) => (t.kind === 'group' ? t.group.groupId : t.medic.id)
const targetName = (t: ContactPickerTarget) =>
  t.kind === 'group' ? displayGroupName(t.group.name) : getDisplayName(t.medic)

/**
 * Centered modal that lets a user share a SharedRefContent (calendar event,
 * map overlay, map feature, or property item) into one or more conversations —
 * contacts, existing groups, or a group created on the spot.
 *
 * The card itself is the shared useContactPicker surface, the same one the New
 * Message / New Group builder renders: same roster, same rows, same New Group
 * flow, same off-roster Add drill. This component only adds multi-select send:
 * the phase machine (pick → sending → done) morphs the same card by overriding
 * the picker's root screen.
 *
 * Cross-cluster mechanics stay INVISIBLE here — a recipient in another cluster
 * silently receives a frozen bundle instead of a live ref. That is transport,
 * not something the sender picks.
 *
 * No PHI on the wire — only the opaque refId + operator-supplied label travel.
 */
export function ShareToChatPicker({ isOpen, content, bundleSource, onClose, zIndex }: ShareToChatPickerProps) {
  const ctx = useMessagesContext()
  const userId = useAuthStore(s => s.user?.id ?? null)
  const myClinicId = useAuthStore(s => s.clinicId)
  const myClinicName = useAuthStore(s => s.user?.clinicName ?? null)

  const [phase, setPhase] = useState<Phase>('pick')
  const [results, setResults] = useState<SendResult[]>([])

  // Shared nav of the OverlayStack — the picker's off-roster drill resets the
  // card to root through it once a lookup resolves.
  const navRef = useRef<StackNav | null>(null)

  // Label for chrome — a live ref carries its own; a bundle-only share
  // (note-blocks) takes it from the source.
  const shareLabel = content?.label ?? (bundleSource?.kind === 'note-blocks' ? bundleSource.label : '')

  /** A recipient counts as cross-cluster when we know both clinic ids and they
   *  differ. Same-cluster (or unknown) → live ref; cross-cluster → frozen bundle.
   *  Groups are always same-cluster. */
  const isCrossCluster = useCallback((t: ContactPickerTarget): boolean => {
    if (t.kind === 'group') return false
    return !!t.medic.clinicId && !!myClinicId && t.medic.clinicId !== myClinicId
  }, [myClinicId])

  const handleSend = useCallback(async (targets: ContactPickerTarget[]) => {
    if (!ctx || targets.length === 0) return
    if (!content && !bundleSource) return
    setPhase('sending')

    // Bundle-only share: there's no live `shared_ref` (e.g. note-blocks config),
    // so EVERY recipient receives the frozen bundle.
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
    for (const target of targets) {
      const originId = crypto.randomUUID()
      try {
        const useBundle = bundleOnly || isCrossCluster(target)
        const payload = useBundle ? bundleContent : content
        if (!payload) { out.push({ target, ok: false }); continue }
        if (target.kind === 'group') {
          const ok = await ctx.sendGroupStructured(target.group.groupId, payload, originId, payload.label)
          out.push({ target, ok })
        } else {
          // Foreign-cluster recipients open a fresh request thread; same-cluster
          // shares land in the normal conversation.
          const sendOpts = isCrossCluster(target) ? { openAsRequest: true } : undefined
          const ok = await ctx.sendStructured(target.medic.id, payload, originId, payload.label, sendOpts)
          out.push({ target, ok })
        }
      } catch {
        out.push({ target, ok: false })
      }
    }
    setResults(out)
    setPhase('done')
  }, [ctx, content, bundleSource, isCrossCluster, myClinicName, userId])

  // Off-roster lookup only makes sense when the object can travel as a frozen
  // bundle — everyone reachable with a live ref is already on the roster.
  const picker = useContactPicker({
    navRef,
    title: `Share ${shareLabel}`.trim(),
    multiSelect: true,
    includeSelf: true,
    selfLabel: 'Me',
    includeGroups: true,
    allowCreateGroup: true,
    hideAdd: !bundleSource,
    emptyText: 'No contacts',
  })
  const { selectedTargets, selectedCount, reset: resetPicker } = picker

  // Reset internal state on open.
  useEffect(() => {
    if (!isOpen) return
    setPhase('pick')
    setResults([])
    resetPicker()
    // resetPicker is stable enough; excluded to keep this an isOpen effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // ── Render ──────────────────────────────────────────────────────────
  const sendingView = (
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-12">
      <HudLoader size={96} />
      <div className="hud-breathe text-[10pt] tracking-[0.2em] text-themeblue2/80 font-semibold uppercase">
        Sending to {selectedCount} {selectedCount === 1 ? 'recipient' : 'recipients'}…
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
            {succeeded.map(r => {
              const name = targetName(r.target)
              return (
                <div key={targetId(r.target)} className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-themewhite2">
                  {r.target.kind === 'group' ? (
                    <div className="w-5 h-5 rounded-full bg-themeblue2/10 flex items-center justify-center shrink-0">
                      <span className="text-[8pt] font-semibold text-themeblue2 uppercase">{name.slice(0, 2)}</span>
                    </div>
                  ) : (
                    <UserAvatar
                      avatarId={r.target.medic.avatarId}
                      avatarBlob={r.target.medic.avatarBlob}
                      userId={r.target.medic.id}
                      firstName={r.target.medic.firstName}
                      lastName={r.target.medic.lastName}
                      className="w-5 h-5"
                    />
                  )}
                  <span className="text-[10pt] text-primary truncate max-w-[140px]">{name}</span>
                </div>
              )
            })}
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
                <li key={targetId(r.target)} className="text-[10pt] text-primary truncate">{targetName(r.target)}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  })()

  // Pick phase IS the shared picker card; sending/done morph it in place by
  // overriding the same root screen key.
  const phaseScreen: StackScreen = {
    title: phase === 'done' ? 'Shared' : 'Sending',
    ...(phase === 'done'
      ? {
          rightFooter: (
            <FooterPill side="right">
              <ActionButton icon={X} label="Done" onClick={onClose} />
            </FooterPill>
          ),
        }
      : {}),
    render: () => (phase === 'sending' ? sendingView : doneView),
  }

  const pickScreen: StackScreen = {
    ...picker.screens.main,
    ...(ctx && selectedCount > 0
      ? {
          rightFooter: (
            <FooterPill side="right">
              <ActionButton
                icon={Send}
                label={`Send to ${selectedCount}`}
                onClick={() => void handleSend(selectedTargets)}
              />
            </FooterPill>
          ),
        }
      : {}),
  }

  return (
    <OverlayStack
      isOpen={isOpen && (!!content || !!bundleSource)}
      onClose={onClose}
      initial={{ key: 'main' }}
      screens={{ ...picker.screens, main: phase === 'pick' ? pickScreen : phaseScreen }}
      navRef={navRef}
      anchorRect={null}
      maxWidth={360}
      previewMaxHeight="55dvh"
      {...(zIndex !== undefined ? { zIndex } : {})}
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
  // frozen copy to a recipient in another cluster (found off-roster).
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
