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
// Compressed values carry a "!" prefix. Base64 never contains "!".

/** Compress text for barcode encoding. Uses deflateRaw + base64. */
export function compressText(text: string): string {
    return '!' + uint8ToBase64(deflateRaw(new TextEncoder().encode(text)));
}

/** Decompress a compressText value. Malformed input yields ''. */
export function decompressText(encoded: string): string {
    if (!encoded.startsWith('!')) {
        logError('textCodec.decompress', new Error('Missing "!" prefix'));
        return '';
    }
    try {
        return new TextDecoder().decode(inflateRaw(base64ToUint8(encoded.substring(1))));
    } catch (e) {
        logError('textCodec.inflate', e);
        return '';
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
