import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import {
  Building2,
  Camera,
  ImagePlus,
  Check,
  Stethoscope,
  Plus,
  Trash2,
  Loader2,
  Copy,
  Share2,
} from 'lucide-react'
import bwipjs from 'bwip-js'
import { useAuth } from '../../Hooks/useAuth'
import { ErrorPill } from '../ErrorPill'
import { useClinicInvites } from '../../Hooks/useClinicInvites'
import { useBarcodeScanner } from '../../Hooks/useBarcodeScanner'
import { useClinicMedics } from '../../Hooks/useClinicMedics'
import {
  updateSupervisorClinic,
  disassociateClinic,
  getClinicEncryptionKey,
  getClinicDetails,
} from '../../lib/supervisorService'
import { invalidate } from '../../stores/useInvalidationStore'
import { ErrorDisplay } from '../ErrorDisplay'
import { UserAvatar } from './UserAvatar'
import { PreviewOverlay } from '../PreviewOverlay'
import { ActionButton } from '../ActionButton'
import { ConfirmDialog } from '../ConfirmDialog'
import { ActionPill } from '../ActionPill'
import { CalendarClinicEditor } from '../Calendar/CalendarClinicEditor'
import { ClinicIdentityEditPopover } from '../ClinicAdmin/ClinicIdentityEditPopover'
import { MemberEditPopover } from '../ClinicAdmin/MemberEditPopover'
import { AddMemberPopover } from '../ClinicAdmin/AddMemberPopover'
import { SupervisorClinicCardAction } from '../SupervisorClinicSwitcher'


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
  const { clinicId: assignedClinicId, surrogateClinicId, supervisingClinicId, profile, isSupervisorRole } = useAuth()
  // The supervisor toggle picks which clinic this panel administers. For
  // single-clinic users it stays equal to the assigned clinic. All clinic-
  // scoped reads, writes, and labels below resolve through `clinicId` and
  // `clinicName` so the toggle just flips the pointer.
  const clinicId = supervisingClinicId ?? assignedClinicId
  const clinicName = clinicId === surrogateClinicId
    ? (profile.surrogateClinicName ?? null)
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
          await navigator.share({ files: [file], title: 'Clinic invite' })
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
  const [clinicAssociatedIds, setClinicAssociatedIds] = useState<string[]>([])

  // Edit fields (legacy inline-edit path: still wired through saveRequested → handleSave)
  const [editName, setEditName] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [editUics, setEditUics] = useState('')

  // Save state
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Members — uses the same hook as messaging (get_location_medics RPC).
  // Include both assigned (m.clinicId === clinicId) and loaned-in
  // (m.surrogateClinicId === clinicId) members; rendered in separate groups.
  const { medics, loading: medicsLoading, refresh: refreshMedics } = useClinicMedics()
  const assignedMembers = useMemo(
    () => medics.filter((m) => !m.clinicId || m.clinicId === clinicId),
    [medics, clinicId],
  )
  const loanedInMembers = useMemo(
    () => medics.filter((m) => m.surrogateClinicId === clinicId && m.clinicId !== clinicId),
    [medics, clinicId],
  )
  const members = useMemo(
    () => [...assignedMembers, ...loanedInMembers],
    [assignedMembers, loanedInMembers],
  )

  // Associated clinic popover
  const assocFabRef = useRef<HTMLDivElement>(null)
  const [assocPopover, setAssocPopover] = useState<
    | { mode: 'info'; anchor: DOMRect; clinic: { clinicId: string; clinicName: string; uics: string[]; location: string | null } }
    | { mode: 'add'; anchor: DOMRect }
    | null
  >(null)
  const [assocSaving, setAssocSaving] = useState(false)
  const [confirmDisassociate, setConfirmDisassociate] = useState<{ clinicId: string; clinicName: string } | null>(null)

  // Member popover (tap-to-edit roster row)
  const [memberPopover, setMemberPopover] = useState<{ memberId: string; anchor: DOMRect } | null>(null)

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

  // Tour: cancel edit mode when guided tour requests it
  useEffect(() => {
    const handleCancelEdit = () => {
      onDeleteSelectionChange(new Set())
      onEditingChange(false)
    }
    window.addEventListener('tour:clinic-cancel-edit', handleCancelEdit)
    return () => {
      window.removeEventListener('tour:clinic-cancel-edit', handleCancelEdit)
    }
  }, [onDeleteSelectionChange, onEditingChange])

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
  }, [])

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

  const handleSave = useCallback(async () => {
    if (!clinicId) return
    if (!editName.trim()) {
      setError('Clinic name is required')
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
    setSuccess('Clinic updated')
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
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
        {hookError && <ErrorDisplay message={hookError} />}
        {error && <ErrorDisplay message={error} />}
        {success && <ErrorDisplay type="success" message={success} />}

        {/* ── Clinic ───────────────────────────────────────────────── */}
        <section data-tour="clinic-identity-card">
          <div className="pb-2 flex items-center gap-2">
            <p className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">Clinic</p>
          </div>
          <div ref={clinicCardRef} className="relative rounded-xl bg-themewhite2 overflow-hidden">
            <button
              type="button"
              disabled={!isSupervisorRole}
              onClick={() => {
                if (!clinicCardRef.current) return
                setClinicEditAnchor(clinicCardRef.current.getBoundingClientRect())
              }}
              className={`w-full text-left px-4 pt-3 hover:bg-secondary/5 active:scale-[0.99] disabled:active:scale-100 transition-all ${
                isSupervisorRole && activeCode ? 'pb-16' : 'pb-3'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-primary truncate">
                    {clinicName || (
                      <span className="text-tertiary italic">No facility</span>
                    )}
                  </p>
                  <p className="text-[9pt] text-tertiary">
                    {isSupervisorRole
                      ? `${memberCount} personnel`
                      : (profile.uic || 'No UIC')}
                  </p>
                  {(clinicUics.length > 0 || clinicLocation) && (
                    <p className="text-[9pt] text-tertiary mt-0.5 truncate">
                      {[clinicUics.join(', '), clinicLocation].filter(Boolean).join(' · ')}
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
            {/* Bottom-right pill — combines clinic-context picker (loaned
                supervisors) with Copy + Share QR (when an invite code is
                active). All three render together as a single pill so the QR
                preview at top-right stays unobstructed. */}
            {isSupervisorRole && (surrogateClinicId || activeCode) && (
              <ActionPill shadow="sm" className="absolute bottom-2 right-2">
                {surrogateClinicId && <SupervisorClinicCardAction />}
                {activeCode && (
                  <>
                    {/* Copy: raw button styled to match ActionButton default; flips to themegreen tint on success. */}
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
                    <ActionButton
                      icon={Share2}
                      label="Share QR image"
                      onClick={handleShareInviteImage}
                    />
                  </>
                )}
              </ActionPill>
            )}
            {/* Hidden high-res QR canvas — source for navigator.share / clipboard.write. */}
            {activeCode && <canvas ref={shareCanvasRef} style={{ display: 'none' }} />}
          </div>
        </section>

        {/* ── Associated ─────────────────────────────────────────── */}
        <section data-tour="clinic-associated">
          <div className="pb-2 flex items-center gap-2">
            <p className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">Associated</p>
            <span className="text-[9pt] px-1.5 py-0.5 rounded-full bg-tertiary/10 text-tertiary font-medium">
              {nearbyClinicMap.length}
            </span>
          </div>
          <div className="relative rounded-xl bg-themewhite2 overflow-hidden">
            <div className="px-4 py-3">
              {nearbyClinicMap.length === 0 ? (
                <p className="text-sm text-tertiary py-4 text-center">No associated clinics</p>
              ) : (
                <div className="space-y-1">
                  {nearbyClinicMap.map((clinic) => (
                    <button
                      key={clinic.clinicId}
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
                  ))}
                </div>
              )}
            </div>
            <ActionPill ref={assocFabRef} shadow="sm" className="absolute top-2 right-2">
              <ActionButton icon={Plus} label="Associate a clinic" onClick={openAssocAddPopover} />
            </ActionPill>
          </div>
        </section>

        {/* ── Rooms + Huddle Tasks (shared with calendar settings) ── */}
        <CalendarClinicEditor />

        {/* ── Users (supervisor-gated) ───────────────────────────── */}
        {isSupervisorRole && clinicId && (
          <section data-tour="clinic-personnel">
            <div className="pb-2 flex items-center gap-2">
              <p className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">Users</p>
              <span className="text-[9pt] px-1.5 py-0.5 rounded-full bg-tertiary/10 text-tertiary font-medium">
                {memberCount}
              </span>
            </div>

            <div className="relative rounded-xl bg-themewhite2 overflow-hidden">
              <div className="px-4 py-3">
                {medicsLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <div className="w-4 h-4 border-2 border-themeblue3 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : members.length > 0 ? (
                  <div className="space-y-3">
                    {assignedMembers.length > 0 && (
                      <div className="space-y-1">
                        {assignedMembers.map((member) => (
                          <button
                            key={member.id}
                            type="button"
                            onClick={(e) => openMemberPopover(member.id, e.currentTarget)}
                            className="w-full flex items-center gap-3 py-2 px-2 rounded-lg text-left hover:bg-secondary/5 active:scale-95 transition-all"
                          >
                            <UserAvatar
                              avatarId={member.avatarId}
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
                              <p className="text-[9pt] text-tertiary truncate">
                                {member.credential || ''}
                              </p>
                            </div>
                            {member.surrogateClinicId && (
                              <span className="shrink-0 text-[9pt] px-1.5 py-0.5 rounded-full bg-themeyellow/15 text-themeyellow font-medium border border-themeyellow/30">
                                Loaned out
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                    {loanedInMembers.length > 0 && (
                      <div>
                        <p className="text-[9pt] font-semibold text-tertiary uppercase tracking-wider px-2 mb-1">
                          Loaned In ({loanedInMembers.length})
                        </p>
                        <div className="space-y-1">
                          {loanedInMembers.map((member) => (
                            <button
                              key={member.id}
                              type="button"
                              onClick={(e) => openMemberPopover(member.id, e.currentTarget)}
                              className="w-full flex items-center gap-3 py-2 px-2 rounded-lg text-left hover:bg-secondary/5 active:scale-95 transition-all"
                            >
                              <UserAvatar
                                avatarId={member.avatarId}
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
                                <p className="text-[9pt] text-tertiary truncate">
                                  {[member.credential, member.clinicName].filter(Boolean).join(' · ')}
                                </p>
                              </div>
                              <span className="shrink-0 text-[9pt] px-1.5 py-0.5 rounded-full bg-themeblue2/10 text-themeblue2 font-medium border border-themeblue2/30">
                                Loaned in
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-tertiary py-4 text-center">No members assigned</p>
                )}
              </div>
              <ActionPill ref={addMemberFabRef} data-tour="clinic-add-member" shadow="sm" className="absolute top-2 right-2">
                <ActionButton icon={Plus} label="Add member" onClick={openAddMemberPopover} />
              </ActionPill>
            </div>
          </section>
        )}

        {/* Clinic Note Content callout */}
        {isSupervisorRole && (
          <div className="rounded-xl border border-themeblue2/15 bg-themeblue2/5 px-4 py-3 flex items-center gap-3">
            <Stethoscope size={18} className="text-themeblue2 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-primary">Clinic Note Templates</p>
              <p className="text-[9pt] text-tertiary mt-0.5">
                Manage shared text shortcuts and order sets in Note Content
              </p>
            </div>
          </div>
        )}

      </div>

      {/* Clinic identity edit popover — shared with SupervisorDrawer */}
      <ClinicIdentityEditPopover
        isOpen={!!clinicEditAnchor}
        anchorRect={clinicEditAnchor}
        clinicId={clinicId}
        initialName={clinicName ?? ''}
        initialLocation={clinicLocation}
        initialUics={clinicUics}
        onClose={() => setClinicEditAnchor(null)}
        onSaved={(next) => {
          setClinicUics(next.uics)
          setClinicLocation(next.location)
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
              <ActionButton
                icon={assocSaving ? Loader2 : Check}
                label="Associate"
                variant={!joinCode || assocSaving ? 'disabled' : 'success'}
                onClick={() => redeemAssocCode(joinCode)}
              />
            </div>
          ) : undefined
        }
      >
        {assocPopover?.mode === 'info' && (
          <div>
            <div className="flex items-center justify-between border-b border-primary/6 px-4 py-3">
              <span className="text-[9pt] font-semibold text-tertiary uppercase tracking-widest w-20 shrink-0">UICs</span>
              <span className="text-sm text-primary truncate ml-3">{assocPopover.clinic.uics.join(', ') || '—'}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-[9pt] font-semibold text-tertiary uppercase tracking-widest w-20 shrink-0">Location</span>
              <span className="text-sm text-primary truncate ml-3">{assocPopover.clinic.location || '—'}</span>
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
        title="Disassociate this clinic?"
        subtitle={confirmDisassociate ? `${confirmDisassociate.clinicName} will no longer be linked to your clinic.` : ''}
        confirmLabel="Disassociate"
        variant="danger"
        processing={assocSaving}
        onConfirm={handleConfirmDisassociate}
        onCancel={() => setConfirmDisassociate(null)}
      />
    </div>
  )
}


