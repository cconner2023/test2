import { useMemo, useRef, useState } from 'react';
import { ChevronRight, Plus, RotateCcw, Check } from 'lucide-react';
import { detectPII } from '../../lib/piiDetector';
import { PIIWarningBanner } from '../PIIWarningBanner';
import { ExpandableInput } from '../ExpandableInput';
import { PhysicalExam } from '../PhysicalExam';
import { Plan } from '../Plan';
import { ActionPill } from '../ActionPill';
import { EmptyState } from '../EmptyState';
import { PreviewOverlay } from '../PreviewOverlay';
import { useMergedNoteContent } from '../../Hooks/useMergedNoteContent';
import { getColorClasses } from '../../Utilities/ColorUtilities';
import type { TextExpander } from '../../Data/User';
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

const SECTION_LABEL_CLASS = 'text-[9pt] font-semibold text-primary uppercase tracking-wider';
const CARD_CLASS = 'relative rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden';

const TEXTAREA_CLASS =
  'w-full bg-transparent px-4 py-3 text-base md:text-sm text-primary placeholder:text-tertiary ' +
  'focus:outline-none resize-none overflow-hidden min-h-[200px]';

/** Read-only card for the imported medic's voice (HPI/PE/Assessment/Plan). */
function MedicContextCard({ name, text }: { name: string; text: string }) {
  return (
    <div className={`${CARD_CLASS} px-4 py-3`}>
      <p className="text-[10pt] text-tertiary mb-1">{name}</p>
      <div className="text-sm text-primary whitespace-pre-wrap">{text}</div>
    </div>
  );
}

/**
 * HPI / Assessment section: empty card → tap FAB → PreviewOverlay containing a
 * textarea. Once content exists, the card body shows the full text and tapping
 * the card reopens the same overlay.
 */
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

  const openFromAnchor = (rect: DOMRect) => {
    setAnchor(rect);
    setIsOpen(true);
  };
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
            onClick: (anchor) => openFromAnchor(anchor.getBoundingClientRect()),
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
          {
            key: 'reset',
            label: 'Reset',
            icon: RotateCcw,
            onAction: () => onChange(''),
            closesOnAction: false,
          },
          {
            key: 'done',
            label: 'Done',
            icon: Check,
            onAction: () => setIsOpen(false),
            closesOnAction: false,
          },
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

  // ── PE: empty card → opens PhysicalExam's block picker via signal counter ──
  const [pePickerSignal, setPePickerSignal] = useState(0);
  const [pePickerAnchor, setPePickerAnchor] = useState<DOMRect | null>(null);
  // peState is auto-emitted on PE mount (PhysicalExam.tsx useEffect), so it can't be used
  // as a "user has done something" signal. selectedBlockKeys + peNote are the real indicators.
  const peHasContent = !!peNote || selectedBlockKeys.length > 0;

  // ── Plan: same pattern ──
  const [planPickerSignal, setPlanPickerSignal] = useState(0);
  const [planPickerAnchor, setPlanPickerAnchor] = useState<DOMRect | null>(null);
  const planHasContent = !!planNote;

  return (
    <div className="space-y-4 md:space-y-3">
      {piiWarnings.length > 0 && <PIIWarningBanner warnings={piiWarnings} />}

      {/* ── HPI ───────────────────────────────────────────────── */}
      <div className="space-y-3 md:space-y-2" data-tour="provider-hpi">
        <p className={SECTION_LABEL_CLASS}>History of Present Illness</p>
        {importedMedicNote?.medicHpi && (
          <MedicContextCard name={importedMedicNote.medicName} text={importedMedicNote.medicHpi} />
        )}
        <TextSectionCard
          addLabel="Add HPI"
          value={hpiNote}
          onChange={setHpiNote}
          expanders={expanders}
          placeholder="Chief complaint, onset, duration, character, associated symptoms..."
        />
      </div>

      {/* ── Physical Exam ─────────────────────────────────────── */}
      <div className="space-y-3 md:space-y-2" data-tour="provider-pe">
        <p className={SECTION_LABEL_CLASS}>Physical Exam</p>
        {importedMedicNote?.medicPe && (
          <MedicContextCard name={importedMedicNote.medicName} text={importedMedicNote.medicPe} />
        )}
        {/* Always-mounted PE — wrapper toggles between hidden host and visible TC3 chrome.
            Single instance keeps the picker overlay alive across the empty→populated transition. */}
        <div
          className={peHasContent ? CARD_CLASS : undefined}
          style={peHasContent ? undefined : { display: 'none' }}
          aria-hidden={!peHasContent}
        >
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
              onClick: (anchor) => {
                setPePickerAnchor(anchor.getBoundingClientRect());
                setPePickerSignal(s => s + 1);
              },
            }}
          />
        )}
      </div>

      {/* ── Assessment ────────────────────────────────────────── */}
      <div className="space-y-3 md:space-y-2" data-tour="provider-assessment">
        <p className={SECTION_LABEL_CLASS}>Assessment</p>
        {importedMedicNote?.medicAssessment && (
          <MedicContextCard name={importedMedicNote.medicName} text={importedMedicNote.medicAssessment} />
        )}
        <TextSectionCard
          addLabel="Add assessment"
          value={assessmentNote}
          onChange={setAssessmentNote}
          expanders={expanders}
          placeholder="Clinical assessment, diagnosis, differential..."
        />
      </div>

      {/* ── Plan ─────────────────────────────────────────────── */}
      <div className="space-y-3 md:space-y-2" data-tour="provider-plan">
        <p className={SECTION_LABEL_CLASS}>Plan</p>
        {importedMedicNote?.medicPlan && (
          <MedicContextCard name={importedMedicNote.medicName} text={importedMedicNote.medicPlan} />
        )}
        <div
          className={planHasContent ? CARD_CLASS : undefined}
          style={planHasContent ? undefined : { display: 'none' }}
          aria-hidden={!planHasContent}
        >
          <Plan
            orderTags={orderTags}
            instructionTags={instructionTags}
            orderSets={orderSets}
            initialText={planNote}
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
              onClick: (anchor) => {
                setPlanPickerAnchor(anchor.getBoundingClientRect());
                setPlanPickerSignal(s => s + 1);
              },
            }}
          />
        )}
      </div>

      <div className="flex items-center justify-end pt-4">
        <ActionPill>
          <button
            onClick={onNext}
            data-tour="provider-generate"
            aria-label="Next"
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 active:scale-95 transition-all bg-themeblue2 text-white"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </ActionPill>
      </div>
    </div>
  );
}

