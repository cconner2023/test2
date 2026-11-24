import { useState } from 'react'
import { Check } from 'lucide-react'
import { PaneSurface } from '@/Components/primitives/PaneCard'
import { PillButton } from '@/Components/primitives/HeaderPill'
import { PdfPreviewBody, PdfSaveAction } from '@/Components/primitives/PdfPreview'
import { usePatientIdDraft, type PatientIdForm } from '../Hooks/usePatientIdDraft'
import type { PdfPreviewData } from '../Hooks/usePdfExport'
import type { PatientIdentification, SF600Stamp } from '../Utilities/SF600Export'
import type { DD689Extras } from '../Utilities/DD689Export'

export interface NoteExportFlowArgs {
  onSF600: (patient: PatientIdentification, stamp: SF600Stamp) => void
  onDD689: (patient: PatientIdentification, extras: DD689Extras) => void
  sf600Preview: PdfPreviewData | null
  dd689Preview: PdfPreviewData | null
  generating: boolean
  downloadSF600: () => void
  downloadDD689: () => void
  clearSF600Preview: () => void
  clearDD689Preview: () => void
}

export type NoteExportFlow = ReturnType<typeof useNoteExportFlow>

/** Patient ID → PDF drill-down shared by every note surface. */
export function useNoteExportFlow(a: NoteExportFlowArgs) {
  const [gate, setGate] = useState<PatientIdForm | null>(null)
  const pdfPreview = a.sf600Preview ?? a.dd689Preview ?? null
  const screen: 'patient' | 'pdf' | null = a.generating || pdfPreview ? 'pdf' : gate ? 'patient' : null
  const patientForm = usePatientIdDraft(gate !== null, gate ?? undefined)

  const clearPdf = () => { a.clearSF600Preview(); a.clearDD689Preview() }
  const reset = () => { setGate(null); clearPdf() }
  const back = () => { if (screen === 'pdf') clearPdf(); else setGate(null) }
  const confirm = () => {
    patientForm.submit((patient, extras, stamp) => gate === 'dd689' ? a.onDD689(patient, extras) : a.onSF600(patient, stamp))
    setGate(null)
  }
  const savePdf = () => {
    if (a.sf600Preview) a.downloadSF600(); else a.downloadDD689()
    clearPdf()
  }

  const title = screen === 'pdf' ? pdfPreview?.filename ?? 'PDF' : 'Patient Identification'
  const actions = screen === 'pdf'
    ? (pdfPreview ? <PdfSaveAction preview={pdfPreview} onSave={savePdf} /> : undefined)
    : screen === 'patient'
      ? <PillButton icon={Check} iconSize={18} accent="success" onClick={confirm} label={patientForm.isDD689 ? 'Create DD689' : 'Create SF600'} />
      : undefined
  const body = screen === 'patient'
    ? patientForm.body
    : screen === 'pdf' && pdfPreview
      ? <PdfPreviewBody preview={pdfPreview} />
      : null

  return {
    screen,
    title,
    actions,
    body,
    loading: screen === 'pdf' && !pdfPreview,
    start: setGate as (form: PatientIdForm) => void,
    back,
    reset,
  }
}

/** Standalone host for the flow: PaneCard on desktop, fit Sheet on mobile. */
export function NoteExportPane({ flow, desktopZIndex }: { flow: NoteExportFlow; desktopZIndex?: number }) {
  return (
    <PaneSurface
      isOpen={flow.screen !== null}
      onClose={flow.reset}
      title={flow.title}
      onBack={flow.screen === 'pdf' ? flow.back : undefined}
      actions={flow.actions}
      loading={flow.loading}
      width={480}
      maxHeight={90}
      desktopZIndex={desktopZIndex}
    >
      {flow.body}
    </PaneSurface>
  )
}
