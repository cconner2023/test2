import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Moon, Sun, Shield, BookOpen, UserCog, Lock, MessageSquare, Mail, Bell, Stethoscope, ClipboardCheck, Scale, Package } from 'lucide-react';
import { BaseDrawer } from '../BaseDrawer';
import { resizeImage } from '../../Hooks/useProfileAvatar';
import { useAvatar } from '../../Utilities/AvatarContext';
import { useUserProfile } from '../../Hooks/useUserProfile';
import { useSwipeBack } from '../../Hooks/useSwipeBack';
import { ReleaseNotesPanel } from './ReleaseNotesPanel';
import { UserProfileDisplay } from './UserProfileDisplay';
import { ProfileChangeRequestForm } from './ProfileChangeRequestForm';
import { AccountRequestForm } from './AccountRequestForm';
import { AdminPanel } from './AdminPanel';
import { SupervisorPanel } from './SupervisorPanel';
import { GuestOptionsPanel } from './GuestOptionsPanel';
import { LoginPanel } from './LoginPanel';
import { TrainingPanel, type TrainingView } from './TrainingPanel';
import { MessagesPanel, type MessagesView } from './MessagesPanel';
import { PinSetupPanel } from './PinSetupPanel';
import { NotificationSettingsPanel } from './NotificationSettingsPanel';
import { FeedbackPanel } from './FeedbackPanel';
import { PrivacyPolicyPanel } from './PrivacyPolicyPanel';
import { NoteContentPanel } from './NoteContentPanel';
import { ProfilePage } from './ProfilePage';
import { ChangePasswordPanel } from './ChangePasswordPanel';
import { CertificationsPanel } from './CertificationsPanel';
import type { subjectAreaArrayOptions } from '../../Types/CatTypes';
import { stp68wTraining } from '../../Data/TrainingTaskList';
import { getTaskData } from '../../Data/TrainingData';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../Hooks/useAuth';
import { clearAllUserData } from '../../lib/offlineDb';
import { clearServiceWorkerCaches } from '../../lib/cacheService';
import { PANEL, PANEL_TARGET, type PanelId, type SettingsItem } from './SettingsTypes';
import { UI_TIMING } from '../../Utilities/constants';
import { MainSettingsPanel } from './MainSettingsPanel';
import { AvatarPickerPanel } from './AvatarPickerPanel';
import { ContentWrapper } from './ContentWrapper';
import { useMessagesContext } from '../../Hooks/MessagesContext';
import { PropertyPanel } from '../Property/PropertyPanel';
import { PROPERTY_MANAGEMENT_ENABLED } from '../../lib/featureFlags';

interface SettingsDrawerProps {
    isVisible: boolean;
    onClose: () => void;
    isDarkMode: boolean;
    onToggleTheme: () => void;
    initialPanel?: 'main' | 'release-notes' | 'training';
    /** When set alongside initialPanel='training', deep-links to a specific training task */
    initialTrainingTaskId?: string | null;
}

export const Settings = ({
    isVisible,
    onClose,
    isDarkMode,
    onToggleTheme,
    initialPanel,
    initialTrainingTaskId,
}: SettingsDrawerProps) => {
    const { currentAvatar, setAvatar, avatarList, customImage, isCustom, setCustomImage, clearCustomImage } = useAvatar();
    const [activePanel, setActivePanel] = useState<'main' | 'release-notes' | 'avatar-picker' | 'user-profile' | 'user-profile-details' | 'profile-change-request' | 'admin' | 'supervisor' | 'guest-options' | 'login' | 'pin-setup' | 'notification-settings' | 'feedback' | 'note-content' | 'privacy-policy' | 'change-password' | 'certifications' | 'property' | TrainingView | MessagesView>('main');
    const { profile, updateProfile } = useUserProfile();
    const [slideDirection, setSlideDirection] = useState<'left' | 'right' | ''>('');
    const [selectedTask, setSelectedTask] = useState<subjectAreaArrayOptions | null>(null);
    const [selectedPeerId, setSelectedPeerId] = useState<string | null>(null);
    const [selectedPeerName, setSelectedPeerName] = useState<string | null>(null);
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const prevVisibleRef = useRef(false);
    const supervisorBackRef = useRef<(() => void) | null>(null);
    const [isSupabaseConnected, setIsSupabaseConnected] = useState(false);
    const { user, signOut, isAuthenticated, isDevRole, isSupervisorRole } = useAuth();
    const messagesCtx = useMessagesContext();
    const totalUnread = useMemo(() => {
        if (!messagesCtx) return 0;
        return Object.values(messagesCtx.unreadCounts).reduce((sum, n) => sum + n, 0);
    }, [messagesCtx?.unreadCounts]);

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
            // Deep-link to a specific training task if requested
            if (initialPanel === 'training' && initialTrainingTaskId && getTaskData(initialTrainingTaskId)) {
                // Find the task across all skill levels for deep-linking
                let foundTask: subjectAreaArrayOptions | null = null;

                for (let levelIdx = 0; levelIdx < stp68wTraining.length && !foundTask; levelIdx++) {
                    const level = stp68wTraining[levelIdx];
                    for (let areaIdx = 0; areaIdx < level.subjectArea.length && !foundTask; areaIdx++) {
                        const area = level.subjectArea[areaIdx];
                        const taskIdx = area.tasks.findIndex(t => t.id === initialTrainingTaskId);
                        if (taskIdx !== -1) {
                            const task = area.tasks[taskIdx];
                            foundTask = {
                                id: taskIdx,
                                icon: task.id,
                                text: task.title,
                                isParent: false,
                                parentId: areaIdx,
                            };
                        }
                    }
                }

                if (foundTask) {
                    setSelectedTask(foundTask);
                    setActivePanel('training-detail');
                    setSlideDirection('');
                } else {
                    setActivePanel('training');
                    setSlideDirection('');
                }
            } else {
                setActivePanel(initialPanel || 'main');
                setSlideDirection('');
            }
        }
        prevVisibleRef.current = isVisible;
    }, [isVisible, initialPanel, initialTrainingTaskId]);

    const handleSlideAnimation = useCallback((direction: 'left' | 'right') => {
        setSlideDirection(direction);
        setTimeout(() => setSlideDirection(''), UI_TIMING.SLIDE_ANIMATION);
    }, []);

    const handleItemClick = useCallback((id: PanelId, closeDrawer: () => void) => {
        if (id === PANEL.CLOSE) { closeDrawer(); return; }
        if (id === PANEL.BACK_TO_MAIN) { handleSlideAnimation('right'); setActivePanel('main'); return; }

        // Toggle theme has no panel navigation
        if (id === PANEL.TOGGLE_THEME) return;

        // Training / Messages need extra reset
        if (id === PANEL.TRAINING) setSelectedTask(null);
        if (id === PANEL.MESSAGES) setSelectedPeerId(null);

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

        const items: SettingsItem[] = [
            // Top section (no header)
            opt(PANEL.TRAINING, <BookOpen size={20} />, 'My Training'),
        ];

        if (isAuthenticated) {
            items.push(opt(PANEL.MESSAGES, <Mail size={20} />, 'Messages', totalUnread > 0 ? { badge: totalUnread } : undefined));
            if (PROPERTY_MANAGEMENT_ENABLED) {
                items.push(opt(PANEL.PROPERTY, <Package size={20} />, 'Property Book'));
            }
        }

        // ROLES section - only if user has supervisor or admin roles
        if (isSupervisorRole || isDevRole) {
            items.push({ type: 'header', label: 'Roles' });
            if (isSupervisorRole) items.push(opt(PANEL.SUPERVISOR, <ClipboardCheck size={20} />, 'Supervisor'));
            if (isDevRole) items.push(opt(PANEL.ADMIN, <UserCog size={20} />, 'Admin Panel'));
        }

        // PREFERENCES section
        items.push(
            { type: 'header', label: 'Preferences' },
            opt(PANEL.TOGGLE_THEME, isDarkMode ? <Sun size={20} /> : <Moon size={20} />, 'Toggle Theme', { action: onToggleTheme }),
            opt(PANEL.PIN_SETUP, <Lock size={20} />, 'Security'),
            opt(PANEL.NOTE_CONTENT, <Stethoscope size={20} />, 'Note Content'),
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
    }, [isDarkMode, onToggleTheme, handleItemClick, isDevRole, isSupervisorRole, isAuthenticated, totalUnread]);

    // Messages panel navigation helpers
    const handleMessagesSelectPeer = useCallback((medic: import('../../Types/SupervisorTestTypes').ClinicMedic) => {
        setSelectedPeerId(medic.id);
        setSelectedGroupId(null);
        // Build header name — use own profile name when messaging self
        const isSelf = medic.id === user?.id;
        const name = isSelf
            ? [profile.rank, profile.lastName].filter(Boolean).join(' ') || profile.firstName || 'Notes'
            : [medic.rank, medic.lastName].filter(Boolean).join(' ') || medic.firstName || 'Chat';
        setSelectedPeerName(name);
        handleSlideAnimation('left');
        setActivePanel('messages-chat');
    }, [handleSlideAnimation, user?.id, profile.rank, profile.lastName, profile.firstName]);

    const handleMessagesSelectGroup = useCallback((group: import('../../lib/signal/groupTypes').GroupInfo) => {
        setSelectedGroupId(group.groupId);
        setSelectedPeerId(null);
        setSelectedPeerName(group.name);
        handleSlideAnimation('left');
        setActivePanel('messages-group-chat');
    }, [handleSlideAnimation]);

    const handleMessagesBack = useCallback(() => {
        if (activePanel === 'messages-chat' || activePanel === 'messages-group-chat') {
            handleSlideAnimation('right');
            setActivePanel('messages');
            setSelectedPeerId(null);
            setSelectedPeerName(null);
            setSelectedGroupId(null);
        } else if (activePanel === 'messages') {
            handleSlideAnimation('right');
            setActivePanel('main');
        }
    }, [activePanel, handleSlideAnimation]);

    // Training panel navigation helpers
    const handleTrainingSelectTask = useCallback((task: subjectAreaArrayOptions) => {
        setSelectedTask(task);
        handleSlideAnimation('left');
        setActivePanel('training-detail');
    }, [handleSlideAnimation]);

    const handleTrainingBack = useCallback(() => {
        if (activePanel === 'training-detail') {
            handleSlideAnimation('right');
            setActivePanel('training');
            setSelectedTask(null);
        } else if (activePanel === 'training') {
            handleSlideAnimation('right');
            setActivePanel('main');
        }
    }, [activePanel, handleSlideAnimation]);

    // Swipe-back for sub-panels (mobile touch only)
    const swipeHandlers = useSwipeBack(
        useMemo(() => {
            if (activePanel === 'main') return undefined;
            if (activePanel === 'training-detail' || activePanel === 'training') {
                return handleTrainingBack;
            }
            if (activePanel === 'messages-chat' || activePanel === 'messages-group-chat' || activePanel === 'messages') {
                return handleMessagesBack;
            }
            // Sub-panels of the profile hub go back to user-profile
            if (activePanel === 'user-profile-details' || activePanel === 'change-password' || activePanel === 'certifications') {
                return () => { handleSlideAnimation('right'); setActivePanel('user-profile'); };
            }
            if (activePanel === 'profile-change-request') {
                return () => { handleSlideAnimation('right'); setActivePanel('user-profile-details'); };
            }
            return () => { handleSlideAnimation('right'); setActivePanel('main'); };
        }, [activePanel, handleSlideAnimation, handleTrainingBack, handleMessagesBack]),
        activePanel !== 'main',
    );

    /** Shorthand: back button that slides right to a target panel (default: 'main'). */
    const backTo = useCallback((target: typeof activePanel = 'main') => ({
        showBack: true as const,
        onBack: () => { handleSlideAnimation('right'); setActivePanel(target); },
    }), [handleSlideAnimation]);

    const headerConfig = useMemo(() => {
        switch (activePanel) {
            case 'main':
                return { title: 'Settings' };
            case 'training-detail':
                return { title: selectedTask?.text || 'Task', showBack: true, onBack: handleTrainingBack };
            case 'supervisor':
                return { title: 'Supervisor', showBack: true, onBack: () => { supervisorBackRef.current?.(); } };
            case 'profile-change-request':
                return { title: 'Request Changes', ...backTo('user-profile-details') };
            case 'login':
                return { title: 'Sign In', ...backTo('guest-options') };
            // Sub-panels of the profile hub go back to user-profile
            case 'user-profile-details': return { title: 'User Information', ...backTo('user-profile') };
            case 'change-password':     return { title: 'Change Password', ...backTo('user-profile') };
            case 'certifications':      return { title: 'Certifications', ...backTo('user-profile') };
            // All panels below slide right back to main
            case 'release-notes':       return { title: 'Release Notes', ...backTo() };
            case 'avatar-picker':       return { title: 'Choose Avatar', ...backTo() };
            case 'user-profile':        return { title: 'Profile', ...backTo() };
            case 'messages':            return { title: 'Messages', ...backTo() };
            case 'messages-chat':       return { title: selectedPeerName ?? 'Chat', showBack: true, onBack: handleMessagesBack };
            case 'messages-group-chat': return { title: selectedPeerName ?? 'Group', showBack: true, onBack: handleMessagesBack };
            case 'training':            return { title: 'My Training', ...backTo() };
            case 'property':            return { title: 'Property Book', ...backTo() };
            case 'admin':               return { title: 'Admin Panel', ...backTo() };
            case 'guest-options':       return { title: 'Sign In', ...backTo() };
            case 'pin-setup':           return { title: 'App Lock', ...backTo() };
            case 'notification-settings': return { title: 'Notifications', ...backTo() };
            case 'feedback':            return { title: 'Feedback', ...backTo() };
            case 'privacy-policy':      return { title: 'Privacy Policy', ...backTo() };
            case 'note-content':        return { title: 'Note Content', ...backTo() };
        }
    }, [activePanel, backTo, selectedTask, selectedPeerName, handleTrainingBack, handleMessagesBack]);

    return (
        <BaseDrawer
            isVisible={isVisible}
            onClose={() => { setActivePanel('main'); setSlideDirection(''); setSelectedTask(null); setSelectedPeerId(null); setSelectedPeerName(null); setSelectedGroupId(null); onClose(); }}
            fullHeight="90dvh"
            disableDrag={false}
            header={headerConfig}
        >
            {(handleClose) => (
                <ContentWrapper slideDirection={slideDirection} swipeHandlers={activePanel !== 'main' ? swipeHandlers : undefined}>
                    {activePanel === 'main' ? (
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
                                    : 'Tap to sign in or request account'
                            }
                            displayClinic={
                                isAuthenticated
                                    ? (profile.clinicName
                                        ? `${profile.clinicName}${profile.uic ? ' \u00b7 ' + profile.uic : ''}`
                                        : profile.uic
                                            ? `UIC: ${profile.uic}`
                                            : undefined)
                                    : undefined
                            }
                            onAvatarClick={() => handleItemClick(PANEL.AVATAR_PICKER, handleClose)}
                            onProfileClick={() => {
                                if (!isAuthenticated) {
                                    handleItemClick(PANEL.GUEST_OPTIONS, handleClose);
                                } else {
                                    handleItemClick(PANEL.USER_PROFILE, handleClose);
                                }
                            }}
                            isConnected={isSupabaseConnected}
                        />
                    ) : activePanel === 'user-profile' ? (
                        isAuthenticated === false ? (
                            <AccountRequestForm />
                        ) : (
                            <ProfilePage
                                onAvatarClick={() => handleItemClick(PANEL.AVATAR_PICKER, handleClose)}
                                onNavigate={(panel) => {
                                    handleSlideAnimation('left');
                                    setActivePanel(panel);
                                }}
                                onSignOut={async () => { await clearAllUserData(); await clearServiceWorkerCaches(); await signOut(); handleClose(); }}
                            />
                        )
                    ) : activePanel === 'user-profile-details' ? (
                        <UserProfileDisplay
                            onRequestChange={() => handleItemClick(PANEL.PROFILE_CHANGE_REQUEST, handleClose)}
                        />
                    ) : activePanel === 'change-password' ? (
                        <ChangePasswordPanel />
                    ) : activePanel === 'certifications' ? (
                        <CertificationsPanel />
                    ) : activePanel === 'profile-change-request' ? (
                        <ProfileChangeRequestForm />
                    ) : activePanel === 'avatar-picker' ? (
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
                    ) : activePanel === 'release-notes' ? (
                        <ReleaseNotesPanel />
                    ) : activePanel === 'guest-options' ? (
                        <GuestOptionsPanel
                            onSignIn={() => handleItemClick(PANEL.LOGIN, handleClose)}
                            onRequestAccount={() => {
                                handleSlideAnimation('left');
                                setActivePanel('user-profile');
                            }}
                        />
                    ) : activePanel === 'login' ? (
                        <LoginPanel
                            onSuccess={() => {
                                handleSlideAnimation('right');
                                setActivePanel('main');
                            }}
                            onRequestAccount={() => {
                                handleSlideAnimation('left');
                                setActivePanel('user-profile');
                            }}
                        />
                    ) : activePanel === 'feedback' ? (
                        <FeedbackPanel />
                    ) : activePanel === 'privacy-policy' ? (
                        <PrivacyPolicyPanel />
                    ) : activePanel === 'note-content' ? (
                        <NoteContentPanel />
                    ) : activePanel === 'notification-settings' ? (
                        <NotificationSettingsPanel />
                    ) : activePanel === 'pin-setup' ? (
                        <PinSetupPanel />
                    ) : (activePanel === 'training' || activePanel === 'training-detail') ? (
                        <TrainingPanel
                            view={activePanel}
                            selectedTask={selectedTask}
                            onSelectTask={handleTrainingSelectTask}
                        />
                    ) : null}

                    {/* Pre-mounted panels — data loads when Settings opens, hidden until active */}
                    {isAuthenticated && (
                        <div className="h-full" style={{ display: activePanel === 'messages' || activePanel === 'messages-chat' || activePanel === 'messages-group-chat' ? undefined : 'none' }}>
                            <MessagesPanel
                                view={(activePanel === 'messages' || activePanel === 'messages-chat' || activePanel === 'messages-group-chat') ? activePanel : 'messages'}
                                selectedPeerId={selectedPeerId}
                                selectedGroupId={selectedGroupId}
                                onSelectPeer={handleMessagesSelectPeer}
                                onSelectGroup={handleMessagesSelectGroup}
                                onBack={handleMessagesBack}
                            />
                        </div>
                    )}
                    {isSupervisorRole && (
                        <div className="h-full" style={{ display: activePanel === 'supervisor' ? undefined : 'none' }}>
                            <SupervisorPanel
                                backRef={supervisorBackRef}
                                onBackToMain={() => { handleSlideAnimation('right'); setActivePanel('main'); }}
                            />
                        </div>
                    )}
                    {isDevRole && (
                        <div className="h-full" style={{ display: activePanel === 'admin' ? undefined : 'none' }}>
                            <AdminPanel />
                        </div>
                    )}
                    {isAuthenticated && PROPERTY_MANAGEMENT_ENABLED && (
                        <div className="h-full relative" style={{ display: activePanel === 'property' ? undefined : 'none' }}>
                            <PropertyPanel />
                        </div>
                    )}
                </ContentWrapper>
            )}
        </BaseDrawer>
    );
};
