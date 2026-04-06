// Types/PETypes.ts
// Shared physical exam state types for direct encoding/decoding.

import type { CategoryLetter, Laterality, SpineRegion } from '../Data/PhysicalExamData';

/** Status of a single PE exam item. */
export type PEItemStatus = 'not-examined' | 'normal' | 'abnormal';

/** State of a single PE exam item — mirrors PhysicalExam's internal ItemState. */
export interface PEItemState {
    status: PEItemStatus;
    /** Keys of selected normal finding chips. */
    selectedNormals: string[];
    /** Keys of selected abnormal chips. */
    selectedAbnormals: string[];
    /** Free-text findings (always available). */
    findings: string;
}

/** Complete PE state passed from PhysicalExam component to the encoder. */
export interface PEState {
    /** MEDCOM category letter (A-M). */
    categoryLetter: CategoryLetter;
    /** Laterality for MSK exams. */
    laterality: Laterality;
    /** Spine region for back pain MSK exams. */
    spineRegion: SpineRegion;
    /** Map of block key -> item state using paired normal/abnormal chip model. Only includes examined items. */
    items: Record<string, PEItemState>;
    /** Vital signs values keyed by vital sign key (hr, rr, bpSys, bpDia, temp, ht, wt). */
    vitals: Record<string, string>;
    /** Additional free-text findings. */
    additional: string;
    /** PE mode: 'focused' (medic) or 'template' (provider selected blocks). */
    mode: 'focused' | 'template';
    /** Master block keys used in this exam. */
    blockKeys?: string[];
    /** @deprecated Use mode instead. Kept for v6 codec backward compat. */
    depth?: 'focused' | 'comprehensive' | 'custom';
    /** Custom block display order — set when user manually reorders PE blocks via drag. */
    blockOrder?: string[];
}
