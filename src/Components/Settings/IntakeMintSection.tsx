import { useState, useEffect, useCallback, useRef } from 'react'
import bwipjs from 'bwip-js/browser'
import {
  Copy, Check, RefreshCw, KeyRound, Trash2, Inbox, Dices, Headset, MessageSquare,
} from 'lucide-react'
import { useAuth } from '../../Hooks/useAuth'
import { ConfirmDialog } from '../ConfirmDialog'
import { EmptyState } from '../EmptyState'
import { ActionPill } from '../ActionPill'
import { ActionButton } from '../ActionButton'
import { PreviewOverlay } from '../PreviewOverlay'
import { TextInput } from '../FormInputs'
import { validatePasswordComplexity } from '../../lib/constants'
import {
  mintEventIntakeCredential,
  rotateEventIntakePasscode,
  rotateEventIntakePassphrase,
  killEventIntakeCredential,
  getEventIntakeCredential,
  type IntakeCredentialMetadata,
} from '../../lib/eventIntakeService'
import { enableOncall, disableOncall, enableOutsideMessaging, disableOutsideMessaging, provisionInboundKey } from '../../lib/oncallService'
import { ToggleSwitch } from './ToggleSwitch'
import { OncallGreetingRow } from './OncallGreetingRow'
import { createLogger } from '../../Utilities/Logger'

const logger = createLogger('IntakeMintSection')

interface IntakeMintSectionProps {
  clinicId: string
  /** Count of cluster members currently on-call — drives the "Allow calls" subtitle. */
  oncallCount?: number
  /** Notifies the parent when the on-call roster becomes relevant — i.e. either
   *  GATE-2 "allow calls" OR "allow text messaging" is on. Both ping clinics.oncall,
   *  so the personnel roster shows per-member on-call toggles whenever either is enabled. */
  onOncallEnabledChange?: (enabled: boolean) => void
}

function intakeUrl(passcode: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/test2/intake.html#p=${passcode}`
}

// Curated, unambiguous lowercase words — readable enough to relay on a poster
// or verbally, yet the digit + symbol suffix guarantees validatePasswordComplexity.
const PASSPHRASE_WORDS = [
  'falcon', 'river', 'cedar', 'anchor', 'summit', 'harbor', 'meadow', 'canyon',
  'ember', 'quartz', 'willow', 'beacon', 'tundra', 'cobalt', 'marble', 'spruce',
  'orchid', 'pewter', 'garnet', 'cypress', 'basalt', 'juniper', 'saffron', 'onyx',
] as const

function randomInt(max: number): number {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0] % max
}

function generatePassphrase(): string {
  const words = Array.from({ length: 3 }, () => PASSPHRASE_WORDS[randomInt(PASSPHRASE_WORDS.length)])
  const head = words[0][0].toUpperCase() + words[0].slice(1)
  const symbols = '!@#$%&*?'
  return `${[head, words[1], words[2]].join('-')}${randomInt(10)}${symbols[randomInt(symbols.length)]}`
}

/**
 * Outside event-intake credential management — mirrors the cluster card
 * shape above. Dev-wrapped client-side; flipping the wrap drops requires
 * zero DB change.
 *
 *   Empty: EmptyState (card variant) + ActionPill overlay with Mint action.
 *   Live : card with passcode + URL on the left + QR canvas on the right,
 *          ActionPill overlay with Rotate-passcode / Rotate-passphrase / Kill.
 *
 * Mint / rotate-passphrase flows use PreviewOverlay anchored to the triggering
 * button (matches the rest of the settings UI). The supervisor types a
 * passphrase or taps the dice to fill a generated one inline before submitting.
 */
export function IntakeMintSection({ clinicId, oncallCount = 0, onOncallEnabledChange }: IntakeMintSectionProps) {
  const { isSupervisorRole, isDevRole } = useAuth()
  const [credential, setCredential] = useState<IntakeCredentialMetadata | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [oncallBusy, setOncallBusy] = useState(false)
  const [msgBusy, setMsgBusy] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const oncallEnabled = credential?.oncall_enabled === true
  const messageEnabled = credential?.outside_message_enabled === true

  // Anchor rects + open flags for each overlay surface.
  const [mintAnchor, setMintAnchor] = useState<DOMRect | null>(null)
  const [rotatePassphraseAnchor, setRotatePassphraseAnchor] = useState<DOMRect | null>(null)
  const [confirmRotatePasscode, setConfirmRotatePasscode] = useState(false)
  const [confirmKill, setConfirmKill] = useState(false)

  // Per-flow input state.
  const [mintPass1, setMintPass1] = useState('')
  const [mintPass2, setMintPass2] = useState('')
  const [rotPass1, setRotPass1] = useState('')
  const [rotPass2, setRotPass2] = useState('')

  // Copy-state flashes.
  const [copiedPasscode, setCopiedPasscode] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)

  const cardRef = useRef<HTMLDivElement | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getEventIntakeCredential(clinicId)
      if (res.ok) {
        setCredential(res.data)
        setLoadError(null)
      } else {
        // "no active cluster invite" surfaces as an inline note in the empty
        // state — not a credential, but not an unrecoverable error either.
        setLoadError(res.error)
        setCredential(null)
      }
    } finally {
      setLoading(false)
    }
  }, [clinicId])

  useEffect(() => { refresh() }, [refresh])

  // Surface on-call-roster relevance to the parent so the personnel roster renders
  // per-member on-call toggles whenever an outside channel that pings on-call is
  // enabled — calls OR text messaging (both target clinics.oncall).
  useEffect(() => { onOncallEnabledChange?.(oncallEnabled || messageEnabled) }, [oncallEnabled, messageEnabled, onOncallEnabledChange])

  const toggleOncall = useCallback(async () => {
    if (oncallBusy) return
    setOncallBusy(true)
    try {
      const res = oncallEnabled ? await disableOncall(clinicId) : await enableOncall(clinicId)
      if (res.ok) await refresh()
    } finally {
      setOncallBusy(false)
    }
  }, [oncallBusy, oncallEnabled, clinicId, refresh])

  const toggleMessage = useCallback(async () => {
    if (msgBusy) return
    setMsgBusy(true)
    try {
      const res = messageEnabled ? await disableOutsideMessaging(clinicId) : await enableOutsideMessaging(clinicId)
      if (res.ok) await refresh()
    } finally {
      setMsgBusy(false)
    }
  }, [msgBusy, messageEnabled, clinicId, refresh])


  const url = credential ? intakeUrl(credential.passcode) : ''

  const qrSetter = useCallback((canvas: HTMLCanvasElement | null) => {
    if (!canvas || !credential) return
    try {
      bwipjs.toCanvas(canvas, {
        bcid: 'qrcode',
        text: intakeUrl(credential.passcode),
        scale: 4,
        padding: 2,
      })
    } catch {
      // QR render failure is non-critical
    }
  }, [credential])

  const openMint = useCallback((el: HTMLElement) => {
    setFormError(null)
    setMintPass1('')
    setMintPass2('')
    setMintAnchor(el.getBoundingClientRect())
  }, [])

  const openRotatePassphrase = useCallback(() => {
    setFormError(null)
    setRotPass1('')
    setRotPass2('')
    if (cardRef.current) setRotatePassphraseAnchor(cardRef.current.getBoundingClientRect())
  }, [])

  const closeMint = useCallback(() => { setMintAnchor(null); setFormError(null) }, [])
  const closeRotatePassphrase = useCallback(() => { setRotatePassphraseAnchor(null); setFormError(null) }, [])

  const fillMint = useCallback(() => {
    const p = generatePassphrase()
    setMintPass1(p); setMintPass2(p); setFormError(null)
  }, [])

  const fillRotate = useCallback(() => {
    const p = generatePassphrase()
    setRotPass1(p); setRotPass2(p); setFormError(null)
  }, [])

  const onMintConfirm = useCallback(async () => {
    setBusy(true)
    try {
      const complaint = validatePasswordComplexity(mintPass1)
      if (complaint) { setFormError(complaint); return }
      if (mintPass1 !== mintPass2) { setFormError('Passphrases do not match'); return }
      const res = await mintEventIntakeCredential(clinicId, { passphrase: mintPass1 })
      if (!res.ok) { setFormError(res.error); return }
      // The clinic inbound key (seals voicemail + outside text) is minted WITH the
      // credential — no separate toggle. Best-effort: enabling a channel self-heals if missed.
      try { await provisionInboundKey(clinicId) } catch (e) { logger.warn('inbound key provisioning failed at mint:', e instanceof Error ? e.message : e) }
      setFormError(null)
      closeMint()
      await refresh()
    } finally {
      setBusy(false)
    }
  }, [mintPass1, mintPass2, clinicId, closeMint, refresh])

  const onRotatePassphraseConfirm = useCallback(async () => {
    setBusy(true)
    try {
      const complaint = validatePasswordComplexity(rotPass1)
      if (complaint) { setFormError(complaint); return }
      if (rotPass1 !== rotPass2) { setFormError('Passphrases do not match'); return }
      const res = await rotateEventIntakePassphrase(clinicId, { passphrase: rotPass1 })
      if (!res.ok) { setFormError(res.error); return }
      setFormError(null)
      closeRotatePassphrase()
      await refresh()
    } finally {
      setBusy(false)
    }
  }, [rotPass1, rotPass2, clinicId, closeRotatePassphrase, refresh])

  const onRotatePasscode = useCallback(async () => {
    setBusy(true)
    try {
      const res = await rotateEventIntakePasscode(clinicId)
      if (!res.ok) { setLoadError(res.error); return }
      // Rotate the inbound key alongside the code — CLEAN SLATE: undelivered/unread
      // sealed voicemails + messages sealed to the old key become unrecoverable (intended).
      try { await provisionInboundKey(clinicId) } catch (e) { logger.warn('inbound key rotation failed:', e instanceof Error ? e.message : e) }
      setConfirmRotatePasscode(false)
      await refresh()
    } finally {
      setBusy(false)
    }
  }, [clinicId, refresh])

  const onKill = useCallback(async () => {
    setBusy(true)
    try {
      const res = await killEventIntakeCredential(clinicId)
      if (!res.ok) { setLoadError(res.error); return }
      setConfirmKill(false)
      await refresh()
    } finally {
      setBusy(false)
    }
  }, [clinicId, refresh])

  const copyText = useCallback(async (text: string, setFlag: (b: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text)
      setFlag(true)
      setTimeout(() => setFlag(false), 1500)
    } catch (e) { logger.warn('clipboard write failed', e) }
  }, [])

  if (!isSupervisorRole && !isDevRole) return null
  if (loading) return null

  return (
    <section data-tour="clinic-event-intake">
      <div className="pb-2 flex items-center gap-2">
        <p className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">
          Outside contact
        </p>
      </div>

      {/* ── Empty state ─────────────────────────────────────────── */}
      {!credential && (
        <>
          {loadError && (
            <p className="text-[10pt] text-tertiary px-1 pb-2">{loadError}</p>
          )}
          {!loadError && (
            <EmptyState
              title="No event-intake credential minted"
              action={{
                icon: Inbox,
                label: 'Mint event intake',
                onClick: openMint,
              }}
            />
          )}
        </>
      )}

      {/* ── Live card (mirrors cluster card shape above) ────────── */}
      {credential && (
        <div className="relative">
          <div
            ref={cardRef}
            className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden"
          >
            <div className="px-4 py-4">
              <div className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-[10pt] text-tertiary">Unit code</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-[10pt] font-mono tracking-[0.2em] text-primary select-all">
                      {credential.passcode}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyText(credential.passcode, setCopiedPasscode)}
                      aria-label="Copy passcode"
                      title="Copy passcode"
                      className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                        copiedPasscode ? 'bg-themegreen/8 text-themegreen' : 'bg-themeblue2/8 text-primary'
                      }`}
                    >
                      {copiedPasscode ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                  </div>
                  <p className="text-[10pt] text-tertiary mt-2">Submission URL</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[9pt] text-primary underline truncate min-w-0 select-all"
                    >
                      {url}
                    </a>
                    <button
                      type="button"
                      onClick={() => copyText(url, setCopiedUrl)}
                      aria-label="Copy URL"
                      title="Copy URL"
                      className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                        copiedUrl ? 'bg-themegreen/8 text-themegreen' : 'bg-themeblue2/8 text-primary'
                      }`}
                    >
                      {copiedUrl ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                  </div>
                  <p className="text-[9pt] text-tertiary/70 mt-2">
                    Passcode rotated {new Date(credential.passcode_rotated_at).toLocaleDateString()}
                    {' · '}
                    Passphrase rotated {new Date(credential.passphrase_rotated_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="bg-white rounded-lg p-1.5 shrink-0">
                  <canvas ref={qrSetter} className="w-16 h-16 rounded" />
                </div>
              </div>
            </div>

            {/* GATE-2 — "Allow calls": master toggle that lets outside callers
                ring the on-call roster over the same QR/passphrase credential. */}
            <div
              onClick={oncallBusy ? undefined : () => void toggleOncall()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (!oncallBusy && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); void toggleOncall() } }}
              className={`flex items-center gap-3 px-4 py-3.5 border-t border-primary/6 transition-all ${oncallBusy ? 'opacity-50' : 'cursor-pointer hover:bg-themeblue2/5 active:scale-95'}`}
            >
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${oncallEnabled ? 'bg-themeblue3/15' : 'bg-tertiary/10'}`}>
                <Headset size={18} className={oncallEnabled ? 'text-themeblue3' : 'text-tertiary'} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${oncallEnabled ? 'text-primary' : 'text-tertiary'}`}>Allow calls</p>
                <p className="text-[9pt] text-tertiary mt-0.5">
                  {oncallEnabled
                    ? `${oncallCount} member${oncallCount === 1 ? '' : 's'} on-call`
                    : 'Outside callers cannot request a live call'}
                </p>
              </div>
              <ToggleSwitch checked={oncallEnabled} />
            </div>

            {/* Cluster voicemail greeting — the announcement an outside caller hears when
                their on-call call goes unanswered. Only relevant when calls are allowed. */}
            {oncallEnabled && (
              <OncallGreetingRow
                clinicId={clinicId}
                initialDur={credential.oncall_greeting_dur ?? null}
                onChanged={refresh}
              />
            )}

            {/* The clinic inbound key (seals voicemail + outside text) is NOT a visible
                control — it is minted with the credential and rotated with the passcode
                (see onMintConfirm / onRotatePasscode). No manual rotate row. */}

            {/* GATE-2 "allow text messaging": outside party drops a one-way sealed note to
                the cluster over the same QR/passphrase credential. Pings on-call. */}
            <div
              onClick={msgBusy ? undefined : () => void toggleMessage()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (!msgBusy && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); void toggleMessage() } }}
              className={`flex items-center gap-3 px-4 py-3.5 border-t border-primary/6 transition-all ${msgBusy ? 'opacity-50' : 'cursor-pointer hover:bg-themeblue2/5 active:scale-95'}`}
            >
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${messageEnabled ? 'bg-themeblue3/15' : 'bg-tertiary/10'}`}>
                <MessageSquare size={18} className={messageEnabled ? 'text-themeblue3' : 'text-tertiary'} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${messageEnabled ? 'text-primary' : 'text-tertiary'}`}>Allow text messaging</p>
                <p className="text-[9pt] text-tertiary mt-0.5">
                  {messageEnabled
                    ? 'Outside senders can drop a sealed one-way note to the cluster'
                    : 'Outside senders cannot message the cluster'}
                </p>
              </div>
              <ToggleSwitch checked={messageEnabled} />
            </div>
          </div>

          <ActionPill shadow="sm" placement="overlay">
            <ActionButton
              icon={RefreshCw}
              label="Rotate passcode"
              onClick={() => setConfirmRotatePasscode(true)}
            />
            <ActionButton
              icon={KeyRound}
              label="Rotate passphrase"
              onClick={openRotatePassphrase}
            />
            <ActionButton
              icon={Trash2}
              label="Kill credential"
              variant="danger"
              onClick={() => setConfirmKill(true)}
            />
          </ActionPill>
        </div>
      )}

      {loadError && credential && (
        <p className="text-[10pt] text-themeredred mt-2">{loadError}</p>
      )}

      {/* ── Mint flow ────────────────────────────────────────────── */}
      <PreviewOverlay
        isOpen={!!mintAnchor}
        onClose={closeMint}
        anchorRect={mintAnchor}
        title="Mint event intake"
        maxWidth={360}
        footer={
          <ActionPill>
            <ActionButton
              icon={Dices}
              label="Random"
              onClick={fillMint}
            />
            <ActionButton
              icon={Check}
              label="Mint"
              variant={busy ? 'disabled' : 'success'}
              onClick={onMintConfirm}
            />
          </ActionPill>
        }
      >
        <div className="px-3 py-2 space-y-2">
          <TextInput
            label="Passphrase"
            value={mintPass1}
            onChange={setMintPass1}
            placeholder="Passphrase"
            hint={mintPass1.length > 0 ? validatePasswordComplexity(mintPass1) : null}
          />
          <TextInput
            label="Confirm"
            value={mintPass2}
            onChange={setMintPass2}
            placeholder="Confirm passphrase"
            hint={mintPass2.length > 0 && mintPass1 !== mintPass2 ? 'Passphrases do not match' : null}
          />
          {formError && <p className="text-[10pt] text-themeredred px-1">{formError}</p>}
        </div>
      </PreviewOverlay>

      {/* ── Rotate-passphrase flow ──────────────────────────────── */}
      <PreviewOverlay
        isOpen={!!rotatePassphraseAnchor}
        onClose={closeRotatePassphrase}
        anchorRect={rotatePassphraseAnchor}
        title="Rotate passphrase"
        maxWidth={360}
        footer={
          <ActionPill>
            <ActionButton
              icon={Dices}
              label="Random"
              onClick={fillRotate}
            />
            <ActionButton
              icon={Check}
              label="Rotate"
              variant={busy ? 'disabled' : 'success'}
              onClick={onRotatePassphraseConfirm}
            />
          </ActionPill>
        }
      >
        <div className="px-3 py-2 space-y-2">
          <TextInput
            label="Passphrase"
            value={rotPass1}
            onChange={setRotPass1}
            placeholder="New passphrase"
            hint={rotPass1.length > 0 ? validatePasswordComplexity(rotPass1) : null}
          />
          <TextInput
            label="Confirm"
            value={rotPass2}
            onChange={setRotPass2}
            placeholder="Confirm new passphrase"
            hint={rotPass2.length > 0 && rotPass1 !== rotPass2 ? 'Passphrases do not match' : null}
          />
          {formError && <p className="text-[10pt] text-themeredred px-1">{formError}</p>}
        </div>
      </PreviewOverlay>

      <ConfirmDialog
        visible={confirmRotatePasscode}
        title="Rotate passcode?"
        subtitle="The current QR will stop working — reprint your poster before redistributing. This also rotates the clinic inbound key: any voicemails or messages left but not yet opened become unrecoverable."
        confirmLabel="Rotate"
        variant="warning"
        processing={busy}
        onConfirm={onRotatePasscode}
        onCancel={() => setConfirmRotatePasscode(false)}
      />

      <ConfirmDialog
        visible={confirmKill}
        title="Kill credential?"
        subtitle="This deletes the QR and the passphrase. Re-establishing intake requires minting both and redistributing the new passphrase to all requesters."
        confirmLabel="Kill"
        variant="danger"
        processing={busy}
        onConfirm={onKill}
        onCancel={() => setConfirmKill(false)}
      />
    </section>
  )
}
