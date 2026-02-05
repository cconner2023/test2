import { useEffect, useState, useRef, useCallback } from 'react';
import { X, Moon, Sun, Shield, HelpCircle, ChevronUp, User, ChevronRight, ChevronLeft, Bug, PlusCircle, RefreshCw } from 'lucide-react';

// Import your release notes data
import { ReleaseNotes } from '../Data/Release';

interface SettingsDrawerProps {
    isVisible: boolean;
    onClose: () => void;
    isDarkMode: boolean;
    onToggleTheme: () => void;
    isMobile?: boolean;
}

interface SettingsContentProps {
    settingsOptions: Array<{
        icon: React.ReactNode;
        label: string;
        action: () => void;
        color: string;
        id: number;
    }>;
    onItemClick: (id: number) => void;
    activePanel: string;
}

// Release note item component
const ReleaseNoteItem = ({ note }: { note: typeof ReleaseNotes[0] }) => {
    const getIcon = () => {
        switch (note.type) {
            case 'bug': return <Bug size={14} className="text-red-500" />;
            case 'added': return <PlusCircle size={14} className="text-green-500" />;
            case 'changed': return <RefreshCw size={14} className="text-blue-500" />;
            default: return <PlusCircle size={14} className="text-tertiary" />;
        }
    };

    return (
        <div className="flex items-start mb-2 last:mb-0">
            <div className="mt-1.5 mr-3">{getIcon()}</div>
            <p className="text-sm text-tertiary/80 flex-1">{note.text}</p>
        </div>
    );
};

// Release notes content component
const ReleaseNotesContent = ({ onBack }: { onBack: () => void }) => {
    // Group notes by version
    const groupedNotes = ReleaseNotes.reduce((acc, note) => {
        if (!acc[note.version]) {
            acc[note.version] = [];
        }
        acc[note.version].push(note);
        return acc;
    }, {} as Record<string, typeof ReleaseNotes>);

    const versions = Object.keys(groupedNotes).sort((a, b) => parseFloat(b) - parseFloat(a));

    return (
        <>
            <div className="px-6 border-b border-tertiary/10 py-4 md:py-5">
                <div className="flex items-center">
                    <button
                        onClick={onBack}
                        className="p-2 rounded-full hover:bg-themewhite2 active:scale-95 transition-all mr-2"
                        aria-label="Go back"
                    >
                        <ChevronLeft size={24} className="text-tertiary" />
                    </button>
                    <h2 className="text-xl font-semibold text-primary md:text-2xl">Release Notes</h2>
                </div>
            </div>

            <div className="overflow-y-auto h-[calc(100dvh-80px)] md:overflow-visible md:h-auto">
                <div className="px-4 py-3 md:p-6">
                    {versions.map((version, versionIndex) => {
                        const notes = groupedNotes[version];
                        const isLatest = versionIndex === 0;

                        return (
                            <div
                                key={version}
                                className={`${versionIndex > 0 ? 'pt-6 border-t border-tertiary/10' : 'mb-6'}`}
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-semibold text-primary">Version {version}</h3>
                                    {isLatest && (
                                        <span className="text-xs text-tertiary/60 bg-tertiary/10 px-2 py-1 rounded-full">
                                            Latest
                                        </span>
                                    )}
                                </div>
                                <div className="space-y-1">
                                    {notes.map((note, noteIndex) => (
                                        <ReleaseNoteItem
                                            key={`${version}-${noteIndex}`}
                                            note={note}
                                        />
                                    ))}
                                </div>
                                {notes[0].date && (
                                    <p className="text-xs text-tertiary/60 mt-3">Released: {notes[0].date}</p>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </>
    );
};

// Settings content component
const SettingsContent = ({ settingsOptions, onItemClick, activePanel }: SettingsContentProps) => (
    <>
        {activePanel === 'main' && (
            <div className="flex justify-center pt-3 pb-2 md:hidden">
                <div className="w-14 h-1.5 rounded-full bg-tertiary/30" />
            </div>
        )}

        {activePanel === 'main' ? (
            <>
                <div className="px-6 border-b border-tertiary/10 py-4 md:py-5">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold text-primary md:text-2xl">Settings</h2>
                        <button
                            onClick={() => onItemClick(-1)}
                            className="p-2 rounded-full hover:bg-themewhite2 md:hover:bg-themewhite active:scale-95 transition-all"
                            aria-label="Close"
                        >
                            <X size={24} className="text-tertiary" />
                        </button>
                    </div>
                </div>

                <div className="overflow-y-auto h-[calc(100dvh-80px)] md:overflow-visible md:h-auto">
                    <div className="px-4 py-3 md:p-6">
                        <div className="mb-4 pb-4 border-b border-tertiary/10">
                            <div className="flex items-center w-full px-4 py-3.5 hover:bg-themewhite2 active:scale-[0.98]
                                          transition-all rounded-xl cursor-pointer group
                                          md:px-5 md:py-4">
                                <div className="mr-4 w-12 h-12 rounded-full bg-themeblue3 flex items-center justify-center text-white shrink-0">
                                    <User size={24} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-base font-semibold text-primary md:text-lg">Guest User</p>
                                    <p className="text-xs text-tertiary/60 md:text-sm">Tap to sign in</p>
                                </div>
                                <ChevronRight size={20} className="text-tertiary/40 shrink-0" />
                            </div>
                        </div>

                        <div className="space-y-1 md:grid md:grid-cols-1 md:gap-3">
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
            </>
        ) : (
            <ReleaseNotesContent onBack={() => onItemClick(-2)} />
        )}
    </>
);

export const Settings = ({
    isVisible,
    onClose,
    isDarkMode,
    onToggleTheme,
    isMobile: externalIsMobile,
}: SettingsDrawerProps) => {
    const [localIsMobile, setLocalIsMobile] = useState(false);
    const isMobile = externalIsMobile !== undefined ? externalIsMobile : localIsMobile;

    const [drawerPosition, setDrawerPosition] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [activePanel, setActivePanel] = useState<'main' | 'release-notes'>('main');
    const [slideDirection, setSlideDirection] = useState<'left' | 'right' | ''>('');

    const drawerRef = useRef<HTMLDivElement>(null);
    const dragStartY = useRef(0);
    const dragStartPosition = useRef(0);
    const animationFrameId = useRef<number>(0);
    const velocityRef = useRef(0);
    const lastYRef = useRef(0);
    const lastTimeRef = useRef(0);

    useEffect(() => {
        if (externalIsMobile === undefined) {
            const checkMobile = () => setLocalIsMobile(window.innerWidth < 768);
            checkMobile();
            window.addEventListener('resize', checkMobile);
            return () => window.removeEventListener('resize', checkMobile);
        }
    }, [externalIsMobile]);

    useEffect(() => {
        if (isVisible) {
            setDrawerPosition(100);
            setActivePanel('main');
            setSlideDirection('');
            document.body.style.overflow = 'hidden';
        } else {
            setDrawerPosition(0);
            document.body.style.overflow = '';
        }

        return () => {
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current);
            }
        };
    }, [isVisible]);

    const animateToPosition = useCallback((targetPosition: number) => {
        const startPosition = drawerPosition;
        const startTime = performance.now();
        const duration = 300;

        const animate = (timestamp: number) => {
            const elapsed = timestamp - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            const currentPosition = startPosition + (targetPosition - startPosition) * easeProgress;

            setDrawerPosition(currentPosition);

            if (progress < 1) {
                animationFrameId.current = requestAnimationFrame(animate);
            } else {
                animationFrameId.current = 0;
                if (targetPosition === 0) {
                    setTimeout(onClose, 50);
                }
            }
        };

        if (animationFrameId.current) {
            cancelAnimationFrame(animationFrameId.current);
        }
        animationFrameId.current = requestAnimationFrame(animate);
    }, [drawerPosition, onClose]);

    const handleSlideAnimation = useCallback((direction: 'left' | 'right') => {
        setSlideDirection(direction);
        setTimeout(() => setSlideDirection(''), 300);
    }, []);

    const handleItemClick = useCallback((id: number) => {
        if (id === -1) {
            isMobile ? handleClose() : onClose();
        } else if (id === -2) {
            handleSlideAnimation('right');
            setActivePanel('main');
        } else if (id === 4) {
            handleSlideAnimation('left');
            setActivePanel('release-notes');
        }
    }, [isMobile, handleSlideAnimation]);

    const handleDragStart = (e: React.TouchEvent | React.MouseEvent) => {
        if (!isMobile || activePanel !== 'main') return;

        setIsDragging(true);
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        dragStartY.current = clientY;
        dragStartPosition.current = drawerPosition;
        lastYRef.current = clientY;
        lastTimeRef.current = performance.now();
        velocityRef.current = 0;

        e.stopPropagation();
    };

    const handleDragMove = (e: React.TouchEvent | React.MouseEvent) => {
        if (!isDragging || !isMobile || activePanel !== 'main') return;

        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        const deltaY = clientY - dragStartY.current;

        const currentTime = performance.now();
        const deltaTime = currentTime - lastTimeRef.current;
        if (deltaTime > 0) {
            velocityRef.current = (clientY - lastYRef.current) / deltaTime;
        }

        lastYRef.current = clientY;
        lastTimeRef.current = currentTime;

        const dragSensitivity = 0.8;
        const newPosition = Math.min(100, Math.max(20, dragStartPosition.current - (deltaY * dragSensitivity)));
        setDrawerPosition(newPosition);

        e.stopPropagation();
    };

    const handleDragEnd = () => {
        if (!isDragging || !isMobile || activePanel !== 'main') return;

        setIsDragging(false);
        const shouldClose = velocityRef.current > 0.3 || drawerPosition < 40;
        const shouldOpen = velocityRef.current < -0.3 || drawerPosition > 60;

        if (shouldClose) {
            animateToPosition(0);
        } else if (shouldOpen) {
            animateToPosition(100);
        } else {
            animateToPosition(drawerPosition > 50 ? 100 : 0);
        }
    };

    const handleClose = () => {
        animateToPosition(0);
    };

    const settingsOptions = [
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
            action: () => handleItemClick(4),
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
    ];

    const mobileTranslateY = 100 - drawerPosition;
    const mobileOpacity = Math.min(1, drawerPosition / 60 + 0.2);

    const slideClasses = {
        '': '',
        'left': 'animate-slide-in-left',
        'right': 'animate-slide-in-right'
    };

    return (
        <>
            {/* Mobile Container - NO BACKDROP */}
            <div ref={drawerRef} className="md:hidden">
                {/* Completely removed backdrop div */}

                <div
                    className={`fixed left-0 right-0 z-60 bg-themewhite3 shadow-2xl ${isDragging ? '' : 'transition-all duration-300 ease-out'
                        } ${slideClasses[slideDirection]}`}
                    style={{
                        height: '98dvh',
                        maxHeight: '98dvh',
                        bottom: 0,
                        transform: `translateY(${mobileTranslateY}%)`,
                        opacity: mobileOpacity,
                        borderTopLeftRadius: '1.25rem',
                        borderTopRightRadius: '1.25rem',
                        willChange: isDragging ? 'transform' : 'auto',
                        touchAction: 'none',
                        boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.1)',
                    }}
                    onTouchStart={handleDragStart}
                    onTouchMove={handleDragMove}
                    onTouchEnd={handleDragEnd}
                    onMouseDown={handleDragStart}
                    onMouseMove={handleDragMove}
                    onMouseUp={handleDragEnd}
                    onMouseLeave={handleDragEnd}
                >
                    <SettingsContent
                        settingsOptions={settingsOptions}
                        onItemClick={handleItemClick}
                        activePanel={activePanel}
                    />
                </div>
            </div>

            {/* Desktop Container - Keep backdrop for desktop only */}
            <div className="hidden md:block">
                <div
                    className={`fixed inset-0 z-60 flex items-start justify-center transition-all duration-300 ease-out ${isVisible
                        ? 'visible pointer-events-auto'
                        : 'invisible pointer-events-none'
                        }`}
                    onClick={onClose}
                >
                    <div className="max-w-315 w-full relative">
                        <div
                            className={`absolute right-2 top-2 z-60 py-3 pl-3 pr-5
                            flex flex-col rounded-xl
                            border border-tertiary/20
                            shadow-[0_2px_4px_0] shadow-themewhite2/20
                            backdrop-blur-md bg-themewhite2/10
                            transform-gpu
                            overflow-hidden
                            text-primary/80 text-sm
                            origin-top-right
                            transition-all duration-300 ease-out
                            max-w-md
                            w-full
                            ${isVisible
                                    ? "scale-x-100 scale-y-100 translate-x-0 translate-y-0"
                                    : "opacity-0 scale-x-20 scale-y-20 translate-x-10 -translate-y-2 pointer-events-none"
                                }`}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className={`relative ${slideClasses[slideDirection]}`}>
                                <SettingsContent
                                    settingsOptions={settingsOptions}
                                    onItemClick={handleItemClick}
                                    activePanel={activePanel}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};