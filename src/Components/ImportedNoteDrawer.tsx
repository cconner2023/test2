import { useState, useEffect, type ReactNode } from 'react'
import { User, ExternalLink, X } from 'lucide-react'
import { BaseDrawer } from '@/Components/primitives/BaseDrawer'
import { HeaderPill, PillButton } from '@/Components/primitives/HeaderPill'
import { NoteOutputSections } from './NoteOutputSections'
import { BarcodeDisplay } from './Barcode'
import { PatientIdPopover } from './PatientIdPopover'
import { PdfPreviewModal } from './PdfPreviewModal'
import type { ImportPreview } from '../Hooks/useNoteImport'
import type { MedevacRequest } from '../Types/MedevacTypes'
import type { PatientIdentification } from '../Utilities/SF600Export'
import { useNoteShare } from '../Hooks/useNoteShare'
import { useDD689Export } from '../Hooks/useDD689Export'
import { useSF600Export } from '../Hooks/useSF600Export'
import { useUserProfile } from '../Hooks/useUserProfile'
import { profileAvatars } from '../Data/ProfileAvatars'
import { supabase } from '../lib/supabase'
import { copyWithHtml } from '../Utilities/clipboardUtils'
import { getColorClasses } from '../Utilities/ColorUtilities'

interface ImportedNoteDrawerProps {
  preview: ImportPreview | null
  onClose: () => void
  onOpenMedevac?: (req: MedevacRequest) => void
  isMobile: boolean
}

/**
 * Base Import Note result — the WriteNote "Full Note" page for a decoded
 * barcode: same Note Preview / Encoded Note sections, data matrices and
 * actions (copy, SF600, share, DD689).
 */
export function ImportedNoteDrawer({ preview, onClose, onOpenMedevac, isMobile }: ImportedNoteDrawerProps) {
  // Hold the last preview so content stays put through the close animation.
  const [shown, setShown] = useState<ImportPreview | null>(preview)
  useEffect(() => { if (preview) setShown(preview) }, [preview])

  const { profile } = useUserProfile()
  const { shareNote } = useNoteShare()
  const { exportDD689, exportStatus, dd689Preview, downloadDD689, clearDD689Preview } = useDD689Export()
  const { exportSF600, sf600ExportStatus, sf600Preview, downloadSF600, clearSF600Preview } = useSF600Export()
  const [patientGateOpen, setPatientGateOpen] = useState(false)
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

  const handleExportSF600 = (patient: PatientIdentification) => {
    if (!note) return
    const dateStr = new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()
    exportSF600({ noteText: note, date: dateStr, signatureName: authorSig, patient })
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

  const handleExportDD689 = () => {
    if (!shown || !encoded) return
    exportDD689({
      encodedValue: encoded,
      dispositionType: shown.dispositionType,
      dispositionText: shown.dispositionText,
      symptomText: shown.symptomText || 'Note',
      clinicName: profile.clinicName || '',
      authorLine: authorSig,
    })
  }

  const medevacReq = shown?.isMedevac ? shown.medevacReq : undefined

  return (
    <>
      <BaseDrawer
        isVisible={!!preview}
        onClose={onClose}
        fullHeight="90dvh"
        mobileClassName=""
        header={{
          title: 'Imported Note',
          ...(medevacReq && onOpenMedevac ? {
            hideDefaultClose: true,
            rightContent: (
              <HeaderPill>
                <PillButton icon={ExternalLink} onClick={() => onOpenMedevac(medevacReq)} label="Open 9-Line" />
                <PillButton icon={X} onClick={onClose} label="Close" />
              </HeaderPill>
            ),
          } : {}),
        }}
      >
        {shown && (
          <div className="w-full px-2 pt-2 pb-32">
            <div className="space-y-4 mx-2 mt-2">
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
                onExportSF600={() => { if (note) setPatientGateOpen(true) }}
                onCopyEncoded={() => copyWithHtml(encoded)}
                onShare={handleShare}
                onExportDD689={handleExportDD689}
                encodedLength={encoded.length}
                barcode={<BarcodeDisplay encodedText={encoded} layout={encoded.length > 300 ? 'col' : 'row'} />}
              />
            </div>
          </div>
        )}
      </BaseDrawer>
      <PatientIdPopover
        isOpen={patientGateOpen}
        anchorRect={null}
        onClose={() => setPatientGateOpen(false)}
        onConfirm={handleExportSF600}
      />
      <PdfPreviewModal
        preview={sf600Preview ?? dd689Preview ?? null}
        generating={sf600ExportStatus === 'generating' || exportStatus === 'generating'}
        onDownload={sf600Preview ? downloadSF600 : downloadDD689}
        onClose={sf600Preview ? clearSF600Preview : clearDD689Preview}
      />
    </>
  )
}
