import { useState, useCallback, useMemo } from 'react';
import { User, Award, KeyRound, LogOut, ChevronRight, Trash2, Calendar } from 'lucide-react';
import bwipjs from 'bwip-js';
import { useAuth } from '../../Hooks/useAuth';
import { useAuthStore } from '../../stores/useAuthStore';
import { useCalendarStore } from '../../stores/useCalendarStore';
import { useNavigationStore } from '../../stores/useNavigationStore';
import { getCategoryMeta } from '../../Types/CalendarTypes';
import type { CalendarEvent } from '../../Types/CalendarTypes';
import { useAvatar } from '../../Utilities/AvatarContext';
import { getInitials } from '../../Utilities/nameUtils';
import { ConfirmDialog } from '../ConfirmDialog';
import { PinKeypad } from '../PinKeypad';
import { isPinEnabled, verifyPin } from '../../lib/pinService';
import { ActionIconButton } from '../WriteNoteHelpers';
import { ActionButton } from '../ActionButton';

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
    onNavigate: (panel: 'user-profile-details' | 'certifications' | 'change-password') => void;
    onSignOut: () => void;
    onDeleteAccount: () => Promise<{ success: boolean; error?: string }>;
}

export const ProfilePage = ({
    onAvatarClick,
    onNavigate,
    onSignOut,
    onDeleteAccount,
}: ProfilePageProps) => {
    const { currentAvatar, customImage, isCustom, isInitials } = useAvatar();
    const { profile, user } = useAuth();
    const deviceRole = useAuthStore(s => s.deviceRole);
    const calendarEvents = useCalendarStore(s => s.events);
    const setShowSettings = useNavigationStore(s => s.setShowSettings);
    const setShowCalendarDrawer = useNavigationStore(s => s.setShowCalendarDrawer);
    const now = useMemo(() => new Date(), []);

    const myEvents = useMemo(() => {
        if (!user?.id) return []
        const past7 = new Date(now); past7.setDate(past7.getDate() - 7)
        const future14 = new Date(now); future14.setDate(future14.getDate() + 14)
        return calendarEvents
            .filter(e => {
                const start = new Date(e.start_time)
                const end = new Date(e.end_time)
                return end >= past7 && start <= future14 && e.status !== 'cancelled' && e.assigned_to.includes(user.id)
            })
            .sort((a, b) => a.start_time.localeCompare(b.start_time))
    }, [calendarEvents, user?.id, now])

    const handleOpenCalendar = useCallback(() => {
        setShowSettings(false)
        setShowCalendarDrawer(true)
    }, [setShowSettings, setShowCalendarDrawer])

    // Sign out dialog
    const [showSignOut, setShowSignOut] = useState(false);

    // Delete account flow: dialog → optional PIN gate → processing
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [deletePhase, setDeletePhase] = useState<'idle' | 'pin' | 'processing'>('idle');
    const [deleteError, setDeleteError] = useState('');
    const hasPinEnabled = isPinEnabled();

    const idQrCanvasRef = useCallback((canvas: HTMLCanvasElement | null) => {
        if (!canvas || !user?.id) return
        try {
            bwipjs.toCanvas(canvas, {
                bcid: 'qrcode',
                text: user.id,
                scale: 3,
                padding: 2,
            })
        } catch { /* non-critical */ }
    }, [user?.id])

    const [idCopied, setIdCopied] = useState(false)
    const handleCopyId = useCallback(async () => {
        if (!user?.id) return
        await navigator.clipboard.writeText(user.id)
        setIdCopied(true)
        setTimeout(() => setIdCopied(false), 2000)
    }, [user?.id])

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

    const menuItems = [
        { icon: <User size={20} />, label: 'Update User Information', panel: 'user-profile-details' as const },
        { icon: <Award size={20} />, label: 'Certifications', panel: 'certifications' as const },
        { icon: <KeyRound size={20} />, label: 'Change Password', panel: 'change-password' as const },
    ];

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
                                <p className="text-xs text-tertiary mt-0.5 truncate">{displayCredential}</p>
                            )}
                            {displayClinic && (
                                <p className="text-xs text-tertiary mt-0.5 truncate">{displayClinic}</p>
                            )}
                            {user?.id && (
                                <div className="flex items-center gap-2 mt-2">
                                    <span className="text-[9pt] font-mono tracking-[0.2em] text-tertiary select-all">
                                        {user.id.slice(0, 8).toUpperCase()}
                                    </span>
                                    <ActionIconButton
                                        onClick={handleCopyId}
                                        status={idCopied ? 'done' : 'idle'}
                                        variant="copy"
                                        title="Copy user ID"
                                    />
                                </div>
                            )}
                        </div>
                        {user?.id && (
                            <div className="bg-white rounded-lg p-1.5 shrink-0">
                                <canvas ref={idQrCanvasRef} className="w-16 h-16 rounded" />
                            </div>
                        )}
                    </div>
                </div>

                {/* Options Card */}
                <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
                    {menuItems.map((item) => (
                        <button
                            key={item.panel}
                            onClick={() => onNavigate(item.panel)}
                            className="flex items-center gap-3 w-full px-4 py-3.5 transition-all active:scale-95 hover:bg-themeblue2/5"
                        >
                            <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-tertiary/10">
                                <div className="text-tertiary">{item.icon}</div>
                            </div>
                            <span className="flex-1 text-left text-sm font-medium text-primary">
                                {item.label}
                            </span>
                            <ChevronRight size={16} className="text-tertiary shrink-0" />
                        </button>
                    ))}
                </div>

                {/* Schedule */}
                <div>
                    <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider mb-2">
                        Schedule
                    </p>
                    <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
                        {myEvents.length === 0 ? (
                            <div className="flex items-center gap-3 px-4 py-3">
                                <p className="text-sm text-tertiary flex-1">No events in the next 14 days</p>
                                <div className="flex items-center gap-1 px-1.5 py-1.5 rounded-2xl bg-themewhite shadow-sm border border-tertiary/15">
                                    <ActionButton icon={Calendar} label="Open full calendar" onClick={handleOpenCalendar} />
                                </div>
                            </div>
                        ) : (
                            <>
                                {myEvents.map((evt, idx) => {
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
                                })}
                                <div className="flex items-center justify-end gap-3 px-4 py-2 border-t border-tertiary/8">
                                    <div className="flex items-center gap-1 px-1.5 py-1.5 rounded-2xl bg-themewhite shadow-sm border border-tertiary/15">
                                        <ActionButton icon={Calendar} label="View in calendar" onClick={handleOpenCalendar} />
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Danger Zone */}
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
                                onClick={deviceRole === 'primary' ? () => setShowSignOut(true) : onSignOut}
                                className="flex items-center gap-3 w-full px-4 py-3.5 transition-all active:scale-95 hover:bg-themeredred/5"
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
                                className="flex items-center gap-3 w-full px-4 py-3.5 transition-all active:scale-95 hover:bg-themeredred/5"
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
        </div>
    );
};
