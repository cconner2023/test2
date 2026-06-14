/**
 * File transport for note blocks (text templates / order sets / plan tags).
 * The chat path packs the same bundle as an encrypted attachment; this path
 * writes/reads a plain `.json` file the user can hand off out-of-band (email,
 * AirDrop, shared drive) to another cluster. Plaintext is acceptable here —
 * these blocks are operational config with NO PHI (the same reason they can
 * travel as a frozen value at all). Ingest + dedup is shared with the chat card
 * via useNoteBlocksIngest.
 */

import { noteBlocksToBundle, parseBundle, type NoteBlocksData, type NoteBlocksBundle } from './objectBundle'
import { ok, err, type Result } from './result'

const FILE_EXT = 'beacon-blocks.json'

/** Build the export bundle and trigger a browser download. */
export function downloadNoteBlocks(data: NoteBlocksData, sourceCluster: string, baseName = 'my'): void {
  const bundle = noteBlocksToBundle(data, sourceCluster, new Date().toISOString())
  const json = JSON.stringify(bundle, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${baseName.replace(/[^a-z0-9-_]+/gi, '-').toLowerCase()}.${FILE_EXT}`
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoke on the next tick so the click has consumed the URL.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/** Read + validate a picked file into a note-blocks bundle. */
export async function readNoteBlocksFile(file: File): Promise<Result<NoteBlocksBundle>> {
  let text: string
  try {
    text = await file.text()
  } catch {
    return err('Could not read the file.')
  }
  const parsed = parseBundle(text)
  if (!parsed) return err('That file isn’t a valid Beacon blocks export.')
  if (parsed.kind !== 'note-blocks') return err('That export holds a different kind of item.')
  return ok(parsed)
}
