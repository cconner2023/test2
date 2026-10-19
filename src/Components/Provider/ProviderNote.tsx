import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
import { encodePEState } from '../../Utilities/peCodec';
import type { TextExpander, PlanOrderTags } from '../../Data/User';
import type { MergedPlanOrderSet } from '../../Hooks/useMergedNoteContent';
import type { ImportedMedicNote } from '../ProviderDrawer';
import { MEDIC_FIELD_TITLES, medicFieldText, type MedicField } from './medicFields';
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
  /** Mobile: amend a medic text section (live, from the card's editor overlay). */
  onEditMedic?: (field: MedicField, text: string) => void;
  /** Mobile: amend the medic's structured exam (blocks + vitals, edited in place). */
  onEditMedicPe?: (state: PEState) => void;
  /** Mobile: remounts the in-place medic exam/plan editors on a new import. */
  medicResetKey?: number;
  /** Desktop (summaryMode): open a medic section's editor in the right pane. */
  onOpenMedic?: (field: MedicField) => void;
}

/** Display text of a medic section card (assessment shows the assembled section). */
function medicDisplayText(note: ImportedMedicNote, field: MedicField): string {
  return field === 'assessment' ? note.medicAssessment : medicFieldText(note, field);
}

const SECTION_LABEL_CLASS = 'text-[9pt] font-semibold text-primary uppercase tracking-wider';
const CARD_CLASS = 'relative rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden';

const TEXTAREA_CLASS =
  'w-full bg-transparent px-4 py-3 text-base md:text-sm text-primary placeholder:text-tertiary ' +
  'focus:outline-none resize-none overflow-hidden min-h-[200px]';

/** Card for the imported medic's voice (HPI/PE/Assessment/Plan). Tappable to
 *  amend when onEdit is given; renders nothing for an empty section. */
export function MedicContextCard({ note, field, onEdit }: {
  note: ImportedMedicNote;
  field: MedicField;
  onEdit?: (anchor: DOMRect) => void;
}) {
  const text = medicDisplayText(note, field);
  if (!text) return null;
  return (
    <div
      onClick={onEdit ? (e) => onEdit(e.currentTarget.getBoundingClientRect()) : undefined}
      className={`${CARD_CLASS} px-4 py-3 ${onEdit ? 'cursor-pointer active:scale-[0.99] transition-all' : ''}`}
    >
      <p className="text-[10pt] text-tertiary truncate mb-1">
        {note.medicName}{note.amended && ' · amended'}
      </p>
      <div className="text-sm text-primary whitespace-pre-wrap">{text}</div>
    </div>
  );
}

/** Medic author line (· amended) over a medic section rendered by its own editor.
 *  `card` adds the medic card chrome; editors that own chrome (PhysicalExam, Plan)
 *  sit bare beneath the line. */
export function MedicSectionFrame({ note, card = true, children }: {
  note: ImportedMedicNote;
  card?: boolean;
  children: ReactNode;
}) {
  const label = (
    <p className="text-[10pt] text-tertiary truncate mb-1">
      {note.medicName}{note.amended && ' · amended'}
    </p>
  );
  if (!card) return <div>{label}{children}</div>;
  return <div className={`${CARD_CLASS} px-4 py-3`}>{label}{children}</div>;
}

/**
 * Forwards an in-place editor's emissions only once the user actually changes
 * something — PhysicalExam/Plan emit on mount (and on re-render), and a
 * re-encoded seed must not flag the medic note amended.
 */
function useDirtyForward<T>(fingerprint: (v: T) => string, forward: ((v: T) => void) | undefined) {
  const baseline = useRef<string | null>(null);
  const dirty = useRef(false);
  const forwardRef = useRef(forward);
  useEffect(() => { forwardRef.current = forward; }, [forward]);
  return useCallback((v: T) => {
    if (!dirty.current) {
      const fp = fingerprint(v);
      if (baseline.current === null) { baseline.current = fp; return; }
      if (fp === baseline.current) return;
      dirty.current = true;
    }
    forwardRef.current?.(v);
  }, [fingerprint]);
}

const noop = () => {};

/** Mobile: the medic's structured exam in the same PhysicalExam editor (system
 *  blocks + Vital Signs box), amending the bundled medic exam. */
function MedicPhysicalExam({ note, peState, expanders, onEditMedicPe }: {
  note: ImportedMedicNote;
  peState: PEState;
  expanders: TextExpander[];
  onEditMedicPe?: (state: PEState) => void;
}) {
  const symptomCode = note.medicSymptomCode;
  const [blockKeys, setBlockKeys] = useState<string[]>(() => peState.blockKeys ?? []);
  const fingerprint = useCallback((s: PEState) => {
    try { return encodePEState(s, symptomCode); } catch { return JSON.stringify(s); }
  }, [symptomCode]);
  const handleState = useDirtyForward(fingerprint, onEditMedicPe);
  return (
    <MedicSectionFrame note={note} card={false}>
      <PhysicalExam
        initialState={peState}
        onChange={noop}
        onStateChange={handleState}
        colors={getColorClasses()}
        symptomCode={symptomCode}
        mode="template"
        templateBlockKeys={blockKeys}
        onBlockKeysChange={setBlockKeys}
        expanders={expanders}
        pinVitals
      />
    </MedicSectionFrame>
  );
}

const planFingerprint = (text: string) => text.trim();

/** Mobile: the medic's plan in the same Plan editor, amending the medic plan. */
function MedicPlan({ note, orderTags, instructionTags, orderSets, expanders, onEditMedic }: {
  note: ImportedMedicNote;
  orderTags: PlanOrderTags;
  instructionTags: string[];
  orderSets: MergedPlanOrderSet[];
  expanders: TextExpander[];
  onEditMedic?: (field: MedicField, text: string) => void;
}) {
  const forward = useMemo(() => onEditMedic ? (text: string) => onEditMedic('plan', text) : undefined, [onEditMedic]);
  const handleChange = useDirtyForward(planFingerprint, forward);
  // Only a medic who wrote a plan gets one; stays mounted if the edit clears it.
  const [hadPlan] = useState(() => !!note.medicPlan.trim());
  if (!hadPlan) return null;
  return (
    <MedicSectionFrame note={note} card={false}>
      <Plan
        orderTags={orderTags}
        instructionTags={instructionTags}
        orderSets={orderSets}
        initialText={note.medicPlan}
        onChange={handleChange}
        expanders={expanders}
      />
    </MedicSectionFrame>
  );
}

/** Mobile: medic card + its lifted editor overlay. Edits amend the bundled medic
 *  note live; the overlay stays mounted even if the section is cleared. */
function MedicEditableCard({ note, field, expanders, onEditMedic }: {
  note: ImportedMedicNote;
  field: MedicField;
  expanders: TextExpander[];
  onEditMedic?: (field: MedicField, text: string) => void;
}) {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  return (
    <>
      <MedicContextCard note={note} field={field} onEdit={onEditMedic ? setAnchor : undefined} />
      {onEditMedic && (
        <PreviewOverlay
          isOpen={anchor !== null}
          onClose={() => setAnchor(null)}
          anchorRect={anchor}
          title={MEDIC_FIELD_TITLES[field]}
          previewMaxHeight="50dvh"
          rightFooter={
            <FooterPill side="right">
              <ActionButton icon={Check} label="Done" onClick={() => setAnchor(null)} />
            </FooterPill>
          }
        >
          <ExpandableInput
            value={medicFieldText(note, field)}
            onChange={(v) => onEditMedic(field, v)}
            expanders={expanders}
            multiline
            hideClear
            className={TEXTAREA_CLASS}
            placeholder={field === 'assessment' ? 'Medic assessment narrative...' : ''}
          />
        </PreviewOverlay>
      )}
    </>
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
  label, value, addLabel, medic, medicField, onOpenMedic, onOpen,
}: {
  label: string;
  value: string;
  addLabel: string;
  medic: ImportedMedicNote | null;
  medicField: MedicField;
  onOpenMedic?: (field: MedicField) => void;
  onOpen: () => void;
}) {
  return (
    <div className="space-y-3 md:space-y-2">
      <p className={SECTION_LABEL_CLASS}>{label}</p>
      {medic && (
        <MedicContextCard note={medic} field={medicField} onEdit={onOpenMedic ? () => onOpenMedic(medicField) : undefined} />
      )}
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
  onEditMedic,
  onOpenMedic,
  onEditMedicPe,
  medicResetKey = 0,
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
      {importedMedicNote && (
        importedMedicNote.medicPeState ? (
          <MedicPhysicalExam
            key={medicResetKey}
            note={importedMedicNote}
            peState={importedMedicNote.medicPeState}
            expanders={expanders}
            onEditMedicPe={onEditMedicPe}
          />
        ) : (
          <MedicEditableCard note={importedMedicNote} field="pe" expanders={expanders} onEditMedic={onEditMedic} />
        )
      )}
      {/* Always-mounted PE with the Vital Signs row pinned, so vitals go in before
          any system. PhysicalExam owns its own bordered chrome + placement="overlay"
          action pill; wrapping in CARD_CLASS here would double-chrome and clip it. */}
      <div>
        <PhysicalExam
          key={peResetKey}
          initialText={peNote}
          initialState={peState}
          onChange={setPeNote}
          onStateChange={onPeStateChange}
          colors={getColorClasses()}
          symptomCode="A-1"
          mode="template"
          templateBlockKeys={selectedBlockKeys}
          onBlockKeysChange={onBlockKeysChange}
          expanders={expanders}
          pickerOpenSignal={pePickerSignal}
          pickerOpenAnchor={pePickerAnchor}
          pinVitals
        />
      </div>
      {selectedBlockKeys.length === 0 && (
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
      {importedMedicNote && (
        <MedicPlan
          key={medicResetKey}
          note={importedMedicNote}
          orderTags={orderTags}
          instructionTags={instructionTags}
          orderSets={orderSets}
          expanders={expanders}
          onEditMedic={onEditMedic}
        />
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
          medic={importedMedicNote} medicField="hpi" onOpenMedic={onOpenMedic}
          onOpen={() => open('hpi')}
        />
        {peCenter}
        <SummarySection
          label="Assessment" addLabel="Add assessment"
          value={assessmentNote}
          medic={importedMedicNote} medicField="assessment" onOpenMedic={onOpenMedic}
          onOpen={() => open('assessment')}
        />
        <SummarySection
          label="Plan" addLabel="Add plan"
          value={planNote}
          medic={importedMedicNote} medicField="plan" onOpenMedic={onOpenMedic}
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
        {importedMedicNote && (
          <MedicEditableCard note={importedMedicNote} field="hpi" expanders={expanders} onEditMedic={onEditMedic} />
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
        {importedMedicNote && (
          <MedicEditableCard note={importedMedicNote} field="assessment" expanders={expanders} onEditMedic={onEditMedic} />
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

