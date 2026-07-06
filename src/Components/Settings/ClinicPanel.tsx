import { useState, useRef, useCallback, useEffect, useMemo, type ReactNode } from 'react'
import {
  Building2,
  Camera,
  ImagePlus,
  Check,
  Plus,
  Trash2,
  Loader2,
  Copy,
  Share2,
  ArrowLeftRight,
} from 'lucide-react'
import bwipjs from 'bwip-js'
import { useAuth } from '../../Hooks/useAuth'
import { ErrorPill } from '@/Components/primitives/ErrorPill'
import { useClinicInvites } from '../../Hooks/useClinicInvites'
import { useBarcodeScanner } from '../../Hooks/useBarcodeScanner'
import { useClinicMedics } from '../../Hooks/useClinicMedics'
import { useClinicLoans } from '../../Hooks/useClinicLoans'
import { LoadingOverlay } from '@/Components/primitives/LoadingOverlay'
import {
  updateSupervisorClinic,
  disassociateClinic,
  getClinicEncryptionKey,
  getClinicDetails,
  removeSoldierFromClinic,
  endLoanFromClinic,
} from '../../lib/supervisorService'
import { getAssociatedClinicCode } from '../../lib/clinicAssociationService'
// listLocations is an authenticated read of the canonical post taxonomy;
// it lives in adminService for now but is safe for any signed-in caller.
import { listLocations, type AdminLocation } from '../../lib/adminService'
import { invalidate } from '../../stores/useInvalidationStore'
import { SubClusterManager } from '../SubClusterManager'
import { useSubClusters } from '../../Hooks/useSubClusters'
import { createSubCluster, renameSubCluster, deleteSubCluster } from '../../lib/subClusterService'
import { ErrorDisplay } from '@/Components/primitives/ErrorDisplay'
import { UserAvatar } from './UserAvatar'
import { IntakeMintSection } from './IntakeMintSection'
import { ToggleSwitch } from './ToggleSwitch'
import { supabase } from '../../lib/supabase'
import { toggleOncallPresence } from '../../lib/oncallService'
import { PreviewOverlay } from '../PreviewOverlay'
import { ActionButton } from '@/Components/primitives/ActionButton'
import { OverlayActionMenu } from '@/Components/primitives/OverlayActionMenu'
import type { ContextMenuItem } from '@/Components/primitives/ContextMenu'
import { ConfirmDialog } from '@/Components/primitives/ConfirmDialog'
import { ActionPill } from '@/Components/primitives/ActionPill'
import { ClinicIdentityEditPopover } from '../ClinicAdmin/ClinicIdentityEditPopover'
import { MemberEditPopover } from '../ClinicAdmin/MemberEditPopover'
import { AddMemberPopover } from '../ClinicAdmin/AddMemberPopover'
import { SwipeToDeleteRow } from '@/Components/primitives/SwipeToDeleteRow'


interface ClinicPanelProps {
  clinicEditing: boolean
  onEditingChange: (editing: boolean) => void
  saveRequested: boolean
  onSaveComplete: () => void
  deleteSelection: Set<string>
  onDeleteSelectionChange: (s: Set<string>) => void
  addingMember: boolean
  onAddingMemberChange: (v: boolean) => void
  onPendingChangesChange?: (hasPending: boolean) => void
}

export function ClinicPanel({
  clinicEditing,
  onEditingChange,
  saveRequested,
  onSaveComplete,
  deleteSelection,
  onDeleteSelectionChange,
  addingMember,
  onAddingMemberChange,
  onPendingChangesChange,
}: ClinicPanelProps) {
  const { user, clinicId: assignedClinicId, surrogateClinicIds, supervisingClinicId, profile, isSupervisorRole, setSupervisingClinic } = useAuth()
  // The supervisor toggle picks which clinic this panel administers. For
  // single-clinic users it stays equal to the assigned clinic. All clinic-
  // scoped reads, writes, and labels below resolve through `clinicId` and
  // `clinicName` so the toggle just flips the pointer.
  const clinicId = supervisingClinicId ?? assignedClinicId
  const isSurrogateContext = !!clinicId && surrogateClinicIds.includes(clinicId)
  const clinicName = clinicId && surrogateClinicIds.includes(clinicId)
    ? (profile.surrogateClinics?.find((c) => c.id === clinicId)?.name ?? null)
    : (profile.clinicName ?? null)
  const {
    error: hookError,
    activeCode,
    redeemInvite,
  } = useClinicInvites()
  const {
    isScanning,
    error: scanError,
    result: scanResult,
    startScanning,
    stopScanning,
    clearResult,
  } = useBarcodeScanner()

  // QR canvas
  const [copied, setCopied] = useState(false)

  // Cluster-context switcher (loaned supervisors). With exactly one alternative
  // cluster, the pill button flips supervisingClinicId directly. With more, it
  // opens a list. The pill is the only entry point — no global affordance.
  const clusterSwitchBtnRef = useRef<HTMLDivElement>(null)
  const [clusterSwitchAnchor, setClusterSwitchAnchor] = useState<DOMRect | null>(null)
  const clusterOptions = useMemo(() => {
    if (!isSupervisorRole || !assignedClinicId) return [] as { id: string; name: string }[]
    const loans = profile.surrogateClinics ?? []
    return [
      { id: assignedClinicId, name: profile.clinicName ?? 'Assigned' },
      ...surrogateClinicIds.map((id) => ({
        id,
        name: loans.find((c) => c.id === id)?.name ?? 'Surrogate',
      })),
    ]
  }, [isSupervisorRole, assignedClinicId, surrogateClinicIds, profile.clinicName, profile.surrogateClinics])
  const handleClusterSwitch = useCallback(() => {
    if (clusterOptions.length === 2) {
      const next = clusterOptions.find((c) => c.id !== clinicId) ?? clusterOptions[0]
      setSupervisingClinic(next.id)
      return
    }
    setClusterSwitchAnchor(clusterSwitchBtnRef.current?.getBoundingClientRect() ?? null)
  }, [clusterOptions, clinicId, setSupervisingClinic])

  // Clinic identity edit popover (supervisor: tap card to open)
  const clinicCardRef = useRef<HTMLDivElement>(null)
  const [clinicEditAnchor, setClinicEditAnchor] = useState<DOMRect | null>(null)

  // Add-member FAB ref + popover (Users section)
  const addMemberFabRef = useRef<HTMLDivElement>(null)
  const [addMemberAnchor, setAddMemberAnchor] = useState<DOMRect | null>(null)

  // Share QR — hidden high-res canvas drives navigator.share / clipboard.write
  const shareCanvasElRef = useRef<HTMLCanvasElement | null>(null)
  const shareCanvasRef = useCallback((canvas: HTMLCanvasElement | null) => {
    shareCanvasElRef.current = canvas
    if (!canvas || !activeCode) return
    try {
      bwipjs.toCanvas(canvas, {
        bcid: 'qrcode',
        text: activeCode,
        scale: 8,
        padding: 4,
      })
    } catch {
      // QR render failure is non-critical
    }
  }, [activeCode])

  const handleShareInviteImage = useCallback(() => {
    const canvas = shareCanvasElRef.current
    if (!canvas) return
    canvas.toBlob(async (blob) => {
      if (!blob) return
      const filename = 'clinic-invite-qr.png'
      const file = new File([blob], filename, { type: 'image/png' })
      try {
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: 'Cluster invite' })
          return
        }
      } catch {
        // user cancelled or share failed — fall through
      }
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
        return
      } catch {
        // clipboard image not supported — fall through to download
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }, 'image/png')
  }, [])

  // Clinic details
  const [clinicUics, setClinicUics] = useState<string[]>([])
  const [clinicLocation, setClinicLocation] = useState<string | null>(null)
  const [clinicLocationId, setClinicLocationId] = useState<string | null>(null)
  const [clinicAssociatedIds, setClinicAssociatedIds] = useState<string[]>([])
  const [locations, setLocations] = useState<AdminLocation[]>([])

  useEffect(() => { listLocations().then(setLocations) }, [])

  const selectedLocation = useMemo(
    () => locations.find(l => l.id === clinicLocationId) ?? null,
    [locations, clinicLocationId],
  )

  // Edit fields (legacy inline-edit path: still wired through saveRequested → handleSave)
  const [editName, setEditName] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [editUics, setEditUics] = useState('')

  // Save state
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Members. Assigned roster comes from useClinicMedics (RPC-backed); the
  // loaned-in list is a separate query against profile_clinic_loans so that
  // every active loan to this clinic shows up, not just the oldest one
  // dual-written into profiles.surrogate_clinic_id.
  const { medics, loading: medicsLoading, refresh: refreshMedics } = useClinicMedics()
  const { medics: loanedInRaw } = useClinicLoans(clinicId)
  // Sub-cluster (platoon/squad) management — own primary clinic only. The
  // create/rename/delete RPCs target the caller's primary clinic, so this is
  // hidden in a surrogate (loaned) context. See v2/supervisor sub-cluster drawer.
  const { subClusters } = useSubClusters()
  const assignedMembers = useMemo(
    () => medics.filter((m) => !m.clinicId || m.clinicId === clinicId),
    [medics, clinicId],
  )
  const loanedInMembers = useMemo(
    () => loanedInRaw.filter((m) => m.clinicId !== clinicId),
    [loanedInRaw, clinicId],
  )
  const members = useMemo(
    () => [...assignedMembers, ...loanedInMembers],
    [assignedMembers, loanedInMembers],
  )

  // ─── Outside on-call roster (GATE 3) ───────────────────────────────
  // GATE-2 "allow calls" AND "allow text messaging" live on the intake card
  // (IntakeMintSection); it reports up via onOncallEnabledChange whether EITHER is
  // on (both ping clinics.oncall). While relevant, each personnel row gets a
  // per-member on-call toggle. clinics.oncall is the live roster (public SELECT);
  // writes go through the SECURITY DEFINER toggle_oncall_presence RPC.
  const [oncallRosterShown, setOncallRosterShown] = useState(false)
  const [oncall, setOncall] = useState<string[]>([])
  const [oncallPending, setOncallPending] = useState<string | null>(null)

  const loadOncallRoster = useCallback(async () => {
    if (!clinicId) { setOncall([]); return }
    const { data } = await supabase.from('clinics').select('oncall').eq('id', clinicId).maybeSingle()
    setOncall(((data as { oncall?: string[] } | null)?.oncall) ?? [])
  }, [clinicId])

  useEffect(() => { void loadOncallRoster() }, [loadOncallRoster])

  const toggleMemberOncall = useCallback(async (userId: string) => {
    if (!clinicId || oncallPending) return
    const isOn = oncall.includes(userId)
    setOncallPending(userId)
    setOncall((prev) => (isOn ? prev.filter((id) => id !== userId) : [...prev, userId])) // optimistic
    const res = await toggleOncallPresence(clinicId, userId, !isOn)
    if (!res.ok) await loadOncallRoster() // revert to server truth on failure
    setOncallPending(null)
  }, [clinicId, oncallPending, oncall, loadOncallRoster])

  // Roster row — tap the identity area to open the edit popover; when "allow
  // calls" is on, a trailing per-member on-call toggle is appended (kept a
  // sibling of the popover trigger to avoid nesting interactive elements).
  const renderMemberRow = (member: (typeof members)[number], subtitle: string, badge: ReactNode) => {
    const isOn = oncall.includes(member.id)
    return (
      <SwipeToDeleteRow
        key={member.id}
        className="rounded-lg"
        onDelete={() => setRemoveMemberTarget(member)}
        disabled={member.id === user?.id}
      >
      <div className="w-full flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-secondary/5 transition-all">
        <button
          type="button"
          onClick={(e) => openMemberPopover(member.id, e.currentTarget)}
          className="flex items-center gap-3 flex-1 min-w-0 text-left active:scale-95 transition-transform"
        >
          <UserAvatar
            avatarId={member.avatarId}
            avatarBlob={member.avatarBlob}
            userId={member.id}
            firstName={member.firstName}
            lastName={member.lastName}
            className="w-8 h-8"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate text-primary">
              {member.rank && <span>{member.rank} </span>}
              {member.lastName}, {member.firstName}
              {member.middleInitial ? ` ${member.middleInitial}.` : ''}
            </p>
            <p className="text-[9pt] text-tertiary truncate">{subtitle}</p>
          </div>
        </button>
        {badge}
        {oncallRosterShown && (
          <button
            type="button"
            onClick={() => void toggleMemberOncall(member.id)}
            disabled={oncallPending === member.id}
            aria-label={isOn ? 'On-call' : 'Off-call'}
            className={`shrink-0 active:scale-95 transition-all ${oncallPending === member.id ? 'opacity-50' : ''}`}
          >
            <ToggleSwitch checked={isOn} />
          </button>
        )}
      </div>
      </SwipeToDeleteRow>
    )
  }

  // Associated clinic popover
  const assocFabRef = useRef<HTMLDivElement>(null)
  const [assocPopover, setAssocPopover] = useState<
    | { mode: 'info'; anchor: DOMRect; clinic: { clinicId: string; clinicName: string; uics: string[]; location: string | null } }
    | { mode: 'add'; anchor: DOMRect }
    | null
  >(null)
  const [assocSaving, setAssocSaving] = useState(false)
  const [confirmDisassociate, setConfirmDisassociate] = useState<{ clinicId: string; clinicName: string } | null>(null)
  const [assocCode, setAssocCode] = useState<string | null>(null)
  const [assocCodeLoading, setAssocCodeLoading] = useState(false)
  const [assocCodeCopied, setAssocCodeCopied] = useState(false)

  // Member popover (tap-to-edit roster row)
  const [memberPopover, setMemberPopover] = useState<{ memberId: string; anchor: DOMRect } | null>(null)

  // Swipe-to-remove target from the Users roster. Loaned-in → end the loan from
  // this clinic; otherwise remove from the cluster (mirrors MemberEditPopover).
  const [removeMemberTarget, setRemoveMemberTarget] = useState<(typeof members)[number] | null>(null)
  const [removingMember, setRemovingMember] = useState(false)
  const [removeMemberError, setRemoveMemberError] = useState<string | null>(null)

  // Join section
  const [joinCode, setJoinCode] = useState('')
  const [joinFeedback, setJoinFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null)
  const joinFeedbackTimer = useRef<ReturnType<typeof setTimeout>>(null)
  const [scanning, setScanning] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ─── Data Loading ──────────────────────────────────────────────────

  useEffect(() => {
    if (!clinicId) return
    getClinicDetails(clinicId).then((details) => {
      setClinicUics(details.uics)
      setClinicLocation(details.location)
      setClinicLocationId(details.location_id)
      setClinicAssociatedIds(details.associatedClinicIds)
    })
  }, [clinicId])


  const showJoinFeedback = useCallback((type: 'error' | 'success', message: string) => {
    if (joinFeedbackTimer.current) clearTimeout(joinFeedbackTimer.current)
    setJoinFeedback({ type, message })
    joinFeedbackTimer.current = setTimeout(() => setJoinFeedback(null), 4_000)
  }, [])

  // ─── Notify parent of pending staged changes ─────────────────────
  useEffect(() => {
    onPendingChangesChange?.(deleteSelection.size > 0)
  }, [deleteSelection.size, onPendingChangesChange])


  // ─── QR Rendering ─────────────────────────────────────────────────

  const qrCanvasRef = useCallback((canvas: HTMLCanvasElement | null) => {
    if (!canvas || !activeCode) return
    try {
      bwipjs.toCanvas(canvas, {
        bcid: 'qrcode',
        text: activeCode,
        scale: 3,
        padding: 2,
      })
    } catch {
      // QR render failure is non-critical
    }
  }, [activeCode])

  // ─── Edit state initialization (clinic identity only) ─────────────

  useEffect(() => {
    if (clinicEditing) {
      setEditName(clinicName ?? '')
      setEditLocation(clinicLocation ?? '')
      setEditUics(clinicUics.join(', '))
      setError(null)
      setSuccess(null)
    }
  }, [clinicEditing, clinicName, clinicLocation, clinicUics])

  // ─── Save trigger ─────────────────────────────────────────────────

  useEffect(() => {
    if (saveRequested) {
      handleSave()
      onSaveComplete()
    }
  }, [saveRequested]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Callbacks ────────────────────────────────────────────────────

  const handleCopy = useCallback(async () => {
    if (!activeCode) return
    await navigator.clipboard.writeText(activeCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2_000)
  }, [activeCode])

  // ─── Associated clinic popover handlers (immediate save) ──────────

  const closeAssocPopover = useCallback(() => {
    if (scanning) {
      stopScanning()
      setScanning(false)
    }
    setAssocPopover(null)
    setAssocSaving(false)
    setJoinCode('')
    setJoinFeedback(null)
  }, [scanning, stopScanning])

  const openAssocInfoPopover = useCallback((clinic: { clinicId: string; clinicName: string; uics: string[]; location: string | null }, target: HTMLElement) => {
    setAssocPopover({ mode: 'info', anchor: target.getBoundingClientRect(), clinic })
    setAssocCode(null)
    setAssocCodeCopied(false)
    setAssocCodeLoading(true)
    getAssociatedClinicCode(clinic.clinicId).then((r) => {
      setAssocCodeLoading(false)
      if (r.success) setAssocCode(r.code)
    })
  }, [])

  const handleCopyAssocCode = useCallback(async () => {
    if (!assocCode) return
    await navigator.clipboard.writeText(assocCode)
    setAssocCodeCopied(true)
    setTimeout(() => setAssocCodeCopied(false), 2_000)
  }, [assocCode])

  const openAssocAddPopover = useCallback(() => {
    if (!assocFabRef.current) return
    setAssocPopover({ mode: 'add', anchor: assocFabRef.current.getBoundingClientRect() })
    setJoinCode('')
    setJoinFeedback(null)
  }, [])

  const redeemAssocCode = useCallback(async (rawCode: string) => {
    const trimmed = rawCode.trim().toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 8)
    if (!trimmed) {
      showJoinFeedback('error', 'Invalid code')
      return
    }
    setAssocSaving(true)
    const result = await redeemInvite(trimmed)
    setAssocSaving(false)
    if (!result.success) {
      showJoinFeedback('error', result.error)
      return
    }
    invalidate('clinics')
    if (clinicId) {
      const d = await getClinicDetails(clinicId)
      setClinicAssociatedIds(d.associatedClinicIds)
    }
    refreshMedics()
    closeAssocPopover()
  }, [redeemInvite, showJoinFeedback, clinicId, refreshMedics, closeAssocPopover])

  const handleToggleScan = useCallback(() => {
    if (scanning) {
      setScanning(false)
      stopScanning()
    } else {
      setScanning(true)
      requestAnimationFrame(() => {
        if (videoRef.current) startScanning(videoRef.current)
      })
    }
  }, [scanning, startScanning, stopScanning])

  const handlePhotoUpload = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      e.target.value = ''
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/library')
        const reader = new BrowserMultiFormatReader()
        const img = document.createElement('img')
        const url = URL.createObjectURL(file)
        img.src = url
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve()
          img.onerror = () => reject(new Error('Failed to load image'))
        })
        const result = await reader.decodeFromImage(img)
        URL.revokeObjectURL(url)
        if (result) {
          await redeemAssocCode(result.getText())
        } else {
          showJoinFeedback('error', 'No code found in image')
        }
      } catch {
        showJoinFeedback('error', 'Could not read code from image')
      }
    },
    [redeemAssocCode, showJoinFeedback],
  )

  // Auto-redeem on successful scan
  useEffect(() => {
    if (!scanResult) return
    setScanning(false)
    stopScanning()
    redeemAssocCode(scanResult).finally(() => clearResult())
  }, [scanResult]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleConfirmDisassociate = useCallback(async () => {
    if (!confirmDisassociate || !clinicId) return
    setAssocSaving(true)
    const result = await disassociateClinic(clinicId, confirmDisassociate.clinicId)
    setAssocSaving(false)
    setConfirmDisassociate(null)
    if (!result.success) {
      setError(result.error)
      return
    }
    invalidate('clinics')
    const d = await getClinicDetails(clinicId)
    setClinicAssociatedIds(d.associatedClinicIds)
    refreshMedics()
    closeAssocPopover()
  }, [confirmDisassociate, clinicId, refreshMedics, closeAssocPopover])

  const handleConfirmRemoveMember = useCallback(async () => {
    if (!removeMemberTarget || !clinicId) return
    setRemovingMember(true)
    setRemoveMemberError(null)
    const r = removeMemberTarget.isLoanedIn
      ? await endLoanFromClinic(removeMemberTarget.id, clinicId)
      : await removeSoldierFromClinic(removeMemberTarget.id)
    setRemovingMember(false)
    if (!r.success) {
      setRemoveMemberError(r.error)
      return
    }
    invalidate('users', 'clinics')
    setRemoveMemberTarget(null)
    refreshMedics()
  }, [removeMemberTarget, clinicId, refreshMedics])

  const handleSave = useCallback(async () => {
    if (!clinicId) return
    if (!editName.trim()) {
      setError('Cluster name is required')
      return
    }
    setSaving(true)
    setError(null)

    // 1. Update clinic details
    const encKey = await getClinicEncryptionKey(clinicId)
    const uicsArray = editUics
      .split(',')
      .map((u) => u.trim().toUpperCase())
      .filter(Boolean)

    const detailResult = await updateSupervisorClinic(
      clinicId,
      {
        name: editName.trim(),
        location: editLocation.trim() || null,
        uics: uicsArray.length > 0 ? uicsArray : undefined,
      },
      encKey,
    )

    if (!detailResult.success) {
      setSaving(false)
      setError(detailResult.error)
      return
    }

    setClinicUics(uicsArray)
    setClinicLocation(editLocation.trim() || null)

    setSaving(false)
    invalidate('clinics')
    onEditingChange(false)
    setSuccess('Cluster updated')
    setTimeout(() => setSuccess(null), 3_000)
  }, [clinicId, editName, editLocation, editUics, onEditingChange])

  // ─── Member popover wiring (state lives in MemberEditPopover) ─────

  const openMemberPopover = useCallback((memberId: string, target: HTMLElement) => {
    setMemberPopover({ memberId, anchor: target.getBoundingClientRect() })
  }, [])

  const memberFallback = useMemo(() => {
    if (!memberPopover) return undefined
    const member = medics.find(m => m.id === memberPopover.memberId)
    if (!member) return undefined
    return {
      firstName: member.firstName ?? null,
      lastName: member.lastName ?? null,
      middleInitial: member.middleInitial ?? null,
      credential: member.credential ?? null,
      component: null,
      rank: member.rank ?? null,
      uic: null,
      roles: ['medic'] as ('medic' | 'supervisor' | 'provider')[],
      homeClinicId: member.clinicId ?? null,
      homeClinicName: member.clinicName ?? null,
    }
  }, [memberPopover, medics])

  // ─── Add Member wiring ────────────────────────────────────────────

  const openAddMemberPopover = useCallback(() => {
    if (!addMemberFabRef.current) return
    setAddMemberAnchor(addMemberFabRef.current.getBoundingClientRect())
    onAddingMemberChange(true)
  }, [onAddingMemberChange])

  const closeAddMemberPopover = useCallback(() => {
    setAddMemberAnchor(null)
    onAddingMemberChange(false)
  }, [onAddingMemberChange])

  // ─── Computed Values ──────────────────────────────────────────────

  // Derive associated clinics from the medics data (the working path)
  interface NearbyClinic { clinicId: string; clinicName: string; count: number; uics: string[]; location: string | null }
  const [nearbyDetails, setNearbyDetails] = useState<Map<string, { name: string | null; uics: string[]; location: string | null }>>(new Map())

  const nearbyClinicMap = useMemo(() => {
    const map = new Map<string, NearbyClinic>()
    // Populate from medics (gives us names + counts)
    for (const m of medics) {
      if (m.clinicId && m.clinicId !== clinicId && m.clinicName) {
        const entry = map.get(m.clinicId)
        if (entry) {
          entry.count++
        } else {
          const details = nearbyDetails.get(m.clinicId)
          map.set(m.clinicId, {
            clinicId: m.clinicId,
            clinicName: m.clinicName,
            count: 1,
            uics: details?.uics ?? [],
            location: details?.location ?? null,
          })
        }
      }
    }
    // Ensure every clinic in associated_clinic_ids appears, even with 0 medics
    for (const id of clinicAssociatedIds) {
      if (id !== clinicId && !map.has(id)) {
        const details = nearbyDetails.get(id)
        map.set(id, {
          clinicId: id,
          clinicName: details?.name ?? 'Loading...',
          count: 0,
          uics: details?.uics ?? [],
          location: details?.location ?? null,
        })
      }
    }
    return [...map.values()]
  }, [medics, clinicId, clinicAssociatedIds, nearbyDetails])

  // Fetch UIC/location for each associated clinic
  useEffect(() => {
    const ids = nearbyClinicMap.map((c) => c.clinicId).filter((id) => !nearbyDetails.has(id))
    if (ids.length === 0) return
    Promise.all(ids.map(async (id) => {
      const details = await getClinicDetails(id)
      return [id, details] as const
    })).then((results) => {
      setNearbyDetails((prev) => {
        const next = new Map(prev)
        for (const [id, details] of results) {
          next.set(id, { name: details.name, uics: details.uics, location: details.location })
        }
        return next
      })
    })
  }, [nearbyClinicMap]) // eslint-disable-line react-hooks/exhaustive-deps

  const memberCount = members.length

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-6 pt-[calc(var(--drawer-header-h,3.5rem)+0.75rem)]">
        {hookError && <ErrorDisplay message={hookError} />}
        {error && <ErrorDisplay message={error} />}
        {success && <ErrorDisplay type="success" message={success} />}

        {/* ── Clinic ───────────────────────────────────────────────── */}
        <section>
          <div className="pb-2 flex items-center gap-2">
            <p className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">Cluster</p>
          </div>
          <div className="relative"><div ref={clinicCardRef} className="rounded-2xl bg-themewhite2 overflow-hidden">
            <button
              type="button"
              disabled={!isSupervisorRole}
              onClick={() => {
                if (!clinicCardRef.current) return
                setClinicEditAnchor(clinicCardRef.current.getBoundingClientRect())
              }}
              className="w-full text-left px-4 py-4 hover:bg-secondary/5 active:scale-[0.99] disabled:active:scale-100 transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-base font-semibold text-primary truncate">
                    {clinicName || (
                      <span className="text-tertiary italic">No facility</span>
                    )}
                  </p>
                  <p className="text-[10pt] text-tertiary mt-0.5">
                    {isSupervisorRole
                      ? `${memberCount} personnel`
                      : (profile.uic || 'No UIC')}
                  </p>
                  {(clinicUics.length > 0 || selectedLocation || clinicLocation) && (
                    <p className="text-[10pt] text-tertiary mt-0.5 truncate">
                      {[clinicUics.join(', '), selectedLocation ? selectedLocation.display_name : clinicLocation].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  {activeCode && (
                    <p className="text-[9pt] font-mono tracking-[0.2em] text-tertiary select-all mt-2">
                      {activeCode}
                    </p>
                  )}
                </div>
                {activeCode && (
                  <div className="bg-white rounded-lg p-1.5 shrink-0">
                    <canvas ref={qrCanvasRef} className="w-16 h-16 rounded" />
                  </div>
                )}
              </div>
            </button>
            </div>
            {/* Bottom-right pill — cluster-context switcher (loaned supervisors)
                plus Copy + Share QR (when an invite code is active). All render
                together as a single pill so the QR preview at top-right stays
                unobstructed. */}
            {isSupervisorRole && (surrogateClinicIds.length > 0 || activeCode) && (
              <OverlayActionMenu
                ref={clusterSwitchBtnRef}
                shadow="sm"
                items={[
                  ...(surrogateClinicIds.length > 0
                    ? [{
                        key: 'switch',
                        label:
                          clusterOptions.length === 2
                            ? `Switch to ${clusterOptions.find((c) => c.id !== clinicId)?.name ?? 'other cluster'}`
                            : 'Switch cluster',
                        icon: ArrowLeftRight,
                        onAction: handleClusterSwitch,
                      } as ContextMenuItem]
                    : []),
                  ...(activeCode
                    ? [
                        {
                          key: 'copy',
                          label: 'Copy invite code',
                          // Raw button: flips to themegreen tint on success.
                          render: () => (
                            <button
                              type="button"
                              onClick={handleCopy}
                              aria-label="Copy invite code"
                              title="Copy invite code"
                              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                                copied ? 'bg-themegreen/8 text-themegreen' : 'bg-themeblue2/8 text-primary'
                              }`}
                            >
                              {copied ? <Check size={16} /> : <Copy size={16} />}
                            </button>
                          ),
                        } as ContextMenuItem,
                        { key: 'share', label: 'Share QR image', icon: Share2, onAction: handleShareInviteImage } as ContextMenuItem,
                      ]
                    : []),
                ]}
              />
            )}
            {/* Hidden high-res QR canvas — source for navigator.share / clipboard.write. */}
            {activeCode && <canvas ref={shareCanvasRef} style={{ display: 'none' }} />}
          </div>
        </section>

        {/* ── Outside contact (event intake + allow calls/messaging, dev-wrapped) ── */}
        {clinicId && (
          <IntakeMintSection
            clinicId={clinicId}
            oncallCount={oncall.length}
            onOncallEnabledChange={setOncallRosterShown}
          />
        )}

        {/* ── Associated ─────────────────────────────────────────── */}
        <section>
          <div className="pb-2 flex items-center gap-2">
            <p className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">Associated</p>
          </div>
          <div className="relative"><div className="rounded-xl bg-themewhite2 overflow-hidden">
            <div className="px-4 py-3">
              {nearbyClinicMap.length === 0 ? (
                <p className="text-[10pt] text-tertiary py-4 text-center">No associated clusters</p>
              ) : (
                <div className="space-y-1">
                  {nearbyClinicMap.map((clinic) => (
                    <SwipeToDeleteRow
                      key={clinic.clinicId}
                      className="rounded-lg"
                      onDelete={() => setConfirmDisassociate({ clinicId: clinic.clinicId, clinicName: clinic.clinicName })}
                    >
                    <button
                      type="button"
                      onClick={(e) => openAssocInfoPopover(clinic, e.currentTarget)}
                      className="w-full flex items-center gap-3 py-2 px-2 rounded-lg text-left hover:bg-secondary/5 active:scale-95 transition-all"
                    >
                      <div className="w-8 h-8 rounded-full flex items-center justify-center bg-tertiary/10 shrink-0">
                        <Building2 size={14} className="text-tertiary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-primary truncate">
                          {clinic.clinicName}
                          <span className="text-tertiary font-normal"> · {clinic.count} personnel</span>
                        </p>
                        {(clinic.uics.length > 0 || clinic.location) && (
                          <p className="text-[9pt] text-tertiary truncate">
                            {[clinic.uics.join(', '), clinic.location].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>
                    </button>
                    </SwipeToDeleteRow>
                  ))}
                </div>
              )}
            </div>
            </div>
            <ActionPill ref={assocFabRef} shadow="sm" placement="overlay">
              <ActionButton icon={Plus} label="Associate a cluster" onClick={openAssocAddPopover} />
            </ActionPill>
          </div>
        </section>

        {/* ── Sub-units (platoon/squad) — own clinic, supervisor/dev ─────── */}
        {isSupervisorRole && clinicId && !isSurrogateContext && (
          <section>
            <div className="pb-2 flex items-center gap-2">
              <p className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">Sub-units</p>
            </div>
            <SubClusterManager
              subClusters={subClusters}
              onCreate={async (name) => {
                const r = await createSubCluster(name)
                if (r.success) invalidate('subClusters')
                return r.success
              }}
              onRename={async (id, name) => {
                const r = await renameSubCluster(id, name)
                if (r.success) invalidate('subClusters')
                return r.success
              }}
              onDelete={async (id) => {
                const r = await deleteSubCluster(id)
                if (r.success) invalidate('subClusters', 'users')
                return r.success
              }}
            />
          </section>
        )}

        {/* ── Users (supervisor-gated) ───────────────────────────── */}
        {isSupervisorRole && clinicId && (
          <section>
            <div className="pb-2 flex items-center gap-2">
              <p className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">Users</p>
            </div>

            <div className="relative"><div className="relative rounded-xl bg-themewhite2 overflow-hidden">
              <div className="px-4 py-3">
                {members.length > 0 ? (
                  <div className="space-y-3">
                    {assignedMembers.length > 0 && (
                      <div className="space-y-1">
                        {assignedMembers.map((member) => renderMemberRow(
                          member,
                          member.credential || '',
                          member.surrogateClinicId ? (
                            <span className="shrink-0 text-[9pt] px-1.5 py-0.5 rounded-full bg-themeyellow/15 text-themeyellow font-medium border border-themeyellow/30">
                              Loaned out
                            </span>
                          ) : null,
                        ))}
                      </div>
                    )}
                    {loanedInMembers.length > 0 && (
                      <div>
                        <p className="text-[9pt] font-semibold text-tertiary uppercase tracking-wider px-2 mb-1">
                          Loaned In ({loanedInMembers.length})
                        </p>
                        <div className="space-y-1">
                          {loanedInMembers.map((member) => renderMemberRow(
                            member,
                            [member.credential, member.clinicName].filter(Boolean).join(' · '),
                            <span className="shrink-0 text-[9pt] px-1.5 py-0.5 rounded-full bg-themeblue2/10 text-themeblue2 font-medium border border-themeblue2/30">
                              Loaned in
                            </span>,
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-[10pt] text-tertiary py-4 text-center">No members assigned</p>
                )}
              </div>
              <LoadingOverlay visible={medicsLoading} size={120} className="rounded-xl" />
              </div>
              <ActionPill ref={addMemberFabRef} shadow="sm" placement="overlay">
                <ActionButton icon={Plus} label="Add member" onClick={openAddMemberPopover} />
              </ActionPill>
            </div>
          </section>
        )}

      </div>

      {/* Cluster switcher overlay — only for supervisors with >1 alternative. */}
      <PreviewOverlay
        isOpen={!!clusterSwitchAnchor}
        onClose={() => setClusterSwitchAnchor(null)}
        anchorRect={clusterSwitchAnchor}
        title="Operating as"
        maxWidth={300}
      >
        <div>
          {clusterOptions.map((c) => {
            const active = clinicId === c.id
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => { setSupervisingClinic(c.id); setClusterSwitchAnchor(null) }}
                className={`w-full flex items-center gap-3 py-2.5 px-4 text-left transition-colors ${
                  active
                    ? 'bg-themeblue3/8 border-l-2 border-l-themeblue3'
                    : 'hover:bg-secondary/5'
                }`}
              >
                <span className="text-[10pt] font-medium text-primary truncate flex-1">{c.name}</span>
                {active && <Check size={14} className="text-themeblue2 shrink-0" />}
              </button>
            )
          })}
        </div>
      </PreviewOverlay>

      {/* Clinic identity edit popover — shared with SupervisorDrawer */}
      <ClinicIdentityEditPopover
        isOpen={!!clinicEditAnchor}
        anchorRect={clinicEditAnchor}
        clinicId={clinicId}
        initialName={clinicName ?? ''}
        initialLocation={clinicLocation}
        initialLocationId={clinicLocationId}
        initialUics={clinicUics}
        locations={locations}
        onClose={() => setClinicEditAnchor(null)}
        onSaved={(next) => {
          setClinicUics(next.uics)
          setClinicLocation(next.location)
          setClinicLocationId(next.location_id)
        }}
      />

      {/* Add member popover — shared with SupervisorDrawer */}
      <AddMemberPopover
        isOpen={!!addMemberAnchor}
        anchorRect={addMemberAnchor}
        clinicId={clinicId}
        onClose={closeAddMemberPopover}
        onAdded={refreshMedics}
      />

      {/* Member tap-to-edit popover — shared with SupervisorDrawer */}
      <MemberEditPopover
        isOpen={!!memberPopover}
        anchorRect={memberPopover?.anchor ?? null}
        memberId={memberPopover?.memberId ?? null}
        clinicId={clinicId}
        fallbackProfile={memberFallback}
        associatedClinics={nearbyClinicMap}
        loanState={(() => {
          if (!memberPopover) return 'home'
          const m = medics.find(x => x.id === memberPopover.memberId)
          if (!m) return 'home'
          if (m.isLoanedIn) return 'loaned-in'
          if (m.surrogateClinicId) return 'loaned-out'
          return 'home'
        })()}
        onClose={() => setMemberPopover(null)}
        onChanged={refreshMedics}
      />

      {/* Associated clinic popover — info (with delete) or add (code/scan/upload) */}
      <PreviewOverlay
        isOpen={!!assocPopover}
        onClose={closeAssocPopover}
        anchorRect={assocPopover?.anchor ?? null}
        title={
          assocPopover?.mode === 'add'
            ? 'Associate a clinic'
            : assocPopover?.mode === 'info'
              ? assocPopover.clinic.clinicName
              : ''
        }
        maxWidth={360}
        previewMaxHeight="60dvh"
        footer={
          assocPopover?.mode === 'info' ? (
            <div className="flex gap-1 bg-themewhite rounded-2xl shadow-lg px-1.5 py-1.5">
              <ActionButton
                icon={Trash2}
                label="Disassociate"
                variant="danger"
                onClick={() => setConfirmDisassociate({
                  clinicId: assocPopover.clinic.clinicId,
                  clinicName: assocPopover.clinic.clinicName,
                })}
              />
            </div>
          ) : assocPopover?.mode === 'add' ? (
            <div className="flex gap-1 bg-themewhite rounded-2xl shadow-lg px-1.5 py-1.5">
              <ActionButton
                icon={Camera}
                label={scanning ? 'Stop scan' : 'Scan QR'}
                variant={scanning ? 'success' : 'default'}
                onClick={handleToggleScan}
              />
              <ActionButton
                icon={ImagePlus}
                label="Upload"
                onClick={handlePhotoUpload}
              />
            </div>
          ) : undefined
        }
        rightFooter={
          assocPopover?.mode === 'add' ? (
            <ActionPill>
              <ActionButton
                icon={assocSaving ? Loader2 : Check}
                label="Associate"
                variant={!joinCode || assocSaving ? 'disabled' : 'success'}
                onClick={() => redeemAssocCode(joinCode)}
              />
            </ActionPill>
          ) : undefined
        }
      >
        {assocPopover?.mode === 'info' && (
          <div>
            <div className="flex items-center justify-between border-b border-primary/6 px-4 py-3">
              <span className="text-[9pt] font-semibold text-tertiary uppercase tracking-widest w-20 shrink-0">UICs</span>
              <span className="text-sm text-primary truncate ml-3">{assocPopover.clinic.uics.join(', ') || '—'}</span>
            </div>
            <div className="flex items-center justify-between border-b border-primary/6 px-4 py-3">
              <span className="text-[9pt] font-semibold text-tertiary uppercase tracking-widest w-20 shrink-0">Location</span>
              <span className="text-sm text-primary truncate ml-3">{assocPopover.clinic.location || '—'}</span>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="text-[9pt] font-semibold text-tertiary uppercase tracking-widest w-20 shrink-0">Code</span>
              {assocCodeLoading ? (
                <Loader2 size={14} className="animate-spin text-tertiary" />
              ) : assocCode ? (
                <button
                  type="button"
                  onClick={handleCopyAssocCode}
                  className="flex items-center gap-2 text-sm font-mono tracking-[0.15em] text-primary hover:text-themeblue3 active:scale-95 transition-all"
                >
                  <span>{assocCode}</span>
                  {assocCodeCopied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              ) : (
                <span className="text-sm text-tertiary">—</span>
              )}
            </div>
          </div>
        )}
        {assocPopover?.mode === 'add' && (
          <div>
            <div className="flex items-center border-b border-primary/6 px-4 py-3">
              <span className="text-[9pt] font-semibold text-tertiary uppercase tracking-widest w-20 shrink-0">Code</span>
              <input
                type="text"
                value={joinCode}
                onChange={(e) =>
                  setJoinCode(e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 8))
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && joinCode.length > 0) redeemAssocCode(joinCode)
                }}
                placeholder="Enter invite code"
                maxLength={8}
                className="flex-1 bg-transparent font-mono tracking-[0.15em] text-primary placeholder:font-sans placeholder:tracking-normal placeholder:text-tertiary focus:outline-none text-sm min-w-0"
              />
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />

            {scanning && (
              <div className="px-4 py-3">
                <div className="relative w-full aspect-4/3 rounded-lg overflow-hidden bg-black/5 border border-tertiary/10">
                  <video
                    ref={videoRef}
                    className="absolute inset-0 w-full h-full object-cover"
                    playsInline
                    muted
                  />
                  {!isScanning && !scanError && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <p className="text-[10pt] text-tertiary">Starting camera…</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {(joinFeedback?.type === 'error' || scanError) && (
              <div className="px-4 py-2">
                <ErrorPill>{joinFeedback?.message || scanError}</ErrorPill>
              </div>
            )}
          </div>
        )}
      </PreviewOverlay>

      <ConfirmDialog
        visible={!!confirmDisassociate}
        title="Disassociate this cluster?"
        subtitle={confirmDisassociate ? `${confirmDisassociate.clinicName} will no longer be linked to your cluster.` : ''}
        confirmLabel="Disassociate"
        variant="danger"
        processing={assocSaving}
        onConfirm={handleConfirmDisassociate}
        onCancel={() => setConfirmDisassociate(null)}
      />

      {/* Swipe-to-remove confirmation (Users roster). Loaned-in members end the
          loan; everyone else is removed from the cluster. */}
      <ConfirmDialog
        visible={!!removeMemberTarget}
        title={removeMemberTarget?.isLoanedIn ? 'End loan?' : 'Remove from cluster?'}
        subtitle={
          removeMemberError ??
          (removeMemberTarget?.isLoanedIn
            ? 'Sends this member back to their home cluster.'
            : 'They will no longer be associated with this cluster.')
        }
        confirmLabel={removeMemberTarget?.isLoanedIn ? 'End loan' : 'Remove'}
        variant="danger"
        processing={removingMember}
        onConfirm={handleConfirmRemoveMember}
        onCancel={() => { if (!removingMember) { setRemoveMemberTarget(null); setRemoveMemberError(null) } }}
      />
    </div>
  )
}


