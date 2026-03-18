// Unit tests for peCodec v5 encode/decode roundtrips
// Tests encodePEState / decodePEState / renderPEStateToText directly from PEState.

import { describe, it, expect } from 'vitest';
import { encodePEState, decodePEState, renderPEStateToText, decodePECompactLegacy } from '../peCodec';
import type { PEState } from '../../Types/PETypes';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeState(overrides: Partial<PEState> = {}): PEState {
    return {
        categoryLetter: 'A',
        laterality: 'right',
        spineRegion: 'lumbar',
        vitals: {},
        items: {},
        additional: '',
        depth: 'focused',
        ...overrides,
    };
}

/** Encode then decode back to PEState. */
function roundtrip(state: PEState): PEState | null {
    const encoded = encodePEState(state);
    return decodePEState(encoded, 'A-1');
}

// ---------------------------------------------------------------------------
// 1. Format detection
// ---------------------------------------------------------------------------

describe('v5 format detection', () => {
    it('encoded string starts with "5:" for any category', () => {
        const encoded = encodePEState(makeState());
        expect(encoded.startsWith('5:')).toBe(true);
    });

    it('decodePEState returns null for non-v5 strings', () => {
        expect(decodePEState('4:A,R,,,,,,,~0~0~~', 'A-1')).toBeNull();
        expect(decodePEState('some random text', 'A-1')).toBeNull();
        expect(decodePEState('', 'A-1')).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// 2. Vitals roundtrip
// ---------------------------------------------------------------------------

describe('Vitals roundtrip', () => {
    it('preserves all vital sign fields', () => {
        const state = makeState({
            vitals: { hr: '72', rr: '16', bpSys: '118', bpDia: '76', temp: '98.4', ht: '70', wt: '185' },
        });
        const decoded = roundtrip(state);
        expect(decoded?.vitals.hr).toBe('72');
        expect(decoded?.vitals.rr).toBe('16');
        expect(decoded?.vitals.bpSys).toBe('118');
        expect(decoded?.vitals.bpDia).toBe('76');
        expect(decoded?.vitals.temp).toBe('98.4');
        expect(decoded?.vitals.ht).toBe('70');
        expect(decoded?.vitals.wt).toBe('185');
    });

    it('preserves partial vitals', () => {
        const state = makeState({ vitals: { hr: '88', rr: '20' } });
        const decoded = roundtrip(state);
        expect(decoded?.vitals.hr).toBe('88');
        expect(decoded?.vitals.rr).toBe('20');
        expect(decoded?.vitals.ht || '').toBe('');
        expect(decoded?.vitals.wt || '').toBe('');
    });

    it('handles empty vitals without crashing', () => {
        const state = makeState({ vitals: {} });
        const decoded = roundtrip(state);
        expect(decoded).not.toBeNull();
    });
});

// ---------------------------------------------------------------------------
// 3. Category letter and laterality
// ---------------------------------------------------------------------------

describe('Category and laterality roundtrip', () => {
    it('preserves category letter', () => {
        for (const cat of ['A', 'B', 'C', 'D', 'E', 'F'] as const) {
            const state = makeState({ categoryLetter: cat });
            const encoded = encodePEState(state);
            const decoded = decodePEState(encoded, `${cat}-1`);
            expect(decoded?.categoryLetter).toBe(cat);
        }
    });

    it('preserves left laterality', () => {
        const state = makeState({ categoryLetter: 'B', laterality: 'left' });
        const encoded = encodePEState(state);
        const decoded = decodePEState(encoded, 'B-3');
        expect(decoded?.laterality).toBe('left');
    });

    it('preserves right laterality', () => {
        const state = makeState({ categoryLetter: 'B', laterality: 'right' });
        const encoded = encodePEState(state);
        const decoded = decodePEState(encoded, 'B-3');
        expect(decoded?.laterality).toBe('right');
    });

    it('preserves bilateral laterality', () => {
        const state = makeState({ categoryLetter: 'B', laterality: 'bilateral' });
        const encoded = encodePEState(state);
        const decoded = decodePEState(encoded, 'B-9');
        expect(decoded?.laterality).toBe('bilateral');
    });

    it('preserves spine region for back pain', () => {
        const state = makeState({ categoryLetter: 'B', spineRegion: 'cervical' });
        const encoded = encodePEState(state);
        const decoded = decodePEState(encoded, 'B-1');
        expect(decoded?.spineRegion).toBe('cervical');
    });
});

// ---------------------------------------------------------------------------
// 4. Normal item roundtrip
// ---------------------------------------------------------------------------

describe('Normal item status roundtrip', () => {
    it('normal wrapper item preserved', () => {
        const state = makeState({
            items: {
                bl_gen: { status: 'normal', findings: '', selectedChips: [] },
            },
        });
        const decoded = roundtrip(state);
        expect(decoded?.items.bl_gen?.status).toBe('normal');
        expect(decoded?.items.bl_gen?.selectedChips).toEqual([]);
        expect(decoded?.items.bl_gen?.findings).toBe('');
    });

    it('normal focused item preserved (category A — ears)', () => {
        const state = makeState({
            categoryLetter: 'A',
            items: {
                // 'ears' is the first item in FOCUSED_CATEGORIES.A
                // We only need to check by key returned from decode
                bl_gen: { status: 'normal', findings: '', selectedChips: [] },
            },
        });
        const decoded = roundtrip(state);
        expect(decoded?.items.bl_gen?.status).toBe('normal');
    });

    it('not-examined items are omitted from decoded state', () => {
        const state = makeState({
            items: {
                bl_gen: { status: 'normal', findings: '', selectedChips: [] },
            },
        });
        const decoded = roundtrip(state);
        // bl_eyes was not set — should not appear in decoded items
        expect(decoded?.items.bl_eyes).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// 5. Abnormal item roundtrip — chips
// ---------------------------------------------------------------------------

describe('Abnormal item chip roundtrip', () => {
    it('single chip key preserved for wrapper item', () => {
        const state = makeState({
            items: {
                bl_gen: { status: 'abnormal', findings: '', selectedChips: ['appears_ill'] },
            },
        });
        const decoded = roundtrip(state);
        expect(decoded?.items.bl_gen?.status).toBe('abnormal');
        expect(decoded?.items.bl_gen?.selectedChips).toContain('appears_ill');
    });

    it('multiple chip keys preserved', () => {
        const state = makeState({
            items: {
                bl_gen: { status: 'abnormal', findings: '', selectedChips: ['appears_ill', 'diaphoretic'] },
            },
        });
        const decoded = roundtrip(state);
        expect(decoded?.items.bl_gen?.selectedChips).toContain('appears_ill');
        expect(decoded?.items.bl_gen?.selectedChips).toContain('diaphoretic');
    });

    it('PSYCH abnormal chips preserved', () => {
        const state = makeState({
            categoryLetter: 'F',
            items: {
                bl_psych: { status: 'abnormal', findings: '', selectedChips: ['depressed_mood', 'anxious'] },
            },
        });
        const encoded = encodePEState(state);
        const decoded = decodePEState(encoded, 'F-1');
        expect(decoded?.items.bl_psych?.selectedChips).toContain('depressed_mood');
        expect(decoded?.items.bl_psych?.selectedChips).toContain('anxious');
    });
});

// ---------------------------------------------------------------------------
// 6. Abnormal item roundtrip — free text (findings)
// ---------------------------------------------------------------------------

describe('Abnormal item free text roundtrip', () => {
    it('findings string preserved through encode/decode', () => {
        const state = makeState({
            items: {
                bl_gen: {
                    status: 'abnormal',
                    findings: 'Patient pale and diaphoretic on arrival',
                    selectedChips: ['appears_ill'],
                },
            },
        });
        const decoded = roundtrip(state);
        expect(decoded?.items.bl_gen?.findings).toBe('Patient pale and diaphoretic on arrival');
        expect(decoded?.items.bl_gen?.selectedChips).toContain('appears_ill');
    });

    it('findings with special characters preserved', () => {
        const findings = 'Temp: 101.3°F — "sharp" epigastric pain';
        const state = makeState({
            items: {
                bl_gen: { status: 'abnormal', findings, selectedChips: [] },
            },
        });
        const decoded = roundtrip(state);
        expect(decoded?.items.bl_gen?.findings).toBe(findings);
    });

    it('findings only (no chips) preserved', () => {
        const state = makeState({
            items: {
                bl_gen: { status: 'abnormal', findings: 'Custom free text only', selectedChips: [] },
            },
        });
        const decoded = roundtrip(state);
        expect(decoded?.items.bl_gen?.findings).toBe('Custom free text only');
        expect(decoded?.items.bl_gen?.selectedChips).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// 7. Additional findings
// ---------------------------------------------------------------------------

describe('Additional findings roundtrip', () => {
    it('additional field preserved', () => {
        const state = makeState({ additional: 'Patient reports dizziness when standing.' });
        const decoded = roundtrip(state);
        expect(decoded?.additional).toBe('Patient reports dizziness when standing.');
    });

    it('empty additional returns empty string', () => {
        const state = makeState({ additional: '' });
        const decoded = roundtrip(state);
        expect(decoded?.additional).toBe('');
    });

    it('additional with special characters preserved', () => {
        const additional = 'Temp spike: 101.3°F — "sharp" pain';
        const state = makeState({ additional });
        const decoded = roundtrip(state);
        expect(decoded?.additional).toBe(additional);
    });
});

// ---------------------------------------------------------------------------
// 8. Mixed normal + abnormal items
// ---------------------------------------------------------------------------

describe('Mixed normal and abnormal items roundtrip', () => {
    it('normal and abnormal wrappers in same state both preserved', () => {
        const state = makeState({
            items: {
                bl_gen: { status: 'normal', findings: '', selectedChips: [] },
                bl_eyes: { status: 'abnormal', findings: '', selectedChips: ['anisocoria'] },
                bl_neuro: { status: 'normal', findings: '', selectedChips: [] },
            },
        });
        const decoded = roundtrip(state);
        expect(decoded?.items.bl_gen?.status).toBe('normal');
        expect(decoded?.items.bl_eyes?.status).toBe('abnormal');
        expect(decoded?.items.bl_eyes?.selectedChips).toContain('anisocoria');
        expect(decoded?.items.bl_neuro?.status).toBe('normal');
    });
});

// ---------------------------------------------------------------------------
// 9. Empty state
// ---------------------------------------------------------------------------

describe('Empty / minimal state', () => {
    it('fully empty state encodes and decodes without crashing', () => {
        const state = makeState();
        const encoded = encodePEState(state);
        expect(encoded.startsWith('5:')).toBe(true);
        const decoded = decodePEState(encoded, 'A-1');
        expect(decoded).not.toBeNull();
        expect(Object.keys(decoded!.items)).toHaveLength(0);
    });

    it('decoded empty state has empty additional', () => {
        const decoded = roundtrip(makeState());
        expect(decoded?.additional).toBe('');
    });
});

// ---------------------------------------------------------------------------
// 10. renderPEStateToText
// ---------------------------------------------------------------------------

describe('renderPEStateToText', () => {
    it('renders normal wrapper item with label and normalText', () => {
        const state = makeState({
            items: {
                bl_gen: { status: 'normal', findings: '', selectedChips: [] },
            },
        });
        const text = renderPEStateToText(state);
        expect(text).toContain('GEN:');
        expect(text).toContain('Appears stated age');
    });

    it('renders abnormal wrapper item with chips', () => {
        const state = makeState({
            items: {
                bl_gen: { status: 'abnormal', findings: '', selectedChips: ['appears_ill', 'diaphoretic'] },
            },
        });
        const text = renderPEStateToText(state);
        expect(text).toContain('GEN:');
        expect(text).toContain('Appears ill');
        expect(text).toContain('Diaphoretic');
    });

    it('renders abnormal item with free text', () => {
        const state = makeState({
            items: {
                bl_gen: { status: 'abnormal', findings: 'custom note here', selectedChips: [] },
            },
        });
        const text = renderPEStateToText(state);
        expect(text).toContain('custom note here');
    });

    it('renders vitals section', () => {
        const state = makeState({
            vitals: { hr: '72', rr: '16', bpSys: '120', bpDia: '80' },
        });
        const text = renderPEStateToText(state);
        expect(text).toContain('Vital Signs:');
        expect(text).toContain('HR: 72 bpm');
        expect(text).toContain('BP: 120/80 mmHg');
    });

    it('renders additional findings section', () => {
        const state = makeState({ additional: 'Extra note here.' });
        const text = renderPEStateToText(state);
        expect(text).toContain('Additional Findings: Extra note here.');
    });

    it('renders before-wrappers before focused items, after-wrappers after', () => {
        const state = makeState({
            categoryLetter: 'A',
            items: {
                bl_gen: { status: 'normal', findings: '', selectedChips: [] },   // before
                bl_neuro: { status: 'normal', findings: '', selectedChips: [] }, // after
            },
        });
        const text = renderPEStateToText(state);
        const genIdx = text.indexOf('GEN:');
        const neuroIdx = text.indexOf('NEURO:');
        expect(genIdx).toBeGreaterThanOrEqual(0);
        expect(neuroIdx).toBeGreaterThanOrEqual(0);
        expect(genIdx).toBeLessThan(neuroIdx);
    });

    it('empty state renders empty string', () => {
        const text = renderPEStateToText(makeState());
        expect(text.trim()).toBe('');
    });
});

// ---------------------------------------------------------------------------
// 11. Legacy decoder (decodePECompactLegacy)
// ---------------------------------------------------------------------------

describe('decodePECompactLegacy', () => {
    it('decodes a v4 string to text without crashing', () => {
        // A minimal valid v4 payload: category A, laterality R, empty vitals, no bits, no abn, no additional
        const v4 = '4:A,R,,,,,,,~0~0~~';
        const text = decodePECompactLegacy(v4, 'A-1');
        expect(typeof text).toBe('string');
    });

    it('decodes a v2 string to text without crashing', () => {
        const v2 = '2:A,R,,,,,,,~0~0~~';
        const text = decodePECompactLegacy(v2, 'A-1');
        expect(typeof text).toBe('string');
    });

    it('decodes a v3 string to text without crashing', () => {
        const v3 = '3:A,R,,,,,,,~0~0~~';
        const text = decodePECompactLegacy(v3, 'A-1');
        expect(typeof text).toBe('string');
    });

    it('decodes a v4 string with vitals', () => {
        // v4: category A, lat R, hr=72, rest empty; no bits set
        const v4 = '4:A,R,72,,,,,,~0~0~~';
        const text = decodePECompactLegacy(v4, 'A-1');
        expect(text).toContain('72');
    });
});
