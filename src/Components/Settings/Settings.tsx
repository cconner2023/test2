import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Moon, Sun, Shield, ChevronUp, ChevronRight, FileText, Check, Camera, X, BookOpen, UserCog, LogOut, ClipboardCheck } from 'lucide-react';
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
import type { subjectAreaArray, subjectAreaArrayOptions } from '../../Types/CatTypes';
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
}

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
}: {
    settingsOptions: Array<{
        icon: React.ReactNode;
        label: string;
        action: () => void;
        color: string;
        id: number;
    }>;
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
}) => (
    <div className="h-full overflow-y-auto">
        <div className="px-4 py-3 md:p-4">
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

            <div className="space-y-1 md:space-y-3">
                {settingsOptions.map((option) => (
                    <button
                        key={option.id}
                        onClick={() => {
                            option.action();
                            onItemClick(option.id);
                        }}
                        className="flex items-center w-full px-4 py-3.5 hover:bg-themewhite2 active:scale-[0.98]
                                     transition-all rounded-xl group
                                     md:px-4 md:py-3"
                    >
                        <div className={`mr-4 ${option.color} md:group-hover:scale-110 md:transition-transform`}>
                            {option.icon}
                        </div>
                        <span className="flex-1 text-left text-base text-primary font-medium md:font-[11pt]">
                            {option.label}
                        </span>
                        <ChevronUp size={16} className="text-tertiary/40 rotate-90 md:hidden" />
                    </button>
                ))}
            </div>

            <div className="mt-8 pt-6 border-t border-tertiary/10 md:mt-10">
                <div className="text-center">
                    <p className="text-sm text-tertiary/60 font-medium md:text-base">ADTMC MEDCOM PAM 40-7-21</p>
                    <p className="text-xs text-tertiary/40 mt-1 md:text-sm">Version {__APP_VERSION__}</p>
                </div>
            </div>
        </div>
    </div>
);

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
}: SettingsDrawerProps) => {
    const [activePanel, setActivePanel] = useState<'main' | 'release-notes' | 'my-notes' | 'avatar-picker' | 'user-profile' | 'profile-change-request' | 'admin' | 'supervisor' | 'guest-options' | 'login' | TrainingView>('main');
    const [isDevRole, setIsDevRole] = useState(false);
    const [isSupervisorRole, setIsSupervisorRole] = useState(false);
    const { currentAvatar, setAvatar, avatarList, customImage, isCustom, setCustomImage, clearCustomImage } = avatar;
    const { profile, updateProfile } = useUserProfile();
    const [slideDirection, setSlideDirection] = useState<'left' | 'right' | ''>('');
    const [selectedSubjectArea, setSelectedSubjectArea] = useState<subjectAreaArray | null>(null);
    const [selectedTask, setSelectedTask] = useState<subjectAreaArrayOptions | null>(null);
    const prevVisibleRef = useRef(false);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
    const { signOut } = useAuth();

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
                // Find the task's subject area across all skill levels
                let foundArea: subjectAreaArray | null = null;
                let foundTask: subjectAreaArrayOptions | null = null;

                for (let levelIdx = 0; levelIdx < stp68wTraining.length && !foundTask; levelIdx++) {
                    const level = stp68wTraining[levelIdx];
                    for (let areaIdx = 0; areaIdx < level.subjectArea.length && !foundTask; areaIdx++) {
                        const area = level.subjectArea[areaIdx];
                        const taskIdx = area.tasks.findIndex(t => t.id === initialTrainingTaskId);
                        if (taskIdx !== -1) {
                            const task = area.tasks[taskIdx];
                            foundArea = {
                                id: areaIdx,
                                icon: level.skillLevel,
                                text: area.name,
                                isParent: true,
                                options: area.tasks.map((t, tIdx) => ({
                                    id: tIdx,
                                    icon: t.id,
                                    text: t.title,
                                    isParent: false,
                                    parentId: areaIdx,
                                })),
                            };
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

                if (foundArea && foundTask) {
                    setSelectedSubjectArea(foundArea);
                    setSelectedTask(foundTask);
                    setActivePanel('training-detail');
                    setSlideDirection('');
                } else {
                    // Fallback: open training list if task not found in hierarchy
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
                setSelectedSubjectArea(null);
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
            default:
                break;
        }
    }, [handleSlideAnimation]);

    const buildSettingsOptions = useCallback((closeDrawer: () => void) => {
        const options = [
            {
                icon: <FileText size={20} />,
                label: 'My Notes',
                action: () => handleItemClick(1, closeDrawer),
                color: 'text-tertiary',
                id: 1
            },
            {
                icon: <BookOpen size={20} />,
                label: 'Training',
                action: () => handleItemClick(7, closeDrawer),
                color: 'text-tertiary',
                id: 7
            },
            {
                icon: isDarkMode ? <Sun size={20} /> : <Moon size={20} />,
                label: 'Toggle Theme',
                action: onToggleTheme,
                color: 'text-primary',
                id: 0
            },
            {
                icon: <Shield size={20} />,
                label: 'Release Notes',
                action: () => handleItemClick(4, closeDrawer),
                color: 'text-tertiary',
                id: 4
            }
        ];

        // Add supervisor option for supervisor users
        if (isSupervisorRole) {
            options.push({
                icon: <ClipboardCheck size={20} />,
                label: 'Supervisor',
                action: () => handleItemClick(9, closeDrawer),
                color: 'text-amber-500',
                id: 9
            });
        }

        // Add admin option for dev users
        if (isDevRole) {
            options.push({
                icon: <UserCog size={20} />,
                label: 'Admin Panel',
                action: () => handleItemClick(8, closeDrawer),
                color: 'text-themeblue2',
                id: 8
            });
        }

        return options;
    }, [isDarkMode, onToggleTheme, handleItemClick, isDevRole, isSupervisorRole]);

    // Training panel navigation helpers
    const handleTrainingSelectArea = useCallback((area: subjectAreaArray) => {
        setSelectedSubjectArea(area);
        setSelectedTask(null);
        handleSlideAnimation('left');
        setActivePanel('training-tasks');
    }, [handleSlideAnimation]);

    const handleTrainingSelectTask = useCallback((task: subjectAreaArrayOptions) => {
        setSelectedTask(task);
        handleSlideAnimation('left');
        setActivePanel('training-detail');
    }, [handleSlideAnimation]);

    const handleTrainingBack = useCallback(() => {
        if (activePanel === 'training-detail') {
            handleSlideAnimation('right');
            setActivePanel('training-tasks');
            setSelectedTask(null);
        } else if (activePanel === 'training-tasks') {
            handleSlideAnimation('right');
            setActivePanel('training');
            setSelectedSubjectArea(null);
        } else if (activePanel === 'training') {
            handleSlideAnimation('right');
            setActivePanel('main');
        }
    }, [activePanel, handleSlideAnimation]);

    // Swipe-back for sub-panels (mobile touch only)
    const swipeHandlers = useSwipeBack(
        useMemo(() => {
            if (activePanel === 'main') return undefined;
            if (activePanel === 'training-detail' || activePanel === 'training-tasks' || activePanel === 'training') {
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
                const myNotesTitle = isAuthenticated && profile.clinicName
                    ? profile.clinicName
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
                    title: 'Training',
                    showBack: true,
                    onBack: () => { handleSlideAnimation('right'); setActivePanel('main'); },
                };
            case 'training-tasks':
                return {
                    title: selectedSubjectArea?.text || 'Tasks',
                    showBack: true,
                    onBack: handleTrainingBack,
                };
            case 'training-detail':
                return {
                    title: selectedTask?.icon || 'Task',
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
                    onBack: () => { handleSlideAnimation('right'); setActivePanel('main'); },
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
        }
    }, [activePanel, notes, clinicNotes, isAuthenticated, profile.clinicName, handleSlideAnimation, selectedSubjectArea, selectedTask, handleTrainingBack]);

    return (
        <BaseDrawer
            isVisible={isVisible}
            onClose={() => { setActivePanel('main'); setSlideDirection(''); setSelectedSubjectArea(null); setSelectedTask(null); onClose(); }}
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
                        <SupervisorPanel />
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
                    ) : activePanel === 'training' || activePanel === 'training-tasks' || activePanel === 'training-detail' ? (
                        <TrainingPanel
                            view={activePanel}
                            selectedSubjectArea={selectedSubjectArea}
                            selectedTask={selectedTask}
                            onSelectArea={handleTrainingSelectArea}
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
