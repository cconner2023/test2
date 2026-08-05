import { useState, useEffect, useCallback, useRef } from 'react'
import { Check, Inbox, Dices } from 'lucide-react'
import { useAuth } from '../../Hooks/useAuth'
import { useBetaBypass } from '../../lib/betaFeatures'
import { useSubClusters } from '../../Hooks/useSubClusters'
import { FooterPill } from '@/Components/primitives/FooterPill'
import { EmptyState } from '@/Components/primitives/EmptyState'
import { ActionButton } from '@/Components/primitives/ActionButton'
import { PreviewOverlay } from '../PreviewOverlay'
import { TextInput } from '@/Components/primitives/FormInputs'
import { validatePasswordComplexity } from '../../lib/constants'
import { generatePassphrase } from '../../lib/intakePassphrase'
import {
  mintIntakeLine,
  listIntakeLines,
  type IntakeLine,
  type IntakeLineScope,
} from '../../lib/eventIntakeService'
import { getWarmLines, setWarmLines } from '../../lib/messagingSettingsWarm'
import { PageSectionHeader } from '@/Components/primitives/Section'
import { IntakeLineCard } from './IntakeLineCard'
import { IntakeLineScopeEditor } from './IntakeLineScopeEditor'

interface IntakeMintSectionProps {
  clinicId: string
  /** Fired after every reconcile. The member-facing duty list is a separate read of
   *  the same lines, so it has to follow a channel toggle here — and a boolean
   *  "is any channel on" would not fire when the second line flips. */
  onLinesChanged?: () => void
}

/**
 * Openers published by the mounted section(s), most recent last.
 *
 * The add action belongs on the CONTAINER header — the Settings pane header, or the
 * messaging-settings sheet — and this section sits two components below both of
 * them. Threading a signal prop down each chain (Settings → ClinicPanel → here,
 * MessagesDrawer → MessagingOncallSettings → here) would put clinic-line state in
 * two panels that have no other reason to hold it. The header calls the opener
 * instead; whichever surface mounted last is the one on screen, so it answers.
 */
const mintOpeners: Array<() => void> = []

/** Open the mint overlay on whichever outside-contact section is currently mounted.
 *  No-ops when none is (non-supervisor, or the panel is not open). */
export function openIntakeLineMint(): void {
  mintOpeners[mintOpeners.length - 1]?.()
}

/**
 * Outside-contact LINES for the cluster.
 *
 * A cluster used to have exactly one credential, so every outside call, message and
 * event request fanned to everyone in it — which is how line medics ended up opted
 * into HQ's on-call traffic. It now runs a list: an SD phone, a CQ phone, an HQ
 * on-call line, each its own passcode with its own routing scope. The outsider holds
 * one code and never learns the others exist.
 *
 *   Empty: EmptyState (card variant) + overlay action that mints the first line.
 *   Live : one card per line. The add action lives on the container header and
 *          reaches this section through `openIntakeLineMint`.
 *
 * Minting asks for the routing scope up front and does NOT default to cluster-wide:
 * with several lines in play, "unset means everyone" is how a new line silently
 * reaches the whole battalion.
 */
export function IntakeMintSection({ clinicId, onLinesChanged }: IntakeMintSectionProps) {
  const { isSupervisorRole } = useAuth()
  const outsideCallBeta = useBetaBypass('outsideCall')
  const { subClusters } = useSubClusters()

  // Seed from the warm cache so a pre-warmed open paints immediately. `undefined`
  // = cache miss → show the loading gate; a cached value (including an empty list)
  // means we already know the lines and skip the blank frame.
  const [lines, setLines] = useState<IntakeLine[]>(() => getWarmLines(clinicId) ?? [])
  const [loading, setLoading] = useState(() => getWarmLines(clinicId) === undefined)
  const [busy, setBusy] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const [mintOpen, setMintOpen] = useState(false)
  const [mintAnchor, setMintAnchor] = useState<DOMRect | null>(null)
  const [mintName, setMintName] = useState('')
  const [mintPass1, setMintPass1] = useState('')
  const [mintPass2, setMintPass2] = useState('')
  // A fresh line starts scoped to no sub-units at all, so the supervisor has to say
  // who it reaches. One tap on "Whole cluster" restores the old behavior explicitly.
  const mintScope = useRef<IntakeLineScope>({ scopeMode: 'sub_clusters', subClusters: [], members: [] })

  // `silent` reconciles in place without flipping `loading` — toggles and greeting
  // saves use it so the cards never unmount (`if (loading) return null` below),
  // which is what caused the whole-card repaint glitch on toggle.
  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await listIntakeLines(clinicId)
      if (res.ok) {
        setLines(res.data)
        setWarmLines(clinicId, res.data)
        setLoadError(null)
        onLinesChanged?.()
      } else {
        setLoadError(res.error)
        setLines([])
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [clinicId, onLinesChanged])

  // Reconcile on mount. When the cache was already warm, do it SILENTLY (no loading
  // flip) so the seeded cards never blank; a cold mount loads loudly.
  useEffect(() => {
    const warm = getWarmLines(clinicId)
    if (warm !== undefined) setLines(warm ?? [])
    void refresh(warm !== undefined)
  }, [refresh, clinicId])

  /** Optimistic per-line patch — keeps a toggle's animation off the network. */
  const patchLine = useCallback((id: string, patch: Partial<IntakeLine>) => {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  }, [])

  // `anchor` null = opened from a container header the section cannot see, so the
  // overlay centres instead of growing out of a rect (same as messaging settings).
  const openMint = useCallback((anchor: HTMLElement | null, name: string) => {
    setFormError(null)
    setMintName(name)
    setMintPass1('')
    setMintPass2('')
    mintScope.current = { scopeMode: 'sub_clusters', subClusters: [], members: [] }
    setMintAnchor(anchor ? anchor.getBoundingClientRect() : null)
    setMintOpen(true)
  }, [])

  const closeMint = useCallback(() => { setMintOpen(false); setMintAnchor(null); setFormError(null) }, [])

  // Publish the opener for the container header. LIFO: the section that mounted
  // most recently is the visible one.
  useEffect(() => {
    const open = () => openMint(null, '')
    mintOpeners.push(open)
    return () => {
      const i = mintOpeners.indexOf(open)
      if (i >= 0) mintOpeners.splice(i, 1)
    }
  }, [openMint])

  const fillMint = useCallback(() => {
    const p = generatePassphrase()
    setMintPass1(p); setMintPass2(p); setFormError(null)
  }, [])

  const onMintConfirm = useCallback(async () => {
    setBusy(true)
    try {
      if (mintName.trim().length === 0) { setFormError('Name the line'); return }
      const complaint = validatePasswordComplexity(mintPass1)
      if (complaint) { setFormError(complaint); return }
      if (mintPass1 !== mintPass2) { setFormError('Passphrases do not match'); return }
      const res = await mintIntakeLine(clinicId, {
        name: mintName.trim(),
        passphrase: mintPass1,
        scope: mintScope.current,
      })
      if (!res.ok) { setFormError(res.error); return }
      // No inbound key to provision — outside calls/messages/voicemail ride the
      // edge-authored E2E envelope (the AES key travels inside it), so the line is
      // the only thing minted here.
      setFormError(null)
      closeMint()
      await refresh()
    } finally {
      setBusy(false)
    }
  }, [mintName, mintPass1, mintPass2, clinicId, closeMint, refresh])

  if (!isSupervisorRole && !outsideCallBeta) return null
  if (loading) return null

  return (
    <section>
      <PageSectionHeader>Outside contact</PageSectionHeader>

      {/* ── Empty state ─────────────────────────────────────────── */}
      {lines.length === 0 && (
        <>
          {loadError && <p className="text-[10pt] text-tertiary px-1 pb-2">{loadError}</p>}
          {!loadError && (
            <EmptyState
              title="No outside-contact lines"
              action={{
                icon: Inbox,
                label: 'Mint a line',
                onClick: (anchor) => openMint(anchor, 'Main'),
              }}
            />
          )}
        </>
      )}

      {/* ── One card per line ───────────────────────────────────── */}
      {lines.length > 0 && (
        <div className="space-y-3">
          {lines.map((line) => (
            <IntakeLineCard
              key={line.id}
              line={line}
              subClusters={subClusters}
              showCallChannel={outsideCallBeta}
              onPatch={patchLine}
              onChanged={() => void refresh(true)}
              onRemoved={() => void refresh()}
            />
          ))}
        </div>
      )}

      {loadError && lines.length > 0 && (
        <p className="text-[10pt] text-themeredred mt-2">{loadError}</p>
      )}

      {/* ── Mint flow ─────────────────────────────────────────────
           Same sections, same order as the card's Edit overlay, so creating and
           editing a line read as one surface. Two differences, both structural:
           PASSPHRASE only exists here (it is set once at mint and afterwards only
           rotated, from the ⋯ menu), and CHANNELS is absent because the line does
           not exist yet to carry the flags — a fresh line lands on the server
           defaults and the card's Edit opens on them. */}
      <PreviewOverlay
        isOpen={mintOpen}
        onClose={closeMint}
        anchorRect={mintAnchor}
        title="Mint a line"
        maxWidth={360}
        footer={
          <FooterPill>
            <ActionButton icon={Dices} label="Random" onClick={fillMint} />
          </FooterPill>
        }
        rightFooter={
          <FooterPill side="right">
            <ActionButton
              icon={Check}
              label="Mint"
              variant={busy || mintName.trim().length === 0 ? 'disabled' : 'confirm'}
              onClick={onMintConfirm}
            />
          </FooterPill>
        }
      >
        <div className="px-3 pt-2">
          <PageSectionHeader>Name</PageSectionHeader>
          <TextInput
            value={mintName}
            onChange={setMintName}
            placeholder="SD phone"
            ariaLabel="Line name"
          />
        </div>

        <div className="px-3 pt-4">
          <PageSectionHeader>Passphrase</PageSectionHeader>
        </div>
        <div className="px-3 space-y-2">
          <TextInput
            value={mintPass1}
            onChange={setMintPass1}
            placeholder="Passphrase"
            ariaLabel="Passphrase"
            hint={mintPass1.length > 0 ? validatePasswordComplexity(mintPass1) : null}
          />
          <TextInput
            value={mintPass2}
            onChange={setMintPass2}
            placeholder="Confirm passphrase"
            ariaLabel="Confirm passphrase"
            hint={mintPass2.length > 0 && mintPass1 !== mintPass2 ? 'Passphrases do not match' : null}
          />
        </div>

        <div className="px-3 pt-4">
          <PageSectionHeader>Routing</PageSectionHeader>
        </div>
        <IntakeLineScopeEditor
          initial={{ scopeMode: 'sub_clusters', subClusters: [], members: [] }}
          subClusters={subClusters}
          onChange={(next) => { mintScope.current = next }}
        />
        {formError && <p className="text-[10pt] text-themeredred px-4 pb-2">{formError}</p>}
      </PreviewOverlay>
    </section>
  )
}
