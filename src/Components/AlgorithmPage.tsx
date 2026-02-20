import { useRef, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAlgorithm } from '../Hooks/useAlgorithm';
import type { subCatDataTypes } from '../Types/CatTypes';
import type { dispositionType } from '../Types/AlgorithmTypes';
import { Algorithm as AlgorithmData } from '../Data/Algorithms';
import { QuestionCard } from './QuestionCard';
import { ScreenerDrawer } from './ScreenerDrawer';
import { getColorClasses } from '../Utilities/ColorUtilities';
import { formatNoteSource } from '../Utilities/NoteSourceUtils';
import { ConnectorDots } from './ConnectorDots';
import { ALGORITHM_TIMING } from '../Utilities/constants';
import type { WriteNoteData } from '../Hooks/useNavigation';
import { Check, Download, PenSquare, ChevronRight } from 'lucide-react';

interface AlgorithmProps {
    selectedSymptom: subCatDataTypes | null;
    onExpandNote?: (data: WriteNoteData) => void;
    isMobile?: boolean;
    initialCardStates?: import('../Hooks/useAlgorithm').CardState[];
    initialDisposition?: dispositionType | null;
    /** Note source string: null = new note, 'external:user' = imported, anything else = saved */
    noteSource?: string | null;
}

export function AlgorithmPage({ selectedSymptom, onExpandNote, isMobile = false, initialCardStates, initialDisposition, noteSource = null }: AlgorithmProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const markerRef = useRef<HTMLDivElement>(null);
    const prevDispositionRef = useRef<dispositionType | null>(null);
    const initialScrollDone = useRef(false);
    const prevScrollTriggerRef = useRef(0);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [scrollTrigger, setScrollTrigger] = useState(0);

    const algorithm = AlgorithmData.find(algo => algo.id === selectedSymptom?.icon);
    const algorithmOptions = algorithm?.options || [];

    const {
        cardStates,
        currentDisposition,
        handleQuestionOption: hookHandleQuestionOption,
        handleAnswer: hookHandleAnswer,
        getVisibleCards,
        setScreenerResults,
        setActionStatus,
    } = useAlgorithm(algorithmOptions, initialCardStates, initialDisposition);

    // Screener drawer state
    const [openScreenerCardIndex, setOpenScreenerCardIndex] = useState<number | null>(null);

    // Track disposition changes — delay scroll past connector stagger animation (~500ms)
    useEffect(() => {
        const dispositionChanged = prevDispositionRef.current !== currentDisposition;
        prevDispositionRef.current = currentDisposition;

        if (currentDisposition && dispositionChanged) {
            setTimeout(() => {
                setScrollTrigger(prev => prev + 1);
            }, ALGORITHM_TIMING.DISPOSITION_SCROLL_DELAY);
        }
    }, [currentDisposition]);

    // Scroll function
    const scrollToMarker = useCallback(() => {
        if (!markerRef.current || !containerRef.current) {
            setTimeout(scrollToMarker, ALGORITHM_TIMING.SCROLL_RETRY);
            return;
        }
        const marker = markerRef.current;
        const container = containerRef.current;
        const targetPosition = Math.max(0, marker.offsetTop);
        container.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
        });
        setIsTransitioning(false);
    }, []);

    // Scroll effect — only fires when scrollTrigger increments
    useEffect(() => {
        if (scrollTrigger > prevScrollTriggerRef.current) {
            prevScrollTriggerRef.current = scrollTrigger;
            scrollToMarker();
        }
    }, [scrollTrigger, scrollToMarker]);

    // IntersectionObserver
    useEffect(() => {
        if (!containerRef.current || !markerRef.current) return;

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting && isTransitioning) {
                        scrollToMarker();
                    }
                });
            },
            {
                root: containerRef.current,
                rootMargin: '0px',
                threshold: 0.1,
            }
        );

        observer.observe(markerRef.current);
        return () => observer.disconnect();
    }, [isTransitioning, scrollToMarker]);
    // Wrapper handlers — scroll delayed to let connector stagger animation (~500ms) complete
    const handleAnswer = (cardIndex: number, answerIndex: number) => {
        setIsTransitioning(true);
        hookHandleAnswer(cardIndex, answerIndex);
        setTimeout(() => {
            setScrollTrigger(prev => prev + 1);
        }, ALGORITHM_TIMING.SCROLL_AFTER_STAGGER);
    };

    const handleQuestionOption = (cardIndex: number, optionIndex: number) => {
        setIsTransitioning(true);
        hookHandleQuestionOption(cardIndex, optionIndex);
        setTimeout(() => {
            setScrollTrigger(prev => prev + 1);
        }, ALGORITHM_TIMING.SCROLL_AFTER_STAGGER);
    };

    // Action status wrapper — triggers animation when pending cards are revealed
    const handleActionStatus = (cardIndex: number, status: 'performed' | 'deferred') => {
        setIsTransitioning(true);
        setActionStatus(cardIndex, status);
        setTimeout(() => {
            setScrollTrigger(prev => prev + 1);
        }, ALGORITHM_TIMING.SCROLL_AFTER_STAGGER);
    };

    // Screener handlers
    const handleOpenScreener = useCallback((cardIndex: number) => {
        setOpenScreenerCardIndex(cardIndex);
    }, []);

    const handleScreenerComplete = useCallback((screenerId: string, responses: number[], followUp?: number) => {
        if (openScreenerCardIndex !== null) {
            setIsTransitioning(true);
            setScreenerResults(openScreenerCardIndex, screenerId, responses, followUp);
            setTimeout(() => {
                setScrollTrigger(prev => prev + 1);
            }, ALGORITHM_TIMING.SCROLL_AFTER_STAGGER);
        }
        setOpenScreenerCardIndex(null);
    }, [openScreenerCardIndex, setScreenerResults]);

    const handleScreenerClose = useCallback(() => {
        setOpenScreenerCardIndex(null);
    }, []);

    // Handle expand note - calls callback to open WriteNotePage at App level
    const handleExpandNote = () => {
        if (!currentDisposition || !selectedSymptom || !onExpandNote) return;

        onExpandNote({
            disposition: currentDisposition,
            algorithmOptions,
            cardStates,
            selectedSymptom: {
                icon: selectedSymptom.icon || '',
                text: selectedSymptom.text || ''
            }
        });
    };

    // Reset initial scroll flag when algorithm changes
    useEffect(() => {
        initialScrollDone.current = false;
    }, [selectedSymptom?.id, algorithm]);

    // Initial scroll when algorithm loads
    useEffect(() => {
        if (selectedSymptom && algorithm && !initialScrollDone.current) {
            initialScrollDone.current = true;
            setTimeout(() => {
                setScrollTrigger(prev => prev + 1);
            }, ALGORITHM_TIMING.INITIAL_SCROLL_DELAY);
        }
    }, [selectedSymptom?.id, algorithm]);

    // Early returns
    if (!selectedSymptom) {
        return (
            <div className="w-full h-full flex items-center justify-center">
                <p className="text-primary">No symptom selected</p>
            </div>
        );
    }
    if (!algorithm || algorithmOptions.length === 0) {
        return (
            <div className="p-4 text-center w-full text-themeblue3">
                <p>No algorithm found for: {selectedSymptom.text}</p>
            </div>
        );
    }

    const visibleCards = getVisibleCards();
    const colors = currentDisposition ? getColorClasses(currentDisposition.type) : null;

    return (
        <div className="w-full h-full relative overflow-hidden">
            <div key="algorithm-view" className="h-full flex flex-col">
                {/* Note status header — on desktop only (mobile shows it in NavTop) */}
                {!isMobile && (
                    <div className="shrink-0">
                        <div className="flex items-center gap-1.5 py-2 px-3 rounded-md bg-themewhite2 border border-tertiary/10 shadow-sm text-[11px] font-medium text-primary mb-3">
                            {noteSource && !noteSource.startsWith('external') ? (
                                <Check className="w-3 h-3 shrink-0" />
                            ) : noteSource?.startsWith('external') ? (
                                <Download className="w-3 h-3 shrink-0" />
                            ) : (
                                <PenSquare className="w-3 h-3 shrink-0" />
                            )}
                            {formatNoteSource(noteSource)}
                        </div>
                    </div>
                )}
                <div
                    ref={containerRef}
                    className={`flex-1 overflow-y-auto ${isMobile ? 'bg-themewhite' : ''} ${isTransitioning ? 'transition-none' : ''}`}
                >
                    {/* Content area */}
                    <div
                        className={`pb-4 ${isMobile ? 'px-2 min-h-full' : ''}`}
                        style={isMobile ? { paddingTop: 'calc(env(safe-area-inset-top, 0px) + 4rem)' } : undefined}
                    >
                        <QuestionCard
                            algorithmOptions={algorithmOptions}
                            cardStates={cardStates}
                            visibleCards={visibleCards}
                            isTransitioning={isTransitioning}
                            onAnswer={handleAnswer}
                            onQuestionOption={handleQuestionOption}
                            onOpenScreener={handleOpenScreener}
                            onActionStatus={handleActionStatus}
                        />

                        {/* Disposition card — inline after last question card */}
                        {currentDisposition && colors && (
                            <div className="flex flex-col items-center">
                                {/* Connector from last card to disposition */}
                                <ConnectorDots colorClass={colors.badgeBg} />

                                {/* Disposition card */}
                                <div
                                    key={`dispo-${currentDisposition.type}-${currentDisposition.text}`}
                                    className="w-full animate-cardAppearIn"
                                >
                                    <div className={`flex flex-col rounded-md w-full overflow-hidden shadow-sm
                                            bg-themewhite2 border ${colors.badgeBorder}`}>
                                        <div className="p-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center space-x-3">
                                                    <div className={`px-3 py-2 shrink-0 rounded-md
                                                            flex items-center justify-center ${colors.badgeBg}
                                                            font-bold text-sm ${colors.badgeText}`}>
                                                        {currentDisposition.type}
                                                    </div>
                                                    <div className="min-w-0 flex-1 flex flex-col">
                                                        <p className="text-sm text-primary wrap-break-word">
                                                            {currentDisposition.text}
                                                        </p>
                                                        {currentDisposition.modifier && (
                                                            <p className="text-xs text-secondary mt-1 wrap-break-word">
                                                                {currentDisposition.modifier}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={handleExpandNote}
                                                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 active:scale-95 transition-all ${colors.buttonClass}`}
                                                    aria-label="Continue"
                                                >
                                                    <ChevronRight className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div
                            ref={markerRef}
                            className="h-2 w-full pointer-events-none"
                            aria-hidden="true"
                            style={{ marginTop: '1rem', marginBottom: '1rem' }}
                        />
                    </div>
                </div>
            </div>

            {/* Screener Drawer — portaled to app container so BaseDrawer sizes like other drawers */}
            {openScreenerCardIndex !== null && algorithmOptions[openScreenerCardIndex]?.screenerConfig &&
                createPortal(
                    <ScreenerDrawer
                        screenerConfig={algorithmOptions[openScreenerCardIndex].screenerConfig!}
                        initialResponses={cardStates[openScreenerCardIndex]?.screenerResponses}
                        initialFollowUp={cardStates[openScreenerCardIndex]?.followUpResponse}
                        initialCompletedId={cardStates[openScreenerCardIndex]?.completedScreenerId}
                        onComplete={handleScreenerComplete}
                        onClose={handleScreenerClose}
                    />,
                    document.getElementById('app-drawer-root')!,
                )}
        </div>
    );
}