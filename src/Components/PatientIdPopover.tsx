import { Check } from 'lucide-react'
import { PreviewOverlay } from './PreviewOverlay'
import { FooterPill } from '@/Components/primitives/FooterPill'
import { PillButton } from '@/Components/primitives/HeaderPill'
import { usePatientIdDraft, type PatientIdForm } from '../Hooks/usePatientIdDraft'
import type { PatientIdentification, SF600Stamp } from '../Utilities/SF600Export'
import type { DD689Extras } from '../Utilities/DD689Export'

export type { PatientIdForm }

/** Gating popover that collects the patient identification block before an SF600 or DD689 is produced. */
export function PatientIdPopover({
  isOpen,
  anchorRect,
  form = 'sf600',
  onClose,
  onConfirm,
}: {
  isOpen: boolean
  anchorRect: DOMRect | null
  form?: PatientIdForm
  onClose: () => void
  onConfirm: (patient: PatientIdentification, extras: DD689Extras, stamp: SF600Stamp) => void
}) {
  const { body, submit, isDD689 } = usePatientIdDraft(isOpen, form)
  const confirm = () => { submit(onConfirm); onClose() }

  return (
    <PreviewOverlay
      isOpen={isOpen}
      onClose={onClose}
      anchorRect={anchorRect}
      title="Patient Identification"
      maxWidth={380}
      rightFooter={
        <FooterPill side="right">
          <PillButton icon={Check} iconSize={16} accent="success" onClick={confirm} label={isDD689 ? 'Create DD689' : 'Create SF600'} />
        </FooterPill>
      }
    >
      {body}
    </PreviewOverlay>
  )
}
