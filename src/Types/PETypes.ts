// Types/PETypes.ts
// Shared physical exam state types for direct encoding/decoding.

import type { CategoryLetter, Laterality, SpineRegion } from '../Data/PhysicalExamData';

/** Status of a single PE exam item. */
export type PEItemStatus = 'not-examined' | 'normal' | 'abnormal';

/** State of a single PE exam item — mirrors PhysicalExam's internal ItemState. */
export interface PEItemState {
    status: PEItemStatus;
    /** Free-text findings (only meaningful when status is 'abnormal'). */
    findings: string;
    /** Keys of selected abnormal chip options (only meaningful when status is 'abnormal'). */
    selectedChips: string[];
}

/** Complete PE state passed from PhysicalExam component to the encoder. */
export interface PEState {
    /** MEDCOM category letter (A-M). */
    categoryLetter: CategoryLetter;
    /** Laterality for MSK exams. */
    laterality: Laterality;
    /** Spine region for back pain MSK exams. */
    spineRegion: SpineRegion;
    /** Map of block key -> item state. Only includes examined items. */
    items: Record<string, PEItemState>;
    /** Vital signs values keyed by vital sign key (hr, rr, bpSys, bpDia, temp, ht, wt). */
    vitals: Record<string, string>;
    /** Additional free-text findings. */
    additional: string;
    /** PE depth mode used. */
    depth: 'focused' | 'comprehensive' | 'custom';
    /** For comprehensive mode: ordered block keys defining the template. */
    blockOrder?: string[];
}
