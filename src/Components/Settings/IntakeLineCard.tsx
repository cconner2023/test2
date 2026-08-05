import { useState, useCallback, useRef } from 'react'
import bwipjs from 'bwip-js/browser'
import {
  Copy, Check, RefreshCw, KeyRound, Trash2, Dices, Headset, MessageSquare,
  CalendarPlus, Send, Pencil,
} from 'lucide-react'
import { ConfirmDialog } from '@/Components/primitives/ConfirmDialog'
import { FooterPill } from '@/Components/primitives/FooterPill'
import { ActionButton } from '@/Components/primitives/ActionButton'
import { OverlayActionMenu } from '@/Components/primitives/OverlayActionMenu'
import { PreviewOverlay } from '../PreviewOverlay'
import { TextInput } from '@/Components/primitives/FormInputs'
import { SectionCard, PageSectionHeader } from '@/Components/primitives/Section'
import { validatePasswordComplexity } from '../../lib/constants'
import { generatePassphrase } from '../../lib/intakePassphrase'
import { copyText } from '../../Utilities/clipboardUtils'
import { createLogger } from '../../Utilities/Logger'
import {
  rotateIntakeLinePasscode,
  rotateIntakeLinePassphrase,
  killIntakeLine,
  renameIntakeLine,
  setIntakeLineScope,
  type IntakeLine,
  type IntakeLineScope,
} from '../../lib/eventIntakeService'
import {
  setLineOncallEnabled,
  setLineMessageEnabled,
  setLineIntakeEnabled,
  setLineOutboundEnabled,
} from '../../lib/oncallService'
import { SettingsToggleRow } from './SettingsToggleRow'
import { LineOncallRow } from './LineOncallRow'
import { OncallGreetingRow } from './OncallGreetingRow'
import { IntakeLineScopeEditor } from './IntakeLineScopeEditor'
import type { SubCluster } from '../../lib/subClusterService'

const logger = createLogger('IntakeLineCard')

function intakeUrl(passcode: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/test2/intake.html#p=${passcode}`
}

interface Props {
  line: IntakeLine
  subClusters: SubCluster[]
  /** The live-call channel is still beta-gated; intake + outside chat are GA. */
  showCallChannel: boolean
  /** Optimistic local patch so a toggle animates without a card repaint. */
  onPatch: (id: string, patch: Partial<IntakeLine>) => void
  /** Reconcile in place (no loading flip). */
  onChanged: () => void
  /** The line is gone — reload loudly. */
  onRemoved: () => void
}

/**
 * One intake LINE: its code, its QR, which channels it opens, and who it routes to.
 *
 * A cluster runs several — an SD phone, a CQ phone, an HQ on-call line — and each is
 * a separate credential row with its own passcode and its own routing scope. The code
 * IS the picker: the outsider holds one and never sees that the others exist, which is
 * the non-discoverability the cross-org contact model depends on.
 */
export function IntakeLineCard({
  line, subClusters, showCallChannel, onPatch, onChanged, onRemoved,
}: Props) {
  const [busy, setBusy] = useState(false)
  const [channelBusy, setChannelBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const [rotatePassphraseAnchor, setRotatePassphraseAnchor] = useState<DOMRect | null>(null)
  const [editAnchor, setEditAnchor] = useState<DOMRect | null>(null)
  const [confirmRotatePasscode, setConfirmRotatePasscode] = useState(false)
  const [confirmKill, setConfirmKill] = useState(false)

  const [rotPass1, setRotPass1] = useState('')
  const [rotPass2, setRotPass2] = useState('')
  const [draftName, setDraftName] = useState(line.name)
  const draftScope = useRef<IntakeLineScope>({
    scopeMode: line.scope_mode,
    subClusters: line.scope_sub_clusters,
    members: line.scope_members,
  })

  const cardRef = useRef<HTMLDivElement | null>(null)

  const oncallEnabled = line.oncall_enabled === true
  const messageEnabled = line.outside_message_enabled === true
  // Defaults true: a line minted before the column existed has intake on.
  const intakeEnabled = line.intake_enabled !== false
  const outboundEnabled = line.outbound_enabled === true
  // Calls and one-way messages both ring the same roster, so either one makes the
  // duty row worth showing.
  const rosterShown = (oncallEnabled && showCallChannel) || messageEnabled

  const url = intakeUrl(line.passcode)

  const qrSetter = useCallback((canvas: HTMLCanvasElement | null) => {
    if (!canvas) return
    try {
      bwipjs.toCanvas(canvas, { bcid: 'qrcode', text: intakeUrl(line.passcode), scale: 4, padding: 2 })
    } catch {
      // QR render failure is non-critical
    }
    // Keyed on passcode only — a silent refresh hands back a new line object with the
    // same passcode, and redrawing the QR would flicker it.
  }, [line.passcode])

  const copy = useCallback(async (text: string, label: string) => {
    if (!await copyText(text, label)) logger.warn('clipboard write failed')
  }, [])

  /** Optimistically flip a channel flag, then reconcile silently; revert on failure. */
  const toggleChannel = useCallback(async (
    key: 'oncall_enabled' | 'outside_message_enabled' | 'intake_enabled' | 'outbound_enabled',
    current: boolean,
    call: (id: string, on: boolean) => Promise<{ ok: boolean }>,
  ) => {
    if (channelBusy) return
    setChannelBusy(key)
    onPatch(line.id, { [key]: !current } as Partial<IntakeLine>)
    try {
      const res = await call(line.id, !current)
      if (res.ok) onChanged()
      else onPatch(line.id, { [key]: current } as Partial<IntakeLine>)
    } finally {
      setChannelBusy(null)
    }
  }, [channelBusy, line.id, onPatch, onChanged])

  const onRotatePassphraseConfirm = useCallback(async () => {
    setBusy(true)
    try {
      const complaint = validatePasswordComplexity(rotPass1)
      if (complaint) { setFormError(complaint); return }
      if (rotPass1 !== rotPass2) { setFormError('Passphrases do not match'); return }
      const res = await rotateIntakeLinePassphrase(line.id, { passphrase: rotPass1 })
      if (!res.ok) { setFormError(res.error); return }
      setFormError(null)
      setRotatePassphraseAnchor(null)
      onChanged()
    } finally {
      setBusy(false)
    }
  }, [rotPass1, rotPass2, line.id, onChanged])

  const onRotatePasscode = useCallback(async () => {
    setBusy(true)
    try {
      const res = await rotateIntakeLinePasscode(line.id)
      if (!res.ok) { setError(res.error); return }
      setConfirmRotatePasscode(false)
      onChanged()
    } finally {
      setBusy(false)
    }
  }, [line.id, onChanged])

  const onKill = useCallback(async () => {
    setBusy(true)
    try {
      const res = await killIntakeLine(line.id)
      if (!res.ok) { setError(res.error); return }
      setConfirmKill(false)
      onRemoved()
    } finally {
      setBusy(false)
    }
  }, [line.id, onRemoved])

  /**
   * Save the two deferred fields together. The channel switches inside the same
   * overlay have already written themselves — they are one RPC each and behave
   * like every other settings toggle — so this only covers name and allotment.
   * Rename runs first and only when it changed: a failed rename must not leave a
   * re-pointed line carrying the old label.
   */
  const onEditConfirm = useCallback(async () => {
    setBusy(true)
    try {
      const name = draftName.trim()
      if (name.length === 0) { setFormError('Name the line'); return }
      if (name !== line.name) {
        const renamed = await renameIntakeLine(line.id, name)
        if (!renamed.ok) { setFormError(renamed.error); return }
      }
      const res = await setIntakeLineScope(line.id, draftScope.current)
      if (!res.ok) { setFormError(res.error); return }
      setFormError(null)
      setEditAnchor(null)
      onChanged()
    } finally {
      setBusy(false)
    }
  }, [line.id, line.name, draftName, onChanged])

  return (
    <div className="relative">
      <SectionCard ref={cardRef}>
        <div className="px-4 py-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-[10pt] text-primary font-medium truncate">{line.name}</p>

              <div className="flex items-center gap-1 mt-2">
                <span className="text-[10pt] font-mono tracking-[0.2em] text-primary select-all">
                  {line.passcode}
                </span>
                <button
                  type="button"
                  onClick={() => copy(line.passcode, 'Passcode copied')}
                  aria-label="Copy passcode"
                  title="Copy passcode"
                  className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 bg-themeblue2/8 text-primary"
                >
                  <Copy size={12} />
                </button>
              </div>
              <div className="flex items-center gap-1 mt-2">
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
                  onClick={() => copy(url, 'URL copied')}
                  aria-label="Copy URL"
                  title="Copy URL"
                  className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 bg-themeblue2/8 text-primary"
                >
                  <Copy size={12} />
                </button>
              </div>
              {/* Zero reachable devices is legitimate — a line may be scoped ahead of
                  the roster — but it is silent from the outside, so it has to be loud
                  here. Nothing escalates to a wider audience on its own. */}
              {line.reachable_devices === 0 && (
                <p className="text-[9pt] text-themeredred mt-2">
                  Reaches no one with a device — outside contact on this line goes nowhere.
                </p>
              )}
            </div>
            <div className="bg-white rounded-lg p-1.5 shrink-0">
              <canvas ref={qrSetter} className="w-16 h-16 rounded" />
            </div>
          </div>
        </div>

        {/* What stays on the card is what a supervisor acts on WHILE the line is
            live: who is on duty, and what an unanswered caller hears. The channel
            switches moved into Routing — they are set once when the line is stood
            up, and they belong beside the allotment they route to.

            Both rows stay MOUNTED and collapse via the grid-rows [0fr]→[1fr] trick
            rather than unmounting, which used to repaint the whole card. */}
        <div
          aria-hidden={!rosterShown}
          className={`grid transition-all duration-300 ease-out ${
            rosterShown ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          <div className="overflow-hidden">
            {/* Duty is read through THIS line's scope, not the cluster — the push
                fan intersects clinics.oncall with the scope before it rings. Text
                messaging pings the same roster, so it counts as duty too. */}
            <LineOncallRow
              credentialId={line.id}
              label="On-call"
              memberCount={line.scope_members_count}
              oncallCount={line.oncall_count}
              divided
              onChanged={onChanged}
            />
          </div>
        </div>

        {showCallChannel && (
          <div
            aria-hidden={!oncallEnabled}
            className={`grid transition-all duration-300 ease-out ${
              oncallEnabled ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            <div className="overflow-hidden">
              <OncallGreetingRow
                credentialId={line.id}
                initialDur={line.oncall_greeting_dur ?? null}
                onChanged={onChanged}
              />
            </div>
          </div>
        )}
      </SectionCard>

      <OverlayActionMenu
        items={[
          {
            key: 'edit',
            label: 'Edit',
            icon: Pencil,
            onAction: () => {
              setFormError(null)
              setDraftName(line.name)
              draftScope.current = {
                scopeMode: line.scope_mode,
                subClusters: line.scope_sub_clusters,
                members: line.scope_members,
              }
              if (cardRef.current) setEditAnchor(cardRef.current.getBoundingClientRect())
            },
          },
          { key: 'rotate-passcode', label: 'Rotate passcode', icon: RefreshCw, onAction: () => setConfirmRotatePasscode(true) },
          {
            key: 'rotate-passphrase',
            label: 'Rotate passphrase',
            icon: KeyRound,
            onAction: () => {
              setFormError(null); setRotPass1(''); setRotPass2('')
              if (cardRef.current) setRotatePassphraseAnchor(cardRef.current.getBoundingClientRect())
            },
          },
          { key: 'kill', label: 'Kill line', icon: Trash2, destructive: true, onAction: () => setConfirmKill(true) },
        ]}
      />

      {error && <p className="text-[10pt] text-themeredred mt-2">{error}</p>}

      {/* ── Edit: everything about the line that isn't a credential ──────
           Name, the channels it opens, and the allotment those channels route
           to — one decision in three sections, because a channel with no
           allotment behind it answers and reaches nobody. The switches write
           immediately (one RPC each, like every other settings toggle); Save
           applies name + allotment. */}
      <PreviewOverlay
        isOpen={!!editAnchor}
        onClose={() => { setEditAnchor(null); setFormError(null) }}
        anchorRect={editAnchor}
        title="Edit"
        maxWidth={360}
        rightFooter={
          <FooterPill side="right">
            <ActionButton
              icon={Check}
              label="Save"
              variant={busy || draftName.trim().length === 0 ? 'disabled' : 'confirm'}
              onClick={onEditConfirm}
            />
          </FooterPill>
        }
      >
        <div className="px-3 pt-2">
          <PageSectionHeader>Name</PageSectionHeader>
          <TextInput
            value={draftName}
            onChange={setDraftName}
            placeholder="SD phone"
            ariaLabel="Line name"
          />
        </div>

        <div className="px-3 pt-4">
          <PageSectionHeader>Channels</PageSectionHeader>
        </div>
        <div className="mx-3 rounded-xl bg-themewhite2 overflow-hidden">
          {/* Intake also reaches HQ supervisors regardless of allotment — a
              squad-scoped line with no supervisor would otherwise drop the
              request silently. */}
          <SettingsToggleRow
            icon={CalendarPlus}
            label="Event requests"
            subtitle={intakeEnabled
              ? 'Outside parties can request event coverage'
              : 'Outside parties cannot submit event requests'}
            checked={intakeEnabled}
            onChange={() => void toggleChannel('intake_enabled', intakeEnabled, setLineIntakeEnabled)}
            disabled={channelBusy === 'intake_enabled'}
            activeColor="text-themeblue3"
            activeBg="bg-themeblue3/15"
          />

          {showCallChannel && (
            <SettingsToggleRow
              icon={Headset}
              label="Calls"
              subtitle={oncallEnabled
                ? 'Outside callers can ring whoever is on duty'
                : 'Outside callers cannot request a live call'}
              checked={oncallEnabled}
              onChange={() => void toggleChannel('oncall_enabled', oncallEnabled, setLineOncallEnabled)}
              disabled={channelBusy === 'oncall_enabled'}
              divided
              activeColor="text-themeblue3"
              activeBg="bg-themeblue3/15"
            />
          )}

          <SettingsToggleRow
            icon={MessageSquare}
            label="Text messaging"
            subtitle={messageEnabled
              ? 'Outside senders can drop a sealed one-way note to this line'
              : 'Outside senders cannot message this line'}
            checked={messageEnabled}
            onChange={() => void toggleChannel('outside_message_enabled', messageEnabled, setLineMessageEnabled)}
            disabled={channelBusy === 'outside_message_enabled'}
            divided
            activeColor="text-themeblue3"
            activeBg="bg-themeblue3/15"
          />

          {/* Outbound is medic-initiated and NOT line-routed: any line permitting
              it opens the compose surface for the whole cluster, so the allotment
              below does not narrow it. */}
          <SettingsToggleRow
            icon={Send}
            label="Outbound contact"
            subtitle={outboundEnabled
              ? 'Members can email a secure 1:1 invite to an outside recipient'
              : 'Members cannot start outbound outside contact'}
            checked={outboundEnabled}
            onChange={() => void toggleChannel('outbound_enabled', outboundEnabled, setLineOutboundEnabled)}
            disabled={channelBusy === 'outbound_enabled'}
            divided
            activeColor="text-themeblue3"
            activeBg="bg-themeblue3/15"
          />
        </div>

        <div className="px-3 pt-4">
          <PageSectionHeader>Routing</PageSectionHeader>
        </div>
        <IntakeLineScopeEditor
          initial={{
            scopeMode: line.scope_mode,
            subClusters: line.scope_sub_clusters,
            members: line.scope_members,
          }}
          subClusters={subClusters}
          onChange={(next) => { draftScope.current = next }}
        />
        {formError && <p className="text-[10pt] text-themeredred px-4 pb-2">{formError}</p>}
      </PreviewOverlay>

      {/* ── Rotate passphrase ───────────────────────────────────── */}
      <PreviewOverlay
        isOpen={!!rotatePassphraseAnchor}
        onClose={() => { setRotatePassphraseAnchor(null); setFormError(null) }}
        anchorRect={rotatePassphraseAnchor}
        title="Rotate passphrase"
        maxWidth={360}
        footer={
          <FooterPill>
            <ActionButton
              icon={Dices}
              label="Random"
              onClick={() => {
                const p = generatePassphrase()
                setRotPass1(p); setRotPass2(p); setFormError(null)
              }}
            />
          </FooterPill>
        }
        rightFooter={
          <FooterPill side="right">
            <ActionButton
              icon={Check}
              label="Rotate"
              variant={busy ? 'disabled' : 'confirm'}
              onClick={onRotatePassphraseConfirm}
            />
          </FooterPill>
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
        subtitle="This line's current QR will stop working — reprint your poster before redistributing. Other lines are unaffected."
        confirmLabel="Rotate"
        variant="warning"
        processing={busy}
        onConfirm={onRotatePasscode}
        onCancel={() => setConfirmRotatePasscode(false)}
      />

      <ConfirmDialog
        visible={confirmKill}
        title="Kill line?"
        subtitle="This deletes the QR and the passphrase for this line only. Re-establishing it requires minting a new line and redistributing the new passphrase."
        confirmLabel="Kill"
        variant="danger"
        processing={busy}
        onConfirm={onKill}
        onCancel={() => setConfirmKill(false)}
      />
    </div>
  )
}
