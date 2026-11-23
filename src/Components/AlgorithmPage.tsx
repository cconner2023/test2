import { useRef, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, CornerDownRight } from 'lucide-react';
import { useAlgorithm } from '../Hooks/useAlgorithm';
import { Algorithm as AlgorithmData } from '../Data/Algorithms';
import { QuestionCard } from './QuestionCard';
import { ScreenerDrawer } from './ScreenerDrawer';
import { SearchResults } from './SearchResults';
import { MobileSearchBar } from '@/Components/primitives/MobileSearchBar';
import { getColorClasses } from '../Utilities/ColorUtilities';
import { AlgorithmTrace, type TraceNode } from './AlgorithmTrace';
import { ALGORITHM_TIMING } from '../Utilities/constants';
import { useNavigationStore } from '../stores/useNavigationStore';
import type { SearchResultType, subCatDataTypes } from '../Types/CatTypes';
import type { AlgorithmOptions } from '../Types/AlgorithmTypes';
import type { CardState } from '../Hooks/useAlgorithm';
import { ActionPill } from '@/Components/primitives/ActionPill'

const ACTION_CODE: Record<string, string> = {
    'performed': 'DONE',
    'deferred-pending': 'DEFER',
    'deferred-stop': 'STOP',
};

function traceCode(question: AlgorithmOptions, card: CardState): string | undefined {
    if (question.type === 'action') {
        if (question.screenerConfig) return card.completedScreenerId ? 'SCRN' : undefined;
        if (card.actionStatus === 'deferred-continue') return card.pendingAfter !== undefined ? 'CONT' : 'DEFER';
        return card.actionStatus ? ACTION_CODE[card.actionStatus] : undefined;
    }
    return card.answer ? card.answer.text.toUpperCase().slice(0, 10) : undefined;
}

interface AlgorithmPageProps {
    searchInput?: string
    onSearchChange?: (value: string) => void
    searchResults?: SearchResultType[]
    isSearching?: boolean
    onSearchResultClick?: (result: SearchResultType) => void
    /** Held symptom while the page animates out after store clears it. */
    heldSymptom?: subCatDataTypes | null
}

export function AlgorithmPage({ searchInput = '', onSearchChange, searchResults, isSearching, onSearchResultClick, heldSymptom }: AlgorithmPageProps) {
    const liveSymptom = useNavigationStore((s) => s.selectedSymptom);
    const selectedSymptom = liveSymptom ?? heldSymptom ?? null;
    const isMobile = useNavigationStore((s) => s.isMobile);
    const openWriteNote = useNavigationStore((s) => s.openWriteNote);
    const navigateToAlgorithm = useNavigationStore((s) => s.navigateToAlgorithm);

    const containerRef = useRef<HTMLDivElement>(null);
    const markerRef = useRef<HTMLDivElement>(null);
    const initialScrollDone = useRef(false);
    const transitionIdRef = useRef(0);
    const pendingRevealRef = useRef<number | null>(null);
    // Also the reveal hold — new cards stay paused on their hidden frame while true
    const [isTransitioning, setIsTransitioning] = useState(false);

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
    } = useAlgorithm(algorithmOptions);


    // Screener drawer state
    const [openScreenerCardIndex, setOpenScreenerCardIndex] = useState<number | null>(null);

    // Scroll the marker into view only if it's below the fold, then release the
    // reveal hold once the scroll settles. Stale transitions (superseded by a
    // newer tap) bail so they can't release a newer hold early.
    const scrollThenReveal = useCallback((id: number) => {
        if (id !== transitionIdRef.current) return;
        const marker = markerRef.current;
        const container = containerRef.current;
        if (!marker || !container) {
            setIsTransitioning(false);
            return;
        }

        const overflow = marker.getBoundingClientRect().bottom - container.getBoundingClientRect().bottom;
        if (overflow <= 0) {
            setIsTransitioning(false);
            return;
        }

        let settled = false;
        const reveal = () => {
            if (settled) return;
            settled = true;
            container.removeEventListener('scrollend', reveal);
            clearTimeout(fallback);
            if (id === transitionIdRef.current) setIsTransitioning(false);
        };
        // scrollend isn't on older iOS Safari — the timeout covers it
        const fallback = setTimeout(reveal, ALGORITHM_TIMING.SCROLL_SETTLE_FALLBACK);
        container.addEventListener('scrollend', reveal);
        container.scrollTo({ top: container.scrollTop + overflow, behavior: 'smooth' });
    }, []);

    const releaseTransition = useCallback((id: number) => {
        if (pendingRevealRef.current !== id) return;
        pendingRevealRef.current = null;
        scrollThenReveal(id);
    }, [scrollThenReveal]);

    // Sequence: trace draws → scroll (if needed) → new card fades up.
    // Must be called in the same handler as the state change that mounts new
    // cards so the hold is on before their animation starts.
    const beginTransition = useCallback(() => {
        const id = ++transitionIdRef.current;
        pendingRevealRef.current = id;
        setIsTransitioning(true);
        setTimeout(() => releaseTransition(id), ALGORITHM_TIMING.TRACE_REVEAL_FALLBACK);
    }, [releaseTransition]);

    const handleTraceReveal = useCallback(() => {
        if (pendingRevealRef.current !== null) releaseTransition(pendingRevealRef.current);
    }, [releaseTransition]);

    const handleAnswer = useCallback((cardIndex: number, answerIndex: number) => {
        beginTransition();
        hookHandleAnswer(cardIndex, answerIndex);
    }, [beginTransition, hookHandleAnswer]);

    const handleQuestionOption = useCallback((cardIndex: number, optionIndex: number) => {
        beginTransition();
        hookHandleQuestionOption(cardIndex, optionIndex);
    }, [beginTransition, hookHandleQuestionOption]);

    // Action status wrapper — triggers animation when pending cards are revealed
    const handleActionStatus = useCallback((cardIndex: number, status: 'performed' | 'deferred-pending' | 'deferred-continue' | 'deferred-stop') => {
        beginTransition();
        setActionStatus(cardIndex, status);
    }, [beginTransition, setActionStatus]);

    // Screener handlers
    const handleOpenScreener = useCallback((cardIndex: number) => {
        setOpenScreenerCardIndex(cardIndex);
    }, []);

    const handleScreenerComplete = useCallback((screenerId: string, responses: number[], followUp?: number) => {
        if (openScreenerCardIndex !== null) {
            beginTransition();
            setScreenerResults(openScreenerCardIndex, screenerId, responses, followUp);
        }
        setOpenScreenerCardIndex(null);
    }, [openScreenerCardIndex, beginTransition, setScreenerResults]);

    const handleScreenerClose = useCallback(() => {
        setOpenScreenerCardIndex(null);
    }, []);

    // Handle expand note - opens WriteNotePage via the navigation store
    const handleExpandNote = () => {
        if (!currentDisposition || !selectedSymptom) return;

        openWriteNote({
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
            const id = transitionIdRef.current;
            setTimeout(() => scrollThenReveal(id), ALGORITHM_TIMING.INITIAL_SCROLL_DELAY);
        }
    }, [selectedSymptom?.id, algorithm, scrollThenReveal]);

    const visibleCards = getVisibleCards();
    const traceNodes: TraceNode[] = [];
    for (const card of visibleCards) {
        const question = algorithmOptions[card.index];
        if (question) traceNodes.push({ id: String(card.index), code: traceCode(question, card), rf: question.type === 'rf' });
    }
    if (currentDisposition) {
        traceNodes.push({ id: `dispo:${currentDisposition.type}:${currentDisposition.text}`, dispoType: currentDisposition.type });
    }

    // Early returns
    if (!selectedSymptom) {
        return (
            <div className="w-full h-full flex items-center justify-center px-4">
                <p className="text-[10pt] text-tertiary">No symptom selected</p>
            </div>
        );
    }
    if (!algorithm || algorithmOptions.length === 0) {
        return (
            <div className="w-full h-full flex items-center justify-center px-4">
                <p className="text-[10pt] text-tertiary">No algorithm found for "{selectedSymptom.text}"</p>
            </div>
        );
    }

    const colors = currentDisposition ? getColorClasses(currentDisposition.type) : null;

    const hasMobileSearch = isMobile && !!onSearchChange
    const hasSearch = isMobile && searchInput.trim().length > 0

    return (
        <div className="relative h-full w-full">
            <MobileSearchBar
                ref={containerRef}
                value={searchInput}
                onChange={onSearchChange ?? (() => {})}
                enabled={hasMobileSearch}
                className=""
                style={isMobile ? { paddingTop: 'calc(var(--sat, 0px) + 4rem)' } : undefined}
                dropdown={hasSearch && onSearchResultClick ? (
                    <SearchResults
                        results={searchResults ?? []}
                        searchTerm={searchInput}
                        onResultClick={onSearchResultClick}
                        isSearching={isSearching}
                    />
                ) : undefined}
            >
                    <AlgorithmTrace
                        nodes={traceNodes}
                        hold={isTransitioning}
                        onReveal={handleTraceReveal}
                        innerClassName="flex flex-col px-[46px] pt-5 pb-32 space-y-1 w-full"
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

                        {currentDisposition && colors && (
                            <div className="flex flex-col items-center">
                                <div className="h-[120px]" />
                                <div
                                    key={`dispo-${currentDisposition.type}-${currentDisposition.text}`}
                                    className="w-full animate-cardFadeUp"
                                >
                                    <div
                                        data-trace-card={`dispo:${currentDisposition.type}:${currentDisposition.text}`}
                                        className={`flex flex-col rounded-2xl w-full overflow-hidden shadow-sm
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
                                                            <p className="text-[10pt] text-secondary mt-1 wrap-break-word">
                                                                {currentDisposition.modifier}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                <ActionPill>
                                                    <button
                                                        onClick={handleExpandNote}
                                                        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 active:scale-95 transition-all ${colors.buttonClass}`}
                                                        aria-label="Continue"
                                                    >
                                                        <ChevronRight className="w-5 h-5" />
                                                    </button>
                                                </ActionPill>
                                            </div>
                                        </div>
                                    </div>
                                    {currentDisposition.screenRefs && currentDisposition.screenRefs.length > 0 && (
                                        <div className="w-full mt-2 flex flex-col">
                                            {currentDisposition.screenRefs.map((ref) => (
                                                <button
                                                    key={ref.id}
                                                    onClick={() => navigateToAlgorithm(ref.id)}
                                                    className="flex items-center gap-2 px-3 py-2 text-left active:opacity-60 transition-opacity"
                                                    aria-label={`Screen ${ref.label}`}
                                                >
                                                    <CornerDownRight className={`w-4 h-4 shrink-0 ${colors.symptomCheck}`} />
                                                    <span className="text-[10pt] text-primary wrap-break-word">{ref.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div
                            ref={markerRef}
                            className="h-2 w-full pointer-events-none"
                            aria-hidden="true"
                            style={{ marginTop: '1rem', marginBottom: '1rem' }}
                        />
                    </AlgorithmTrace>
            </MobileSearchBar>

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
