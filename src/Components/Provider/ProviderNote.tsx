import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Plus, RotateCcw, Check } from 'lucide-react';
import { detectPII } from '../../lib/piiDetector';
import { PIIWarningBanner } from '../PIIWarningBanner';
import { ExpandableInput } from '@/Components/primitives/ExpandableInput';
import { PhysicalExam } from '../PhysicalExam';
import { Plan } from '../Plan';
import { ActionButton } from '@/Components/primitives/ActionButton';
import { EmptyState } from '@/Components/primitives/EmptyState';
import { PreviewOverlay } from '../PreviewOverlay';
import { useMergedNoteContent } from '../../Hooks/useMergedNoteContent';
import { getColorClasses } from '../../Utilities/ColorUtilities';
import type { TextExpander } from '../../Data/User';
import type { ImportedMedicNote } from '../ProviderDrawer';
import type { PEState } from '../../Types/PETypes';
import { FooterPill } from '@/Components/primitives/FooterPill'

/** The four editable provider-note sections — the pane-editor routing key. */
export type ProviderSection = 'hpi' | 'pe' | 'assessment' | 'plan';

interface ProviderNoteProps {
  hpiNote: string;
  setHpiNote: (note: string) => void;
  peNote: string;
  setPeNote: (note: string) => void;
  peState: PEState | null;
  onPeStateChange: (state: PEState) => void;
  peResetKey?: number;
  planResetKey?: number;
  selectedBlockKeys: string[];
  onBlockKeysChange: (keys: string[]) => void;
  assessmentNote: string;
  setAssessmentNote: (note: string) => void;
  planNote: string;
  setPlanNote: (note: string) => void;
  importedMedicNote: ImportedMedicNote | null;
  /** Desktop 3-pane: render sections as read-only summary cards that route editing
   *  into the right pane (the live editors mount there). Omit/false on mobile, where
   *  each section hosts its own inline editor + lifted PreviewOverlay. */
  summaryMode?: boolean;
  /** Desktop: open a section's editor in the right pane (summaryMode only). */
  onOpenSection?: (section: ProviderSection) => void;
  /** Desktop (summaryMode): the PE section element — movable cards + selector entry.
   *  Composed by ProviderDrawer since PE editing lives in the right pane. */
  peCenter?: ReactNode;
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

/**
 * Desktop summary card for one section (summaryMode). Shows the current value (or
 * an EmptyState) and routes a tap into the right-pane editor. The center keeps its
 * structure; the live editor lives in the pane and this card refreshes on save.
 */
function SummarySection({
  label, value, addLabel, medicName, medicText, onOpen,
}: {
  label: string;
  value: string;
  addLabel: string;
  medicName?: string;
  medicText?: string;
  onOpen: () => void;
}) {
  return (
    <div className="space-y-3 md:space-y-2">
      <p className={SECTION_LABEL_CLASS}>{label}</p>
      {medicText && <MedicContextCard name={medicName ?? ''} text={medicText} />}
      {value ? (
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
      )}
    </div>
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
  planResetKey = 0,
  selectedBlockKeys,
  onBlockKeysChange,
  assessmentNote,
  setAssessmentNote,
  planNote,
  setPlanNote,
  importedMedicNote,
  summaryMode = false,
  onOpenSection,
  peCenter,
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

  // PE + Plan sections — SHARED across the mobile full editor and the desktop
  // summary layout. They stay live-mounted in the center on both platforms so the
  // exam/plan text (peNote/planNote) stays synced from a template apply; only their
  // block/category sub-pickers float as overlays. (HPI/Assessment, plain textareas,
  // route into the right pane on desktop instead — see summaryMode below.)
  const peSection = (
    <div className="space-y-3 md:space-y-2">
      <p className={SECTION_LABEL_CLASS}>Physical Exam</p>
      {importedMedicNote?.medicPe && (
        <MedicContextCard name={importedMedicNote.medicName} text={importedMedicNote.medicPe} />
      )}
      {/* Always-mounted PE — wrapper is visibility-only. PhysicalExam owns its own
          bordered chrome + placement="overlay" action pill; wrapping in CARD_CLASS
          here would double-chrome and clip the negative-translated pill. */}
      <div style={peHasContent ? undefined : { display: 'none' }} aria-hidden={!peHasContent}>
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
  );

  const planSection = (
    <div className="space-y-3 md:space-y-2">
      <p className={SECTION_LABEL_CLASS}>Plan</p>
      {importedMedicNote?.medicPlan && (
        <MedicContextCard name={importedMedicNote.medicName} text={importedMedicNote.medicPlan} />
      )}
      {/* Always-mounted Plan — wrapper visibility-only. Plan owns its own bordered
          chrome + overlay pill; CARD_CLASS here would double-chrome and clip. */}
      <div style={planHasContent ? undefined : { display: 'none' }} aria-hidden={!planHasContent}>
        <Plan
          key={planResetKey}
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
  );

  // ── Desktop 3-pane: HPI + Assessment (plain text) route into the right pane;
  //    PE + Plan stay live inline. The center keeps its structure and refreshes
  //    from pane edits (they bind to the same lifted state). ──
  if (summaryMode) {
    const open = (s: ProviderSection) => onOpenSection?.(s);
    return (
      <div className="space-y-4 md:space-y-3">
        {piiWarnings.length > 0 && <PIIWarningBanner warnings={piiWarnings} />}
        <SummarySection
          label="History of Present Illness" addLabel="Add HPI"
          value={hpiNote}
          medicName={importedMedicNote?.medicName} medicText={importedMedicNote?.medicHpi}
          onOpen={() => open('hpi')}
        />
        {peCenter}
        <SummarySection
          label="Assessment" addLabel="Add assessment"
          value={assessmentNote}
          medicName={importedMedicNote?.medicName} medicText={importedMedicNote?.medicAssessment}
          onOpen={() => open('assessment')}
        />
        <SummarySection
          label="Plan" addLabel="Add plan"
          value={planNote}
          medicName={importedMedicNote?.medicName} medicText={importedMedicNote?.medicPlan}
          onOpen={() => open('plan')}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-3">
      {piiWarnings.length > 0 && <PIIWarningBanner warnings={piiWarnings} />}

      {/* ── HPI ───────────────────────────────────────────────── */}
      <div className="space-y-3 md:space-y-2">
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
      {peSection}

      {/* ── Assessment ────────────────────────────────────────── */}
      <div className="space-y-3 md:space-y-2">
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
      {planSection}
    </div>
  );
}

