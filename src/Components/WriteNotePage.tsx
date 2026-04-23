import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import type { dispositionType, AlgorithmOptions } from '../Types/AlgorithmTypes';
import type { CardState } from '../Hooks/useAlgorithm';
import { useNoteEditor } from '../Hooks/useNoteEditor';
import { useUserProfile } from '../Hooks/useUserProfile';
import { getColorClasses } from '../Utilities/ColorUtilities';
import { PIIWarningBanner } from './PIIWarningBanner';
import { NoteBarcodeGenerator } from './Barcode';
import { DecisionMaking } from './DecisionMaking';
import { PhysicalExam } from './PhysicalExam';
import { Plan } from './Plan';
import { BaseDrawer } from './BaseDrawer';
import {
    ActionIconButton,
    NoteWizardFooter,
    shareStatusToIconStatus, exportStatusToIconStatus,
} from './WriteNoteHelpers';
import { ExpandableInput } from './ExpandableInput';
import { useAlgorithmMetrics } from '../Hooks/useAlgorithmMetrics';
import { useMergedNoteContent } from '../Hooks/useMergedNoteContent';
import { X, Plus, Check } from 'lucide-react';
import { PreviewOverlay } from './PreviewOverlay';
import { GUIDED_HPI_EXPANDED, GUIDED_PE_TEXT, GUIDED_PLAN_TEXT } from '../Data/GuidedTourData';
import { PdfPreviewModal } from './PdfPreviewModal';

type DispositionType = dispositionType['type'];

interface SectionToggleProps {
    label: string;
    enabled: boolean;
    onToggle: () => void;
    colors: ReturnType<typeof getColorClasses>;
}

const SectionToggle = ({ label, enabled, onToggle, colors }: SectionToggleProps) => (
    <div className="flex items-center justify-between py-1">
        <p className="text-[10pt] font-semibold text-primary uppercase tracking-wider">{label}</p>
        <button
            type="button"
            onClick={onToggle}
            className={`relative w-9 h-5 rounded-full transition-colors ${enabled ? colors.sliderClass : 'bg-tertiary/25'}`}
        >
            <div className={`absolute top-[2px] w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${enabled ? 'translate-x-[18px]' : 'translate-x-[2px]'}`} />
        </button>
    </div>
);

type PageId = 'edit' | 'fullnote';

interface WriteNoteProps {
    isVisible: boolean;
    disposition: {
        type: DispositionType;
        text: string;
        addendum?: string;
    };
    algorithmOptions?: AlgorithmOptions[];
    cardStates?: CardState[];
    onExpansionChange: (expanded: boolean) => void;
    selectedSymptom?: {
        icon: string;
        text: string;
    };
    isMobile?: boolean;
    initialPage?: number;
}

export const WriteNotePage = ({
    isVisible,
    disposition,
    algorithmOptions = [],
    cardStates = [],
    onExpansionChange,
    selectedSymptom = { icon: '', text: '' },
    isMobile = false,
    initialPage = 0,
}: WriteNoteProps) => {
    const { profile } = useUserProfile();
    const { logNow } = useAlgorithmMetrics();
    const [logStatus, setLogStatus] = useState<'idle' | 'done'>('idle');
    const loggedRef = useRef(false);
    const { expanders, orderTags, instructionTags, orderSets } = useMergedNoteContent();
    const colors = getColorClasses(disposition.type);
    const [includeDecisionMaking, setIncludeDecisionMaking] = useState(true);
    const [includeFullNote, setIncludeFullNote] = useState(false);

    // Tour override: clean up global flag on restore/unmount
    useEffect(() => {
        const onRestore = () => { window.__tourNoteOverride = false; };
        window.addEventListener('tour:restore-note-sections', onRestore);
        return () => {
            window.removeEventListener('tour:restore-note-sections', onRestore);
            window.__tourNoteOverride = false;
        };
    }, []);

    const visiblePages = useMemo(() => [
        { id: 'edit' as const, label: 'Write Note' },
        { id: 'fullnote' as const, label: 'Full Note' },
    ], []);

    const editor = useNoteEditor({
        algorithmOptions,
        cardStates,
        includeAlgorithm: true,
        includeDecisionMaking,
        dispositionType: disposition.type,
        dispositionText: disposition.text,
        selectedSymptom,
        visiblePages,
        isMobile,
        initialPage,
        colors,
    });

    const {
        note, setNote, previewNote,
        peNote, setPeNote,
        peState, setPeState,
        planNote, setPlanNote,
        selectedDdx, setSelectedDdx, customDdx, setCustomDdx,
        encodedValue, setEncodedValue,
        copiedTarget,
        currentPage, currentPageId, slideDirection,
        handleNext, handlePageBack,
        handleSwipeStart, handleSwipeMove, handleSwipeEnd,
        piiWarnings, pePiiWarnings, hasPII,
        handleCopy, handleShare, handleExportDD689, handleExportSF600,
        shareStatus, exportStatus, sf600ExportStatus,
        dd689Preview, downloadDD689, clearDD689Preview,
        sf600Preview, downloadSF600, clearSF600Preview,
        profile: editorProfile, authUserId,
    } = editor;

    // ── DDx popover state ──────────────────────────────────────────────────
    const [ddxPopoverVisible, setDdxPopoverVisible] = useState(false);
    const [ddxAnchorRect, setDdxAnchorRect] = useState<DOMRect | null>(null);

    const openDdxPopover = useCallback((e: React.MouseEvent) => {
        setDdxAnchorRect((e.currentTarget as HTMLElement).getBoundingClientRect());
        setDdxPopoverVisible(true);
    }, []);

    // ── Available DDx from algorithm context ────────────────────────────────
    const availableDdx = useMemo(() => {
        if (!includeDecisionMaking) return [];
        const ddxSet = new Set<string>();
        for (let i = cardStates.length - 1; i >= 0; i--) {
            const card = cardStates[i];
            const algoCard = algorithmOptions[i];
            if (!card || !algoCard || !card.isVisible) continue;
            const selectedAnswer = algoCard.answerOptions.find(a => a.text === card.answer?.text);
            const selectAllAnswer = card.selectedOptions?.length > 0
                ? algoCard.answerOptions.find(a => a.selectAll)
                : null;
            const answerToCheck = selectedAnswer || selectAllAnswer;
            if (answerToCheck?.disposition?.some(d => d.type === disposition.type && d.text === disposition.text)) {
                for (const dm of answerToCheck.decisionMaking || []) {
                    if (dm.ddx) dm.ddx.forEach(d => ddxSet.add(d));
                }
            }
        }
        return Array.from(ddxSet);
    }, [includeDecisionMaking, algorithmOptions, cardStates, disposition.type, disposition.text]);

    const toggleDdx = useCallback((dx: string) => {
        if (availableDdx.includes(dx)) {
            const isSelected = selectedDdx.includes(dx);
            setSelectedDdx(isSelected ? selectedDdx.filter(d => d !== dx) : [...selectedDdx, dx]);
        } else {
            setCustomDdx(customDdx.filter(d => d !== dx));
        }
    }, [availableDdx, selectedDdx, customDdx, setSelectedDdx, setCustomDdx]);

    const addCustomDdxItem = useCallback((value: string) => {
        if (!selectedDdx.includes(value) && !customDdx.includes(value)) {
            setCustomDdx([...customDdx, value]);
        }
    }, [selectedDdx, customDdx, setCustomDdx]);

    const handleLog = useCallback(async () => {
        if (loggedRef.current) return;
        loggedRef.current = true;
        await logNow(selectedSymptom.icon, selectedSymptom.text);
        setLogStatus('done');
    }, [logNow, selectedSymptom.icon, selectedSymptom.text]);

    // ── Tour injection listeners ────────────────────────────────────────────
    useEffect(() => {
        const onInjectHPI = () => { setNote(GUIDED_HPI_EXPANDED); };
        const onInjectPE = () => { setPeNote(GUIDED_PE_TEXT); };
        const onInjectPlan = () => { setPlanNote(GUIDED_PLAN_TEXT); };

        window.addEventListener('tour:inject-hpi', onInjectHPI);
        window.addEventListener('tour:inject-pe', onInjectPE);
        window.addEventListener('tour:inject-plan', onInjectPlan);
        return () => {
            window.removeEventListener('tour:inject-hpi', onInjectHPI);
            window.removeEventListener('tour:inject-pe', onInjectPE);
            window.removeEventListener('tour:inject-plan', onInjectPlan);
        };
    }, [setNote, setPeNote, setPlanNote]);

    return (
        <>
        <BaseDrawer
            isVisible={isVisible}
            onClose={() => onExpansionChange(false)}
            fullHeight="90dvh"
            mobileClassName=""
            header={{
                title: visiblePages[currentPage]?.label ?? '',
                showBack: currentPage > 0,
                onBack: handlePageBack,
            }}
        >
            <div
                className="flex flex-col min-h-full"
                style={{ touchAction: isMobile ? 'pan-y' : 'auto' }}
                onTouchStart={isMobile ? handleSwipeStart : undefined}
                onTouchMove={isMobile ? handleSwipeMove : undefined}
                onTouchEnd={isMobile ? handleSwipeEnd : undefined}
                onTouchCancel={isMobile ? handleSwipeEnd : undefined}
            >
                <div className={`flex-1 ${slideDirection === 'left' ? 'animate-slide-in-left' : slideDirection === 'right' ? 'animate-slide-in-right' : ''}`}>
                    {/* Edit Page */}
                    <div data-tour="writenote-hpi" className={`w-full p-4 ${currentPageId !== 'edit' ? 'hidden' : ''}`}>
                        <div className="space-y-4">
                                {/* Full Note toggle */}
                                <SectionToggle
                                    label="Full Note"
                                    enabled={includeFullNote}
                                    onToggle={() => setIncludeFullNote(v => !v)}
                                    colors={colors}
                                />

                                {includeFullNote && (
                                <>
                                {/* Subjective section */}
                                <section className="space-y-2">
                                    <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider">Subjective</p>
                                    <ExpandableInput
                                        value={note}
                                        onChange={setNote}
                                        expanders={expanders}
                                        multiline
                                        className="w-full rounded-xl border border-themegray1/20 bg-themewhite p-3 text-sm text-primary placeholder:text-tertiary focus:border-themeblue1/30 focus:outline-none resize-none transition-colors leading-6"
                                        placeholder="History of present illness..."
                                    />
                                </section>

                                {/* PE section */}
                                <section data-tour="writenote-pe" className="space-y-2">
                                    <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider">Physical Exam</p>
                                    <PhysicalExam
                                        initialText={peNote}
                                        onChange={setPeNote}
                                        onStateChange={setPeState}
                                        colors={colors}
                                        symptomCode={selectedSymptom?.icon || 'A-1'}
                                        expanders={expanders}
                                    />
                                </section>
                                </>
                                )}

                                {/* Decision Making toggle */}
                                <SectionToggle
                                    label="Decision Making"
                                    enabled={includeDecisionMaking}
                                    onToggle={() => setIncludeDecisionMaking(v => !v)}
                                    colors={colors}
                                />

                                {includeDecisionMaking && (
                                    <div className="rounded-xl border border-tertiary/15 bg-themewhite2 overflow-hidden px-2 py-2">
                                        <DecisionMaking
                                            algorithmOptions={algorithmOptions}
                                            cardStates={cardStates}
                                            disposition={disposition}
                                            dispositionType={disposition.type}
                                        />
                                    </div>
                                )}

                                {includeFullNote && (
                                <>
                                {/* Differential Diagnoses */}
                                <div className="space-y-2 pt-1">
                                    {(selectedDdx.length > 0 || customDdx.length > 0) ? (
                                        <div
                                            className="rounded-xl bg-themewhite2 overflow-hidden cursor-pointer active:scale-[0.98] transition-all"
                                            onClick={openDdxPopover}
                                        >
                                            <div className="px-4 py-3">
                                                <p className="text-[9pt] text-primary truncate">
                                                    {[...selectedDdx, ...customDdx].map((d, i) => `${i + 1}. ${d}`).join('; ')}
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex justify-center py-2">
                                            <button
                                                type="button"
                                                onClick={openDdxPopover}
                                                className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition-all bg-tertiary/8 border border-dashed border-tertiary/20 text-tertiary"
                                            >
                                                <Plus size={14} />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <PreviewOverlay
                                    isOpen={ddxPopoverVisible}
                                    onClose={() => setDdxPopoverVisible(false)}
                                    anchorRect={ddxAnchorRect}
                                    maxWidth={340}
                                    preview={(() => {
                                        const combined = [...selectedDdx, ...customDdx];
                                        const unselected = availableDdx.filter(d => !selectedDdx.includes(d));
                                        return (
                                            <div className="py-1">
                                                {combined.length > 0 && (
                                                    <div className="px-4 pb-2 pt-1">
                                                        <div className="border border-tertiary/10 rounded-xl overflow-hidden">
                                                            {combined.map((dx, i) => (
                                                                <div
                                                                    key={dx}
                                                                    className={`flex items-center gap-2 px-3 py-2.5 bg-tertiary/4 ${i > 0 ? 'border-t border-tertiary/10' : ''}`}
                                                                >
                                                                    <span className="text-[9pt] text-tertiary w-4 text-right shrink-0">{i + 1}.</span>
                                                                    <span className="flex-1 text-[11pt] text-primary min-w-0 truncate">{dx}</span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => toggleDdx(dx)}
                                                                        className="shrink-0 p-1 text-tertiary active:text-themeredred transition-colors"
                                                                    >
                                                                        <X size={12} />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {unselected.length > 0 && (
                                                    <div className="px-4 pb-2">
                                                        <p className="text-[9pt] md:text-[9pt] font-semibold text-tertiary uppercase tracking-wider mb-1.5">Suggested</p>
                                                        <div className="border border-tertiary/10 rounded-xl overflow-hidden">
                                                            {unselected.map((dx, i) => (
                                                                <button
                                                                    key={dx}
                                                                    type="button"
                                                                    onClick={() => toggleDdx(dx)}
                                                                    className={`flex items-center gap-3 w-full text-left px-4 py-2.5 transition-colors active:scale-[0.98] ${i > 0 ? 'border-t border-tertiary/10' : ''}`}
                                                                >
                                                                    <span className="w-4 h-4 rounded-full shrink-0 ring-[1.5px] ring-inset ring-tertiary/25 bg-transparent" />
                                                                    <span className="text-[11pt] text-tertiary">{dx}</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {combined.length === 0 && unselected.length === 0 && (
                                                    <p className="px-4 py-4 text-[10pt] text-tertiary italic">No differentials — use + to add</p>
                                                )}
                                            </div>
                                        );
                                    })()}
                                    actions={[{
                                        key: 'done',
                                        label: 'Done',
                                        icon: Check,
                                        onAction: () => setDdxPopoverVisible(false),
                                    }]}
                                    onAdd={addCustomDdxItem}
                                    addPlaceholder="Add differential..."
                                />

                                {/* Plan */}
                                <section data-tour="writenote-plan" className="space-y-2">
                                    <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider">Plan</p>
                                    <Plan
                                        orderTags={orderTags}
                                        instructionTags={instructionTags}
                                        orderSets={orderSets}
                                        initialText={planNote}
                                        onChange={setPlanNote}
                                        expanders={expanders}
                                    />
                                </section>
                                </>
                                )}

                                {/* PII warning */}
                                {hasPII && <PIIWarningBanner warnings={[...new Set([...piiWarnings, ...pePiiWarnings])]} />}
                            </div>
                        </div>

                    {/* Full Note */}
                    <div className={`w-full p-2 ${currentPageId !== 'fullnote' ? 'hidden' : ''}`}>
                                <div className="space-y-4 mx-2 mt-2">
                                    {hasPII && (
                                        <PIIWarningBanner warnings={[...new Set([...piiWarnings, ...pePiiWarnings])]} />
                                    )}
                                    {/* Note Preview */}
                                    <section data-tour="writenote-preview">
                                        <div className="pb-2 flex items-center justify-between">
                                            <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider">Note Preview</p>
                                            <div className="flex items-center gap-1 px-1.5 py-1.5 rounded-2xl bg-themewhite shadow-lg border border-tertiary/15">
                                                <ActionIconButton
                                                    onClick={handleLog}
                                                    status={logStatus}
                                                    variant="calendar"
                                                    title="Log to calendar"
                                                />
                                                <ActionIconButton
                                                    onClick={() => handleCopy(previewNote, 'preview')}
                                                    status={copiedTarget === 'preview' ? 'done' : 'idle'}
                                                    variant="copy"
                                                    title="Copy note text"
                                                />
                                                <ActionIconButton
                                                    onClick={handleExportSF600}
                                                    status={exportStatusToIconStatus(sf600ExportStatus)}
                                                    variant="pdf"
                                                    title="Export SF600 PDF"
                                                />
                                            </div>
                                        </div>
                                        <div className="rounded-xl bg-themewhite2 overflow-hidden">
                                            <div className="px-4 py-3 text-tertiary text-[9pt] whitespace-pre-wrap max-h-48 overflow-y-auto">
                                                {previewNote || "No content selected"}
                                            </div>
                                        </div>
                                    </section>

                                    {/* Encoded Note / Barcode */}
                                    <section data-tour="writenote-encoded">
                                        <div className="pb-2 flex items-center justify-between">
                                            <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider">Encoded Note</p>
                                            <div className="flex items-center gap-1 px-1.5 py-1.5 rounded-2xl bg-themewhite shadow-lg border border-tertiary/15">
                                                <ActionIconButton
                                                    onClick={() => handleCopy(encodedValue, 'encoded')}
                                                    status={copiedTarget === 'encoded' ? 'done' : 'idle'}
                                                    variant="copy"
                                                    title="Copy encoded text"
                                                />
                                                <ActionIconButton
                                                    onClick={handleShare}
                                                    status={shareStatusToIconStatus(shareStatus)}
                                                    variant="share"
                                                    title="Share note as image"
                                                />
                                                <ActionIconButton
                                                    onClick={handleExportDD689}
                                                    status={exportStatusToIconStatus(exportStatus)}
                                                    variant="pdf"
                                                    title="Export DD689 PDF"
                                                />
                                            </div>
                                        </div>
                                        <div className="rounded-xl bg-themewhite2 overflow-hidden">
                                            <div className="px-4 py-3">
                                                <NoteBarcodeGenerator
                                                    algorithmOptions={algorithmOptions}
                                                    cardStates={cardStates}
                                                    noteOptions={{
                                                        includeAlgorithm: true,
                                                        selectedDdx,
                                                        customDdx,
                                                        customNote: note,
                                                        physicalExamNote: peNote,
                                                        peState: peState ?? undefined,
                                                        planNote,
                                                        user: profile,
                                                        userId: authUserId,
                                                    }}
                                                    symptomCode={selectedSymptom?.icon?.replace('-', '') || 'A1'}
                                                    onEncodedValueChange={setEncodedValue}
                                                    layout={encodedValue.length > 300 ? 'col' : 'row'}
                                                />
                                            </div>
                                        </div>
                                    </section>

                            </div>
                    </div>
                </div>

                <NoteWizardFooter
                    currentPage={currentPage} visiblePages={visiblePages} slideDirection={slideDirection}
                    handleNext={handleNext} hasPII={hasPII} colors={colors} isMobile={isMobile}
                />
            </div>
        </BaseDrawer>
        <PdfPreviewModal
            preview={sf600Preview ?? dd689Preview ?? null}
            onDownload={sf600Preview ? downloadSF600 : downloadDD689}
            onClose={sf600Preview ? clearSF600Preview : clearDD689Preview}
        />
        </>
    );
};
