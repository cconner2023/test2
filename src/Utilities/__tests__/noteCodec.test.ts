// Unit tests for NoteCodec round-trips
// Tests the public API exported from the barrel file ../NoteCodec

import { describe, it, expect } from 'vitest';
import {
    compressText,
    decompressText,
    bitmaskToIndices,
    indicesToBitmask,
    decodePECompact,
    encodeNoteState,
    encodeProviderNote,
    encodeProviderBundle,
    parseNoteEncoding,
    encodedContentEquals,
    reconstructCardStates,
    findAlgorithmByCode,
    findSymptomByCode,
} from '../NoteCodec';
import { encodePEState } from '../peCodec';
import type { PEState } from '../../Types/PETypes';
import type { NoteEncodeOptions } from '../NoteCodec';
import type { AlgorithmOptions } from '../../Types/AlgorithmTypes';
import type { CardState } from '../../Hooks/useAlgorithm';

// ---------------------------------------------------------------------------
// Minimal mock algorithm for encoding/decoding tests
// Mirrors the structure of a real algorithm (RF card + initial card + choice card)
// ---------------------------------------------------------------------------
const mockAlgorithm: AlgorithmOptions[] = [
    {
        text: 'Red Flags',
        type: 'rf',
        questionOptions: [
            { text: 'Flag A' },
            { text: 'Flag B' },
            { text: 'Flag C' },
        ],
        answerOptions: [],
    },
    {
        text: 'Are red flags present?',
        type: 'initial',
        questionOptions: [],
        answerOptions: [
            {
                text: 'Yes',
                disposition: [{ type: 'CAT I', text: 'Provider Now' }],
                next: null,
                selectAll: true,
            },
            {
                text: 'No',
                disposition: [],
                next: 2,
                selectAll: false,
            },
        ],
    },
    {
        text: 'Do any of the following apply?',
        type: 'choice',
        questionOptions: [
            { text: 'Symptom X' },
            { text: 'Symptom Y' },
        ],
        answerOptions: [
            {
                text: 'Yes',
                disposition: [{ type: 'CAT II', text: 'AEM Now' }],
                next: null,
                selectAll: true,
            },
            {
                text: 'No',
                disposition: [{ type: 'CAT III', text: 'Treatment Protocol and RTD' }],
                next: null,
                selectAll: false,
            },
        ],
    },
];

/** Build initial card states matching the mock algorithm. */
function buildCardStates(overrides?: Partial<Record<number, Partial<CardState>>>): CardState[] {
    const states: CardState[] = mockAlgorithm.map((_, index) => ({
        index,
        isVisible: index <= 1, // RF + initial visible by default
        answer: null,
        selectedOptions: [],
        count: 0,
    }));
    if (overrides) {
        for (const [idx, patch] of Object.entries(overrides)) {
            Object.assign(states[Number(idx)], patch);
        }
    }
    return states;
}

// ═══════════════════════════════════════════════════════════════════════════
// Text Codec round-trips
// ═══════════════════════════════════════════════════════════════════════════
describe('Text Codec', () => {
    it('compressText -> decompressText returns original text', () => {
        const original = 'Patient presents with sore throat, mild fever, and cough for 3 days.';
        const compressed = compressText(original);
        const decompressed = decompressText(compressed);
        expect(decompressed).toBe(original);
    });

    it('compressText -> decompressText handles short strings', () => {
        const original = 'OK';
        const compressed = compressText(original);
        const decompressed = decompressText(compressed);
        expect(decompressed).toBe(original);
    });

    it('compressText -> decompressText handles empty string', () => {
        const original = '';
        const compressed = compressText(original);
        const decompressed = decompressText(compressed);
        expect(decompressed).toBe(original);
    });

    it('compressText -> decompressText handles unicode and special characters', () => {
        const original = 'Temperature: 101.3°F — patient reports "sharp" pain';
        const compressed = compressText(original);
        const decompressed = decompressText(compressed);
        expect(decompressed).toBe(original);
    });

    it('decompressText handles legacy base64 format', () => {
        // Legacy format was btoa(encodeURIComponent(text))
        const original = 'Simple text note';
        const legacy = btoa(encodeURIComponent(original));
        // Legacy format does NOT start with "!"
        expect(legacy.startsWith('!')).toBe(false);
        const decompressed = decompressText(legacy);
        expect(decompressed).toBe(original);
    });

    it('bitmaskToIndices <-> indicesToBitmask are inverses', () => {
        const indices = [0, 2, 4, 7];
        const bitmask = indicesToBitmask(indices);
        const recovered = bitmaskToIndices(bitmask);
        expect(recovered).toEqual(indices);
    });

    it('bitmaskToIndices <-> indicesToBitmask round-trip with single bit', () => {
        const indices = [5];
        const bitmask = indicesToBitmask(indices);
        expect(bitmask).toBe(32); // 1 << 5
        const recovered = bitmaskToIndices(bitmask);
        expect(recovered).toEqual(indices);
    });

    it('bitmaskToIndices <-> indicesToBitmask round-trip with empty array', () => {
        const indices: number[] = [];
        const bitmask = indicesToBitmask(indices);
        expect(bitmask).toBe(0);
        const recovered = bitmaskToIndices(bitmask);
        expect(recovered).toEqual(indices);
    });

    it('bitmaskToIndices <-> indicesToBitmask round-trip with all low bits set', () => {
        const indices = [0, 1, 2, 3, 4, 5, 6, 7];
        const bitmask = indicesToBitmask(indices);
        expect(bitmask).toBe(0xFF);
        const recovered = bitmaskToIndices(bitmask);
        expect(recovered).toEqual(indices);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// Note encoding round-trips
// ═══════════════════════════════════════════════════════════════════════════
describe('Note Encoding round-trips', () => {
    const symptomCode = 'A1';

    it('encodeNoteState -> parseNoteEncoding preserves symptom code', () => {
        const states = buildCardStates();
        const opts: NoteEncodeOptions = {
            includeAlgorithm: true,
            includeDecisionMaking: false,
            customNote: '',
        };

        const encoded = encodeNoteState(mockAlgorithm, states, opts, symptomCode);
        const parsed = parseNoteEncoding(encoded);

        expect(parsed).not.toBeNull();
        expect(parsed!.symptomCode).toBe(symptomCode);
    });

    it('encodeNoteState -> parseNoteEncoding preserves RF selections', () => {
        const states = buildCardStates({
            0: { selectedOptions: [0, 2], count: 2 },
        });
        const opts: NoteEncodeOptions = {
            includeAlgorithm: true,
            includeDecisionMaking: false,
            customNote: '',
        };

        const encoded = encodeNoteState(mockAlgorithm, states, opts, symptomCode);
        const parsed = parseNoteEncoding(encoded);

        expect(parsed).not.toBeNull();
        expect(parsed!.rfSelections).toEqual([0, 2]);
    });

    it('encodeNoteState -> parseNoteEncoding preserves card entries', () => {
        const yesAnswer = mockAlgorithm[2].answerOptions[0];
        const states = buildCardStates({
            2: {
                isVisible: true,
                selectedOptions: [0, 1],
                count: 2,
                answer: yesAnswer,
            },
        });
        const opts: NoteEncodeOptions = {
            includeAlgorithm: true,
            includeDecisionMaking: true,
            customNote: '',
        };

        const encoded = encodeNoteState(mockAlgorithm, states, opts, symptomCode);
        const parsed = parseNoteEncoding(encoded);

        expect(parsed).not.toBeNull();
        expect(parsed!.cardEntries.length).toBeGreaterThanOrEqual(1);

        const card2Entry = parsed!.cardEntries.find(e => e.index === 2);
        expect(card2Entry).toBeDefined();
        expect(card2Entry!.selections).toEqual([0, 1]);
        expect(card2Entry!.answerIndex).toBe(0); // "Yes" is index 0
    });

    it('encodeNoteState -> parseNoteEncoding preserves HPI text', () => {
        const states = buildCardStates();
        const hpiText = 'Patient reports 3-day history of sore throat with associated fever.';
        const opts: NoteEncodeOptions = {
            includeAlgorithm: true,
            includeDecisionMaking: true,
            customNote: hpiText,
        };

        const encoded = encodeNoteState(mockAlgorithm, states, opts, symptomCode);
        const parsed = parseNoteEncoding(encoded);

        expect(parsed).not.toBeNull();
        expect(parsed!.hpiText).toBe(hpiText);
    });

    it('encodeNoteState -> parseNoteEncoding preserves flags', () => {
        const states = buildCardStates();
        const opts: NoteEncodeOptions = {
            includeAlgorithm: true,
            includeDecisionMaking: true,
            customNote: 'Some note',
        };

        const encoded = encodeNoteState(mockAlgorithm, states, opts, symptomCode);
        const parsed = parseNoteEncoding(encoded);

        expect(parsed).not.toBeNull();
        expect(parsed!.flags.includeAlgorithm).toBe(true);
        expect(parsed!.flags.includeDecisionMaking).toBe(true);
        // HPI flag is set when customNote is present
        expect(parsed!.flags.includeHPI).toBe(true);
    });

    it('encodeNoteState -> parseNoteEncoding preserves PE text via v4 encoding', () => {
        // Using a symptom code that maps to a PE category (A-1 -> HEENT)
        const peCode = 'A-1';
        const states = buildCardStates();
        const peText = 'Vital Signs:\n  HR: 72 bpm\n  RR: 16 /min\n\nGEN: Appears stated age, well-developed, well-nourished, no acute distress.';
        const opts: NoteEncodeOptions = {
            includeAlgorithm: true,
            includeDecisionMaking: false,
            customNote: '',
            physicalExamNote: peText,
        };

        const encoded = encodeNoteState(mockAlgorithm, states, opts, peCode);
        const parsed = parseNoteEncoding(encoded);

        expect(parsed).not.toBeNull();
        // parseNoteEncoding decodes peText to plain text during parse
        expect(parsed!.peText).toContain('Vital Signs');
        expect(parsed!.peText).toContain('72');
        expect(parsed!.peText).toContain('GEN');
    });

    it('encodedContentEquals ignores T/I/C segments', () => {
        const states = buildCardStates();
        const opts: NoteEncodeOptions = {
            includeAlgorithm: true,
            includeDecisionMaking: false,
            customNote: '',
        };

        const encoded1 = encodeNoteState(mockAlgorithm, states, opts, symptomCode);

        // Inject synthetic T, I, and C segments — should be stripped
        const parts = encoded1.split('|');
        const withExtra = [...parts, 'T12345', 'I99', 'Cfoo'].join('|');

        // Same content despite extra T/I/C segments
        expect(encodedContentEquals(encoded1, withExtra)).toBe(true);
    });

    it('encodedContentEquals detects different content', () => {
        const states1 = buildCardStates();
        const states2 = buildCardStates({ 0: { selectedOptions: [1], count: 1 } });
        const opts: NoteEncodeOptions = {
            includeAlgorithm: true,
            includeDecisionMaking: false,
            customNote: '',
        };

        const encoded1 = encodeNoteState(mockAlgorithm, states1, opts, symptomCode);
        const encoded2 = encodeNoteState(mockAlgorithm, states2, opts, symptomCode);

        expect(encodedContentEquals(encoded1, encoded2)).toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// PE Codec round-trips (v6 paired-findings API)
// ═══════════════════════════════════════════════════════════════════════════

function makePEState(overrides: Partial<PEState> = {}): PEState {
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

describe('PE Codec', () => {
    it('encodePEState -> decodePECompact round-trip preserves vital signs', () => {
        const symptomCode = 'A-1';
        const state = makePEState({
            vitals: { hr: '80', rr: '18', bpSys: '120', bpDia: '80', temp: '98.6' },
        });

        const compact = encodePEState(state);
        const decoded = decodePECompact(compact, symptomCode);

        expect(decoded).toContain('HR: 80 bpm');
        expect(decoded).toContain('RR: 18 /min');
        expect(decoded).toContain('BP: 120/80 mmHg');
        expect(decoded).toContain('98.6');
    });

    it('encodePEState -> decodePECompact preserves normal exam findings', () => {
        const symptomCode = 'A-1';
        const state = makePEState({
            items: {
                bl_gen: { status: 'normal', findings: '', selectedNormals: ['appearsStatedAge', 'wnwd', 'noAcuteDistress'], selectedAbnormals: [] },
                bl_hent: { status: 'normal', findings: '', selectedNormals: ['normocephalicAtraumatic'], selectedAbnormals: [] },
            },
        });

        const compact = encodePEState(state);
        const decoded = decodePECompact(compact, symptomCode);

        expect(decoded).toContain('GEN:');
        expect(decoded).toContain('Appears stated age');
        expect(decoded).toContain('HENT:');
        expect(decoded).toContain('NCAT');
    });

    it('encodePEState -> decodePECompact preserves abnormal findings', () => {
        const symptomCode = 'A-1';
        const state = makePEState({
            items: {
                cat_a_ears: { status: 'abnormal', findings: '', selectedNormals: [], selectedAbnormals: ['tmErythema', 'tmBulging'] },
            },
        });

        const compact = encodePEState(state);
        const decoded = decodePECompact(compact, symptomCode);

        expect(decoded).toContain('EARS:');
        expect(decoded).toContain('TM erythema');
        expect(decoded).toContain('TM bulging');
    });

    it('encodePEState -> decodePECompact preserves additional findings', () => {
        const symptomCode = 'A-1';
        const state = makePEState({
            items: {
                bl_gen: { status: 'normal', findings: '', selectedNormals: ['appearsStatedAge'], selectedAbnormals: [] },
            },
            additional: 'Patient reports dizziness when standing.',
        });

        const compact = encodePEState(state);
        const decoded = decodePECompact(compact, symptomCode);

        expect(decoded).toContain('Additional Findings');
        expect(decoded).toContain('Patient reports dizziness when standing');
    });

    it('decodePECompact returns empty string for legacy v2 format', () => {
        // Legacy v2-v5 formats are no longer decoded — v6 is the only active format
        const v2Payload = '2:A,R,72,,,,,,~0~0~~';
        const decoded = decodePECompact(v2Payload, 'A-1');
        expect(decoded).toBe('');
    });

    it('encodePEState -> decodePECompact with MSK category preserves laterality', () => {
        const symptomCode = 'B-3';
        const state = makePEState({
            categoryLetter: 'B',
            laterality: 'left',
            vitals: { hr: '65' },
            items: {
                bl_gen: { status: 'normal', findings: '', selectedNormals: ['appearsStatedAge'], selectedAbnormals: [] },
                cat_b_inspection: { status: 'normal', findings: '', selectedNormals: ['noDeformity', 'noSwelling'], selectedAbnormals: [] },
                cat_b_palpation: { status: 'normal', findings: '', selectedNormals: ['nonTender'], selectedAbnormals: [] },
            },
        });

        const compact = encodePEState(state);
        const decoded = decodePECompact(compact, symptomCode);

        expect(decoded).toContain('MSK');
        expect(decoded).toContain('Left');
        expect(decoded).toContain('INSPECTION:');
        expect(decoded).toContain('PALPATION:');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// reconstructCardStates
// ═══════════════════════════════════════════════════════════════════════════
describe('reconstructCardStates', () => {
    it('restores RF selections from parsed note', () => {
        const states = buildCardStates({
            0: { selectedOptions: [1, 2], count: 2 },
        });
        const opts: NoteEncodeOptions = {
            includeAlgorithm: true,
            includeDecisionMaking: false,
            customNote: '',
        };

        const encoded = encodeNoteState(mockAlgorithm, states, opts, 'A1');
        const parsed = parseNoteEncoding(encoded)!;
        const { cardStates } = reconstructCardStates(mockAlgorithm, parsed);

        expect(cardStates[0].selectedOptions).toEqual([1, 2]);
    });

    it('restores card answer and disposition', () => {
        const yesAnswer = mockAlgorithm[2].answerOptions[0]; // "Yes" -> CAT II
        const states = buildCardStates({
            2: {
                isVisible: true,
                selectedOptions: [0],
                count: 1,
                answer: yesAnswer,
            },
        });
        const opts: NoteEncodeOptions = {
            includeAlgorithm: true,
            includeDecisionMaking: true,
            customNote: '',
        };

        const encoded = encodeNoteState(mockAlgorithm, states, opts, 'A1');
        const parsed = parseNoteEncoding(encoded)!;
        const { cardStates, disposition } = reconstructCardStates(mockAlgorithm, parsed);

        expect(cardStates[2].answer).not.toBeNull();
        expect(cardStates[2].answer!.text).toBe('Yes');
        expect(disposition).not.toBeNull();
        expect(disposition!.type).toBe('CAT II');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// Lookup helpers (smoke tests with real Algorithm data)
// ═══════════════════════════════════════════════════════════════════════════
describe('Lookup helpers', () => {
    it('findAlgorithmByCode returns options for A-1', () => {
        const opts = findAlgorithmByCode('A-1');
        expect(opts).not.toBeNull();
        expect(opts!.length).toBeGreaterThan(0);
        expect(opts![0].type).toBe('rf');
    });

    it('findAlgorithmByCode normalizes A1 to A-1', () => {
        const opts = findAlgorithmByCode('A1');
        expect(opts).not.toBeNull();
    });

    it('findAlgorithmByCode returns null for unknown code', () => {
        const opts = findAlgorithmByCode('Z99');
        expect(opts).toBeNull();
    });

    it('findSymptomByCode returns category + symptom for A-1', () => {
        const result = findSymptomByCode('A-1');
        expect(result).not.toBeNull();
        expect(result!.symptom.icon).toBe('A-1');
    });

    it('findSymptomByCode returns null for unknown code', () => {
        const result = findSymptomByCode('Z99');
        expect(result).toBeNull();
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// Error handling
// ═══════════════════════════════════════════════════════════════════════════
describe('Error handling', () => {
    it('parseNoteEncoding returns null for empty string', () => {
        expect(parseNoteEncoding('')).toBeNull();
        expect(parseNoteEncoding('   ')).toBeNull();
    });

    it('parseNoteEncoding returns null for string with no symptom code', () => {
        // Only pipe separators with no content between them → no symptom code
        expect(parseNoteEncoding('|||')).toBeNull();
    });

    it('decompressText handles corrupted base64 gracefully', () => {
        // Should not throw, should return something
        const result = decompressText('not-valid-base64!!!');
        expect(typeof result).toBe('string');
    });

    it('findAlgorithmByCode returns null for empty string', () => {
        expect(findAlgorithmByCode('')).toBeNull();
    });

    it('findSymptomByCode returns null for empty string', () => {
        expect(findSymptomByCode('')).toBeNull();
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// Provider Note encoding
// ═══════════════════════════════════════════════════════════════════════════
describe('Provider Note encoding', () => {
    describe('encodeProviderNote -> parseNoteEncoding round-trip', () => {
        it('preserves all provider text fields', () => {
            const encoded = encodeProviderNote({
                hpiNote: 'Patient presents with headache x3 days, worse with light',
                peNote: 'Alert and oriented x4. No acute distress. HEENT: normocephalic, atraumatic.',
                assessmentNote: 'Tension-type headache, uncomplicated',
                planNote: 'Ibuprofen 800mg TID x5 days. Return if worsens or new symptoms.',
            });
            expect(encoded.startsWith('PRV|')).toBe(true);

            const parsed = parseNoteEncoding(encoded);
            expect(parsed).not.toBeNull();
            expect(parsed!.symptomCode).toBe('PRV');
            expect(parsed!.providerHpi).toBe('Patient presents with headache x3 days, worse with light');
            expect(parsed!.providerPe).toBe('Alert and oriented x4. No acute distress. HEENT: normocephalic, atraumatic.');
            expect(parsed!.providerAssessment).toBe('Tension-type headache, uncomplicated');
            expect(parsed!.providerPlan).toBe('Ibuprofen 800mg TID x5 days. Return if worsens or new symptoms.');
        });

        it('preserves provider user profile', () => {
            const encoded = encodeProviderNote({
                hpiNote: 'Test HPI',
                peNote: '',
                assessmentNote: '',
                planNote: '',
                user: { firstName: 'Jane', lastName: 'Smith', middleInitial: 'A', rank: 'CPT', credential: 'PA-C', component: 'Active Duty' },
            });
            const parsed = parseNoteEncoding(encoded);
            expect(parsed).not.toBeNull();
            expect(parsed!.providerUser?.firstName).toBe('Jane');
            expect(parsed!.providerUser?.lastName).toBe('Smith');
            expect(parsed!.providerUser?.middleInitial).toBe('A');
            expect(parsed!.providerUser?.rank).toBe('CPT');
            expect(parsed!.providerUser?.credential).toBe('PA-C');
        });

        it('preserves provider userId', () => {
            const uuid = '550e8400-e29b-41d4-a716-446655440000';
            const encoded = encodeProviderNote({
                hpiNote: 'HPI', peNote: '', assessmentNote: '', planNote: '',
                userId: uuid,
            });
            const parsed = parseNoteEncoding(encoded);
            expect(parsed!.providerUserId).toBe(uuid);
        });

        it('handles empty fields gracefully', () => {
            const encoded = encodeProviderNote({
                hpiNote: '', peNote: '', assessmentNote: '', planNote: '',
            });
            expect(encoded).toBe('PRV');
            const parsed = parseNoteEncoding(encoded);
            expect(parsed).not.toBeNull();
            expect(parsed!.symptomCode).toBe('PRV');
            expect(parsed!.providerHpi).toBeUndefined();
            expect(parsed!.providerPe).toBeUndefined();
        });

        it('handles special characters and unicode', () => {
            const encoded = encodeProviderNote({
                hpiNote: 'Pt c/o pain — rated 8/10. "Worst ever" per patient.',
                peNote: 'Temp: 98.6°F, BP: 120/80',
                assessmentNote: '',
                planNote: 'Rx: Motrin® 800mg',
            });
            const parsed = parseNoteEncoding(encoded);
            expect(parsed!.providerHpi).toBe('Pt c/o pain — rated 8/10. "Worst ever" per patient.');
            expect(parsed!.providerPe).toBe('Temp: 98.6°F, BP: 120/80');
            expect(parsed!.providerPlan).toBe('Rx: Motrin® 800mg');
        });
    });

    describe('encodeProviderBundle', () => {
        it('appends provider segments to medic barcode', () => {
            const medicBarcode = 'A1|R0|F3';
            const bundled = encodeProviderBundle(medicBarcode, {
                hpiNote: 'Provider HPI addendum',
                peNote: 'Provider PE findings',
                assessmentNote: 'Provider assessment',
                planNote: 'Provider plan',
            });

            // Should start with medic barcode
            expect(bundled.startsWith('A1|R0|F3|')).toBe(true);

            // Should be parseable and contain both layers
            const parsed = parseNoteEncoding(bundled);
            expect(parsed).not.toBeNull();
            expect(parsed!.symptomCode).toBe('A1');
            expect(parsed!.providerHpi).toBe('Provider HPI addendum');
            expect(parsed!.providerPe).toBe('Provider PE findings');
            expect(parsed!.providerAssessment).toBe('Provider assessment');
            expect(parsed!.providerPlan).toBe('Provider plan');
        });

        it('returns original medic barcode when no provider content', () => {
            const medicBarcode = 'A1|R0|F3';
            const bundled = encodeProviderBundle(medicBarcode, {
                hpiNote: '', peNote: '', assessmentNote: '', planNote: '',
            });
            expect(bundled).toBe(medicBarcode);
        });

        it('preserves medic fields in combined parse', () => {
            // Build a realistic medic barcode with HPI
            const medicBarcode = 'A1|R3|1.7.0|H!eJwLSS0u0U1JTQYADHkC9g==|F7';
            const bundled = encodeProviderBundle(medicBarcode, {
                hpiNote: 'Provider addendum',
                peNote: '',
                assessmentNote: 'Concur with medic assessment',
                planNote: '',
            });
            const parsed = parseNoteEncoding(bundled);
            expect(parsed).not.toBeNull();
            expect(parsed!.symptomCode).toBe('A1');
            // Medic HPI should still be present
            expect(parsed!.hpiText).toBeTruthy();
            // Provider fields
            expect(parsed!.providerHpi).toBe('Provider addendum');
            expect(parsed!.providerAssessment).toBe('Concur with medic assessment');
        });
    });

    describe('backward compatibility', () => {
        it('old medic barcodes still parse without provider fields', () => {
            const oldMedic = 'A1|R0|F3';
            const parsed = parseNoteEncoding(oldMedic);
            expect(parsed).not.toBeNull();
            expect(parsed!.symptomCode).toBe('A1');
            expect(parsed!.providerHpi).toBeUndefined();
            expect(parsed!.providerUser).toBeUndefined();
        });

        it('PRV note does not interfere with medic fields', () => {
            const encoded = encodeProviderNote({
                hpiNote: 'Provider note', peNote: '', assessmentNote: '', planNote: '',
            });
            const parsed = parseNoteEncoding(encoded);
            expect(parsed!.hpiText).toBe('');
            expect(parsed!.peText).toBe('');
            expect(parsed!.planText).toBe('');
            expect(parsed!.rfSelections).toEqual([]);
            expect(parsed!.cardEntries).toEqual([]);
        });
    });
});
