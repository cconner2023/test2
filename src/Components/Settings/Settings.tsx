import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Palette, Shield, Lock, MessageSquare, Bell, Stethoscope, Scale, X, Building2, Check, Radio, LayoutDashboard, HardDrive, Smartphone, BookOpen } from 'lucide-react';
import { BaseDrawer } from '@/Components/primitives/BaseDrawer';
import { useIsMobile } from '../../Hooks/useIsMobile';
import { ChildClinicRosterCard } from './Supervisor/ChildClinicRosterSheet';
import { createPaneHostStore, PaneHostContext, HostedPaneCard, type PaneHost } from '@/Components/primitives/paneHost';
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
import { HeaderSlotContext, HeaderSlotMenu, HeaderSlotOutlet, useHeaderSlotStore } from './panelHeaderSlot';
import { TextTemplatesPanel } from './TextTemplatesPanel';
import { ProviderTemplatesPanel } from './ProviderTemplatesPanel';
import { ProfilePage } from './ProfilePage';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../Hooks/useAuth';
import { useAuthStore } from '../../stores/useAuthStore';
import { clearServiceWorkerCaches } from '../../lib/cacheService';
import { deleteOwnAccount } from '../../lib/authService';
import { PANEL, PANEL_TARGET, type PanelId, type SettingsItem } from './SettingsTypes';
import { UI_TIMING } from '../../Utilities/constants';
import { useBetaFlag } from '../../lib/betaFeatures';
import { MainSettingsPanel } from './MainSettingsPanel';
import { SettingsRail } from './SettingsRail';
import { AvatarPickerPanel } from './AvatarPickerPanel';
import { ContentWrapper } from '@/Components/primitives/ContentWrapper';
import { PaneCard, PaneSlot } from '@/Components/primitives/PaneCard';
import type { CardMorphHost } from '@/Components/primitives/OverlayStack';
import { useHeldWhileOpen } from '../../Hooks/useHeldWhileOpen';
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
import { clusterLabel, useClusterDirectoryVersion } from '../../Utilities/clusterLabel';


/** Desktop panels laid out with SettingsPage, which handle their own width. The
 *  rest keep the max-w-3xl cap on purpose: single short forms (Notifications,
 *  Feedback, Feature Votes, WhisperNet) and prose (Privacy) read
 *  worse stretched, not better. */
const WIDE_PANELS = new Set<string>([
    'clinic', 'user-profile', 'pin-setup', 'sessions-devices', 'storage',
    'overview-widgets', 'theme-picker', 'avatar-picker', 'release-notes', 'note-content',
]);

interface SettingsDrawerProps {
    isVisible: boolean;
    onClose: () => void;
    initialPanel?: 'main' | 'release-notes' | 'user-profile' | 'feedback' | 'feature-votes' | 'clinic';
}

/** Desktop PaneCard content, floated over the main pane. The main pane keeps its
 *  own `activePanel`; this is the record drilled from within a panel (mobile routes
 *  these through the slide-push / local Sheet instead, so `detailView` stays 'none'). */
type DetailView =
    | { kind: 'none' }
    | { kind: 'child-cluster'; id: string; name: string }
    | { kind: 'app-content'; panel: 'plan-settings' | 'text-templates' | 'provider-templates' };

const CLOSED_PANE = { isOpen: false, title: '', onClose: () => {}, children: null };

export const Settings = ({
    isVisible,
    onClose,
    initialPanel,
}: SettingsDrawerProps) => {
    const { currentAvatar, setAvatar, avatarList, customImage, isCustom, setCustomImage, clearCustomImage } = useAvatar();
    const { themeName } = useTheme();
    const isMobile = useIsMobile();
    const [activePanel, setActivePanel] = useState<'main' | 'release-notes' | 'avatar-picker' | 'user-profile' | 'pin-setup' | 'notification-settings' | 'feedback' | 'note-content' | 'privacy-policy' | 'sessions-devices' | 'clinic' | 'lora' | 'plan-settings' | 'text-templates' | 'provider-templates' | 'overview-widgets' | 'theme-picker' | 'storage' | 'feature-votes'>('main');
    // Desktop PaneCard detail. Never set on mobile. See DetailView above. PaneCard's
    // own Esc closes it first; a second Esc closes the drawer.
    const [detailView, setDetailView] = useState<DetailView>({ kind: 'none' });
    const detailOpen = detailView.kind !== 'none';
    const shownDetail = useHeldWhileOpen(detailOpen, detailView);
    const closeDetail = useCallback(() => setDetailView({ kind: 'none' }), []);
    // An App Content item's editor morphs into the subpage card's slot rather than
    // floating a second overlay over it (PropertyPanel's cardHost pattern). The
    // subpage card stays mounted but hidden while the editor holds the slot, so
    // Back / Close returns to the list with its scroll and state intact.
    const [morphEl, setMorphEl] = useState<HTMLDivElement | null>(null);
    const [morphActive, setMorphActive] = useState(false);
    const cardHost = useMemo<CardMorphHost>(() => ({ el: morphEl, onActiveChange: setMorphActive }), [morphEl]);
    // Cluster panel's member Add / Edit (PaneStack) publish into ONE desktop card
    // shared with the child-cluster roster: last opened wins. A published view
    // closes the roster detail; opening the roster closes the published view.
    const [clinicPaneStore] = useState(createPaneHostStore);
    // App Content panels (Plan, Text Templates) publish their Add / ⋯ menus up into
    // the container header: the mobile drawer header, or the desktop subpage card.
    const contentHeaderSlot = useHeaderSlotStore();
    const clinicPaneHost = useMemo<PaneHost>(() => ({
        store: clinicPaneStore,
        onActiveChange: (active) => { if (active) setDetailView({ kind: 'none' }); },
    }), [clinicPaneStore]);
    // The User Guide is its own top-level drawer on every platform (also in the
    // SideNav). Opening it runs CLOSE_ALL_DRAWERS, taking Settings with it. The
    // desktop guide once lived inside this drawer's rail; that buried it and gave
    // it chrome no other rail had. v2-decisions/settings 2026-11-15.
    const setShowUserGuideDrawer = useNavigationStore((s) => s.setShowUserGuideDrawer);
    const { profile, updateProfile } = useUserProfile();
    const [slideDirection, setSlideDirection] = useState<'left' | 'right' | ''>('');
    const prevVisibleRef = useRef(false);
    const [isSupabaseConnected, setIsSupabaseConnected] = useState(false);
    const { user, signOut, isAuthenticated, isDevRole, isSupervisorRole, clinicId, surrogateClinicIds, supervisingClinicId, setSupervisingClinic } = useAuth();
    // Every cluster this user administers: their assigned one plus any loaned to
    // them. `clinicId` is the assignment; `supervisingClinicId` is the pointer the
    // clinic panel actually resolves through, so it decides which row reads active.
    const activeClinicId = supervisingClinicId ?? clinicId;
    const clusterDirectory = useClusterDirectoryVersion();
    const clusterOptions = useMemo(() => {
        if (!isSupervisorRole || !clinicId) return [] as { id: string; name: string }[];
        const loans = profile.surrogateClinics ?? [];
        return [
            { id: clinicId, name: clusterLabel(clinicId, profile.clinicName) || 'My Cluster' },
            ...surrogateClinicIds.map((id) => ({
                id,
                name: clusterLabel(id, loans.find((c) => c.id === id)?.name) || 'Surrogate',
            })),
        ];
    }, [isSupervisorRole, clinicId, surrogateClinicIds, profile.clinicName, profile.surrogateClinics, clusterDirectory]);
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
                items.push(opt(PANEL.CLINIC, <Building2 size={20} />, clusterLabel(clinicId, profile.clinicName) || 'My Cluster', 'Manage cluster and personnel'));
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
    }, [themeName, handleItemClick, isDevRole, isAuthenticated, isSupervisorRole, clinicId, profile.clinicName, clusterOptions, clusterDirectory, activeClinicId, setSupervisingClinic, updateProfile, hasUnvotedCycle, whisperNetVisible, setShowUserGuideDrawer]);

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
                    rightContent: (
                        <HeaderPill multi>
                            <HeaderSlotOutlet store={contentHeaderSlot} />
                            <HeaderSlotMenu store={contentHeaderSlot} align="right" />
                            <PillButton icon={X} onClick={handleClose} label="Close" />
                        </HeaderPill>
                    ),
                    hideDefaultClose: true,
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
                    rightContent: (
                        <HeaderPill multi>
                            <HeaderSlotOutlet store={contentHeaderSlot} />
                            <HeaderSlotMenu store={contentHeaderSlot} align="right" />
                            <PillButton icon={X} onClick={handleClose} label="Close" />
                        </HeaderPill>
                    ),
                    hideDefaultClose: true,
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
    }, [activePanel, backTo, handleClose, isSupervisorRole, clinicEditing, handleSlideAnimation, guardedClinicAction, isMobile, contentHeaderSlot]);

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
            desktopPosition="left"
            isVisible={isVisible}
            onClose={handleClose}
            mobilePanel
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
                                    onSignOut={async () => { await clearServiceWorkerCaches(); await signOut(); handleClose(); }}
                                    onDeleteAccount={async () => {
                                        const result = await deleteOwnAccount();
                                        if (!result.success) return result;
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
                            'plan-settings':    <HeaderSlotContext.Provider value={contentHeaderSlot}><PlanPanel /></HeaderSlotContext.Provider>,
                            'provider-templates': <ProviderTemplatesPanel />,
                            'text-templates': <HeaderSlotContext.Provider value={contentHeaderSlot}><TextTemplatesPanel /></HeaderSlotContext.Provider>,
                            'notification-settings': <NotificationSettingsPanel />,
                            'sessions-devices':     <SessionsDevicesPanel />,
                            'lora':                 <LoRaPanel />,
                            'pin-setup':            <PinSetupPanel />,
                            'clinic': (
                                <PaneHostContext.Provider value={isMobile ? null : clinicPaneHost}>
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
                                    onOpenChild={isMobile ? undefined : (child) => { clinicPaneStore.get()?.onClose(); setDetailView({ kind: 'child-cluster', id: child.id, name: child.name }); }}
                                    activeChildId={detailView.kind === 'child-cluster' ? detailView.id : undefined}
                                />
                                </PaneHostContext.Provider>
                            ),
                };

                // Desktop panes zero out the glass-header offset token: on desktop
                // BaseDrawer renders a solid in-flow header (glassHeader=isMobile) and
                // never publishes --drawer-header-h, so each panel's
                // pt-[calc(var(--drawer-header-h,3.5rem)+…)] collapses to the +… floor.
                const paneStyle = { ['--drawer-header-h' as string]: '0px' } as React.CSSProperties;

                // Desktop PaneCard over the main pane. Rendered while closed too
                // (PaneCard unmounts itself after the exit) so shownDetail can
                // carry the content out.
                const renderDetail = () => {
                    if (shownDetail.kind === 'child-cluster') {
                        return (
                            <ChildClinicRosterCard
                                isOpen={detailOpen}
                                clinicId={shownDetail.id}
                                clinicName={shownDetail.name}
                                currentUserId={user?.id ?? null}
                                onClose={closeDetail}
                            />
                        );
                    }
                    if (shownDetail.kind === 'app-content') {
                        const titleMap: Record<typeof shownDetail.panel, string> = {
                            'plan-settings': 'Plan',
                            'text-templates': 'Text Templates',
                            'provider-templates': 'Provider Templates',
                        };
                        return (<>
                            <PaneCard
                                isOpen={detailOpen}
                                onClose={closeDetail}
                                title={titleMap[shownDetail.panel]}
                                width={420}
                                fill
                                hidden={morphActive}
                                actions={shownDetail.panel === 'provider-templates' ? undefined : (
                                    <>
                                        <HeaderSlotOutlet store={contentHeaderSlot} />
                                        <HeaderSlotMenu store={contentHeaderSlot} align="right" />
                                    </>
                                )}
                            >
                                <HeaderSlotContext.Provider value={contentHeaderSlot}>
                                <div key={shownDetail.panel} className="h-full" style={paneStyle}>
                                    {shownDetail.panel === 'plan-settings' && <PlanPanel cardHost={cardHost} />}
                                    {shownDetail.panel === 'text-templates' && <TextTemplatesPanel cardHost={cardHost} />}
                                    {shownDetail.panel === 'provider-templates' && <ProviderTemplatesPanel cardHost={cardHost} />}
                                </div>
                                </HeaderSlotContext.Provider>
                            </PaneCard>
                            <PaneSlot width={420}>
                                <div ref={setMorphEl} className="flex flex-col min-h-0 max-h-full" />
                            </PaneSlot>
                        </>);
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
                                <SettingsRail {...mainPanelProps} activeId={activePanel} />
                                {/* Main pane. `relative` is the PaneCard's positioning box.
                                    Panels outside WIDE_PANELS keep a max-w-3xl cap: a phone
                                    surface stretched across a 90% drawer puts its icon and
                                    control a pane apart. */}
                                <div className="relative flex-1 min-w-0 flex justify-center bg-themewhite">
                                    <div
                                        className={`w-full flex flex-col overflow-hidden ${WIDE_PANELS.has(activePanel) ? '' : 'max-w-3xl'}`}
                                        style={paneStyle}
                                    >
                                        {/* 'main' is the mobile menu screen; the rail is the
                                            desktop menu. It can still appear here for a frame
                                            after handleClose resets, so it resolves to the
                                            panel the drawer opens on. */}
                                        {panelMap[activePanel === 'main' ? homePanel : activePanel] ?? null}
                                    </div>
                                    {renderDetail()}
                                    {/* Cluster member Add / Edit (PaneStack publishers). Closed
                                        fallback = same PaneCard instance, so a view exits with
                                        its held content. */}
                                    <HostedPaneCard store={clinicPaneStore} fallback={CLOSED_PANE} />
                                </div>
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
