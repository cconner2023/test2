// Utilities/medTag.ts
// Quantity + sig encoding for medication plan tags.
//
// A med tag stays a plain string everywhere — the quantity and sig ride in the
// tag itself after pipes ("Ibuprofen 800mg tab | 10 | 1 tab PO q8h PRN pain").
// That keeps meds as string[] across order-set presets, the
// clinics.plan_order_tags payload, provider templates and every
// selectedTags.includes(tag) identity check. Only display and note-render go
// through these helpers. A tag with no sig is byte-identical to the older
// "Label | qty" form, so existing tags parse unchanged.
//
// The pipe form is storage. The note form is "Label, #10, 0rf, Sig: ..." and
// round-trips back through parseMedNoteEntry so an imported or barcode-seeded
// note rehydrates.

/** Refills are fixed: a BAS dispenses a course, it is not a pharmacy. */
const REFILLS = '0rf';

export interface MedTag {
    label: string;
    /** null when the tag carries no quantity. */
    qty: number | null;
    /** null when the tag carries no sig. */
    sig: string | null;
}

/** Sig is free text, but `|` is the storage delimiter and `;` splits plan note
 *  segments — either would break the round-trip, so both are folded out. */
export function cleanSig(sig: string): string {
    return sig.replace(/[|;]/g, ',').replace(/\s+/g, ' ').trim();
}

/** Split a stored tag into label, quantity and sig. Tolerates a missing or
 *  malformed suffix by returning the whole string as the label. */
export function parseMedTag(tag: string): MedTag {
    const parts = tag.split('|');
    if (parts.length === 1) return { label: tag.trim(), qty: null, sig: null };
    const label = parts[0].trim();
    const rawQty = parts[1].trim();
    const qty = rawQty ? Number.parseInt(rawQty, 10) : null;
    const sig = parts.length > 2 ? cleanSig(parts.slice(2).join(',')) || null : null;
    const qtyValid = qty == null || (Number.isFinite(qty) && qty > 0);
    if (!label || !qtyValid || (qty == null && sig == null)) return { label: tag.trim(), qty: null, sig: null };
    return { label, qty, sig };
}

/** Build the stored form. A null/zero quantity and blank sig drop the suffix
 *  entirely so an unannotated tag is byte-identical to a plain label. */
export function composeMedTag(label: string, qty: number | null, sig?: string | null): string {
    const clean = label.trim();
    const n = qty != null && Number.isFinite(qty) && qty > 0 ? qty : null;
    const s = sig ? cleanSig(sig) : '';
    if (s) return `${clean} | ${n ?? ''} | ${s}`;
    if (n == null) return clean;
    return `${clean} | ${n}`;
}

/** Label without the quantity/sig suffix — the key a display badge and, later,
 *  the property binding are keyed on. */
export function medTagLabel(tag: string): string {
    return parseMedTag(tag).label;
}

/** Sig carried by a tag, or null. */
export function medTagSig(tag: string): string | null {
    return parseMedTag(tag).sig;
}

/** Note form: "Ibuprofen 800mg tab, #10, 0rf, Sig: 1 tab PO q8h PRN pain".
 *  `override` is the per-note quantity edit and wins over the tag's saved one. */
export function formatMedNoteEntry(tag: string, override?: number | null): string {
    const { label, qty, sig } = parseMedTag(tag);
    const n = override ?? qty;
    const parts = [label];
    if (n != null && n > 0) parts.push(`#${n}`, REFILLS);
    if (sig) parts.push(`Sig: ${sig}`);
    return parts.join(', ');
}

/** Inverse of formatMedNoteEntry — turns a note segment back into the stored
 *  pipe form so seeded text re-selects the right tag. Tolerant: a segment that
 *  isn't in note form comes back untouched. */
export function parseMedNoteEntry(segment: string): string {
    let rest = segment.trim();
    let sig: string | null = null;
    const sigMatch = rest.match(/^(.*?),\s*sig:\s*(.*)$/i);
    if (sigMatch) {
        rest = sigMatch[1].trim();
        sig = sigMatch[2].trim() || null;
    }
    const m = rest.match(/^(.*?),\s*#\s*(\d+)\s*(?:,\s*\d+\s*rf)?$/i);
    if (m) return composeMedTag(m[1], Number.parseInt(m[2], 10), sig);
    if (sig) return composeMedTag(rest, null, sig);
    return segment.trim();
}

/** Display form of a plan tag. The pipe is storage and is never shown; a med
 *  tag reads "Ibuprofen 800mg tab x 10 · 1 tab PO q8h" in every list that renders it. */
export function planTagDisplay(catKey: string, tag: string): string {
    if (catKey !== 'meds') return tag;
    const { label, qty, sig } = parseMedTag(tag);
    let out = qty != null ? `${label} x ${qty}` : label;
    if (sig) out += ` · ${sig}`;
    return out;
}

/** Effective quantity for a tag under an optional per-note override map. */
export function effectiveMedQty(tag: string, overrides?: Record<string, number>): number | null {
    const o = overrides?.[tag];
    if (o != null && Number.isFinite(o) && o > 0) return o;
    return parseMedTag(tag).qty;
}
