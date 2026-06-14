/**
 * Shared share / export / import plumbing for note blocks (text templates, order
 * sets, plan tags). One hook backs BOTH the panel-wide transfer menu (folded into
 * each manager's corner action pill) AND the per-item Share/Export controls in the
 * edit popovers, so a single bundle path serves "send everything" and "send just
 * this one". The data layer (objectBundle) already supports any mix of items.
 *
 * - `share`        → open the ShareToChat picker for the given blocks
 * - `exportFile`   → download a plain .json bundle (out-of-band hand-off)
 * - `pickImport`   → open the file picker (collection-level only)
 * - `picker`       → render wherever `share` can fire
 * - `importOverlays` → render where `pickImport` lives (file input + scope chooser + result)
 */

import { useCallback, useRef, useState, type ReactNode } from 'react'
import { User, Building2, Check } from 'lucide-react'
import { PreviewOverlay } from '../Components/PreviewOverlay'
import { ActionSheet } from '../Components/ActionSheet'
import { useShareToChat } from '../Components/Messages/ShareToChatPicker'
import { useNoteBlocksIngest, summarizeIngest, type IngestScope } from './useNoteBlocksIngest'
import { downloadNoteBlocks, readNoteBlocksFile } from '../lib/noteBlocksFile'
import { useAuthStore } from '../stores/useAuthStore'
import type { NoteBlocksData, NoteBlocksBundle } from '../lib/objectBundle'

export interface NoteBlocksTransfer {
  /** Open the ShareToChat picker for these blocks. */
  share: (data: NoteBlocksData, label: string) => void
  /** Download a .json bundle of these blocks. */
  exportFile: (data: NoteBlocksData, baseName: string) => void
  /** Trigger the import file picker. */
  pickImport: () => void
  /** ShareToChat picker portal — render wherever `share` can be invoked. */
  picker: ReactNode
  /** Hidden file input + import scope chooser + result readout — render where `pickImport` lives. */
  importOverlays: ReactNode
}

export function useNoteBlocksTransfer(): NoteBlocksTransfer {
  const clinicName = useAuthStore(s => s.user?.clinicName ?? null)
  const { ingest, canIngestToClinic } = useNoteBlocksIngest()
  const { shareBundle, picker } = useShareToChat()

  const fileRef = useRef<HTMLInputElement>(null)
  const [scopePick, setScopePick] = useState<NoteBlocksBundle | null>(null)
  const [result, setResult] = useState<string | null>(null)

  const share = useCallback((data: NoteBlocksData, label: string) => {
    shareBundle({ kind: 'note-blocks', blocks: data, label })
  }, [shareBundle])

  const exportFile = useCallback((data: NoteBlocksData, baseName: string) => {
    downloadNoteBlocks(data, clinicName ?? 'cluster', baseName)
  }, [clinicName])

  const pickImport = useCallback(() => fileRef.current?.click(), [])

  const runIngest = useCallback((bundle: NoteBlocksBundle, scope: IngestScope) => {
    setResult(summarizeIngest(ingest(bundle, scope)))
  }, [ingest])

  const onFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file
    if (!file) return
    const res = await readNoteBlocksFile(file)
    if (!res.ok) { setResult(res.error); return }
    if (canIngestToClinic) setScopePick(res.data)
    else runIngest(res.data, 'personal')
  }, [canIngestToClinic, runIngest])

  const importOverlays = (
    <>
      <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onFile} />

      {/* Import scope chooser — only reached when this user can write clinic content. */}
      <ActionSheet
        visible={!!scopePick}
        title="Add to…"
        options={[
          { key: 'personal', label: 'My personal blocks', icon: User, onAction: () => { if (scopePick) runIngest(scopePick, 'personal'); setScopePick(null) } },
          { key: 'clinic', label: clinicName ? `${clinicName} (cluster)` : 'My cluster', icon: Building2, onAction: () => { if (scopePick) runIngest(scopePick, 'clinic'); setScopePick(null) } },
        ]}
        onClose={() => setScopePick(null)}
      />

      {/* Result readout. */}
      <PreviewOverlay
        isOpen={!!result}
        onClose={() => setResult(null)}
        anchorRect={null}
        title="Import"
        maxWidth={320}
        actions={[{ key: 'done', label: 'Done', icon: Check, onAction: () => setResult(null) }]}
      >
        <p className="px-4 py-5 text-[11pt] text-primary text-center">{result}</p>
      </PreviewOverlay>
    </>
  )

  return { share, exportFile, pickImport, picker, importOverlays }
}
