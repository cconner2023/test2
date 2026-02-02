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

    // Track disposition changes
    useEffect(() => {
        const dispositionChanged = prevDispositionRef.current !== currentDisposition;
        prevDispositionRef.current = currentDisposition;

        if (currentDisposition && dispositionChanged && viewState === 'algorithm') {
            setTimeout(() => {
                setScrollTrigger(prev => prev + 1);
            }, 100);
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

    // Scroll effect
    useEffect(() => {
        if (scrollTrigger > 0 && viewState === 'algorithm') {
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
    // Wrapper handlers
    const handleAnswer = (cardIndex: number, answerIndex: number) => {
        setIsTransitioning(true);
        hookHandleAnswer(cardIndex, answerIndex);
        setScrollTrigger(prev => prev + 1);
    };

    const handleQuestionOption = (cardIndex: number, optionIndex: number) => {
        setIsTransitioning(true);
        hookHandleQuestionOption(cardIndex, optionIndex);
        setScrollTrigger(prev => prev + 1);
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

    // Initial scroll when algorithm loads
    useEffect(() => {
        if (selectedSymptom && algorithm && viewState === 'algorithm') {
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
            {/* ALGORITHM VIEW */}
            {viewState === 'algorithm' && (
                <div key="algorithm-view" className="h-full flex flex-col opacity-100 transition-opacity duration-200">
                    {/* Algorithm Content */}
                    <div
                        ref={containerRef}
                        className={`flex-1 overflow-y-auto ${isTransitioning ? 'transition-none' : ''}
                            ${currentDisposition ? 'pb-24' : ''}`}
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
                            <div
                                ref={markerRef}
                                className="h-2 w-full pointer-events-none"
                                aria-hidden="true"
                                style={{ marginTop: '1rem', marginBottom: '1rem' }}
                            />
                        </div>
                    </div>

                    {/* Disposition Header - Simple relative positioning */}
                    {currentDisposition && colors && (
                        <div className={`relative rounded-md bg-themewhite`}>
                            <div className={`p-4 bg-themewhite2 ${isMobile ? 'pb-20' : ''}`}>
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
                                        Continue  &gt;
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* NOTE VIEW - Takes full container */}
            {viewState === 'note-expanded' && currentDisposition && (
                <div className="absolute inset-0 h-full w-full opacity-100 transition-opacity duration-200">
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
                            icon: 'A-1',
                            text: 'Sore Throat/Hoarseness'
                        }}
                        isMobile={isMobile}
                    />
                </div>
            )}
        </div>
    );
}