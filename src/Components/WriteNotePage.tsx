import { useState, useMemo, useEffect } from 'react';
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
    ActionIconButton, SlideWrapper, ToggleOption,
    NoteHPIEditor, NoteWizardFooter,
    shareStatusToIconStatus, exportStatusToIconStatus,
} from './WriteNoteHelpers';
import { useAuthStore } from '../stores/useAuthStore';
import { BrainCircuit, FileText, Stethoscope, ClipboardList } from 'lucide-react';
import { GUIDED_HPI_EXPANDED, GUIDED_PE_TEXT, GUIDED_PLAN_TEXT } from '../Data/GuidedTourData';

type DispositionType = dispositionType['type'];

type PageId = 'decision' | 'hpi' | 'pe' | 'plan' | 'fullnote';

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
    const isDevRole = useAuthStore(s => s.isDevRole);
    const colors = getColorClasses(disposition.type);

    // Tour override: temporarily show all note sections during guided tour
    // Uses a global flag so the value is available even before mount
    const [tourOverrideAll, setTourOverrideAll] = useState(() => !!window.__tourNoteOverride);
    useEffect(() => {
        const onEnable = () => setTourOverrideAll(true);
        const onRestore = () => { setTourOverrideAll(false); window.__tourNoteOverride = false; };
        window.addEventListener('tour:enable-all-note-sections', onEnable);
        window.addEventListener('tour:restore-note-sections', onRestore);
        return () => {
            window.removeEventListener('tour:enable-all-note-sections', onEnable);
            window.removeEventListener('tour:restore-note-sections', onRestore);
            // Clean up global flag on unmount (e.g., tour skipped while drawer open)
            window.__tourNoteOverride = false;
        };
    }, []);

    const defaultHPI = true;
    const defaultPE = tourOverrideAll || !!(profile.peDepth);
    const defaultPlan = tourOverrideAll || !!(profile.planOrderTags && Object.values(profile.planOrderTags).some(arr => arr.length > 0));

    const visiblePages = useMemo(() => {
        const pages: { id: PageId; label: string }[] = [
            { id: 'decision', label: 'Decision Making' },
            { id: 'hpi', label: 'HPI' },
            { id: 'pe', label: 'Physical Exam' },
            { id: 'plan', label: 'Plan' },
            { id: 'fullnote', label: 'Full Note' },
        ];
        return pages;
    }, []);

    // WriteNotePage-unique state: includeDecisionMaking
    const [includeDecisionMaking, setIncludeDecisionMaking] = useState<boolean>(false);

    const editor = useNoteEditor({
        algorithmOptions,
        cardStates,
        includeAlgorithm: true,
        dispositionType: disposition.type,
        dispositionText: disposition.text,
        selectedSymptom,
        visiblePages,
        isMobile,
        initialPage,
        colors,
        includeDecisionMaking,
    });

    const {
        note, setNote, previewNote,
        peNote, setPeNote,
        peState, setPeState,
        planNote, setPlanNote,
        includeHPI, setIncludeHPI,
        includePhysicalExam, setIncludePhysicalExam,
        includePlan, setIncludePlan,
        encodedValue, setEncodedValue,
        barcodeBytes, setBarcodeBytes,
        copiedTarget,
        currentPage, currentPageId, slideDirection,
        handleNext, handlePageBack,
        handleSwipeStart, handleSwipeMove, handleSwipeEnd,
        setCursorPosition,
        piiWarnings, pePiiWarnings, hasPII,
        handleCopy, handleShare, handleExportDD689, handleExportSF600,
        shareStatus, exportStatus, sf600ExportStatus,
        expanderSuggestions, expanderIndex, acceptExpander, dismissExpander,
        hasExpanderSuggestion,
        templateSession, startSession, fillCurrentAndAdvance, endSession, dismissDropdown,
        hpiKeyDownHandler,
        inputRef,
        profile: editorProfile, authUserId,
    } = editor;

    // ── Tour injection listeners ────────────────────────────────────────────
    useEffect(() => {
        const onInjectHPI = () => { setNote(GUIDED_HPI_EXPANDED); setIncludeHPI(true); };
        const onInjectPE = () => { setPeNote(GUIDED_PE_TEXT); setIncludePhysicalExam(true); };
        const onInjectPlan = () => { setPlanNote(GUIDED_PLAN_TEXT); setIncludePlan(true); };

        window.addEventListener('tour:inject-hpi', onInjectHPI);
        window.addEventListener('tour:inject-pe', onInjectPE);
        window.addEventListener('tour:inject-plan', onInjectPlan);
        return () => {
            window.removeEventListener('tour:inject-hpi', onInjectHPI);
            window.removeEventListener('tour:inject-pe', onInjectPE);
            window.removeEventListener('tour:inject-plan', onInjectPlan);
        };
    }, [setNote, setIncludeHPI, setPeNote, setIncludePhysicalExam, setPlanNote, setIncludePlan]);

    return (
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
            <div className="flex flex-col h-full">
                {/* Content Area */}
                <div
                    className="flex-1 overflow-hidden relative"
                    style={{ touchAction: isMobile ? 'pan-y' : 'auto' }}
                    onTouchStart={isMobile ? handleSwipeStart : undefined}
                    onTouchMove={isMobile ? handleSwipeMove : undefined}
                    onTouchEnd={isMobile ? handleSwipeEnd : undefined}
                    onTouchCancel={isMobile ? handleSwipeEnd : undefined}
                >
                    <SlideWrapper slideDirection={slideDirection}>
                        {/* Decision Making */}
                            <div data-tour="writenote-decision" className={`w-full h-full overflow-y-auto p-2 ${isMobile ? 'pb-16' : ''} ${currentPageId !== 'decision' ? 'hidden' : ''}`}>
                                <div className="space-y-4">
                                    <div className="mx-2 mt-2">
                                        <ToggleOption
                                            checked={includeDecisionMaking}
                                            onChange={() => setIncludeDecisionMaking(!includeDecisionMaking)}
                                            label="Include Decision Making in note"
                                            onDescription="Decision making will be added to your note"
                                            offDescription="Decision making will not be included"
                                            icon={<BrainCircuit size={18} />}
                                            colors={colors}
                                        />
                                    </div>
                                    <div className="mx-2">
                                        <div className="overflow-hidden">
                                            <DecisionMaking
                                                algorithmOptions={algorithmOptions}
                                                cardStates={cardStates}
                                                disposition={disposition}
                                                dispositionType={disposition.type}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                        {/* HPI */}
                            <div data-tour="writenote-hpi" className={`w-full h-full overflow-y-auto p-2 ${isMobile ? 'pb-16' : ''} ${currentPageId !== 'hpi' ? 'hidden' : ''}`}>
                                <div className="space-y-3">
                                    <div className="mx-2 mt-2">
                                        <ToggleOption
                                            checked={includeHPI}
                                            onChange={() => { const next = !includeHPI; setIncludeHPI(next); if (next) setTimeout(() => inputRef.current?.focus(), 100); }}
                                            label="Include HPI in note"
                                            onDescription="HPI will be added to your note"
                                            offDescription="HPI will not be included"
                                            icon={<FileText size={18} />}
                                            colors={colors}
                                        />
                                    </div>
                                    {includeHPI && (
                                        <NoteHPIEditor
                                            inputRef={inputRef} note={note} setNote={setNote} setCursorPosition={setCursorPosition}
                                            hpiKeyDownHandler={hpiKeyDownHandler} templateSession={templateSession}
                                            fillCurrentAndAdvance={fillCurrentAndAdvance} endSession={endSession} dismissDropdown={dismissDropdown}
                                            hasExpanderSuggestion={hasExpanderSuggestion} expanderSuggestions={expanderSuggestions}
                                            expanderIndex={expanderIndex} dismissExpander={dismissExpander}
                                            acceptExpander={acceptExpander} startSession={startSession}
                                            piiWarnings={piiWarnings}
                                        />
                                    )}
                                </div>
                            </div>

                        {/* Physical Exam */}
                            <div data-tour="writenote-pe" className={`w-full h-full overflow-y-auto p-2 ${isMobile ? 'pb-16' : ''} ${currentPageId !== 'pe' ? 'hidden' : ''}`}>
                                <div className="space-y-3">
                                    <div className="mx-2 mt-2">
                                        <ToggleOption
                                            checked={includePhysicalExam}
                                            onChange={() => setIncludePhysicalExam(!includePhysicalExam)}
                                            label="Include Physical Exam in note"
                                            onDescription="Physical exam will be added to your note"
                                            offDescription="Physical exam will not be included"
                                            icon={<Stethoscope size={18} />}
                                            colors={colors}
                                        />
                                    </div>
                                    {includePhysicalExam && (
                                        <div className="mx-2">
                                            <div className="overflow-hidden">
                                                <PhysicalExam
                                                    initialText={peNote}
                                                    onChange={setPeNote}
                                                    onStateChange={setPeState}
                                                    colors={colors}
                                                    symptomCode={selectedSymptom?.icon || 'A-1'}
                                                    depth={profile.peDepth ?? 'focused'}
                                                    customBlocks={profile.peDepth === 'custom' ? profile.customPEBlocks : undefined}
                                                    comprehensiveTemplate={profile.peDepth === 'comprehensive' ? profile.comprehensivePETemplate : undefined}
                                                    expanders={profile.textExpanders ?? []}
                                                    expanderEnabled={profile.textExpanderEnabled ?? false}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                        {/* Plan */}
                            <div data-tour="writenote-plan" className={`w-full h-full overflow-y-auto p-2 ${isMobile ? 'pb-16' : ''} ${currentPageId !== 'plan' ? 'hidden' : ''}`}>
                                <div className="space-y-3">
                                    <div className="mx-2 mt-2">
                                        <ToggleOption
                                            checked={includePlan}
                                            onChange={() => setIncludePlan(!includePlan)}
                                            label="Include Plan in note"
                                            onDescription="Plan will be added to your note"
                                            offDescription="Plan will not be included"
                                            icon={<ClipboardList size={18} />}
                                            colors={colors}
                                        />
                                    </div>
                                    {includePlan && (
                                        <div className="mx-2">
                                            <div className="overflow-hidden">
                                                <Plan
                                                    orderTags={profile.planOrderTags ?? { referral: [], meds: [], radiology: [], lab: [], followUp: [] }}
                                                    instructionTags={profile.planInstructionTags ?? []}
                                                    orderSets={profile.planOrderSets}
                                                    initialText={planNote}
                                                    onChange={setPlanNote}
                                                    expanders={profile.textExpanders ?? []}
                                                    expanderEnabled={profile.textExpanderEnabled ?? false}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                        {/* Full Note */}
                            <div className={`w-full h-full overflow-y-auto p-2 ${isMobile ? 'pb-16' : ''} ${currentPageId !== 'fullnote' ? 'hidden' : ''}`}>
                                <div className="space-y-4 mx-2 mt-2">
                                    {hasPII && (
                                        <PIIWarningBanner warnings={[...new Set([...piiWarnings, ...pePiiWarnings])]} />
                                    )}
                                    {/* Note Preview */}
                                    <section data-tour="writenote-preview">
                                        <div className="pb-2 flex items-center justify-between">
                                            <p className="text-[9pt] font-semibold text-primary/80 uppercase tracking-wider">Note Preview</p>
                                            <div className="flex items-center gap-0.5">
                                                <ActionIconButton
                                                    onClick={() => handleCopy(previewNote, 'preview')}
                                                    status={copiedTarget === 'preview' ? 'done' : 'idle'}
                                                    variant="copy"
                                                    title="Copy note text"
                                                />
                                                {isDevRole && (
                                                    <ActionIconButton
                                                        onClick={handleExportSF600}
                                                        status={exportStatusToIconStatus(sf600ExportStatus)}
                                                        variant="pdf"
                                                        title="Export SF600 PDF"
                                                    />
                                                )}
                                            </div>
                                        </div>
                                        <div className="rounded-xl bg-themewhite2 overflow-hidden">
                                            <div className="px-4 py-3 text-tertiary text-[8pt] whitespace-pre-wrap max-h-48 overflow-y-auto">
                                                {previewNote || "No content selected"}
                                            </div>
                                        </div>
                                    </section>

                                    {/* Encoded Note / Barcode */}
                                    <section data-tour="writenote-encoded">
                                        <div className="pb-2 flex items-center justify-between">
                                            <p className="text-[9pt] font-semibold text-primary/80 uppercase tracking-wider">Encoded Note</p>
                                            <div className="flex items-center gap-0.5">
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
                                                        includeDecisionMaking,
                                                        customNote: includeHPI ? note : '',
                                                        physicalExamNote: includePhysicalExam ? peNote : '',
                                                        peState: includePhysicalExam ? (peState ?? undefined) : undefined,
                                                        planNote: includePlan ? planNote : '',
                                                        user: profile,
                                                        userId: authUserId,
                                                    }}
                                                    symptomCode={selectedSymptom?.icon?.replace('-', '') || 'A1'}
                                                    onEncodedValueChange={setEncodedValue}
                                                    onBarcodeBytesChange={setBarcodeBytes}
                                                    layout={encodedValue.length > 300 ? 'col' : 'row'}
                                                />
                                            </div>
                                        </div>
                                    </section>

                                </div>
                            </div>
                    </SlideWrapper>

                </div>

                <NoteWizardFooter
                    currentPage={currentPage} visiblePages={visiblePages} slideDirection={slideDirection}
                    handleNext={handleNext} hasPII={hasPII} colors={colors} isMobile={isMobile}
                />
            </div>
        </BaseDrawer>
    );
};
