// Shared encoding/decoding utilities for note hooks

import type { AlgorithmOptions } from '../Types/AlgorithmTypes';
import { Algorithm } from '../Data/Algorithms';

/**
 * Parsed barcode/encoded text structure.
 * Used by useNoteImport (barcode scanning) and useNoteRestore (saved note restoration).
 */
export interface ParsedBarcode {
    symptomCode: string;
    rfSelections: number[];
    cardEntries: { index: number; selections: number[]; answerIndex: number }[];
    hpiText: string;
    flags: { includeAlgorithm: boolean; includeDecisionMaking: boolean; includeHPI: boolean };
}

/**
 * Convert a bitmask integer to an array of set bit indices.
 * Used by parseBarcode and consumers to decode selection bitmasks.
 */
export function bitmaskToIndices(bitmask: number): number[] {
    const indices: number[] = [];
    for (let i = 0; i < 32; i++) {
        if ((bitmask >> i) & 1) {
            indices.push(i);
        }
    }
    return indices;
}

/**
 * Parse a barcode/encoded text string into structured data.
 * Consolidates the previously duplicated parseBarcode (useNoteImport) and
 * parseEncodedText (useNoteRestore) into a single shared utility.
 *
 * Format: symptomCode|R<rfBitmask>|H<hpiBase64>|F<flagsNum>|<cardIndex>.<selBitmask>.<answerIdx>|...
 * Legacy format: symptomCode|L<lastCard>|S<selections>
 */
export function parseBarcode(encodedText: string): ParsedBarcode | null {
    if (!encodedText.trim()) return null;

    const parts = encodedText.split('|');
    const result: ParsedBarcode = {
        symptomCode: '',
        rfSelections: [],
        cardEntries: [],
        hpiText: '',
        flags: { includeAlgorithm: true, includeDecisionMaking: true, includeHPI: false }
    };

    // Track if we find new-format card entries vs legacy L/S parts
    let legacyLastCard = -1;
    let legacySelections: number[] = [];

    // First non-empty part is always the symptom code (e.g. "A1", "F3")
    // This must be extracted first to avoid prefix collisions with F (flags), etc.
    const nonEmptyParts = parts.filter(p => p.length > 0);
    if (nonEmptyParts.length > 0) {
        result.symptomCode = nonEmptyParts[0];
    }

    // Parse remaining parts by prefix (skip the first which is the symptom code)
    for (let partIdx = 1; partIdx < nonEmptyParts.length; partIdx++) {
        const part = nonEmptyParts[partIdx];
        const prefix = part[0];
        const value = part.substring(1);

        if (prefix === 'R') {
            const bitmask = parseInt(value || '0', 36);
            result.rfSelections = bitmaskToIndices(bitmask);
        } else if (prefix === 'H') {
            try {
                result.hpiText = decodeURIComponent(atob(value));
            } catch {
                try {
                    result.hpiText = atob(value);
                } catch {
                    result.hpiText = decodeURIComponent(value);
                }
            }
        } else if (prefix === 'F') {
            const flagsNum = parseInt(value, 10);
            result.flags = {
                includeAlgorithm: !!(flagsNum & 1),
                includeDecisionMaking: !!(flagsNum & 2),
                includeHPI: !!(flagsNum & 4)
            };
        } else if (prefix === 'L') {
            // Legacy format: last card index
            legacyLastCard = parseInt(value, 10);
        } else if (prefix === 'S') {
            // Legacy format: selections on last card
            legacySelections = value === '0' ? [] : value.split('').map(n => parseInt(n, 10));
        } else if (/^\d/.test(part)) {
            // New format card entry: index.selections.answer
            const segments = part.split('.');
            if (segments.length >= 3) {
                result.cardEntries.push({
                    index: parseInt(segments[0], 10),
                    selections: bitmaskToIndices(parseInt(segments[1], 36)),
                    answerIndex: parseInt(segments[2], 10)
                });
            }
        }
    }

    // Legacy format fallback: convert L/S to a single card entry
    if (result.cardEntries.length === 0 && legacyLastCard > 0) {
        result.cardEntries = [{
            index: legacyLastCard,
            selections: legacySelections,
            answerIndex: -1
        }];
        // Legacy format did not support decision making or HPI
        result.flags = { includeAlgorithm: true, includeDecisionMaking: false, includeHPI: false };
    }

    if (!result.symptomCode) return null;
    return result;
}

/**
 * Find algorithm options by symptom code (e.g. "A1" -> "A-1").
 * Shared by useNoteImport and useNoteRestore.
 */
export function findAlgorithmByCode(code: string): AlgorithmOptions[] | null {
    const algorithmId = code.replace(/([A-Z])(\d+)/, '$1-$2');
    const algorithm = Algorithm.find(item => item.id === algorithmId);
    return algorithm?.options || null;
}
