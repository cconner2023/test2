import { useState } from 'react';
import { User, Award, KeyRound, LogOut, ChevronRight, Trash2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../Hooks/useAuth';
import { useAuthStore } from '../../stores/useAuthStore';
import { useAvatar } from '../../Utilities/AvatarContext';
import { getInitials } from '../../Utilities/nameUtils';
import { PinKeypad } from '../PinKeypad';
import { isPinEnabled, verifyPin } from '../../lib/pinService';

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
    const { profile } = useAuth();
    const deviceRole = useAuthStore(s => s.deviceRole);
    const [confirmSignOut, setConfirmSignOut] = useState(false);

    // Delete account flow
    const [deletePhase, setDeletePhase] = useState<'idle' | 'confirm' | 'processing'>('idle');
    const [deleteError, setDeleteError] = useState('');
    const [confirmText, setConfirmText] = useState('');
    const hasPinEnabled = isPinEnabled();

    const displayName = profile.lastName
        ? `${profile.rank ? profile.rank + ' ' : ''}${profile.firstName || ''} ${profile.lastName}`
        : 'Set Up Profile';

    const displayCredential = profile.credential
        ? `${profile.credential}${profile.component ? ' \u00b7 ' + profile.component : ''}`
        : null;

    const displayClinic = profile.clinicName
        ? `${profile.clinicName}${profile.uic ? ' \u00b7 ' + profile.uic : ''}`
        : profile.uic
            ? `UIC: ${profile.uic}`
            : null;

    const menuItems = [
        { icon: <User size={20} />, label: 'Update User Information', panel: 'user-profile-details' as const },
        { icon: <Award size={20} />, label: 'Certifications', panel: 'certifications' as const },
        { icon: <KeyRound size={20} />, label: 'Change Password', panel: 'change-password' as const },
    ];

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
            setDeletePhase('confirm');
        }
    };

    const handleTypedConfirm = async () => {
        setDeletePhase('processing');
        const result = await onDeleteAccount();
        if (!result.success) {
            setDeleteError(result.error || 'Failed to delete account');
            setDeletePhase('confirm');
        }
    };

    const resetDelete = () => {
        setDeletePhase('idle');
        setDeleteError('');
        setConfirmText('');
    };

    return (
        <div className="h-full overflow-y-auto">
            <div className="px-4 py-3 md:p-5">
                {/* Avatar + User Info */}
                <div className="flex items-center px-4 py-3.5 md:px-5 md:py-3.5 mb-4">
                    <div className="mr-4 flex flex-col items-center shrink-0">
                        <button
                            onClick={onAvatarClick}
                            className="w-12 h-12 rounded-full overflow-hidden active:scale-95 transition-transform"
                        >
                            {isCustom && customImage ? (
                                <img src={customImage} alt="Profile" className="w-full h-full object-cover" />
                            ) : isInitials ? (
                                <div className="w-full h-full rounded-full bg-themeblue2/15 flex items-center justify-center">
                                    <span className="text-base font-semibold text-themeblue2">
                                        {getInitials(profile.firstName, profile.lastName)}
                                    </span>
                                </div>
                            ) : (
                                <div className="w-full h-full [&>svg]:w-full [&>svg]:h-full">{currentAvatar.svg}</div>
                            )}
                        </button>
                        <button
                            onClick={onAvatarClick}
                            className="mt-1.5 text-[11px] font-medium text-tertiary/60 active:opacity-70 transition-opacity"
                        >
                            Edit Photo
                        </button>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-base font-semibold text-primary md:text-[12pt] truncate">{displayName}</p>
                        {displayCredential && (
                            <p className="text-xs text-tertiary md:text-sm mt-0.5 truncate">{displayCredential}</p>
                        )}
                        {displayClinic && (
                            <p className="text-xs text-tertiary md:text-sm mt-0.5 truncate">{displayClinic}</p>
                        )}
                    </div>
                </div>

                {/* Menu Items */}
                <div className="border-t border-tertiary/10 pt-2">
                    {menuItems.map((item) => (
                        <button
                            key={item.panel}
                            onClick={() => onNavigate(item.panel)}
                            className="flex items-center w-full px-5 py-3.5 hover:bg-themewhite2 active:scale-[0.98]
                                       transition-all rounded-xl group"
                        >
                            <div className="mr-4 text-tertiary/60 group-hover:scale-110 transition-transform">
                                {item.icon}
                            </div>
                            <span className="flex-1 text-left text-base text-primary font-medium">
                                {item.label}
                            </span>
                            <ChevronRight size={18} className="text-tertiary/40" />
                        </button>
                    ))}

                    {/* Sign Out — hidden when delete flow is active */}
                    {deletePhase === 'idle' && (
                        confirmSignOut ? (
                            <div className="mt-2 px-5">
                                <p className="text-sm text-themeredred/80 mb-3">
                                    This will sign out all linked devices and delete your message backup.
                                </p>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={onSignOut}
                                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-themeredred/10 text-themeredred text-sm font-medium active:scale-[0.98] transition-all"
                                    >
                                        <LogOut size={16} />
                                        Confirm Sign Out
                                    </button>
                                    <button
                                        onClick={() => setConfirmSignOut(false)}
                                        className="px-4 py-2.5 rounded-xl border border-tertiary/15 bg-themewhite2 text-tertiary text-sm font-medium active:scale-[0.98] transition-all"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={deviceRole === 'primary' ? () => setConfirmSignOut(true) : onSignOut}
                                className="flex items-center w-full px-5 py-3.5 hover:bg-themeredred/5 active:scale-[0.98]
                                           transition-all rounded-xl group mt-2"
                            >
                                <div className="mr-4 text-themeredred group-hover:scale-110 transition-transform">
                                    <LogOut size={20} />
                                </div>
                                <span className="flex-1 text-left text-base text-themeredred font-medium">
                                    Sign Out
                                </span>
                            </button>
                        )
                    )}

                    {/* Delete Account — hidden when sign-out confirm is active */}
                    {!confirmSignOut && (
                        <>
                            {deletePhase === 'idle' ? (
                                <button
                                    onClick={() => { setDeletePhase('confirm'); setDeleteError(''); setConfirmText(''); }}
                                    className="flex items-center w-full px-5 py-3.5 hover:bg-themeredred/5 active:scale-[0.98]
                                               transition-all rounded-xl group mt-1"
                                >
                                    <div className="mr-4 text-themeredred/60 group-hover:scale-110 transition-transform">
                                        <Trash2 size={20} />
                                    </div>
                                    <span className="flex-1 text-left text-base text-themeredred/60 font-medium">
                                        Delete Account
                                    </span>
                                </button>
                            ) : (
                                <div className="mt-3 px-5 pb-4">
                                    {/* Warning header */}
                                    <div className="flex items-center gap-2 mb-2">
                                        <AlertTriangle size={16} className="text-themeredred shrink-0" />
                                        <p className="text-sm font-medium text-themeredred">Delete Account</p>
                                    </div>
                                    <p className="text-xs text-tertiary mb-4">
                                        This will permanently delete your account and all associated data.
                                        This action cannot be undone.
                                    </p>

                                    {deletePhase === 'processing' ? (
                                        <div className="flex items-center justify-center py-8">
                                            <p className="text-sm text-tertiary animate-pulse">Deleting account...</p>
                                        </div>
                                    ) : hasPinEnabled ? (
                                        /* PIN verification */
                                        <div className="flex flex-col items-center">
                                            <PinKeypad
                                                onSubmit={handlePinSubmit}
                                                label="Enter passcode to confirm"
                                                error={deleteError}
                                            />
                                            <button
                                                onClick={resetDelete}
                                                className="mt-4 px-6 py-2.5 rounded-xl border border-tertiary/15 bg-themewhite2 text-tertiary text-sm font-medium active:scale-[0.98] transition-all"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    ) : (
                                        /* Typed confirmation fallback (no PIN set) */
                                        <div>
                                            <p className="text-xs text-tertiary mb-2">
                                                Type <span className="font-semibold text-primary">DELETE</span> to confirm:
                                            </p>
                                            <input
                                                type="text"
                                                value={confirmText}
                                                onChange={(e) => { setConfirmText(e.target.value.toUpperCase()); setDeleteError(''); }}
                                                placeholder="DELETE"
                                                className="w-full px-3 py-2.5 rounded-xl border border-tertiary/15 bg-themewhite2 text-sm text-primary
                                                           placeholder:text-tertiary/40 focus:outline-none focus:ring-1 focus:ring-themeredred/30 mb-3"
                                                autoComplete="off"
                                                autoCapitalize="characters"
                                            />
                                            {deleteError && (
                                                <p className="text-xs text-themeredred mb-2">{deleteError}</p>
                                            )}
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={handleTypedConfirm}
                                                    disabled={confirmText !== 'DELETE'}
                                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-themeredred
                                                               text-white text-sm font-medium active:scale-[0.98] transition-all disabled:opacity-30"
                                                >
                                                    <Trash2 size={16} />
                                                    Delete Account
                                                </button>
                                                <button
                                                    onClick={resetDelete}
                                                    className="px-4 py-2.5 rounded-xl border border-tertiary/15 bg-themewhite2 text-tertiary
                                                               text-sm font-medium active:scale-[0.98] transition-all"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
