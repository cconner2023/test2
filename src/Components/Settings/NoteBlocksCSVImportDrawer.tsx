import { useState, useRef, useCallback } from 'react'
import { AlertTriangle, CheckCircle2, User, Building2, Check, Upload } from 'lucide-react'
import { Section, SectionCard } from '@/Components/primitives/Section'
import { SkeletonRows } from '@/Components/primitives/Skeleton'
import { PillButton } from '@/Components/primitives/HeaderPill'
import { UploadChip, useUploadTask } from '@/Components/primitives/UploadProgress'
import type { CardMorphHost } from '@/Components/primitives/OverlayStack'
import { ContentStack, SelectBox } from './contentPrimitives'
import { useNoteBlocksCsvImport } from '../../Hooks/useNoteBlocksCsvImport'
import {
  parseNoteBlocksCSV,
  downloadNoteBlocksTemplate,
  type NoteBlocksCSVKind,
  type NoteBlocksCsvParse,
} from '../../Utilities/noteBlocksCSV'

interface Props {
  visible: boolean
  onClose: () => void
  kind: NoteBlocksCSVKind
  /** Desktop Settings: morph into the subpage card instead of a separate pane. */
  cardHost?: CardMorphHost
}

type Step = 'pick' | 'preview' | 'importing' | 'done'

const NOUN: Record<NoteBlocksCSVKind, string> = {
  templates: 'text templates',
  orderSets: 'order sets',
  providerTemplates: 'provider templates',
}

/**
 * CSV import, a small step-machine on ContentStack (Sheet on mobile, the Settings
 * subpage card or its own pane on desktop — never an anchored overlay).
 *   pick    → file drop
 *   preview → the shared file-upload chip (ring + check) for the parsed file, any
 *             issues, and "Add to": Personal plus every cluster the user supervises
 *             — multi-select, so one file lands in several places at once
 *   done    → one summary line per destination
 * Back steps preview → pick; Import / Done are the header check.
 */
export function NoteBlocksCSVImportDrawer({ visible, onClose, kind, cardHost }: Props) {
  const { ctx, canImport, scopeSelectable, importParsedTo, clusterTargets } = useNoteBlocksCsvImport()
  const upload = useUploadTask<NoteBlocksCsvParse>()

  const [step, setStep] = useState<Step>('pick')
  const [parsed, setParsed] = useState<NoteBlocksCsvParse | null>(null)
  const [targets, setTargets] = useState<Set<string>>(new Set(['personal']))
  const [results, setResults] = useState<string[]>([])
  /** A rejected file (wrong type / wrong sheet / empty): shown over the picker. */
  const [pickError, setPickError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const lastFileRef = useRef<File | null>(null)

  const reset = useCallback(() => {
    upload.clear()
    setStep('pick')
    setParsed(null)
    setTargets(new Set(['personal']))
    setResults([])
    setPickError(null)
  }, [upload])

  const handleClose = useCallback(() => { reset(); onClose() }, [reset, onClose])

  const noun = NOUN[kind]

  const handleFileChange = useCallback(async (file: File | null | undefined) => {
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (!file) return
    lastFileRef.current = file
    setPickError(null)
    setStep('preview')
    let rejected: string | null = null
    const result = await upload.start(
      { name: file.name, size: file.size },
      async ({ onProgress }) => {
        onProgress(0.4)
        const r = await parseNoteBlocksCSV(file, kind, ctx)
        onProgress(1)
        if (r.previews.length === 0) {
          rejected = r.errors[0] ?? `No ${noun} found in this file.`
          return { ok: false, error: rejected }
        }
        return { ok: true, data: r }
      },
    )
    if (!result) {
      // Don't proceed on a bad file: back to the picker with the reason.
      upload.clear()
      setStep('pick')
      if (rejected) setPickError(rejected)
      return
    }
    setParsed(result)
  }, [upload, kind, ctx, noun])

  const importable = parsed?.previews.length ?? 0
  const issues = [...(parsed?.errors ?? []), ...(parsed?.warnings ?? [])]
  const showTargets = scopeSelectable(kind) && clusterTargets.length > 0
  const targetIds = showTargets ? [...targets] : ['personal']

  const task = upload.task

  const handleImport = useCallback(async () => {
    if (!parsed || !importable || targetIds.length === 0) return
    setStep('importing')
    setResults(await importParsedTo(parsed, targetIds))
    setStep('done')
  }, [parsed, importable, targetIds, importParsedTo])

  const toggleTarget = (id: string) => setTargets(prev => {
    const n = new Set(prev)
    n.has(id) ? n.delete(id) : n.add(id)
    return n
  })

  const headerTitle =
    step === 'pick' ? `Import ${noun} CSV`
    : step === 'preview' ? 'Review import'
    : step === 'importing' ? 'Importing…'
    : 'Import complete'

  const targetRow = (id: string, label: string, Icon: typeof User) => (
    <button
      key={id}
      type="button"
      onClick={() => toggleTarget(id)}
      className="w-full flex items-center gap-3 px-3 py-3 border-b border-themeblue3/10 last:border-b-0 active:bg-themeblue2/5 transition-colors"
    >
      <Icon className="w-5 h-5 text-tertiary shrink-0" />
      <span className="flex-1 min-w-0 text-left text-[11pt] text-primary truncate">{label}</span>
      <SelectBox checked={targets.has(id)} />
    </button>
  )

  const body = (
    <div className="px-4 py-4">
      {step === 'pick' && (
        <div className="flex flex-col gap-4">
          {!canImport(kind) ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl text-[10pt] text-amber-800 p-3 flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>You don’t have permission to import {noun} for this cluster.</span>
            </div>
          ) : (
            <>
              {pickError && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl text-[10pt] text-amber-800 p-3 flex gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{pickError}</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-2xl border-2 border-dashed border-tertiary/30 flex flex-col items-center justify-center gap-3 py-12 px-6 w-full active:opacity-70 transition-opacity"
              >
                <Upload className="w-8 h-8 text-tertiary" />
                <span className="text-sm text-secondary">Drop a CSV or tap to browse</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={e => handleFileChange(e.target.files?.[0])}
              />
              {kind === 'templates' && (
                <p className="text-[10pt] text-tertiary leading-relaxed">
                  The <span className="text-secondary">Body</span> cell reads plain text. Use{' '}
                  <span className="text-secondary">[Field]</span> for a fill-in,{' '}
                  <span className="text-secondary">[Field: a | b | c]</span> for a dropdown, and{' '}
                  <span className="text-secondary">IF Field = value:</span> with indented lines for a conditional block.
                </p>
              )}
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => downloadNoteBlocksTemplate(kind)}
                  className="text-sm text-themeblue3 underline"
                >
                  Download template
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {step === 'preview' && (
        <div className="flex flex-col gap-2">
          <UploadChip
            task={task}
            onDismiss={reset}
            onRetry={() => void handleFileChange(lastFileRef.current)}
            doneLabel=""
          />

          {issues.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl text-[10pt] text-amber-800 p-3 flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1">
                {issues.slice(0, 6).map((msg, i) => <span key={i}>{msg}</span>)}
                {issues.length > 6 && <span>+ {issues.length - 6} more</span>}
              </div>
            </div>
          )}

          {importable > 0 && showTargets && (
            <Section title="Add to">
              <SectionCard>
                {targetRow('personal', 'My personal blocks', User)}
                {clusterTargets.map(c => targetRow(c.id, c.name, Building2))}
              </SectionCard>
            </Section>
          )}
        </div>
      )}

      {step === 'importing' && <SkeletonRows count={4} variant="text" delay={0} />}

      {step === 'done' && (
        <div className="flex flex-col items-center justify-center gap-3 py-12">
          <CheckCircle2 className="w-12 h-12 text-themegreen" />
          {results.map((line, i) => (
            <p key={i} className="text-sm text-secondary text-center px-6">{line}</p>
          ))}
        </div>
      )}
    </div>
  )

  const headerActions =
    step === 'preview' && importable > 0 && targetIds.length > 0
      ? <PillButton icon={Check} iconSize={18} accent="success" label={`Import ${importable}`} onClick={handleImport} />
      : step === 'done'
        ? <PillButton icon={Check} iconSize={18} accent="success" label="Done" onClick={handleClose} />
        : undefined

  return (
    <ContentStack
      isOpen={visible}
      onClose={handleClose}
      initial={{ key: 'import' }}
      cardHost={cardHost}
      screens={{
        import: {
          title: headerTitle,
          onBack: step === 'preview' ? reset : undefined,
          headerActions,
          render: () => body,
        },
      }}
    />
  )
}
