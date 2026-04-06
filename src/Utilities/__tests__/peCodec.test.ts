// Unit tests for peCodec v8 encode/decode roundtrips
// Tests encodePEState / decodePEState / renderPEStateToText directly from PEState.

import { describe, it, expect } from 'vitest';
import { encodePEState, decodePEState, renderPEStateToText } from '../peCodec';
import { MASTER_BLOCK_LIBRARY, getBlocksForFocusedExam } from '../../Data/PhysicalExamData';
import type { PEState, PEItemState } from '../../Types/PETypes';

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
        mode: 'focused',
        ...overrides,
    };
}

/** Encode then decode back to PEState. */
function roundtrip(state: PEState, symptomCode = 'A-1'): PEState | null {
    const encoded = encodePEState(state, symptomCode);
    return decodePEState(encoded, symptomCode);
}

/** Build default "all normal" item for a block key. */
function normalItem(blockKey: string): PEItemState {
    const block = MASTER_BLOCK_LIBRARY[blockKey];
    return {
        status: 'normal',
        selectedNormals: block.findings.map(f => f.key),
        selectedAbnormals: [],
        findings: '',
    };
}

/** Get canonical block keys for a focused exam. */
function canonicalKeys(cat: PEState['categoryLetter'], code: string): string[] {
    return getBlocksForFocusedExam(cat, code).blocks.map(b => b.key);
}

// ---------------------------------------------------------------------------
// 1. Format detection
// ---------------------------------------------------------------------------

describe('v8 format detection', () => {
    it('encoded string starts with "8:" for any category', () => {
        const encoded = encodePEState(makeState(), 'A-1');
        expect(encoded.startsWith('8:')).toBe(true);
    });

    it('decodePEState returns null for non-v8 strings', () => {
        expect(decodePEState('6:A,R,,,,,,,~0~0~~', 'A-1')).toBeNull();
        expect(decodePEState('7:A,R,F,,,,,,,~~', 'A-1')).toBeNull();
        expect(decodePEState('some random text', 'A-1')).toBeNull();
        expect(decodePEState('', 'A-1')).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// 2. All normal → empty PE body
// ---------------------------------------------------------------------------

describe('All normal encoding', () => {
    it('all-normal exam produces empty PE body between tildes', () => {
        const keys = canonicalKeys('A', 'A-1');
        const items: Record<string, PEItemState> = {};
        for (const key of keys) items[key] = normalItem(key);

        const state = makeState({ items });
        const encoded = encodePEState(state, 'A-1');
        const sections = encoded.split('~');
        expect(sections[1]).toBe('');
    });

    it('roundtrip preserves all-normal state', () => {
        const keys = canonicalKeys('A', 'A-1');
        const items: Record<string, PEItemState> = {};
        for (const key of keys) items[key] = normalItem(key);

        const state = makeState({ items });
        const decoded = roundtrip(state)!;

        for (const key of keys) {
            expect(decoded.items[key]?.status).toBe('normal');
            expect(decoded.items[key]?.selectedAbnormals).toEqual([]);
        }
    });

    it('empty state encodes and decodes — unlisted blocks filled as all normal', () => {
        const state = makeState();
        const decoded = roundtrip(state)!;
        expect(decoded).not.toBeNull();
        const keys = canonicalKeys('A', 'A-1');
        for (const key of keys) {
            expect(decoded.items[key]?.status).toBe('normal');
        }
    });
});

// ---------------------------------------------------------------------------
// 3. Vitals roundtrip
// ---------------------------------------------------------------------------

describe('Vitals roundtrip', () => {
    it('preserves all vital sign fields', () => {
        const state = makeState({
            vitals: { hr: '72', rr: '16', bpSys: '118', bpDia: '76', temp: '98.4', ht: '70', wt: '185' },
        });
        const decoded = roundtrip(state)!;
        expect(decoded.vitals.hr).toBe('72');
        expect(decoded.vitals.rr).toBe('16');
        expect(decoded.vitals.bpSys).toBe('118');
        expect(decoded.vitals.bpDia).toBe('76');
        expect(decoded.vitals.temp).toBe('98.4');
        expect(decoded.vitals.ht).toBe('70');
        expect(decoded.vitals.wt).toBe('185');
    });

    it('preserves partial vitals', () => {
        const state = makeState({ vitals: { hr: '88', rr: '20' } });
        const decoded = roundtrip(state)!;
        expect(decoded.vitals.hr).toBe('88');
        expect(decoded.vitals.rr).toBe('20');
        expect(decoded.vitals.ht || '').toBe('');
    });
});

// ---------------------------------------------------------------------------
// 4. Category letter and laterality
// ---------------------------------------------------------------------------

describe('Category and laterality roundtrip', () => {
    it('preserves category letter', () => {
        for (const cat of ['A', 'C', 'D', 'E', 'F'] as const) {
            const state = makeState({ categoryLetter: cat });
            const encoded = encodePEState(state, `${cat}-1`);
            const decoded = decodePEState(encoded, `${cat}-1`);
            expect(decoded?.categoryLetter).toBe(cat);
        }
    });

    it('preserves left laterality', () => {
        const state = makeState({ categoryLetter: 'B', laterality: 'left' });
        const encoded = encodePEState(state, 'B-3');
        const decoded = decodePEState(encoded, 'B-3');
        expect(decoded?.laterality).toBe('left');
    });

    it('preserves bilateral laterality', () => {
        const state = makeState({ categoryLetter: 'B', laterality: 'bilateral' });
        const encoded = encodePEState(state, 'B-9');
        const decoded = decodePEState(encoded, 'B-9');
        expect(decoded?.laterality).toBe('bilateral');
    });

    it('preserves spine region for back pain', () => {
        const state = makeState({ categoryLetter: 'B', spineRegion: 'cervical' });
        const encoded = encodePEState(state, 'B-1');
        const decoded = decodePEState(encoded, 'B-1');
        expect(decoded?.spineRegion).toBe('cervical');
    });
});

// ---------------------------------------------------------------------------
// 5. Abnormal items
// ---------------------------------------------------------------------------

describe('Abnormal item roundtrip', () => {
    it('single abnormal on gen block preserved', () => {
        const genBlock = MASTER_BLOCK_LIBRARY['gen'];
        const state = makeState({
            items: {
                gen: {
                    status: 'abnormal',
                    selectedNormals: ['appearsStatedAge', 'wnwd'],
                    selectedAbnormals: ['acuteDistress'],
                    findings: '',
                },
            },
        });
        const decoded = roundtrip(state)!;
        expect(decoded.items.gen?.status).toBe('abnormal');
        expect(decoded.items.gen?.selectedAbnormals).toContain('acuteDistress');
        expect(decoded.items.gen?.selectedNormals).toContain('appearsStatedAge');
        expect(decoded.items.gen?.selectedNormals).toContain('wnwd');
    });

    it('multiple abnormals preserved', () => {
        const state = makeState({
            items: {
                gen: {
                    status: 'abnormal',
                    selectedNormals: [],
                    selectedAbnormals: ['acuteDistress', 'mildDistress'],
                    findings: '',
                },
            },
        });
        const decoded = roundtrip(state)!;
        expect(decoded.items.gen?.selectedAbnormals).toContain('acuteDistress');
        expect(decoded.items.gen?.selectedAbnormals).toContain('mildDistress');
    });

    it('abnormals on ears block preserved', () => {
        const state = makeState({
            items: {
                ears: {
                    status: 'abnormal',
                    selectedNormals: ['pinnaNormalNontender', 'mastoidNontender', 'eacClear'],
                    selectedAbnormals: ['tmErythema', 'tmBulging'],
                    findings: '',
                },
            },
        });
        const decoded = roundtrip(state)!;
        expect(decoded.items.ears?.selectedAbnormals).toContain('tmErythema');
        expect(decoded.items.ears?.selectedAbnormals).toContain('tmBulging');
        expect(decoded.items.ears?.selectedNormals).toContain('pinnaNormalNontender');
    });
});

// ---------------------------------------------------------------------------
// 6. Free text
// ---------------------------------------------------------------------------

describe('Free text roundtrip', () => {
    it('block-level free text preserved', () => {
        const state = makeState({
            items: {
                gen: {
                    status: 'abnormal',
                    selectedNormals: [],
                    selectedAbnormals: ['acuteDistress'],
                    findings: 'Patient pale and diaphoretic on arrival',
                },
            },
        });
        const decoded = roundtrip(state)!;
        expect(decoded.items.gen?.findings).toBe('Patient pale and diaphoretic on arrival');
    });

    it('free text only (no abnormals) preserved', () => {
        const state = makeState({
            items: {
                gen: {
                    status: 'abnormal',
                    selectedNormals: ['appearsStatedAge'],
                    selectedAbnormals: [],
                    findings: 'Custom note here',
                },
            },
        });
        const decoded = roundtrip(state)!;
        expect(decoded.items.gen?.findings).toBe('Custom note here');
    });

});

// ---------------------------------------------------------------------------
// 7. Additional findings
// ---------------------------------------------------------------------------

describe('Additional findings roundtrip', () => {
    it('additional field preserved', () => {
        const state = makeState({ additional: 'Patient reports dizziness when standing.' });
        const decoded = roundtrip(state)!;
        expect(decoded.additional).toBe('Patient reports dizziness when standing.');
    });

    it('empty additional returns empty string', () => {
        const decoded = roundtrip(makeState())!;
        expect(decoded.additional).toBe('');
    });
});

// ---------------------------------------------------------------------------
// 8. Partial exam
// ---------------------------------------------------------------------------

describe('Partial exam roundtrip', () => {
    it('block with only baseline findings assessed uses partial syntax', () => {
        // gen has 8 findings total, 3 baseline. Set only baseline + one abnormal.
        const state = makeState({
            items: {
                gen: {
                    status: 'abnormal',
                    selectedNormals: ['appearsStatedAge', 'wnwd'],
                    selectedAbnormals: ['acuteDistress'],
                    findings: '',
                },
            },
        });
        const encoded = encodePEState(state, 'A-1');
        // Should contain [ ] partial syntax since only 3 of 8 findings assessed
        expect(encoded).toMatch(/\[.*?\]/);

        const decoded = decodePEState(encoded, 'A-1')!;
        expect(decoded.items.gen?.selectedNormals).toEqual(['appearsStatedAge', 'wnwd']);
        expect(decoded.items.gen?.selectedAbnormals).toEqual(['acuteDistress']);
    });
});

// ---------------------------------------------------------------------------
// 9. Block reorder
// ---------------------------------------------------------------------------

describe('Block reorder roundtrip', () => {
    it('custom blockOrder preserved via !{indices} prefix', () => {
        const keys = canonicalKeys('A', 'A-1');
        // Reverse first 4 blocks
        const reordered = [keys[3], keys[2], keys[1], keys[0], ...keys.slice(4)];
        const state = makeState({ blockOrder: reordered });
        const encoded = encodePEState(state, 'A-1');
        expect(encoded).toContain('!{');

        const decoded = decodePEState(encoded, 'A-1')!;
        expect(decoded.blockOrder).toEqual(reordered);
    });
});

// ---------------------------------------------------------------------------
// 10. Template mode
// ---------------------------------------------------------------------------

describe('Template mode roundtrip', () => {
    it('preserves template mode with block keys', () => {
        const state = makeState({
            mode: 'template',
            blockKeys: ['gen', 'cv', 'pulm'],
            items: {
                gen: normalItem('gen'),
                cv: normalItem('cv'),
                pulm: normalItem('pulm'),
            },
        });
        const encoded = encodePEState(state);
        expect(encoded).toContain('T:gen,cv,pulm');

        const decoded = decodePEState(encoded, 'A-1')!;
        expect(decoded.mode).toBe('template');
        expect(decoded.blockKeys).toEqual(['gen', 'cv', 'pulm']);
        expect(decoded.items.gen?.status).toBe('normal');
        expect(decoded.items.cv?.status).toBe('normal');
    });

    it('template mode with abnormals roundtrips', () => {
        const state = makeState({
            mode: 'template',
            blockKeys: ['gen', 'cv'],
            items: {
                gen: normalItem('gen'),
                cv: {
                    status: 'abnormal',
                    selectedNormals: [],
                    selectedAbnormals: ['tachycardia'],
                    findings: '',
                },
            },
        });
        const decoded = roundtrip(state)!;
        expect(decoded.items.cv?.selectedAbnormals).toContain('tachycardia');
    });
});

// ---------------------------------------------------------------------------
// 11. Size comparison
// ---------------------------------------------------------------------------

describe('v8 size efficiency', () => {
    it('all-normal exam is significantly shorter than v7 would be', () => {
        const keys = canonicalKeys('A', 'A-1');
        const items: Record<string, PEItemState> = {};
        for (const key of keys) items[key] = normalItem(key);

        const state = makeState({ items });
        const encoded = encodePEState(state, 'A-1');
        // All normal = empty PE body, so the string should be compact
        const peBody = encoded.split('~')[1];
        expect(peBody).toBe('');
    });
});

// ---------------------------------------------------------------------------
// 12. renderPEStateToText
// ---------------------------------------------------------------------------

describe('renderPEStateToText', () => {
    it('renders normal block with normal text', () => {
        const state = makeState({
            items: {
                gen: {
                    status: 'normal',
                    selectedNormals: ['appearsStatedAge', 'wnwd', 'noAcuteDistress'],
                    selectedAbnormals: [],
                    findings: '',
                },
            },
        });
        const text = renderPEStateToText(state);
        expect(text).toContain('GENERAL:');
        expect(text).toContain('Appears stated age');
    });

    it('renders abnormal block with abnormal labels', () => {
        const state = makeState({
            items: {
                gen: {
                    status: 'abnormal',
                    selectedNormals: [],
                    selectedAbnormals: ['acuteDistress', 'mildDistress'],
                    findings: '',
                },
            },
        });
        const text = renderPEStateToText(state);
        expect(text).toContain('GENERAL:');
        expect(text).toContain('Acute distress');
        expect(text).toContain('Mild distress');
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
});
