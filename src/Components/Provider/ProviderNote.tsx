import { useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { detectPII } from '../../lib/piiDetector';
import { PIIWarningBanner } from '../PIIWarningBanner';
import type { ImportedMedicNote } from '../ProviderDrawer';

interface ProviderNoteProps {
  hpiNote: string;
  setHpiNote: (note: string) => void;
  peNote: string;
  setPeNote: (note: string) => void;
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
  assessmentNote,
  setAssessmentNote,
  planNote,
  setPlanNote,
  onNext,
  importedMedicNote,
}: ProviderNoteProps) {
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
    <div className="px-4 py-4 pb-8 space-y-4">
      {piiWarnings.length > 0 && <PIIWarningBanner warnings={piiWarnings} />}

      <div className="space-y-2">
        <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">History of Present Illness</p>
        {importedMedicNote?.medicHpi && (
          <div className="rounded-xl bg-themewhite2 px-4 py-3">
            <p className="text-[9pt] text-tertiary/50 mb-1">{importedMedicNote.medicName}</p>
            <div className="text-sm text-primary whitespace-pre-wrap">{importedMedicNote.medicHpi}</div>
          </div>
        )}
        <textarea
          className={TEXTAREA_CLASS}
          value={hpiNote}
          onChange={(e) => setHpiNote(e.target.value)}
          placeholder="Chief complaint, onset, duration, character, associated symptoms..."
        />
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">Physical Exam</p>
        {importedMedicNote?.medicPe && (
          <div className="rounded-xl bg-themewhite2 px-4 py-3">
            <p className="text-[9pt] text-tertiary/50 mb-1">{importedMedicNote.medicName}</p>
            <div className="text-sm text-primary whitespace-pre-wrap">{importedMedicNote.medicPe}</div>
          </div>
        )}
        <textarea
          className={TEXTAREA_CLASS}
          value={peNote}
          onChange={(e) => setPeNote(e.target.value)}
          placeholder="Vital signs, system findings..."
        />
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">Assessment</p>
        {importedMedicNote?.medicAssessment && (
          <div className="rounded-xl bg-themewhite2 px-4 py-3">
            <p className="text-[9pt] text-tertiary/50 mb-1">{importedMedicNote.medicName}</p>
            <div className="text-sm text-primary whitespace-pre-wrap">{importedMedicNote.medicAssessment}</div>
          </div>
        )}
        <textarea
          className={TEXTAREA_CLASS}
          value={assessmentNote}
          onChange={(e) => setAssessmentNote(e.target.value)}
          placeholder="Clinical assessment, diagnosis, differential..."
        />
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">Plan</p>
        {importedMedicNote?.medicPlan && (
          <div className="rounded-xl bg-themewhite2 px-4 py-3">
            <p className="text-[9pt] text-tertiary/50 mb-1">{importedMedicNote.medicName}</p>
            <div className="text-sm text-primary whitespace-pre-wrap">{importedMedicNote.medicPlan}</div>
          </div>
        )}
        <textarea
          className={TEXTAREA_CLASS}
          value={planNote}
          onChange={(e) => setPlanNote(e.target.value)}
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
