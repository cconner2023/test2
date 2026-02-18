import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Moon, Sun, Shield, ChevronUp, ChevronRight, FileText, Check, Camera, X, BookOpen, UserCog, LogOut, ClipboardCheck, Lock, MessageSquare, Bell, HelpCircle } from 'lucide-react';
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
import type { subjectAreaArrayOptions } from '../../Types/CatTypes';
import { stp68wTraining } from '../../Data/TrainingTaskList';
import { getTaskData } from '../../Data/TrainingData';
import { supabase } from '../../lib/supabase';
import { isDevUser } from '../../lib/adminService';
import { useAuth } from '../../Hooks/useAuth';
import { clearAllUserData } from '../../lib/offlineDb';

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
}

type SettingsItem =
    | { type: 'option'; icon: React.ReactNode; label: string; action: () => void; color: string; id: number; disabled?: boolean }
    | { type: 'header'; label: string };

const MainSettingsPanel = ({
    settingsOptions,
    onItemClick,
    avatarSvg,
    customImage,
    isCustom,
    displayName,
    displaySub,
    displayClinic,
    onAvatarClick,
    onProfileClick,
    onSignOut,
    isAuthenticated,
    isConnected,
}: {
    settingsOptions: SettingsItem[];
    onItemClick: (id: number) => void;
    avatarSvg: React.ReactNode;
    customImage: string | null;
    isCustom: boolean;
    displayName: string;
    displaySub: string;
    displayClinic?: string;
    onAvatarClick: () => void;
    onProfileClick: () => void;
    onSignOut?: () => void;
    isAuthenticated?: boolean;
    isConnected?: boolean;
}) => {
    // Separate top row items (no header before them) from grid sections
    const topItems: Extract<SettingsItem, { type: 'option' }>[] = [];
    const gridSections: { label: string; items: Extract<SettingsItem, { type: 'option' }>[] }[] = [];

    let currentSection: { label: string; items: Extract<SettingsItem, { type: 'option' }>[] } | null = null;
    for (const item of settingsOptions) {
        if (item.type === 'header') {
            currentSection = { label: item.label, items: [] };
            gridSections.push(currentSection);
        } else if (currentSection) {
            currentSection.items.push(item);
        } else {
            topItems.push(item);
        }
    }

    return (
        <div className="h-full overflow-y-auto">
            <div className="px-4 py-3 md:p-5">
                <div className="mb-4 pb-4 border-b border-tertiary/10">
                    <div className="flex items-center w-full px-4 py-3.5 md:px-5 md:py-3.5">
                        <button
                            onClick={onAvatarClick}
                            className="mr-4 w-12 h-12 rounded-full overflow-hidden shrink-0
                                       active:scale-95 transition-transform"
                        >
                            {isCustom && customImage ? (
                                <img src={customImage} alt="Profile" className="w-full h-full object-cover" />
                            ) : avatarSvg}
                        </button>
                        <button
                            onClick={onProfileClick}
                            className="flex-1 min-w-0 text-left hover:bg-themewhite2/10 active:scale-[1]
                                       transition-all rounded-lg -my-2 py-2 px-2 -mx-2"
                        >
                            <p className="text-base font-semibold text-primary md:text-[12pt]">{displayName}</p>
                            <p className="text-xs text-tertiary md:text-sm">{displaySub}</p>
                            {displayClinic && (
                                <p className="text-xs text-tertiary md:text-sm mt-0.5">{displayClinic}</p>
                            )}
                        </button>
                        {isAuthenticated ? (
                            <button
                                onClick={(e) => { e.stopPropagation(); onSignOut?.(); }}
                                className="shrink-0 ml-2 p-1.5 rounded-full hover:bg-tertiary/10 active:scale-90 transition-all"
                                aria-label="Sign out"
                            >
                                <LogOut size={18} className="text-themeredred" />
                            </button>
                        ) : (
                            <ChevronRight size={20} className="text-tertiary/40 shrink-0 ml-2" />
                        )}
                    </div>
                </div>

                {/* Top row items — My Notes & My Training (unchanged) */}
                <div className="space-y-1 md:space-y-3">
                    {topItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => {
                                item.action();
                                onItemClick(item.id);
                            }}
                            className="flex items-center w-full px-6 py-3.5 hover:bg-themewhite2 active:scale-[0.98]
                                         transition-all rounded-xl group
                                         md:px-6 md:py-3"
                        >
                            <div className={`mr-4 ${item.color} md:group-hover:scale-110 md:transition-transform`}>
                                {item.icon}
                            </div>
                            <span className="flex-1 text-left text-base text-primary font-medium md:font-[11pt]">
                                {item.label}
                            </span>
                            <ChevronUp size={16} className="text-tertiary/40 rotate-90 md:hidden" />
                        </button>
                    ))}
                </div>

                {/* Grid sections — Roles, Preferences, About as box cards */}
                {gridSections.map((section) => (
                    <div key={section.label} className="mt-4 px-6 md:px-6">
                        <div className="pb-2">
                            <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">{section.label}</p>
                        </div>
                        <div className="grid grid-cols-3 gap-2 max-w-[85%]">
                            {section.items.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => {
                                        if (item.disabled) return;
                                        item.action();
                                        onItemClick(item.id);
                                    }}
                                    disabled={item.disabled}
                                    className={`relative flex flex-col items-center justify-center gap-1
                                               rounded-lg px-2 py-2 border transition-all
                                               ${item.disabled
                                            ? 'border-tertiary/10 bg-themewhite2/50 opacity-50 cursor-not-allowed'
                                            : 'border-tertiary/15 bg-themewhite2 hover:bg-themeblue2/10 hover:border-themeblue2/25 active:scale-[0.97] group'
                                        }`}
                                >
                                    <div className={`${item.disabled ? 'text-tertiary/40' : item.color} ${!item.disabled ? 'group-hover:scale-110' : ''} transition-transform`}>
                                        {item.icon}
                                    </div>
                                    <span className={`text-[11px] font-medium text-center leading-tight ${item.disabled ? 'text-tertiary/40' : 'text-primary'}`}>
                                        {item.label}
                                    </span>
                                    {item.disabled && (
                                        <span className="text-[8px] text-tertiary/40 font-medium uppercase tracking-wide">Soon</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                ))}

                <div className="mt-8 pt-6 border-t border-tertiary/10 md:mt-10">
                    <div className="text-center">
                        <p className="text-sm text-tertiary/60 font-medium md:text-base">ADTMC MEDCOM PAM 40-7-21</p>
                        <p className="text-xs text-tertiary/40 mt-1 md:text-sm">Version {__APP_VERSION__}</p>
                        <div className="flex items-center justify-center gap-1.5 mt-2">
                            <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-themegreen' : 'bg-themeredred'}`} />
                            <span className={`text-[11px] font-medium ${isConnected ? 'text-themegreen' : 'text-themeredred'}`}>
                                {isConnected ? 'Connected' : 'Offline'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Content wrapper with slide animation and optional swipe-back
const ContentWrapper = ({
    children,
    slideDirection,
    swipeHandlers,
}: {
    children: React.ReactNode;
    slideDirection: 'left' | 'right' | '';
    swipeHandlers?: { onTouchStart: React.TouchEventHandler; onTouchMove: React.TouchEventHandler; onTouchEnd: React.TouchEventHandler };
}) => {
    const slideClasses = {
        '': '',
        'left': 'animate-slide-in-left',
        'right': 'animate-slide-in-right'
    };

    return (
        <div className={`h-full w-full ${slideClasses[slideDirection]}`} {...swipeHandlers}>
            {children}
        </div>
    );
};

const AvatarPickerPanel = ({
    avatarList,
    currentAvatarId,
    isCustom,
    customImage,
    onSelect,
    onUpload,
    onClearCustom,
}: {
    avatarList: Array<{ id: string; svg: React.ReactNode }>;
    currentAvatarId: string;
    isCustom: boolean;
    customImage: string | null;
    onSelect: (id: string) => void;
    onUpload: (file: File) => void;
    onClearCustom: () => void;
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    return (
        <div className="h-full overflow-y-auto">
            <div className="px-4 py-3 md:p-5">
                <div className="grid grid-cols-3 gap-4 justify-items-center md:grid-cols-4">
                    {/* Custom image avatar (if uploaded) */}
                    {customImage && (
                        <div className="relative">
                            <button
                                onClick={() => onSelect('custom')}
                                className="relative w-16 h-16 rounded-full overflow-hidden transition-all active:scale-95"
                            >
                                <img src={customImage} alt="Custom" className="w-full h-full object-cover" />
                                {isCustom && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-full">
                                        <Check size={20} className="text-white" />
                                    </div>
                                )}
                            </button>
                            <button
                                onClick={onClearCustom}
                                className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-themeredred flex items-center justify-center active:scale-90 transition-transform"
                                aria-label="Remove custom photo"
                            >
                                <X size={12} className="text-white" />
                            </button>
                        </div>
                    )}

                    {/* SVG avatars */}
                    {avatarList.map((avatar) => (
                        <button
                            key={avatar.id}
                            onClick={() => onSelect(avatar.id)}
                            className="relative w-16 h-16 rounded-full overflow-hidden transition-all active:scale-95"
                        >
                            {avatar.svg}
                            {avatar.id === currentAvatarId && !isCustom && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-full">
                                    <Check size={20} className="text-white" />
                                </div>
                            )}
                        </button>
                    ))}

                    {/* Upload button */}
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-16 h-16 rounded-full border-2 border-dashed border-tertiary/30
                                   flex items-center justify-center transition-all active:scale-95
                                   hover:border-tertiary/50 hover:bg-themewhite2/50"
                        aria-label="Upload photo"
                    >
                        <Camera size={22} className="text-tertiary/50" />
                    </button>
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) onUpload(file);
                        e.target.value = '';
                    }}
                />
            </div>
        </div>
    );
};

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
}: SettingsDrawerProps) => {
    const [activePanel, setActivePanel] = useState<'main' | 'release-notes' | 'my-notes' | 'avatar-picker' | 'user-profile' | 'profile-change-request' | 'admin' | 'supervisor' | 'guest-options' | 'login' | 'pin-setup' | 'notification-settings' | 'feedback' | 'how-to' | TrainingView>('main');
    const [isDevRole, setIsDevRole] = useState(false);
    const [isSupervisorRole, setIsSupervisorRole] = useState(false);
    const { currentAvatar, setAvatar, avatarList, customImage, isCustom, setCustomImage, clearCustomImage } = avatar;
    const { profile, updateProfile } = useUserProfile();
    const [slideDirection, setSlideDirection] = useState<'left' | 'right' | ''>('');
    const [selectedTask, setSelectedTask] = useState<subjectAreaArrayOptions | null>(null);
    const prevVisibleRef = useRef(false);
    const supervisorBackRef = useRef<(() => void) | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
    const [isSupabaseConnected, setIsSupabaseConnected] = useState(false);
    const { signOut } = useAuth();

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

    // Check authentication status, dev role, and supervisor role
    useEffect(() => {
        const checkAuth = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setIsAuthenticated(!!user);

            if (user) {
                const isDev = await isDevUser();
                setIsDevRole(isDev);

                const { data } = await supabase
                    .from('profiles')
                    .select('roles')
                    .eq('id', user.id)
                    .single();
                const roles = data?.roles as string[] | null;
                setIsSupervisorRole(roles?.includes('supervisor') ?? false);
            }
        };

        checkAuth();

        const { data: authListener } = supabase.auth.onAuthStateChange((_, session) => {
            setIsAuthenticated(!!session?.user);
            if (session?.user) {
                isDevUser().then(setIsDevRole);
                supabase
                    .from('profiles')
                    .select('roles')
                    .eq('id', session.user.id)
                    .single()
                    .then(({ data }) => {
                        const roles = data?.roles as string[] | null;
                        setIsSupervisorRole(roles?.includes('supervisor') ?? false);
                    });
            } else {
                setIsDevRole(false);
                setIsSupervisorRole(false);
            }
        });

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, []);

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
        setTimeout(() => setSlideDirection(''), 300);
    }, []);

    const handleItemClick = useCallback((id: number, closeDrawer: () => void) => {
        switch (id) {
            case -1:
                closeDrawer();
                break;
            case -2:
                handleSlideAnimation('right');
                setActivePanel('main');
                break;
            case 1:
                // My Notes — slide into my-notes panel within Settings
                handleSlideAnimation('left');
                setActivePanel('my-notes');
                break;
            case 4:
                handleSlideAnimation('left');
                setActivePanel('release-notes');
                break;
            case 5:
                handleSlideAnimation('left');
                setActivePanel('avatar-picker');
                break;
            case 6:
                handleSlideAnimation('left');
                setActivePanel('user-profile');
                break;
            case 7:
                handleSlideAnimation('left');
                setSelectedTask(null);
                setActivePanel('training');
                break;
            case 8:
                handleSlideAnimation('left');
                setActivePanel('admin');
                break;
            case 9:
                handleSlideAnimation('left');
                setActivePanel('supervisor');
                break;
            case 11:
                handleSlideAnimation('left');
                setActivePanel('guest-options');
                break;
            case 12:
                handleSlideAnimation('left');
                setActivePanel('profile-change-request');
                break;
            case 14:
                handleSlideAnimation('left');
                setActivePanel('login');
                break;
            case 15:
                handleSlideAnimation('left');
                setActivePanel('pin-setup');
                break;
            case 16:
                handleSlideAnimation('left');
                setActivePanel('feedback');
                break;
            case 17:
                handleSlideAnimation('left');
                setActivePanel('notification-settings');
                break;
            case 18:
                handleSlideAnimation('left');
                setActivePanel('how-to');
                break;
            default:
                break;
        }
    }, [handleSlideAnimation]);

    const buildSettingsOptions = useCallback((closeDrawer: () => void): SettingsItem[] => {
        const items: SettingsItem[] = [
            // Top section (no header)
            {
                type: 'option',
                icon: <FileText size={20} />,
                label: isAuthenticated ? 'My Clinic' : 'My Notes',
                action: () => handleItemClick(1, closeDrawer),
                color: 'text-tertiary',
                id: 1
            },
            {
                type: 'option',
                icon: <BookOpen size={20} />,
                label: 'My Training',
                action: () => handleItemClick(7, closeDrawer),
                color: 'text-tertiary',
                id: 7
            },
        ];

        // ROLES section - only if user has supervisor or admin roles
        if (isSupervisorRole || isDevRole) {
            items.push({ type: 'header', label: 'Roles' });

            if (isSupervisorRole) {
                items.push({
                    type: 'option',
                    icon: <ClipboardCheck size={20} />,
                    label: 'Supervisor',
                    action: () => handleItemClick(9, closeDrawer),
                    color: 'text-tertiary',
                    id: 9
                });
            }

            if (isDevRole) {
                items.push({
                    type: 'option',
                    icon: <UserCog size={20} />,
                    label: 'Admin Panel',
                    action: () => handleItemClick(8, closeDrawer),
                    color: 'text-tertiary',
                    id: 8
                });
            }
        }

        // PREFERENCES section
        items.push(
            { type: 'header', label: 'Preferences' },
            {
                type: 'option',
                icon: isDarkMode ? <Sun size={20} /> : <Moon size={20} />,
                label: 'Toggle Theme',
                action: onToggleTheme,
                color: 'text-tertiary',
                id: 0
            },
            {
                type: 'option',
                icon: <Lock size={20} />,
                label: 'Security',
                action: () => handleItemClick(15, closeDrawer),
                color: 'text-tertiary',
                id: 15
            },
            {
                type: 'option',
                icon: <Bell size={20} />,
                label: 'Notifications',
                action: () => { },
                color: 'text-tertiary',
                id: 17,
                disabled: true
            },
        );

        items.push(
            // ABOUT section
            { type: 'header', label: 'About' },
            {
                type: 'option',
                icon: <Shield size={20} />,
                label: 'Release Notes',
                action: () => handleItemClick(4, closeDrawer),
                color: 'text-tertiary',
                id: 4
            },
            {
                type: 'option',
                icon: <MessageSquare size={20} />,
                label: 'Feedback',
                action: () => handleItemClick(16, closeDrawer),
                color: 'text-tertiary',
                id: 16
            },
            {
                type: 'option',
                icon: <HelpCircle size={20} />,
                label: 'Help & Tutorials',
                action: () => { },
                color: 'text-tertiary',
                id: 18,
                disabled: false
            }
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

    const headerConfig = useMemo(() => {
        switch (activePanel) {
            case 'main':
                return { title: 'Settings' };
            case 'my-notes': {
                const myNotesTitle = isAuthenticated
                    ? (profile.clinicName || 'My Clinic')
                    : 'My Notes';
                // Deduplicate personal + clinic notes for an accurate badge count
                const combinedIds = new Set([
                    ...notes.map(n => n.id),
                    ...(clinicNotes || []).map(n => n.id),
                ]);
                const totalCount = combinedIds.size;
                return {
                    title: myNotesTitle,
                    showBack: true,
                    onBack: () => { handleSlideAnimation('right'); setActivePanel('main'); },
                    badge: totalCount > 0 ? String(totalCount) : undefined,
                };
            }
            case 'release-notes':
                return {
                    title: 'Release Notes',
                    showBack: true,
                    onBack: () => { handleSlideAnimation('right'); setActivePanel('main'); },
                };
            case 'avatar-picker':
                return {
                    title: 'Choose Avatar',
                    showBack: true,
                    onBack: () => { handleSlideAnimation('right'); setActivePanel('main'); },
                };
            case 'user-profile':
                return {
                    title: 'Profile',
                    showBack: true,
                    onBack: () => { handleSlideAnimation('right'); setActivePanel('main'); },
                };
            case 'training':
                return {
                    title: 'My Training',
                    showBack: true,
                    onBack: () => { handleSlideAnimation('right'); setActivePanel('main'); },
                };
            case 'training-detail':
                return {
                    title: selectedTask?.text || 'Task',
                    showBack: true,
                    onBack: handleTrainingBack,
                };
            case 'admin':
                return {
                    title: 'Admin Panel',
                    showBack: true,
                    onBack: () => { handleSlideAnimation('right'); setActivePanel('main'); },
                };
            case 'supervisor':
                return {
                    title: 'Supervisor',
                    showBack: true,
                    onBack: () => { supervisorBackRef.current?.(); },
                };
            case 'guest-options':
                return {
                    title: 'Sign In',
                    showBack: true,
                    onBack: () => { handleSlideAnimation('right'); setActivePanel('main'); },
                };
            case 'profile-change-request':
                return {
                    title: 'Request Changes',
                    showBack: true,
                    onBack: () => { handleSlideAnimation('right'); setActivePanel('user-profile'); },
                };
            case 'login':
                return {
                    title: 'Sign In',
                    showBack: true,
                    onBack: () => { handleSlideAnimation('right'); setActivePanel('guest-options'); },
                };
            case 'pin-setup':
                return {
                    title: 'App Lock',
                    showBack: true,
                    onBack: () => { handleSlideAnimation('right'); setActivePanel('main'); },
                };
            case 'notification-settings':
                return {
                    title: 'Notifications',
                    showBack: true,
                    onBack: () => { handleSlideAnimation('right'); setActivePanel('main'); },
                };
            case 'feedback':
                return {
                    title: 'Feedback',
                    showBack: true,
                    onBack: () => { handleSlideAnimation('right'); setActivePanel('main'); },
                };
            case 'how-to':
                return {
                    title: 'Help & Support',
                    showBack: true,
                    onBack: () => { handleSlideAnimation('right'); setActivePanel('main'); },
                };
        }
    }, [activePanel, notes, clinicNotes, isAuthenticated, profile.clinicName, handleSlideAnimation, selectedTask, handleTrainingBack]);

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
                            onAvatarClick={() => handleItemClick(5, handleClose)}
                            onProfileClick={() => {
                                if (!isAuthenticated) {
                                    handleItemClick(11, handleClose); // Show guest options
                                } else {
                                    handleItemClick(6, handleClose); // Show profile editor
                                }
                            }}
                            onSignOut={async () => { await clearAllUserData(); await signOut(); handleClose(); }}
                            isAuthenticated={!!isAuthenticated}
                            isConnected={isSupabaseConnected}
                        />
                    ) : activePanel === 'user-profile' ? (
                        isAuthenticated === false ? (
                            <AccountRequestForm />
                        ) : (
                            <UserProfileDisplay
                                onRequestChange={() => handleItemClick(12, handleClose)}
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
                            onSignIn={() => handleItemClick(14, handleClose)}
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
                            isMobile={externalIsMobile ?? (typeof window !== 'undefined' && window.innerWidth < 768)}
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
