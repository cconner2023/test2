import type { ImportedMedicNote } from '../ProviderDrawer';

/** Editable medic section — text keys of amendMedicBarcode's edits. */
export type MedicField = 'hpi' | 'pe' | 'assessment' | 'plan';

export const MEDIC_FIELD_TITLES: Record<MedicField, string> = {
  hpi: 'Edit Medic HPI',
  pe: 'Edit Medic Exam',
  assessment: 'Edit Medic Assessment',
  plan: 'Edit Medic Plan',
};

/** ImportedMedicNote key holding each section's editable text. */
export const MEDIC_FIELD_KEYS: Record<MedicField, 'medicHpi' | 'medicPe' | 'medicAssessmentNarrative' | 'medicPlan'> = {
  hpi: 'medicHpi',
  pe: 'medicPe',
  assessment: 'medicAssessmentNarrative',
  plan: 'medicPlan',
};

/** The editable text behind a medic section — the assessment edits its narrative
 *  only; algorithm, DDx, and decision making stay as the medic's triage produced. */
export function medicFieldText(note: ImportedMedicNote, field: MedicField): string {
  return note[MEDIC_FIELD_KEYS[field]];
}
