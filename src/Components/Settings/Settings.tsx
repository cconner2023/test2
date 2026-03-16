import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Moon, Sun, Shield, Lock, MessageSquare, Bell, Stethoscope, Scale, X, Building2, Pencil, Check } from 'lucide-react';
import { BaseDrawer } from '../BaseDrawer';
import { resizeImage } from '../../Hooks/useProfileAvatar';
import { useAvatar } from '../../Utilities/AvatarContext';
import { useUserProfile } from '../../Hooks/useUserProfile';
import { useSwipeBack } from '../../Hooks/useSwipeBack';
import { ReleaseNotesPanel } from './ReleaseNotesPanel';
import { UserProfileDisplay } from './UserProfileDisplay';
import { ProfileChangeRequestForm } from './ProfileChangeRequestForm';
import { PinSetupPanel } from './PinSetupPanel';
import { NotificationSettingsPanel } from './NotificationSettingsPanel';
import { FeedbackPanel } from './FeedbackPanel';
import { PrivacyPolicyPanel } from './PrivacyPolicyPanel';
import { NoteContentPanel } from './NoteContentPanel';
import { ProfilePage } from './ProfilePage';
import { ChangePasswordPanel } from './ChangePasswordPanel';
import { CertificationsPanel } from './CertificationsPanel';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../Hooks/useAuth';
import { useAuthStore } from '../../stores/useAuthStore';
import { clearAllUserData } from '../../lib/offlineDb';
import { clearServiceWorkerCaches } from '../../lib/cacheService';
import { deleteOwnAccount } from '../../lib/authService';
import { PANEL, PANEL_TARGET, type PanelId, type SettingsItem } from './SettingsTypes';
import { UI_TIMING } from '../../Utilities/constants';
import { MainSettingsPanel } from './MainSettingsPanel';
import { AvatarPickerPanel } from './AvatarPickerPanel';
import { ContentWrapper } from './ContentWrapper';
import { HeaderPill, PillButton } from '../HeaderPill';
import { SessionsDevicesPanel } from './SessionsDevicesPanel';
import { ClinicPanel } from './ClinicPanel';
import { ConfirmDialog } from '../ConfirmDialog';


interface SettingsDrawerProps {
    isVisible: boolean;
    onClose: () => void;
    isDarkMode: boolean;
    onToggleTheme: () => void;
    initialPanel?: 'main' | 'release-notes' | 'user-profile';
}

export const Settings = ({
    isVisible,
    onClose,
    isDarkMode,
    onToggleTheme,
    initialPanel,
}: SettingsDrawerProps) => {
    const { currentAvatar, setAvatar, avatarList, customImage, isCustom, setCustomImage, clearCustomImage } = useAvatar();
    const [activePanel, setActivePanel] = useState<'main' | 'release-notes' | 'avatar-picker' | 'user-profile' | 'user-profile-details' | 'profile-change-request' | 'pin-setup' | 'notification-settings' | 'feedback' | 'note-content' | 'privacy-policy' | 'change-password' | 'certifications' | 'sessions-devices' | 'clinic'>('main');
    const { profile, updateProfile } = useUserProfile();
    const [slideDirection, setSlideDirection] = useState<'left' | 'right' | ''>('');
    const prevVisibleRef = useRef(false);
    const [isSupabaseConnected, setIsSupabaseConnected] = useState(false);
    const { user, signOut, isAuthenticated, isDevRole, isSupervisorRole, clinicId } = useAuth();
    const [clinicEditing, setClinicEditing] = useState(false);
    const [clinicSaveRequested, setClinicSaveRequested] = useState(false);
    const [clinicDeleteSelection, setClinicDeleteSelection] = useState<Set<string>>(new Set());
    const [clinicAddingMember, setClinicAddingMember] = useState(false);
    const [clinicHasPending, setClinicHasPending] = useState(false);
    const [showUnsavedGuard, setShowUnsavedGuard] = useState(false);
    const pendingGuardActionRef = useRef<(() => void) | null>(null);

    const guardedClinicAction = useCallback((action: () => void) => {
        if (clinicHasPending) {
            pendingGuardActionRef.current = action;
            setShowUnsavedGuard(true);
        } else {
            action();
        }
    }, [clinicHasPending]);

    const handleGuardConfirm = useCallback(() => {
        setShowUnsavedGuard(false);
        pendingGuardActionRef.current?.();
        pendingGuardActionRef.current = null;
    }, []);

    const handleGuardCancel = useCallback(() => {
        setShowUnsavedGuard(false);
        pendingGuardActionRef.current = null;
    }, []);

    // Supabase realtime WebSocket for device status — active only while settings is open
    useEffect(() => {
        if (!isVisible) {
            setIsSupabaseConnected(false);
            return;
        }

        const channel = supabase.channel('device-status-ping');

        channel.subscribe((status) => {
            setIsSupabaseConnected(status === 'SUBSCRIBED');
        });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [isVisible]);

    // Set initial panel when drawer opens
    useEffect(() => {
        if (isVisible && !prevVisibleRef.current) {
            setActivePanel(initialPanel || 'main');
            setSlideDirection('');
        }
        prevVisibleRef.current = isVisible;
    }, [isVisible, initialPanel]);

    const handleSlideAnimation = useCallback((direction: 'left' | 'right') => {
        setSlideDirection(direction);
        setTimeout(() => setSlideDirection(''), UI_TIMING.SLIDE_ANIMATION);
    }, []);

    const handleItemClick = useCallback((id: PanelId, closeDrawer: () => void) => {
        if (id === PANEL.CLOSE) { closeDrawer(); return; }
        if (id === PANEL.BACK_TO_MAIN) { handleSlideAnimation('right'); setActivePanel('main'); return; }

        // Toggle theme has no panel navigation
        if (id === PANEL.TOGGLE_THEME) return;

        // Look up the target panel name from the constant map
        const target = PANEL_TARGET[id];
        if (target) {
            handleSlideAnimation('left');
            setActivePanel(target as typeof activePanel);
        }
    }, [handleSlideAnimation]);

    const buildSettingsOptions = useCallback((closeDrawer: () => void): SettingsItem[] => {
        /** Shorthand for a standard menu option that navigates to a panel. */
        const opt = (id: PanelId, icon: React.ReactNode, label: string, overrides?: Partial<Extract<SettingsItem, { type: 'option' }>>): Extract<SettingsItem, { type: 'option' }> => ({
            type: 'option',
            icon,
            label,
            action: () => handleItemClick(id, closeDrawer),
            color: 'text-tertiary',
            id,
            ...overrides,
        });

        const items: SettingsItem[] = [];

        // CLINICS section — each clinic the user belongs to gets its own tile
        if (isAuthenticated) {
            items.push(
                { type: 'header', label: 'Clinics' },
                opt(PANEL.CLINIC, <Building2 size={20} />, profile.clinicName || 'My Clinic'),
            );
        }

        // PREFERENCES section
        items.push(
            { type: 'header', label: 'Preferences' },
            opt(PANEL.TOGGLE_THEME, isDarkMode ? <Sun size={20} /> : <Moon size={20} />, 'Toggle Theme', { action: onToggleTheme }),
            opt(PANEL.NOTE_CONTENT, <Stethoscope size={20} />, 'Note Content'),
            opt(PANEL.PIN_SETUP, <Lock size={20} />, 'Security'),
            opt(PANEL.NOTIFICATION_SETTINGS, <Bell size={20} />, 'Notifications'),
        );

        // ABOUT section
        items.push(
            { type: 'header', label: 'About' },
            opt(PANEL.RELEASE_NOTES, <Shield size={20} />, 'Release Notes'),
            opt(PANEL.FEEDBACK, <MessageSquare size={20} />, 'Feedback'),
            opt(PANEL.PRIVACY_POLICY, <Scale size={20} />, 'Privacy'),
        );

        return items;
    }, [isDarkMode, onToggleTheme, handleItemClick, isDevRole, isAuthenticated, isSupervisorRole, profile.clinicName]);

    // Swipe-back for sub-panels (mobile touch only)
    const swipeHandlers = useSwipeBack(
        useMemo(() => {
            if (activePanel === 'main') return undefined;
            // Sub-panels of the profile hub go back to user-profile
            if (activePanel === 'user-profile-details' || activePanel === 'change-password' || activePanel === 'certifications') {
                return () => { handleSlideAnimation('right'); setActivePanel('user-profile'); };
            }
            if (activePanel === 'profile-change-request') {
                return () => { handleSlideAnimation('right'); setActivePanel('user-profile-details'); };
            }
            // Sessions/Devices is nested under Security
            if (activePanel === 'sessions-devices') {
                return () => { handleSlideAnimation('right'); setActivePanel('pin-setup'); };
            }
            // clinic panel resets editing state on back
            if (activePanel === 'clinic') {
                const doBack = () => { handleSlideAnimation('right'); setClinicEditing(false); setClinicDeleteSelection(new Set()); setClinicAddingMember(false); setActivePanel('main'); };
                return () => guardedClinicAction(doBack);
            }
            return () => { handleSlideAnimation('right'); setActivePanel('main'); };
        }, [activePanel, handleSlideAnimation, guardedClinicAction]),
        activePanel !== 'main',
    );

    const handleClose = useCallback(() => {
        setActivePanel('main');
        setSlideDirection('');
        setClinicEditing(false);
        setClinicDeleteSelection(new Set());
        onClose();
    }, [onClose]);

    /** Shorthand: back button that slides right to a target panel (default: 'main'). */
    const backTo = useCallback((target: typeof activePanel = 'main') => ({
        showBack: true as const,
        onBack: () => { handleSlideAnimation('right'); setActivePanel(target); },
    }), [handleSlideAnimation]);

    const headerConfig = useMemo(() => {
        switch (activePanel) {
            case 'main':
                return {
                    title: 'Settings',
                    rightContent: (
                        <HeaderPill>
                            <PillButton icon={X} onClick={handleClose} label="Close" />
                        </HeaderPill>
                    ),
                    hideDefaultClose: true,
                };
            case 'profile-change-request':
                return { title: 'Request Changes', ...backTo('user-profile-details') };
            // Sub-panels of the profile hub go back to user-profile
            case 'user-profile-details': return { title: 'User Information', ...backTo('user-profile') };
            case 'change-password':     return { title: 'Change Password', ...backTo('user-profile') };
            case 'certifications':      return { title: 'Certifications', ...backTo('user-profile') };
            // All panels below slide right back to main
            case 'release-notes':       return { title: 'Release Notes', ...backTo() };
            case 'avatar-picker':       return { title: 'Choose Avatar', ...backTo() };
            case 'user-profile':        return { title: 'Profile', ...backTo() };
            case 'sessions-devices':    return { title: 'Sessions & Devices', ...backTo('pin-setup') };
            case 'pin-setup':           return { title: 'Security', ...backTo() };
            case 'notification-settings': return { title: 'Notifications', ...backTo() };
            case 'feedback':            return { title: 'Feedback', ...backTo() };
            case 'privacy-policy':      return { title: 'Privacy Policy', ...backTo() };
            case 'note-content':        return { title: 'Note Content', ...backTo() };
            case 'clinic': {
                const doClinicBack = () => { handleSlideAnimation('right'); setClinicEditing(false); setClinicDeleteSelection(new Set()); setActivePanel('main'); };
                const clinicBackTo = {
                    showBack: true as const,
                    onBack: () => guardedClinicAction(doClinicBack),
                };
                if (isSupervisorRole) {
                    const clinicPills = (
                        <HeaderPill>
                            <div className={`flex items-center overflow-hidden transition-all duration-200 ease-out ${
                                clinicEditing ? 'max-w-16 opacity-100' : 'max-w-0 opacity-0'
                            }`}>
                                <PillButton icon={X} iconSize={18} onClick={() => guardedClinicAction(() => { setClinicEditing(false); setClinicDeleteSelection(new Set()); setClinicAddingMember(false); })} label="Cancel" />
                            </div>
                            <div className={`flex items-center overflow-hidden transition-all duration-200 ease-out ${
                                !clinicEditing ? 'max-w-22 opacity-100' : 'max-w-0 opacity-0'
                            }`}>
                                <PillButton
                                    icon={Pencil}
                                    iconSize={18}
                                    onClick={() => setClinicEditing(true)}
                                    label="Edit"
                                />
                            </div>
                            {clinicEditing ? (
                                <PillButton
                                    icon={Check}
                                    iconSize={18}
                                    circleBg="bg-themegreen text-white"
                                    onClick={() => setClinicSaveRequested(true)}
                                    label="Save"
                                />
                            ) : (
                                <PillButton icon={X} onClick={() => guardedClinicAction(handleClose)} label="Close" />
                            )}
                        </HeaderPill>
                    );
                    return {
                        title: 'My Clinic',
                        ...clinicBackTo,
                        rightContent: clinicPills,
                        hideDefaultClose: true,
                    };
                }
                return { title: 'My Clinic', ...clinicBackTo };
            }

        }
    }, [activePanel, backTo, handleClose, isSupervisorRole, clinicEditing, handleSlideAnimation, guardedClinicAction]);

    return (<>
        <BaseDrawer
            isVisible={isVisible}
            onClose={handleClose}
            fullHeight="90dvh"
            disableDrag={false}
            desktopPosition="left"
            header={headerConfig}
        >
            {(handleClose) => (
                <ContentWrapper slideDirection={slideDirection} swipeHandlers={activePanel !== 'main' ? swipeHandlers : undefined}>
                    {(() => {
                        // Component lookup map — maps each panel name to its rendered JSX.
                        // Replaces the previous 18-branch ternary chain.
                        const panelMap: Partial<Record<typeof activePanel, React.ReactNode>> = {
                            'main': (
                                <MainSettingsPanel
                                    settingsOptions={buildSettingsOptions(handleClose)}
                                    onItemClick={(id) => handleItemClick(id, handleClose)}
                                    displayName={
                                        isAuthenticated
                                            ? (profile.lastName
                                                ? `${profile.rank ? profile.rank + ' ' : ''}${profile.lastName}${profile.firstName ? ', ' + profile.firstName.charAt(0) + '.' : ''}`
                                                : 'Set Up Profile')
                                            : 'Guest'
                                    }
                                    displaySub={
                                        isAuthenticated
                                            ? (profile.credential
                                                ? `${profile.credential}${profile.component ? ' \u00b7 ' + profile.component : ''}`
                                                : 'Tap to set up')
                                            : 'Tap to sign in'
                                    }
                                    onAvatarClick={() => handleItemClick(PANEL.AVATAR_PICKER, handleClose)}
                                    onProfileClick={() => {
                                        if (!isAuthenticated) {
                                            // Exit guest mode to show the LoginScreen
                                            useAuthStore.setState({ isGuest: false });
                                            handleClose();
                                        } else {
                                            handleItemClick(PANEL.USER_PROFILE, handleClose);
                                        }
                                    }}
                                    isConnected={isSupabaseConnected}
                                />
                            ),
                            'user-profile': (
                                <ProfilePage
                                    onAvatarClick={() => handleItemClick(PANEL.AVATAR_PICKER, handleClose)}
                                    onNavigate={(panel) => {
                                        handleSlideAnimation('left');
                                        setActivePanel(panel);
                                    }}
                                    onSignOut={async () => { await clearAllUserData(); await clearServiceWorkerCaches(); await signOut(); handleClose(); }}
                                    onDeleteAccount={async () => {
                                        const result = await deleteOwnAccount();
                                        if (!result.success) return result;
                                        await clearAllUserData();
                                        await clearServiceWorkerCaches();
                                        await signOut();
                                        handleClose();
                                        return { success: true };
                                    }}
                                />
                            ),
                            'user-profile-details': (
                                <UserProfileDisplay
                                    onRequestChange={() => handleItemClick(PANEL.PROFILE_CHANGE_REQUEST, handleClose)}
                                />
                            ),
                            'change-password':      <ChangePasswordPanel />,
                            'certifications':       <CertificationsPanel />,
                            'profile-change-request': <ProfileChangeRequestForm />,
                            'avatar-picker': (
                                <AvatarPickerPanel
                                    onSelect={(id) => {
                                        if (id === 'custom') {
                                            setAvatar('custom');
                                        } else {
                                            setAvatar(id);
                                        }
                                        handleSlideAnimation('right');
                                        setActivePanel('main');
                                    }}
                                    onUpload={async (file) => {
                                        try {
                                            const dataUrl = await resizeImage(file);
                                            setCustomImage(dataUrl);
                                            handleSlideAnimation('right');
                                            setActivePanel('main');
                                        } catch {
                                            // silently fail on unsupported image
                                        }
                                    }}
                                />
                            ),
                            'release-notes':        <ReleaseNotesPanel />,
                            'feedback':             <FeedbackPanel />,
                            'privacy-policy':       <PrivacyPolicyPanel />,
                            'note-content':         <NoteContentPanel />,
                            'notification-settings': <NotificationSettingsPanel />,
                            'sessions-devices':     <SessionsDevicesPanel />,
                            'pin-setup': (
                                <PinSetupPanel
                                    onNavigateToDevices={isAuthenticated ? () => {
                                        handleSlideAnimation('left');
                                        setActivePanel('sessions-devices');
                                    } : undefined}
                                />
                            ),
                            'clinic': (
                                <ClinicPanel
                                    clinicEditing={clinicEditing}
                                    onEditingChange={(v) => { setClinicEditing(v); if (!v) setClinicDeleteSelection(new Set()); }}
                                    saveRequested={clinicSaveRequested}
                                    onSaveComplete={() => setClinicSaveRequested(false)}
                                    deleteSelection={clinicDeleteSelection}
                                    onDeleteSelectionChange={setClinicDeleteSelection}
                                    addingMember={clinicAddingMember}
                                    onAddingMemberChange={setClinicAddingMember}
                                    onPendingChangesChange={setClinicHasPending}
                                />
                            ),
                        };
                        return panelMap[activePanel] ?? null;
                    })()}

                    {/* Pre-mounted panels — data loads when Settings opens, hidden until active */}
                </ContentWrapper>
            )}
        </BaseDrawer>
        <ConfirmDialog
            visible={showUnsavedGuard}
            title="Unsaved changes"
            subtitle="You have staged changes that haven't been saved. Discard them?"
            confirmLabel="Discard"
            cancelLabel="Keep editing"
            variant="warning"
            onConfirm={handleGuardConfirm}
            onCancel={handleGuardCancel}
        />
    </>
    );
};
