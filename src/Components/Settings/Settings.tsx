import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Moon, Sun, Shield, FileText, BookOpen, UserCog, Lock, MessageSquare, Bell, HelpCircle, Stethoscope, ClipboardCheck } from 'lucide-react';
import { BaseDrawer } from '../BaseDrawer';
import type { SavedNote } from '../../Hooks/useNotesStorage';
import { resizeImage } from '../../Hooks/useProfileAvatar';
import type { ProfileAvatar } from '../../Data/ProfileAvatars';
import { useUserProfile } from '../../Hooks/useUserProfile';
import { useSwipeBack } from '../../Hooks/useSwipeBack';
import { MyNotesPanel } from './MyNotesPanel';
import { ReleaseNotesPanel } from './ReleaseNotesPanel';
import { UserProfileDisplay } from './UserProfileDisplay';
import { ProfileChangeRequestForm } from './ProfileChangeRequestForm';
import { AccountRequestForm } from './AccountRequestForm';
import { AdminPanel } from './AdminPanel';
import { SupervisorPanel } from './SupervisorPanel';
import { GuestOptionsPanel } from './GuestOptionsPanel';
import { LoginPanel } from './LoginPanel';
import { TrainingPanel, type TrainingView } from './TrainingPanel';
import { PinSetupPanel } from './PinSetupPanel';
import { NotificationSettingsPanel } from './NotificationSettingsPanel';
import { FeedbackPanel } from './FeedbackPanel';
import { HowToPanel } from './HowToPanel';
import { NoteContentPanel } from './NoteContentPanel';
import type { subjectAreaArrayOptions } from '../../Types/CatTypes';
import { stp68wTraining } from '../../Data/TrainingTaskList';
import { getTaskData } from '../../Data/TrainingData';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../Hooks/useAuth';
import { clearAllUserData } from '../../lib/offlineDb';
import { PANEL, PANEL_TARGET, type PanelId, type SettingsItem } from './SettingsTypes';
import { UI_TIMING } from '../../Utilities/constants';
import { MainSettingsPanel } from './MainSettingsPanel';
import { AvatarPickerPanel } from './AvatarPickerPanel';
import { ContentWrapper } from './ContentWrapper';

interface SettingsDrawerProps {
    isVisible: boolean;
    onClose: () => void;
    isDarkMode: boolean;
    onToggleTheme: () => void;
    isMobile?: boolean;
    initialPanel?: 'main' | 'my-notes' | 'release-notes' | 'training';
    initialSelectedId?: string | null;
    /** When set alongside initialPanel='training', deep-links to a specific training task */
    initialTrainingTaskId?: string | null;
    notes?: SavedNote[];
    clinicNotes?: SavedNote[];
    onDeleteNote?: (noteId: string) => void;
    onDeleteClinicNote?: (noteId: string) => void;
    onEditNote?: (noteId: string, updates: Partial<Omit<SavedNote, 'id' | 'createdAt'>>) => void;
    onViewNote?: (note: SavedNote) => void;
    avatar: {
        currentAvatar: ProfileAvatar;
        setAvatar: (id: string) => void;
        avatarList: ProfileAvatar[];
        customImage: string | null;
        isCustom: boolean;
        setCustomImage: (dataUrl: string) => void;
        clearCustomImage: () => void;
    };
    onNotePanelChange?: (isOpen: boolean) => void;
    syncStatus?: {
        isOnline: boolean;
        isSyncing: boolean;
        pendingCount: number;
        errorCount: number;
        lastSyncTime: Date | null;
    };
}

export const Settings = ({
    isVisible,
    onClose,
    isDarkMode,
    onToggleTheme,
    isMobile: externalIsMobile,
    initialPanel,
    initialSelectedId,
    initialTrainingTaskId,
    notes = [],
    clinicNotes,
    onDeleteNote,
    onDeleteClinicNote,
    onEditNote,
    onViewNote,
    avatar,
    onNotePanelChange,
    syncStatus,
}: SettingsDrawerProps) => {
    const [activePanel, setActivePanel] = useState<'main' | 'release-notes' | 'my-notes' | 'avatar-picker' | 'user-profile' | 'profile-change-request' | 'admin' | 'supervisor' | 'guest-options' | 'login' | 'pin-setup' | 'notification-settings' | 'feedback' | 'how-to' | 'note-content' | TrainingView>('main');
    const { currentAvatar, setAvatar, avatarList, customImage, isCustom, setCustomImage, clearCustomImage } = avatar;
    const { profile, updateProfile } = useUserProfile();
    const [slideDirection, setSlideDirection] = useState<'left' | 'right' | ''>('');
    const [selectedTask, setSelectedTask] = useState<subjectAreaArrayOptions | null>(null);
    const prevVisibleRef = useRef(false);
    const supervisorBackRef = useRef<(() => void) | null>(null);
    const [isSupabaseConnected, setIsSupabaseConnected] = useState(false);
    const { signOut, isAuthenticated, isDevRole, isSupervisorRole } = useAuth();

    // Notify parent when note panel opens/closes
    useEffect(() => {
        onNotePanelChange?.(isVisible && activePanel === 'my-notes');
    }, [isVisible, activePanel, onNotePanelChange]);

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

        // Training needs extra reset
        if (id === PANEL.TRAINING) setSelectedTask(null);

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
            opt(PANEL.MY_NOTES, <FileText size={20} />, isAuthenticated ? 'My Clinic' : 'My Notes'),
            opt(PANEL.TRAINING, <BookOpen size={20} />, 'My Training'),
        ];

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
            opt(PANEL.NOTIFICATION_SETTINGS, <Bell size={20} />, 'Notifications'),
            opt(PANEL.NOTE_CONTENT, <Stethoscope size={20} />, 'Note Content'),
        );

        // ABOUT section
        items.push(
            { type: 'header', label: 'About' },
            opt(PANEL.RELEASE_NOTES, <Shield size={20} />, 'Release Notes'),
            opt(PANEL.FEEDBACK, <MessageSquare size={20} />, 'Feedback'),
            opt(PANEL.HOW_TO, <HelpCircle size={20} />, 'Help & Tutorials'),
        );

        return items;
    }, [isDarkMode, onToggleTheme, handleItemClick, isDevRole, isSupervisorRole, isAuthenticated]);

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
            return () => { handleSlideAnimation('right'); setActivePanel('main'); };
        }, [activePanel, handleSlideAnimation, handleTrainingBack]),
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
            case 'my-notes': {
                const title = isAuthenticated ? (profile.clinicName || 'My Clinic') : 'My Notes';
                const totalCount = new Set([
                    ...notes.map(n => n.id),
                    ...(clinicNotes || []).map(n => n.id),
                ]).size;
                return { title, ...backTo(), badge: totalCount > 0 ? String(totalCount) : undefined };
            }
            case 'training-detail':
                return { title: selectedTask?.text || 'Task', showBack: true, onBack: handleTrainingBack };
            case 'supervisor':
                return { title: 'Supervisor', showBack: true, onBack: () => { supervisorBackRef.current?.(); } };
            case 'profile-change-request':
                return { title: 'Request Changes', ...backTo('user-profile') };
            case 'login':
                return { title: 'Sign In', ...backTo('guest-options') };
            // All panels below slide right back to main
            case 'release-notes':       return { title: 'Release Notes', ...backTo() };
            case 'avatar-picker':       return { title: 'Choose Avatar', ...backTo() };
            case 'user-profile':        return { title: 'Profile', ...backTo() };
            case 'training':            return { title: 'My Training', ...backTo() };
            case 'admin':               return { title: 'Admin Panel', ...backTo() };
            case 'guest-options':       return { title: 'Sign In', ...backTo() };
            case 'pin-setup':           return { title: 'App Lock', ...backTo() };
            case 'notification-settings': return { title: 'Notifications', ...backTo() };
            case 'feedback':            return { title: 'Feedback', ...backTo() };
            case 'how-to':              return { title: 'Help & Tutorials', ...backTo() };
            case 'note-content':        return { title: 'Note Content', ...backTo() };
        }
    }, [activePanel, notes, clinicNotes, isAuthenticated, profile.clinicName, backTo, selectedTask, handleTrainingBack]);

    return (
        <BaseDrawer
            isVisible={isVisible}
            onClose={() => { setActivePanel('main'); setSlideDirection(''); setSelectedTask(null); onClose(); }}
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
                            avatarSvg={currentAvatar.svg}
                            customImage={customImage}
                            isCustom={isCustom}
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
                            onSignOut={async () => { await clearAllUserData(); await signOut(); handleClose(); }}
                            isAuthenticated={!!isAuthenticated}
                            isConnected={isSupabaseConnected}
                            syncStatus={syncStatus}
                        />
                    ) : activePanel === 'user-profile' ? (
                        isAuthenticated === false ? (
                            <AccountRequestForm />
                        ) : (
                            <UserProfileDisplay
                                onRequestChange={() => handleItemClick(PANEL.PROFILE_CHANGE_REQUEST, handleClose)}
                            />
                        )
                    ) : activePanel === 'profile-change-request' ? (
                        <ProfileChangeRequestForm />
                    ) : activePanel === 'avatar-picker' ? (
                        <AvatarPickerPanel
                            avatarList={avatarList}
                            currentAvatarId={currentAvatar.id}
                            isCustom={isCustom}
                            customImage={customImage}
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
                            onClearCustom={clearCustomImage}
                        />
                    ) : activePanel === 'release-notes' ? (
                        <ReleaseNotesPanel />
                    ) : activePanel === 'admin' ? (
                        <AdminPanel />
                    ) : activePanel === 'supervisor' ? (
                        <SupervisorPanel
                            backRef={supervisorBackRef}
                            onBackToMain={() => { handleSlideAnimation('right'); setActivePanel('main'); }}
                        />
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
                    ) : activePanel === 'how-to' ? (
                        <HowToPanel />
                    ) : activePanel === 'note-content' ? (
                        <NoteContentPanel />
                    ) : activePanel === 'notification-settings' ? (
                        <NotificationSettingsPanel />
                    ) : activePanel === 'pin-setup' ? (
                        <PinSetupPanel />
                    ) : activePanel === 'training' || activePanel === 'training-detail' ? (
                        <TrainingPanel
                            view={activePanel}
                            selectedTask={selectedTask}
                            onSelectTask={handleTrainingSelectTask}
                        />
                    ) : (
                        <MyNotesPanel
                            isMobile={externalIsMobile ?? false}
                            notes={notes}
                            clinicNotes={clinicNotes}
                            onDeleteNote={onDeleteNote || (() => { })}
                            onDeleteClinicNote={onDeleteClinicNote}
                            onEditNote={onEditNote}
                            onViewNote={onViewNote}
                            onCloseDrawer={handleClose}
                            initialSelectedId={initialSelectedId}
                        />
                    )}
                </ContentWrapper>
            )}
        </BaseDrawer>
    );
};
