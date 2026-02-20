// Utilities/NoteCodec.ts — Barrel re-export for backward compatibility
export { compressText, decompressText, bitmaskToIndices, indicesToBitmask } from './textCodec';
export { encodePECompact, decodePECompact } from './peCodec';
export { parseNoteEncoding, encodeNoteState, encodedContentEquals, reconstructCardStates, findAlgorithmByCode, findSymptomByCode } from './noteParser';
export type { ScreenerEntry, ParsedNote, NoteEncodeOptions } from './noteParser';
