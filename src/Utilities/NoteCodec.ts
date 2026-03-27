// Utilities/NoteCodec.ts — Barrel re-export for backward compatibility
export { compressText, decompressText, bitmaskToIndices, indicesToBitmask, uint8ToBase64, base64ToUint8 } from './textCodec';
export { decodePECompact } from './peCodec';
export { parseNoteEncoding, encodeNoteState, encodeProviderNote, encodeProviderBundle, encodedContentEquals, reconstructCardStates, findAlgorithmByCode, findSymptomByCode } from './noteParser';
export type { ScreenerEntry, ParsedNote, NoteEncodeOptions, ProviderNoteEncodeOptions } from './noteParser';
export { encryptBarcode, encryptBarcodeWithBytes, decryptBarcode, decryptBarcodeBytes, isEncryptedBarcode, renderBarcodeToCanvas } from './barcodeCodec';
export type { EncryptedBarcode } from './barcodeCodec';
export { encodeTC3Card, parseTC3Encoding, isTC3Encoding } from './tc3Codec';
export type { ParsedTC3 } from './tc3Codec';
