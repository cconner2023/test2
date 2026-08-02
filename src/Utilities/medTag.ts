// Utilities/medTag.ts
// Quantity encoding for medication plan tags.
//
// A med tag stays a plain string everywhere — the quantity rides in the tag
// itself after a pipe ("Ibuprofen 800mg tab | 10"). That keeps meds as
// string[] across order-set presets, the clinics.plan_order_tags payload,
// provider templates and every selectedTags.includes(tag) identity check.
// Only display and note-render go through these helpers.
//
// The pipe form is storage. The note form is "Label, #10, 0rf" and round-trips
// back through parseMedNoteEntry so an imported or barcode-seeded note rehydrates.

/** Refills are fixed: a BAS dispenses a course, it is not a pharmacy. */
const REFILLS = '0rf';

export interface MedTag {
    label: string;
    /** null when the tag carries no quantity. */
    qty: number | null;
}

/** Split a stored tag into label and quantity. Tolerates a missing or malformed
 *  suffix by returning the whole string as the label. */
export function parseMedTag(tag: string): MedTag {
    const at = tag.lastIndexOf('|');
    if (at === -1) return { label: tag.trim(), qty: null };
    const label = tag.slice(0, at).trim();
    const qty = Number.parseInt(tag.slice(at + 1).trim(), 10);
    if (!label || !Number.isFinite(qty) || qty <= 0) return { label: tag.trim(), qty: null };
    return { label, qty };
}

/** Build the stored form. A null/zero quantity drops the suffix entirely so an
 *  unquantified tag is byte-identical to what it was before this feature. */
export function composeMedTag(label: string, qty: number | null): string {
    const clean = label.trim();
    if (qty == null || !Number.isFinite(qty) || qty <= 0) return clean;
    return `${clean} | ${qty}`;
}

/** Label without the quantity suffix — the key a display badge and, later, the
 *  property binding are keyed on. */
export function medTagLabel(tag: string): string {
    return parseMedTag(tag).label;
}

/** Quantity as it should render in the note: "Ibuprofen 800mg tab, #10, 0rf".
 *  `override` is the per-note edit and wins over the tag's saved quantity. */
export function formatMedNoteEntry(tag: string, override?: number | null): string {
    const { label, qty } = parseMedTag(tag);
    const n = override ?? qty;
    if (n == null || n <= 0) return label;
    return `${label}, #${n}, ${REFILLS}`;
}

/** Inverse of formatMedNoteEntry — turns a note segment back into the stored
 *  pipe form so seeded text re-selects the right tag. Tolerant: a segment that
 *  isn't in note form comes back untouched. */
export function parseMedNoteEntry(segment: string): string {
    const m = segment.match(/^(.*?),\s*#\s*(\d+)\s*(?:,\s*\d+\s*rf)?$/i);
    if (!m) return segment.trim();
    return composeMedTag(m[1], Number.parseInt(m[2], 10));
}

/** Display form of a plan tag. The pipe is storage and is never shown; a med
 *  tag reads "Ibuprofen 800mg tab x 10" in every list that renders it. */
export function planTagDisplay(catKey: string, tag: string): string {
    if (catKey !== 'meds') return tag;
    const { label, qty } = parseMedTag(tag);
    return qty != null ? `${label} x ${qty}` : label;
}

/** Effective quantity for a tag under an optional per-note override map. */
export function effectiveMedQty(tag: string, overrides?: Record<string, number>): number | null {
    const o = overrides?.[tag];
    if (o != null && Number.isFinite(o) && o > 0) return o;
    return parseMedTag(tag).qty;
}
