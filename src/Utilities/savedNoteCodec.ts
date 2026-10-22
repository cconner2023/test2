/**
 * My Notes decode — the one path both Save (verify before writing) and reopen
 * use, so a note that saves is a note that opens. Failures carry a user-facing
 * message; the stored row is never touched on failure.
 */

import { isEncryptedBarcode, decryptBarcode, parseNoteEncoding, findAlgorithmByCode, findSymptomByCode, reconstructCardStates } from './NoteCodec'
import { decodePEState } from './peCodec'
import { getBarcodeKey } from '../lib/cryptoService'
import { withTimeout } from './withTimeout'
import { logError } from './ErrorHandler'
import type { SavedNote } from '../lib/savedNotesDb'
import type { AlgorithmOptions, dispositionType } from '../Types/AlgorithmTypes'
import type { CardState } from '../Hooks/useAlgorithm'
import type { PEState } from '../Types/PETypes'

export class SavedNoteError extends Error {
  constructor(readonly userMessage: string, detail: string) {
    super(detail)
  }
}

export type DecodedSavedNote =
  | { kind: 'provider'; ascii: string }
  | {
      kind: 'medic'
      ascii: string
      algorithmOptions: AlgorithmOptions[]
      cardStates: CardState[]
      disposition: dispositionType
      symptom: { icon: string; text: string } | null
      parsed: NonNullable<ReturnType<typeof parseNoteEncoding>>
      peState: PEState | null
    }

type DecodeInput = Pick<SavedNote, 'encodedText' | 'kind' | 'dispositionType' | 'dispositionText'>

/** Every disposition an algorithm can reach — fallback when replay finds none. */
function findDisposition(algorithmOptions: AlgorithmOptions[], type: string, text: string): dispositionType | null {
  if (!type) return null
  let byType: dispositionType | null = null
  for (const card of algorithmOptions) {
    for (const answer of card.answerOptions ?? []) {
      for (const d of answer.disposition ?? []) {
        if (d.type === type && d.text === text) return d
        if (d.type === type && !byType) byType = d
      }
    }
  }
  return byType
}

export async function decodeSavedNote(saved: DecodeInput): Promise<DecodedSavedNote> {
  let ascii = saved.encodedText
  if (!ascii) throw new SavedNoteError('This note is empty.', 'empty encodedText')

  if (isEncryptedBarcode(ascii)) {
    // Key lookup can fall through to IDB/network; never let the tap hang on it.
    const decrypted = await withTimeout(decryptBarcode(ascii), 10_000, 'savedNote.decrypt').catch(e => {
      logError('savedNote.decrypt', e)
      return null
    })
    if (!decrypted) {
      const hasKey = await withTimeout(getBarcodeKey(), 3000, 'savedNote.key').catch(() => null)
      throw hasKey
        ? new SavedNoteError('This note could not be unlocked on this device.', 'decrypt failed with key present')
        : new SavedNoteError('Could not unlock this note — connect to the network and try again.', 'barcode key unavailable')
    }
    ascii = decrypted
  }

  if (saved.kind === 'provider') {
    if (!parseNoteEncoding(ascii)) throw new SavedNoteError('This note could not be read.', 'unparseable provider note')
    return { kind: 'provider', ascii }
  }

  const parsed = parseNoteEncoding(ascii)
  if (!parsed?.symptomCode) throw new SavedNoteError('This note could not be read.', 'unparseable saved note')
  const algorithmOptions = findAlgorithmByCode(parsed.symptomCode)
  if (!algorithmOptions?.length) {
    throw new SavedNoteError('This note’s algorithm is no longer available.', `algorithm ${parsed.symptomCode} not found`)
  }

  const reconstructed = reconstructCardStates(algorithmOptions, parsed)
  // Algorithm data can shift between app versions; fall back to the disposition
  // recorded at save time rather than refusing to open the note.
  const disposition = reconstructed.disposition
    ?? findDisposition(algorithmOptions, saved.dispositionType, saved.dispositionText)
  if (!disposition) throw new SavedNoteError('This note could not be read.', 'saved note has no disposition')

  // A PE codec mismatch must not take HPI/Plan/Assessment down with it.
  let peState: PEState | null = null
  if (parsed.peRaw) {
    try {
      peState = decodePEState(parsed.peRaw, parsed.symptomCode)
    } catch (e) {
      logError('savedNote.decodePE', e)
    }
  }

  const found = findSymptomByCode(parsed.symptomCode)
  return {
    kind: 'medic',
    ascii,
    algorithmOptions,
    cardStates: reconstructed.cardStates,
    disposition,
    symptom: found ? { icon: found.symptom.icon, text: found.symptom.text } : null,
    parsed,
    peState,
  }
}

/** User-facing text for any decode/save failure. */
export function savedNoteErrorMessage(e: unknown, fallback: string): string {
  return e instanceof SavedNoteError ? e.userMessage : fallback
}
