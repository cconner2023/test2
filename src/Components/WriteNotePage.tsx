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
import { BaseDrawer } from '@/Components/primitives/BaseDrawer';
import {
    ActionIconButton,
    NoteWizardFooter,
    shareStatusToIconStatus, exportStatusToIconStatus,
} from './WriteNoteHelpers';
import { ExpandableInput } from '@/Components/primitives/ExpandableInput';
import { useAlgorithmMetrics } from '../Hooks/useAlgorithmMetrics';
import { useMergedNoteContent } from '../Hooks/useMergedNoteContent';
import { X, Plus, Check, RotateCcw, ChevronRight, ClipboardList, FileText } from 'lucide-react';
import { PreviewOverlay } from './PreviewOverlay';
import { ConfirmDialog } from '@/Components/primitives/ConfirmDialog';
import { PdfPreviewModal } from './PdfPreviewModal';
import { BottomIsland } from '@/Components/primitives/BottomIsland';
import { AddFab } from '@/Components/primitives/AddFab';
import { OverlayActionMenu } from '@/Components/primitives/OverlayActionMenu';
import { EmptyState } from '@/Components/primitives/EmptyState';
import { ActionButton } from '@/Components/primitives/ActionButton';
import { FooterPill } from '@/Components/primitives/FooterPill';
import type { TextExpander } from '../Data/User';
import { getBlocksForFocusedExam, getCategoryFromSymptomCode } from '../Data/PhysicalExamData';
import type { CategoryLetter } from '../Data/PhysicalExamData';
import { composeAlgorithmNoteRouting } from '../Utilities/algorithmNoteRouting';
import type { PEState } from '../Types/PETypes';
import { useBetaFlag } from '../lib/betaFeatures';

type DispositionType = dispositionType['type'];

const SECTION_LABEL_CLASS = 'text-[9pt] font-semibold text-primary uppercase tracking-wider';
const CARD_CLASS = 'relative rounded-2xl bg-themewhite2 overflow-hidden';
const TEXTAREA_CLASS =
    'w-full bg-transparent px-4 py-3 text-base md:text-sm text-primary placeholder:text-tertiary ' +
    'focus:outline-none resize-none overflow-hidden min-h-[200px]';

/** Empty → overlay → populated card pattern, mirrors ProviderNote's TextSectionCard. */
function TextSectionCard({ addLabel, value, onChange, expanders, placeholder }: {
    addLabel: string;
    value: string;
    onChange: (v: string) => void;
    expanders: TextExpander[];
    placeholder: string;
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
                ]}
                rightFooter={
                    <FooterPill side="right">
                        <ActionButton icon={Check} label="Done" onClick={() => setIsOpen(false)} />
                    </FooterPill>
                }
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
    const [logConfirmOpen, setLogConfirmOpen] = useState(false);
    const loggedRef = useRef(false);
    const { expanders, orderTags, instructionTags, orderSets } = useMergedNoteContent();
    const colors = getColorClasses(disposition.type);
    const [viewMode, setViewMode] = useState<'preview' | 'fullnote'>('preview');
    const [includeDecisionMaking, setIncludeDecisionMaking] = useState(true);
    const [dmConfirmOpen, setDmConfirmOpen] = useState(false);

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
    // Dev-gated (beta) while per-algorithm tagging rolls out AND opt-in per medic
    // via Settings → App Content (profiles.seed_algorithm_note, default off).
    const noteRoutingEnabled = useBetaFlag('algorithmNoteRouting')
        && editorProfile?.seedAlgorithmNote === true;
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
        await logNow(selectedSymptom.icon);
    }, [logNow, selectedSymptom.icon]);

    return (
        <>
        <BaseDrawer
            isVisible={isVisible}
            onClose={() => onExpansionChange(false)}
            fullHeight="90dvh"
            mobileClassName=""
            scrollDisabled
            header={{
                title: visiblePages[currentPage]?.label ?? '',
                showBack: currentPage > 0,
                onBack: handlePageBack,
            }}
        >
            <div
                className="h-full relative flex flex-col"
                style={{ touchAction: isMobile ? 'pan-y' : 'auto' }}
                onTouchStart={isMobile ? handleSwipeStart : undefined}
                onTouchMove={isMobile ? handleSwipeMove : undefined}
                onTouchEnd={isMobile ? handleSwipeEnd : undefined}
                onTouchCancel={isMobile ? handleSwipeEnd : undefined}
            >
                <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain">
                <div className={`${slideDirection === 'left' ? 'animate-slide-in-left' : slideDirection === 'right' ? 'animate-slide-in-right' : ''}`}>
                    {/* Edit Page */}
                    <div className={`w-full px-4 pt-4 pb-32 ${currentPageId !== 'edit' ? 'hidden' : ''}`}>
                        <div className="space-y-4">
                                {viewMode === 'preview' && (
                                    <DecisionMaking
                                        algorithmOptions={algorithmOptions}
                                        cardStates={cardStates}
                                        disposition={disposition}
                                        dispositionType={disposition.type}
                                    />
                                )}

                                {viewMode === 'fullnote' && (
                                <>
                                {/* HPI */}
                                <div className="space-y-2">
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
                                <div className="space-y-2">
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
                                <div className="space-y-2">
                                    <p className={SECTION_LABEL_CLASS}>Assessment</p>
                                    <TextSectionCard
                                        addLabel="Add assessment"
                                        value={assessmentNote}
                                        onChange={setAssessmentNote}
                                        expanders={expanders}
                                        placeholder="Clinical impression, working diagnosis, reasoning..."
                                    />

                                    {/* Differential Diagnosis (connected to the assessment) */}
                                    <div className="space-y-2 pt-1">
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
                                    title="Differential Diagnosis"
                                    preview={(() => {
                                        const combined = [...selectedDdx, ...customDdx];
                                        const unselected = availableDdx.filter(d => !selectedDdx.includes(d));
                                        return (
                                            <div className="py-1.5">
                                                {combined.length > 0 && (
                                                    <div className="px-3 pb-2.5">
                                                        <p className="text-[9pt] font-semibold text-tertiary uppercase tracking-wider pb-1.5">Selected</p>
                                                        <div className="rounded-xl overflow-hidden">
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
                                                    <div>
                                                        {combined.length > 0 && (
                                                            <p className="px-3 text-[9pt] font-semibold text-tertiary uppercase tracking-wider pb-0.5">Suggested</p>
                                                        )}
                                                        <div className="px-3 pb-2 space-y-0.5">
                                                            {unselected.map(dx => (
                                                                <button
                                                                    key={dx}
                                                                    type="button"
                                                                    onClick={() => toggleDdx(dx)}
                                                                    className="flex items-center gap-2.5 w-full text-left py-1.5 px-2 rounded-lg transition-colors active:scale-[0.98] hover:bg-tertiary/5"
                                                                >
                                                                    <span className="w-4 h-4 rounded-full shrink-0 ring-[1.5px] ring-inset ring-tertiary/25 bg-transparent" />
                                                                    <span className="text-sm text-primary min-w-0 truncate">{dx}</span>
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
                                    actions={(selectedDdx.length > 0 || customDdx.length > 0) ? [{
                                        key: 'reset',
                                        label: 'Reset',
                                        icon: RotateCcw,
                                        variant: 'danger' as const,
                                        closesOnAction: false,
                                        onAction: () => { setSelectedDdx([]); setCustomDdx([]); },
                                    }] : []}
                                    onAdd={addCustomDdxItem}
                                    addPlaceholder="Add differential..."
                                    rightFooter={
                                        <FooterPill side="right">
                                            <ActionButton icon={Check} label="Done" onClick={() => setDdxPopoverVisible(false)} />
                                        </FooterPill>
                                    }
                                />

                                {/* Plan */}
                                <div className="space-y-2">
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
                    <div className={`w-full px-2 pt-2 pb-32 ${currentPageId !== 'fullnote' ? 'hidden' : ''}`}>
                                <div className="space-y-4 mx-2 mt-2">
                                    {hasPII && (
                                        <PIIWarningBanner warnings={[...new Set([...piiWarnings, ...pePiiWarnings, ...assessmentPiiWarnings])]} />
                                    )}
                                    {/* Note Preview */}
                                    <section>
                                        <div className="pb-2 flex items-center gap-2">
                                            <p className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">Note Preview</p>
                                        </div>
                                        <div className="relative">
                                            <OverlayActionMenu
                                                shadow="sm"
                                                items={[
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
                                                        />
                                                    ) },
                                                ]}
                                            />
                                            <div className="rounded-2xl bg-themewhite2 overflow-hidden">
                                                <div className="px-4 pt-3 pb-3 text-tertiary text-[9pt] whitespace-pre-wrap max-h-48 overflow-y-auto">
                                                    {previewNote || "No content selected"}
                                                </div>
                                            </div>
                                        </div>
                                    </section>

                                    {/* Encoded Note / Barcode */}
                                    <section>
                                        <div className="pb-2 flex items-center gap-2">
                                            <p className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">Encoded Note</p>
                                        </div>
                                        <div className="relative">
                                            <OverlayActionMenu
                                                shadow="sm"
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
                                                        />
                                                    ) },
                                                ]}
                                            />
                                            <div className="rounded-2xl bg-themewhite2 overflow-hidden">
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
                </div>

                {currentPageId === 'edit' ? (
                    // Edit page: view switcher + advance FAB share one bottom island
                    // (canonical BottomIsland pattern — mirrors CalendarPanel's view
                    // switcher). The FAB nests in the island's `fab` slot so tabs +
                    // FAB + glass footer read as one band, not stacked chrome.
                    <BottomIsland
                        glass
                        z="z-20"
                        ariaLabel="Note view"
                        activeId={viewMode}
                        onSelect={(id) => setViewMode(id as typeof viewMode)}
                        stops={[
                            { id: 'preview', title: 'Decision Making', icon: <ClipboardList className="w-5 h-5" /> },
                            { id: 'fullnote', title: 'Full Note', icon: <FileText className="w-5 h-5" /> },
                        ]}
                        fab={
                            <AddFab
                                onClick={() => setDmConfirmOpen(true)}
                                icon={ChevronRight}
                                label={hasPII ? 'Remove PII/PHI before continuing' : 'Next'}
                                disabled={hasPII}
                                className="absolute right-4"
                            />
                        }
                    />
                ) : (
                    // Full Note page (terminal): the Done FAB over the glass footer.
                    <NoteWizardFooter
                        currentPage={currentPage} visiblePages={visiblePages} slideDirection={slideDirection}
                        handleNext={() => setLogConfirmOpen(true)}
                        hasPII={hasPII} isMobile={isMobile}
                    />
                )}
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
                <ConfirmDialog
                    visible={logConfirmOpen}
                    title="Log training?"
                    subtitle="Records this algorithm to your training timeline — visible to supervisors. No patient details are included."
                    variant="primary"
                    confirmLabel="Log training"
                    cancelLabel="Skip"
                    onConfirm={async () => { await handleLog(); setLogConfirmOpen(false); onExpansionChange(false); }}
                    onCancel={() => { setLogConfirmOpen(false); onExpansionChange(false); }}
                />
            </div>
        </BaseDrawer>
        <PdfPreviewModal
            preview={sf600Preview ?? dd689Preview ?? null}
            generating={sf600ExportStatus === 'generating' || exportStatus === 'generating'}
            onDownload={sf600Preview ? downloadSF600 : downloadDD689}
            onClose={sf600Preview ? clearSF600Preview : clearDD689Preview}
        />
        </>
    );
};
