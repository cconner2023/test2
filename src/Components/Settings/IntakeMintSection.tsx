import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import bwipjs from 'bwip-js/browser'
import {
  Copy, Check, RefreshCw, KeyRound, Trash2, Inbox, ExternalLink,
} from 'lucide-react'
import { useAuth } from '../../Hooks/useAuth'
import { ConfirmDialog } from '../ConfirmDialog'
import { EmptyState } from '../EmptyState'
import { ActionPill } from '../ActionPill'
import { ActionButton } from '../ActionButton'
import { PreviewOverlay } from '../PreviewOverlay'
import { TextInput } from '../FormInputs'
import { validatePasswordComplexity, SECURITY } from '../../lib/constants'
import {
  mintEventIntakeCredential,
  rotateEventIntakePasscode,
  rotateEventIntakePassphrase,
  killEventIntakeCredential,
  getEventIntakeCredential,
  type IntakeCredentialMetadata,
} from '../../lib/eventIntakeService'
import { createLogger } from '../../Utilities/Logger'

const logger = createLogger('IntakeMintSection')

interface IntakeMintSectionProps {
  clinicId: string
}

type ChooserMode = 'manual' | 'generate'

function intakeUrl(passcode: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/test2/intake.html#p=${passcode}`
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
 * Mint / rotate-passphrase / reveal flows use PreviewOverlay anchored to the
 * triggering button (matches the rest of the settings UI).
 */
export function IntakeMintSection({ clinicId }: IntakeMintSectionProps) {
  const { isDevRole } = useAuth()
  const [credential, setCredential] = useState<IntakeCredentialMetadata | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  // Anchor rects + open flags for each overlay surface.
  const [mintAnchor, setMintAnchor] = useState<DOMRect | null>(null)
  const [rotatePassphraseAnchor, setRotatePassphraseAnchor] = useState<DOMRect | null>(null)
  const [confirmRotatePasscode, setConfirmRotatePasscode] = useState(false)
  const [confirmKill, setConfirmKill] = useState(false)
  const [reveal, setReveal] = useState<{ passphrase: string; passcode: string; anchor: DOMRect | null } | null>(null)

  // Per-flow input state.
  const [mintMode, setMintMode] = useState<ChooserMode>('generate')
  const [mintPass1, setMintPass1] = useState('')
  const [mintPass2, setMintPass2] = useState('')
  const [rotMode, setRotMode] = useState<ChooserMode>('generate')
  const [rotPass1, setRotPass1] = useState('')
  const [rotPass2, setRotPass2] = useState('')

  // Copy-state flashes.
  const [copiedPasscode, setCopiedPasscode] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [copiedRevealPass, setCopiedRevealPass] = useState(false)
  const [copiedPoster, setCopiedPoster] = useState(false)

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
    setMintMode('generate')
    setMintPass1('')
    setMintPass2('')
    setMintAnchor(el.getBoundingClientRect())
  }, [])

  const openRotatePassphrase = useCallback(() => {
    setFormError(null)
    setRotMode('generate')
    setRotPass1('')
    setRotPass2('')
    if (cardRef.current) setRotatePassphraseAnchor(cardRef.current.getBoundingClientRect())
  }, [])

  const closeMint = useCallback(() => { setMintAnchor(null); setFormError(null) }, [])
  const closeRotatePassphrase = useCallback(() => { setRotatePassphraseAnchor(null); setFormError(null) }, [])
  const closeReveal = useCallback(() => setReveal(null), [])

  const onMintConfirm = useCallback(async () => {
    setBusy(true)
    try {
      if (mintMode === 'manual') {
        const complaint = validatePasswordComplexity(mintPass1)
        if (complaint) { setFormError(complaint); return }
        if (mintPass1 !== mintPass2) { setFormError('Passphrases do not match'); return }
      }
      const res = await mintEventIntakeCredential(
        clinicId,
        mintMode === 'manual' ? { passphrase: mintPass1 } : {},
      )
      if (!res.ok) { setFormError(res.error); return }
      setFormError(null)
      const anchor = mintAnchor
      closeMint()
      await refresh()
      if (res.data.passphraseWasGenerated && res.data.passphrase) {
        setReveal({ passphrase: res.data.passphrase, passcode: res.data.passcode, anchor })
      }
    } finally {
      setBusy(false)
    }
  }, [mintMode, mintPass1, mintPass2, clinicId, mintAnchor, closeMint, refresh])

  const onRotatePassphraseConfirm = useCallback(async () => {
    setBusy(true)
    try {
      if (rotMode === 'manual') {
        const complaint = validatePasswordComplexity(rotPass1)
        if (complaint) { setFormError(complaint); return }
        if (rotPass1 !== rotPass2) { setFormError('Passphrases do not match'); return }
      }
      const res = await rotateEventIntakePassphrase(
        clinicId,
        rotMode === 'manual' ? { passphrase: rotPass1 } : {},
      )
      if (!res.ok) { setFormError(res.error); return }
      setFormError(null)
      const anchor = rotatePassphraseAnchor
      closeRotatePassphrase()
      await refresh()
      if (res.data.passphraseWasGenerated && res.data.passphrase && credential) {
        setReveal({ passphrase: res.data.passphrase, passcode: credential.passcode, anchor })
      }
    } finally {
      setBusy(false)
    }
  }, [rotMode, rotPass1, rotPass2, clinicId, rotatePassphraseAnchor, closeRotatePassphrase, refresh, credential])

  const onRotatePasscode = useCallback(async () => {
    setBusy(true)
    try {
      const res = await rotateEventIntakePasscode(clinicId)
      if (!res.ok) { setLoadError(res.error); return }
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

  const posterText = useMemo(() => {
    if (!reveal) return ''
    const baseUrl = intakeUrl(reveal.passcode).replace(/#p=.*/, '')
    return (
      `Scan the QR or visit ${baseUrl} and enter unit code: ${reveal.passcode}\n`
      + `Passphrase (required to submit): ${reveal.passphrase}\n\n`
      + `Direct link: ${intakeUrl(reveal.passcode)}`
    )
  }, [reveal])

  if (!isDevRole) return null
  if (loading) return null

  return (
    <section data-tour="clinic-event-intake">
      <div className="pb-2 flex items-center gap-2">
        <p className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">
          Event intake
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
              icon={Check}
              label="Mint"
              variant={busy ? 'disabled' : 'success'}
              onClick={onMintConfirm}
            />
          </ActionPill>
        }
      >
        <div className="px-3 py-2 space-y-2">
          <ChooserRadio mode={mintMode} onChange={setMintMode} />
          {mintMode === 'manual' && (
            <>
              <TextInput
                label="Passphrase"
                value={mintPass1}
                onChange={setMintPass1}
                placeholder="Passphrase"
                hint={`Min ${SECURITY.MIN_PASSWORD_LENGTH} chars · upper · lower · digit · special`}
              />
              <TextInput
                label="Confirm"
                value={mintPass2}
                onChange={setMintPass2}
                placeholder="Confirm passphrase"
              />
            </>
          )}
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
              icon={Check}
              label="Rotate"
              variant={busy ? 'disabled' : 'success'}
              onClick={onRotatePassphraseConfirm}
            />
          </ActionPill>
        }
      >
        <div className="px-3 py-2 space-y-2">
          <p className="text-[10pt] text-themeredred px-1">
            Anyone using the current passphrase will be locked out. You must redistribute the new passphrase yourself — Beacon will not store it in a readable form.
          </p>
          <ChooserRadio mode={rotMode} onChange={setRotMode} />
          {rotMode === 'manual' && (
            <>
              <TextInput
                label="Passphrase"
                value={rotPass1}
                onChange={setRotPass1}
                placeholder="New passphrase"
                hint={`Min ${SECURITY.MIN_PASSWORD_LENGTH} chars · upper · lower · digit · special`}
              />
              <TextInput
                label="Confirm"
                value={rotPass2}
                onChange={setRotPass2}
                placeholder="Confirm new passphrase"
              />
            </>
          )}
          {formError && <p className="text-[10pt] text-themeredred px-1">{formError}</p>}
        </div>
      </PreviewOverlay>

      {/* ── Visible-once reveal (generate path only) ────────────── */}
      <PreviewOverlay
        isOpen={!!reveal}
        onClose={closeReveal}
        anchorRect={reveal?.anchor ?? null}
        title="Save this passphrase"
        maxWidth={420}
        footer={
          <ActionPill>
            <ActionButton
              icon={copiedRevealPass ? Check : Copy}
              label="Copy passphrase"
              onClick={() => reveal && copyText(reveal.passphrase, setCopiedRevealPass)}
            />
            <ActionButton
              icon={copiedPoster ? Check : ExternalLink}
              label="Copy poster text"
              onClick={() => copyText(posterText, setCopiedPoster)}
            />
            <ActionButton
              icon={Check}
              label="I've saved this passphrase"
              variant="success"
              onClick={closeReveal}
            />
          </ActionPill>
        }
      >
        <div className="px-3 py-2 space-y-2">
          <p className="text-[10pt] text-tertiary">
            This is the only time the passphrase will be shown in plaintext. After dismissal it cannot be recovered — you'll have to rotate it.
          </p>
          <div className="rounded-lg bg-white border border-tertiary/20 px-3 py-2">
            <p className="text-[9pt] text-tertiary/60">Passcode</p>
            <p className="font-mono text-[11pt] text-primary break-all">{reveal?.passcode}</p>
            <p className="text-[9pt] text-tertiary/60 mt-2">Passphrase</p>
            <p className="font-mono text-[13pt] text-primary break-all">{reveal?.passphrase}</p>
          </div>
        </div>
      </PreviewOverlay>

      <ConfirmDialog
        visible={confirmRotatePasscode}
        title="Rotate passcode?"
        subtitle="The current QR will stop working. Reprint your poster before redistributing."
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

function ChooserRadio({
  mode, onChange,
}: { mode: ChooserMode; onChange: (m: ChooserMode) => void }) {
  return (
    <div className="flex flex-col gap-1 px-1">
      <label className="flex items-center gap-2 text-[10pt] text-primary">
        <input
          type="radio"
          checked={mode === 'generate'}
          onChange={() => onChange('generate')}
        />
        Generate a random passphrase
      </label>
      <label className="flex items-center gap-2 text-[10pt] text-primary">
        <input
          type="radio"
          checked={mode === 'manual'}
          onChange={() => onChange('manual')}
        />
        I'll set the passphrase
      </label>
    </div>
  )
}
