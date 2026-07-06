import { useState, useRef, useCallback } from 'react'
import { Upload, AlertTriangle, CheckCircle2, User, Building2, Variable } from 'lucide-react'
import { Sheet } from '@/Components/primitives/Sheet'
import { PreviewOverlay } from '../PreviewOverlay'
import { Section, SectionCard } from '@/Components/primitives/Section'
import { LoadingSpinner } from '@/Components/primitives/LoadingSpinner'
import { useIsMobile } from '../../Hooks/useIsMobile'
import { useAuthStore } from '../../stores/useAuthStore'
import { useNoteBlocksCsvImport } from '../../Hooks/useNoteBlocksCsvImport'
import type { IngestScope } from '../../Hooks/useNoteBlocksIngest'
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
}

type Step = 'pick' | 'preview' | 'importing' | 'done'

const NOUN: Record<NoteBlocksCSVKind, string> = {
  templates: 'text templates',
  orderSets: 'order sets',
  providerTemplates: 'provider templates',
  checklists: 'checklists',
}

export function NoteBlocksCSVImportDrawer({ visible, onClose, kind }: Props) {
  const isMobile = useIsMobile()
  const clinicName = useAuthStore(s => s.user?.clinicName ?? null)
  const { ctx, canImport, scopeSelectable, importParsed } = useNoteBlocksCsvImport()

  const [step, setStep] = useState<Step>('pick')
  const [parsed, setParsed] = useState<NoteBlocksCsvParse | null>(null)
  const [scope, setScope] = useState<IngestScope>('personal')
  const [resultMsg, setResultMsg] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleClose = useCallback(() => {
    setStep('pick')
    setParsed(null)
    setScope('personal')
    setResultMsg('')
    onClose()
  }, [onClose])

  const handleFileChange = useCallback(async (file: File | null | undefined) => {
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (!file) return
    const result = await parseNoteBlocksCSV(file, kind, ctx)
    setParsed(result)
    setStep('preview')
  }, [kind, ctx])

  const previews = parsed?.previews ?? []
  const importable = previews.length

  const handleImport = useCallback(async () => {
    if (!parsed || !importable) return
    setStep('importing')
    const msg = await importParsed(parsed, scope)
    setResultMsg(msg)
    setStep('done')
  }, [parsed, importable, importParsed, scope])

  const noun = NOUN[kind]
  const issues = [...(parsed?.errors ?? []), ...(parsed?.warnings ?? [])]
  const showScope = scopeSelectable(kind)

  const headerTitle =
    step === 'pick' ? `Import ${noun} CSV`
    : step === 'preview' ? 'Preview'
    : step === 'importing' ? 'Importing…'
    : 'Import Complete'

  // Small step-machine: an overlay popover on desktop, a fit sheet on mobile
  // (mirrors the map/messaging settings standard). A full BaseDrawer here nested
  // wrong inside the Settings drawer — this is a light import surface, not a page.
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
        <div className="flex flex-col gap-4">
          {issues.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl text-[10pt] text-amber-800 p-3 flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1">
                {issues.slice(0, 6).map((msg, i) => <span key={i}>{msg}</span>)}
                {issues.length > 6 && <span>+ {issues.length - 6} more</span>}
              </div>
            </div>
          )}

          <p className="text-sm text-secondary">{importable} {noun} to import</p>

          {importable > 0 && (
            <Section title="Preview">
              <SectionCard>
                <div className="flex flex-col">
                  {previews.slice(0, 20).map((p, i) => (
                    <div key={i} className="border-b border-themeblue3/10 last:border-b-0 px-3 py-2 flex flex-col gap-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-primary text-[11pt] font-medium">{p.primary}</span>
                        {p.flag && <Variable className="w-3.5 h-3.5 text-themeblue3" />}
                      </div>
                      <span className="text-tertiary text-[10pt] truncate">{p.secondary}</span>
                    </div>
                  ))}
                  {previews.length > 20 && (
                    <div className="px-3 py-2 text-tertiary text-center text-[10pt]">+ {previews.length - 20} more</div>
                  )}
                </div>
              </SectionCard>
            </Section>
          )}

          {importable > 0 && showScope && (
            <Section title="Add to">
              <SectionCard>
                <button
                  type="button"
                  onClick={() => setScope('personal')}
                  className="w-full flex items-center gap-3 px-3 py-3 border-b border-themeblue3/10"
                >
                  <User className="w-5 h-5 text-tertiary" />
                  <span className="flex-1 text-left text-[11pt] text-primary">My personal blocks</span>
                  <span className={`w-4 h-4 rounded-full border-2 ${scope === 'personal' ? 'border-themeblue3 bg-themeblue3' : 'border-tertiary/40'}`} />
                </button>
                <button
                  type="button"
                  onClick={() => setScope('clinic')}
                  className="w-full flex items-center gap-3 px-3 py-3"
                >
                  <Building2 className="w-5 h-5 text-tertiary" />
                  <span className="flex-1 text-left text-[11pt] text-primary">{clinicName ? `${clinicName} (cluster)` : 'My cluster'}</span>
                  <span className={`w-4 h-4 rounded-full border-2 ${scope === 'clinic' ? 'border-themeblue3 bg-themeblue3' : 'border-tertiary/40'}`} />
                </button>
              </SectionCard>
            </Section>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep('pick')}
              className="flex-1 rounded-full px-6 py-3 text-sm font-medium bg-themewhite2 border border-tertiary/20 text-primary"
            >
              Back
            </button>
            {importable > 0 && (
              <button
                type="button"
                onClick={handleImport}
                className="flex-1 rounded-full px-6 py-3 text-sm font-medium bg-themeblue3 text-white"
              >
                Import {importable}
              </button>
            )}
          </div>
        </div>
      )}

      {step === 'importing' && (
        <div className="flex flex-col items-center justify-center gap-4 py-16">
          <LoadingSpinner />
          <p className="text-sm text-secondary">Importing…</p>
        </div>
      )}

      {step === 'done' && (
        <div className="flex flex-col items-center justify-center gap-4 py-16">
          <CheckCircle2 className="w-12 h-12 text-themegreen" />
          <p className="text-sm text-secondary text-center px-6">{resultMsg}</p>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full px-6 py-3 text-sm font-medium bg-themeblue3 text-white"
          >
            Done
          </button>
        </div>
      )}
    </div>
  )

  return isMobile ? (
    <Sheet
      isOpen={visible}
      onClose={handleClose}
      title={headerTitle}
      height="fit"
      maxHeight={85}
      zIndex={1200}
    >
      {body}
    </Sheet>
  ) : (
    <PreviewOverlay
      isOpen={visible}
      onClose={handleClose}
      anchorRect={null}
      title={headerTitle}
      maxWidth={420}
      previewMaxHeight="70dvh"
    >
      {body}
    </PreviewOverlay>
  )
}
