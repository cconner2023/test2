import { useState, useRef, useCallback, useEffect } from 'react'
import type { RefObject } from 'react'
import { QrCode, Mail, Hash, Send } from 'lucide-react'
import { ActionPill } from '../primitives/ActionPill'
import { ActionButton } from '../primitives/ActionButton'
import { TextInput } from '../primitives/FormInputs'
import { useBarcodeScanner } from '../../Hooks/useBarcodeScanner'
import { supabase } from '../../lib/supabase'
import { fetchProfileById } from '../../lib/peerLookup'
import { useMessagingStore } from '../../stores/useMessagingStore'
import type { StackNav, StackScreen } from '../stackNav'
import type { ClinicMedic } from '../../Types/SupervisorTestTypes'

/**
 * useOffRosterAdd — THE shared "add a person who isn't on the cluster roster" drill.
 *
 * Off-roster lookup (Scan QR / Find by Email / Enter User Code) was hand-rolled
 * identically in the New Message/New Group builder AND the group Add-member flow.
 * This hook owns that once: the lookup state, the search_users/fetchProfileById/QR
 * plumbing, and the three leaf StackScreens plus their method-picker screen. Callers
 * spread `screens` into their OverlayStack/SheetStack `screens` map and drill into it
 * via `openMethods(nav)` — so the methods MORPH the host card, they never nest.
 *
 * The caller stays in charge of the roster list and of what a found user MEANS
 * (`onFound` — open a chat, add to a group selection, add a member). On a successful
 * find this hook resolves the peer profile, tears its own state down, calls onFound,
 * then resets the stack to root.
 */
export interface OffRosterAddOptions {
  /** Shared nav ref of the host OverlayStack/SheetStack (used to reset after a find). */
  navRef: RefObject<StackNav | null>
  /** What a discovered user means to the caller (open chat / add to selection / add member). */
  onFound: (medic: ClinicMedic) => void
  /** Reject a user already present (already in the group / already selected). */
  isPresent?: (id: string) => boolean
  /** Message shown when `isPresent` rejects (default "Already added"). */
  presentMessage?: string
  /** Title of the method-picker screen (default "Add Contact"). */
  methodsTitle?: string
}

type SearchUserRow = {
  id: string
  email?: string | null
  first_name: string | null
  last_name: string | null
  middle_initial: string | null
  rank: string | null
  credential: string | null
  avatar_id: string | null
  clinic_id: string | null
  clinic_name: string | null
}

function medicFromRow(row: SearchUserRow): ClinicMedic {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    middleInitial: row.middle_initial,
    rank: row.rank,
    credential: row.credential,
    avatarId: row.avatar_id ?? null,
    clinicId: row.clinic_id ?? undefined,
    clinicName: row.clinic_name ?? undefined,
  }
}

export interface OffRosterAdd {
  /** Spread into the host `screens` map. Keys: addmethods, addqr, addemail, addcode. */
  screens: Record<string, StackScreen>
  /** Drill into the method picker (Scan QR / Email / Code) from a footer or row. */
  openMethods: (nav: StackNav) => void
  /** Tear down lookup state (call from the host overlay's onClose). */
  reset: () => void
}

export function useOffRosterAdd({
  navRef,
  onFound,
  isPresent,
  presentMessage = 'Already added',
  methodsTitle = 'Add Contact',
}: OffRosterAddOptions): OffRosterAdd {
  const videoRef = useRef<HTMLVideoElement>(null)
  const qrActiveRef = useRef(false)
  const {
    isScanning, error: scanError, result: scanResult,
    startScanning, stopScanning, clearResult,
  } = useBarcodeScanner()

  const [qrError, setQrError] = useState<string | null>(null)
  const [emailValue, setEmailValue] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [emailLoading, setEmailLoading] = useState(false)
  const [codeValue, setCodeValue] = useState('')
  const [codeError, setCodeError] = useState<string | null>(null)
  const [codeLoading, setCodeLoading] = useState(false)

  const reset = useCallback(() => {
    qrActiveRef.current = false
    stopScanning()
    clearResult()
    setQrError(null)
    setEmailValue(''); setEmailError(null); setEmailLoading(false)
    setCodeValue(''); setCodeError(null); setCodeLoading(false)
  }, [stopScanning, clearResult])

  // Resolve → hand to the caller → return the host card to its root screen.
  const finish = useCallback((medic: ClinicMedic) => {
    useMessagingStore.getState().setPeerProfile(medic)
    reset()
    onFound(medic)
    navRef.current?.reset()
  }, [reset, onFound, navRef])

  const handleEmailLookup = useCallback(async () => {
    const email = emailValue.trim().toLowerCase()
    setEmailError(null)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Enter a valid email address')
      return
    }
    setEmailLoading(true)
    try {
      const { data, error } = await supabase.rpc('search_users', { query: email })
      if (error || !data) { setEmailError('Lookup failed'); return }
      const match = (data as SearchUserRow[]).find(r => r.email?.toLowerCase() === email)
      if (!match) { setEmailError('No user found with that email'); return }
      if (isPresent?.(match.id)) { setEmailError(presentMessage); return }
      finish(medicFromRow(match))
    } catch {
      setEmailError('Lookup failed')
    } finally {
      setEmailLoading(false)
    }
  }, [emailValue, isPresent, presentMessage, finish])

  const handleCodeLookup = useCallback(async () => {
    const code = codeValue.trim()
    setCodeError(null)
    if (!code) { setCodeError('Enter a user code'); return }
    setCodeLoading(true)
    try {
      const medic = await fetchProfileById(code)
      if (!medic) { setCodeError('No user found with that code'); return }
      if (isPresent?.(medic.id)) { setCodeError(presentMessage); return }
      finish(medic)
    } catch {
      setCodeError('Lookup failed')
    } finally {
      setCodeLoading(false)
    }
  }, [codeValue, isPresent, presentMessage, finish])

  // QR result → resolve the scanned id. Gated on qrActiveRef so a stale result from
  // a previous scan can't fire once we've left the QR screen.
  useEffect(() => {
    if (!scanResult || !qrActiveRef.current) return
    const uid = scanResult.trim()
    setQrError(null)
    fetchProfileById(uid).then(medic => {
      if (!medic) { setQrError('User not found'); clearResult(); return }
      if (isPresent?.(medic.id)) { setQrError(presentMessage); clearResult(); return }
      finish(medic)
    })
  }, [scanResult, isPresent, presentMessage, clearResult, finish])

  const methodRows = useCallback((nav: StackNav) => {
    const rows: Array<{ key: string; label: string; icon: typeof QrCode; onClick: () => void }> = [
      {
        key: 'qr', label: 'Scan QR Code', icon: QrCode,
        onClick: () => {
          setQrError(null)
          qrActiveRef.current = true
          nav.push('addqr')
          requestAnimationFrame(() => { if (videoRef.current) startScanning(videoRef.current) })
        },
      },
      {
        key: 'email', label: 'Find by Email', icon: Mail,
        onClick: () => { setEmailValue(''); setEmailError(null); nav.push('addemail') },
      },
      {
        key: 'code', label: 'Enter User Code', icon: Hash,
        onClick: () => { setCodeValue(''); setCodeError(null); nav.push('addcode') },
      },
    ]
    return (
      <div className="py-1">
        {rows.map(row => (
          <button
            key={row.key}
            onClick={row.onClick}
            className="flex items-center w-full px-4 py-2.5 gap-3 text-left hover:bg-themewhite2 active:scale-95 transition-all"
          >
            <div className="w-8 h-8 rounded-full bg-themewhite2 flex items-center justify-center shrink-0">
              <row.icon className="w-4 h-4 text-themeblue2" />
            </div>
            <span className="flex-1 text-sm text-primary">{row.label}</span>
          </button>
        ))}
      </div>
    )
  }, [startScanning])

  const findFooter = (onFind: () => void, disabled: boolean) => (
    <ActionPill>
      <ActionButton
        icon={Send}
        label="Find User"
        variant={disabled ? 'disabled' : 'default'}
        onClick={onFind}
      />
    </ActionPill>
  )

  const screens: Record<string, StackScreen> = {
    addmethods: {
      title: methodsTitle,
      render: (_p, nav) => methodRows(nav),
    },
    addqr: {
      title: 'Scan QR Code',
      onBack: (nav) => { reset(); nav.pop() },
      render: () => (
        <div className="px-4 py-3 space-y-2">
          <p className="text-[10pt] text-tertiary">Scan a user's QR code to add them.</p>
          <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black/5 border border-tertiary/10">
            <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted />
            {!isScanning && !scanError && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-[10pt] text-tertiary">Starting camera…</p>
              </div>
            )}
          </div>
          {(scanError || qrError) && (
            <p className="text-[10pt] text-themeredred">{scanError || qrError}</p>
          )}
        </div>
      ),
    },
    addemail: {
      title: 'Find by Email',
      onBack: (nav) => { setEmailValue(''); setEmailError(null); nav.pop() },
      rightFooter: findFooter(handleEmailLookup, !emailValue.trim() || emailLoading),
      render: () => (
        <div className="px-1 py-1">
          <TextInput
            label="Email"
            value={emailValue}
            onChange={(v) => { setEmailValue(v); if (emailError) setEmailError(null) }}
            placeholder="user@example.com"
            type="email"
            inputMode="email"
            hint={emailLoading ? 'Looking up email…' : emailError}
          />
        </div>
      ),
    },
    addcode: {
      title: 'Enter User Code',
      onBack: (nav) => { setCodeValue(''); setCodeError(null); nav.pop() },
      rightFooter: findFooter(handleCodeLookup, !codeValue.trim() || codeLoading),
      render: () => (
        <div className="px-1 py-1">
          <TextInput
            label="User Code"
            value={codeValue}
            onChange={(v) => { setCodeValue(v); if (codeError) setCodeError(null) }}
            placeholder="Paste user code"
            hint={codeLoading ? 'Looking up user…' : codeError}
          />
        </div>
      ),
    },
  }

  const openMethods = useCallback((nav: StackNav) => {
    setQrError(null)
    setEmailValue(''); setEmailError(null)
    setCodeValue(''); setCodeError(null)
    nav.push('addmethods')
  }, [])

  return { screens, openMethods, reset }
}
