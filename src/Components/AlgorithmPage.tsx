import { useRef, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAlgorithm } from '../Hooks/useAlgorithm';
import type { subCatDataTypes } from '../Types/CatTypes';
import type { dispositionType } from '../Types/AlgorithmTypes';
import { Algorithm as AlgorithmData } from '../Data/Algorithms';
import { QuestionCard } from './QuestionCard';
import { ScreenerDrawer } from './ScreenerDrawer';
import { getColorClasses } from '../Utilities/ColorUtilities';
import type { WriteNoteData } from '../Hooks/useNavigation';

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
            }, 600);
        }
    }, [currentDisposition]);

    // Scroll function
    const scrollToMarker = useCallback(() => {
        if (!markerRef.current || !containerRef.current) {
            setTimeout(scrollToMarker, 50);
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
        }, 550);
    };

    const handleQuestionOption = (cardIndex: number, optionIndex: number) => {
        setIsTransitioning(true);
        hookHandleQuestionOption(cardIndex, optionIndex);
        setTimeout(() => {
            setScrollTrigger(prev => prev + 1);
        }, 550);
    };

    // Screener handlers
    const handleOpenScreener = useCallback((cardIndex: number) => {
        setOpenScreenerCardIndex(cardIndex);
    }, []);

    const handleScreenerComplete = useCallback((screenerId: string, responses: number[], followUp?: number) => {
        if (openScreenerCardIndex !== null) {
            setScreenerResults(openScreenerCardIndex, screenerId, responses, followUp);
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
            }, 300);
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
                {/* Note status header — sticky at top, styled as card */}
                <div
                    className={`shrink-0 ${isMobile ? 'px-2' : ''}`}
                    style={isMobile ? { paddingTop: 'calc(env(safe-area-inset-top, 0px) + 4rem)' } : undefined}
                >
                    <div className="flex items-center gap-1.5 py-2 px-3 rounded-md bg-themewhite2 border border-tertiary/10 shadow-sm text-[11px] font-medium text-primary mb-3">
                        <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {noteSource && !noteSource.startsWith('external') ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            ) : noteSource?.startsWith('external') ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            )}
                        </svg>
                        {noteSource?.startsWith('external')
                            ? `External${noteSource.includes(':') ? ': ' + noteSource.split(':')[1] : ''}`
                            : noteSource ? 'Saved: My Note' : 'New Note'}
                    </div>
                </div>

                <div
                    ref={containerRef}
                    className={`flex-1 overflow-y-auto ${isTransitioning ? 'transition-none' : ''}`}
                >
                    {/* Content area */}
                    <div
                        className={`pb-4 ${isMobile ? 'px-2 bg-themewhite min-h-full' : ''}`}
                    >
                        <QuestionCard
                            algorithmOptions={algorithmOptions}
                            cardStates={cardStates}
                            visibleCards={visibleCards}
                            isTransitioning={isTransitioning}
                            onAnswer={handleAnswer}
                            onQuestionOption={handleQuestionOption}
                            onOpenScreener={handleOpenScreener}
                        />

                        {/* Disposition card — inline after last question card */}
                        {currentDisposition && colors && (
                            <div className="flex flex-col items-center">
                                {/* Connector from last card to disposition */}
                                <div key={`dispo-conn-${currentDisposition.type}`} className="flex flex-col items-center py-1">
                                    <div className={`connector-dot ${colors.badgeBg}`} style={{ animationDelay: '0ms' }} />
                                    <div className={`connector-dot ${colors.badgeBg}`} style={{ animationDelay: '100ms' }} />
                                    <div className={`connector-dot ${colors.badgeBg}`} style={{ animationDelay: '200ms' }} />
                                    <div className={`connector-dot ${colors.badgeBg}`} style={{ animationDelay: '290ms' }} />
                                </div>

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
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                                    </svg>
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