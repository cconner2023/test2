import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react'
import { useClusterLabel } from '../Utilities/clusterLabel'
import { User, ExternalLink, Save, Check, Download } from 'lucide-react'
import { PaneSurface } from '@/Components/primitives/PaneCard'
import { PillButton } from '@/Components/primitives/HeaderPill'
import { AnchoredMenu } from '@/Components/primitives/LiftedRowMenu'
import type { ContextMenuItem } from '@/Components/primitives/ContextMenu'
import { NoteOutputSections, noteExportOptions } from './NoteOutputSections'
import { useNavigationStore } from '../stores/useNavigationStore'
import { useSavedNotesStore } from '../stores/useSavedNotesStore'
import { SAVED_NOTES_CAP } from '../lib/savedNotesDb'
import { emitCopied } from '../lib/copyFeedback'
import { BarcodeDisplay } from './Barcode'
import { usePatientIdDraft, type PatientIdForm } from '../Hooks/usePatientIdDraft'
import { PdfCanvasView } from './PdfCanvasView'
import type { ImportPreview } from '../Hooks/useNoteImport'
import type { MedevacRequest } from '../Types/MedevacTypes'
import { formatDob, type PatientIdentification, type SF600Stamp } from '../Utilities/SF600Export'
import type { DD689Extras } from '../Utilities/DD689Export'
import { useNoteShare } from '../Hooks/useNoteShare'
import { useDD689Export } from '../Hooks/useDD689Export'
import { useSF600Export } from '../Hooks/useSF600Export'
import { useUserProfile } from '../Hooks/useUserProfile'
import { useAuthStore } from '../stores/useAuthStore'
import { profileAvatars } from '../Data/ProfileAvatars'
import { supabase } from '../lib/supabase'
import { copyWithHtml } from '../Utilities/clipboardUtils'
import { getColorClasses } from '../Utilities/ColorUtilities'
import { useEscBackout } from '../Hooks/useEscBackout'

interface ImportedNoteDrawerProps {
  preview: ImportPreview | null
  onClose: () => void
  onOpenMedevac?: (req: MedevacRequest) => void
  isMobile: boolean
}

/**
 * Base Import Note result for a decoded barcode: the same Note Preview /
 * Encoded Note sections and data matrices as WriteNote's Full Note, in a
 * PaneSurface (lifted PaneCard on desktop, fit Sheet on mobile).
 *
 * The export steps are drill-downs of the same surface, not stacked overlays:
 * note → Patient Identification → PDF preview, each with Back. The Finish
 * actions (Save, SF600, DD689, Share, Edit in Provider) hang off the header
 * Check as an AnchoredMenu.
 */
export function ImportedNoteDrawer({ preview, onClose, onOpenMedevac, isMobile }: ImportedNoteDrawerProps) {
  // Hold the last preview so content stays put through the close animation.
  const [shown, setShown] = useState<ImportPreview | null>(preview)
  useEffect(() => { if (preview) setShown(preview) }, [preview])

  const { profile } = useUserProfile()
  // SF600 / DD689 facility line — cluster nickname, falling back to unit name.
  const formClinicName = useClusterLabel(useAuthStore(s => s.clinicId), profile.clinicName)
  const { shareNote } = useNoteShare()
  const { exportDD689, exportStatus, dd689Preview, downloadDD689, clearDD689Preview } = useDD689Export()
  const { exportSF600, sf600ExportStatus, sf600Preview, downloadSF600, clearSF600Preview } = useSF600Export()
  const [patientGate, setPatientGate] = useState<PatientIdForm | null>(null)
  const [authorAvatarSvg, setAuthorAvatarSvg] = useState<ReactNode>(null)

  const userId = shown?.userId
  useEffect(() => {
    if (!userId) { setAuthorAvatarSvg(null); return }
    supabase
      .from('profiles')
      .select('avatar_id')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        const match = data?.avatar_id ? profileAvatars.find(a => a.id === data.avatar_id) : null
        setAuthorAvatarSvg(match?.svg ?? null)
      })
  }, [userId])

  const note = shown?.fullNote ?? ''
  const encoded = shown?.encodedText ?? ''
  const colors = getColorClasses((shown?.dispositionType ?? '') as any)

  // The note is signed by its original author — never the importer. Only a
  // single-author note has one name to put in the SF600 signature block.
  const authorSig = shown?.authorLabel?.startsWith('Signed: ') && !shown.authorLabel.includes(' / ')
    ? shown.authorLabel.slice('Signed: '.length)
    : undefined

  const handleExportSF600 = (patient: PatientIdentification, stamp: SF600Stamp) => {
    if (!note) return
    exportSF600({ noteText: note, date: formatDob(stamp.date), time: stamp.time, signatureName: authorSig, patient, facility: formClinicName || undefined, history: shown?.parsed?.providerHistory ?? shown?.parsed?.history })
  }

  const handleShare = () => {
    if (!shown || !encoded) return
    shareNote({
      encodedText: encoded,
      symptomText: shown.symptomText,
      dispositionType: shown.dispositionType,
      dispositionText: shown.dispositionText,
    }, isMobile)
  }

  const handleExportDD689 = (patient: PatientIdentification, extras: DD689Extras) => {
    if (!shown || !encoded) return
    exportDD689({
      encodedValue: encoded,
      dispositionType: shown.dispositionType,
      dispositionText: shown.dispositionText,
      symptomText: shown.symptomText || 'Note',
      clinicName: formClinicName || '',
      authorLine: authorSig,
      patient,
      ...extras,
    })
  }

  const medevacReq = shown?.isMedevac ? shown.medevacReq : undefined

  // ── Save to My Notes ──────────────────────────────────────────────────────
  // Medic + provider notes only — My Notes reopens through WriteNote or the
  // provider drawer, which have no TC3 / 9-line path. A medic note a provider
  // amended reopens as a provider note.
  const authUserId = useAuthStore(s => s.user?.id)
  const savedNotes = useSavedNotesStore(s => s.notes)
  const saveNote = useSavedNotesStore(s => s.save)
  const isProviderRole = useAuthStore(s => s.isProviderRole)
  const openProviderNote = useNavigationStore(s => s.openProviderNote)
  const savedIdRef = useRef<string | undefined>(undefined)
  useEffect(() => { savedIdRef.current = undefined }, [preview])
  const parsed = shown?.parsed
  const saveKind: 'medic' | 'provider' | null = !shown || shown.isTC3 || shown.isMedevac || !parsed || !encoded
    ? null
    : parsed.symptomCode === 'PRV' || parsed.providerHpi || parsed.providerPe || parsed.providerAssessment || parsed.providerPlan || parsed.providerHistory
      ? 'provider'
      : 'medic'

  const handleSave = useCallback(async (): Promise<boolean> => {
    if (!shown || !saveKind) return false
    const id = await saveNote({
      id: savedIdRef.current,
      userId: authUserId ?? null,
      kind: saveKind,
      encodedText: encoded,
      symptomIcon: shown.symptomIcon,
      symptomText: shown.symptomText,
      dispositionType: shown.dispositionType,
      dispositionText: shown.dispositionText,
    })
    if (id) savedIdRef.current = id
    return !!id
  }, [shown, saveKind, encoded, saveNote, authUserId])

  const [finishOpen, setFinishOpen] = useState(false)
  const finishRef = useRef<HTMLDivElement>(null)

  // Fresh surface per import: drop any half-finished export step.
  useEffect(() => {
    if (!preview) return
    setPatientGate(null)
    setFinishOpen(false)
    clearSF600Preview()
    clearDD689Preview()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview])

  const finishItems = ((): ContextMenuItem[] => {
    const items: ContextMenuItem[] = []
    if (saveKind) {
      const isUpdate = !!savedIdRef.current && savedNotes.some(n => n.id === savedIdRef.current)
      const label = isUpdate
        ? 'Update My Notes'
        : savedNotes.length >= SAVED_NOTES_CAP ? 'Save (replaces oldest)' : 'Save to My Notes'
      items.push({ key: 'save', label, icon: Save, onAction: async () => {
        if (await handleSave()) emitCopied('Saved to My Notes')
      } })
    }
    items.push(...noteExportOptions({
      onExportSF600: () => { if (note) setPatientGate('sf600') },
      onExportDD689: () => { if (encoded) setPatientGate('dd689') },
      onShare: handleShare,
      // Same medic/provider notes My Notes can hold; the drawer re-imports the plaintext.
      onEditInProvider: isProviderRole && saveKind ? () => {
        onClose()
        openProviderNote({ payload: encoded })
      } : undefined,
    }).map(({ key, label, icon, onAction }) => ({ key, label, icon, onAction })))
    return items
  })()

  // ── Screens ───────────────────────────────────────────────────────────────
  const pdfPreview = sf600Preview ?? dd689Preview ?? null
  const generating = sf600ExportStatus === 'generating' || exportStatus === 'generating'
  const screen: 'note' | 'patient' | 'pdf' = generating || pdfPreview ? 'pdf' : patientGate ? 'patient' : 'note'
  const patientForm = usePatientIdDraft(patientGate !== null, patientGate ?? undefined)

  const clearPdf = () => { clearSF600Preview(); clearDD689Preview() }
  const back = () => { if (screen === 'pdf') clearPdf(); else setPatientGate(null) }
  const confirmPatient = () => {
    patientForm.submit((patient, extras, stamp) => patientGate === 'dd689' ? handleExportDD689(patient, extras) : handleExportSF600(patient, stamp))
    setPatientGate(null)
  }
  const savePdf = () => {
    if (sf600Preview) downloadSF600(); else downloadDD689()
    clearPdf()
  }

  const open = !!preview
  useEscBackout(open && !finishOpen, screen === 'note' ? onClose : back)

  const title = screen === 'pdf'
    ? pdfPreview?.filename ?? 'PDF'
    : screen === 'patient' ? 'Patient Identification' : 'Imported Note'

  const actions = screen === 'pdf'
    ? (pdfPreview ? <PillButton icon={Download} iconSize={18} accent="info" onClick={savePdf} label="Save" /> : undefined)
    : screen === 'patient'
      ? <PillButton icon={Check} iconSize={18} accent="success" onClick={confirmPatient} label={patientForm.isDD689 ? 'Create DD689' : 'Create SF600'} />
      : (
        <>
          {medevacReq && onOpenMedevac && (
            <PillButton icon={ExternalLink} iconSize={18} onClick={() => onOpenMedevac(medevacReq)} label="Open 9-Line" />
          )}
          <div ref={finishRef} className="flex">
            <PillButton icon={Check} iconSize={18} accent="success" onClick={() => setFinishOpen(true)} label="Finish" />
          </div>
        </>
      )

  return (
    <PaneSurface
      isOpen={open}
      onClose={onClose}
      title={title}
      onBack={screen === 'note' ? undefined : back}
      actions={actions}
      loading={screen === 'pdf' && !pdfPreview}
      closeOnEsc={false}
      width={480}
      maxHeight={90}
      desktopZIndex={70}
    >
      {shown && screen === 'note' && (
        <div className="px-4 py-3 space-y-4">
          {/* Source: symptom + disposition + author */}
          <section className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-primary">{shown.symptomText}</span>
              {shown.dispositionType && colors && (
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9pt] font-medium ${colors.badgeBg} ${colors.badgeText}`}>
                  {shown.dispositionType}
                  {shown.dispositionText ? ` — ${shown.dispositionText}` : ''}
                </span>
              )}
            </div>
            {shown.authorLabel && (
              <div className="flex items-center gap-1.5 text-[10pt] text-tertiary">
                {authorAvatarSvg
                  ? <span className="w-4 h-4 rounded-full overflow-hidden shrink-0">{authorAvatarSvg}</span>
                  : <User size={12} className="shrink-0" />}
                {shown.authorLabel.replace(/^Signed: /, '')}
              </div>
            )}
          </section>

          <NoteOutputSections
            previewNote={note}
            onCopyNote={() => copyWithHtml(note)}
            onCopyEncoded={() => copyWithHtml(encoded)}
            barcode={<BarcodeDisplay encodedText={encoded} layout={encoded.length > 300 ? 'col' : 'row'} />}
          />
        </div>
      )}
      {screen === 'patient' && patientForm.body}
      {screen === 'pdf' && pdfPreview && (
        <PdfCanvasView bytes={pdfPreview.bytes} scroll={false} className="bg-themewhite" />
      )}
      <AnchoredMenu
        isOpen={finishOpen && screen === 'note'}
        anchorRef={finishRef}
        anchorRect={null}
        align="right"
        layout="list"
        items={finishItems}
        onClose={() => setFinishOpen(false)}
      />
    </PaneSurface>
  )
}
