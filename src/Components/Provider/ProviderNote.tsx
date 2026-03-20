import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { detectPII } from '../../lib/piiDetector';
import { PIIWarningBanner } from '../PIIWarningBanner';
import { ExpandableInput } from '../ExpandableInput';
import { PhysicalExam } from '../PhysicalExam';
import { useUserProfile } from '../../Hooks/useUserProfile';
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
  assessmentNote: string;
  setAssessmentNote: (note: string) => void;
  planNote: string;
  setPlanNote: (note: string) => void;
  onNext: () => void;
  importedMedicNote: ImportedMedicNote | null;
}

const TEXTAREA_CLASS =
  'w-full min-h-[120px] rounded-xl border border-themeblue3/10 shadow-xs bg-themewhite p-3 text-sm text-primary ' +
  'placeholder:text-tertiary/30 focus:border-themeblue1/30 focus:bg-themewhite2 focus:outline-none resize-none transition-all duration-300';

export function ProviderNote({
  hpiNote,
  setHpiNote,
  peNote,
  setPeNote,
  onPeStateChange,
  peResetKey = 0,
  assessmentNote,
  setAssessmentNote,
  planNote,
  setPlanNote,
  onNext,
  importedMedicNote,
}: ProviderNoteProps) {
  const [peMode, setPeMode] = useState<'blocks' | 'text'>('blocks');

  const { profile } = useUserProfile();
  const expanders = profile.textExpanders ?? [];
  const expanderEnabled = profile.textExpanderEnabled ?? true;

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
    <div className="space-y-4">
      {piiWarnings.length > 0 && <PIIWarningBanner warnings={piiWarnings} />}

      <div className="space-y-3">
        <p className="text-[9pt] font-semibold text-primary/80 uppercase tracking-wider">History of Present Illness</p>
        {importedMedicNote?.medicHpi && (
          <div className="rounded-xl bg-themewhite2 px-4 py-3">
            <p className="text-[10pt] text-tertiary/50 mb-1">{importedMedicNote.medicName}</p>
            <div className="text-sm text-primary whitespace-pre-wrap">{importedMedicNote.medicHpi}</div>
          </div>
        )}
        <ExpandableInput
          value={hpiNote}
          onChange={setHpiNote}
          expanders={expanders}
          expanderEnabled={expanderEnabled}
          multiline
          className={TEXTAREA_CLASS}
          placeholder="Chief complaint, onset, duration, character, associated symptoms..."
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[9pt] font-semibold text-primary/80 uppercase tracking-wider">Physical Exam</p>
          <label
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => setPeMode(prev => prev === 'blocks' ? 'text' : 'blocks')}
          >
            <span className="text-[9pt] font-semibold text-primary/80 uppercase tracking-wider">Structured</span>
            <div
              className={`relative w-9 h-5 shrink-0 rounded-full transition-colors duration-200 ${
                peMode === 'blocks' ? 'bg-themeblue3' : 'bg-tertiary/20'
              }`}
            >
              <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                peMode === 'blocks' ? 'translate-x-4' : 'translate-x-0'
              }`} />
            </div>
          </label>
        </div>
        {importedMedicNote?.medicPe && (
          <div className="rounded-xl bg-themewhite2 px-4 py-3">
            <p className="text-[10pt] text-tertiary/50 mb-1">{importedMedicNote.medicName}</p>
            <div className="text-sm text-primary whitespace-pre-wrap">{importedMedicNote.medicPe}</div>
          </div>
        )}
        {peMode === 'blocks' ? (
          <PhysicalExam
            key={peResetKey}
            initialText={peNote}
            onChange={setPeNote}
            onStateChange={onPeStateChange}
            colors={getColorClasses('routine')}
            symptomCode="A-1"
            depth={profile.peDepth ?? 'focused'}
            customBlocks={profile.peDepth === 'custom' ? profile.customPEBlocks : undefined}
            comprehensiveTemplate={profile.peDepth === 'comprehensive' ? profile.comprehensivePETemplate : undefined}
            expanders={expanders}
            expanderEnabled={expanderEnabled}
          />
        ) : (
          <ExpandableInput
            value={peNote}
            onChange={setPeNote}
            expanders={expanders}
            expanderEnabled={expanderEnabled}
            multiline
            className={TEXTAREA_CLASS}
            placeholder="Vital signs, system findings..."
          />
        )}
      </div>

      <div className="space-y-3">
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
          expanderEnabled={expanderEnabled}
          multiline
          className={TEXTAREA_CLASS}
          placeholder="Clinical assessment, diagnosis, differential..."
        />
      </div>

      <div className="space-y-3">
        <p className="text-[9pt] font-semibold text-primary/80 uppercase tracking-wider">Plan</p>
        {importedMedicNote?.medicPlan && (
          <div className="rounded-xl bg-themewhite2 px-4 py-3">
            <p className="text-[10pt] text-tertiary/50 mb-1">{importedMedicNote.medicName}</p>
            <div className="text-sm text-primary whitespace-pre-wrap">{importedMedicNote.medicPlan}</div>
          </div>
        )}
        <ExpandableInput
          value={planNote}
          onChange={setPlanNote}
          expanders={expanders}
          expanderEnabled={expanderEnabled}
          multiline
          className={TEXTAREA_CLASS}
          placeholder="Treatment plan, orders, follow-up..."
        />
      </div>

      <div className="flex items-center justify-end pt-4">
        <button
          onClick={onNext}
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
