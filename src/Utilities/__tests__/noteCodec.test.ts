// Unit tests for NoteCodec round-trips
// Tests the public API exported from the barrel file ../NoteCodec

import { describe, it, expect } from 'vitest';
import {
    compressText,
    decompressText,
    bitmaskToIndices,
    indicesToBitmask,
    encodePECompact,
    decodePECompact,
    encodeNoteState,
    parseNoteEncoding,
    encodedContentEquals,
    reconstructCardStates,
    findAlgorithmByCode,
    findSymptomByCode,
} from '../NoteCodec';
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

    it('encodeNoteState -> parseNoteEncoding preserves PE text via fallback compression', () => {
        // Using a symptom code that maps to a PE category (A-1 -> HEENT)
        const peCode = 'A-1';
        const states = buildCardStates();
        const peText = 'Vital Signs:\n  HR: 72 bpm\n  RR: 16 /min\n\nGEN: Normal - Alert, oriented, no acute distress. Well-developed, well-nourished.';
        const opts: NoteEncodeOptions = {
            includeAlgorithm: true,
            includeDecisionMaking: false,
            customNote: '',
            physicalExamNote: peText,
        };

        const encoded = encodeNoteState(mockAlgorithm, states, opts, peCode);
        const parsed = parseNoteEncoding(encoded);

        expect(parsed).not.toBeNull();
        // The PE text goes through encodePECompact -> decodePECompact round-trip
        // The decoded text should contain the key content
        expect(parsed!.peText).toContain('Vital Signs');
        expect(parsed!.peText).toContain('72');
        expect(parsed!.peText).toContain('GEN');
    });

    it('encodedContentEquals ignores timestamps', () => {
        const states = buildCardStates();
        const opts: NoteEncodeOptions = {
            includeAlgorithm: true,
            includeDecisionMaking: false,
            customNote: '',
        };

        const encoded1 = encodeNoteState(mockAlgorithm, states, opts, symptomCode);
        // Simulate a different timestamp by replacing the T segment
        const parts = encoded1.split('|');
        const tIdx = parts.findIndex(p => p.startsWith('T'));
        expect(tIdx).toBeGreaterThan(-1);
        parts[tIdx] = 'T99999'; // Different timestamp
        const encoded2 = parts.join('|');

        expect(encodedContentEquals(encoded1, encoded2)).toBe(true);
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
// PE Codec round-trips
// ═══════════════════════════════════════════════════════════════════════════
describe('PE Codec', () => {
    it('encodePECompact -> decodePECompact round-trip preserves vital signs', () => {
        const symptomCode = 'A-1'; // Maps to HEENT category
        const peText = [
            'Vital Signs:',
            '  HR: 80 bpm',
            '  RR: 18 /min',
            '  BP: 120/80 mmHg',
            '  Temp: 98.6 °F',
        ].join('\n');

        const compact = encodePECompact(peText, symptomCode);
        const decoded = decodePECompact(compact, symptomCode);

        expect(decoded).toContain('HR: 80 bpm');
        expect(decoded).toContain('RR: 18 /min');
        expect(decoded).toContain('BP: 120/80 mmHg');
        expect(decoded).toContain('Temp: 98.6');
    });

    it('encodePECompact -> decodePECompact preserves normal exam findings', () => {
        const symptomCode = 'A-1';
        const peText = [
            'GEN: Normal - Alert, oriented, no acute distress. Well-developed, well-nourished.',
            'HEAD: Normal - Normocephalic, atraumatic.',
            'Ears: Normal - TMs intact bilaterally, pearly gray. Canals clear. No erythema or effusion.',
        ].join('\n');

        const compact = encodePECompact(peText, symptomCode);
        const decoded = decodePECompact(compact, symptomCode);

        expect(decoded).toContain('GEN: Normal');
        expect(decoded).toContain('HEAD: Normal');
        expect(decoded).toContain('Ears: Normal');
    });

    it('encodePECompact -> decodePECompact preserves abnormal findings with chips', () => {
        const symptomCode = 'A-1';
        const peText = [
            'Ears: Abnormal - TM erythema; TM bulging',
        ].join('\n');

        const compact = encodePECompact(peText, symptomCode);
        const decoded = decodePECompact(compact, symptomCode);

        expect(decoded).toContain('Ears: Abnormal');
        expect(decoded).toContain('TM erythema');
        expect(decoded).toContain('TM bulging');
    });

    it('encodePECompact -> decodePECompact preserves additional findings', () => {
        const symptomCode = 'A-1';
        const peText = [
            'GEN: Normal - Alert, oriented, no acute distress. Well-developed, well-nourished.',
            '',
            'Additional Findings: Patient reports dizziness when standing.',
        ].join('\n');

        const compact = encodePECompact(peText, symptomCode);
        const decoded = decodePECompact(compact, symptomCode);

        expect(decoded).toContain('Additional Findings');
        expect(decoded).toContain('Patient reports dizziness when standing');
    });

    it('decodePECompact handles v2 prefix for backward compat', () => {
        // Build a v3 encoded string first, then manually re-prefix as v2
        // to verify the v2 decoder path is exercised
        const symptomCode = 'A-1';
        const peText = [
            'Vital Signs:',
            '  HR: 72 bpm',
        ].join('\n');

        const compact = encodePECompact(peText, symptomCode);
        // The encoder produces "3:..." format
        expect(compact.startsWith('3:')).toBe(true);

        // Create a v2-prefixed version (strip "3:" and add "2:")
        // Note: v2 uses legacy general findings, so exact reconstruction
        // differs, but the vital signs should still decode
        const v2Payload = '2:' + compact.substring(2);
        const decoded = decodePECompact(v2Payload, symptomCode);

        // Vitals should still be present
        expect(decoded).toContain('72');
        expect(decoded).toContain('Vital Signs');
    });

    it('encodePECompact falls back to compressed text for unknown category', () => {
        // Use a symptom code that won't match any category
        const symptomCode = 'Z-99';
        const peText = 'Some PE text that cannot be structurally encoded.';

        const compact = encodePECompact(peText, symptomCode);
        // Should not start with "3:" since it fell back to compressText
        expect(compact.startsWith('3:')).toBe(false);
        expect(compact.startsWith('2:')).toBe(false);

        // Should still round-trip through decompressText
        const decoded = decompressText(compact);
        expect(decoded).toBe(peText);
    });

    it('encodePECompact -> decodePECompact with MSK category preserves laterality', () => {
        const symptomCode = 'B-3'; // MSK Shoulder
        const peText = [
            'Vital Signs:',
            '  HR: 65 bpm',
            '',
            'GEN: Normal - Alert, oriented, no acute distress. Well-developed, well-nourished.',
            'MSK - Shoulder (Left)',
            'Inspection: Normal - No swelling, erythema, ecchymosis, or deformity.',
            'Palpation: Normal - Non-tender. No crepitus or masses.',
        ].join('\n');

        const compact = encodePECompact(peText, symptomCode);
        const decoded = decodePECompact(compact, symptomCode);

        expect(decoded).toContain('MSK - Shoulder (Left)');
        expect(decoded).toContain('Inspection: Normal');
        expect(decoded).toContain('Palpation: Normal');
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
