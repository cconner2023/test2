import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Moon, Sun, Shield, HelpCircle, ChevronUp, User, ChevronRight, FileText } from 'lucide-react';
import { BaseDrawer } from '../BaseDrawer';
import type { SavedNote } from '../../Hooks/useNotesStorage';
import { MyNotesPanel } from './MyNotesPanel';
import { ReleaseNotesPanel } from './ReleaseNotesPanel';

interface SettingsDrawerProps {
    isVisible: boolean;
    onClose: () => void;
    isDarkMode: boolean;
    onToggleTheme: () => void;
    isMobile?: boolean;
    initialPanel?: 'main' | 'my-notes' | 'release-notes';
    initialSelectedId?: string | null;
    notes?: SavedNote[];
    onDeleteNote?: (noteId: string) => void;
    onEditNote?: (noteId: string, updates: Partial<Omit<SavedNote, 'id' | 'createdAt'>>) => void;
    onViewNote?: (note: SavedNote) => void;
}

const MainSettingsPanel = ({
    settingsOptions,
    onItemClick,
}: {
    settingsOptions: Array<{
        icon: React.ReactNode;
        label: string;
        action: () => void;
        color: string;
        id: number;
    }>;
    onItemClick: (id: number) => void;
}) => (
    <div className="h-full overflow-y-auto">
            <div className="px-4 py-3 md:p-5">
                <div className="mb-4 pb-4 border-b border-tertiary/10">
                    <div className="flex items-center w-full px-4 py-3.5 hover:bg-themewhite2/10 active:scale-[0.98]
                                  transition-all cursor-pointer group
                                  md:px-5 md:py-4">
                        <div className="mr-4 w-12 h-12 rounded-full bg-themewhite flex items-center justify-center text-primary shrink-0">
                            <User size={24} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-base font-semibold text-primary md:text-lg">User</p>
                            <p className="text-xs text-tertiary/60 md:text-sm">Coming Soon</p>
                        </div>
                        <ChevronRight size={20} className="text-tertiary/40 shrink-0" />
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
                                     md:px-5 md:py-4"
                        >
                            <div className={`mr-4 ${option.color} md:group-hover:scale-110 md:transition-transform`}>
                                {option.icon}
                            </div>
                            <span className="flex-1 text-left text-base text-primary font-medium md:text-lg">
                                {option.label}
                            </span>
                            <ChevronUp size={16} className="text-tertiary/40 rotate-90 md:hidden" />
                        </button>
                    ))}
                </div>

                <div className="mt-8 pt-6 border-t border-tertiary/10 md:mt-10">
                    <div className="text-center">
                        <p className="text-sm text-tertiary/60 font-medium md:text-base">Version 2.6.0</p>
                        <p className="text-xs text-tertiary/40 mt-1 md:text-sm">ADTMC MEDCOM PAM 40-7-21</p>
                    </div>
                </div>
            </div>
    </div>
);

// Content wrapper with slide animation
const ContentWrapper = ({
    children,
    slideDirection
}: {
    children: React.ReactNode;
    slideDirection: 'left' | 'right' | '';
}) => {
    const slideClasses = {
        '': '',
        'left': 'animate-slide-in-left',
        'right': 'animate-slide-in-right'
    };

    return (
        <div className={`h-full w-full ${slideClasses[slideDirection]}`}>
            {children}
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
    notes = [],
    onDeleteNote,
    onEditNote,
    onViewNote,
}: SettingsDrawerProps) => {
    const [activePanel, setActivePanel] = useState<'main' | 'release-notes' | 'my-notes'>('main');
    const [slideDirection, setSlideDirection] = useState<'left' | 'right' | ''>('');
    const prevVisibleRef = useRef(false);

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
            default:
                break;
        }
    }, [handleSlideAnimation]);

    const buildSettingsOptions = useCallback((closeDrawer: () => void) => [
        {
            icon: <FileText size={20} />,
            label: 'My Notes',
            action: () => handleItemClick(1, closeDrawer),
            color: 'text-tertiary',
            id: 1
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
        },
        {
            icon: <HelpCircle size={20} />,
            label: 'Help & Support',
            action: () => null,
            color: 'text-tertiary',
            id: 5
        }
    ], [isDarkMode, onToggleTheme, handleItemClick]);

    const headerConfig = useMemo(() => {
        switch (activePanel) {
            case 'main':
                return { title: 'Settings' };
            case 'my-notes':
                return {
                    title: 'My Notes',
                    showBack: true,
                    onBack: () => { handleSlideAnimation('right'); setActivePanel('main'); },
                    badge: notes.length > 0 ? String(notes.length) : undefined,
                };
            case 'release-notes':
                return {
                    title: 'Release Notes',
                    showBack: true,
                    onBack: () => { handleSlideAnimation('right'); setActivePanel('main'); },
                };
        }
    }, [activePanel, notes.length, handleSlideAnimation]);

    return (
        <BaseDrawer
            isVisible={isVisible}
            onClose={() => { setActivePanel('main'); setSlideDirection(''); onClose(); }}
            fullHeight="90dvh"
            disableDrag={false}
            header={headerConfig}
        >
            {(handleClose) => (
                <ContentWrapper slideDirection={slideDirection}>
                    {activePanel === 'main' ? (
                        <MainSettingsPanel
                            settingsOptions={buildSettingsOptions(handleClose)}
                            onItemClick={(id) => handleItemClick(id, handleClose)}
                        />
                    ) : activePanel === 'release-notes' ? (
                        <ReleaseNotesPanel />
                    ) : (
                        <MyNotesPanel
                            isMobile={externalIsMobile ?? (typeof window !== 'undefined' && window.innerWidth < 768)}
                            notes={notes}
                            onDeleteNote={onDeleteNote || (() => { })}
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
