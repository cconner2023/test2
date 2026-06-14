import { useCallback, useRef, useState } from 'react'
import { MoreHorizontal, MessageSquare, Download, Upload, User, Building2, Check } from 'lucide-react'
import { ActionPill } from '../ActionPill'
import { ActionButton } from '../ActionButton'
import { PreviewOverlay } from '../PreviewOverlay'
import { ActionSheet, type ActionSheetOption } from '../ActionSheet'
import { useShareToChat } from '../Messages/ShareToChatPicker'
import { useNoteBlocksIngest, summarizeIngest, type IngestScope } from '../../Hooks/useNoteBlocksIngest'
import { downloadNoteBlocks, readNoteBlocksFile } from '../../lib/noteBlocksFile'
import { useAuthStore } from '../../stores/useAuthStore'
import type { NoteBlocksData, NoteBlocksBundle } from '../../lib/objectBundle'

interface Props {
  /** The blocks to share / export (the user's own — personal scope). */
  data: NoteBlocksData
  /** File name base + share label, e.g. "text templates" / "order sets". */
  baseName: string
  /** Whether `data` actually holds anything to send. */
  hasData: boolean
}

/**
 * Drop-in Share / Export / Import control for a settings blocks panel (text
 * templates, order sets, plan tags). Share + Export send the user's own blocks
 * (one bundle, same projection as the chat card). Import reads a file and merges
 * with duplicate-checking into the chosen scope. One menu, consistent across
 * every blocks panel.
 */
export function NoteBlocksTransferMenu({ data, baseName, hasData }: Props) {
  const clinicName = useAuthStore(s => s.user?.clinicName ?? null)
  const { ingest, canIngestToClinic } = useNoteBlocksIngest()
  const { shareBundle, picker } = useShareToChat()

  const fileRef = useRef<HTMLInputElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [scopePick, setScopePick] = useState<NoteBlocksBundle | null>(null)
  const [result, setResult] = useState<string | null>(null)

  const doShare = useCallback(() => {
    shareBundle({ kind: 'note-blocks', blocks: data, label: `my ${baseName}` })
  }, [shareBundle, data, baseName])

  const doExport = useCallback(() => {
    downloadNoteBlocks(data, clinicName ?? 'cluster', baseName)
  }, [data, clinicName, baseName])

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

  const options: ActionSheetOption[] = [
    ...(hasData ? [
      { key: 'share', label: 'Share to chat', icon: MessageSquare, onAction: doShare },
      { key: 'export', label: 'Export to file', icon: Download, onAction: doExport },
    ] : []),
    { key: 'import', label: 'Import from file', icon: Upload, onAction: () => fileRef.current?.click() },
  ]

  return (
    <>
      <ActionPill shadow="sm">
        <ActionButton icon={MoreHorizontal} label="Share, export or import" onClick={() => setMenuOpen(true)} />
      </ActionPill>

      <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onFile} />

      <ActionSheet
        visible={menuOpen}
        title={`Share ${baseName}`}
        options={options}
        onClose={() => setMenuOpen(false)}
      />

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

      {picker}
    </>
  )
}
