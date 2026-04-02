import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Moon, Sun, Shield, Lock, MessageSquare, Bell, Stethoscope, Scale, X, Building2, Pencil, Check, Radio, Compass, Crosshair } from 'lucide-react';
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
import { PhysicalExamPanel } from './PhysicalExamPanel';
import { PlanPanel } from './PlanPanel';
import { TextTemplatesPanel } from './TextTemplatesPanel';
import { ProviderTemplatesPanel } from './ProviderTemplatesPanel';
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
import { GUIDED_TOURS_ENABLED } from '../../lib/featureFlags';
import { MainSettingsPanel } from './MainSettingsPanel';
import { AvatarPickerPanel } from './AvatarPickerPanel';
import { ContentWrapper } from './ContentWrapper';
import { HeaderPill, PillButton } from '../HeaderPill';
import { SessionsDevicesPanel } from './SessionsDevicesPanel';
import { ClinicPanel } from './ClinicPanel';
import { LoRaPanel } from './LoRaPanel';
import { ConfirmDialog } from '../ConfirmDialog';
import { GuidedToursPanel } from './GuidedToursPanel';
import { GUIDED_TEXT_EXPANDER } from '../../Data/GuidedTourData';


interface SettingsDrawerProps {
    isVisible: boolean;
    onClose: () => void;
    isDarkMode: boolean;
    onToggleTheme: () => void;
    initialPanel?: 'main' | 'release-notes' | 'user-profile' | 'feedback';
}

export const Settings = ({
    isVisible,
    onClose,
    isDarkMode,
    onToggleTheme,
    initialPanel,
}: SettingsDrawerProps) => {
    const { currentAvatar, setAvatar, avatarList, customImage, isCustom, setCustomImage, clearCustomImage } = useAvatar();
    const [activePanel, setActivePanel] = useState<'main' | 'release-notes' | 'avatar-picker' | 'user-profile' | 'user-profile-details' | 'profile-change-request' | 'pin-setup' | 'notification-settings' | 'feedback' | 'note-content' | 'privacy-policy' | 'change-password' | 'certifications' | 'sessions-devices' | 'clinic' | 'lora' | 'physical-exam' | 'plan-settings' | 'text-templates' | 'provider-templates' | 'guided-tours'>('main');
    const { profile, updateProfile } = useUserProfile();
    const [slideDirection, setSlideDirection] = useState<'left' | 'right' | ''>('');
    const prevVisibleRef = useRef(false);
    const [isSupabaseConnected, setIsSupabaseConnected] = useState(false);
    const { user, signOut, isAuthenticated, isDevRole, isSupervisorRole, clinicId } = useAuth();
    const [planEditing, setPlanEditing] = useState(false);
    const [planSaveRequested, setPlanSaveRequested] = useState(false);
    const [planHasPending, setPlanHasPending] = useState(false);
    const [templatesEditing, setTemplatesEditing] = useState(false);
    const [templatesSaveRequested, setTemplatesSaveRequested] = useState(false);
    const [templatesHasPending, setTemplatesHasPending] = useState(false);
    const [provTemplatesEditing, setProvTemplatesEditing] = useState(false);
    const [provTemplatesSaveRequested, setProvTemplatesSaveRequested] = useState(false);
    const [provTemplatesHasPending, setProvTemplatesHasPending] = useState(false);
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

    // Tour system: listen for panel navigation events
    useEffect(() => {
        const handler = (e: Event) => {
            const panel = (e as CustomEvent).detail as string;
            if (panel) {
                handleSlideAnimation('left');
                setActivePanel(panel as typeof activePanel);
            }
        };
        window.addEventListener('tour:settings-navigate', handler);
        return () => window.removeEventListener('tour:settings-navigate', handler);
    }, [handleSlideAnimation]);

    // Tour system: inject/cleanup demo text expander
    useEffect(() => {
        const inject = () => {
            const current = profile.textExpanders ?? [];
            if (current.some(e => e.abbr === 'hpi')) return;
            updateProfile({ textExpanders: [...current, GUIDED_TEXT_EXPANDER] });
        };
        const cleanup = () => {
            const current = profile.textExpanders ?? [];
            const filtered = current.filter(e => e.abbr !== 'hpi');
            if (filtered.length !== current.length) {
                updateProfile({ textExpanders: filtered });
            }
        };
        window.addEventListener('tour:inject-expander', inject);
        window.addEventListener('tour:cleanup-expander', cleanup);
        return () => {
            window.removeEventListener('tour:inject-expander', inject);
            window.removeEventListener('tour:cleanup-expander', cleanup);
        };
    }, [profile.textExpanders, updateProfile]);

    // Tour system: enable/disable editing mode for text expander demo
    useEffect(() => {
        const enableEdit = () => setTemplatesEditing(true);
        const disableEdit = () => {
            setTemplatesEditing(false);
            setTemplatesHasPending(false);
            setTemplatesSaveRequested(false);
        };
        window.addEventListener('tour:expander-enable-edit', enableEdit);
        window.addEventListener('tour:expander-cleanup', disableEdit);
        return () => {
            window.removeEventListener('tour:expander-enable-edit', enableEdit);
            window.removeEventListener('tour:expander-cleanup', disableEdit);
        };
    }, []);

    // Tour system: enable/disable editing mode for plan & order sets demo
    useEffect(() => {
        const enableEdit = () => setPlanEditing(true);
        const cancelEdit = () => {
            setPlanEditing(false);
            setPlanHasPending(false);
            setPlanSaveRequested(false);
        };
        window.addEventListener('tour:plan-enable-edit', enableEdit);
        window.addEventListener('tour:plan-cancel-edit', cancelEdit);
        return () => {
            window.removeEventListener('tour:plan-enable-edit', enableEdit);
            window.removeEventListener('tour:plan-cancel-edit', cancelEdit);
        };
    }, []);

    const handleItemClick = useCallback((id: PanelId, closeDrawer: () => void) => {
        if (id === PANEL.CLOSE) { closeDrawer(); return; }
        if (id === PANEL.BACK_TO_MAIN) { handleSlideAnimation('right'); setActivePanel('main'); return; }

        // Toggle theme / TC3 mode have no panel navigation
        if (id === PANEL.TOGGLE_THEME || id === PANEL.TC3_MODE) return;

        // Look up the target panel name from the constant map
        const target = PANEL_TARGET[id];
        if (target) {
            handleSlideAnimation('left');
            setActivePanel(target as typeof activePanel);
        }
    }, [handleSlideAnimation]);

    const buildSettingsOptions = useCallback((closeDrawer: () => void): SettingsItem[] => {
        /** Shorthand for a standard menu option that navigates to a panel. */
        const opt = (id: PanelId, icon: React.ReactNode, label: string, subtitle?: string, overrides?: Partial<Extract<SettingsItem, { type: 'option' }>>): Extract<SettingsItem, { type: 'option' }> => ({
            type: 'option',
            icon,
            label,
            subtitle,
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
                opt(PANEL.CLINIC, <Building2 size={20} />, profile.clinicName || 'My Clinic', 'Manage clinic and personnel'),
            );
        }

        // PREFERENCES section
        items.push(
            { type: 'header', label: 'Preferences' },
            opt(PANEL.TOGGLE_THEME, isDarkMode ? <Sun size={20} /> : <Moon size={20} />, 'Toggle Theme', isDarkMode ? 'Switch to light mode' : 'Switch to dark mode', { action: onToggleTheme }),
            opt(PANEL.NOTE_CONTENT, <Stethoscope size={20} />, 'Note Content', 'Exam blocks, templates, order sets'),
            opt(PANEL.PIN_SETUP, <Lock size={20} />, 'Security', 'App lock, biometrics, devices'),
            opt(PANEL.NOTIFICATION_SETTINGS, <Bell size={20} />, 'Notifications', 'Push subscriptions and alerts'),
        );

        // ABOUT section
        items.push(
            { type: 'header', label: 'About' },
            ...((GUIDED_TOURS_ENABLED || isDevRole) ? [opt(PANEL.GUIDED_TOURS, <Compass size={20} />, 'Guided Tours', 'Interactive feature walkthroughs')] : []),
            opt(PANEL.RELEASE_NOTES, <Shield size={20} />, 'Release Notes', 'What\'s new in this version'),
            opt(PANEL.FEEDBACK, <MessageSquare size={20} />, 'Feedback', 'Report issues or suggestions'),
            opt(PANEL.PRIVACY_POLICY, <Scale size={20} />, 'Privacy', 'Data handling and policy'),
        );

        // UTILITIES section
        if (isAuthenticated && isDevRole) {
            items.push(
                { type: 'header', label: 'Utilities' },
                opt(PANEL.TC3_MODE, <Crosshair size={20} />, profile.tc3Mode ? 'TC3 Mode — ON' : 'TC3 Mode — OFF', 'DD 1380 Casualty Card', { action: () => updateProfile({ tc3Mode: !profile.tc3Mode }) }),
                opt(PANEL.LORA, <Radio size={20} />, 'WhisperNet', 'LoRa mesh offline messaging'),
            );
        }

        return items;
    }, [isDarkMode, onToggleTheme, handleItemClick, isDevRole, isAuthenticated, isSupervisorRole, profile.clinicName, profile.tc3Mode, updateProfile]);

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
            // note-content resets editing on back
            if (activePanel === 'note-content') {
                return () => { handleSlideAnimation('right'); setActivePanel('main'); };
            }
            if (activePanel === 'physical-exam') {
                return () => { handleSlideAnimation('right'); setActivePanel('note-content'); };
            }
            if (activePanel === 'plan-settings') {
                return () => { handleSlideAnimation('right'); setPlanEditing(false); setActivePanel('note-content'); };
            }
            if (activePanel === 'text-templates') {
                return () => { handleSlideAnimation('right'); setTemplatesEditing(false); setActivePanel('note-content'); };
            }
            if (activePanel === 'provider-templates') {
                return () => { handleSlideAnimation('right'); setProvTemplatesEditing(false); setProvTemplatesHasPending(false); setActivePanel('note-content'); };
            }
            return () => { handleSlideAnimation('right'); setActivePanel('main'); };
        }, [activePanel, handleSlideAnimation, guardedClinicAction]),
        activePanel !== 'main',
    );

    const handleClose = useCallback(() => {
        setActivePanel('main');
        setSlideDirection('');

        setPlanEditing(false);
        setPlanSaveRequested(false);
        setPlanHasPending(false);
        setTemplatesEditing(false);
        setTemplatesSaveRequested(false);
        setTemplatesHasPending(false);
        setProvTemplatesEditing(false);
        setProvTemplatesSaveRequested(false);
        setProvTemplatesHasPending(false);
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
            case 'lora':                return { title: 'WhisperNet', ...backTo() };
            case 'pin-setup':           return { title: 'Security', ...backTo() };
            case 'notification-settings': return { title: 'Notifications', ...backTo() };
            case 'guided-tours':        return { title: 'Guided Tours', ...backTo() };
            case 'feedback':            return { title: 'Feedback', ...backTo() };
            case 'privacy-policy':      return { title: 'Privacy Policy', ...backTo() };
            case 'note-content':            return { title: 'Note Content', ...backTo() };
            case 'physical-exam':
                return { title: 'Physical Exam', showBack: true as const, onBack: () => { handleSlideAnimation('right'); setActivePanel('note-content'); } };
            case 'text-templates': {
                const doTemplatesBack = () => { handleSlideAnimation('right'); setTemplatesEditing(false); setTemplatesHasPending(false); setActivePanel('note-content'); };
                const templatesPills = (
                    <HeaderPill>
                        <div className={`flex items-center overflow-hidden transition-all duration-200 ease-out ${
                            templatesEditing ? 'max-w-16 opacity-100' : 'max-w-0 opacity-0'
                        }`}>
                            <PillButton icon={X} iconSize={18} onClick={() => setTemplatesEditing(false)} label="Cancel" />
                        </div>
                        <div className={`flex items-center overflow-hidden transition-all duration-200 ease-out ${
                            !templatesEditing ? 'max-w-22 opacity-100' : 'max-w-0 opacity-0'
                        }`}>
                            <PillButton icon={Pencil} iconSize={18} onClick={() => setTemplatesEditing(true)} label="Edit" />
                        </div>
                        {templatesEditing ? (
                            <PillButton icon={Check} iconSize={18} circleBg="bg-themegreen text-white" onClick={() => setTemplatesSaveRequested(true)} label="Save" />
                        ) : (
                            <PillButton icon={X} onClick={handleClose} label="Close" />
                        )}
                    </HeaderPill>
                );
                return {
                    title: 'Text Templates',
                    showBack: true as const,
                    onBack: doTemplatesBack,
                    rightContent: templatesPills,
                    hideDefaultClose: true,
                };
            }
            case 'provider-templates': {
                const doProvTemplatesBack = () => { handleSlideAnimation('right'); setProvTemplatesEditing(false); setProvTemplatesHasPending(false); setActivePanel('note-content'); };
                const provTemplatesPills = (
                    <HeaderPill>
                        <div className={`flex items-center overflow-hidden transition-all duration-200 ease-out ${
                            provTemplatesEditing ? 'max-w-16 opacity-100' : 'max-w-0 opacity-0'
                        }`}>
                            <PillButton icon={X} iconSize={18} onClick={() => setProvTemplatesEditing(false)} label="Cancel" />
                        </div>
                        <div className={`flex items-center overflow-hidden transition-all duration-200 ease-out ${
                            !provTemplatesEditing ? 'max-w-22 opacity-100' : 'max-w-0 opacity-0'
                        }`}>
                            <PillButton icon={Pencil} iconSize={18} onClick={() => setProvTemplatesEditing(true)} label="Edit" />
                        </div>
                        {provTemplatesEditing ? (
                            <PillButton icon={Check} iconSize={18} circleBg="bg-themegreen text-white" onClick={() => setProvTemplatesSaveRequested(true)} label="Save" />
                        ) : (
                            <PillButton icon={X} onClick={handleClose} label="Close" />
                        )}
                    </HeaderPill>
                );
                return {
                    title: 'Provider Templates',
                    showBack: true as const,
                    onBack: doProvTemplatesBack,
                    rightContent: provTemplatesPills,
                    hideDefaultClose: true,
                };
            }
            case 'plan-settings': {
                const doPlanBack = () => { handleSlideAnimation('right'); setPlanEditing(false); setPlanHasPending(false); setActivePanel('note-content'); };
                const planPills = (
                    <HeaderPill>
                        <div className={`flex items-center overflow-hidden transition-all duration-200 ease-out ${
                            planEditing ? 'max-w-16 opacity-100' : 'max-w-0 opacity-0'
                        }`}>
                            <PillButton icon={X} iconSize={18} onClick={() => setPlanEditing(false)} label="Cancel" />
                        </div>
                        <div className={`flex items-center overflow-hidden transition-all duration-200 ease-out ${
                            !planEditing ? 'max-w-22 opacity-100' : 'max-w-0 opacity-0'
                        }`}>
                            <PillButton icon={Pencil} iconSize={18} onClick={() => setPlanEditing(true)} label="Edit" />
                        </div>
                        {planEditing ? (
                            <PillButton icon={Check} iconSize={18} circleBg="bg-themegreen text-white" onClick={() => setPlanSaveRequested(true)} label="Save" />
                        ) : (
                            <PillButton icon={X} onClick={handleClose} label="Close" />
                        )}
                    </HeaderPill>
                );
                return {
                    title: 'Plan',
                    showBack: true as const,
                    onBack: doPlanBack,
                    rightContent: planPills,
                    hideDefaultClose: true,
                };
            }
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
                                    data-tour="clinic-edit-button"
                                />
                            </div>
                            {clinicEditing ? (
                                <PillButton
                                    icon={Check}
                                    iconSize={18}
                                    circleBg="bg-themegreen text-white"
                                    onClick={() => setClinicSaveRequested(true)}
                                    label="Save"
                                    data-tour="clinic-save-button"
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
    }, [activePanel, backTo, handleClose, isSupervisorRole, clinicEditing, planEditing, planSaveRequested, planHasPending, templatesEditing, templatesSaveRequested, templatesHasPending, provTemplatesEditing, provTemplatesSaveRequested, provTemplatesHasPending, handleSlideAnimation, guardedClinicAction]);

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
                            'guided-tours':         <GuidedToursPanel onClose={handleClose} />,
                            'release-notes':        <ReleaseNotesPanel />,
                            'feedback':             <FeedbackPanel />,
                            'privacy-policy':       <PrivacyPolicyPanel />,
                            'note-content': (
                                <NoteContentPanel
                                    onNavigate={(panel) => {
                                        handleSlideAnimation('left');
                                        setActivePanel(panel as typeof activePanel);
                                    }}
                                />
                            ),
                            'physical-exam':        <PhysicalExamPanel />,
                            'plan-settings': (
                                <PlanPanel
                                    editing={planEditing}
                                    saveRequested={planSaveRequested}
                                    onSaveComplete={() => { setPlanSaveRequested(false); setPlanEditing(false); }}
                                    onPendingChangesChange={setPlanHasPending}
                                />
                            ),
                            'provider-templates': (
                                <ProviderTemplatesPanel
                                    editing={provTemplatesEditing}
                                    saveRequested={provTemplatesSaveRequested}
                                    onSaveComplete={() => { setProvTemplatesSaveRequested(false); setProvTemplatesEditing(false); }}
                                    onPendingChangesChange={setProvTemplatesHasPending}
                                />
                            ),
                            'text-templates': (
                                <TextTemplatesPanel
                                    editing={templatesEditing}
                                    saveRequested={templatesSaveRequested}
                                    onSaveComplete={() => { setTemplatesSaveRequested(false); setTemplatesEditing(false); }}
                                    onPendingChangesChange={setTemplatesHasPending}
                                />
                            ),
                            'notification-settings': <NotificationSettingsPanel />,
                            'sessions-devices':     <SessionsDevicesPanel />,
                            'lora':                 <LoRaPanel />,
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
            subtitle="Staged changes not saved. Discard?"
            confirmLabel="Discard"
            cancelLabel="Keep editing"
            variant="warning"
            onConfirm={handleGuardConfirm}
            onCancel={handleGuardCancel}
        />
    </>
    );
};
