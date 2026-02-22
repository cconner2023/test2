// Utilities/noteMetadata.ts
// Derives display metadata (symptom info, disposition) from hpi_encoded
// without assembling the full note text. Reuses existing parser/lookup functions.

import { parseNoteEncoding, findSymptomByCode, findAlgorithmByCode, reconstructCardStates } from './noteParser';

export interface DerivedNoteMetadata {
  symptomText: string;
  symptomIcon: string;
  dispositionType: string;
  dispositionText: string;
}

const EMPTY_METADATA: DerivedNoteMetadata = {
  symptomText: '',
  symptomIcon: '',
  dispositionType: '',
  dispositionText: '',
};

/**
 * Derive display metadata from an encoded note string (hpi_encoded).
 *
 * Extracts symptom info via findSymptomByCode and disposition via
 * reconstructCardStates — the same logic used by useNoteImport,
 * but without assembling the full note text.
 *
 * Returns empty strings for all fields if the input is null/empty
 * or cannot be parsed (e.g. still encrypted).
 */
export function deriveNoteMetadata(encodedText: string | null): DerivedNoteMetadata {
  if (!encodedText) return EMPTY_METADATA;

  // Skip encrypted values — they can't be parsed
  if (encodedText.startsWith('enc.v1:')) return EMPTY_METADATA;

  const parsed = parseNoteEncoding(encodedText);
  if (!parsed) return EMPTY_METADATA;

  // Symptom lookup
  const found = findSymptomByCode(parsed.symptomCode);
  const symptomText = found?.symptom.text || parsed.symptomCode;
  const symptomIcon = found?.symptom.icon || parsed.symptomCode;

  // Disposition from algorithm reconstruction
  const algorithmOptions = findAlgorithmByCode(parsed.symptomCode);
  let dispositionType = '';
  let dispositionText = '';
  if (algorithmOptions?.length) {
    const { disposition } = reconstructCardStates(algorithmOptions, parsed);
    dispositionType = disposition?.type ?? '';
    dispositionText = disposition?.text ?? '';
  }

  return { symptomText, symptomIcon, dispositionType, dispositionText };
}

/**
 * Derive author display name from the U-segment encoded in hpi_encoded.
 * Returns null if no user info is embedded in the barcode.
 */
export function deriveAuthorFromEncoded(encodedText: string | null): string | null {
  if (!encodedText || encodedText.startsWith('enc.v1:')) return null;

  const parsed = parseNoteEncoding(encodedText);
  if (!parsed?.user) return null;

  const { user } = parsed;
  if (!user.lastName) return null;

  let result = '';
  if (user.rank) result = user.rank + ' ';
  result += user.lastName;
  if (user.firstName) {
    result += ', ' + user.firstName.charAt(0) + '.';
    if (user.middleInitial) {
      result += user.middleInitial.charAt(0) + '.';
    }
  }
  if (user.credential) result += ' ' + user.credential;

  return result;
}
