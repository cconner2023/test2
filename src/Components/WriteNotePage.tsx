import { useState, useMemo, useEffect, useCallback, useRef, type MouseEvent } from 'react';
import type { dispositionType, AlgorithmOptions } from '../Types/AlgorithmTypes';
import type { CardState } from '../Hooks/useAlgorithm';
import { useNoteEditor } from '../Hooks/useNoteEditor';
import { useUserProfile } from '../Hooks/useUserProfile';
import { getColorClasses } from '../Utilities/ColorUtilities';
import { NoteBarcodeGenerator } from './Barcode';
import { DecisionMaking } from './DecisionMaking';
import { BaseDrawer } from '@/Components/primitives/BaseDrawer';
import { NoteWizardFooter } from './WriteNoteHelpers';
import { useAlgorithmMetrics } from '../Hooks/useAlgorithmMetrics';
import { useMergedNoteContent } from '../Hooks/useMergedNoteContent';
import { X, Plus, Check, RotateCcw, ChevronRight, ClipboardList, FileText, Save, GraduationCap } from 'lucide-react';
import { ConfirmDialog } from '@/Components/primitives/ConfirmDialog';
import { PdfPreviewModal } from './PdfPreviewModal';
import { PatientIdPopover, type PatientIdForm } from './PatientIdPopover';
import { BottomIsland } from '@/Components/primitives/BottomIsland';
import { AddFab } from '@/Components/primitives/AddFab';
import { NoteOutputSections, noteExportOptions } from './NoteOutputSections';
import { isEncryptedBarcode, decryptBarcode } from '../Utilities/NoteCodec';
import { emitErrorToast } from '../lib/errorFeedback';
import { useAuthStore } from '../stores/useAuthStore';
import { EmptyState } from '@/Components/primitives/EmptyState';
import { ActionButton } from '@/Components/primitives/ActionButton';
import { FooterPill } from '@/Components/primitives/FooterPill';
import { getBlocksForFocusedExam, getCategoryFromSymptomCode } from '../Data/PhysicalExamData';
import type { CategoryLetter } from '../Data/PhysicalExamData';
import { composeAlgorithmNoteRouting } from '../Utilities/algorithmNoteRouting';
import type { PEState } from '../Types/PETypes';
import { useBetaFlag } from '../lib/betaFeatures';
import { ActionSheet, type ActionSheetOption } from '@/Components/primitives/ActionSheet';
import { useSavedNotesStore } from '../stores/useSavedNotesStore';
import { SAVED_NOTES_CAP } from '../lib/savedNotesDb';
import { emitCopied } from '../lib/copyFeedback';
import { useNavigationStore, type RestoredNote } from '../stores/useNavigationStore';
import { PaneCard } from '@/Components/primitives/PaneCard';
import { StackSheet } from '@/Components/primitives/PaneStack';
import { useStack } from '@/Components/primitives/useStack';
import { PillButton } from '@/Components/primitives/HeaderPill';
import { TextInput } from '@/Components/primitives/FormInputs';
import { type StackScreen } from './stackNav';
import { useEscBackout } from '../Hooks/useEscBackout';
import { TextSectionEditor } from './Provider/ProviderPaneSections';
import { usePEPaneScreens, PECenter, makeTemplatePEState, defaultItemState } from './Provider/ProviderPESections';
import { usePlanPaneScreens } from './Provider/ProviderPlanSections';
import { generatePEText, parsePEText } from './PhysicalExam';
import { parsePlanState } from './Plan';
import type { PlanState } from '../Types/PlanTypes';
import { NoteHistorySection, historyPaneScreen } from './NoteHistorySection';

const SECTION_LABEL_CLASS = 'text-[9pt] font-semibold text-primary uppercase tracking-wider';
const CARD_CLASS = 'relative rounded-2xl bg-themewhite2 overflow-hidden';

/** Empty → populated card; a tap opens the section in the pane / sheet. */
function TextSectionCard({ addLabel, value, onOpen }: {
    addLabel: string;
    value: string;
    onOpen: () => void;
}) {
    return value ? (
        <div
            onClick={onOpen}
            className={`${CARD_CLASS} cursor-pointer active:scale-[0.99] transition-all`}
        >
            <div className="px-4 py-3 text-sm text-primary whitespace-pre-wrap max-h-64 overflow-y-auto">
                {value}
            </div>
        </div>
    ) : (
        <EmptyState
            title={addLabel}
            action={{ icon: Plus, label: addLabel, onClick: () => onOpen() }}
        />
    );
}


type PageId = 'edit' | 'fullnote';

interface WriteNoteProps {
    isVisible: boolean;
    // The algorithm's live disposition object — carries modifier/planInstructions
    // the note composer reads, not just the type/text pair the header shows.
    disposition: dispositionType & { addendum?: string };
    algorithmOptions?: AlgorithmOptions[];
    cardStates?: CardState[];
    onExpansionChange: (expanded: boolean) => void;
    selectedSymptom?: {
        icon: string;
        text: string;
    };
    isMobile?: boolean;
    initialPage?: number;
    /** Reopened My Notes entry — seeds the editor and opens on Full Note. */
    restore?: RestoredNote;
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
    restore,
}: WriteNoteProps) => {
    const { profile } = useUserProfile();
    const { logNow } = useAlgorithmMetrics();
    const [finishOpen, setFinishOpen] = useState(false);
    const [finishAnchor, setFinishAnchor] = useState<DOMRect | null>(null);
    const [logged, setLogged] = useState(false);
    const savedNotes = useSavedNotesStore(s => s.notes);
    const saveNote = useSavedNotesStore(s => s.save);
    const isProviderRole = useAuthStore(s => s.isProviderRole);
    const openProviderNote = useNavigationStore(s => s.openProviderNote);
    // My Notes entry this session writes to — the reopened one, or the first save.
    const savedIdRef = useRef(restore?.savedNoteId);
    const { orderTags, instructionTags, orderSets } = useMergedNoteContent();
    const colors = getColorClasses(disposition.type);
    const [viewMode, setViewMode] = useState<'preview' | 'fullnote'>(restore ? 'fullnote' : 'preview');
    const [includeDecisionMaking, setIncludeDecisionMaking] = useState(restore?.includeDecisionMaking ?? true);
    const [dmConfirmOpen, setDmConfirmOpen] = useState(false);
    const [patientGate, setPatientGate] = useState<PatientIdForm | null>(null);

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
        restore,
    });

    const {
        note, setNote, previewNote,
        peNote, setPeNote,
        peState, setPeState,
        planNote, setPlanNote,
        assessmentNote, setAssessmentNote,
        history, setHistory,
        selectedDdx, setSelectedDdx, customDdx, setCustomDdx,
        encodedValue, setEncodedValue,
        currentPage, currentPageId, slideDirection,
        handleNext, handlePageBack,
        handleSwipeStart, handleSwipeMove, handleSwipeEnd,
        handleCopy, handleShare, handleExportDD689, handleExportSF600,
        exportStatus, sf600ExportStatus,
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
            ? composeAlgorithmNoteRouting(algorithmOptions, cardStates, selectedSymptom?.text, disposition)
            : { hpiText: '', peItems: {}, peBlockKeys: [], planText: '', assessmentText: '' },
        [noteRoutingEnabled, algorithmOptions, cardStates, selectedSymptom?.text, disposition],
    );

    const [selectedBlockKeys, setSelectedBlockKeys] = useState<string[]>(() => {
        if (restore) return restore.peState?.blockKeys ?? [];
        const cat = (getCategoryFromSymptomCode(symptomCode) || 'A') as CategoryLetter;
        const templateKeys = getBlocksForFocusedExam(cat, symptomCode).blocks.map(b => b.key);
        return [...new Set([...templateKeys, ...algoRouting.peBlockKeys])];
    });

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
    const hpiSeededRef = useRef(!!restore);
    useEffect(() => {
        if (hpiSeededRef.current || viewMode !== 'fullnote' || !algoRouting.hpiText) return;
        hpiSeededRef.current = true;
        setNote(prev => (prev ? prev : algoRouting.hpiText));
    }, [viewMode, algoRouting.hpiText, setNote]);

    // Assessment seed — test results the algorithm recorded (answer noteResult).
    // Same one-time, non-destructive contract as the HPI seed.
    const assessmentSeededRef = useRef(!!restore);
    useEffect(() => {
        if (assessmentSeededRef.current || viewMode !== 'fullnote' || !algoRouting.assessmentText) return;
        assessmentSeededRef.current = true;
        setAssessmentNote(prev => (prev ? prev : algoRouting.assessmentText));
    }, [viewMode, algoRouting.assessmentText, setAssessmentNote]);


    // Plan seed from the active disposition's decision-making (meds + instructions);
    // planNote wins once the medic edits.
    const planSeedText = planNote || (restore ? '' : algoRouting.planText);


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

    // A single available differential is the algorithm's answer, not a choice —
    // select it rather than making the medic tick the only box.
    const ddxSeededRef = useRef(!!restore);
    useEffect(() => {
        if (ddxSeededRef.current || !noteRoutingEnabled || viewMode !== 'fullnote') return;
        if (availableDdx.length !== 1) return;
        ddxSeededRef.current = true;
        setSelectedDdx(prev => (prev.length > 0 ? prev : availableDdx));
    }, [noteRoutingEnabled, viewMode, availableDdx, setSelectedDdx]);

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

    // ── Section editors: PaneCard on desktop, Sheet on mobile (ProviderDrawer parity) ──
    const [paneScreen, setPaneScreen] = useState<{ key: string; params?: unknown } | null>(null);
    const closePane = useCallback(() => setPaneScreen(null), []);
    const paneVisible = isVisible && paneScreen !== null
        && currentPageId === 'edit' && viewMode === 'fullnote';
    useEscBackout(!isMobile && paneVisible, closePane);
    useEffect(() => {
        if (!isVisible || currentPageId !== 'edit' || viewMode !== 'fullnote') setPaneScreen(null);
    }, [isVisible, currentPageId, viewMode]);

    const [planState, setPlanState] = useState<PlanState | null>(null);

    // Seed the lifted PE / Plan state when Full Note first opens.
    const paneSeededRef = useRef(false);
    useEffect(() => {
        if (paneSeededRef.current || viewMode !== 'fullnote') return;
        paneSeededRef.current = true;
        if (!peState && restore && peNote) {
            // Legacy restore: PE text without structured state; keep the text as-is.
            const parsed = parsePEText(peNote, (getCategoryFromSymptomCode(symptomCode) || 'A') as CategoryLetter);
            setSelectedBlockKeys(parsed.blockKeys ?? []);
            setPeState(parsed);
        } else if (!peState) {
            const items = Object.fromEntries(selectedBlockKeys.map(k => [k, algoPeSeed?.items[k] ?? defaultItemState()]));
            const seeded = makeTemplatePEState(selectedBlockKeys, items);
            setPeState(seeded);
            setPeNote(generatePEText(seeded));
        }
        if (planSeedText) {
            setPlanState(parsePlanState(planSeedText, orderTags, instructionTags));
            if (!planNote) setPlanNote(planSeedText);
        }
    }, [viewMode, restore, peNote, symptomCode, setSelectedBlockKeys, peState, selectedBlockKeys, algoPeSeed, setPeState, setPeNote, planSeedText, planNote, setPlanNote, orderTags, instructionTags]);

    const { screens: pePaneScreens, reorder: reorderPe } = usePEPaneScreens({
        peState,
        selectedBlockKeys,
        onPeStateChange: setPeState,
        onBlockKeysChange: setSelectedBlockKeys,
        onPeNoteChange: setPeNote,
        onClose: closePane,
    });
    const { screens: planPaneScreens } = usePlanPaneScreens({
        planState,
        orderTags,
        instructionTags,
        orderSets,
        onPlanStateChange: setPlanState,
        onPlanNoteChange: setPlanNote,
        onClose: closePane,
    });

    const ddxList = (() => {
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
    })();

    const [ddxDraft, setDdxDraft] = useState('');
    const submitDdxDraft = () => {
        const v = ddxDraft.trim();
        if (!v) return;
        addCustomDdxItem(v);
        setDdxDraft('');
    };

    // Edits bind live, so the pane's Done just closes it (ProviderDrawer's doneHeaderAction).
    const doneHeaderAction = (
        <PillButton icon={Check} iconSize={18} accent="success" onClick={closePane} label="Done" />
    );

    const paneScreens: Record<string, StackScreen> = {
        ...pePaneScreens,
        ...planPaneScreens,
        's-hpi': {
            title: 'History of Present Illness',
            headerActions: doneHeaderAction,
            render: () => <TextSectionEditor value={note} onChange={setNote} placeholder="Chief complaint, onset, duration, character, associated symptoms..." />,
        },
        's-hx': historyPaneScreen(history, setHistory, doneHeaderAction),
        's-ddx': {
            title: 'Differential Diagnosis',
            headerActions: doneHeaderAction,
            footer: (selectedDdx.length > 0 || customDdx.length > 0) ? (
                <FooterPill side="left">
                    <ActionButton icon={RotateCcw} label="Reset" onClick={() => { setSelectedDdx([]); setCustomDdx([]); }} />
                </FooterPill>
            ) : undefined,
            render: () => (
                <div className="-mx-4 -my-3">
                    <div className="flex items-center border-b border-primary/6">
                        <div className="flex-1 min-w-0">
                            <TextInput
                                bare
                                value={ddxDraft}
                                onChange={setDdxDraft}
                                placeholder="Add differential..."
                                ariaLabel="Add differential"
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitDdxDraft(); } }}
                            />
                        </div>
                        {ddxDraft.trim() && (
                            <button
                                type="button"
                                onClick={submitDdxDraft}
                                aria-label="Add differential"
                                className="shrink-0 w-9 h-9 mr-3 rounded-full bg-themeblue3 text-white flex items-center justify-center active:scale-95 transition-all"
                            >
                                <Plus size={16} />
                            </button>
                        )}
                    </div>
                    {ddxList}
                </div>
            ),
        },
    };

    const paneStack = useStack({
        isOpen: paneVisible,
        initial: paneScreen ?? { key: 's-hpi' },
        screens: paneScreens,
    });

    const handleLog = useCallback(async () => {
        if (logged) return;
        setLogged(true);
        await logNow(selectedSymptom.icon);
    }, [logged, logNow, selectedSymptom.icon]);

    // My Notes keeps only the encoded string (enc: token when signed in) — the
    // de-identified barcode payload, never the composed note text.
    const handleSave = useCallback(async (): Promise<boolean> => {
        if (!encodedValue) return false;
        const id = await saveNote({
            id: savedIdRef.current,
            userId: authUserId ?? null,
            encodedText: encodedValue,
            symptomIcon: selectedSymptom.icon,
            symptomText: selectedSymptom.text,
            dispositionType: disposition.type,
            dispositionText: disposition.text,
        });
        if (id) savedIdRef.current = id;
        return !!id;
    }, [encodedValue, saveNote, authUserId, selectedSymptom.icon, selectedSymptom.text, disposition.type, disposition.text]);

    const finishOptions = useMemo<ActionSheetOption[]>(() => {
        const isUpdate = !!savedIdRef.current && savedNotes.some(n => n.id === savedIdRef.current);
        const saveLabel = isUpdate
            ? 'Update My Notes'
            : savedNotes.length >= SAVED_NOTES_CAP ? 'Save (replaces oldest)' : 'Save to My Notes';
        const close = () => onExpansionChange(false);
        const opts: ActionSheetOption[] = [];
        if (encodedValue) {
            // Save and Log stay on the page (no combo row) so either can follow the other.
            opts.push({ key: 'save', label: saveLabel, icon: Save, onAction: async () => {
                if (await handleSave()) emitCopied('Saved to My Notes');
            } });
        }
        if (!logged) {
            opts.push({ key: 'log', label: 'Log training', icon: GraduationCap, onAction: () => {
                void handleLog();
                emitCopied('Training logged');
            } });
        }
        opts.push(...noteExportOptions({
            onExportSF600: () => { if (previewNote) setPatientGate('sf600'); },
            onExportDD689: () => { if (encodedValue) setPatientGate('dd689'); },
            onShare: handleShare,
            onEditInProvider: isProviderRole && encodedValue ? async () => {
                // The Provider drawer re-imports plaintext; signed-in notes carry an enc: token.
                const payload = isEncryptedBarcode(encodedValue) ? await decryptBarcode(encodedValue) : encodedValue;
                if (!payload) { emitErrorToast('Couldn’t open in Provider', 'This note could not be unlocked on this device.'); return; }
                close();
                openProviderNote({ payload });
            } : undefined,
        }));
        return opts;
    }, [savedNotes, encodedValue, previewNote, logged, isProviderRole, handleSave, handleLog, handleShare, onExpansionChange, openProviderNote]);

    const handleDone = (e: MouseEvent<HTMLButtonElement>) => {
        setFinishAnchor(e.currentTarget.getBoundingClientRect());
        setFinishOpen(true);
    };

    return (
        <>
        <BaseDrawer
            isVisible={isVisible}
            onClose={() => onExpansionChange(false)}
            fullHeight="90dvh"
            mobileClassName=""
            desktopSize="half"
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
                                        onOpen={() => setPaneScreen({ key: 's-hpi' })}
                                    />
                                    {/* History items sit in the HPI group, no section label of their own */}
                                    <NoteHistorySection
                                        value={history}
                                        onChange={setHistory}
                                        onOpenPane={(key) => setPaneScreen({ key: 's-hx', params: { key } })}
                                    />
                                </div>

                                {/* Physical Exam — symptom-templated, typically populated on mount */}
                                <PECenter
                                    selectedBlockKeys={selectedBlockKeys}
                                    items={peState?.items ?? {}}
                                    vitals={peState?.vitals ?? {}}
                                    onOpenSelector={() => setPaneScreen({ key: 's-pe' })}
                                    onOpenBlock={(blockKey) => setPaneScreen({ key: 's-pe-block', params: { blockKey } })}
                                    onOpenVitals={() => setPaneScreen({ key: 's-pe-vitals' })}
                                    onReorder={reorderPe}
                                    additional={peState?.additional ?? ''}
                                    onOpenFreeText={() => setPaneScreen({ key: 's-pe-freetext' })}
                                />

                                {/* Differential Diagnosis — assessment itself is the ADTMC algorithm */}
                                <div className="space-y-2">
                                    <p className={SECTION_LABEL_CLASS}>Differential Diagnosis</p>
                                    {(selectedDdx.length > 0 || customDdx.length > 0) ? (
                                        <div
                                            onClick={() => setPaneScreen({ key: 's-ddx' })}
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
                                                onClick: () => setPaneScreen({ key: 's-ddx' }),
                                            }}
                                        />
                                    )}
                                </div>

                                {/* Plan */}
                                <div className="space-y-2">
                                    <p className={SECTION_LABEL_CLASS}>Plan</p>
                                    {planNote ? (
                                        <div
                                            onClick={() => setPaneScreen({ key: 's-plan' })}
                                            className={`${CARD_CLASS} cursor-pointer active:scale-[0.99] transition-all`}
                                        >
                                            <div className="px-4 py-3 text-sm text-primary whitespace-pre-wrap max-h-64 overflow-y-auto">
                                                {planNote}
                                            </div>
                                        </div>
                                    ) : (
                                        <EmptyState
                                            title="Add plan"
                                            action={{ icon: Plus, label: 'Add plan', onClick: () => setPaneScreen({ key: 's-plan' }) }}
                                        />
                                    )}
                                </div>
                                </>
                                )}
                            </div>
                        </div>

                    {/* Full Note */}
                    <div className={`w-full px-2 pt-2 pb-32 ${currentPageId !== 'fullnote' ? 'hidden' : ''}`}>
                                <div className="space-y-4 mx-2 mt-2">
                                    <NoteOutputSections
                                        previewNote={previewNote}
                                        onCopyNote={() => handleCopy(previewNote)}
                                        onCopyEncoded={() => handleCopy(encodedValue)}
                                        barcode={
                                            <NoteBarcodeGenerator
                                                algorithmOptions={algorithmOptions}
                                                cardStates={cardStates}
                                                noteOptions={{
                                                    includeAlgorithm: true,
                                                    includeDecisionMaking,
                                                    assessmentNote,
                                                    selectedDdx,
                                                    customDdx,
                                                    customNote: note,
                                                    physicalExamNote: peNote,
                                                    peState: peState ?? undefined,
                                                    planNote,
                                                    history,
                                                    user: profile,
                                                    userId: authUserId,
                                                }}
                                                symptomCode={selectedSymptom?.icon?.replace('-', '') || 'A1'}
                                                onEncodedValueChange={setEncodedValue}
                                                layout={encodedValue.length > 300 ? 'col' : 'row'}
                                            />
                                        }
                                    />

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
                                label="Next"
                                className="absolute right-4"
                            />
                        }
                    />
                ) : (
                    // Full Note page (terminal): the Done FAB over the glass footer.
                    <NoteWizardFooter
                        currentPage={currentPage} visiblePages={visiblePages} slideDirection={slideDirection}
                        handleNext={handleDone}
                        isMobile={isMobile}
                    />
                )}
                {/* Desktop section editor — ONE card for the whole open; screens swap
                    inside it via paneStack. z-40 clears the bottom island (z-20). */}
                {!isMobile && (
                    <PaneCard
                        isOpen={paneVisible && paneStack.hasScreen}
                        onClose={closePane}
                        title={paneStack.title ?? 'Note section'}
                        onBack={paneStack.canBack ? paneStack.onBack : undefined}
                        leading={paneStack.headerLeft}
                        actions={paneStack.headerActions}
                        footer={(paneStack.footer || paneStack.rightFooter) ? (
                            <div className="flex items-center justify-between gap-2 px-3 py-2">
                                <div className="flex items-center gap-2">{paneStack.footer}</div>
                                <div className="flex items-center gap-2">{paneStack.rightFooter}</div>
                            </div>
                        ) : undefined}
                        closeOnEsc={false}
                        zIndex={40}
                    >
                        <div className="px-4 py-3 overflow-x-hidden">{paneStack.body('')}</div>
                    </PaneCard>
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
                <ActionSheet
                    visible={finishOpen}
                    title="Finish note"
                    options={finishOptions}
                    onClose={() => setFinishOpen(false)}
                    anchorRect={finishAnchor}
                />
            </div>
        </BaseDrawer>
        {isMobile && paneStack.hasScreen && (
            <StackSheet stack={paneStack} isOpen={paneVisible} onClose={closePane} maxHeight={80}>
                <div className="px-4 py-3 overflow-x-hidden">{paneStack.body('')}</div>
            </StackSheet>
        )}
        <PatientIdPopover
            isOpen={patientGate !== null}
            anchorRect={null}
            form={patientGate ?? undefined}
            onClose={() => setPatientGate(null)}
            onConfirm={(patient, extras, stamp) => patientGate === 'dd689' ? handleExportDD689(patient, extras) : handleExportSF600(patient, stamp)}
        />
        <PdfPreviewModal
            preview={sf600Preview ?? dd689Preview ?? null}
            generating={sf600ExportStatus === 'generating' || exportStatus === 'generating'}
            onDownload={sf600Preview ? downloadSF600 : downloadDD689}
            onClose={sf600Preview ? clearSF600Preview : clearDD689Preview}
        />
        </>
    );
};
