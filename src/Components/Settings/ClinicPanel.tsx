import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import {
  Building2,
  Camera,
  ImagePlus,
  Check,
  CircleX,
  X,
  RefreshCw,
  Pencil,
} from 'lucide-react'
import bwipjs from 'bwip-js'
import { useAuth } from '../../Hooks/useAuth'
import { useClinicInvites } from '../../Hooks/useClinicInvites'
import { useBarcodeScanner } from '../../Hooks/useBarcodeScanner'
import { useClinicMedics } from '../../Hooks/useClinicMedics'
import {
  updateSupervisorClinic,
  removeClinicMember,
  disassociateClinic,
  getClinicEncryptionKey,
  getClinicDetails,
  findUserByEmail,
  addClinicMember,
  createClinicUser,
  getMemberProfile,
  updateMemberProfile,
  setMemberRoles,
  type UserLookupResult,
  type MemberProfileData,
} from '../../lib/supervisorService'
import { invalidate } from '../../stores/useInvalidationStore'
import { TextInput, PickerInput, UicPinInput } from '../FormInputs'
import { ErrorDisplay } from '../ErrorDisplay'
import { UserAvatar } from './UserAvatar'
import { ActionIconButton } from '../WriteNoteHelpers'


interface StagedMember {
  userId: string
  firstName: string
  lastName: string
  rank?: string | null
  credential?: string | null
  email: string
  alreadyCreated?: boolean
}

interface StagedProfileEdit {
  memberId: string
  original: MemberProfileData
  changes: Partial<MemberProfileData>
}

interface StagedClinic {
  code: string
}

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
  const { clinicId, profile, isSupervisorRole } = useAuth()
  const {
    invites,
    error: hookError,
    activeCode,
    activeExpiresAt,
    redeemInvite,
    approveInvite,
    rejectInvite,
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

  // Clinic details
  const [clinicUics, setClinicUics] = useState<string[]>([])
  const [clinicLocation, setClinicLocation] = useState<string | null>(null)
  const [clinicAssociatedIds, setClinicAssociatedIds] = useState<string[]>([])

  // Edit fields
  const [editName, setEditName] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [editUics, setEditUics] = useState('')

  // Save state
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Add member (inline)
  const [addEmail, setAddEmail] = useState('')
  const [addMode, setAddMode] = useState<'lookup' | 'existing' | 'create'>('lookup')
  const [addLookupResult, setAddLookupResult] = useState<UserLookupResult | null>(null)
  const [addLookupLoading, setAddLookupLoading] = useState(false)
  const [addSubmitting, setAddSubmitting] = useState(false)
  const [addFirstName, setAddFirstName] = useState('')
  const [addLastName, setAddLastName] = useState('')
  const [addMiddleInitial, setAddMiddleInitial] = useState('')
  const [addCredential, setAddCredential] = useState('')
  const [addComponent, setAddComponent] = useState('')
  const [addRank, setAddRank] = useState('')
  const [addUic, setAddUic] = useState('')
  const [addTempPassword, setAddTempPassword] = useState('')
  const [addRoles, setAddRoles] = useState<('medic' | 'supervisor' | 'provider')[]>(['medic'])
  const [addFeedback, setAddFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null)
  const addFeedbackTimer = useRef<ReturnType<typeof setTimeout>>(null)

  // Members — uses the same hook as messaging (get_location_medics RPC)
  const { medics, loading: medicsLoading, refresh: refreshMedics } = useClinicMedics()
  const members = useMemo(
    () => medics.filter((m) => !m.clinicId || m.clinicId === clinicId),
    [medics, clinicId],
  )

  // Staged batch changes
  const [stagedMembers, setStagedMembers] = useState<StagedMember[]>([])
  const [stagedClinics, setStagedClinics] = useState<StagedClinic[]>([])
  const [stagedEdits, setStagedEdits] = useState<Map<string, StagedProfileEdit>>(new Map())

  // Inline member editing
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null)
  const [expandedProfile, setExpandedProfile] = useState<MemberProfileData | null>(null)
  const [expandedLoading, setExpandedLoading] = useState(false)
  const [editFirstName, setEditFirstName] = useState('')
  const [editLastName, setEditLastName] = useState('')
  const [editMiddleInitial, setEditMiddleInitial] = useState('')
  const [editCredential, setEditCredential] = useState('')
  const [editComponent, setEditComponent] = useState('')
  const [editRank, setEditRank] = useState('')
  const [editUic, setEditUic] = useState('')
  const [editRoles, setEditRoles] = useState<('medic' | 'supervisor' | 'provider')[]>(['medic'])

  // Join section
  const [joinCode, setJoinCode] = useState('')
  const [joinFeedback, setJoinFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null)
  const joinFeedbackTimer = useRef<ReturnType<typeof setTimeout>>(null)
  const [scanning, setScanning] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const addEmailRef = useRef<HTMLInputElement>(null)

  // Action state
  const [processingInviteId, setProcessingInviteId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)

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
    onPendingChangesChange?.(stagedMembers.length > 0 || stagedClinics.length > 0 || deleteSelection.size > 0 || stagedEdits.size > 0)
  }, [stagedMembers.length, stagedClinics.length, deleteSelection.size, stagedEdits.size, onPendingChangesChange])

  // Focus the add-member email input when the section becomes visible
  const addEmailVisible = clinicEditing && addMode !== 'create'
  useEffect(() => {
    if (addEmailVisible) addEmailRef.current?.focus()
  }, [addEmailVisible])

  // Tour: stage demo clinic code or cancel edit mode when guided tour requests it
  useEffect(() => {
    const handleStageDemo = () => {
      setStagedClinics(prev => {
        if (prev.some(c => c.code === 'X7K2M9P4')) return prev
        return [...prev, { code: 'X7K2M9P4' }]
      })
    }
    const handleCancelEdit = () => {
      setStagedClinics([])
      setStagedMembers([])
      onDeleteSelectionChange(new Set())
      onEditingChange(false)
    }
    window.addEventListener('tour:clinic-stage-demo', handleStageDemo)
    window.addEventListener('tour:clinic-cancel-edit', handleCancelEdit)
    return () => {
      window.removeEventListener('tour:clinic-stage-demo', handleStageDemo)
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

  // ─── Auto-redeem scanned code ─────────────────────────────────────

  useEffect(() => {
    if (!scanResult) return
    setScanning(false)
    stopScanning()
    const code = scanResult.trim().toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 8)
    if (code) {
      setStagedClinics(prev => {
        if (prev.some(c => c.code === code)) return prev
        return [...prev, { code }]
      })
    }
    clearResult()
  }, [scanResult]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Edit state initialization ────────────────────────────────────

  useEffect(() => {
    if (clinicEditing) {
      setEditName(profile.clinicName ?? '')
      setEditLocation(clinicLocation ?? '')
      setEditUics(clinicUics.join(', '))
      setError(null)
      setSuccess(null)
    }
  }, [clinicEditing, profile.clinicName, clinicLocation, clinicUics])

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

  const handleStageClinicCode = useCallback(
    (code: string) => {
      const trimmed = code.trim().toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 8)
      if (!trimmed) return
      setStagedClinics(prev => {
        if (prev.some(c => c.code === trimmed)) return prev
        return [...prev, { code: trimmed }]
      })
      setJoinCode('')
    },
    [showJoinFeedback],
  )

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
          handleStageClinicCode(result.getText())
        } else {
          showJoinFeedback('error', 'No code found in image')
        }
      } catch {
        showJoinFeedback('error', 'Could not read code from image')
      }
    },
    [handleStageClinicCode, showJoinFeedback],
  )

  const handleApprove = useCallback(
    async (inviteId: string) => {
      setProcessingInviteId(inviteId)
      setActionError(null)
      const result = await approveInvite(inviteId)
      if (result.success) {
        setActionSuccess('Association approved')
        setTimeout(() => setActionSuccess(null), 3_000)
      } else {
        setActionError(result.error)
      }
      setProcessingInviteId(null)
    },
    [approveInvite],
  )

  const handleReject = useCallback(
    async (inviteId: string) => {
      setProcessingInviteId(inviteId)
      setActionError(null)
      const result = await rejectInvite(inviteId)
      if (result.success) {
        setActionSuccess('Association rejected')
        setTimeout(() => setActionSuccess(null), 3_000)
      } else {
        setActionError(result.error)
      }
      setProcessingInviteId(null)
    },
    [rejectInvite],
  )

  // Set of associated clinic IDs (for distinguishing clinics vs members in delete)
  const associatedClinicIds = useMemo(() => {
    const set = new Set<string>(clinicAssociatedIds)
    for (const m of medics) {
      if (m.clinicId && m.clinicId !== clinicId) set.add(m.clinicId)
    }
    return set
  }, [medics, clinicId, clinicAssociatedIds])

  const populateEditForm = useCallback((profile: MemberProfileData) => {
    setEditFirstName(profile.firstName ?? '')
    setEditLastName(profile.lastName ?? '')
    setEditMiddleInitial(profile.middleInitial ?? '')
    setEditCredential(profile.credential ?? '')
    setEditComponent(profile.component ?? '')
    setEditRank(profile.rank ?? '')
    setEditUic(profile.uic ?? '')
    setEditRoles((profile.roles ?? ['medic']) as ('medic' | 'supervisor' | 'provider')[])
  }, [])

  const clearExpandedState = useCallback(() => {
    setExpandedMemberId(null)
    setExpandedProfile(null)
    setExpandedLoading(false)
  }, [])

  // Clear inline edit state when leaving edit mode
  const prevEditingRef = useRef(clinicEditing)
  useEffect(() => {
    if (prevEditingRef.current && !clinicEditing) {
      setStagedEdits(new Map())
      clearExpandedState()
    }
    prevEditingRef.current = clinicEditing
  }, [clinicEditing, clearExpandedState])

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

    // 2. Batch add staged members (skip already-created — RPC already added them)
    const needsAdd = stagedMembers.filter(m => !m.alreadyCreated)
    const memberResults = await Promise.allSettled(
      needsAdd.map(async (m, i) => {
        const r = await addClinicMember(clinicId, m.userId)
        return { index: i, ...r }
      })
    )
    const failedMembers = needsAdd.filter((_, i) => {
      const r = memberResults[i]
      return r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)
    })

    // 3. Batch redeem staged clinic codes
    const clinicResults = await Promise.allSettled(
      stagedClinics.map(async (c, i) => {
        const r = await redeemInvite(c.code)
        return { index: i, ...r }
      })
    )
    const failedClinics = stagedClinics.filter((_, i) => {
      const r = clinicResults[i]
      return r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)
    })

    // 4. Batch remove selected items
    const allDeleteIds = [...deleteSelection]
    const clinicDeleteIds = allDeleteIds.filter((id) => associatedClinicIds.has(id))
    const memberDeleteIds = allDeleteIds.filter((id) => !associatedClinicIds.has(id))

    const deleteResults = await Promise.allSettled([
      ...memberDeleteIds.map((id) => removeClinicMember(clinicId, id)),
      ...clinicDeleteIds.map((id) => disassociateClinic(clinicId, id)),
    ])
    const failedDeletes = deleteResults.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success))

    // 5. Batch update edited profiles (skip members also being deleted)
    const editsToApply = [...stagedEdits.values()].filter(e => !deleteSelection.has(e.memberId))
    const editResults = await Promise.allSettled(
      editsToApply.map(async (edit) => {
        const { roles: _roles, ...profileChanges } = edit.changes
        const results: ServiceResult[] = []

        // Update profile fields if any changed
        if (Object.keys(profileChanges).length > 0) {
          results.push(await updateMemberProfile(edit.memberId, {
            firstName: profileChanges.firstName ?? undefined,
            lastName: profileChanges.lastName ?? undefined,
            middleInitial: profileChanges.middleInitial ?? undefined,
            credential: profileChanges.credential ?? undefined,
            component: profileChanges.component ?? undefined,
            rank: profileChanges.rank ?? undefined,
            uic: profileChanges.uic ?? undefined,
          }))
        }

        // Update roles if changed
        if (edit.changes.roles) {
          results.push(await setMemberRoles(edit.memberId, edit.changes.roles as ('medic' | 'supervisor' | 'provider')[]))
        }

        // Fail if any sub-operation failed
        const failed = results.find(r => !r.success)
        return failed ?? { success: true as const }
      })
    )
    const failedEditsList = editsToApply.filter((_, i) => {
      const r = editResults[i]
      return r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)
    })

    setSaving(false)
    clearExpandedState()
    invalidate('users', 'clinics')

    // Keep failed items staged, clear successful ones
    setStagedMembers(failedMembers)
    setStagedClinics(failedClinics)
    setStagedEdits(new Map(failedEditsList.map(e => [e.memberId, e])))

    const anyFailed = failedMembers.length > 0 || failedClinics.length > 0 || failedDeletes.length > 0 || failedEditsList.length > 0

    if (anyFailed) {
      const parts: string[] = []
      if (failedMembers.length > 0) parts.push(`${failedMembers.length} member add${failedMembers.length > 1 ? 's' : ''} failed`)
      if (failedClinics.length > 0) parts.push(`${failedClinics.length} clinic code${failedClinics.length > 1 ? 's' : ''} failed`)
      if (failedDeletes.length > 0) parts.push(`${failedDeletes.length} removal${failedDeletes.length > 1 ? 's' : ''} failed`)
      if (failedEditsList.length > 0) parts.push(`${failedEditsList.length} profile update${failedEditsList.length > 1 ? 's' : ''} failed`)
      setError(parts.join(', '))
    } else {
      onEditingChange(false)
      onDeleteSelectionChange(new Set())
      const parts: string[] = ['Clinic updated']
      if (stagedMembers.length > 0) parts.push(`${stagedMembers.length} member${stagedMembers.length > 1 ? 's' : ''} added`)
      if (stagedClinics.length > 0) parts.push(`${stagedClinics.length} clinic${stagedClinics.length > 1 ? 's' : ''} associated`)
      const removedCount = allDeleteIds.length - failedDeletes.length
      if (removedCount > 0) parts.push(`${removedCount} removed`)
      const editedCount = editsToApply.length - failedEditsList.length
      if (editedCount > 0) parts.push(`${editedCount} profile${editedCount > 1 ? 's' : ''} updated`)
      setSuccess(parts.join(', '))
      setTimeout(() => setSuccess(null), 3_000)
    }

    if (stagedMembers.length > failedMembers.length || memberDeleteIds.length > 0 || editsToApply.length > failedEditsList.length) refreshMedics()
    // Refresh associated IDs after clinic disassociations
    if (clinicDeleteIds.length > failedDeletes.length) {
      getClinicDetails(clinicId).then((d) => setClinicAssociatedIds(d.associatedClinicIds))
    }
  }, [clinicId, editName, editLocation, editUics, onEditingChange, stagedMembers, stagedClinics, stagedEdits, deleteSelection, associatedClinicIds, onDeleteSelectionChange, refreshMedics, redeemInvite, clearExpandedState])

  // ─── Inline Member Editing ──────────────────────────────────────

  const handleMemberTap = useCallback(async (memberId: string) => {
    // Toggle collapse if same card
    if (expandedMemberId === memberId) {
      clearExpandedState()
      return
    }

    setExpandedMemberId(memberId)
    setExpandedLoading(true)

    // Pre-fill from staged edits if available
    const staged = stagedEdits.get(memberId)
    if (staged) {
      const merged = { ...staged.original, ...staged.changes }
      setExpandedProfile(staged.original)
      populateEditForm(merged)
      setExpandedLoading(false)
      return
    }

    // Fetch fresh profile
    const result = await getMemberProfile(memberId)
    if (result.success && result.data) {
      setExpandedProfile(result.data)
      populateEditForm(result.data)
    } else {
      // Fetch failed — build fallback from list data so the form still opens
      const member = medics.find(m => m.id === memberId)
      const fallback: MemberProfileData = {
        firstName: member?.firstName ?? null,
        lastName: member?.lastName ?? null,
        middleInitial: member?.middleInitial ?? null,
        credential: member?.credential ?? null,
        component: null,
        rank: member?.rank ?? null,
        uic: null,
        roles: ['medic'],
      }
      setExpandedProfile(fallback)
      populateEditForm(fallback)
    }
    setExpandedLoading(false)
  }, [expandedMemberId, stagedEdits, medics, populateEditForm, clearExpandedState])

  const handleEditConfirm = useCallback(() => {
    if (!expandedMemberId || !expandedProfile) return

    const current = {
      firstName: editFirstName || null,
      lastName: editLastName || null,
      middleInitial: editMiddleInitial || null,
      credential: editCredential || null,
      component: editComponent || null,
      rank: editRank || null,
      uic: editUic || null,
      roles: editRoles,
    }

    // Build diff — only include changed fields
    const changes: Partial<MemberProfileData> = {}
    for (const key of Object.keys(current) as (keyof MemberProfileData)[]) {
      if (key === 'roles') {
        const origRoles = (expandedProfile.roles ?? ['medic']).slice().sort().join(',')
        const currRoles = editRoles.slice().sort().join(',')
        if (origRoles !== currRoles) {
          changes.roles = editRoles
        }
      } else {
        if (current[key] !== expandedProfile[key]) {
          (changes as Record<string, unknown>)[key] = current[key]
        }
      }
    }

    if (Object.keys(changes).length > 0) {
      setStagedEdits(prev => {
        const next = new Map(prev)
        next.set(expandedMemberId, { memberId: expandedMemberId, original: expandedProfile, changes })
        return next
      })
    }

    // Un-delete if was marked for deletion
    if (deleteSelection.has(expandedMemberId)) {
      const next = new Set(deleteSelection)
      next.delete(expandedMemberId)
      onDeleteSelectionChange(next)
    }

    clearExpandedState()
  }, [expandedMemberId, expandedProfile, editFirstName, editLastName, editMiddleInitial, editCredential, editComponent, editRank, editUic, editRoles, deleteSelection, onDeleteSelectionChange, clearExpandedState])

  const handleEditDelete = useCallback(() => {
    if (!expandedMemberId) return

    // Add to delete selection, remove from staged edits
    const nextDelete = new Set(deleteSelection)
    nextDelete.add(expandedMemberId)
    onDeleteSelectionChange(nextDelete)

    setStagedEdits(prev => {
      const next = new Map(prev)
      next.delete(expandedMemberId)
      return next
    })

    clearExpandedState()
  }, [expandedMemberId, deleteSelection, onDeleteSelectionChange, clearExpandedState])

  const handleEditComponentChange = useCallback((val: string) => {
    setEditComponent(val)
    if (val && editRank) {
      import('../../Data/User').then(({ ranksByComponent }) => {
        if (!ranksByComponent[val as import('../../Data/User').Component]?.includes(editRank)) {
          setEditRank('')
        }
      })
    }
  }, [editRank])

  // ─── Add Member Handlers ─────────────────────────────────────────

  const showAddFeedback = useCallback((type: 'error' | 'success', message: string) => {
    if (addFeedbackTimer.current) clearTimeout(addFeedbackTimer.current)
    setAddFeedback({ type, message })
    addFeedbackTimer.current = setTimeout(() => setAddFeedback(null), 4_000)
  }, [])

  const resetAddForm = useCallback(() => {
    setAddEmail('')
    setAddMode('lookup')
    setAddLookupResult(null)
    setAddFirstName('')
    setAddLastName('')
    setAddMiddleInitial('')
    setAddCredential('')
    setAddComponent('')
    setAddRank('')
    setAddUic('')
    setAddTempPassword('')
    setAddIsSupervisor(false)
    setAddFeedback(null)
    setStagedMembers([])
    setStagedClinics([])
    onAddingMemberChange(false)
  }, [onAddingMemberChange])

  const handleAddLookup = useCallback(async () => {
    if (!addEmail.trim()) return
    setAddFeedback(null)
    setAddLookupLoading(true)
    const result = await findUserByEmail(addEmail.trim())
    setAddLookupLoading(false)
    if (!result.success) {
      showAddFeedback('error', result.error)
      return
    }
    if (result.found) {
      setStagedMembers(prev => {
        if (prev.some(m => m.userId === result.user_id)) return prev
        return [...prev, {
          userId: result.user_id!,
          firstName: result.first_name ?? '',
          lastName: result.last_name ?? '',
          rank: result.rank,
          credential: result.credential,
          email: addEmail.trim(),
        }]
      })
      setAddEmail('')
      setAddMode('lookup')
      setAddLookupResult(null)
    } else {
      setAddMode('create')
      setAddLookupResult(result)
      if (profile?.component) {
        setAddComponent(profile.component)
      }
    }
  }, [addEmail, showAddFeedback])

  const handleAddCreate = useCallback(async () => {
    if (!addFirstName.trim() || !addLastName.trim()) {
      showAddFeedback('error', 'First and last name required')
      return
    }
    if (addTempPassword.length < 12) {
      showAddFeedback('error', 'Password must be at least 12 characters')
      return
    }
    if (!clinicId) return
    setAddSubmitting(true)
    const result = await createClinicUser({
      clinicId,
      email: addEmail.trim(),
      tempPassword: addTempPassword,
      firstName: addFirstName.trim(),
      lastName: addLastName.trim(),
      middleInitial: addMiddleInitial || undefined,
      credential: addCredential || undefined,
      component: addComponent || undefined,
      rank: addRank || undefined,
      uic: addUic || undefined,
      roles: addRoles,
    })
    setAddSubmitting(false)
    if (result.success) {
      setStagedMembers(prev => [
        ...prev,
        {
          userId: result.data?.userId ?? '',
          firstName: addFirstName.trim(),
          lastName: addLastName.trim(),
          rank: addRank || null,
          credential: addCredential || null,
          email: addEmail.trim(),
          alreadyCreated: true,
        },
      ])
      setAddEmail('')
      setAddMode('lookup')
      setAddLookupResult(null)
      setAddFirstName('')
      setAddLastName('')
      setAddMiddleInitial('')
      setAddCredential('')
      setAddComponent('')
      setAddRank('')
      setAddUic('')
      setAddTempPassword('')
      setAddRoles(['medic'])
      setAddFeedback(null)
    } else {
      showAddFeedback('error', result.error)
    }
  }, [clinicId, addEmail, addTempPassword, addFirstName, addLastName, addMiddleInitial, addCredential, addComponent, addRank, addUic, addRoles, showAddFeedback])

  const handleAddComponentChange = useCallback((val: string) => {
    setAddComponent(val)
    if (val && addRank) {
      import('../../Data/User').then(({ ranksByComponent }) => {
        if (!ranksByComponent[val as import('../../Data/User').Component]?.includes(addRank)) {
          setAddRank('')
        }
      })
    }
  }, [addRank])

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

  const inboundPending = invites.filter(
    (i) => i.status === 'redeemed' && i.clinic_id === clinicId,
  )

  const memberCount = members.length

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
        {hookError && <ErrorDisplay message={hookError} />}
        {actionSuccess && <ErrorDisplay type="success" message={actionSuccess} />}
        {actionError && <ErrorDisplay message={actionError} />}
        {error && <ErrorDisplay message={error} />}
        {success && <ErrorDisplay type="success" message={success} />}

        {/* ── Clinic Identity Card ──────────────────────────────────── */}
        <section data-tour="clinic-identity-card" className="rounded-xl bg-themewhite2 px-4 py-3">
          {!clinicEditing ? (
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-primary truncate">
                  {profile.clinicName || (
                    <span className="text-tertiary/30 italic">No facility</span>
                  )}
                </p>
                <p className="text-[9pt] text-tertiary/50">
                  {isSupervisorRole
                    ? `${memberCount} personnel`
                    : (profile.uic || 'No UIC')}
                </p>
                {(clinicUics.length > 0 || clinicLocation) && (
                  <p className="text-[9pt] text-tertiary/40 mt-0.5 truncate">
                    {[clinicUics.join(', '), clinicLocation].filter(Boolean).join(' · ')}
                  </p>
                )}
                {activeCode && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[11px] font-mono tracking-[0.2em] text-tertiary/60 select-all">
                      {activeCode}
                    </span>
                    <ActionIconButton
                      onClick={handleCopy}
                      status={copied ? 'done' : 'idle'}
                      variant="copy"
                      title="Copy invite code"
                    />
                  </div>
                )}
              </div>
              {activeCode && (
                <div className="bg-white rounded-lg p-1.5 shrink-0">
                  <canvas ref={qrCanvasRef} className="w-16 h-16 rounded" />
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <TextInput label="Clinic Name" value={editName} onChange={setEditName} required />
              <TextInput
                label="Location"
                value={editLocation}
                onChange={setEditLocation}
                placeholder="Building / Room"
              />
              <TextInput
                label="UICs (comma-separated)"
                value={editUics}
                onChange={(v) => setEditUics(v.toUpperCase())}
                placeholder="W0ABCD, W0EFGH"
              />
            </div>
          )}
        </section>

        {/* ── Associated Clinics ────────────────────────────────────── */}
        <section data-tour="clinic-associated">
          <div className="pb-2 flex items-center gap-2">
            <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">Associated Clinics</p>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-tertiary/10 text-tertiary/50 font-medium">
              {nearbyClinicMap.length + stagedClinics.length}
            </span>
          </div>
          <div className="rounded-xl bg-themewhite2 overflow-hidden">
            <div className="px-4 py-3">
              {/* Join a Clinic — inline, edit-gated */}
              <div className={`overflow-hidden transition-all duration-300 ease-out ${
                clinicEditing ? 'max-h-150 opacity-100 mb-3' : 'max-h-0 opacity-0'
              }`}>
                <div data-tour="clinic-join-input" className="flex items-center gap-1.5">
                  <div className="relative flex flex-1 items-center rounded-full border border-themeblue3/10 shadow-xs bg-themewhite focus-within:border-themeblue1/30 focus-within:bg-themewhite2 transition-all duration-300">
                    <div className="pl-2 shrink-0 flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={handleToggleScan}
                        className="p-1.5 text-tertiary/50 hover:text-themeblue3 active:scale-95 transition-colors"
                        title="Scan QR code"
                      >
                        <Camera size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={handlePhotoUpload}
                        className="p-1.5 text-tertiary/50 hover:text-themeblue3 active:scale-95 transition-colors"
                        title="Upload QR photo"
                      >
                        <ImagePlus size={18} />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={joinCode}
                      onChange={(e) =>
                        setJoinCode(
                          e.target.value
                            .toUpperCase()
                            .replace(/[^0-9A-Z]/g, '')
                            .slice(0, 8),
                        )
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && joinCode.length > 0) handleStageClinicCode(joinCode)
                        if (e.key === 'Escape') setJoinCode('')
                      }}
                      placeholder="Enter invite code"
                      maxLength={8}
                      className="w-full bg-transparent outline-none text-sm text-primary px-2.5 py-2.5 rounded-full min-w-0 font-mono tracking-[0.15em] placeholder:font-sans placeholder:tracking-normal placeholder:text-tertiary/30"
                    />
                  </div>
                  {joinCode && (
                    <>
                      <button
                        type="button"
                        onClick={() => setJoinCode('')}
                        className="animate-spring-in shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all"
                      >
                        <X size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStageClinicCode(joinCode)}
                        className="animate-spring-in shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-themeblue3 text-white active:scale-95 transition-all"
                      >
                        <Check size={18} />
                      </button>
                    </>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>

                {scanning && (
                  <div className="mt-3 relative w-full aspect-4/3 rounded-lg overflow-hidden bg-black/5 border border-tertiary/10">
                    <video
                      ref={videoRef}
                      className="absolute inset-0 w-full h-full object-cover"
                      playsInline
                      muted
                    />
                    {!isScanning && !scanError && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <p className="text-xs text-tertiary">Starting camera...</p>
                      </div>
                    )}
                  </div>
                )}

                <div className={`overflow-hidden transition-all duration-300 ease-out ${
                  (joinFeedback?.type === 'error') || scanError ? 'max-h-12 opacity-100 mt-1' : 'max-h-0 opacity-0'
                }`}>
                  <div className="text-xs font-medium text-center py-1.5 px-4 rounded-b-xl text-themeredred bg-themeredred/5">
                    {joinFeedback?.message || scanError}
                  </div>
                </div>
              </div>

              {/* Clinic list */}
              {nearbyClinicMap.length === 0 && inboundPending.length === 0 && stagedClinics.length === 0 ? (
                <p className="text-sm text-tertiary/50 py-4 text-center">No associated clinics</p>
              ) : (
                <div className="space-y-1">
                  {/* Inbound requests — inline at top */}
                  {inboundPending.map((invite) => (
                    <div
                      key={invite.id}
                      className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-secondary/5 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full flex items-center justify-center bg-tertiary/10 shrink-0">
                        <Building2 size={14} className="text-tertiary/50" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-primary truncate">
                          {invite.peer_clinic_name ?? 'Unknown clinic'}
                        </p>
                        <p className="text-[10px] text-themeyellow font-medium">Wants to connect</p>
                      </div>
                      {processingInviteId === invite.id ? (
                        <RefreshCw className="w-4 h-4 text-tertiary/40 animate-spin shrink-0" />
                      ) : (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleApprove(invite.id)}
                            className="w-8 h-8 rounded-full bg-themeblue3 flex items-center justify-center active:scale-95 transition-all"
                          >
                            <Check size={14} className="text-white" />
                          </button>
                          <button
                            onClick={() => handleReject(invite.id)}
                            className="w-8 h-8 rounded-full flex items-center justify-center text-tertiary/40 hover:text-themeredred active:scale-95 transition-all"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  {stagedClinics.map((staged) => (
                    <div
                      key={`staged-clinic-${staged.code}`}
                      onClick={clinicEditing ? () => setStagedClinics(prev => prev.filter(c => c.code !== staged.code)) : undefined}
                      className="flex items-center gap-3 py-2 px-2 rounded-lg border border-dashed border-themeblue2/30 bg-themeblue2/5 cursor-pointer active:scale-95 transition-all"
                    >
                      <div className="w-8 h-8 rounded-full flex items-center justify-center bg-themeblue2/10 shrink-0">
                        <Building2 size={14} className="text-themeblue2" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-primary font-mono tracking-wide">{staged.code}</p>
                      </div>
                    </div>
                  ))}
                  {nearbyClinicMap.map((clinic) => {
                    const isSelected = deleteSelection.has(clinic.clinicId)
                    return (
                      <div
                        key={clinic.clinicId}
                        onClick={clinicEditing ? () => handleToggleDeleteSelect(clinic.clinicId) : undefined}
                        className={`flex items-center gap-3 py-2 px-2 rounded-lg transition-colors ${
                          clinicEditing
                            ? `cursor-pointer active:scale-95 ${isSelected ? 'ring-1 ring-inset ring-themeredred/30 bg-themeredred/5' : 'hover:bg-secondary/5'}`
                            : 'hover:bg-secondary/5'
                        }`}
                      >
                        {clinicEditing && isSelected ? (
                          <div className="w-8 h-8 rounded-full flex items-center justify-center bg-themeredred shrink-0">
                            <CircleX size={14} className="text-white" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-full flex items-center justify-center bg-tertiary/10 shrink-0">
                            <Building2 size={14} className="text-tertiary/50" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-primary truncate">
                            {clinic.clinicName}
                            <span className="text-tertiary/50 font-normal"> · {clinic.count} personnel</span>
                          </p>
                          {(clinic.uics.length > 0 || clinic.location) && (
                            <p className="text-[10px] text-tertiary/50 truncate">
                              {[clinic.uics.join(', '), clinic.location].filter(Boolean).join(' · ')}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── Personnel (supervisor-gated) ──────────────────────────── */}
        {isSupervisorRole && clinicId && (
          <section data-tour="clinic-personnel">
            <div className="pb-2 flex items-center gap-2">
              <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">Personnel</p>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-tertiary/10 text-tertiary/50 font-medium">
                {memberCount + stagedMembers.length}
              </span>
            </div>

            {/* Create new user — separate card when active */}
            <div className={`overflow-hidden transition-all duration-300 ease-out ${
              clinicEditing && addMode === 'create' ? 'max-h-[600px] opacity-100 mb-3' : 'max-h-0 opacity-0'
            }`}>
              <div className="rounded-xl bg-themewhite2 overflow-hidden px-4 py-3 space-y-3">
                <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">New User</p>

                <div className="flex items-center gap-1.5">
                  <div className="relative flex flex-1 items-center rounded-full border border-themeblue3/10 shadow-xs bg-themewhite focus-within:border-themeblue1/30 focus-within:bg-themewhite2 transition-all duration-300">
                    <input
                      type="email"
                      value={addEmail}
                      onChange={(e) => { setAddEmail(e.target.value); if (addMode !== 'lookup') { setAddMode('lookup'); setAddLookupResult(null) } }}
                      placeholder="Email"
                      disabled
                      className="w-full bg-transparent outline-none text-sm text-primary px-3.5 py-2.5 rounded-full min-w-0 placeholder:text-tertiary/30 disabled:opacity-60"
                    />
                  </div>
                </div>

                <div className={`overflow-hidden transition-all duration-300 ease-out ${
                  addFeedback?.type === 'error' ? 'max-h-12 opacity-100' : 'max-h-0 opacity-0'
                }`}>
                  <div className="text-xs font-medium text-center py-1.5 px-4 rounded-full text-themeredred bg-themeredred/5">
                    {addFeedback?.message}
                  </div>
                </div>

                <AddMemberCreateForm
                  firstName={addFirstName} onFirstName={setAddFirstName}
                  lastName={addLastName} onLastName={setAddLastName}
                  middleInitial={addMiddleInitial} onMiddleInitial={(v) => setAddMiddleInitial(v.toUpperCase().slice(0, 1))}
                  credential={addCredential} onCredential={setAddCredential}
                  component={addComponent} onComponent={handleAddComponentChange}
                  rank={addRank} onRank={setAddRank}
                  uic={addUic} onUic={(v) => setAddUic(v.toUpperCase())}
                  tempPassword={addTempPassword} onTempPassword={setAddTempPassword}
                  roles={addRoles} onRoles={setAddRoles}
                  submitting={addSubmitting}
                  onConfirm={handleAddCreate}
                  onCancel={() => { setAddMode('lookup'); setAddLookupResult(null) }}
                />
              </div>
            </div>

            {/* Edit member — separate card when expanded */}
            <div className={`overflow-hidden transition-all duration-300 ease-out ${
              expandedMemberId ? 'max-h-[700px] opacity-100 mb-3' : 'max-h-0 opacity-0'
            }`}>
              {expandedMemberId && (
                <MemberEditForm
                  loading={expandedLoading}
                  memberName={(() => {
                    const m = members.find(m => m.id === expandedMemberId)
                    return m ? `${m.rank ? m.rank + ' ' : ''}${m.lastName}, ${m.firstName}` : 'Member'
                  })()}
                  firstName={editFirstName} onFirstName={setEditFirstName}
                  lastName={editLastName} onLastName={setEditLastName}
                  middleInitial={editMiddleInitial} onMiddleInitial={(v) => setEditMiddleInitial(v.toUpperCase().slice(0, 1))}
                  credential={editCredential} onCredential={setEditCredential}
                  component={editComponent} onComponent={handleEditComponentChange}
                  rank={editRank} onRank={setEditRank}
                  uic={editUic} onUic={(v) => setEditUic(v.toUpperCase())}
                  roles={editRoles} onRoles={setEditRoles}
                  onCancel={clearExpandedState}
                  onDelete={handleEditDelete}
                  onConfirm={handleEditConfirm}
                />
              )}
            </div>

            <div className="rounded-xl bg-themewhite2 overflow-hidden">
              <div className="px-4 py-3">
                {/* Add Member — inline, edit-gated (lookup mode only) */}
                <div className={`overflow-hidden transition-all duration-300 ease-out ${
                  clinicEditing && addMode !== 'create' ? 'max-h-40 opacity-100 mb-3' : 'max-h-0 opacity-0'
                }`}>
                  <div className="space-y-3">
                    <div data-tour="clinic-add-member" className="flex items-center gap-1.5">
                      <div className="relative flex flex-1 items-center rounded-full border border-themeblue3/10 shadow-xs bg-themewhite focus-within:border-themeblue1/30 focus-within:bg-themewhite2 transition-all duration-300">
                        <input
                          type="email"
                          value={addEmail}
                          onChange={(e) => { setAddEmail(e.target.value); if (addMode !== 'lookup') { setAddMode('lookup'); setAddLookupResult(null) } }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && addEmail.trim()) handleAddLookup()
                            if (e.key === 'Escape') { setAddEmail(''); setAddMode('lookup'); setAddLookupResult(null) }
                          }}
                          ref={addEmailRef}
                          placeholder="Add member by email"
                          className="w-full bg-transparent outline-none text-sm text-primary px-3.5 py-2.5 rounded-full min-w-0 placeholder:text-tertiary/30"
                        />
                      </div>
                      {addEmail.trim() && (
                        <>
                          <button
                            type="button"
                            onClick={() => { setAddEmail(''); setAddMode('lookup'); setAddLookupResult(null) }}
                            className="animate-spring-in shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all"
                          >
                            <X size={18} />
                          </button>
                          <button
                            type="button"
                            onClick={() => { if (addEmail.trim()) handleAddLookup() }}
                            disabled={addLookupLoading}
                            className="animate-spring-in shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-themeblue3 text-white disabled:opacity-30 active:scale-95 transition-all"
                          >
                            {addLookupLoading ? <RefreshCw size={16} className="animate-spin" /> : <Check size={18} />}
                          </button>
                        </>
                      )}
                    </div>

                    <div className={`overflow-hidden transition-all duration-300 ease-out ${
                      addFeedback?.type === 'error' && addMode !== 'create' ? 'max-h-12 opacity-100' : 'max-h-0 opacity-0'
                    }`}>
                      <div className="text-xs font-medium text-center py-1.5 px-4 rounded-full text-themeredred bg-themeredred/5">
                        {addFeedback?.message}
                      </div>
                    </div>
                  </div>
                </div>

                {medicsLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <div className="w-4 h-4 border-2 border-themeblue3 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : members.length > 0 || stagedMembers.length > 0 ? (
                  <div className="space-y-1">
                    {stagedMembers.map((staged) => (
                      <div
                        key={`staged-${staged.userId}`}
                        onClick={clinicEditing ? () => setStagedMembers(prev => prev.filter(m => m.userId !== staged.userId)) : undefined}
                        className="flex items-center gap-3 py-2 px-2 rounded-lg border border-dashed border-themeblue2/30 bg-themeblue2/5 cursor-pointer active:scale-95 transition-all"
                      >
                        <UserAvatar
                          avatarId={undefined}
                          firstName={staged.firstName}
                          lastName={staged.lastName}
                          className="w-8 h-8"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-primary truncate">
                            {staged.rank && <span>{staged.rank} </span>}
                            {staged.lastName}, {staged.firstName}
                          </p>
                          {staged.credential && (
                            <p className="text-[10px] text-tertiary/50">{staged.credential}</p>
                          )}
                        </div>
                      </div>
                    ))}
                    {members.map((member) => {
                      const isExpanded = expandedMemberId === member.id
                      const isDeleted = deleteSelection.has(member.id)
                      const isEdited = stagedEdits.has(member.id)

                      return (
                        <div key={member.id} className="transition-all duration-200">
                          {/* Collapsed header row */}
                          <div
                            onClick={clinicEditing ? () => handleMemberTap(member.id) : undefined}
                            className={`flex items-center gap-3 py-2 px-2 rounded-lg transition-colors ${
                              clinicEditing
                                ? `cursor-pointer active:scale-95 ${
                                    isDeleted ? 'ring-1 ring-inset ring-themeredred/30 bg-themeredred/5'
                                    : isEdited ? 'border-l-2 border-themeblue2 bg-themeblue2/5'
                                    : 'hover:bg-secondary/5'
                                  }`
                                : 'hover:bg-secondary/5'
                            }`}
                          >
                            {clinicEditing && isDeleted ? (
                              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-themeredred shrink-0">
                                <CircleX size={14} className="text-white" />
                              </div>
                            ) : clinicEditing && isEdited ? (
                              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-themeblue2 shrink-0">
                                <Pencil size={12} className="text-white" />
                              </div>
                            ) : (
                              <UserAvatar
                                avatarId={member.avatarId}
                                firstName={member.firstName}
                                lastName={member.lastName}
                                className="w-8 h-8"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate text-primary">
                                {member.rank && (
                                  <span>{member.rank} </span>
                                )}
                                {member.lastName}, {member.firstName}
                                {member.middleInitial ? ` ${member.middleInitial}.` : ''}
                              </p>
                              <p className="text-[10px] text-tertiary/50 truncate">
                                {member.credential || ''}
                              </p>
                            </div>
                          </div>

                          {/* Edit indicator — highlight in list when expanded */}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-tertiary/50 py-4 text-center">No members assigned</p>
                )}

              </div>
            </div>
          </section>
        )}

      </div>
    </div>
  )
}

// ─── Private: Create New User Form ──────────────────────────────────

interface CreateFormProps {
  firstName: string; onFirstName: (v: string) => void
  lastName: string; onLastName: (v: string) => void
  middleInitial: string; onMiddleInitial: (v: string) => void
  credential: string; onCredential: (v: string) => void
  component: string; onComponent: (v: string) => void
  rank: string; onRank: (v: string) => void
  uic: string; onUic: (v: string) => void
  tempPassword: string; onTempPassword: (v: string) => void
  roles: ('medic' | 'supervisor' | 'provider')[]; onRoles: (v: ('medic' | 'supervisor' | 'provider')[]) => void
  submitting: boolean
  onConfirm: () => void
  onCancel: () => void
}

function AddMemberCreateForm(props: CreateFormProps) {
  const [userData, setUserData] = useState<{
    credentials: string[]
    components: string[]
    ranksByComponent: Record<string, string[]>
  } | null>(null)

  useEffect(() => {
    import('../../Data/User').then((mod) => {
      setUserData({
        credentials: mod.credentials,
        components: mod.components,
        ranksByComponent: mod.ranksByComponent,
      })
    })
  }, [])

  const componentRanks = props.component && userData
    ? userData.ranksByComponent[props.component] ?? []
    : []

  if (!userData) return null

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">No account found — create new user</p>

      <input
        type="password"
        value={props.tempPassword}
        onChange={(e) => props.onTempPassword(e.target.value)}
        placeholder="Temporary password (min 12 chars)"
        className="w-full rounded-full py-2.5 px-4 border border-themeblue3/10 shadow-xs focus:border-themeblue1/30 focus:bg-themewhite2 focus:outline-none text-sm bg-themewhite text-primary placeholder:text-tertiary/30 transition-all duration-300"
      />

      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          value={props.firstName}
          onChange={(e) => props.onFirstName(e.target.value)}
          placeholder="First name *"
          className="rounded-full py-2.5 px-4 border border-themeblue3/10 shadow-xs focus:border-themeblue1/30 focus:bg-themewhite2 focus:outline-none text-sm bg-themewhite text-primary placeholder:text-tertiary/30 transition-all duration-300"
        />
        <input
          type="text"
          value={props.lastName}
          onChange={(e) => props.onLastName(e.target.value)}
          placeholder="Last name *"
          className="rounded-full py-2.5 px-4 border border-themeblue3/10 shadow-xs focus:border-themeblue1/30 focus:bg-themewhite2 focus:outline-none text-sm bg-themewhite text-primary placeholder:text-tertiary/30 transition-all duration-300"
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={props.middleInitial}
          onChange={(e) => props.onMiddleInitial(e.target.value)}
          placeholder="MI"
          maxLength={1}
          className="w-11 shrink-0 text-center rounded-full py-2.5 border border-themeblue3/10 shadow-xs focus:border-themeblue1/30 focus:bg-themewhite2 focus:outline-none text-sm bg-themewhite text-primary placeholder:text-tertiary/30 transition-all duration-300"
        />
        <div className="flex-1 min-w-0">
          <PickerInput
            value={props.credential}
            onChange={props.onCredential}
            options={userData.credentials}
            placeholder="Credential"
          />
        </div>
        <div className="flex-1 min-w-0">
          <PickerInput
            value={props.rank}
            onChange={props.onRank}
            options={componentRanks}
            placeholder="Rank"
          />
        </div>
      </div>

      <div>
        <span className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase mb-1.5 block">UIC</span>
        <UicPinInput value={props.uic} onChange={props.onUic} spread />
      </div>

      <div className="flex items-center gap-2 pt-1">
        <label className="flex items-center gap-2.5 cursor-pointer min-w-0">
          <span className="text-sm text-primary">Supervisor</span>
          <div
            onClick={() => {
              const has = props.roles.includes('supervisor')
              props.onRoles(has ? props.roles.filter(r => r !== 'supervisor') : [...props.roles, 'supervisor'])
            }}
            className={`relative w-9 h-5 shrink-0 rounded-full transition-colors duration-200 ${
              props.roles.includes('supervisor') ? 'bg-themeblue3' : 'bg-tertiary/20'
            }`}
          >
            <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
              props.roles.includes('supervisor') ? 'translate-x-4' : 'translate-x-0'
            }`} />
          </div>
        </label>
        <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
          <span className="text-sm text-primary">Provider</span>
          <div
            onClick={() => {
              const has = props.roles.includes('provider')
              props.onRoles(has ? props.roles.filter(r => r !== 'provider') : [...props.roles, 'provider'])
            }}
            className={`relative w-9 h-5 shrink-0 rounded-full transition-colors duration-200 ${
              props.roles.includes('provider') ? 'bg-themeblue3' : 'bg-tertiary/20'
            }`}
          >
            <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
              props.roles.includes('provider') ? 'translate-x-4' : 'translate-x-0'
            }`} />
          </div>
        </label>
        <button
          type="button"
          onClick={props.onCancel}
          className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all"
        >
          <X size={18} />
        </button>
        <button
          type="button"
          onClick={props.onConfirm}
          disabled={props.submitting || !props.firstName.trim() || !props.lastName.trim() || props.tempPassword.length < 12}
          className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-themeblue3 text-white disabled:opacity-30 active:scale-95 transition-all"
        >
          {props.submitting ? <RefreshCw size={16} className="animate-spin" /> : <Check size={18} />}
        </button>
      </div>
    </div>
  )
}

// ─── Private: Member Edit Form (separate card) ──────────────────────

interface MemberEditFormProps {
  loading: boolean
  memberName: string
  firstName: string; onFirstName: (v: string) => void
  lastName: string; onLastName: (v: string) => void
  middleInitial: string; onMiddleInitial: (v: string) => void
  credential: string; onCredential: (v: string) => void
  component: string; onComponent: (v: string) => void
  rank: string; onRank: (v: string) => void
  uic: string; onUic: (v: string) => void
  roles: ('medic' | 'supervisor' | 'provider')[]; onRoles: (v: ('medic' | 'supervisor' | 'provider')[]) => void
  onCancel: () => void
  onDelete: () => void
  onConfirm: () => void
}

function MemberEditForm(props: MemberEditFormProps) {
  const [userData, setUserData] = useState<{
    credentials: string[]
    components: string[]
    ranksByComponent: Record<string, string[]>
  } | null>(null)

  const formRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    import('../../Data/User').then((mod) => {
      setUserData({
        credentials: mod.credentials,
        components: mod.components,
        ranksByComponent: mod.ranksByComponent,
      })
    })
  }, [])

  useEffect(() => {
    if (!props.loading && userData) {
      // Delay slightly to let the max-h transition start revealing the card
      const t = setTimeout(() => {
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }, 50)
      return () => clearTimeout(t)
    }
  }, [props.loading, userData])

  const componentRanks = props.component && userData
    ? userData.ranksByComponent[props.component] ?? []
    : []

  if (props.loading || !userData) {
    return (
      <div ref={formRef} className="rounded-xl bg-themewhite2 overflow-hidden px-4 py-3 flex items-center justify-center py-6">
        <div className="w-4 h-4 border-2 border-themeblue3 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div ref={formRef} className="rounded-xl bg-themewhite2 overflow-hidden px-4 py-3 space-y-3">
      <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">
        Editing — {props.memberName}
      </p>

      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          value={props.firstName}
          onChange={(e) => props.onFirstName(e.target.value)}
          placeholder="First name *"
          className="rounded-full py-2.5 px-4 border border-themeblue3/10 shadow-xs focus:border-themeblue1/30 focus:bg-themewhite2 focus:outline-none text-sm bg-themewhite text-primary placeholder:text-tertiary/30 transition-all duration-300"
        />
        <input
          type="text"
          value={props.lastName}
          onChange={(e) => props.onLastName(e.target.value)}
          placeholder="Last name *"
          className="rounded-full py-2.5 px-4 border border-themeblue3/10 shadow-xs focus:border-themeblue1/30 focus:bg-themewhite2 focus:outline-none text-sm bg-themewhite text-primary placeholder:text-tertiary/30 transition-all duration-300"
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={props.middleInitial}
          onChange={(e) => props.onMiddleInitial(e.target.value)}
          placeholder="MI"
          maxLength={1}
          className="w-11 shrink-0 text-center rounded-full py-2.5 border border-themeblue3/10 shadow-xs focus:border-themeblue1/30 focus:bg-themewhite2 focus:outline-none text-sm bg-themewhite text-primary placeholder:text-tertiary/30 transition-all duration-300"
        />
        <div className="flex-1 min-w-0">
          <PickerInput
            value={props.credential}
            onChange={props.onCredential}
            options={userData.credentials}
            placeholder="Credential"
          />
        </div>
        <div className="flex-1 min-w-0">
          <PickerInput
            value={props.component}
            onChange={props.onComponent}
            options={userData.components}
            placeholder="Component"
          />
        </div>
      </div>

      {props.component && (
        <PickerInput
          value={props.rank}
          onChange={props.onRank}
          options={componentRanks}
          placeholder="Rank"
        />
      )}

      <div>
        <span className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase mb-1.5 block">UIC</span>
        <UicPinInput value={props.uic} onChange={props.onUic} spread />
      </div>

      <div className="flex items-center gap-2 pt-1">
        <label className="flex items-center gap-2.5 cursor-pointer min-w-0">
          <span className="text-sm text-primary">Supervisor</span>
          <div
            onClick={() => {
              const has = props.roles.includes('supervisor')
              props.onRoles(has ? props.roles.filter(r => r !== 'supervisor') : [...props.roles, 'supervisor'])
            }}
            className={`relative w-9 h-5 shrink-0 rounded-full transition-colors duration-200 ${
              props.roles.includes('supervisor') ? 'bg-themeblue3' : 'bg-tertiary/20'
            }`}
          >
            <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
              props.roles.includes('supervisor') ? 'translate-x-4' : 'translate-x-0'
            }`} />
          </div>
        </label>
        <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
          <span className="text-sm text-primary">Provider</span>
          <div
            onClick={() => {
              const has = props.roles.includes('provider')
              props.onRoles(has ? props.roles.filter(r => r !== 'provider') : [...props.roles, 'provider'])
            }}
            className={`relative w-9 h-5 shrink-0 rounded-full transition-colors duration-200 ${
              props.roles.includes('provider') ? 'bg-themeblue3' : 'bg-tertiary/20'
            }`}
          >
            <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
              props.roles.includes('provider') ? 'translate-x-4' : 'translate-x-0'
            }`} />
          </div>
        </label>
        <button
          type="button"
          onClick={props.onCancel}
          className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all"
        >
          <X size={18} />
        </button>
        <button
          type="button"
          onClick={props.onDelete}
          className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-themeredred text-white active:scale-95 transition-all"
        >
          <CircleX size={18} />
        </button>
        <button
          type="button"
          onClick={props.onConfirm}
          className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-themeblue3 text-white active:scale-95 transition-all"
        >
          <Check size={18} />
        </button>
      </div>
    </div>
  )
}
