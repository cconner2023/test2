import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Palette, Shield, Lock, MessageSquare, Bell, Stethoscope, Scale, X, Building2, Check, Radio, LayoutDashboard, HardDrive, Smartphone, BookOpen, Plus } from 'lucide-react';
import { BaseDrawer } from '@/Components/primitives/BaseDrawer';
import { useIsMobile } from '../../Hooks/useIsMobile';
import { ChildClinicRosterBody } from './Supervisor/ChildClinicRosterSheet';
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
import { deleteOwnAccount } from '../../lib/authService';
import { PANEL, PANEL_TARGET, type PanelId, type SettingsItem } from './SettingsTypes';
import { UI_TIMING } from '../../Utilities/constants';
import { useBetaFlag } from '../../lib/betaFeatures';
import { MainSettingsPanel } from './MainSettingsPanel';
import { SettingsRail } from './SettingsRail';
import { AvatarPickerPanel } from './AvatarPickerPanel';
import { ContentWrapper } from '@/Components/primitives/ContentWrapper';
import { SlideRevealPane } from '@/Components/primitives/SlideRevealPane';
import { PaneHeader } from '@/Components/primitives/PaneHeader';
import { SearchInput } from '@/Components/primitives/SearchInput';
import { UserGuideTree } from '@/Components/UserGuide/UserGuideTree';
import { UserGuideBody } from '@/Components/UserGuide/UserGuideBody';
import { useUserGuideNav } from '@/Components/UserGuide/useUserGuideNav';
import { USER_GUIDE_VERSION } from '@/Data/UserGuide';
import { useEscBackout } from '../../Hooks/useEscBackout';
import { HeaderPill, PillButton } from '@/Components/primitives/HeaderPill';
import { SessionsDevicesPanel } from './SessionsDevicesPanel';
import { ClinicPanel } from './ClinicPanel';
import { openIntakeLineMint } from './IntakeMintSection';
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
    | { kind: 'app-content'; panel: 'plan-settings' | 'text-templates' | 'provider-templates' };

export const Settings = ({
    isVisible,
    onClose,
    initialPanel,
}: SettingsDrawerProps) => {
    const { currentAvatar, setAvatar, avatarList, customImage, isCustom, setCustomImage, clearCustomImage } = useAvatar();
    const { themeName } = useTheme();
    const isMobile = useIsMobile();
    const [activePanel, setActivePanel] = useState<'main' | 'release-notes' | 'avatar-picker' | 'user-profile' | 'pin-setup' | 'notification-settings' | 'feedback' | 'note-content' | 'privacy-policy' | 'sessions-devices' | 'clinic' | 'lora' | 'plan-settings' | 'text-templates' | 'provider-templates' | 'overview-widgets' | 'theme-picker' | 'storage' | 'feature-votes' | 'user-guide'>('main');
    // Desktop three-pane right detail. Never set on mobile (drills slide-push /
    // use a local Sheet instead). See DetailView above.
    const [detailView, setDetailView] = useState<DetailView>({ kind: 'none' });
    const detailOpen = detailView.kind !== 'none';
    const closeDetail = useCallback(() => setDetailView({ kind: 'none' }), []);
    // Desktop Esc: collapse the right detail pane first; a second Esc closes the drawer.
    useEscBackout(!isMobile && detailOpen, closeDetail);
    // MOBILE: the User Guide is its own top-level drawer, so opening it flips a
    // nav-store flag (which runs CLOSE_ALL_DRAWERS and takes Settings with it —
    // correct on a phone, where one full-screen surface replaces another).
    // DESKTOP: it is a center panel instead. Leaving Settings to read the guide
    // dropped you out of the surface entirely with nothing to come back to.
    const setShowUserGuideDrawer = useNavigationStore((s) => s.setShowUserGuideDrawer);
    const setUserGuideSection = useNavigationStore((s) => s.setUserGuideSection);
    const guideActive = !isMobile && isVisible && activePanel === 'user-guide';
    const guide = useUserGuideNav(guideActive);
    const { profile, updateProfile } = useUserProfile();
    const [slideDirection, setSlideDirection] = useState<'left' | 'right' | ''>('');
    const prevVisibleRef = useRef(false);
    const [isSupabaseConnected, setIsSupabaseConnected] = useState(false);
    const { user, signOut, isAuthenticated, isDevRole, isSupervisorRole, clinicId, surrogateClinicIds, supervisingClinicId, setSupervisingClinic } = useAuth();
    // Every cluster this user administers: their assigned one plus any loaned to
    // them. `clinicId` is the assignment; `supervisingClinicId` is the pointer the
    // clinic panel actually resolves through, so it decides which row reads active.
    const activeClinicId = supervisingClinicId ?? clinicId;
    const clusterOptions = useMemo(() => {
        if (!isSupervisorRole || !clinicId) return [] as { id: string; name: string }[];
        const loans = profile.surrogateClinics ?? [];
        return [
            { id: clinicId, name: profile.clinicName || 'My Cluster' },
            ...surrogateClinicIds.map((id) => ({
                id,
                name: loans.find((c) => c.id === id)?.name ?? 'Surrogate',
            })),
        ];
    }, [isSupervisorRole, clinicId, surrogateClinicIds, profile.clinicName, profile.surrogateClinics]);
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

    /** Where "back to the top" lands. Mobile has a menu screen; desktop's menu IS
     *  the rail, so 'main' would leave the center with nothing to show. Landing on
     *  the user's own settings is the resting panel there — except for guests, who
     *  have no profile and whose menu is Appearance + Feedback + Privacy only. */
    const homePanel = isMobile ? 'main' as const
        : isAuthenticated ? 'user-profile' as const
        : 'theme-picker' as const;

    // Set initial panel when drawer opens
    useEffect(() => {
        if (isVisible && !prevVisibleRef.current) {
            setActivePanel(!initialPanel || initialPanel === 'main' ? homePanel : initialPanel);
            setSlideDirection('');
        }
        prevVisibleRef.current = isVisible;
    }, [isVisible, initialPanel, homePanel]);

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

    // Esc inside the nested guide steps back to the settings tree before closing the
    // drawer — the same layering the detail pane gets above. The two are mutually
    // exclusive, so only one listener is ever attached.
    useEscBackout(!isMobile && !detailOpen && activePanel === 'user-guide', () => navigateCenter(homePanel));

    // 'user-guide' is a desktop-only center panel; on mobile the guide is its own
    // drawer and panelMap has no entry, so a desktop→mobile resize while reading it
    // would render an empty panel. Fall back to the menu.
    useEffect(() => {
        if (isMobile && activePanel === 'user-guide') setActivePanel('main');
    }, [isMobile, activePanel]);

const handleItemClick = useCallback((id: PanelId, closeDrawer: () => void) => {
        if (id === PANEL.CLOSE) { closeDrawer(); return; }
        if (id === PANEL.BACK_TO_MAIN) {
            if (isMobile) { handleSlideAnimation('right'); setActivePanel('main'); }
            else navigateCenter(homePanel);
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
    }, [handleSlideAnimation, isMobile, navigateCenter, homePanel]);

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

        // CLUSTERS section — cluster management, supervisors/dev only. Self-service
        // "Leave Cluster" is NOT here: it's a user-account action and lives in the
        // profile page next to Sign Out.
        if (isAuthenticated && clinicId && (isSupervisorRole || isDevRole)) {
            items.push({ type: 'header', label: 'Clusters' });
            if (clusterOptions.length > 1) {
                // A loaned supervisor administers more than one cluster. List them
                // all here rather than hiding the others behind a switch inside the
                // panel — picking a row flips the supervising pointer and opens that
                // cluster, so the menu shows the whole set at a glance.
                items.push(...clusterOptions.map((c) =>
                    opt(PANEL.CLINIC, <Building2 size={20} />, c.name,
                        c.id === clinicId ? 'Manage cluster and personnel' : 'Loaned cluster',
                        {
                            key: `clinic-${c.id}`,
                            activeWhen: activeClinicId === c.id,
                            action: () => { setSupervisingClinic(c.id); handleItemClick(PANEL.CLINIC, closeDrawer); },
                        }),
                ));
            } else {
                items.push(opt(PANEL.CLINIC, <Building2 size={20} />, profile.clinicName || 'My Cluster', 'Manage cluster and personnel'));
            }
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
                    action: () => {
                        if (isMobile) { setShowUserGuideDrawer(true); closeDrawer(); }
                        else navigateCenter('user-guide');
                    },
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
    }, [themeName, handleItemClick, isDevRole, isAuthenticated, isSupervisorRole, clinicId, profile.clinicName, clusterOptions, activeClinicId, setSupervisingClinic, updateProfile, hasUnvotedCycle, whisperNetVisible, setShowUserGuideDrawer, isMobile, navigateCenter]);

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
            // Desktop-only panel — the rail carries its own back row, so this title
            // is really just the drawer naming itself.
            case 'user-guide':          return { title: 'User Guide', ...backTo() };
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
                            ) : (<>
                                {/* Mints an outside-contact line. The section that owns
                                    the flow is two levels down, so it publishes an
                                    opener rather than taking a signal prop. */}
                                <PillButton icon={Plus} onClick={openIntakeLineMint} label="Add line" />
                                <PillButton icon={X} onClick={() => guardedClinicAction(handleClose)} label="Close" />
                            </>)}
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

    /** The drawer header names the DRAWER (v2/conventions, PaneHeader). Mobile's
     *  header IS the panel's chrome so it keeps the panel title; on desktop the rail
     *  already shows what is selected, and letting a panel retitle a 90%-wide drawer
     *  means opening Settings on the profile reads as "Profile". Actions still come
     *  from the panel — only the title is pinned. */
    const drawerHeader = useMemo(
        () => (isMobile || !headerConfig ? headerConfig : { ...headerConfig, title: 'Settings' }),
        [isMobile, headerConfig],
    );

    return (<>
        <BaseDrawer
            isVisible={isVisible}
            onClose={handleClose}
            fullHeight="90dvh"
            disableDrag={false}
            desktopPosition="left"
            desktopWidth="w-[90%]"
            header={drawerHeader}
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
                            'release-notes': (
                                <ReleaseNotesPanel
                                    onOpenFeatureVotes={() => { handleSlideAnimation('left'); setActivePanel('feature-votes'); }}
                                    onOpenGuide={isMobile ? undefined : (sectionId) => {
                                        navigateCenter('user-guide');
                                        setUserGuideSection(sectionId);
                                    }}
                                />
                            ),
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
                    if (detailView.kind === 'app-content') {
                        const titleMap: Record<typeof detailView.panel, string> = {
                            'plan-settings': 'Plan',
                            'text-templates': 'Text Templates',
                            'provider-templates': 'Provider Templates',
                        };
                        return (
                            <div className="flex h-full flex-col">
                                <PaneHeader title={titleMap[detailView.panel]} onBack={closeDetail} />
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
                                    width={260}
                                    keepMounted
                                    className="border-r border-tertiary/10 bg-themewhite/50"
                                    style={paneStyle}
                                >
                                    {activePanel === 'user-guide' ? (
                                        // The guide's own three-level TOC takes over the rail.
                                        // Nesting it here is the point: the settings tree is one
                                        // Back away, so reading the guide is a drill rather than
                                        // a jump to a different drawer.
                                        <div className="h-full flex flex-col">
                                            <PaneHeader
                                                title="User Guide"
                                                onBack={() => navigateCenter(homePanel)}
                                                backLabel="Back to Settings"
                                            />
                                            <div className="shrink-0 px-2.5 py-2 border-b border-tertiary/10">
                                                <SearchInput
                                                    value={guide.query}
                                                    onChange={guide.setQuery}
                                                    placeholder="Search the guide"
                                                />
                                            </div>
                                            <div className="flex-1 min-h-0 overflow-y-auto">
                                                <UserGuideTree
                                                    chapters={guide.visibleChapters}
                                                    activeId={guide.activeId}
                                                    expandedChapters={guide.expandedChapters}
                                                    expandedSections={guide.expandedSections}
                                                    onToggleChapter={guide.toggleChapter}
                                                    onToggleSection={guide.toggleSection}
                                                    onJump={guide.jumpTo}
                                                    expandAll={guide.searching}
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <SettingsRail {...mainPanelProps} activeId={activePanel} />
                                    )}
                                </SlideRevealPane>
                                {/* Center — the selected top-level panel, capped to a reading
                                    measure and centered in the remaining space. Every panel is
                                    authored as a phone surface (medallion icon left, control
                                    right); across the full width of a 90% drawer those two ends
                                    sit a pane apart. The panel keeps its own scrolling root, so
                                    the scrollbar rides the column edge, not the pane edge. */}
                                <div className="flex-1 min-w-0 flex justify-center">
                                    {activePanel === 'user-guide' ? (
                                        // Not capped with the rest: the guide is a reading
                                        // surface that already carries its own measure
                                        // (UserGuideBody caps prose at 64rem).
                                        <div ref={guide.bodyScrollRef} className="w-full h-full overflow-y-auto" style={paneStyle}>
                                            {guide.visibleChapters.length === 0 ? (
                                                <p className="text-[10pt] text-tertiary text-center py-16">
                                                    No sections match “{guide.query}”.
                                                </p>
                                            ) : (
                                                <UserGuideBody chapters={guide.visibleChapters} isMobile={false} />
                                            )}
                                            <p className="text-[9pt] text-tertiary text-center pb-10">
                                                User Guide · v{USER_GUIDE_VERSION}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="w-full max-w-3xl flex flex-col overflow-hidden" style={paneStyle}>
                                            {/* 'main' is the mobile menu screen and has no desktop
                                                meaning — the rail is the menu. It can still appear
                                                here for a frame after handleClose resets, so it
                                                resolves to the same panel the drawer opens on. */}
                                            {panelMap[activePanel === 'main' ? homePanel : activePanel] ?? null}
                                        </div>
                                    )}
                                </div>
                                {/* Right — nested detail (child roster / App Content subpage);
                                    slides in from the right as the rail collapses. */}
                                <SlideRevealPane
                                    open={detailOpen}
                                    side="right"
                                    width={380}
                                    className="border-l border-primary/10 bg-themewhite"
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
    </>
    );
};
