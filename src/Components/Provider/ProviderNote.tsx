import { useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { detectPII } from '../../lib/piiDetector';
import { PIIWarningBanner } from '../PIIWarningBanner';
import { ExpandableInput } from '../ExpandableInput';
import { PhysicalExam } from '../PhysicalExam';
import { Plan } from '../Plan';
import { useMergedNoteContent } from '../../Hooks/useMergedNoteContent';
import { getColorClasses } from '../../Utilities/ColorUtilities';
import type { ImportedMedicNote } from '../ProviderDrawer';
import type { PEState } from '../../Types/PETypes';


interface ProviderNoteProps {
  hpiNote: string;
  setHpiNote: (note: string) => void;
  peNote: string;
  setPeNote: (note: string) => void;
  peState: PEState | null;
  onPeStateChange: (state: PEState) => void;
  peResetKey?: number;
  selectedBlockKeys: string[];
  onBlockKeysChange: (keys: string[]) => void;
  assessmentNote: string;
  setAssessmentNote: (note: string) => void;
  planNote: string;
  setPlanNote: (note: string) => void;
  onNext: () => void;
  importedMedicNote: ImportedMedicNote | null;
}

const TEXTAREA_CLASS =
  'w-full rounded-xl border border-themeblue3/10 shadow-xs bg-themewhite p-3 text-sm text-primary ' +
  'placeholder:text-tertiary/30 focus:border-themeblue1/30 focus:bg-themewhite2 focus:outline-none resize-none transition-all duration-300 overflow-hidden';

export function ProviderNote({
  hpiNote,
  setHpiNote,
  peNote,
  setPeNote,
  peState,
  onPeStateChange,
  peResetKey = 0,
  selectedBlockKeys,
  onBlockKeysChange,
  assessmentNote,
  setAssessmentNote,
  planNote,
  setPlanNote,
  onNext,
  importedMedicNote,
}: ProviderNoteProps) {

  const { expanders, orderTags, instructionTags, orderSets } = useMergedNoteContent();

  const piiWarnings = useMemo(
    () =>
      Array.from(
        new Set([
          ...detectPII(hpiNote),
          ...detectPII(peNote),
          ...detectPII(assessmentNote),
          ...detectPII(planNote),
        ]),
      ),
    [hpiNote, peNote, assessmentNote, planNote],
  );

  return (
    <div className="space-y-4 md:space-y-3">
      {piiWarnings.length > 0 && <PIIWarningBanner warnings={piiWarnings} />}

      <div className="space-y-3 md:space-y-2" data-tour="provider-hpi">
        <p className="text-[9pt] font-semibold text-primary/80 uppercase tracking-wider">History of Present Illness</p>
        {importedMedicNote?.medicHpi && (
          <div className="rounded-xl bg-themewhite2 px-4 py-3" data-tour="provider-medic-context">
            <p className="text-[10pt] text-tertiary/50 mb-1">{importedMedicNote.medicName}</p>
            <div className="text-sm text-primary whitespace-pre-wrap">{importedMedicNote.medicHpi}</div>
          </div>
        )}
        <ExpandableInput
          value={hpiNote}
          onChange={setHpiNote}
          expanders={expanders}
          multiline
          className={TEXTAREA_CLASS}
          placeholder="Chief complaint, onset, duration, character, associated symptoms..."
        />
      </div>

      <div className="space-y-3 md:space-y-2" data-tour="provider-pe">
        <p className="text-[9pt] font-semibold text-primary/80 uppercase tracking-wider">Physical Exam</p>
        {/* Block selection is handled inside PhysicalExam via popover */}
        {importedMedicNote?.medicPe && (
          <div className="rounded-xl bg-themewhite2 px-4 py-3">
            <p className="text-[10pt] text-tertiary/50 mb-1">{importedMedicNote.medicName}</p>
            <div className="text-sm text-primary whitespace-pre-wrap">{importedMedicNote.medicPe}</div>
          </div>
        )}
        <PhysicalExam
          key={peResetKey}
          initialText={peNote}
          initialState={peState}
          onChange={setPeNote}
          onStateChange={onPeStateChange}
          colors={getColorClasses('routine')}
          symptomCode="A-1"
          mode="template"
          templateBlockKeys={selectedBlockKeys}
          onBlockKeysChange={onBlockKeysChange}
          expanders={expanders}
        />
      </div>

      <div className="space-y-3 md:space-y-2" data-tour="provider-assessment">
        <p className="text-[9pt] font-semibold text-primary/80 uppercase tracking-wider">Assessment</p>
        {importedMedicNote?.medicAssessment && (
          <div className="rounded-xl bg-themewhite2 px-4 py-3">
            <p className="text-[10pt] text-tertiary/50 mb-1">{importedMedicNote.medicName}</p>
            <div className="text-sm text-primary whitespace-pre-wrap">{importedMedicNote.medicAssessment}</div>
          </div>
        )}
        <ExpandableInput
          value={assessmentNote}
          onChange={setAssessmentNote}
          expanders={expanders}
          multiline
          className={TEXTAREA_CLASS}
          placeholder="Clinical assessment, diagnosis, differential..."
        />
      </div>

      <div className="space-y-3 md:space-y-2" data-tour="provider-plan">
        <p className="text-[9pt] font-semibold text-primary/80 uppercase tracking-wider">Plan</p>
        {importedMedicNote?.medicPlan && (
          <div className="rounded-xl bg-themewhite2 px-4 py-3">
            <p className="text-[10pt] text-tertiary/50 mb-1">{importedMedicNote.medicName}</p>
            <div className="text-sm text-primary whitespace-pre-wrap">{importedMedicNote.medicPlan}</div>
          </div>
        )}
        <Plan
          orderTags={orderTags}
          instructionTags={instructionTags}
          orderSets={orderSets}
          initialText={planNote}
          onChange={setPlanNote}
          expanders={expanders}
        />
      </div>

      <div className="flex items-center justify-end pt-4">
        <button
          onClick={onNext}
          data-tour="provider-generate"
          className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 active:scale-95 transition-all md:w-auto md:h-auto md:px-5 md:py-2.5 md:rounded-xl md:gap-2 bg-themeblue3 text-white"
          aria-label="Next"
        >
          <span className="hidden md:inline text-sm font-medium">Next</span>
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}
