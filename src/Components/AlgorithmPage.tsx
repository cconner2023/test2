import { useRef, useEffect, useState, useCallback } from 'react';
import { useAlgorithm } from '../Hooks/useAlgorithm';
import type { subCatDataTypes } from '../Types/CatTypes';
import { Algorithm as AlgorithmData } from '../Data/Algorithms';
import { QuestionCard } from './QuestionCard';
import { WriteNotePage } from './WriteNotePage';
import { getColorClasses } from '../Utilities/ColorUtilities';
import type { medListTypes } from '../Data/MedData';

interface AlgorithmProps {
    selectedSymptom: subCatDataTypes | null;
    onMedicationClick?: (medication: medListTypes) => void;
}

type ViewState = 'algorithm' | 'note-expanded';

export function AlgorithmPage({ selectedSymptom }: AlgorithmProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const markerRef = useRef<HTMLDivElement>(null);
    const prevDispositionRef = useRef<any>(null);
    const initialScrollDone = useRef(false);
    const prevScrollTriggerRef = useRef(0);
    const [savedScrollPosition, setSavedScrollPosition] = useState<number>(0);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [viewState, setViewState] = useState<ViewState>('algorithm');
    const [scrollTrigger, setScrollTrigger] = useState(0);
    const [isMobile, setIsMobile] = useState(false);

    const algorithm = AlgorithmData.find(algo => algo.id === selectedSymptom?.icon);
    const algorithmOptions = algorithm?.options || [];

    const {
        cardStates,
        currentDisposition,
        handleQuestionOption: hookHandleQuestionOption,
        handleAnswer: hookHandleAnswer,
        getVisibleCards
    } = useAlgorithm(algorithmOptions);

    // Update view when disposition disappears
    useEffect(() => {
        if (!currentDisposition && viewState === 'note-expanded') {
            setViewState('algorithm');
        }
    }, [currentDisposition, viewState]);

    // Track disposition changes — delay scroll past connector stagger animation (~500ms)
    useEffect(() => {
        const dispositionChanged = prevDispositionRef.current !== currentDisposition;
        prevDispositionRef.current = currentDisposition;

        if (currentDisposition && dispositionChanged && viewState === 'algorithm') {
            setTimeout(() => {
                setScrollTrigger(prev => prev + 1);
            }, 600);
        }
    }, [currentDisposition, viewState]);

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

    // Scroll effect — only fires when scrollTrigger increments, not on viewState change
    useEffect(() => {
        if (scrollTrigger > prevScrollTriggerRef.current && viewState === 'algorithm') {
            prevScrollTriggerRef.current = scrollTrigger;
            scrollToMarker();
        }
    }, [scrollTrigger, viewState, scrollToMarker]);

    // IntersectionObserver
    useEffect(() => {
        if (!containerRef.current || !markerRef.current || viewState !== 'algorithm') return;

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
    }, [isTransitioning, viewState, scrollToMarker]);
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);
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

    // Handle expand/collapse of note
    const handleExpandNote = () => {
        if (containerRef.current) {
            setSavedScrollPosition(containerRef.current.scrollTop);
        }
        setViewState('note-expanded');
    };

    const handleCollapseNote = () => {
        setViewState('algorithm');
        setTimeout(() => {
            if (containerRef.current) {
                containerRef.current.scrollTop = savedScrollPosition;
            }
        }, 50);
    };

    // Reset initial scroll flag when algorithm changes
    useEffect(() => {
        initialScrollDone.current = false;
    }, [selectedSymptom?.id, algorithm]);

    // Initial scroll when algorithm loads — does not re-fire on return from WriteNotePage
    useEffect(() => {
        if (selectedSymptom && algorithm && viewState === 'algorithm' && !initialScrollDone.current) {
            initialScrollDone.current = true;
            setTimeout(() => {
                setScrollTrigger(prev => prev + 1);
            }, 300);
        }
    }, [selectedSymptom?.id, algorithm, viewState]);

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
            {/* ALGORITHM VIEW - always mounted to preserve state and avoid animation re-fire */}
            <div key="algorithm-view" className="h-full flex flex-col">
                {/* Algorithm Content */}
                <div
                    ref={containerRef}
                    className={`flex-1 overflow-y-auto ${isTransitioning ? 'transition-none' : ''}`}
                >
                    <div className="pb-4">
                        <QuestionCard
                            algorithmOptions={algorithmOptions}
                            cardStates={cardStates}
                            visibleCards={visibleCards}
                            isTransitioning={isTransitioning}
                            onAnswer={handleAnswer}
                            onQuestionOption={handleQuestionOption}
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
                                                    className={`px-4 py-2 rounded-md text-sm font-medium shrink-0 ${colors.buttonClass}`}
                                                >
                                                    Continue &gt;
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

            {/* NOTE VIEW - overlays on mobile (bottom sheet), replaces on desktop */}
            {viewState === 'note-expanded' && currentDisposition && (
                <div className={`absolute inset-0 h-full w-full z-10 ${!isMobile ? 'animate-desktopNoteExpand' : ''}`}>
                    <WriteNotePage
                        disposition={currentDisposition}
                        algorithmOptions={algorithmOptions}
                        cardStates={cardStates}
                        isExpanded={true}
                        onExpansionChange={handleCollapseNote}
                        onNoteSave={(note: string) => {
                            console.log('Note saved:', note);
                        }}
                        selectedSymptom={{
                            icon: selectedSymptom?.icon || '',
                            text: selectedSymptom?.text || ''
                        }}
                        isMobile={isMobile}
                    />
                </div>
            )}
        </div>
    );
}