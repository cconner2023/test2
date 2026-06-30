import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Palette, Shield, Lock, MessageSquare, Bell, Stethoscope, Scale, X, Building2, Check, Radio, Compass, LayoutDashboard, HardDrive, Smartphone } from 'lucide-react';
import { BaseDrawer } from '../BaseDrawer';
import { resizeImage } from '../../Hooks/useProfileAvatar';
import { useAvatar } from '../../Utilities/AvatarContext';
import { useUserProfile } from '../../Hooks/useUserProfile';
import { useSwipeBack } from '../../Hooks/useSwipeBack';
import { ReleaseNotesPanel } from './ReleaseNotesPanel';
import { PinSetupPanel } from './PinSetupPanel';
import { NotificationSettingsPanel } from './NotificationSettingsPanel';
import { FeedbackPanel } from './FeedbackPanel';
import { PrivacyPolicyPanel } from './PrivacyPolicyPanel';
import { NoteContentPanel } from './NoteContentPanel';
import { ChecklistsPanel } from './ChecklistsPanel';
import { OverviewWidgetsPanel } from './OverviewWidgetsPanel';
import { PlanPanel } from './PlanPanel';
import { TextTemplatesPanel } from './TextTemplatesPanel';
import { ProviderTemplatesPanel } from './ProviderTemplatesPanel';
import { ProfilePage } from './ProfilePage';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../Hooks/useAuth';
import { useAuthStore } from '../../stores/useAuthStore';
import { clearAllUserData } from '../../lib/offlineDb';
import { clearServiceWorkerCaches } from '../../lib/cacheService';
import { deleteOwnAccount } from '../../lib/authService';
import { PANEL, PANEL_TARGET, type PanelId, type SettingsItem } from './SettingsTypes';
import { UI_TIMING } from '../../Utilities/constants';
import { GUIDED_TOURS_ENABLED } from '../../lib/featureFlags';
import { useBetaFlag } from '../../lib/betaFeatures';
import { MainSettingsPanel } from './MainSettingsPanel';
import { AvatarPickerPanel } from './AvatarPickerPanel';
import { ContentWrapper } from '../ContentWrapper';
import { HeaderPill, PillButton } from '../HeaderPill';
import { SessionsDevicesPanel } from './SessionsDevicesPanel';
import { ClinicPanel } from './ClinicPanel';
import { LoRaPanel } from './LoRaPanel';
import { ConfirmDialog } from '../ConfirmDialog';
import { GuidedToursPanel } from './GuidedToursPanel';
import { GUIDED_TEXT_EXPANDER } from '../../Data/GuidedTourData';
import { ThemePickerPanel } from './ThemePickerPanel';
import { StoragePanel } from './StoragePanel';
import { FeatureVotesPanel } from './FeatureVotesPanel';
import { useFeatureVotesStore, selectHasUnvotedActiveCycle } from '../../stores/useFeatureVotesStore';
import { useTheme } from '../../Utilities/ThemeContext';


interface SettingsDrawerProps {
    isVisible: boolean;
    onClose: () => void;
    initialPanel?: 'main' | 'release-notes' | 'user-profile' | 'feedback' | 'feature-votes' | 'clinic';
}

export const Settings = ({
    isVisible,
    onClose,
    initialPanel,
}: SettingsDrawerProps) => {
    const { currentAvatar, setAvatar, avatarList, customImage, isCustom, setCustomImage, clearCustomImage } = useAvatar();
    const { themeName } = useTheme();
    const [activePanel, setActivePanel] = useState<'main' | 'release-notes' | 'avatar-picker' | 'user-profile' | 'pin-setup' | 'notification-settings' | 'feedback' | 'note-content' | 'privacy-policy' | 'sessions-devices' | 'clinic' | 'lora' | 'plan-settings' | 'text-templates' | 'provider-templates' | 'guided-tours' | 'overview-widgets' | 'theme-picker' | 'storage' | 'feature-votes' | 'checklists'>('main');
    const { profile, updateProfile } = useUserProfile();
    const [slideDirection, setSlideDirection] = useState<'left' | 'right' | ''>('');
    const prevVisibleRef = useRef(false);
    const [isSupabaseConnected, setIsSupabaseConnected] = useState(false);
    const { user, signOut, isAuthenticated, isDevRole, isSupervisorRole, clinicId } = useAuth();
    const whisperNetVisible = useBetaFlag('whisperNet');
    const hasUnvotedCycle = useFeatureVotesStore(selectHasUnvotedActiveCycle);
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
        const backHandler = () => {
            handleSlideAnimation('right');
            setActivePanel('main');
        };
        window.addEventListener('tour:settings-navigate', handler);
        window.addEventListener('tour:settings-back', backHandler);
        return () => {
            window.removeEventListener('tour:settings-navigate', handler);
            window.removeEventListener('tour:settings-back', backHandler);
        };
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

const handleItemClick = useCallback((id: PanelId, closeDrawer: () => void) => {
        if (id === PANEL.CLOSE) { closeDrawer(); return; }
        if (id === PANEL.BACK_TO_MAIN) { handleSlideAnimation('right'); setActivePanel('main'); return; }

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

        // LINKED DEVICES — surfaced at the very top (own card above the section headers)
        // so users can quickly find how to link a new device by scanning its QR code.
        if (isAuthenticated) {
            items.push(
                opt(PANEL.SESSIONS_DEVICES, <Smartphone size={20} />, 'Linked Devices', 'Add a device or link one by scanning its QR code'),
            );
        }

        // CLINICS section — cluster management is supervisor-only (dev also sees it).
        if (isAuthenticated && (isSupervisorRole || isDevRole)) {
            items.push(
                { type: 'header', label: 'Clusters' },
                opt(PANEL.CLINIC, <Building2 size={20} />, profile.clinicName || 'My Cluster', 'Manage cluster and personnel'),
            );
        }

        // PREFERENCES section
        // Guests get Appearance only — the rest of Preferences (App Content, Mission
        // Overview, Security, Notifications) is an authenticated-only surface. Keeping
        // the guest menu thin nudges toward signing in. See palace v2/auth guest-mode
        // invariant: guest view is a strict subset; default-gate new surfaces OFF.
        items.push(
            { type: 'header', label: 'Preferences' },
            opt(PANEL.TOGGLE_THEME, <Palette size={20} />, 'Appearance', themeName.charAt(0).toUpperCase() + themeName.slice(1)),
        );
        if (isAuthenticated) {
            items.push(
                opt(PANEL.NOTE_CONTENT, <Stethoscope size={20} />, 'App Content', 'Exam blocks, templates, order sets, checklists'),
                opt(PANEL.OVERVIEW_WIDGETS, <LayoutDashboard size={20} />, 'Mission Overview', 'Widgets shown on the home screen'),
                opt(PANEL.PIN_SETUP, <Lock size={20} />, 'Security', 'App lock, biometrics, permissions'),
                opt(PANEL.NOTIFICATION_SETTINGS, <Bell size={20} />, 'Notifications', 'Push subscriptions and alerts'),
            );
        }

        // ABOUT section — guests get Feedback + Privacy only (no Release Notes / Guided Tours).
        items.push({ type: 'header', label: 'About' });
        if (isAuthenticated) {
            items.push(
                ...(GUIDED_TOURS_ENABLED ? [opt(PANEL.GUIDED_TOURS, <Compass size={20} />, 'Guided Tours', 'Interactive feature walkthroughs')] : []),
                opt(PANEL.RELEASE_NOTES, <Shield size={20} />, 'Release Notes', 'What\'s new in this version', hasUnvotedCycle ? { dot: true } : undefined),
            );
        }
        items.push(
            opt(PANEL.FEEDBACK, <MessageSquare size={20} />, 'Feedback', 'Report issues or suggestions'),
            opt(PANEL.PRIVACY_POLICY, <Scale size={20} />, 'Privacy', 'Data handling and policy'),
        );

        // UTILITIES section
        if (isAuthenticated) {
            items.push(
                { type: 'header', label: 'Utilities' },
                opt(PANEL.STORAGE, <HardDrive size={20} />, 'Local Storage', 'Cached data and sync status'),
                ...(whisperNetVisible ? [opt(PANEL.LORA, <Radio size={20} />, 'WhisperNet', 'LoRa mesh offline messaging')] : []),
            );
        }

        return items;
    }, [themeName, handleItemClick, isDevRole, isAuthenticated, isSupervisorRole, profile.clinicName, updateProfile, hasUnvotedCycle, whisperNetVisible]);

    // Swipe-back for sub-panels (mobile touch only)
    const swipeHandlers = useSwipeBack(
        useMemo(() => {
            if (activePanel === 'main') return undefined;
            // clinic panel resets editing state on back
            if (activePanel === 'clinic') {
                const doBack = () => { handleSlideAnimation('right'); setClinicEditing(false); setClinicDeleteSelection(new Set()); setClinicAddingMember(false); setActivePanel('main'); };
                return () => guardedClinicAction(doBack);
            }
            // note-content resets editing on back
            if (activePanel === 'note-content') {
                return () => { handleSlideAnimation('right'); setActivePanel('main'); };
            }
            if (activePanel === 'overview-widgets') {
                return () => { handleSlideAnimation('right'); setActivePanel('main'); };
            }
            if (activePanel === 'plan-settings') {
                return () => { handleSlideAnimation('right'); setActivePanel('note-content'); };
            }
            if (activePanel === 'text-templates') {
                return () => { handleSlideAnimation('right'); setActivePanel('note-content'); };
            }
            if (activePanel === 'provider-templates') {
                return () => { handleSlideAnimation('right'); setActivePanel('note-content'); };
            }
            if (activePanel === 'checklists') {
                return () => { handleSlideAnimation('right'); setActivePanel('note-content'); };
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
            // All panels below slide right back to main
            case 'release-notes':       return { title: 'Release Notes', ...backTo() };
            case 'feature-votes':       return { title: 'Feature Votes', ...backTo() };
            case 'avatar-picker':       return { title: 'Choose Avatar', ...backTo() };
            case 'user-profile':        return { title: 'Profile', ...backTo() };
            case 'sessions-devices':    return { title: 'Linked Devices', ...backTo() };
            case 'lora':                return { title: 'WhisperNet', ...backTo() };
            case 'pin-setup':           return { title: 'Security', ...backTo() };
            case 'notification-settings': return { title: 'Notifications', ...backTo() };
            case 'guided-tours':        return { title: 'Guided Tours', ...backTo() };
            case 'feedback':            return { title: 'Feedback', ...backTo() };
            case 'privacy-policy':      return { title: 'Privacy Policy', ...backTo() };
            case 'note-content':            return { title: 'App Content', ...backTo() };
            case 'overview-widgets':        return { title: 'Mission Overview', ...backTo() };
            case 'theme-picker':            return { title: 'Appearance', ...backTo() };
            case 'storage':                 return { title: 'Local Storage', ...backTo() };
            case 'text-templates': {
                const doTemplatesBack = () => { handleSlideAnimation('right'); setActivePanel('note-content'); };
                return {
                    title: 'Text Templates',
                    showBack: true as const,
                    onBack: doTemplatesBack,
                };
            }
            case 'provider-templates': {
                const doProvTemplatesBack = () => { handleSlideAnimation('right'); setActivePanel('note-content'); };
                return {
                    title: 'Provider Templates',
                    showBack: true as const,
                    onBack: doProvTemplatesBack,
                };
            }
            case 'checklists': {
                const doChecklistsBack = () => { handleSlideAnimation('right'); setActivePanel('note-content'); };
                return {
                    title: 'Checklists',
                    showBack: true as const,
                    onBack: doChecklistsBack,
                };
            }
            case 'plan-settings': {
                const doPlanBack = () => { handleSlideAnimation('right'); setActivePanel('note-content'); };
                return {
                    title: 'Plan',
                    showBack: true as const,
                    onBack: doPlanBack,
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
                            {clinicEditing ? (
                                <PillButton
                                    icon={Check}
                                    iconSize={18}
                                    accent="success"
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
                        title: 'My Cluster',
                        ...clinicBackTo,
                        rightContent: clinicPills,
                        hideDefaultClose: true,
                    };
                }
                return { title: 'My Cluster', ...clinicBackTo };
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
            scrollDisabled
            glassHeader
        >
            {(handleClose) => (
                <div className="h-full overflow-y-auto overscroll-y-contain">
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
                                            : 'Tap to log out'
                                    }
                                    onAvatarClick={() => {
                                        // Guests have no profile to personalize \u2014 the whole card
                                        // (avatar included) is a logout affordance, not a setup path.
                                        if (!isAuthenticated) {
                                            useAuthStore.setState({ isGuest: false });
                                            handleClose();
                                        } else {
                                            handleItemClick(PANEL.AVATAR_PICKER, handleClose);
                                        }
                                    }}
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
                            'release-notes':        <ReleaseNotesPanel onOpenFeatureVotes={() => { handleSlideAnimation('left'); setActivePanel('feature-votes'); }} />,
                            'feature-votes':        <FeatureVotesPanel onOpenFeedback={() => { handleSlideAnimation('left'); setActivePanel('feedback'); }} />,
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
                            'overview-widgets': <OverviewWidgetsPanel />,
                            'theme-picker':     <ThemePickerPanel />,
                            'storage':          <StoragePanel />,
                            'plan-settings':    <PlanPanel />,
                            'checklists':       <ChecklistsPanel />,
                            'provider-templates': <ProviderTemplatesPanel />,
                            'text-templates': <TextTemplatesPanel />,
                            'notification-settings': <NotificationSettingsPanel />,
                            'sessions-devices':     <SessionsDevicesPanel />,
                            'lora':                 <LoRaPanel />,
                            'pin-setup':            <PinSetupPanel />,
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
                </div>
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
