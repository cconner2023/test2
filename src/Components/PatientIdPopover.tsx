import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { PreviewOverlay } from './PreviewOverlay'
import { FooterPill } from '@/Components/primitives/FooterPill'
import { PillButton } from '@/Components/primitives/HeaderPill'
import { TextInput, DatePickerInput } from '@/Components/primitives/FormInputs'
import { Chip, ChipBar } from '@/Components/primitives/Chip'
import type { PatientIdentification } from '../Utilities/SF600Export'

const EMPTY: PatientIdentification = {
  lastName: '', firstName: '', middleInitial: '',
  dodid: '', gender: '', dob: '', rankGrade: '',
}

const GENDER_OPTIONS: { value: 'M' | 'F'; label: string }[] = [
  { value: 'M', label: 'M' },
  { value: 'F', label: 'F' },
]

/**
 * Gating popover that collects the patient identification block before an SF600
 * is produced — the fields that land in the bottom-left "PATIENT'S
 * IDENTIFICATION" box on page 1. Ephemeral: the draft lives only for the life of
 * this popover; `onConfirm` hands it straight to the exporter and it is never
 * persisted (no PHI at rest, none on the wire).
 */
export function PatientIdPopover({
  isOpen,
  anchorRect,
  onClose,
  onConfirm,
}: {
  isOpen: boolean
  anchorRect: DOMRect | null
  onClose: () => void
  onConfirm: (patient: PatientIdentification) => void
}) {
  const [draft, setDraft] = useState<PatientIdentification>({ ...EMPTY })

  // Fresh card each time the popover opens.
  useEffect(() => {
    if (isOpen) setDraft({ ...EMPTY })
  }, [isOpen])

  const upd = (fields: Partial<PatientIdentification>) =>
    setDraft(prev => ({ ...prev, ...fields }))

  const confirm = () => {
    onConfirm(draft)
    onClose()
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <PreviewOverlay
      isOpen={isOpen}
      onClose={onClose}
      anchorRect={anchorRect}
      title="Patient Identification"
      maxWidth={380}
      rightFooter={
        <FooterPill side="right">
          <PillButton icon={Check} iconSize={16} accent="success" onClick={confirm} label="Create SF600" />
        </FooterPill>
      }
    >
      <div>
        {/* Name — Last / First */}
        <div className="flex items-stretch border-b border-primary/6">
          <div className="flex-1 min-w-0">
            <TextInput value={draft.lastName} onChange={(v) => upd({ lastName: v })} placeholder="Last name" />
          </div>
          <div className="flex-1 min-w-0 border-l border-primary/6">
            <TextInput value={draft.firstName} onChange={(v) => upd({ firstName: v })} placeholder="First name" />
          </div>
        </div>

        {/* Middle initial */}
        <TextInput
          value={draft.middleInitial}
          onChange={(v) => upd({ middleInitial: v.slice(0, 1).toUpperCase() })}
          placeholder="Middle initial"
          maxLength={1}
        />

        {/* DODID */}
        <TextInput
          value={draft.dodid}
          onChange={(v) => upd({ dodid: v.replace(/\D/g, '').slice(0, 10) })}
          placeholder="DODID"
          inputMode="numeric"
          maxLength={10}
        />

        {/* Gender */}
        <div className="px-4 py-3 border-b border-primary/6">
          <span className="text-[9pt] font-semibold text-tertiary uppercase tracking-widest">Gender</span>
          <ChipBar className="mt-1.5">
            {GENDER_OPTIONS.map((opt) => (
              <Chip
                key={opt.value}
                active={draft.gender === opt.value}
                title={`Gender: ${opt.label}`}
                onClick={() => upd({ gender: draft.gender === opt.value ? '' : opt.value })}
              >
                {opt.label}
              </Chip>
            ))}
          </ChipBar>
        </div>

        {/* Date of birth */}
        <DatePickerInput
          value={draft.dob}
          onChange={(v) => upd({ dob: v })}
          placeholder="Date of birth"
          maxDate={today}
        />

        {/* Rank / Grade */}
        <TextInput
          value={draft.rankGrade}
          onChange={(v) => upd({ rankGrade: v })}
          placeholder="Rank / Grade"
        />
      </div>
    </PreviewOverlay>
  )
}
