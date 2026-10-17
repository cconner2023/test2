import { useEffect, useState } from 'react'
import { Check, PenLine, X } from 'lucide-react'
import { PreviewOverlay } from './PreviewOverlay'
import { FooterPill } from '@/Components/primitives/FooterPill'
import { PillButton } from '@/Components/primitives/HeaderPill'
import { TextInput, TextArea, DatePickerInput } from '@/Components/primitives/FormInputs'
import { SignaturePad } from '@/Components/primitives/SignaturePad'
import { Chip, ChipBar } from '@/Components/primitives/Chip'
import type { PatientIdentification } from '../Utilities/SF600Export'
import type { DD689Extras } from '../Utilities/DD689Export'

const EMPTY: PatientIdentification = {
  lastName: '', firstName: '', middleInitial: '',
  dodid: '', gender: '', dob: '', rankGrade: '',
}

const GENDER_OPTIONS: { value: 'M' | 'F'; label: string }[] = [
  { value: 'M', label: 'M' },
  { value: 'F', label: 'F' },
]

export type PatientIdForm = 'sf600' | 'dd689'

/**
 * Gating popover that collects the patient identification block before an SF600
 * or DD689 is produced. SF600: the bottom-left "PATIENT'S IDENTIFICATION" box on
 * page 1. DD689: blocks 3–5 (name, DoD ID, grade) plus an optional profile for
 * the medical officer's remarks and the medic's drawn signature (block 13).
 * Ephemeral: the draft lives only for the life of this popover; `onConfirm`
 * hands it straight to the exporter and it is never persisted (no PHI at rest,
 * none on the wire).
 */
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
  onConfirm: (patient: PatientIdentification, extras: DD689Extras) => void
}) {
  const [draft, setDraft] = useState<PatientIdentification>({ ...EMPTY })
  const [profile, setProfile] = useState('')
  const [signatureImage, setSignatureImage] = useState<string | undefined>()
  const [signing, setSigning] = useState(false)
  const isDD689 = form === 'dd689'

  // Fresh card each time the popover opens.
  useEffect(() => {
    if (isOpen) {
      setDraft({ ...EMPTY })
      setProfile('')
      setSignatureImage(undefined)
    }
  }, [isOpen])

  const upd = (fields: Partial<PatientIdentification>) =>
    setDraft(prev => ({ ...prev, ...fields }))

  const confirm = () => {
    onConfirm(draft, { profile, signatureImage })
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
          <PillButton icon={Check} iconSize={16} accent="success" onClick={confirm} label={isDD689 ? 'Create DD689' : 'Create SF600'} />
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

        {/* Gender — SF600 only (no DD689 block) */}
        {!isDD689 && <div className="px-4 py-3 border-b border-primary/6">
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
        </div>}

        {/* Date of birth — SF600 only */}
        {!isDD689 && (
          <DatePickerInput
            value={draft.dob}
            onChange={(v) => upd({ dob: v })}
            placeholder="Date of birth"
            maxDate={today}
          />
        )}

        {/* Rank / Grade */}
        <TextInput
          value={draft.rankGrade}
          onChange={(v) => upd({ rankGrade: v })}
          placeholder="Rank / Grade"
        />

        {isDD689 && (
          <>
            {/* Profile — lands beside the data matrix in block 12 */}
            <TextArea
              value={profile}
              onChange={setProfile}
              placeholder="Profile / limitations (if applicable)"
              rows={3}
            />

            {/* Medic signature — block 13 */}
            {signatureImage ? (
              <div className="flex items-center gap-3 px-4 py-2 border-b border-primary/6 last:border-b-0">
                <img src={signatureImage} alt="Medic signature" className="h-10 flex-1 min-w-0 object-contain object-left" />
                <button
                  type="button"
                  onClick={() => setSignatureImage(undefined)}
                  aria-label="Clear signature"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all"
                >
                  <X size={15} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setSigning(true)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left text-base md:text-sm text-tertiary active:bg-primary/5 transition-colors"
              >
                <PenLine size={16} className="shrink-0" />
                Medic signature
              </button>
            )}
          </>
        )}
      </div>
      <SignaturePad
        isOpen={signing}
        title="Medic signature"
        subtitle="Signs block 13 of the DD689"
        confirmLabel="Sign"
        onClose={() => setSigning(false)}
        onComplete={(img) => { setSignatureImage(img); setSigning(false) }}
      />
    </PreviewOverlay>
  )
}
