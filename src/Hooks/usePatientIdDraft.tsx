import { useEffect, useState } from 'react'
import { PenLine, X } from 'lucide-react'
import { TextInput, TextArea, DatePickerInput, TimeInput } from '@/Components/primitives/FormInputs'
import { SignaturePad } from '@/Components/primitives/SignaturePad'
import { Chip, ChipBar } from '@/Components/primitives/Chip'
import { nowStamp, type PatientIdentification, type SF600Stamp } from '../Utilities/SF600Export'
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
 * Patient identification draft for an SF600 or DD689. SF600: the bottom-left
 * "PATIENT'S IDENTIFICATION" box on page 1. DD689: blocks 3–5 (name, DoD ID,
 * grade) plus an optional profile for the medical officer's remarks and the
 * medic's drawn signature (block 13). Ephemeral: the draft lives only while
 * `active`; `submit` hands it straight to the exporter and it is never
 * persisted (no PHI at rest, none on the wire).
 *
 * Returns the form body so any surface can host it: PatientIdPopover,
 * or a drill-down screen of a PaneSurface (Imported Note).
 */
export function usePatientIdDraft(active: boolean, form: PatientIdForm = 'sf600') {
  const [draft, setDraft] = useState<PatientIdentification>({ ...EMPTY })
  const [profile, setProfile] = useState('')
  const [signatureImage, setSignatureImage] = useState<string | undefined>()
  const [signing, setSigning] = useState(false)
  const [stamp, setStamp] = useState<SF600Stamp>(() => nowStamp())
  const isDD689 = form === 'dd689'

  // Fresh draft each time the form opens.
  useEffect(() => {
    if (active) {
      setDraft({ ...EMPTY })
      setProfile('')
      setSignatureImage(undefined)
      setStamp(nowStamp())
    }
  }, [active])

  const upd = (fields: Partial<PatientIdentification>) =>
    setDraft(prev => ({ ...prev, ...fields }))

  const submit = (onConfirm: (patient: PatientIdentification, extras: DD689Extras, stamp: SF600Stamp) => void) =>
    onConfirm(draft, { profile, signatureImage }, stamp)

  const today = nowStamp().date

  const body = (
    <>
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

        {/* Note date / time — SF600 DATE column rows 1–2 */}
        {!isDD689 && (
          <>
            <DatePickerInput
              value={stamp.date}
              onChange={(v) => setStamp(prev => ({ ...prev, date: v || prev.date }))}
              placeholder="Note date"
            />
            <TimeInput
              value={stamp.time}
              onChange={(v) => setStamp(prev => ({ ...prev, time: v }))}
              label="Time"
            />
          </>
        )}

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
    </>
  )

  return { body, submit, isDD689 }
}
