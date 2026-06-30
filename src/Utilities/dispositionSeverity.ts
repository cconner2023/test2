import type { AlgorithmOptions, dispositionType } from '../Types/AlgorithmTypes';

/** Triage severity ranking — lower number = more urgent. Used to floor the displayed
 *  disposition when a red flag is present so a later, lower-severity answer can't
 *  silently downgrade it. */
export const DISPOSITION_SEVERITY: Record<dispositionType['type'], number> = {
    'CAT I': 0, 'CAT II': 1, 'CAT III': 2, 'CAT IV': 3, 'OTHER': 4,
};

/** Returns the more severe (lower CAT number) of two dispositions; a null defers to the other. */
export const moreSevereDisposition = (
    a: dispositionType | null,
    b: dispositionType | null,
): dispositionType | null => {
    if (!a) return b;
    if (!b) return a;
    return (DISPOSITION_SEVERITY[a.type] ?? 99) <= (DISPOSITION_SEVERITY[b.type] ?? 99) ? a : b;
};

/**
 * Floors a disposition at the red-flag-bound initial card's "yes" disposition (e.g. CAT I)
 * whenever any red flag is selected — highest severity (lowest CAT number) wins. With no red
 * flag selected this is a no-op (returns flowDisposition), so non-RF algorithms and the
 * no-red-flag path are unaffected. Shared by the live engine (useAlgorithm) and the saved-note
 * reconstruction (noteParser) so both surfaces show the same sticky disposition.
 */
export const applyRedFlagFloor = (
    algorithmOptions: AlgorithmOptions[],
    initialCardIndex: number,
    anyRedFlagSelected: boolean,
    flowDisposition: dispositionType | null,
): dispositionType | null => {
    if (!anyRedFlagSelected) return flowDisposition;
    const floor = algorithmOptions[initialCardIndex]?.answerOptions?.[0]?.disposition?.[0] ?? null;
    return moreSevereDisposition(floor, flowDisposition);
};
