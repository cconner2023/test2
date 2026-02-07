import { useEffect, useState, useRef, useCallback } from 'react';
import { X, Moon, Sun, Shield, HelpCircle, ChevronUp, User, ChevronRight, ChevronLeft, Bug, PlusCircle, RefreshCw } from 'lucide-react';
import { ReleaseNotes, type ReleaseNoteTypes } from '../Data/Release';

interface SettingsDrawerProps {
    isVisible: boolean;
    onClose: () => void;
    isDarkMode: boolean;
    onToggleTheme: () => void;
    isMobile?: boolean;
}

// Extract the note type safely
type NoteType = Exclude<ReleaseNoteTypes['type'], undefined> | 'default';

const NOTE_ICONS: Record<NoteType, {
    icon: React.ComponentType<{ size: number; className: string }>;
    className: string
}> = {
    bug: { icon: Bug, className: "text-red-500" },
    added: { icon: PlusCircle, className: "text-green-500" },
    changed: { icon: RefreshCw, className: "text-blue-500" },
    default: { icon: PlusCircle, className: "text-tertiary" }
};

const ReleaseNoteItem = ({ note }: { note: ReleaseNoteTypes }) => {
    const noteType: NoteType = note.type || 'default';
    const { icon: Icon, className } = NOTE_ICONS[noteType];

    return (
        <div className="flex items-start mb-2 last:mb-0">
            <div className="mt-1.5 mr-3">
                <Icon size={14} className={className} />
            </div>
            <p className="text-sm text-tertiary/80 flex-1">{note.text}</p>
        </div>
    );
};

const ReleaseNotesPanel = ({ onBack }: { onBack: () => void }) => {
    const groupedNotes = ReleaseNotes.reduce<Record<string, ReleaseNoteTypes[]>>((acc, note) => {
        const version = note.version;
        if (!acc[version]) acc[version] = [];
        acc[version].push(note);
        return acc;
    }, {});

    const versions = Object.keys(groupedNotes).sort((a, b) => parseFloat(b) - parseFloat(a));

    return (
        <div className="h-full flex flex-col">
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

            <div className="flex-1 overflow-y-auto px-4 py-3 md:p-6">
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
                            {notes[0]?.date && (
                                <p className="text-xs text-tertiary/60 mt-3">Released: {notes[0].date}</p>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const MainSettingsPanel = ({
    settingsOptions,
    onItemClick,
    onClose,
    isMobile
}: {
    settingsOptions: Array<{
        icon: React.ReactNode;
        label: string;
        action: () => void;
        color: string;
        id: number;
    }>;
    onItemClick: (id: number) => void;
    onClose: () => void;
    isMobile: boolean;
}) => (
    <div className="h-full flex flex-col">
        {isMobile && (
            <div className="flex justify-center pt-3 pb-2" data-drag-zone style={{ touchAction: 'none' }}>
                <div className="w-14 h-1.5 rounded-full bg-tertiary/30" />
            </div>
        )}

        <div className="px-6 border-b border-tertiary/10 py-3 md:py-4" data-drag-zone style={{ touchAction: 'none' }}>
            <div className="flex items-center justify-between">
                <h2 className="text-[11pt] font-normal text-primary md:text-2xl">Settings</h2>
                <button
                    onClick={onClose}
                    className="p-2 rounded-full hover:bg-themewhite2 md:hover:bg-themewhite active:scale-95 transition-all"
                    aria-label="Close"
                >
                    <X size={24} className="text-tertiary" />
                </button>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto">
            <div className="px-4 py-3 md:p-5">
                <div className="mb-4 pb-4 border-b border-tertiary/10">
                    <div className="flex items-center w-full px-4 py-3.5 hover:bg-themewhite2/10 active:scale-[0.98]
                                  transition-all cursor-pointer group
                                  md:px-5 md:py-4">
                        <div className="mr-4 w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center text-primary shrink-0">
                            <User size={24} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-base font-semibold text-primary md:text-lg">Guest User</p>
                            <p className="text-xs text-tertiary/60 md:text-sm">Tap to sign in</p>
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
}: SettingsDrawerProps) => {
    const [localIsMobile, setLocalIsMobile] = useState(false);
    const isMobile = externalIsMobile ?? localIsMobile;

    const [drawerPosition, setDrawerPosition] = useState(0);
    const [drawerStage, setDrawerStage] = useState<'partial' | 'full'>('partial');
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
            const resizeHandler = () => checkMobile();
            window.addEventListener('resize', resizeHandler);
            return () => window.removeEventListener('resize', resizeHandler);
        }
    }, [externalIsMobile]);

    useEffect(() => {
        if (isVisible) {
            setDrawerStage('partial');
            setDrawerPosition(100);
            setActivePanel('main');
            setSlideDirection('');
            document.body.style.overflow = 'hidden';
        } else {
            setDrawerPosition(0);
            document.body.style.overflow = '';
        }

        return () => {
            animationFrameId.current && cancelAnimationFrame(animationFrameId.current);
        };
    }, [isVisible]);

    const animateToPosition = useCallback((targetPosition: number) => {
        if (animationFrameId.current) {
            cancelAnimationFrame(animationFrameId.current);
        }

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
                targetPosition === 0 && setTimeout(onClose, 50);
            }
        };

        animationFrameId.current = requestAnimationFrame(animate);
    }, [drawerPosition, onClose]);

    const handleSlideAnimation = useCallback((direction: 'left' | 'right') => {
        setSlideDirection(direction);
        setTimeout(() => setSlideDirection(''), 300);
    }, []);

    const handleItemClick = useCallback((id: number) => {
        switch (id) {
            case -1:
                isMobile ? handleClose() : onClose();
                break;
            case -2:
                handleSlideAnimation('right');
                setActivePanel('main');
                break;
            case 4:
                handleSlideAnimation('left');
                setActivePanel('release-notes');
                break;
            default:
                break;
        }
    }, [isMobile, handleSlideAnimation]);

    const handleDragInteraction = {
        start: (e: React.TouchEvent | React.MouseEvent) => {
            if (!isMobile || activePanel !== 'main') return;
            const target = e.target as HTMLElement;
            if (!target.closest('[data-drag-zone]')) return;

            setIsDragging(true);
            const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
            dragStartY.current = clientY;
            dragStartPosition.current = drawerPosition;
            lastYRef.current = clientY;
            lastTimeRef.current = performance.now();
            velocityRef.current = 0;

            e.stopPropagation();
        },

        move: (e: React.TouchEvent | React.MouseEvent) => {
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

            const newPosition = Math.min(100, Math.max(20, dragStartPosition.current - (deltaY * 0.8)));
            setDrawerPosition(newPosition);

            e.stopPropagation();
        },

        end: () => {
            if (!isDragging || !isMobile || activePanel !== 'main') return;
            setIsDragging(false);

            const isSwipingDown = velocityRef.current > 0.3;
            const isSwipingUp = velocityRef.current < -0.3;

            if (drawerStage === 'partial') {
                if (isSwipingUp) {
                    setDrawerStage('full');
                    animateToPosition(100);
                } else if (isSwipingDown || drawerPosition < 40) {
                    animateToPosition(0);
                } else {
                    animateToPosition(100);
                }
            } else {
                if (velocityRef.current > 0.6 || drawerPosition < 30) {
                    animateToPosition(0);
                } else if (isSwipingDown || drawerPosition < 70) {
                    setDrawerStage('partial');
                    animateToPosition(100);
                } else {
                    animateToPosition(100);
                }
            }
        }
    };

    const handleClose = () => animateToPosition(0);

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

    const mobileStyles = {
        translateY: 100 - drawerPosition,
        opacity: Math.min(1, drawerPosition / 60 + 0.2),
        height: drawerStage === 'partial' ? '45dvh' : '90dvh',
        horizontalPadding: drawerStage === 'partial' ? '0.4rem' : '0',
        bottomPadding: drawerStage === 'partial' ? '1.5rem' : '0',
        borderRadius: drawerStage === 'partial' ? '1rem' : '1.25rem 1.25rem 0 0',
        boxShadow: drawerStage === 'partial'
            ? '0 4px 2px rgba(0, 0, 0, 0.05)'
            : '0 -4px 20px rgba(0, 0, 0, 0.1)',
        width: drawerStage === 'partial' ? 'calc(100% - 1rem)' : '100%',
    };

    return (
        <>
            {/* Mobile Container */}
            <div ref={drawerRef} className="md:hidden">
                <div
                    className={`fixed inset-0 z-60 bg-black ${isDragging ? '' : 'transition-opacity duration-300 ease-out'}`}
                    style={{
                        opacity: (drawerPosition / 100) * 0.9,
                        pointerEvents: drawerPosition > 0 ? 'auto' : 'none',
                    }}
                    onClick={handleClose}
                />

                {/* Main drawer container - stays stable */}
                <div
                    className={`fixed left-0 right-0 z-60 bg-themewhite3 ${isDragging ? '' : 'transition-all duration-300 ease-out'}`}
                    style={{
                        height: mobileStyles.height,
                        maxHeight: mobileStyles.height,
                        marginLeft: mobileStyles.horizontalPadding,
                        marginRight: mobileStyles.horizontalPadding,
                        marginBottom: mobileStyles.bottomPadding,
                        width: mobileStyles.width,
                        bottom: 0,
                        transform: `translateY(${mobileStyles.translateY}%)`,
                        opacity: mobileStyles.opacity,
                        borderRadius: mobileStyles.borderRadius,
                        willChange: isDragging ? 'transform' : 'auto',
                        boxShadow: mobileStyles.boxShadow,
                        overflow: 'hidden',
                        visibility: isVisible ? 'visible' : 'hidden',
                    }}
                    onTouchStart={handleDragInteraction.start}
                    onTouchMove={handleDragInteraction.move}
                    onTouchEnd={handleDragInteraction.end}
                    onMouseDown={handleDragInteraction.start}
                    onMouseMove={handleDragInteraction.move}
                    onMouseUp={handleDragInteraction.end}
                    onMouseLeave={handleDragInteraction.end}
                >
                    {/* Only the content animates */}
                    <ContentWrapper slideDirection={slideDirection}>
                        {activePanel === 'main' ? (
                            <MainSettingsPanel
                                settingsOptions={settingsOptions}
                                onItemClick={handleItemClick}
                                onClose={isMobile ? handleClose : onClose}
                                isMobile={isMobile}
                            />
                        ) : (
                            <ReleaseNotesPanel onBack={() => handleItemClick(-2)} />
                        )}
                    </ContentWrapper>
                </div>
            </div>

            {/* Desktop Container */}
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
                            flex flex-col rounded-xl border border-tertiary/20
                            shadow-[0_2px_4px_0] shadow-themewhite2/20 backdrop-blur-md bg-themewhite2/10
                            transform-gpu overflow-hidden text-primary/80 text-sm
                            origin-top-right transition-all duration-300 ease-out max-w-md w-full h-[600px]
                            ${isVisible
                                    ? "scale-x-100 scale-y-100 translate-x-0 translate-y-0"
                                    : "opacity-0 scale-x-20 scale-y-20 translate-x-10 -translate-y-2"
                                }`}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Only the content animates */}
                            <ContentWrapper slideDirection={slideDirection}>
                                {activePanel === 'main' ? (
                                    <MainSettingsPanel
                                        settingsOptions={settingsOptions}
                                        onItemClick={handleItemClick}
                                        onClose={onClose}
                                        isMobile={isMobile}
                                    />
                                ) : (
                                    <ReleaseNotesPanel onBack={() => handleItemClick(-2)} />
                                )}
                            </ContentWrapper>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};