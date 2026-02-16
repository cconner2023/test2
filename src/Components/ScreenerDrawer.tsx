import { useState, useMemo, useCallback } from 'react';
import { BaseDrawer } from './BaseDrawer';
import type { ScreenerConfig, ScreenerWordList } from '../Types/AlgorithmTypes';
import { getScreenerMaxScore, isQuestionScored } from '../Data/SpecTesting';
import { Check } from 'lucide-react';

interface ScreenerDrawerProps {
    screenerConfig: ScreenerConfig;
    initialResponses?: number[];
    initialFollowUp?: number;
    initialCompletedId?: string;
    onComplete: (screenerId: string, responses: number[], followUp?: number) => void;
    onClose: () => void;
}

export function ScreenerDrawer({
    screenerConfig,
    initialResponses,
    initialFollowUp,
    initialCompletedId,
    onComplete,
    onClose,
}: ScreenerDrawerProps) {
    const ext = screenerConfig.conditionalExtension;
    const extendedScreener = ext?.screener;

    // Determine if we're restoring an extended (PHQ-9) state
    const restoringExtended = initialCompletedId === extendedScreener?.id;

    // Responses for the base screener questions
    const [baseResponses, setBaseResponses] = useState<(number | null)[]>(() => {
        if (restoringExtended && initialResponses) {
            // Restore the carried-over portion for base questions
            return screenerConfig.questions.map((_, i) => initialResponses[i] ?? null);
        }
        if (initialResponses && initialCompletedId === screenerConfig.id) {
            return screenerConfig.questions.map((_, i) => initialResponses[i] ?? null);
        }
        return screenerConfig.questions.map(() => null);
    });

    // Responses for extended screener questions (e.g. PHQ-9 questions 3-9)
    const [extResponses, setExtResponses] = useState<(number | null)[]>(() => {
        if (restoringExtended && initialResponses && extendedScreener && ext) {
            const extQuestions = extendedScreener.questions.slice(ext.carryOverQuestions);
            return extQuestions.map((_, i) => initialResponses[ext.carryOverQuestions + i] ?? null);
        }
        if (extendedScreener && ext) {
            return extendedScreener.questions.slice(ext.carryOverQuestions).map(() => null);
        }
        return [];
    });

    // Follow-up response (GAD-7 difficulty question)
    const [followUpIdx, setFollowUpIdx] = useState<number | null>(
        initialFollowUp !== undefined ? initialFollowUp : null
    );

    // Random word list selection (MACE 2)
    const [selectedListIdx] = useState(() => {
        if (!screenerConfig.wordLists?.length) return 0;
        return Math.floor(Math.random() * screenerConfig.wordLists.length);
    });
    const selectedList: ScreenerWordList | undefined = screenerConfig.wordLists?.[selectedListIdx];

    // Compute base score (only scored questions)
    const baseScore = useMemo(
        () => baseResponses.reduce<number>((sum, v, i) => {
            const q = screenerConfig.questions[i];
            if (!q || !isQuestionScored(q)) return sum;
            return sum + (v ?? 0);
        }, 0),
        [baseResponses, screenerConfig.questions],
    );

    // Should we show the extended screener?
    const showExtension = ext && baseScore >= ext.threshold;

    // Compute extended score (full PHQ-9 = base + extension)
    const extScore = useMemo(() => {
        if (!showExtension) return 0;
        return baseScore + extResponses.reduce<number>((sum, v) => sum + (v ?? 0), 0);
    }, [showExtension, baseScore, extResponses]);

    // Determine active screener for interpretation
    const activeScreener = showExtension && extendedScreener ? extendedScreener : screenerConfig;
    const activeScore = showExtension ? extScore : baseScore;
    const maxScore = getScreenerMaxScore(activeScreener);

    // Gate logic (MACE 2 concussion screening)
    const gate = screenerConfig.gate;
    const gateOpen = useMemo(() => {
        if (!gate) return true;
        const required = baseResponses[gate.requiredIndex] === 1;
        const anyOf = gate.anyOfIndices.some(i => baseResponses[i] === 1);
        return required && anyOf;
    }, [gate, baseResponses]);

    // Has the gate been evaluated? (required question answered)
    const gateEvaluated = !gate || baseResponses[gate.requiredIndex] !== null;

    const interpretation = useMemo(
        () => activeScreener.interpretations.find(
            interp => activeScore >= interp.minScore && activeScore <= interp.maxScore,
        )?.label ?? '',
        [activeScreener.interpretations, activeScore],
    );

    // Check if all questions are answered
    const baseComplete = baseResponses.every((v, i) => {
        const q = screenerConfig.questions[i];
        if (!q) return true;
        if (q.type === 'check' || q.type === 'info') return true;
        if (gate && !gateOpen && i >= gate.gatedFromIndex) return true;
        return v !== null;
    });
    const extComplete = !showExtension || extResponses.every(v => v !== null);
    const followUpComplete = !screenerConfig.followUp || followUpIdx !== null;
    const allComplete = baseComplete && extComplete && followUpComplete;

    const handleBaseResponse = useCallback((qIdx: number, value: number) => {
        setBaseResponses(prev => {
            const next = [...prev];
            next[qIdx] = value;
            return next;
        });
    }, []);

    const handleCheckToggle = useCallback((qIdx: number, optIdx: number) => {
        setBaseResponses(prev => {
            const next = [...prev];
            const current = next[qIdx] ?? 0;
            next[qIdx] = current ^ (1 << optIdx);
            return next;
        });
    }, []);

    const handleExtResponse = useCallback((qIdx: number, value: number) => {
        setExtResponses(prev => {
            const next = [...prev];
            next[qIdx] = value;
            return next;
        });
    }, []);

    const handleComplete = useCallback(() => {
        if (!allComplete) return;

        if (showExtension && extendedScreener && ext) {
            // Return full PHQ-9 responses (base + extension)
            const fullResponses = [
                ...baseResponses.map(v => v ?? 0),
                ...extResponses.map(v => v ?? 0),
            ];
            onComplete(extendedScreener.id, fullResponses);
        } else {
            onComplete(
                screenerConfig.id,
                baseResponses.map(v => v ?? 0),
                followUpIdx !== null ? followUpIdx : undefined,
            );
        }
    }, [allComplete, showExtension, extendedScreener, ext, baseResponses, extResponses, screenerConfig.id, followUpIdx, onComplete]);

    return (
        <BaseDrawer
            isVisible={true}
            onClose={onClose}
            header={{ title: activeScreener.title }}
            fullHeight="90dvh"
            desktopPosition="right"
        >
            <div className="h-full overflow-y-auto px-4 pb-6">
                {/* Instruction */}
                <p className="text-xs text-secondary py-3 border-b border-tertiary/10">
                    {screenerConfig.instruction}
                </p>

                {/* Score summary bar — hidden during pre-gate section for gated screeners */}
                {(!gate || gateOpen) && (
                    <div className="sticky top-0 z-10 bg-themewhite3 py-2 flex items-center justify-between border-b border-tertiary/10">
                        <div className="text-sm font-medium text-primary">
                            Score: <span className="font-bold">{activeScore}</span>
                            <span className="text-tertiary">/{maxScore}</span>
                        </div>
                        {interpretation && (
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                                (activeScreener.invertThreshold
                                    ? activeScore <= activeScreener.threshold
                                    : activeScore >= activeScreener.threshold)
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-emerald-100 text-emerald-800'
                            }`}>
                                {interpretation}
                            </span>
                        )}
                    </div>
                )}

                {/* Questions */}
                <div className="mt-3">
                    {screenerConfig.questions.map((q, qIdx) => {
                        // Hide gated questions when gate is closed
                        if (gate && !gateOpen && qIdx >= gate.gatedFromIndex) return null;

                        return (
                            <div key={qIdx}>
                                {/* Section header */}
                                {q.sectionHeader && (
                                    <div className="flex items-center gap-2 mt-4 mb-2 px-1">
                                        <div className="h-px flex-1 bg-tertiary/15" />
                                        <span className="text-[10px] font-semibold text-secondary uppercase tracking-wider">
                                            {q.sectionHeader}
                                        </span>
                                        <div className="h-px flex-1 bg-tertiary/15" />
                                    </div>
                                )}

                                {/* Info type — instructional text + optional dynamic content */}
                                {q.type === 'info' && (
                                    <div className="px-1 py-2">
                                        <p className="text-[11px] text-secondary/80 leading-relaxed">
                                            {q.text}
                                        </p>
                                        {q.dynamicContent && selectedList && (
                                            <WordListContent type={q.dynamicContent} wordList={selectedList} />
                                        )}
                                    </div>
                                )}

                                {/* Check type — multi-select chips */}
                                {q.type === 'check' && (
                                    <div className="py-2 px-1">
                                        <p className="text-xs text-primary mb-1.5">{q.text}</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {q.options?.map((opt, optIdx) => {
                                                const isSelected = ((baseResponses[qIdx] ?? 0) & (1 << optIdx)) !== 0;
                                                return (
                                                    <button
                                                        key={optIdx}
                                                        onClick={() => handleCheckToggle(qIdx, optIdx)}
                                                        className={`px-2.5 py-1.5 rounded-full text-[10px] transition-all ${
                                                            isSelected
                                                                ? 'bg-themeblue2/15 text-themeblue2 font-semibold ring-1 ring-themeblue2/30'
                                                                : 'bg-themewhite2 text-tertiary hover:bg-themewhite'
                                                        }`}
                                                    >
                                                        {isSelected && <Check size={10} className="inline mr-1" />}
                                                        {opt}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Scale type (default) — existing QuestionRow */}
                                {q.type !== 'info' && q.type !== 'check' && (
                                    <QuestionRow
                                        index={qIdx + 1}
                                        text={q.text}
                                        scaleOptions={q.scaleOptions ?? screenerConfig.scaleOptions}
                                        value={baseResponses[qIdx]}
                                        onChange={(v) => handleBaseResponse(qIdx, v)}
                                    />
                                )}

                                {/* Gate banner — rendered right after the last pre-gate question */}
                                {gate && qIdx === gate.gatedFromIndex - 1 && gateEvaluated && (
                                    <div className={`mx-1 my-3 px-3 py-2.5 rounded-md text-xs font-medium text-center ${
                                        gateOpen
                                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                                    }`}>
                                        {gateOpen ? gate.positiveMessage : gate.negativeMessage}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Conditional extension (PHQ-2 → PHQ-9) */}
                {showExtension && extendedScreener && ext && (
                    <div className="mt-4 animate-cardAppearIn">
                        <div className="flex items-center gap-2 mb-2 px-1">
                            <div className="h-px flex-1 bg-amber-300/40" />
                            <span className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider">
                                Extended to {extendedScreener.title}
                            </span>
                            <div className="h-px flex-1 bg-amber-300/40" />
                        </div>
                        <div className="space-y-1">
                            {extendedScreener.questions.slice(ext.carryOverQuestions).map((q, qIdx) => (
                                <QuestionRow
                                    key={`ext-${qIdx}`}
                                    index={ext.carryOverQuestions + qIdx + 1}
                                    text={q.text}
                                    scaleOptions={q.scaleOptions ?? extendedScreener.scaleOptions}
                                    value={extResponses[qIdx]}
                                    onChange={(v) => handleExtResponse(qIdx, v)}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Follow-up question (GAD-7 difficulty) */}
                {screenerConfig.followUp && (
                    <div className="mt-4 pt-3 border-t border-tertiary/10">
                        <p className="text-xs text-secondary mb-2">
                            {screenerConfig.followUp.text}
                        </p>
                        <div className="space-y-1.5">
                            {screenerConfig.followUp.options.map((opt, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setFollowUpIdx(idx)}
                                    className={`w-full text-left text-xs px-3 py-2 rounded-md transition-all ${
                                        followUpIdx === idx
                                            ? 'bg-themeblue2/15 text-themeblue2 font-medium'
                                            : 'bg-themewhite2 text-tertiary hover:bg-themewhite'
                                    }`}
                                >
                                    {followUpIdx === idx && <Check size={12} className="inline mr-1.5" />}
                                    {opt}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Complete button */}
                <button
                    onClick={handleComplete}
                    disabled={!allComplete}
                    className={`w-full mt-5 py-3 rounded-lg text-sm font-medium transition-all ${
                        allComplete
                            ? 'bg-themeblue2 text-white active:scale-[0.98]'
                            : 'bg-tertiary/20 text-tertiary cursor-not-allowed'
                    }`}
                >
                    Complete Screening
                </button>
            </div>
        </BaseDrawer>
    );
}

// ---------------------------------------------------------------------------
// QuestionRow — single screener question with Likert buttons
// ---------------------------------------------------------------------------

function QuestionRow({
    index,
    text,
    scaleOptions,
    value,
    onChange,
}: {
    index: number;
    text: string;
    scaleOptions: { value: number; label: string }[];
    value: number | null;
    onChange: (value: number) => void;
}) {
    return (
        <div className="py-2 px-1">
            <p className="text-xs text-primary mb-1.5">
                <span className="text-tertiary mr-1">{index}.</span>
                {text}
            </p>
            <div className="flex gap-1">
                {scaleOptions.map((opt) => (
                    <button
                        key={opt.value}
                        onClick={() => onChange(opt.value)}
                        className={`flex-1 py-1.5 rounded text-[10px] leading-tight text-center transition-all ${
                            value === opt.value
                                ? 'bg-themeblue2/15 text-themeblue2 font-semibold ring-1 ring-themeblue2/30'
                                : 'bg-themewhite2 text-tertiary hover:bg-themewhite'
                        }`}
                        title={opt.label}
                    >
                        <div className="font-bold">{opt.value}</div>
                        <div className="hidden sm:block mt-0.5 leading-[1.1] px-0.5">{opt.label}</div>
                    </button>
                ))}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// WordListContent — renders dynamic word list / digit string content
// ---------------------------------------------------------------------------

function WordListContent({ type, wordList }: { type: string; wordList: ScreenerWordList }) {
    if (type === 'wordList') {
        return (
            <div className="mt-2 px-2.5 py-2 bg-themewhite2 rounded-md border border-tertiary/10">
                <p className="text-[11px] font-semibold text-primary mb-1.5">
                    List {wordList.name}
                </p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                    {wordList.words.map((w, i) => (
                        <span key={i} className="px-2 py-0.5 bg-themeblue2/10 text-themeblue2 text-[11px] font-medium rounded">
                            {w}
                        </span>
                    ))}
                </div>
                <div className="space-y-1.5 text-[10px] text-tertiary">
                    <p>
                        <span className="font-semibold text-secondary">Trial 1:</span>{' '}
                        "I am going to test your memory. I will read you a list of words and when I am done, repeat back as many words as you can remember, in any order."
                    </p>
                    <p>
                        <span className="font-semibold text-secondary">Trials 2 & 3:</span>{' '}
                        "I am going to repeat that list again. Repeat back as many words as you can remember, in any order, even if you said them before."
                    </p>
                </div>
            </div>
        );
    }
    if (type === 'digitStrings') {
        return (
            <div className="mt-2 px-2.5 py-2 bg-themewhite2 rounded-md border border-tertiary/10">
                <p className="text-[11px] font-semibold text-primary mb-1">
                    List {wordList.name} — Reverse Digits
                </p>
                <p className="text-[10px] text-tertiary mb-2">
                    "I am going to read you a string of numbers. When I am finished, repeat them back to me backward, in reverse order."
                </p>
                <div className="space-y-1">
                    {wordList.digits.trial1.map((d, i) => (
                        <div key={i} className="flex items-center gap-2 text-[10px]">
                            <span className="text-tertiary w-14 shrink-0">{d.split('-').length} digits:</span>
                            <span className="text-primary font-mono font-medium">T1: {d}</span>
                            <span className="text-secondary font-mono">T2: {wordList.digits.trial2[i]}</span>
                        </div>
                    ))}
                </div>
                <p className="text-[10px] text-tertiary mt-2">
                    If correct on Trial 1, proceed to next length. If incorrect, try Trial 2 at same length. If both incorrect, stop and record score.
                </p>
            </div>
        );
    }
    if (type === 'recallWords') {
        return (
            <div className="mt-2 px-2.5 py-2 bg-themewhite2 rounded-md border border-tertiary/10">
                <p className="text-[11px] font-semibold text-primary mb-1.5">
                    List {wordList.name}
                </p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                    {wordList.words.map((w, i) => (
                        <span key={i} className="px-2 py-0.5 bg-themeblue2/10 text-themeblue2 text-[11px] font-medium rounded">
                            {w}
                        </span>
                    ))}
                </div>
                <p className="text-[10px] text-tertiary">
                    "Do you remember that list of words I read a few minutes earlier? Tell me as many words from that list as you can remember, in any order."
                </p>
            </div>
        );
    }
    return null;
}
