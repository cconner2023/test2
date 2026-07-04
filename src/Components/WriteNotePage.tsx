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
import { X, Plus, Check, Eye, FileText, RotateCcw } from 'lucide-react';
import { PreviewOverlay } from './PreviewOverlay';
import { ConfirmDialog } from './ConfirmDialog';
import { GUIDED_HPI_EXPANDED, GUIDED_PE_TEXT, GUIDED_PLAN_TEXT } from '../Data/GuidedTourData';
import { PdfPreviewModal } from './PdfPreviewModal';
import { ActionButton } from './ActionButton';
import { ActionPill } from './ActionPill'
import { OverlayActionMenu } from './OverlayActionMenu';
import { EmptyState } from './EmptyState';
import type { TextExpander } from '../Data/User';
import { getBlocksForFocusedExam, getCategoryFromSymptomCode } from '../Data/PhysicalExamData';
import type { CategoryLetter } from '../Data/PhysicalExamData';
import { composeAlgorithmNoteRouting } from '../Utilities/algorithmNoteRouting';
import type { PEState } from '../Types/PETypes';
import { useBetaFlag } from '../lib/betaFeatures';

type DispositionType = dispositionType['type'];

const SECTION_LABEL_CLASS = 'text-[9pt] font-semibold text-primary uppercase tracking-wider';
const CARD_CLASS = 'relative rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden';
const TEXTAREA_CLASS =
    'w-full bg-transparent px-4 py-3 text-base md:text-sm text-primary placeholder:text-tertiary ' +
    'focus:outline-none resize-none overflow-hidden min-h-[200px]';

/** Empty → overlay → populated card pattern, mirrors ProviderNote's TextSectionCard. */
function TextSectionCard({ addLabel, value, onChange, expanders, placeholder, dataTour }: {
    addLabel: string;
    value: string;
    onChange: (v: string) => void;
    expanders: TextExpander[];
    placeholder: string;
    dataTour?: string;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [anchor, setAnchor] = useState<DOMRect | null>(null);
    const cardRef = useRef<HTMLDivElement>(null);

    const openFromAnchor = (rect: DOMRect) => { setAnchor(rect); setIsOpen(true); };
    const openFromCard = () => {
        if (cardRef.current) openFromAnchor(cardRef.current.getBoundingClientRect());
    };

    return (
        <>
            {value ? (
                <div
                    ref={cardRef}
                    onClick={openFromCard}
                    data-tour={dataTour}
                    className={`${CARD_CLASS} cursor-pointer active:scale-[0.99] transition-all`}
                >
                    <div className="px-4 py-3 text-sm text-primary whitespace-pre-wrap max-h-64 overflow-y-auto">
                        {value}
                    </div>
                </div>
            ) : (
                <EmptyState
                    title={addLabel}
                    action={{
                        icon: Plus,
                        label: addLabel,
                        onClick: (a) => openFromAnchor(a.getBoundingClientRect()),
                    }}
                />
            )}
            <PreviewOverlay
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                anchorRect={anchor}
                title={addLabel}
                previewMaxHeight="50dvh"
                actions={[
                    { key: 'reset', label: 'Reset', icon: RotateCcw, onAction: () => onChange(''), closesOnAction: false },
                    { key: 'done', label: 'Done', icon: Check, onAction: () => setIsOpen(false), closesOnAction: false },
                ]}
            >
                <ExpandableInput
                    value={value}
                    onChange={onChange}
                    expanders={expanders}
                    multiline
                    hideClear
                    className={TEXTAREA_CLASS}
                    placeholder={placeholder}
                />
            </PreviewOverlay>
        </>
    );
}

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
    const [viewMode, setViewMode] = useState<'preview' | 'fullnote'>(
        () => (window.__tourNoteOverride ? 'fullnote' : 'preview')
    );
    const [includeDecisionMaking, setIncludeDecisionMaking] = useState(true);
    const [dmConfirmOpen, setDmConfirmOpen] = useState(false);

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
        assessmentNote, setAssessmentNote,
        selectedDdx, setSelectedDdx, customDdx, setCustomDdx,
        encodedValue, setEncodedValue,
        copiedTarget,
        currentPage, currentPageId, slideDirection,
        handleNext, handlePageBack,
        handleSwipeStart, handleSwipeMove, handleSwipeEnd,
        piiWarnings, pePiiWarnings, assessmentPiiWarnings, hasPII,
        handleCopy, handleShare, handleExportDD689, handleExportSF600,
        shareStatus, exportStatus, sf600ExportStatus,
        dd689Preview, downloadDD689, clearDD689Preview,
        sf600Preview, downloadSF600, clearSF600Preview,
        profile: editorProfile, authUserId,
    } = editor;

    // ── PE: seed template block keys from symptom-templated focused-exam set ──
    // Keeps symptom templating while using the Provider-primitive in-card chrome
    // (template mode shows the cycle+Plus ActionPill at top-right and drops the
    // bottom focused-mode FAB).
    const symptomCode = selectedSymptom?.icon || 'A-1';

    // Route tagged algorithm list items (questionOptions.noteTag) into HPI/PE.
    // Dev-gated (beta) while per-algorithm tagging rolls out.
    const noteRoutingEnabled = useBetaFlag('algorithmNoteRouting');
    const algoRouting = useMemo(
        () => noteRoutingEnabled
            ? composeAlgorithmNoteRouting(algorithmOptions, cardStates, selectedSymptom?.text, disposition.type, disposition.text)
            : { hpiText: '', peItems: {}, peBlockKeys: [], planText: '' },
        [noteRoutingEnabled, algorithmOptions, cardStates, selectedSymptom?.text, disposition.type, disposition.text],
    );

    const [selectedBlockKeys, setSelectedBlockKeys] = useState<string[]>(() => {
        const cat = (getCategoryFromSymptomCode(symptomCode) || 'A') as CategoryLetter;
        const templateKeys = getBlocksForFocusedExam(cat, symptomCode).blocks.map(b => b.key);
        return [...new Set([...templateKeys, ...algoRouting.peBlockKeys])];
    });
    const [pePickerSignal, setPePickerSignal] = useState(0);
    const [pePickerAnchor, setPePickerAnchor] = useState<DOMRect | null>(null);
    const peHasContent = !!peNote || selectedBlockKeys.length > 0;

    // PE seed from algorithm tags — overlays normal/abnormal findings at mount
    // (initialState is consumed once by PhysicalExam's state initializer).
    const algoPeSeed = useMemo<PEState | null>(() => {
        if (Object.keys(algoRouting.peItems).length === 0) return null;
        const cat = (getCategoryFromSymptomCode(symptomCode) || 'A') as CategoryLetter;
        return {
            categoryLetter: cat,
            laterality: 'right',
            spineRegion: 'lumbar',
            items: algoRouting.peItems,
            vitals: {},
            additional: '',
            mode: 'template',
            blockKeys: selectedBlockKeys,
        };
    }, [algoRouting.peItems, symptomCode, selectedBlockKeys]);

    // HPI seed from algorithm tags — composed narrative, only when HPI is empty
    // (non-destructive: medic edits always win). Only generates once the medic
    // opens the Full Note view — mirrors PE/Plan, which only mount in that subtree.
    const hpiSeededRef = useRef(false);
    useEffect(() => {
        if (hpiSeededRef.current || viewMode !== 'fullnote' || !algoRouting.hpiText) return;
        hpiSeededRef.current = true;
        setNote(prev => (prev ? prev : algoRouting.hpiText));
    }, [viewMode, algoRouting.hpiText, setNote]);


    // ── Plan empty-state picker signal ──────────────────────────────────────
    const [planPickerSignal, setPlanPickerSignal] = useState(0);
    const [planPickerAnchor, setPlanPickerAnchor] = useState<DOMRect | null>(null);
    // Plan seed from the active disposition's decision-making (meds + instructions).
    // Passed as Plan initialText at mount (Plan parses initialText once); planNote
    // empty → seed used, non-destructive once the medic edits (planNote wins).
    const planSeedText = planNote || algoRouting.planText;
    const planHasContent = !!planSeedText;

    // ── DDx popover state ──────────────────────────────────────────────────
    const [ddxPopoverVisible, setDdxPopoverVisible] = useState(false);
    const [ddxAnchorRect, setDdxAnchorRect] = useState<DOMRect | null>(null);

    const openDdxPopover = useCallback((e: React.MouseEvent) => {
        setDdxAnchorRect((e.currentTarget as HTMLElement).getBoundingClientRect());
        setDdxPopoverVisible(true);
    }, []);

    // ── Available DDx from algorithm context ────────────────────────────────
    const availableDdx = useMemo(() => {
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
    }, [algorithmOptions, cardStates, disposition.type, disposition.text]);

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
        const onOpenDdx = () => {
            const anchor = document.querySelector('[data-tour="writenote-ddx"]') as HTMLElement | null;
            if (anchor) setDdxAnchorRect(anchor.getBoundingClientRect());
            setDdxPopoverVisible(true);
        };
        const onCloseDdx = () => { setDdxPopoverVisible(false); };
        const onSelectDdxDemo = () => {
            const demo = availableDdx.slice(0, 2);
            if (demo.length) setSelectedDdx(demo);
        };

        window.addEventListener('tour:inject-hpi', onInjectHPI);
        window.addEventListener('tour:inject-pe', onInjectPE);
        window.addEventListener('tour:inject-plan', onInjectPlan);
        window.addEventListener('tour:open-ddx', onOpenDdx);
        window.addEventListener('tour:close-ddx', onCloseDdx);
        window.addEventListener('tour:select-ddx-demo', onSelectDdxDemo);
        return () => {
            window.removeEventListener('tour:inject-hpi', onInjectHPI);
            window.removeEventListener('tour:inject-pe', onInjectPE);
            window.removeEventListener('tour:inject-plan', onInjectPlan);
            window.removeEventListener('tour:open-ddx', onOpenDdx);
            window.removeEventListener('tour:close-ddx', onCloseDdx);
            window.removeEventListener('tour:select-ddx-demo', onSelectDdxDemo);
        };
    }, [setNote, setPeNote, setPlanNote, availableDdx, setSelectedDdx]);

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
                    <div data-tour="writenote-edit-page" className={`w-full p-4 ${currentPageId !== 'edit' ? 'hidden' : ''}`}>
                        <div className="space-y-4">
                                {/* View-mode toggle: Preview ↔ Full Note */}
                                <div data-tour="writenote-view-toggle" className="flex items-center justify-end">
                                    <ActionPill shadow="sm">
                                        <ActionButton
                                            icon={Eye}
                                            label="Preview"
                                            onClick={() => setViewMode('preview')}
                                            variant={viewMode === 'preview' ? 'success' : 'default'}
                                        />
                                        <ActionButton
                                            icon={FileText}
                                            label="Full Note"
                                            onClick={() => setViewMode('fullnote')}
                                            variant={viewMode === 'fullnote' ? 'success' : 'default'}
                                        />
                                    </ActionPill>
                                </div>

                                {viewMode === 'preview' && (
                                    <div data-tour="writenote-decision-making" className="rounded-xl border border-tertiary/15 bg-themewhite2 overflow-hidden px-2 py-2">
                                        <DecisionMaking
                                            algorithmOptions={algorithmOptions}
                                            cardStates={cardStates}
                                            disposition={disposition}
                                            dispositionType={disposition.type}
                                        />
                                    </div>
                                )}

                                {viewMode === 'fullnote' && (
                                <>
                                {/* HPI */}
                                <div className="space-y-2" data-tour="writenote-hpi">
                                    <p className={SECTION_LABEL_CLASS}>History of Present Illness</p>
                                    <TextSectionCard
                                        addLabel="Add HPI"
                                        value={note}
                                        onChange={setNote}
                                        expanders={expanders}
                                        placeholder="Chief complaint, onset, duration, character, associated symptoms..."
                                    />
                                </div>

                                {/* Physical Exam — symptom-templated, typically populated on mount */}
                                <div className="space-y-2" data-tour="writenote-pe">
                                    <p className={SECTION_LABEL_CLASS}>Physical Exam</p>
                                    <div
                                        style={peHasContent ? undefined : { display: 'none' }}
                                        aria-hidden={!peHasContent}
                                    >
                                        <PhysicalExam
                                            initialText={peNote}
                                            initialState={peState ?? algoPeSeed}
                                            onChange={setPeNote}
                                            onStateChange={setPeState}
                                            colors={colors}
                                            symptomCode={symptomCode}
                                            mode="template"
                                            templateBlockKeys={selectedBlockKeys}
                                            onBlockKeysChange={setSelectedBlockKeys}
                                            expanders={expanders}
                                            pickerOpenSignal={pePickerSignal}
                                            pickerOpenAnchor={pePickerAnchor}
                                        />
                                    </div>
                                    {!peHasContent && (
                                        <EmptyState
                                            title="Add physical exam"
                                            action={{
                                                icon: Plus,
                                                label: 'Add physical exam',
                                                onClick: (a) => {
                                                    setPePickerAnchor(a.getBoundingClientRect());
                                                    setPePickerSignal(s => s + 1);
                                                },
                                            }}
                                        />
                                    )}
                                </div>

                                {/* Assessment — free-text clinical narrative + connected differential */}
                                <div className="space-y-2" data-tour="writenote-assessment">
                                    <p className={SECTION_LABEL_CLASS}>Assessment</p>
                                    <TextSectionCard
                                        addLabel="Add assessment"
                                        value={assessmentNote}
                                        onChange={setAssessmentNote}
                                        expanders={expanders}
                                        placeholder="Clinical impression, working diagnosis, reasoning..."
                                    />

                                    {/* Differential Diagnosis (connected to the assessment) */}
                                    <div className="space-y-2 pt-1" data-tour="writenote-ddx">
                                        <p className="text-[9pt] font-semibold text-tertiary uppercase tracking-wider">Differential Diagnosis</p>
                                        {(selectedDdx.length > 0 || customDdx.length > 0) ? (
                                            <div
                                                onClick={openDdxPopover}
                                                className={`${CARD_CLASS} cursor-pointer active:scale-[0.99] transition-all`}
                                            >
                                                <div className="px-4 py-3 text-sm text-primary whitespace-pre-wrap max-h-64 overflow-y-auto">
                                                    {[...selectedDdx, ...customDdx].map((d, i) => `${i + 1}. ${d}`).join('; ')}
                                                </div>
                                            </div>
                                        ) : (
                                            <EmptyState
                                                title="Add differential"
                                                action={{
                                                    icon: Plus,
                                                    label: 'Add differential',
                                                    onClick: (a) => {
                                                        setDdxAnchorRect(a.getBoundingClientRect());
                                                        setDdxPopoverVisible(true);
                                                    },
                                                }}
                                            />
                                        )}
                                    </div>
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
                                <div className="space-y-2" data-tour="writenote-plan">
                                    <p className={SECTION_LABEL_CLASS}>Plan</p>
                                    <div
                                        style={planHasContent ? undefined : { display: 'none' }}
                                        aria-hidden={!planHasContent}
                                    >
                                        <Plan
                                            orderTags={orderTags}
                                            instructionTags={instructionTags}
                                            orderSets={orderSets}
                                            initialText={planSeedText}
                                            onChange={setPlanNote}
                                            expanders={expanders}
                                            pickerOpenSignal={planPickerSignal}
                                            pickerOpenAnchor={planPickerAnchor}
                                        />
                                    </div>
                                    {!planHasContent && (
                                        <EmptyState
                                            title="Add plan"
                                            action={{
                                                icon: Plus,
                                                label: 'Add plan',
                                                onClick: (a) => {
                                                    setPlanPickerAnchor(a.getBoundingClientRect());
                                                    setPlanPickerSignal(s => s + 1);
                                                },
                                            }}
                                        />
                                    )}
                                </div>
                                </>
                                )}

                                {/* PII warning */}
                                {hasPII && <PIIWarningBanner warnings={[...new Set([...piiWarnings, ...pePiiWarnings, ...assessmentPiiWarnings])]} />}
                            </div>
                        </div>

                    {/* Full Note */}
                    <div className={`w-full p-2 ${currentPageId !== 'fullnote' ? 'hidden' : ''}`}>
                                <div className="space-y-4 mx-2 mt-2">
                                    {hasPII && (
                                        <PIIWarningBanner warnings={[...new Set([...piiWarnings, ...pePiiWarnings, ...assessmentPiiWarnings])]} />
                                    )}
                                    {/* Note Preview */}
                                    <section data-tour="writenote-preview">
                                        <div className="pb-2 flex items-center gap-2">
                                            <p className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">Note Preview</p>
                                        </div>
                                        <div className="relative">
                                            <OverlayActionMenu
                                                shadow="sm"
                                                triggerTourTag="writenote-preview-more"
                                                items={[
                                                    { key: 'log', label: 'Log to calendar', render: () => (
                                                        <ActionIconButton
                                                            onClick={handleLog}
                                                            status={logStatus}
                                                            variant="calendar"
                                                            title="Log to calendar"
                                                            tourTag="writenote-log-calendar"
                                                        />
                                                    ) },
                                                    { key: 'copy', label: 'Copy note text', render: () => (
                                                        <ActionIconButton
                                                            onClick={() => handleCopy(previewNote, 'preview')}
                                                            status={copiedTarget === 'preview' ? 'done' : 'idle'}
                                                            variant="copy"
                                                            title="Copy note text"
                                                        />
                                                    ) },
                                                    { key: 'export', label: 'Export SF600 PDF', render: () => (
                                                        <ActionIconButton
                                                            onClick={handleExportSF600}
                                                            status={exportStatusToIconStatus(sf600ExportStatus)}
                                                            variant="pdf"
                                                            title="Export SF600 PDF"
                                                            tourTag="writenote-export-sf600"
                                                        />
                                                    ) },
                                                ]}
                                            />
                                            <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
                                                <div className="px-4 pt-3 pb-3 text-tertiary text-[9pt] whitespace-pre-wrap max-h-48 overflow-y-auto">
                                                    {previewNote || "No content selected"}
                                                </div>
                                            </div>
                                        </div>
                                    </section>

                                    {/* Encoded Note / Barcode */}
                                    <section data-tour="writenote-encoded">
                                        <div className="pb-2 flex items-center gap-2">
                                            <p className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">Encoded Note</p>
                                        </div>
                                        <div className="relative">
                                            <OverlayActionMenu
                                                shadow="sm"
                                                triggerTourTag="writenote-encoded-more"
                                                items={[
                                                    { key: 'copy', label: 'Copy encoded text', render: () => (
                                                        <ActionIconButton
                                                            onClick={() => handleCopy(encodedValue, 'encoded')}
                                                            status={copiedTarget === 'encoded' ? 'done' : 'idle'}
                                                            variant="copy"
                                                            title="Copy encoded text"
                                                        />
                                                    ) },
                                                    { key: 'share', label: 'Share note as image', render: () => (
                                                        <ActionIconButton
                                                            onClick={handleShare}
                                                            status={shareStatusToIconStatus(shareStatus)}
                                                            variant="share"
                                                            title="Share note as image"
                                                        />
                                                    ) },
                                                    { key: 'export', label: 'Export DD689 PDF', render: () => (
                                                        <ActionIconButton
                                                            onClick={handleExportDD689}
                                                            status={exportStatusToIconStatus(exportStatus)}
                                                            variant="pdf"
                                                            title="Export DD689 PDF"
                                                            tourTag="writenote-export-dd689"
                                                        />
                                                    ) },
                                                ]}
                                            />
                                            <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
                                                <div className="px-4 pt-3 pb-3">
                                                <NoteBarcodeGenerator
                                                    algorithmOptions={algorithmOptions}
                                                    cardStates={cardStates}
                                                    noteOptions={{
                                                        includeAlgorithm: true,
                                                        assessmentNote,
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
                                        </div>
                                    </section>

                            </div>
                    </div>
                </div>

                <NoteWizardFooter
                    currentPage={currentPage} visiblePages={visiblePages} slideDirection={slideDirection}
                    handleNext={() => {
                        if (currentPageId === 'edit') {
                            setDmConfirmOpen(true);
                        } else {
                            handleNext();
                        }
                    }}
                    hasPII={hasPII} colors={colors} isMobile={isMobile}
                />
                <ConfirmDialog
                    visible={dmConfirmOpen}
                    title="Include decision making in note?"
                    subtitle="Choose whether the algorithm's decision-making summary is composed into the final note."
                    variant="primary"
                    confirmLabel="Include DM"
                    cancelLabel="Exclude DM"
                    onConfirm={() => { setIncludeDecisionMaking(true); setDmConfirmOpen(false); handleNext(); }}
                    onCancel={() => { setIncludeDecisionMaking(false); setDmConfirmOpen(false); handleNext(); }}
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
