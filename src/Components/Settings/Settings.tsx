import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Palette, Shield, Lock, MessageSquare, Bell, Stethoscope, Scale, X, Building2, Check, Radio, LayoutDashboard, HardDrive, Smartphone, BookOpen, ChevronLeft, LogOut } from 'lucide-react';
import { BaseDrawer } from '@/Components/primitives/BaseDrawer';
import { useIsMobile } from '../../Hooks/useIsMobile';
import { ChildClinicRosterBody } from './Supervisor/ChildClinicRosterSheet';
import { TimelineDetailPane } from '../Timeline/UserTimeline';
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
import { deleteOwnAccount, leaveOwnCluster } from '../../lib/authService';
import { PANEL, PANEL_TARGET, type PanelId, type SettingsItem } from './SettingsTypes';
import { UI_TIMING } from '../../Utilities/constants';
import { useBetaFlag } from '../../lib/betaFeatures';
import { MainSettingsPanel } from './MainSettingsPanel';
import { SettingsRail } from './SettingsRail';
import { AvatarPickerPanel } from './AvatarPickerPanel';
import { ContentWrapper } from '@/Components/primitives/ContentWrapper';
import { SlideRevealPane } from '@/Components/primitives/SlideRevealPane';
import { useEscBackout } from '../../Hooks/useEscBackout';
import { HeaderPill, PillButton } from '@/Components/primitives/HeaderPill';
import { SessionsDevicesPanel } from './SessionsDevicesPanel';
import { ClinicPanel } from './ClinicPanel';
import { LoRaPanel } from './LoRaPanel';
import { ConfirmDialog } from '@/Components/primitives/ConfirmDialog';
import { ThemePickerPanel } from './ThemePickerPanel';
import { StoragePanel } from './StoragePanel';
import { FeatureVotesPanel } from './FeatureVotesPanel';
import { useNavigationStore } from '../../stores/useNavigationStore';
import { useFeatureVotesStore, selectHasUnvotedActiveCycle } from '../../stores/useFeatureVotesStore';
import { useTheme } from '../../Utilities/ThemeContext';


interface SettingsDrawerProps {
    isVisible: boolean;
    onClose: () => void;
    initialPanel?: 'main' | 'release-notes' | 'user-profile' | 'feedback' | 'feature-votes' | 'clinic';
}

/** Desktop right-pane content. The center keeps its own `activePanel`; this is
 *  the nested detail drilled from within a panel (mobile routes these through
 *  the center slide-push / local Sheet instead, so `detailView` stays 'none'). */
type DetailView =
    | { kind: 'none' }
    | { kind: 'child-cluster'; id: string; name: string }
    | { kind: 'app-content'; panel: 'plan-settings' | 'text-templates' | 'provider-templates' }
    | { kind: 'user-timeline'; subjectId: string; clinicId?: string; title: string };

export const Settings = ({
    isVisible,
    onClose,
    initialPanel,
}: SettingsDrawerProps) => {
    const { currentAvatar, setAvatar, avatarList, customImage, isCustom, setCustomImage, clearCustomImage } = useAvatar();
    const { themeName } = useTheme();
    const isMobile = useIsMobile();
    const [activePanel, setActivePanel] = useState<'main' | 'release-notes' | 'avatar-picker' | 'user-profile' | 'pin-setup' | 'notification-settings' | 'feedback' | 'note-content' | 'privacy-policy' | 'sessions-devices' | 'clinic' | 'lora' | 'plan-settings' | 'text-templates' | 'provider-templates' | 'overview-widgets' | 'theme-picker' | 'storage' | 'feature-votes'>('main');
    // Desktop three-pane right detail. Never set on mobile (drills slide-push /
    // use a local Sheet instead). See DetailView above.
    const [detailView, setDetailView] = useState<DetailView>({ kind: 'none' });
    const detailOpen = detailView.kind !== 'none';
    const closeDetail = useCallback(() => setDetailView({ kind: 'none' }), []);
    // Desktop Esc: collapse the right detail pane first; a second Esc closes the drawer.
    useEscBackout(!isMobile && detailOpen, closeDetail);
    // The User Guide is its own top-level drawer (opened from the About row / release
    // notes), not a Settings sub-panel — so opening it just flips a nav-store flag.
    const setShowUserGuideDrawer = useNavigationStore((s) => s.setShowUserGuideDrawer);
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
    // Self-service leave-cluster (#2): confirm + in-flight + error surfaces.
    const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
    const [leaving, setLeaving] = useState(false);
    const [leaveError, setLeaveError] = useState<string | null>(null);

    const handleLeaveCluster = useCallback(async () => {
        setLeaving(true);
        const res = await leaveOwnCluster();
        setLeaving(false);
        setShowLeaveConfirm(false);
        // Success needs no toast — the "Leave Cluster" row disappears (clinicId now
        // null) and the between-assignments banner appears (feedback is the change
        // itself). Only a failure (e.g. sole-supervisor orphan guard) surfaces.
        if (!res.success) setLeaveError(res.error || 'Could not leave the cluster.');
    }, []);

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

    // Stale-guard: switching the operating cluster (cluster switcher) invalidates
    // any open child-cluster roster in the desktop right pane.
    useEffect(() => { setDetailView({ kind: 'none' }); }, [clinicId]);

    const handleSlideAnimation = useCallback((direction: 'left' | 'right') => {
        setSlideDirection(direction);
        setTimeout(() => setSlideDirection(''), UI_TIMING.SLIDE_ANIMATION);
    }, []);

    /** Desktop rail → center switch. Resets clinic editing (mirrors the clinic
     *  back handler) and closes any open detail pane; guards an unsaved cluster
     *  before leaving since desktop has no header back button to hang it on. */
    const navigateCenter = useCallback((target: typeof activePanel) => {
        const go = () => {
            setActivePanel(target);
            setDetailView({ kind: 'none' });
            setClinicEditing(false);
            setClinicDeleteSelection(new Set());
            setClinicAddingMember(false);
        };
        if (activePanel === 'clinic' && clinicHasPending) guardedClinicAction(go);
        else go();
    }, [activePanel, clinicHasPending, guardedClinicAction]);

const handleItemClick = useCallback((id: PanelId, closeDrawer: () => void) => {
        if (id === PANEL.CLOSE) { closeDrawer(); return; }
        if (id === PANEL.BACK_TO_MAIN) {
            if (isMobile) { handleSlideAnimation('right'); setActivePanel('main'); }
            else navigateCenter('main');
            return;
        }

        // Look up the target panel name from the constant map
        const target = PANEL_TARGET[id];
        if (target) {
            if (isMobile) {
                handleSlideAnimation('left');
                setActivePanel(target as typeof activePanel);
            } else {
                navigateCenter(target as typeof activePanel);
            }
        }
    }, [handleSlideAnimation, isMobile, navigateCenter]);

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

        // CLUSTERS section. Supervisors/dev get full cluster management AND the
        // self-service leave row; a regular member gets leave only. Everyone with a
        // cluster can PCS out — supervisors too, regardless of hand-off (USR). When
        // the user is in no cluster (between assignments) there's nothing here —
        // awareness + re-entry is the between-assignments banner (a supervisor pulls
        // them into the next cluster; there's no self-join yet).
        if (isAuthenticated && clinicId) {
            items.push({ type: 'header', label: 'Clusters' });
            if (isSupervisorRole || isDevRole) {
                items.push(
                    opt(PANEL.CLINIC, <Building2 size={20} />, profile.clinicName || 'My Cluster', 'Manage cluster and personnel'),
                );
            }
            items.push(
                opt(PANEL.LEAVE_CLUSTER, <LogOut size={20} />, 'Leave Cluster', `Currently in ${profile.clinicName || 'your cluster'}`, {
                    action: () => setShowLeaveConfirm(true),
                }),
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
                opt(PANEL.NOTE_CONTENT, <Stethoscope size={20} />, 'App Content', 'Exam blocks, templates, order sets'),
                opt(PANEL.OVERVIEW_WIDGETS, <LayoutDashboard size={20} />, 'Mission Overview', 'Widgets shown on the home screen'),
                opt(PANEL.PIN_SETUP, <Lock size={20} />, 'Security', 'App lock, biometrics, permissions'),
                opt(PANEL.NOTIFICATION_SETTINGS, <Bell size={20} />, 'Notifications', 'Push subscriptions and alerts'),
            );
        }

        // ABOUT section — guests get Feedback + Privacy only (no Release Notes / Guided Tours).
        items.push({ type: 'header', label: 'About' });
        if (isAuthenticated) {
            items.push(
                opt(PANEL.USER_GUIDE, <BookOpen size={20} />, 'User Guide', 'How everything works', {
                    action: () => { setShowUserGuideDrawer(true); closeDrawer(); },
                }),
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
    }, [themeName, handleItemClick, isDevRole, isAuthenticated, isSupervisorRole, clinicId, profile.clinicName, updateProfile, hasUnvotedCycle, whisperNetVisible, setShowUserGuideDrawer]);

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
            return () => { handleSlideAnimation('right'); setActivePanel('main'); };
        }, [activePanel, handleSlideAnimation, guardedClinicAction]),
        activePanel !== 'main',
    );

    const handleClose = useCallback(() => {
        setActivePanel('main');
        setSlideDirection('');
        setDetailView({ kind: 'none' });

        setClinicEditing(false);
        setClinicDeleteSelection(new Set());
        onClose();
    }, [onClose]);

    /** Shorthand: back button that slides right to a target panel (default: 'main').
     *  Desktop suppresses the back button — the rail IS the navigation. */
    const backTo = useCallback((target: typeof activePanel = 'main') => ({
        showBack: isMobile as boolean,
        onBack: () => { handleSlideAnimation('right'); setActivePanel(target); },
    }), [handleSlideAnimation, isMobile]);

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
                    showBack: isMobile as boolean,
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
    }, [activePanel, backTo, handleClose, isSupervisorRole, clinicEditing, handleSlideAnimation, guardedClinicAction, isMobile]);

    return (<>
        <BaseDrawer
            isVisible={isVisible}
            onClose={handleClose}
            fullHeight="90dvh"
            disableDrag={false}
            desktopPosition="left"
            desktopWidth="w-[90%]"
            header={headerConfig}
            scrollDisabled
            glassHeader={isMobile}
        >
            {(handleClose) => {
                // Component lookup map — maps each panel name to its rendered JSX.
                // Mobile indexes by activePanel (slide-push); desktop uses the same
                // map for the rail ('main') and the center (selected panel).
                // Shared by the mobile menu card (MainSettingsPanel) and the desktop
                // rail (SettingsRail) \u2014 one source of truth for the menu + profile.
                const mainPanelProps = {
                    settingsOptions: buildSettingsOptions(handleClose),
                    onItemClick: (id: PanelId) => handleItemClick(id, handleClose),
                    displayName: isAuthenticated
                        ? (profile.lastName
                            ? `${profile.rank ? profile.rank + ' ' : ''}${profile.lastName}${profile.firstName ? ', ' + profile.firstName.charAt(0) + '.' : ''}`
                            : 'Set Up Profile')
                        : 'Guest',
                    displaySub: isAuthenticated
                        ? (profile.credential
                            ? `${profile.credential}${profile.component ? ' \u00b7 ' + profile.component : ''}`
                            : 'Tap to set up')
                        : 'Tap to log out',
                    onAvatarClick: () => {
                        // Guests have no profile to personalize \u2014 the whole card
                        // (avatar included) is a logout affordance, not a setup path.
                        if (!isAuthenticated) {
                            useAuthStore.setState({ isGuest: false });
                            handleClose();
                        } else {
                            handleItemClick(PANEL.AVATAR_PICKER, handleClose);
                        }
                    },
                    onProfileClick: () => {
                        if (!isAuthenticated) {
                            // Exit guest mode to show the LoginScreen
                            useAuthStore.setState({ isGuest: false });
                            handleClose();
                        } else {
                            handleItemClick(PANEL.USER_PROFILE, handleClose);
                        }
                    },
                    isConnected: isSupabaseConnected,
                };

                const panelMap: Partial<Record<typeof activePanel, React.ReactNode>> = {
                            'main': (
                                <MainSettingsPanel {...mainPanelProps} activeId={!isMobile ? activePanel : undefined} />
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
                                    onViewTimeline={isMobile ? undefined : () => setDetailView({ kind: 'user-timeline', subjectId: user?.id ?? '', clinicId: clinicId ?? undefined, title: 'Timeline' })}
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
                            'release-notes':        <ReleaseNotesPanel onOpenFeatureVotes={() => { handleSlideAnimation('left'); setActivePanel('feature-votes'); }} />,
                            'feature-votes':        <FeatureVotesPanel onOpenFeedback={() => { handleSlideAnimation('left'); setActivePanel('feedback'); }} />,
                            'feedback':             <FeedbackPanel />,
                            'privacy-policy':       <PrivacyPolicyPanel />,
                            'note-content': (
                                <NoteContentPanel
                                    onNavigate={(panel) => {
                                        if (isMobile) {
                                            handleSlideAnimation('left');
                                            setActivePanel(panel as typeof activePanel);
                                        } else {
                                            setDetailView({ kind: 'app-content', panel: panel as 'plan-settings' | 'text-templates' | 'provider-templates' });
                                        }
                                    }}
                                    activeSubpage={!isMobile && detailView.kind === 'app-content' ? detailView.panel : undefined}
                                />
                            ),
                            'overview-widgets': <OverviewWidgetsPanel />,
                            'theme-picker':     <ThemePickerPanel />,
                            'storage':          <StoragePanel />,
                            'plan-settings':    <PlanPanel />,
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
                                    onOpenChild={isMobile ? undefined : (child) => setDetailView({ kind: 'child-cluster', id: child.id, name: child.name })}
                                    activeChildId={detailView.kind === 'child-cluster' ? detailView.id : undefined}
                                />
                            ),
                };

                // Desktop panes zero out the glass-header offset token: on desktop
                // BaseDrawer renders a solid in-flow header (glassHeader=isMobile) and
                // never publishes --drawer-header-h, so each panel's
                // pt-[calc(var(--drawer-header-h,3.5rem)+…)] collapses to the +… floor.
                const paneStyle = { ['--drawer-header-h' as string]: '0px' } as React.CSSProperties;

                // Desktop right pane: nested detail drilled from the center panel.
                const renderDetail = () => {
                    if (detailView.kind === 'child-cluster') {
                        return (
                            <ChildClinicRosterBody
                                key={detailView.id}
                                clinicId={detailView.id}
                                currentUserId={user?.id ?? null}
                                title={detailView.name}
                                onBack={closeDetail}
                            />
                        );
                    }
                    if (detailView.kind === 'user-timeline') {
                        return (
                            <TimelineDetailPane
                                subjectId={detailView.subjectId}
                                clinicId={detailView.clinicId}
                                title={detailView.title}
                                onBack={closeDetail}
                            />
                        );
                    }
                    if (detailView.kind === 'app-content') {
                        const titleMap: Record<typeof detailView.panel, string> = {
                            'plan-settings': 'Plan',
                            'text-templates': 'Text Templates',
                            'provider-templates': 'Provider Templates',
                        };
                        return (
                            <div className="flex h-full flex-col">
                                <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-tertiary/10">
                                    <button
                                        onClick={closeDetail}
                                        className="w-8 h-8 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all shrink-0"
                                        aria-label="Back"
                                    >
                                        <ChevronLeft size={18} />
                                    </button>
                                    <p className="flex-1 min-w-0 text-sm font-semibold text-primary truncate">{titleMap[detailView.panel]}</p>
                                </div>
                                <div className="flex-1 min-h-0 overflow-y-auto">
                                    {detailView.panel === 'plan-settings' && <PlanPanel />}
                                    {detailView.panel === 'text-templates' && <TextTemplatesPanel />}
                                    {detailView.panel === 'provider-templates' && <ProviderTemplatesPanel />}
                                </div>
                            </div>
                        );
                    }
                    return null;
                };

                return (
                    <div className={isMobile ? 'h-full overflow-y-auto overscroll-y-contain' : 'h-full'}>
                    <ContentWrapper
                        slideDirection={isMobile ? slideDirection : ''}
                        swipeHandlers={isMobile && activePanel !== 'main' ? swipeHandlers : undefined}
                    >
                        {isMobile ? (
                            panelMap[activePanel] ?? null
                        ) : (
                            <div className="flex h-full">
                                {/* Left rail — condensed settings tree + search. Collapses
                                    (slides out left) when the right detail pane opens. */}
                                <SlideRevealPane
                                    open={!detailOpen}
                                    side="left"
                                    width={300}
                                    keepMounted
                                    className="border-r border-tertiary/10 bg-themewhite3/50"
                                    style={paneStyle}
                                >
                                    <SettingsRail {...mainPanelProps} activeId={activePanel} />
                                </SlideRevealPane>
                                {/* Center — the selected top-level panel. */}
                                <div className="flex-1 min-w-0 flex flex-col overflow-hidden" style={paneStyle}>
                                    {activePanel === 'main' ? (
                                        <div className="h-full flex items-center justify-center px-6 text-center text-sm text-tertiary">
                                            Select a setting
                                        </div>
                                    ) : (
                                        panelMap[activePanel] ?? null
                                    )}
                                </div>
                                {/* Right — nested detail (child roster / App Content subpage);
                                    slides in from the right as the rail collapses. */}
                                <SlideRevealPane
                                    open={detailOpen}
                                    side="right"
                                    width={420}
                                    className="border-l border-primary/10 bg-themewhite3"
                                    style={paneStyle}
                                >
                                    {renderDetail()}
                                </SlideRevealPane>
                            </div>
                        )}
                    </ContentWrapper>
                    </div>
                );
            }}
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
        <ConfirmDialog
            visible={showLeaveConfirm}
            title={`Leave ${profile.clinicName || 'this cluster'}?`}
            subtitle="You'll lose access to this cluster's calendar, roster, messages, and property until you join another. Your gaining unit's supervisor adds you to your next cluster."
            confirmLabel="Leave cluster"
            cancelLabel="Cancel"
            variant="danger"
            processing={leaving}
            onConfirm={handleLeaveCluster}
            onCancel={() => setShowLeaveConfirm(false)}
        />
        <ConfirmDialog
            visible={!!leaveError}
            title="Couldn't leave cluster"
            subtitle={leaveError ?? undefined}
            variant="warning"
            notifyOnly
            onCancel={() => setLeaveError(null)}
        />
    </>
    );
};
