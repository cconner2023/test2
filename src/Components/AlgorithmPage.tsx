import { useRef, useEffect, useState, useCallback } from 'react';
import { useAlgorithm } from '../Hooks/useAlgorithm';
import type { subCatDataTypes } from '../Types/CatTypes';
import { Algorithm as AlgorithmData } from '../Data/Algorithms';
import { QuestionCard } from './QuestionCard';
import { getColorClasses } from '../Utilities/ColorUtilities';
import type { medListTypes } from '../Data/MedData';
import type { WriteNoteData } from '../Hooks/useNavigation';

interface AlgorithmProps {
    selectedSymptom: subCatDataTypes | null;
    onMedicationClick?: (medication: medListTypes) => void;
    onExpandNote?: (data: WriteNoteData) => void;
    isMobile?: boolean;
}

export function AlgorithmPage({ selectedSymptom, onExpandNote, isMobile = false }: AlgorithmProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const markerRef = useRef<HTMLDivElement>(null);
    const prevDispositionRef = useRef<any>(null);
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
        getVisibleCards
    } = useAlgorithm(algorithmOptions);

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
                <div
                    ref={containerRef}
                    className={`flex-1 overflow-y-auto ${isTransitioning ? 'transition-none' : ''}`}
                >
                    {/* Mobile: spacer accounts for safe area + navbar, scrolls with content */}
                    <div
                        className={`pb-4 ${isMobile ? 'px-2 bg-themewhite min-h-full' : ''}`}
                        style={isMobile ? { paddingTop: 'calc(env(safe-area-inset-top, 0px) + 4rem)' } : undefined}
                    >
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
        </div>
    );
}