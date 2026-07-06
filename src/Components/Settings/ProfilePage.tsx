import { useState, useCallback, useRef } from 'react';
import { LogOut, ChevronRight, Trash2, Check, Copy, QrCode, Share2, Pencil, RefreshCw, CheckCircle, Plus, KeyRound, Mail } from 'lucide-react';
import bwipjs from 'bwip-js';
import { useAuth } from '../../Hooks/useAuth';
import { useAuthStore } from '../../stores/useAuthStore';
import { useNavigationStore } from '../../stores/useNavigationStore';
import { useCertifications } from '../../Hooks/useCertifications';
import { useIsMobile } from '../../Hooks/useIsMobile';
import type { Component } from '../../Data/User';
import { credentials, components, ranksByComponent } from '../../Data/User';
import { useAvatar } from '../../Utilities/AvatarContext';
import { getInitials } from '../../Utilities/nameUtils';
import { ConfirmDialog } from '@/Components/primitives/ConfirmDialog';
import { PinKeypad } from '@/Components/primitives/PinKeypad';
import { isPinEnabled, verifyPin } from '../../lib/pinService';
import { ActionButton } from '@/Components/primitives/ActionButton';
import { OverlayActionMenu } from '@/Components/primitives/OverlayActionMenu';
import { PreviewOverlay } from '../PreviewOverlay';
import { ActionPill } from '@/Components/primitives/ActionPill'
import { SkeletonRows } from '@/Components/primitives/Skeleton';
import { CertificationRow } from '../Certifications/CertificationRow';
import { CertOverlayFields } from '../Certifications/CertOverlayFields';
import { emptyCertForm } from '../Certifications/certHelpers';
import type { CertFormData } from '../Certifications/certHelpers';
import type { CertInput } from '../../lib/certificationService';
import { submitProfileChangeRequest } from '../../lib/accountRequestService';
import { updateOwnEmail } from '../../lib/authService';
import { isValidEmail } from '../../lib/adminService';
import { PickerInput, PasswordInput } from '@/Components/primitives/FormInputs';
import { ErrorDisplay } from '@/Components/primitives/ErrorDisplay';
import { supabase } from '../../lib/supabase';
import { reEncryptVaultKeys } from '../../lib/signal/vaultDevice';

interface ProfilePageProps {
    onAvatarClick: () => void;
    onSignOut: () => void;
    onDeleteAccount: () => Promise<{ success: boolean; error?: string }>;
}

export const ProfilePage = ({
    onAvatarClick,
    onSignOut,
    onDeleteAccount,
}: ProfilePageProps) => {
    const isMobile = useIsMobile();
    const { currentAvatar, customImage, isCustom, isInitials } = useAvatar();
    const { profile, user } = useAuth();
    const userEmail = useAuthStore(s => s.user?.email ?? '');
    const deviceRole = useAuthStore(s => s.deviceRole);

    const { certs, loading: certsLoading, addCert, updateCert, removeCert } = useCertifications();

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
            const filename = 'medical-ops-id-qr.png'
            const file = new File([blob], filename, { type: 'image/png' })
            try {
                if (navigator.canShare?.({ files: [file] })) {
                    await navigator.share({ files: [file], title: 'Medical Operations ID' })
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

    const handleCopyId = useCallback(async () => {
        if (!user?.id) return
        await navigator.clipboard.writeText(user.id)
    }, [user?.id])

    // Profile change-request popover (anchored to the corner pill — the pencil
    // collapses into the ellipsis menu, so anchor to the pill, not the button)
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
        if (!toolbarRef.current) return
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
        setProfileEdit({ anchor: toolbarRef.current.getBoundingClientRect() })
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

    // Self-service email change — direct edit gated behind a confirm dialog that
    // echoes the typed address. No verification email is possible (no BAA), so
    // the confirm is the only typo guard.
    const emailRowRef = useRef<HTMLButtonElement>(null)
    const [emailAnchor, setEmailAnchor] = useState<DOMRect | null>(null)
    const [newEmail, setNewEmail] = useState('')
    const [emailSubmitting, setEmailSubmitting] = useState(false)
    const [emailError, setEmailError] = useState<string | null>(null)
    const [showEmailConfirm, setShowEmailConfirm] = useState(false)

    const emailChanged = newEmail.trim().toLowerCase() !== userEmail.toLowerCase()
    const emailValid = isValidEmail(newEmail)

    const openEmailEdit = useCallback(() => {
        if (!emailRowRef.current) return
        setNewEmail(userEmail)
        setEmailError(null)
        setEmailAnchor(emailRowRef.current.getBoundingClientRect())
    }, [userEmail])

    const closeEmailEdit = useCallback(() => {
        setEmailAnchor(null)
        setEmailSubmitting(false)
        setEmailError(null)
        setShowEmailConfirm(false)
    }, [])

    const requestEmailConfirm = useCallback(() => {
        if (!emailChanged || !emailValid) return
        setEmailError(null)
        setShowEmailConfirm(true)
    }, [emailChanged, emailValid])

    const doEmailChange = useCallback(async () => {
        setEmailSubmitting(true)
        const result = await updateOwnEmail(newEmail)
        setEmailSubmitting(false)
        setShowEmailConfirm(false)
        if (result.success) closeEmailEdit()
        else setEmailError(result.error || 'Failed to change email')
    }, [newEmail, closeEmailEdit])

    // Self-service password reset — anchored overlay mirroring the email change.
    // Current password is re-verified via signInWithPassword before updateUser;
    // the confirm field is the only typo guard (no verification email — no BAA).
    const pwRowRef = useRef<HTMLButtonElement>(null)
    const [pwAnchor, setPwAnchor] = useState<DOMRect | null>(null)
    const [currentPw, setCurrentPw] = useState('')
    const [newPw, setNewPw] = useState('')
    const [confirmPw, setConfirmPw] = useState('')
    const [pwSubmitting, setPwSubmitting] = useState(false)
    const [pwError, setPwError] = useState<string | null>(null)
    const [pwSuccess, setPwSuccess] = useState(false)

    const pwValid = currentPw.length > 0 && newPw.length >= 12 && newPw === confirmPw

    const openPwEdit = useCallback(() => {
        if (!pwRowRef.current) return
        setCurrentPw(''); setNewPw(''); setConfirmPw('')
        setPwError(null); setPwSuccess(false)
        setPwAnchor(pwRowRef.current.getBoundingClientRect())
    }, [])

    const closePwEdit = useCallback(() => {
        setPwAnchor(null)
        setPwSubmitting(false)
        setPwError(null)
    }, [])

    const doPwChange = useCallback(async () => {
        if (!pwValid || !userEmail) return
        setPwError(null)
        setPwSubmitting(true)

        const { error: signInError } = await supabase.auth.signInWithPassword({
            email: userEmail,
            password: currentPw,
        })
        if (signInError) {
            setPwSubmitting(false)
            setPwError('Current password is incorrect')
            return
        }

        const { error: updateError } = await supabase.auth.updateUser({ password: newPw })
        if (updateError) {
            setPwSubmitting(false)
            setPwError(updateError.message)
            return
        }

        // Preserve the personal vault across the password change. We still hold the
        // OLD password here, so re-wrap the blob under the new password — otherwise
        // the next login derives a key that can't decrypt the old blob and trips the
        // destructive wipe. Best-effort: a failure here only falls back to that wipe.
        if (user?.id) {
            await reEncryptVaultKeys(user.id, currentPw, newPw).catch(() => {})
        }

        setPwSubmitting(false)
        setPwSuccess(true)
        setCurrentPw(''); setNewPw(''); setConfirmPw('')
    }, [pwValid, userEmail, currentPw, newPw, user?.id])

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
    const certFields = <CertOverlayFields form={certForm} setForm={setCertForm} isMobile={isMobile} datalistId="profile-cert-credentials" />

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
            <div className="px-5 pb-4 space-y-5 pt-[calc(var(--drawer-header-h,3.5rem)+0.75rem)]">
                {/* User Card */}
                <section>
                    <div className="pb-2 flex items-center gap-2">
                        <p className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">Profile</p>
                    </div>
                    <div className="relative">
                <div className="rounded-2xl bg-themewhite2 overflow-hidden">
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
                        <OverlayActionMenu
                            ref={toolbarRef}
                            shadow="sm"
                            items={[
                                { key: 'copy', label: 'Copy user ID', icon: Copy, onAction: handleCopyId },
                                { key: 'qr', label: 'Share ID QR', icon: QrCode, onAction: openShare },
                                { key: 'edit', label: 'Request profile change', icon: Pencil, onAction: openProfileEdit },
                            ]}
                        />
                    )}
                    </div>
                </section>

                {/* Certifications Card */}
                <section>
                    <div className="pb-2 flex items-center gap-2">
                        <p className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">Certifications</p>
                    </div>
                    <div className="relative"><div className="rounded-2xl bg-themewhite2 overflow-hidden">
                    {certsLoading && certs.length === 0 ? (
                        <SkeletonRows count={2} />
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


                {/* Account Actions */}
                <div className="rounded-2xl bg-themewhite2 overflow-hidden">
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
                                ref={pwRowRef}
                                onClick={openPwEdit}
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
                                ref={emailRowRef}
                                onClick={openEmailEdit}
                                className="flex items-center gap-3 w-full px-4 py-3.5 border-t border-tertiary/8 transition-all active:scale-95 hover:bg-themeblue2/5"
                            >
                                <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-tertiary/10">
                                    <Mail size={20} className="text-tertiary" />
                                </div>
                                <div className="flex-1 min-w-0 text-left">
                                    <span className="block text-sm font-medium text-primary">Email</span>
                                    {userEmail && (
                                        <span className="block text-[10pt] text-tertiary truncate">{userEmail}</span>
                                    )}
                                </div>
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
                rightFooter={
                    sharePopoverAnchor ? (
                        <ActionPill>
                            <ActionButton icon={Share2} label="Share image" onClick={handleShareImage} />
                        </ActionPill>
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
                rightFooter={
                    profileEdit && !profileSubmitted ? (
                        <ActionPill>
                            <ActionButton
                                icon={profileSubmitting ? RefreshCw : Check}
                                label={profileSubmitting ? 'Submitting…' : 'Submit'}
                                variant={profileSubmitting || !profileHasChanges || !profileUicValid ? 'disabled' : 'success'}
                                onClick={handleProfileSubmit}
                            />
                        </ActionPill>
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

            {/* Email change popover — direct self-service, confirm-gated */}
            <PreviewOverlay
                isOpen={!!emailAnchor}
                onClose={closeEmailEdit}
                anchorRect={emailAnchor}
                title="Change email"
                maxWidth={360}
                rightFooter={
                    emailAnchor ? (
                        <ActionPill>
                            <ActionButton
                                icon={Check}
                                label="Save"
                                variant={!emailChanged || !emailValid || emailSubmitting ? 'disabled' : 'success'}
                                onClick={requestEmailConfirm}
                            />
                        </ActionPill>
                    ) : undefined
                }
            >
                {emailAnchor && (
                    <div>
                        {emailError && (
                            <div className="px-4 pt-3">
                                <ErrorDisplay message={emailError} />
                            </div>
                        )}
                        <div className={`flex items-center border-b border-primary/6 ${isMobile ? 'px-4 py-3' : 'px-3 py-2.5'}`}>
                            <input
                                type="email"
                                value={newEmail}
                                onChange={(e) => setNewEmail(e.target.value)}
                                placeholder="name@example.mil"
                                autoCapitalize="off"
                                autoCorrect="off"
                                spellCheck={false}
                                className={`flex-1 bg-transparent text-primary placeholder:text-tertiary focus:outline-none ${isMobile ? 'text-base' : 'text-sm'}`}
                            />
                        </div>
                        <p className="px-4 py-3 text-[9pt] text-tertiary">
                            This is the address you sign in with. It changes immediately — there's no confirmation email.
                        </p>
                    </div>
                )}
            </PreviewOverlay>

            <ConfirmDialog
                visible={showEmailConfirm}
                title="Change login email?"
                subtitle={`You'll sign in with ${newEmail.trim()} from now on.`}
                confirmLabel="Yes, change email"
                variant="primary"
                processing={emailSubmitting}
                onConfirm={doEmailChange}
                onCancel={() => setShowEmailConfirm(false)}
            />

            {/* Password reset popover — self-service, re-verifies current password */}
            <PreviewOverlay
                isOpen={!!pwAnchor}
                onClose={closePwEdit}
                anchorRect={pwAnchor}
                title="Reset password"
                maxWidth={360}
                rightFooter={
                    pwAnchor && !pwSuccess ? (
                        <ActionPill>
                            <ActionButton
                                icon={pwSubmitting ? RefreshCw : Check}
                                label={pwSubmitting ? 'Updating…' : 'Update password'}
                                variant={!pwValid || pwSubmitting ? 'disabled' : 'success'}
                                onClick={doPwChange}
                            />
                        </ActionPill>
                    ) : undefined
                }
            >
                {pwAnchor && (pwSuccess ? (
                    <div className="px-5 py-8 flex flex-col items-center justify-center">
                        <div className="w-14 h-14 rounded-full bg-themegreen/10 flex items-center justify-center mb-4">
                            <CheckCircle size={28} className="text-themegreen" />
                        </div>
                        <h2 className="text-lg font-semibold text-primary">Password updated</h2>
                        <p className="text-sm text-tertiary mt-2 text-center">
                            Your password has been changed successfully.
                        </p>
                    </div>
                ) : (
                    <div>
                        {pwError && (
                            <div className="px-4 pt-3">
                                <ErrorDisplay message={pwError} />
                            </div>
                        )}
                        <PasswordInput
                            value={currentPw}
                            onChange={setCurrentPw}
                            placeholder="Current password"
                            autoComplete="current-password"
                        />
                        <PasswordInput
                            value={newPw}
                            onChange={setNewPw}
                            placeholder="New password (min 12 characters)"
                            autoComplete="new-password"
                            hint={newPw.length > 0 && newPw.length < 12 ? 'Password must be at least 12 characters' : undefined}
                        />
                        <PasswordInput
                            value={confirmPw}
                            onChange={setConfirmPw}
                            placeholder="Confirm new password"
                            autoComplete="new-password"
                            hint={confirmPw.length > 0 && newPw !== confirmPw ? 'Passwords do not match' : undefined}
                        />
                    </div>
                ))}
            </PreviewOverlay>

            {/* Add certification popover */}
            <PreviewOverlay
                isOpen={!!certAddAnchor}
                onClose={closeCertPopovers}
                anchorRect={certAddAnchor}
                title="Add certification"
                maxWidth={360}
                previewMaxHeight="60dvh"
                rightFooter={
                    certAddAnchor ? (
                        <ActionPill>
                            <ActionButton
                                icon={certSaving ? RefreshCw : Check}
                                label={certSaving ? 'Saving…' : 'Add'}
                                variant={certSaving || !certForm.title.trim() ? 'disabled' : 'success'}
                                onClick={handleCertAdd}
                            />
                        </ActionPill>
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
                        </div>
                    ) : undefined
                }
                rightFooter={
                    certEdit && editingCert ? (
                        <ActionPill>
                            <ActionButton
                                icon={certSaving ? RefreshCw : Check}
                                label={certSaving ? 'Saving…' : 'Save'}
                                variant={certSaving || !certForm.title.trim() ? 'disabled' : 'success'}
                                onClick={handleCertEdit}
                            />
                        </ActionPill>
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
        </div>
    );
};
