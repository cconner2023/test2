import { useState, useCallback, useMemo, useRef } from 'react';
import { LogOut, ChevronRight, Trash2, Calendar, Check, Copy, QrCode, Share2, Pencil, RefreshCw, CheckCircle, Plus, KeyRound, Dumbbell, Target } from 'lucide-react';
import bwipjs from 'bwip-js';
import { useAuth } from '../../Hooks/useAuth';
import { useAuthStore } from '../../stores/useAuthStore';
import { useCalendarStore } from '../../stores/useCalendarStore';
import { useNavigationStore } from '../../stores/useNavigationStore';
import { useCertifications } from '../../Hooks/useCertifications';
import { useMinLoadTime } from '../../Hooks/useMinLoadTime';
import { useIsMobile } from '../../Hooks/useIsMobile';
import { getCategoryMeta } from '../../Types/CalendarTypes';
import type { CalendarEvent } from '../../Types/CalendarTypes';
import type { Component } from '../../Data/User';
import { credentials, components, ranksByComponent } from '../../Data/User';
import { useAvatar } from '../../Utilities/AvatarContext';
import { getInitials } from '../../Utilities/nameUtils';
import { ConfirmDialog } from '../ConfirmDialog';
import { PinKeypad } from '../PinKeypad';
import { isPinEnabled, verifyPin } from '../../lib/pinService';
import { ActionButton } from '../ActionButton';
import { PreviewOverlay } from '../PreviewOverlay';
import { ActionPill } from '../ActionPill'
import { LoadingSpinner } from '../LoadingSpinner';
import { CertificationRow } from '../Certifications/CertificationRow';
import { CertOverlayFields } from '../Certifications/CertOverlayFields';
import { emptyCertForm } from '../Certifications/certHelpers';
import type { CertFormData } from '../Certifications/certHelpers';
import type { CertInput } from '../../lib/certificationService';
import { submitProfileChangeRequest } from '../../lib/accountRequestService';
import { PickerInput } from '../FormInputs';
import { ErrorDisplay } from '../ErrorDisplay';
import { aftStatusForSoldier } from '../../lib/aft/status';
import { openWorkoutGoals, recentWorkoutLogs } from '../../lib/aft/workoutHelpers';
import { useCalendarWrite } from '../../Hooks/useCalendarWrite';
import { generateId, toLocalISOString } from '../../Types/CalendarTypes';
import type { WorkoutLog } from '../../Types/CalendarTypes';
import { LogWorkoutPopover } from '../Fitness/LogWorkoutPopover';
import { visibleEventsForRole } from '../../lib/aft/visibility';

function formatEventDate(evt: CalendarEvent): string {
  const start = new Date(evt.start_time)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  const eventDay = new Date(start); eventDay.setHours(0, 0, 0, 0)

  let dayLabel: string
  if (eventDay.getTime() === today.getTime()) dayLabel = 'Today'
  else if (eventDay.getTime() === yesterday.getTime()) dayLabel = 'Yesterday'
  else if (eventDay.getTime() === tomorrow.getTime()) dayLabel = 'Tomorrow'
  else dayLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  if (evt.all_day) return dayLabel
  return `${dayLabel} · ${start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
}

interface ProfilePageProps {
    onAvatarClick: () => void;
    onNavigate: (panel: 'change-password') => void;
    onSignOut: () => void;
    onDeleteAccount: () => Promise<{ success: boolean; error?: string }>;
}

export const ProfilePage = ({
    onAvatarClick,
    onNavigate,
    onSignOut,
    onDeleteAccount,
}: ProfilePageProps) => {
    const isMobile = useIsMobile();
    const { currentAvatar, customImage, isCustom, isInitials } = useAvatar();
    const { profile, user } = useAuth();
    const userEmail = useAuthStore(s => s.user?.email ?? '');
    const deviceRole = useAuthStore(s => s.deviceRole);
    const isDevRole = useAuthStore(s => s.isDevRole);
    const calendarEvents = useCalendarStore(s => s.events);
    const setShowSettings = useNavigationStore(s => s.setShowSettings);
    const setShowCalendarDrawer = useNavigationStore(s => s.setShowCalendarDrawer);
    const setShowWorkoutDrawer = useNavigationStore(s => s.setShowWorkoutDrawer);
    const now = useMemo(() => new Date(), []);

    const { certs, loading: certsLoading, addCert, updateCert, removeCert } = useCertifications();
    const showCertsLoading = useMinLoadTime(certsLoading);

    const myEvents = useMemo(() => {
        if (!user?.id) return []
        const past7 = new Date(now); past7.setDate(past7.getDate() - 7)
        const future14 = new Date(now); future14.setDate(future14.getDate() + 14)
        const filtered = calendarEvents
            .filter(e => {
                const start = new Date(e.start_time)
                const end = new Date(e.end_time)
                return end >= past7 && start <= future14 && e.status !== 'cancelled' && e.assigned_to.includes(user.id)
            })
            .sort((a, b) => a.start_time.localeCompare(b.start_time))
        return visibleEventsForRole(filtered, isDevRole)
    }, [calendarEvents, user?.id, now, isDevRole])

    const handleOpenCalendar = useCallback(() => {
        setShowSettings(false)
        setShowCalendarDrawer(true)
    }, [setShowSettings, setShowCalendarDrawer])

    // Fitness — dev-gated; mirrors aft_record category visibility.
    const aftStatus = useMemo(() => {
        if (!isDevRole || !user?.id) return null
        return aftStatusForSoldier(user.id, calendarEvents, now)
    }, [isDevRole, user?.id, calendarEvents, now])

    const aftHistory = useMemo(() => {
        if (!isDevRole || !user?.id) return []
        return calendarEvents
            .filter(e => e.category === 'aft_record')
            .filter(e => e.assigned_to.includes(user.id))
            .filter(e => e.aft_result != null)
            .filter(e => new Date(e.start_time) <= now)
            .sort((a, b) => b.start_time.localeCompare(a.start_time))
            .slice(0, 6)
    }, [isDevRole, user?.id, calendarEvents, now])

    const aftGoals = useMemo(() => {
        if (!isDevRole || !user?.id) return []
        return calendarEvents
            .filter(e => e.category === 'aft_record')
            .filter(e => e.assigned_to.includes(user.id))
            .filter(e => e.aft_target != null && e.aft_result == null)
            .filter(e => new Date(e.start_time) >= now)
            .sort((a, b) => a.start_time.localeCompare(b.start_time))
    }, [isDevRole, user?.id, calendarEvents, now])

    const workoutGoals = useMemo(() => {
        if (!isDevRole || !user?.id) return []
        return openWorkoutGoals(user.id, calendarEvents, now)
    }, [isDevRole, user?.id, calendarEvents, now])

    const workoutHistory = useMemo(() => {
        if (!isDevRole || !user?.id) return []
        return recentWorkoutLogs(user.id, calendarEvents, now, 6)
    }, [isDevRole, user?.id, calendarEvents, now])

    // ─── Log workout popover ─────────────────────────────────────────────
    const { writeEvent, isWriting } = useCalendarWrite()
    const logFabRef = useRef<HTMLDivElement>(null)
    const [logAnchor, setLogAnchor] = useState<DOMRect | null>(null)
    const { clinicId } = useAuth()

    const openLogPopover = useCallback(() => {
        if (!logFabRef.current) return
        setLogAnchor(logFabRef.current.getBoundingClientRect())
    }, [])

    const closeLogPopover = useCallback(() => setLogAnchor(null), [])

    const handleLogSubmit = useCallback(async (log: WorkoutLog, title: string) => {
        if (!user?.id || !clinicId) return
        const start = new Date()
        start.setSeconds(0, 0)
        const end = new Date(start)
        end.setHours(end.getHours() + 1)
        const nowIso = new Date().toISOString()
        await writeEvent({
            id: generateId(),
            clinic_id: clinicId,
            title,
            description: null,
            category: 'workout',
            status: 'completed',
            start_time: toLocalISOString(start),
            end_time: toLocalISOString(end),
            all_day: false,
            location: null,
            opord_notes: null,
            uniform: null,
            report_time: null,
            assigned_to: [user.id],
            property_item_ids: [],
            room_id: null,
            huddle_task_id: null,
            structured_location: null,
            resource_allocations: null,
            workout_id: log.workout_id ?? null,
            workout_log: log,
            created_by: user.id,
            created_at: nowIso,
            updated_at: nowIso,
        })
        closeLogPopover()
    }, [user?.id, clinicId, writeEvent, closeLogPopover])

    // Sign out / delete dialogs
    const [showSignOut, setShowSignOut] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [deletePhase, setDeletePhase] = useState<'idle' | 'pin' | 'processing'>('idle');
    const [deleteError, setDeleteError] = useState('');
    const hasPinEnabled = isPinEnabled();

    // ID QR (small, inline on user card)
    const idQrCanvasRef = useCallback((canvas: HTMLCanvasElement | null) => {
        if (!canvas || !user?.id) return
        try {
            bwipjs.toCanvas(canvas, { bcid: 'qrcode', text: user.id, scale: 3, padding: 2 })
        } catch { /* non-critical */ }
    }, [user?.id])

    // Share QR popover
    const shareCanvasElRef = useRef<HTMLCanvasElement | null>(null)
    const sharePopoverCanvasRef = useCallback((canvas: HTMLCanvasElement | null) => {
        shareCanvasElRef.current = canvas
        if (!canvas || !user?.id) return
        try {
            bwipjs.toCanvas(canvas, { bcid: 'qrcode', text: user.id, scale: 8, padding: 4 })
        } catch { /* non-critical */ }
    }, [user?.id])

    const toolbarRef = useRef<HTMLDivElement>(null)
    const [sharePopoverAnchor, setSharePopoverAnchor] = useState<DOMRect | null>(null)
    const openShare = useCallback(() => {
        if (!toolbarRef.current) return
        setSharePopoverAnchor(toolbarRef.current.getBoundingClientRect())
    }, [])

    const handleShareImage = useCallback(() => {
        const canvas = shareCanvasElRef.current
        if (!canvas) return
        canvas.toBlob(async (blob) => {
            if (!blob) return
            const filename = 'beacon-id-qr.png'
            const file = new File([blob], filename, { type: 'image/png' })
            try {
                if (navigator.canShare?.({ files: [file] })) {
                    await navigator.share({ files: [file], title: 'Beacon ID' })
                    return
                }
            } catch { /* user cancelled — fall through */ }
            try {
                await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
                return
            } catch { /* clipboard image unsupported — fall through */ }
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

    const [idCopied, setIdCopied] = useState(false)
    const handleCopyId = useCallback(async () => {
        if (!user?.id) return
        await navigator.clipboard.writeText(user.id)
        setIdCopied(true)
        setTimeout(() => setIdCopied(false), 2000)
    }, [user?.id])

    // Profile change-request popover (anchored to pencil in ActionPill)
    const editIconRef = useRef<HTMLButtonElement>(null)
    const [profileEdit, setProfileEdit] = useState<{ anchor: DOMRect } | null>(null)
    const [pFirstName, setPFirstName] = useState('')
    const [pLastName, setPLastName] = useState('')
    const [pMiddleInitial, setPMiddleInitial] = useState('')
    const [pCredential, setPCredential] = useState('')
    const [pComponent, setPComponent] = useState('')
    const [pRank, setPRank] = useState('')
    const [pUic, setPUic] = useState('')
    const [pNotes, setPNotes] = useState('')
    const [profileSubmitting, setProfileSubmitting] = useState(false)
    const [profileError, setProfileError] = useState<string | null>(null)
    const [profileSubmitted, setProfileSubmitted] = useState(false)

    const componentRanks = pComponent ? ranksByComponent[pComponent as Component] : []

    const openProfileEdit = useCallback(() => {
        if (!editIconRef.current) return
        setPFirstName(profile.firstName ?? '')
        setPLastName(profile.lastName ?? '')
        setPMiddleInitial(profile.middleInitial ?? '')
        setPCredential(profile.credential ?? '')
        setPComponent(profile.component ?? '')
        setPRank(profile.rank ?? '')
        setPUic(profile.uic ?? '')
        setPNotes('')
        setProfileError(null)
        setProfileSubmitted(false)
        setProfileEdit({ anchor: editIconRef.current.getBoundingClientRect() })
    }, [profile])

    const closeProfileEdit = useCallback(() => {
        setProfileEdit(null)
        setProfileSubmitting(false)
        setProfileError(null)
        setProfileSubmitted(false)
    }, [])

    const handleProfileComponentChange = (val: string) => {
        setPComponent(val)
        if (val && pRank && !ranksByComponent[val as Component]?.includes(pRank)) {
            setPRank('')
        }
    }

    const profileHasChanges =
        pFirstName !== (profile.firstName ?? '') ||
        pLastName !== (profile.lastName ?? '') ||
        pMiddleInitial !== (profile.middleInitial ?? '') ||
        pCredential !== (profile.credential ?? '') ||
        pComponent !== (profile.component ?? '') ||
        pRank !== (profile.rank ?? '') ||
        pUic !== (profile.uic ?? '')

    const profileUicValid = pUic.trim().length === 6

    const handleProfileSubmit = async () => {
        if (!profileHasChanges || !profileUicValid) return
        setProfileSubmitting(true)
        setProfileError(null)
        const result = await submitProfileChangeRequest({
            email: userEmail,
            firstName: pFirstName,
            lastName: pLastName,
            middleInitial: pMiddleInitial || undefined,
            credential: pCredential || undefined,
            component: pComponent || undefined,
            rank: pRank || undefined,
            uic: pUic,
            notes: pNotes || undefined,
        })
        setProfileSubmitting(false)
        if (result.success) setProfileSubmitted(true)
        else setProfileError(result.error || 'Failed to submit request')
    }

    // Certifications popovers (inline card)
    const [certForm, setCertForm] = useState<CertFormData>(emptyCertForm)
    const [certSaving, setCertSaving] = useState(false)
    const [certAddAnchor, setCertAddAnchor] = useState<DOMRect | null>(null)
    const [certEdit, setCertEdit] = useState<{ certId: string; anchor: DOMRect } | null>(null)
    const [pendingDeleteCertId, setPendingDeleteCertId] = useState<string | null>(null)
    const [pendingDeletePrimary, setPendingDeletePrimary] = useState(false)
    const certAddFabRef = useRef<HTMLDivElement>(null)

    const closeCertPopovers = useCallback(() => {
        setCertAddAnchor(null)
        setCertEdit(null)
        setCertForm(emptyCertForm)
        setCertSaving(false)
    }, [])

    const certToInput = (): CertInput => ({
        title: certForm.title,
        cert_number: certForm.cert_number || null,
        issue_date: certForm.issue_date || null,
        exp_date: certForm.exp_date || null,
        is_primary: certForm.is_primary,
    })

    const handleCertAdd = useCallback(async () => {
        if (!certForm.title.trim()) return
        setCertSaving(true)
        const result = await addCert(certToInput())
        if (result.success) closeCertPopovers()
        else setCertSaving(false)
    }, [certForm, addCert, closeCertPopovers])

    const handleCertEdit = useCallback(async () => {
        if (!certForm.title.trim() || !certEdit) return
        setCertSaving(true)
        const result = await updateCert(certEdit.certId, certToInput())
        if (result.success) closeCertPopovers()
        else setCertSaving(false)
    }, [certForm, updateCert, closeCertPopovers, certEdit])

    const openCertAdd = useCallback(() => {
        if (!certAddFabRef.current) return
        setCertForm(emptyCertForm)
        setCertAddAnchor(certAddFabRef.current.getBoundingClientRect())
    }, [])

    const editingCert = certEdit ? certs.find(c => c.id === certEdit.certId) : null
    const pendingDeleteCert = pendingDeleteCertId ? certs.find(c => c.id === pendingDeleteCertId) : null
    const certFields = <CertOverlayFields form={certForm} setForm={setCertForm} isMobile={isMobile} />

    // Identity card display strings
    const displayName = profile.lastName
        ? `${profile.rank ? profile.rank + ' ' : ''}${profile.firstName || ''} ${profile.lastName}`
        : 'Set Up Profile';

    const displayCredential = profile.credential
        ? `${profile.credential}${profile.component ? ' · ' + profile.component : ''}`
        : null;

    const displayClinic = profile.clinicName
        ? `${profile.clinicName}${profile.uic ? ' · ' + profile.uic : ''}`
        : profile.uic
            ? `UIC: ${profile.uic}`
            : null;

    // Delete account flow handlers
    const handleDeleteConfirm = async () => {
        if (hasPinEnabled) {
            setShowDeleteDialog(false);
            setDeletePhase('pin');
            return;
        }
        setDeletePhase('processing');
        const result = await onDeleteAccount();
        if (!result.success) {
            setDeleteError(result.error || 'Failed to delete account');
            setDeletePhase('idle');
        }
    };

    const handlePinSubmit = async (pin: string) => {
        const valid = await verifyPin(pin);
        if (!valid) {
            setDeleteError('Incorrect passcode');
            return;
        }
        setDeleteError('');
        setDeletePhase('processing');
        const result = await onDeleteAccount();
        if (!result.success) {
            setDeleteError(result.error || 'Failed to delete account');
            setDeletePhase('pin');
        }
    };

    const resetDelete = () => {
        setShowDeleteDialog(false);
        setDeletePhase('idle');
        setDeleteError('');
    };

    return (
        <div className="h-full overflow-y-auto">
            <div className="px-5 py-4 space-y-5">
                {/* User Card */}
                <section>
                    <div className="pb-2 flex items-center gap-2">
                        <p className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">Profile</p>
                    </div>
                    <div className="relative">
                <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
                    <div className="flex items-center gap-4 px-4 py-4">
                        <div className="flex flex-col items-center shrink-0">
                            <button
                                onClick={onAvatarClick}
                                className="w-14 h-14 rounded-full overflow-hidden active:scale-95 transition-transform"
                            >
                                {isCustom && customImage ? (
                                    <img src={customImage} alt="Profile" className="w-full h-full object-cover" />
                                ) : isInitials ? (
                                    <div className="w-full h-full rounded-full bg-themeblue2/15 flex items-center justify-center">
                                        <span className="text-lg font-semibold text-themeblue2">
                                            {getInitials(profile.firstName, profile.lastName)}
                                        </span>
                                    </div>
                                ) : (
                                    <div className="w-full h-full [&>svg]:w-full [&>svg]:h-full">{currentAvatar.svg}</div>
                                )}
                            </button>
                            <button
                                onClick={onAvatarClick}
                                className="mt-1.5 text-[9pt] font-medium text-themeblue2 active:opacity-70 transition-opacity"
                            >
                                Edit Photo
                            </button>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-base font-semibold text-primary truncate">{displayName}</p>
                            {displayCredential && (
                                <p className="text-[10pt] text-tertiary mt-0.5 truncate">{displayCredential}</p>
                            )}
                            {displayClinic && (
                                <p className="text-[10pt] text-tertiary mt-0.5 truncate">{displayClinic}</p>
                            )}
                            {user?.id && (
                                <p className="text-[9pt] font-mono tracking-[0.2em] text-tertiary select-all mt-2">
                                    {user.id.slice(0, 8).toUpperCase()}
                                </p>
                            )}
                        </div>
                        {user?.id && (
                            <div className="bg-white rounded-lg p-1.5 shrink-0">
                                <canvas ref={idQrCanvasRef} className="w-16 h-16 rounded" />
                            </div>
                        )}
                    </div>
                    </div>
                    {user?.id && (
                        <ActionPill ref={toolbarRef} shadow="sm" placement="overlay">
                            <button
                                type="button"
                                onClick={handleCopyId}
                                aria-label="Copy user ID"
                                title="Copy user ID"
                                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                                    idCopied ? 'bg-themegreen/8 text-themegreen' : 'bg-themeblue2/8 text-primary'
                                }`}
                            >
                                {idCopied ? <Check size={16} /> : <Copy size={16} />}
                            </button>
                            <ActionButton icon={QrCode} label="Share ID QR" onClick={openShare} />
                            <button
                                ref={editIconRef}
                                type="button"
                                onClick={openProfileEdit}
                                aria-label="Request profile change"
                                title="Request profile change"
                                className="w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95 bg-themeblue2/8 text-primary"
                            >
                                <Pencil size={16} />
                            </button>
                        </ActionPill>
                    )}
                    </div>
                </section>

                {/* Certifications Card */}
                <section>
                    <div className="pb-2 flex items-center gap-2">
                        <p className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">Certifications</p>
                    </div>
                    <div className="relative"><div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
                    {showCertsLoading ? (
                        <LoadingSpinner label="Loading certifications..." className="py-12 text-tertiary" />
                    ) : certs.length === 0 ? (
                        <p className="text-sm text-tertiary py-6 text-center">No certifications</p>
                    ) : (
                        <div className="px-2 py-2 space-y-1">
                            {certs.map((cert) => (
                                <CertificationRow
                                    key={cert.id}
                                    cert={cert}
                                    onClick={(e) => {
                                        setCertForm({
                                            title: cert.title,
                                            cert_number: cert.cert_number ?? '',
                                            issue_date: cert.issue_date ?? '',
                                            exp_date: cert.exp_date ?? '',
                                            is_primary: cert.is_primary,
                                        })
                                        setCertEdit({
                                            certId: cert.id,
                                            anchor: e.currentTarget.getBoundingClientRect(),
                                        })
                                    }}
                                />
                            ))}
                        </div>
                    )}
                    </div>
                    <ActionPill ref={certAddFabRef} shadow="sm" placement="overlay">
                        <ActionButton icon={Plus} label="Add certification" onClick={openCertAdd} />
                    </ActionPill>
                    </div>
                </section>

                {/* Fitness — dev-gated */}
                {isDevRole && aftStatus && (
                    <div>
                        <p className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase mb-2">
                            Fitness
                        </p>
                        <div className="relative">
                        <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
                            <p className="text-[9pt] font-semibold text-tertiary uppercase tracking-wider px-4 pt-3 pb-1">AFT</p>
                            {/* Status header */}
                            {(() => {
                                const recencyDot =
                                    aftStatus.recency === 'current'  ? 'bg-themegreen' :
                                    aftStatus.recency === 'expiring' ? 'bg-themeyellow' :
                                    aftStatus.recency === 'expired'  ? 'bg-themeredred' :
                                                                       'bg-tertiary/40'
                                const recencyLabel =
                                    aftStatus.recency === 'current'  ? 'Current' :
                                    aftStatus.recency === 'expiring' ? 'Expiring soon' :
                                    aftStatus.recency === 'expired'  ? 'Overdue' :
                                                                       'Never tested'
                                return (
                                    <div className="flex items-center gap-3 px-4 py-3 border-b border-tertiary/8">
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-tertiary/10">
                                            <Dumbbell size={14} className="text-tertiary" />
                                        </div>
                                        <div className="flex-1 min-w-0 flex items-center gap-2">
                                            <span className={`w-2 h-2 rounded-full shrink-0 ${recencyDot}`} />
                                            <span className="text-sm text-primary truncate">
                                                {recencyLabel}
                                                {aftStatus.daysSinceLastTest != null && ` · ${aftStatus.daysSinceLastTest}d ago`}
                                            </span>
                                        </div>
                                        {aftStatus.lastTest && (
                                            <>
                                                <span className="text-[10pt] text-primary tabular-nums shrink-0 font-medium">
                                                    {aftStatus.lastTest.total}
                                                </span>
                                                <span className={`text-[9pt] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                                                    aftStatus.lastTest.allPassing
                                                        ? 'bg-themegreen/15 text-themegreen'
                                                        : 'bg-themeredred/15 text-themeredred'
                                                }`}>
                                                    {aftStatus.lastTest.allPassing ? 'PASS' : 'FAIL'}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                )
                            })()}

                            {/* Active goals (future-dated targets) */}
                            {aftGoals.length > 0 && (
                                <>
                                    <p className="text-[9pt] font-semibold text-tertiary uppercase tracking-wider px-4 pt-3 pb-1">
                                        Active goals ({aftGoals.length})
                                    </p>
                                    {aftGoals.map((evt, idx) => (
                                        <div
                                            key={evt.id}
                                            className={`flex items-center gap-3 px-4 py-3 ${idx > 0 ? 'border-t border-tertiary/8' : ''}`}
                                        >
                                            <Target size={14} className="text-themeyellow shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-primary truncate">{evt.title || 'AFT goal'}</p>
                                                <p className="text-[9pt] text-tertiary">Due {formatEventDate(evt)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </>
                            )}

                            {/* History */}
                            {aftHistory.length > 0 && (
                                <>
                                    <p className="text-[9pt] font-semibold text-tertiary uppercase tracking-wider px-4 pt-3 pb-1 border-t border-tertiary/8">
                                        Recent records
                                    </p>
                                    {aftHistory.map((evt, idx) => {
                                        const status = aftStatusForSoldier(user!.id, [evt], new Date(evt.end_time))
                                        const dateLabel = new Date(evt.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                        return (
                                            <div
                                                key={evt.id}
                                                className={`flex items-center gap-3 px-4 py-3 ${idx > 0 ? 'border-t border-tertiary/8' : ''}`}
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-primary truncate">{evt.title || 'AFT record'}</p>
                                                    <p className="text-[9pt] text-tertiary">{dateLabel}</p>
                                                </div>
                                                {status.lastTest ? (
                                                    <>
                                                        <span className="text-[10pt] text-primary tabular-nums shrink-0 font-medium">
                                                            {status.lastTest.total}
                                                        </span>
                                                        <span className={`text-[9pt] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                                                            status.lastTest.allPassing
                                                                ? 'bg-themegreen/15 text-themegreen'
                                                                : 'bg-themeredred/15 text-themeredred'
                                                        }`}>
                                                            {status.lastTest.allPassing ? 'PASS' : 'FAIL'}
                                                        </span>
                                                    </>
                                                ) : (
                                                    <span className="text-[9pt] text-tertiary shrink-0">—</span>
                                                )}
                                            </div>
                                        )
                                    })}
                                </>
                            )}

                            {/* ── Workouts subsection ─────────────────────────── */}
                            <p className="text-[9pt] font-semibold text-tertiary uppercase tracking-wider px-4 pt-4 pb-1 border-t border-tertiary/8">Workouts</p>

                            {workoutGoals.length > 0 && (
                                <>
                                    <p className="text-[9pt] text-tertiary px-4 pt-1 pb-1">Assigned ({workoutGoals.length})</p>
                                    {workoutGoals.map((evt, idx) => (
                                        <div
                                            key={evt.id}
                                            className={`flex items-center gap-3 px-4 py-3 ${idx > 0 ? 'border-t border-tertiary/8' : ''}`}
                                        >
                                            <Target size={14} className="text-themeyellow shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-primary truncate">{evt.title || 'Workout'}</p>
                                                <p className="text-[9pt] text-tertiary">Due {formatEventDate(evt)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </>
                            )}

                            {workoutHistory.length > 0 && (
                                <>
                                    <p className="text-[9pt] text-tertiary px-4 pt-3 pb-1 border-t border-tertiary/8">Recent logs</p>
                                    {workoutHistory.map((evt, idx) => {
                                        const setCount = evt.workout_log?.blocks.reduce((s, b) => s + b.sets.length, 0) ?? 0
                                        const blockCount = evt.workout_log?.blocks.length ?? 0
                                        const dateLabel = new Date(evt.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                        return (
                                            <div
                                                key={evt.id}
                                                className={`flex items-center gap-3 px-4 py-3 ${idx > 0 ? 'border-t border-tertiary/8' : ''}`}
                                            >
                                                <Dumbbell size={14} className="text-tertiary shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-primary truncate">{evt.title || 'Workout'}</p>
                                                    <p className="text-[9pt] text-tertiary">{dateLabel}</p>
                                                </div>
                                                <span className="text-[10pt] text-tertiary tabular-nums shrink-0">
                                                    {blockCount} {blockCount === 1 ? 'block' : 'blocks'} · {setCount} {setCount === 1 ? 'set' : 'sets'}
                                                </span>
                                            </div>
                                        )
                                    })}
                                </>
                            )}

                            {workoutGoals.length === 0 && workoutHistory.length === 0 && (
                                <p className="text-[10pt] text-tertiary px-4 py-3">No workout activity yet — tap Log workout to start.</p>
                            )}

                            {aftStatus.lastTest == null && aftGoals.length === 0 && workoutGoals.length === 0 && workoutHistory.length === 0 && (
                                <p className="text-sm text-tertiary px-4 py-3 border-t border-tertiary/8">No fitness data yet</p>
                            )}
                        </div>
                        <ActionPill ref={logFabRef} shadow="sm" placement="overlay">
                            <ActionButton icon={Calendar} label="Open full calendar" onClick={handleOpenCalendar} />
                            <ActionButton icon={Dumbbell} label="Open fitness" onClick={() => { setShowSettings(false); setShowWorkoutDrawer(true) }} />
                            <ActionButton icon={Plus} label="Log workout" onClick={openLogPopover} />
                        </ActionPill>
                        </div>
                    </div>
                )}

                {/* Schedule */}
                <div>
                    <p className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase mb-2">
                        Schedule
                    </p>
                    <div className="relative">
                        <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
                            {myEvents.length === 0 ? (
                                <p className="text-sm text-tertiary px-4 py-3">No events in the next 14 days</p>
                            ) : (
                                myEvents.map((evt, idx) => {
                                    const isPast = new Date(evt.end_time) < now
                                    const meta = getCategoryMeta(evt.category)
                                    return (
                                        <div
                                            key={evt.id}
                                            className={`flex items-center gap-3 px-4 py-3 transition-opacity ${idx > 0 ? 'border-t border-tertiary/8' : ''} ${isPast ? 'opacity-50' : ''}`}
                                        >
                                            <div className={`w-2 h-2 rounded-full shrink-0 ${meta.solidColor}`} />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-primary truncate">{evt.title}</p>
                                                <p className="text-[9pt] text-tertiary">{formatEventDate(evt)}</p>
                                            </div>
                                            <span className="text-[9pt] text-tertiary shrink-0 capitalize">{evt.category}</span>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                        <ActionPill shadow="sm" placement="overlay">
                            <ActionButton icon={Calendar} label="View in calendar" onClick={handleOpenCalendar} />
                        </ActionPill>
                    </div>
                </div>

                {/* Account Actions */}
                <div className="rounded-2xl border border-themeredred/10 bg-themewhite2 overflow-hidden">
                    {deletePhase === 'pin' ? (
                        <div className="px-4 py-5 flex flex-col items-center">
                            <PinKeypad
                                onSubmit={handlePinSubmit}
                                label="Enter passcode to confirm"
                                error={deleteError}
                            />
                            <button
                                onClick={resetDelete}
                                className="mt-4 px-6 py-2.5 rounded-xl border border-tertiary/15 bg-themewhite2 text-tertiary text-sm font-medium active:scale-95 transition-all"
                            >
                                Cancel
                            </button>
                        </div>
                    ) : deletePhase === 'processing' ? (
                        <div className="flex items-center justify-center py-8">
                            <p className="text-sm text-tertiary animate-pulse">Deleting account...</p>
                        </div>
                    ) : (
                        <>
                            <button
                                onClick={() => onNavigate('change-password')}
                                className="flex items-center gap-3 w-full px-4 py-3.5 transition-all active:scale-95 hover:bg-themeblue2/5"
                            >
                                <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-tertiary/10">
                                    <KeyRound size={20} className="text-tertiary" />
                                </div>
                                <span className="flex-1 text-left text-sm font-medium text-primary">
                                    Reset Password
                                </span>
                                <ChevronRight size={16} className="text-tertiary shrink-0" />
                            </button>
                            <button
                                onClick={deviceRole === 'primary' ? () => setShowSignOut(true) : onSignOut}
                                className="flex items-center gap-3 w-full px-4 py-3.5 border-t border-tertiary/8 transition-all active:scale-95 hover:bg-themeredred/5"
                            >
                                <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-themeredred/10">
                                    <LogOut size={20} className="text-themeredred" />
                                </div>
                                <span className="flex-1 text-left text-sm font-medium text-themeredred">
                                    Sign Out
                                </span>
                            </button>
                            <button
                                onClick={() => setShowDeleteDialog(true)}
                                className="flex items-center gap-3 w-full px-4 py-3.5 border-t border-tertiary/8 transition-all active:scale-95 hover:bg-themeredred/5"
                            >
                                <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-themeredred/5">
                                    <Trash2 size={20} className="text-themeredred/60" />
                                </div>
                                <span className="flex-1 text-left text-sm font-medium text-themeredred/60">
                                    Delete Account
                                </span>
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Sign Out Confirm Dialog */}
            <ConfirmDialog
                visible={showSignOut}
                title="Sign Out"
                subtitle="Signs out all linked devices. Conversations backed up, restored on next login."
                confirmLabel="Sign Out"
                variant="danger"
                onConfirm={() => { setShowSignOut(false); onSignOut(); }}
                onCancel={() => setShowSignOut(false)}
            />

            {/* Delete Account Confirm Dialog */}
            <ConfirmDialog
                visible={showDeleteDialog}
                title="Delete Account"
                subtitle="Permanent. All account data removed. Cannot be recovered."
                confirmLabel="Delete Account"
                variant="danger"
                processing={deletePhase === 'processing'}
                onConfirm={handleDeleteConfirm}
                onCancel={() => setShowDeleteDialog(false)}
            />

            {/* Share ID QR popover */}
            <PreviewOverlay
                isOpen={!!sharePopoverAnchor}
                onClose={() => setSharePopoverAnchor(null)}
                anchorRect={sharePopoverAnchor}
                title="Share ID"
                maxWidth={320}
                footer={
                    sharePopoverAnchor ? (
                        <div className="flex gap-1 bg-themewhite rounded-2xl shadow-lg px-1.5 py-1.5">
                            <ActionButton icon={Share2} label="Share image" onClick={handleShareImage} />
                        </div>
                    ) : undefined
                }
            >
                {sharePopoverAnchor && user?.id && (
                    <div className="px-4 py-3 flex flex-col items-center gap-3">
                        <div className="bg-white rounded-xl p-3">
                            <canvas ref={sharePopoverCanvasRef} className="w-56 h-56 rounded" />
                        </div>
                        <p className="text-[9pt] font-mono tracking-[0.2em] text-tertiary text-center select-all break-all">
                            {user.id}
                        </p>
                    </div>
                )}
            </PreviewOverlay>

            {/* Profile change-request popover — flat row stack matching cert overlay */}
            <PreviewOverlay
                isOpen={!!profileEdit}
                onClose={closeProfileEdit}
                anchorRect={profileEdit?.anchor ?? null}
                title="Request profile change"
                maxWidth={360}
                previewMaxHeight="70dvh"
                footer={
                    profileEdit && !profileSubmitted ? (
                        <div className="flex gap-1 bg-themewhite rounded-2xl shadow-lg px-1.5 py-1.5">
                            <ActionButton
                                icon={profileSubmitting ? RefreshCw : Check}
                                label={profileSubmitting ? 'Submitting…' : 'Submit'}
                                variant={profileSubmitting || !profileHasChanges || !profileUicValid ? 'disabled' : 'success'}
                                onClick={handleProfileSubmit}
                            />
                        </div>
                    ) : undefined
                }
            >
                {profileEdit && profileSubmitted ? (
                    <div className="px-4 py-6 flex flex-col items-center text-center gap-2">
                        <CheckCircle size={28} className="text-themegreen" />
                        <p className="text-sm font-medium text-primary">Request submitted</p>
                        <p className="text-[10pt] text-tertiary">An administrator will review your changes.</p>
                    </div>
                ) : profileEdit ? (
                    <div>
                        {profileError && (
                            <div className="px-4 pt-3">
                                <ErrorDisplay message={profileError} />
                            </div>
                        )}

                        <div className={`flex items-center border-b border-primary/6 ${isMobile ? 'px-4 py-3' : 'px-3 py-2.5'}`}>
                            <input
                                type="text"
                                value={pFirstName}
                                onChange={(e) => setPFirstName(e.target.value)}
                                placeholder="First name"
                                className={`flex-1 bg-transparent text-primary placeholder:text-tertiary focus:outline-none ${isMobile ? 'text-base' : 'text-sm'}`}
                            />
                        </div>
                        <div className={`flex items-center border-b border-primary/6 ${isMobile ? 'px-4 py-3' : 'px-3 py-2.5'}`}>
                            <input
                                type="text"
                                value={pLastName}
                                onChange={(e) => setPLastName(e.target.value)}
                                placeholder="Last name"
                                className={`flex-1 bg-transparent text-primary placeholder:text-tertiary focus:outline-none ${isMobile ? 'text-base' : 'text-sm'}`}
                            />
                        </div>
                        <div className={`flex items-center border-b border-primary/6 ${isMobile ? 'px-4 py-3' : 'px-3 py-2.5'}`}>
                            <input
                                type="text"
                                value={pMiddleInitial}
                                onChange={(e) => setPMiddleInitial(e.target.value.toUpperCase().slice(0, 1))}
                                placeholder="Middle initial"
                                maxLength={1}
                                className={`flex-1 bg-transparent text-primary placeholder:text-tertiary focus:outline-none ${isMobile ? 'text-base' : 'text-sm'}`}
                            />
                        </div>

                        <div className={`flex items-center justify-between border-b border-primary/6 ${isMobile ? 'px-4 py-3' : 'px-3 py-2.5'}`}>
                            <span className={`text-secondary ${isMobile ? 'text-base' : 'text-sm'}`}>Credential</span>
                            <div className="w-40">
                                <PickerInput value={pCredential} onChange={setPCredential} options={credentials} placeholder="None" />
                            </div>
                        </div>
                        <div className={`flex items-center justify-between border-b border-primary/6 ${isMobile ? 'px-4 py-3' : 'px-3 py-2.5'}`}>
                            <span className={`text-secondary ${isMobile ? 'text-base' : 'text-sm'}`}>Component</span>
                            <div className="w-40">
                                <PickerInput value={pComponent} onChange={handleProfileComponentChange} options={components} placeholder="None" />
                            </div>
                        </div>
                        {pComponent && (
                            <div className={`flex items-center justify-between border-b border-primary/6 ${isMobile ? 'px-4 py-3' : 'px-3 py-2.5'}`}>
                                <span className={`text-secondary ${isMobile ? 'text-base' : 'text-sm'}`}>Rank</span>
                                <div className="w-40">
                                    <PickerInput value={pRank} onChange={setPRank} options={componentRanks} placeholder="None" />
                                </div>
                            </div>
                        )}

                        <div className={`flex items-center border-b border-primary/6 ${isMobile ? 'px-4 py-3' : 'px-3 py-2.5'}`}>
                            <input
                                type="text"
                                value={pUic}
                                onChange={(e) => setPUic(e.target.value.toUpperCase().slice(0, 6))}
                                placeholder="UIC (6 characters)"
                                maxLength={6}
                                className={`flex-1 bg-transparent font-mono tracking-wider text-primary placeholder:font-sans placeholder:tracking-normal placeholder:text-tertiary focus:outline-none ${isMobile ? 'text-base' : 'text-sm'}`}
                            />
                        </div>
                        <div className={`${isMobile ? 'px-4 py-3' : 'px-3 py-2.5'}`}>
                            <textarea
                                value={pNotes}
                                onChange={(e) => setPNotes(e.target.value)}
                                placeholder="Reason for changes (optional)"
                                rows={2}
                                className={`w-full bg-transparent text-primary placeholder:text-tertiary focus:outline-none resize-none ${isMobile ? 'text-base' : 'text-sm'}`}
                            />
                        </div>
                    </div>
                ) : null}
            </PreviewOverlay>

            {/* Add certification popover */}
            <PreviewOverlay
                isOpen={!!certAddAnchor}
                onClose={closeCertPopovers}
                anchorRect={certAddAnchor}
                title="Add certification"
                maxWidth={360}
                previewMaxHeight="60dvh"
                footer={
                    certAddAnchor ? (
                        <div className="flex gap-1 bg-themewhite rounded-2xl shadow-lg px-1.5 py-1.5">
                            <ActionButton
                                icon={certSaving ? RefreshCw : Check}
                                label={certSaving ? 'Saving…' : 'Add'}
                                variant={certSaving || !certForm.title.trim() ? 'disabled' : 'success'}
                                onClick={handleCertAdd}
                            />
                        </div>
                    ) : undefined
                }
            >
                {certAddAnchor && certFields}
            </PreviewOverlay>

            {/* Edit certification popover */}
            <PreviewOverlay
                isOpen={!!certEdit}
                onClose={closeCertPopovers}
                anchorRect={certEdit?.anchor ?? null}
                title="Edit certification"
                maxWidth={360}
                previewMaxHeight="60dvh"
                footer={
                    certEdit && editingCert ? (
                        <div className="flex gap-1 bg-themewhite rounded-2xl shadow-lg px-1.5 py-1.5">
                            <ActionButton
                                icon={Trash2}
                                label="Delete certification"
                                variant="danger"
                                onClick={() => {
                                    setPendingDeleteCertId(editingCert.id)
                                    setPendingDeletePrimary(editingCert.is_primary)
                                }}
                            />
                            <ActionButton
                                icon={certSaving ? RefreshCw : Check}
                                label={certSaving ? 'Saving…' : 'Save'}
                                variant={certSaving || !certForm.title.trim() ? 'disabled' : 'success'}
                                onClick={handleCertEdit}
                            />
                        </div>
                    ) : undefined
                }
            >
                {certEdit && editingCert && certFields}
            </PreviewOverlay>

            <ConfirmDialog
                visible={!!pendingDeleteCertId}
                title={`Delete "${pendingDeleteCert?.title || 'this certification'}"?`}
                subtitle="Permanent."
                confirmLabel="Delete"
                variant="danger"
                onConfirm={async () => {
                    if (pendingDeleteCertId) {
                        const id = pendingDeleteCertId
                        const wasPrimary = pendingDeletePrimary
                        setPendingDeleteCertId(null)
                        setCertSaving(true)
                        await removeCert(id, wasPrimary)
                        setCertSaving(false)
                        closeCertPopovers()
                    }
                }}
                onCancel={() => setPendingDeleteCertId(null)}
            />

            <LogWorkoutPopover
                isOpen={logAnchor !== null}
                anchorRect={logAnchor}
                onClose={closeLogPopover}
                onSubmit={handleLogSubmit}
                saving={isWriting}
            />
        </div>
    );
};
