import type { ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { EmptyState } from '@/Components/primitives/EmptyState';
import type { ImportedMedicNote } from '../ProviderDrawer';
import { medicFieldText, type MedicField } from './medicFields';
import { NoteHistorySection } from '../NoteHistorySection';
import type { NoteHistory, HistoryKey } from '../../Utilities/noteHistory';

/** The four editable provider-note sections — the pane-editor routing key. */
export type ProviderSection = 'hpi' | 'pe' | 'assessment' | 'plan';

interface ProviderNoteProps {
  hpiNote: string;
  assessmentNote: string;
  planNote: string;
  history: NoteHistory;
  setHistory: React.Dispatch<React.SetStateAction<NoteHistory>>;
  /** Open a history item's editor in the pane / sheet. */
  onOpenHistory: (key: HistoryKey) => void;
  importedMedicNote: ImportedMedicNote | null;
  /** Open a section's editor in the pane / sheet. */
  onOpenSection: (section: ProviderSection) => void;
  /** The PE section element — movable cards + selector entry, composed by ProviderDrawer. */
  peCenter: ReactNode;
  /** Open a medic section's editor in the pane / sheet. */
  onOpenMedic: (field: MedicField) => void;
}

/** Display text of a medic section card (assessment shows the assembled section). */
function medicDisplayText(note: ImportedMedicNote, field: MedicField): string {
  return field === 'assessment' ? note.medicAssessment : medicFieldText(note, field);
}

const SECTION_LABEL_CLASS = 'text-[9pt] font-semibold text-primary uppercase tracking-wider';
const CARD_CLASS = 'relative rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden';

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
 * Summary card for one section: the current value (or an EmptyState); a tap opens
 * its editor in the pane (desktop) / sheet (mobile).
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
  assessmentNote,
  planNote,
  history,
  setHistory,
  onOpenHistory,
  importedMedicNote,
  onOpenSection,
  peCenter,
  onOpenMedic,
}: ProviderNoteProps) {
  const open = onOpenSection;
  // Container query, not viewport (same reasoning as Settings' SettingsPage): the
  // center is whatever is left of a 90% drawer after the rail. Wide, it splits
  // S/O left and A/P right, so DOM order is already SOAP order and the narrow
  // stack needs no order-* classes.
  return (
    <div className="@container/note">
      <div className="flex flex-col gap-4 md:gap-3 @4xl/note:grid @4xl/note:grid-cols-2 @4xl/note:items-start @4xl/note:gap-8">
        <div className="flex flex-col gap-4 md:gap-3 min-w-0">
          <div className="space-y-3 md:space-y-2">
            <SummarySection
              label="History of Present Illness" addLabel="Add HPI"
              value={hpiNote}
              medic={importedMedicNote} medicField="hpi" onOpenMedic={onOpenMedic}
              onOpen={() => open('hpi')}
            />
            {/* History items sit in the HPI group, no section label of their own */}
            <NoteHistorySection value={history} onChange={setHistory} onOpenPane={onOpenHistory} />
          </div>
          {peCenter}
        </div>
        <div className="flex flex-col gap-4 md:gap-3 min-w-0">
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
      </div>
    </div>
  );
}
