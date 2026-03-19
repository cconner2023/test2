// Utilities/textCodec.ts
// Text compression (zlib deflateRaw + base64) and bitmask helpers.

import { deflateRaw, inflateRaw } from 'pako';
import { logError } from './ErrorHandler';
import { uint8ToBase64, base64ToUint8 } from '../lib/base64Utils';

// Re-export so existing consumers (NoteCodec barrel, barcodeCodec, cryptoService) keep working.
export { uint8ToBase64, base64ToUint8 };

// ---------------------------------------------------------------------------
// Text compression (zlib deflateRaw + base64)
// ---------------------------------------------------------------------------
// Replaces the old btoa(encodeURIComponent(text)) pipeline which expanded
// text ~1.78x. DeflateRaw + base64 compresses to ~0.78x of raw.
// Compressed values are prefixed with "!" to distinguish from legacy base64.
// Base64 never contains "!" so detection is unambiguous.

/** Compress text for barcode encoding. Uses deflateRaw + base64. */
export function compressText(text: string): string {
    try {
        const deflated = deflateRaw(new TextEncoder().encode(text));
        return '!' + uint8ToBase64(deflated);
    } catch (e) {
        logError('textCodec.compress', e);
        return '!' + uint8ToBase64(new TextEncoder().encode(text));
    }
}

/** Decompress text — handles both !{compressed} and legacy base64 formats. */
export function decompressText(encoded: string): string {
    if (encoded.startsWith('!')) {
        try {
            const inflated = inflateRaw(base64ToUint8(encoded.substring(1)));
            return new TextDecoder().decode(inflated);
        } catch (e) { logError('textCodec.inflate', e); }
    }
    try {
        return decodeURIComponent(atob(encoded));
    } catch (e) {
        logError('textCodec.decompressLegacy', e);
        try { return atob(encoded); }
        catch (e2) { logError('textCodec.atob', e2); return decodeURIComponent(encoded); }
    }
}

// ---------------------------------------------------------------------------
// Bitmask helpers
// ---------------------------------------------------------------------------

/** Convert a 32-bit bitmask to an array of set bit indices. */
export function bitmaskToIndices(bitmask: number): number[] {
    const indices: number[] = [];
    for (let i = 0; i < 32; i++) {
        if ((bitmask >> i) & 1) {
            indices.push(i);
        }
    }
    return indices;
}

/** Convert an array of indices into a 32-bit bitmask. */
export function indicesToBitmask(indices: number[]): number {
    let bitmask = 0;
    for (const i of indices) {
        bitmask |= (1 << i);
    }
    return bitmask;
}
