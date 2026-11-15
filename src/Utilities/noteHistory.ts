import { compressText, decompressText } from './textCodec';

export type HistoryKey = 'allergies' | 'homeMeds' | 'tobacco' | 'etoh' | 'surgical';

/** Medic note histories, composed under SUBJECTIVE after the HPI (no header of their own). */
export type NoteHistory = Record<HistoryKey, string> & {
    /** Medic's drag order. Absent = HISTORY_FIELDS order. */
    order?: HistoryKey[];
};

// Index is the barcode wire position (M segment value array / order indices). Append only.
// noteLabel is unused for surgical: historyLine words that one itself.
export const HISTORY_FIELDS: { key: HistoryKey; label: string; noteLabel: string; placeholder: string }[] = [
    { key: 'allergies', label: 'Allergies', noteLabel: 'ALLERGIES', placeholder: 'NKDA, or agent and reaction' },
    { key: 'homeMeds', label: 'Home medications', noteLabel: 'HOME MEDICATIONS', placeholder: 'Name, dose, frequency, or none' },
    { key: 'tobacco', label: 'Tobacco', noteLabel: 'TOBACCO', placeholder: 'Smoke, vape, dip; amount and duration' },
    { key: 'etoh', label: 'ETOH', noteLabel: 'ETOH', placeholder: 'Drinks per week, last drink' },
    { key: 'surgical', label: 'Surgical history', noteLabel: 'SURGICAL HISTORY', placeholder: 'Procedure and year, or none' },
];

const DEFAULT_ORDER = HISTORY_FIELDS.map(f => f.key);

export const EMPTY_HISTORY: NoteHistory = { allergies: '', homeMeds: '', tobacco: '', etoh: '', surgical: '' };

/** Fields in the medic's order. Tolerates a partial or stale order (keys missing from it append). */
export function orderedHistoryFields(h: NoteHistory | undefined) {
    const order = h?.order ?? DEFAULT_ORDER;
    const keys = [...order.filter(k => DEFAULT_ORDER.includes(k)), ...DEFAULT_ORDER.filter(k => !order.includes(k))];
    return keys.map(k => HISTORY_FIELDS.find(f => f.key === k)!);
}

export function historyHasContent(h: NoteHistory | undefined): boolean {
    return !!h && HISTORY_FIELDS.some(f => h[f.key].trim());
}

// A bare negative in the surgical field reads as a denial sentence, not "Surgical hx: none".
const SURGICAL_DENIAL = /^(none|no|denies|neg(ative)?|n\/?a|nil)\.?$/i;

/** One note line for a field, '' when empty — except surgical, where blank reads as a
 *  denial. SF600Export strips these exact strings out of the note body for the
 *  fields it moves to the left column. */
export function historyLine(h: NoteHistory, key: HistoryKey): string {
    const v = h[key].trim();
    if (key === 'surgical') return !v || SURGICAL_DENIAL.test(v) ? 'Denies past surgical history' : `Surgical hx: ${v}`;
    if (!v) return '';
    return `${HISTORY_FIELDS.find(f => f.key === key)!.noteLabel}: ${v}`;
}

/** Note lines in the medic's order: filled fields plus the surgical line (always present). */
export function formatHistory(h: NoteHistory | undefined): string {
    if (!h) return '';
    return orderedHistoryFields(h)
        .map(f => historyLine(h, f.key))
        .filter(Boolean)
        .join('\n');
}

/**
 * Barcode M segment value: compressed JSON. Default order encodes as a bare value
 * array; a custom order as {v: values, o: field indices}.
 */
export function encodeHistory(h: NoteHistory | undefined): string | null {
    if (!h || !historyHasContent(h)) return null;
    const values = HISTORY_FIELDS.map(f => h[f.key].trim());
    while (values.length && !values[values.length - 1]) values.pop();
    const order = orderedHistoryFields(h).map(f => DEFAULT_ORDER.indexOf(f.key));
    const isDefault = order.every((v, i) => v === i);
    return compressText(JSON.stringify(isDefault ? values : { v: values, o: order }));
}

export function decodeHistory(value: string): NoteHistory {
    const out: NoteHistory = { ...EMPTY_HISTORY };
    try {
        const parsed = JSON.parse(decompressText(value));
        const values = Array.isArray(parsed) ? parsed : parsed?.v;
        if (Array.isArray(values)) {
            HISTORY_FIELDS.forEach((f, i) => { if (typeof values[i] === 'string') out[f.key] = values[i]; });
        }
        if (Array.isArray(parsed?.o)) {
            out.order = parsed.o
                .filter((i: unknown): i is number => typeof i === 'number' && i >= 0 && i < DEFAULT_ORDER.length)
                .map((i: number) => DEFAULT_ORDER[i]);
        }
    } catch { /* malformed segment reads as empty history */ }
    return out;
}
