// Types/PlanTypes.ts
// Shared plan state types for the desktop provider pane flow (ProviderPlanSections)
// and the mobile Plan primitive. Mirrors PETypes.ts.

import type { PlanBlockKey } from '../Data/User';

export type PlanBlockStatus = 'inactive' | 'active';

/** State of a single plan category block — mirrors Plan.tsx's internal BlockState. */
export interface PlanBlockState {
    status: PlanBlockStatus;
    /** Configured or custom order items selected in this category, in output order. */
    selectedTags: string[];
    /** Free-text tail appended after the selected items (unused by the pane UI, kept for parse compat). */
    freeText: string;
}

/**
 * Complete lifted plan state — the desktop provider pane drives this instead of the
 * mobile Plan component's internal state, so planNote stays synced across a template
 * apply the same way peState does. Text is derived via generatePlanText(planState).
 */
export interface PlanState {
    /** Per-category block state (meds / lab / radiology / referral / instructions / followUp). */
    states: Record<PlanBlockKey, PlanBlockState>;
    /** Items added inline that aren't in the provider's configured tags — keeps them re-selectable. */
    customTags: Record<PlanBlockKey, string[]>;
    /** Order-set ids currently applied (drives the center chip active state). */
    activeSetIds: string[];
    /** Category display order — set when the provider drags the center cards. */
    blockOrder: PlanBlockKey[];
    /** Provider free-text block (HPI-style), appended after the category lines. */
    additional?: string;
    /** Per-note medication quantity overrides, keyed by the stored med tag. Edits
     *  here affect this note only — the tag's saved quantity is untouched. */
    medQty?: Record<string, number>;
}
