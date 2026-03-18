import { useMemo } from 'react';
import { detectPII } from '../../lib/piiDetector';
import { PIIWarningBanner } from '../PIIWarningBanner';

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
}

const TEXTAREA_CLASS =
  'w-full min-h-[120px] rounded-xl border border-themeblue3/10 shadow-xs bg-themewhite p-3 text-sm text-primary ' +
  'placeholder:text-tertiary/30 focus:border-themeblue1/30 focus:bg-themewhite2 focus:outline-none resize-none transition-all duration-300';

interface SectionCardProps {
  label: string;
  children: React.ReactNode;
}

function SectionCard({ label, children }: SectionCardProps) {
  return (
    <div className="rounded-lg border border-tertiary/10 bg-themewhite overflow-hidden">
      <div className="px-4 py-2.5 border-b border-tertiary/10 bg-themewhite3/50">
        <h3 className="text-sm font-semibold text-primary">{label}</h3>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

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

      {/* HPI */}
      <SectionCard label="History of Present Illness">
        <textarea
          className={TEXTAREA_CLASS}
          value={hpiNote}
          onChange={(e) => setHpiNote(e.target.value)}
          placeholder="Chief complaint, onset, duration, character, associated symptoms..."
        />
      </SectionCard>

      {/* Physical Exam — free text for now; TODO: integrate PhysicalExam component toggle */}
      <SectionCard label="Physical Exam">
        <textarea
          className={TEXTAREA_CLASS}
          value={peNote}
          onChange={(e) => setPeNote(e.target.value)}
          placeholder="Vital signs, system findings..."
        />
      </SectionCard>

      {/* Assessment */}
      <SectionCard label="Assessment">
        <textarea
          className={TEXTAREA_CLASS}
          value={assessmentNote}
          onChange={(e) => setAssessmentNote(e.target.value)}
          placeholder="Clinical assessment, diagnosis, differential..."
        />
      </SectionCard>

      {/* Plan */}
      <SectionCard label="Plan">
        <textarea
          className={TEXTAREA_CLASS}
          value={planNote}
          onChange={(e) => setPlanNote(e.target.value)}
          placeholder="Treatment plan, orders, follow-up..."
        />
      </SectionCard>

      <button
        onClick={onNext}
        className="w-full py-3 rounded-lg bg-themeblue3 text-white font-medium text-sm active:scale-95 transition-transform"
      >
        Next
      </button>
    </div>
  );
}
