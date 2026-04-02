import { useMemo, useState } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { ChevronRight } from 'lucide-react';
import { detectPII } from '../../lib/piiDetector';
import { PIIWarningBanner } from '../PIIWarningBanner';
import { ExpandableInput } from '../ExpandableInput';
import { PhysicalExam } from '../PhysicalExam';
import { Plan } from '../Plan';
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
  const [peMode, setPeMode] = useState<'blocks' | 'text'>('blocks');
  const [planMode, setPlanMode] = useState<'blocks' | 'text'>('text');

  const { profile } = useUserProfile();
  const clinicTextExpanders = useAuthStore(s => s.clinicTextExpanders);
  const expanders = useMemo(() => {
    const personal = profile.textExpanders ?? [];
    if (clinicTextExpanders.length === 0) return personal;
    const clinicAbbrs = new Set(clinicTextExpanders.map(e => e.abbr.toLowerCase()));
    return [...clinicTextExpanders, ...personal.filter(e => !clinicAbbrs.has(e.abbr.toLowerCase()))];
  }, [profile.textExpanders, clinicTextExpanders]);
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
          expanderEnabled={expanderEnabled}
          multiline
          className={TEXTAREA_CLASS}
          placeholder="Chief complaint, onset, duration, character, associated symptoms..."
        />
      </div>

      <div className="space-y-3 md:space-y-2" data-tour="provider-pe">
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
        {/* Block selection is handled inside PhysicalExam via popover */}
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
            mode="template"
            templateBlockKeys={selectedBlockKeys}
            onBlockKeysChange={onBlockKeysChange}
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
          expanderEnabled={expanderEnabled}
          multiline
          className={TEXTAREA_CLASS}
          placeholder="Clinical assessment, diagnosis, differential..."
        />
      </div>

      <div className="space-y-3 md:space-y-2" data-tour="provider-plan">
        <div className="flex items-center justify-between">
          <p className="text-[9pt] font-semibold text-primary/80 uppercase tracking-wider">Plan</p>
          <label
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => setPlanMode(prev => prev === 'blocks' ? 'text' : 'blocks')}
          >
            <span className="text-[9pt] font-semibold text-primary/80 uppercase tracking-wider">Structured</span>
            <div
              className={`relative w-9 h-5 shrink-0 rounded-full transition-colors duration-200 ${
                planMode === 'blocks' ? 'bg-themeblue3' : 'bg-tertiary/20'
              }`}
            >
              <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                planMode === 'blocks' ? 'translate-x-4' : 'translate-x-0'
              }`} />
            </div>
          </label>
        </div>
        {importedMedicNote?.medicPlan && (
          <div className="rounded-xl bg-themewhite2 px-4 py-3">
            <p className="text-[10pt] text-tertiary/50 mb-1">{importedMedicNote.medicName}</p>
            <div className="text-sm text-primary whitespace-pre-wrap">{importedMedicNote.medicPlan}</div>
          </div>
        )}
        {planMode === 'blocks' ? (
          <Plan
            orderTags={profile.planOrderTags ?? { referral: [], meds: [], radiology: [], lab: [], followUp: [] }}
            instructionTags={profile.planInstructionTags ?? []}
            orderSets={profile.planOrderSets}
            initialText={planNote}
            onChange={setPlanNote}
            expanders={expanders}
            expanderEnabled={expanderEnabled}
          />
        ) : (
          <ExpandableInput
            value={planNote}
            onChange={setPlanNote}
            expanders={expanders}
            expanderEnabled={expanderEnabled}
            multiline
            className={TEXTAREA_CLASS}
            placeholder="Treatment plan, orders, follow-up..."
          />
        )}
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
