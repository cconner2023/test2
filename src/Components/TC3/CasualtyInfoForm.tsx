import { memo, useState, useRef, useCallback } from 'react'
import { Plus, Check, RotateCcw, User, ChevronRight } from 'lucide-react'
import { useTC3Store } from '../../stores/useTC3Store'
import { PreviewOverlay } from '../PreviewOverlay'
import { TextInput, DatePickerInput, PickerInput } from '../FormInputs'
import { ActionButton } from '../ActionButton'
import { ActionPill } from '../ActionPill'
import { EmptyState } from '../EmptyState'
import type { EvacPriority, BloodType } from '../../Types/TC3Types'
import { MILITARY_TIME_OPTIONS, militaryToHHMM, hhmmToMilitary } from '../../Types/CalendarTypes'

const EVAC_OPTIONS: { value: EvacPriority; label: string; color: string }[] = [
  { value: 'Urgent', label: 'U', color: 'bg-themeredred' },
  { value: 'Priority', label: 'P', color: 'bg-amber-500' },
  { value: 'Routine', label: 'R', color: 'bg-themegreen' },
]

const SEX_OPTIONS = [
  { value: 'M' as const, label: 'M' },
  { value: 'F' as const, label: 'F' },
]

const BLOOD_TYPE_OPTIONS: BloodType[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unk']

const EMPTY_CASUALTY = {
  battleRosterNo: '', lastName: '', firstName: '',
  unit: '', sex: '' as '' | 'M' | 'F', bloodType: '' as BloodType, service: '', allergies: '',
  dateTimeOfInjury: '', dateTimeOfTreatment: '',
}

function hasData(c: typeof EMPTY_CASUALTY) {
  return !!(c.lastName || c.firstName || c.battleRosterNo)
}

function formatDT(iso: string) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) + ' ' +
      d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
  } catch { return iso }
}

export const CasualtyInfoForm = memo(function CasualtyInfoForm() {
  const casualty = useTC3Store((s) => s.card.casualty)
  const updateCasualty = useTC3Store((s) => s.updateCasualty)
  const evacuation = useTC3Store((s) => s.card.evacuation)
  const updateEvacuation = useTC3Store((s) => s.updateEvacuation)

  const [popoverVisible, setPopoverVisible] = useState(false)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  const [draft, setDraft] = useState({ ...EMPTY_CASUALTY })
  const [draftEvac, setDraftEvac] = useState<EvacPriority>('')

  const openPopover = useCallback((ref: React.RefObject<HTMLElement | null>) => {
    const { battleRosterNo, lastName, firstName, unit, sex, bloodType, service, allergies, dateTimeOfInjury, dateTimeOfTreatment } = casualty
    setDraft({ battleRosterNo, lastName, firstName, unit, sex, bloodType, service, allergies, dateTimeOfInjury, dateTimeOfTreatment })
    setDraftEvac(evacuation.priority)
    setAnchorRect(ref.current?.getBoundingClientRect() ?? null)
    setPopoverVisible(true)
  }, [casualty, evacuation.priority])

  const handleAccept = useCallback(() => {
    updateCasualty(draft)
    updateEvacuation({ priority: draftEvac })
  }, [draft, draftEvac, updateCasualty, updateEvacuation])

  const handleReset = useCallback(() => {
    setDraft({ ...EMPTY_CASUALTY })
    setDraftEvac('')
    updateCasualty(EMPTY_CASUALTY)
    updateEvacuation({ priority: '' })
  }, [updateCasualty, updateEvacuation])

  const updateDraft = useCallback((fields: Partial<typeof draft>) => {
    setDraft(prev => ({ ...prev, ...fields }))
  }, [])

  const populated = hasData(casualty)

  return (
    <div data-tour="tc3-casualty-info">
      {/* ── Section header ── */}
      <div className="mb-2">
        <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider">
          Casualty Information
        </p>
      </div>

      {/* ── Section card ── */}
      {populated ? (
        <button
          ref={cardRef}
          type="button"
          onClick={() => openPopover(cardRef)}
          className="w-full rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden text-left active:scale-95 transition-all hover:bg-themeblue2/5"
        >
          <div className="flex items-center gap-3 px-4 py-3">
            {evacuation.priority ? (
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-tertiary/10`}>
                <span className="text-[14pt] font-medium text-tertiary">
                  {evacuation.priority === 'Urgent' ? 'U' : evacuation.priority === 'Priority' ? 'P' : 'R'}
                </span>
              </div>
            ) : (
              <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-tertiary/10">
                <User size={18} className="text-tertiary" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="flex-1 min-w-0 text-sm font-medium text-primary truncate">
                  {[casualty.lastName, casualty.firstName].filter(Boolean).join(', ') || '—'}
                </p>
                <ChevronRight size={16} className="text-tertiary shrink-0" />
              </div>
              <p className="text-[9pt] text-secondary truncate mt-0.5">
                {[
                  casualty.battleRosterNo?.toUpperCase(),
                  casualty.sex,
                  casualty.service,
                  casualty.unit,
                  casualty.allergies && `Allergies: ${casualty.allergies}`,
                  casualty.dateTimeOfInjury && `Inj ${formatDT(casualty.dateTimeOfInjury)}`,
                  casualty.dateTimeOfTreatment && `Tx ${formatDT(casualty.dateTimeOfTreatment)}`,
                ].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
        </button>
      ) : (
        <EmptyState
          title="No casualty details"
          action={{
            icon: Plus,
            label: 'Add casualty details',
            onClick: (anchor) => openPopover({ current: anchor }),
          }}
        />
      )}

      {/* ── Edit popover ── */}
      <PreviewOverlay
        isOpen={popoverVisible}
        onClose={() => setPopoverVisible(false)}
        anchorRect={anchorRect}
        maxWidth={380}
        preview={
          <div>
            {/* EVAC Priority */}
            <div className="px-4 py-3 border-b border-primary/6">
              <div className="flex gap-1.5 flex-wrap">
                {EVAC_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDraftEvac(prev => prev === opt.value ? '' : opt.value)}
                    className={`w-9 h-9 rounded-full text-[10pt] font-bold transition-all border active:scale-95 ${
                      draftEvac === opt.value
                        ? `${opt.color} text-white border-transparent`
                        : 'border-tertiary/15 text-tertiary hover:bg-tertiary/5'
                    }`}
                    title={`EVAC: ${opt.label}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Name */}
            <div className="flex items-stretch border-b border-primary/6">
              <div className="flex-1 min-w-0">
                <TextInput
                  value={draft.lastName}
                  onChange={(v) => updateDraft({ lastName: v })}
                  placeholder="Last name"
                />
              </div>
              <div className="flex-1 min-w-0 border-l border-primary/6">
                <TextInput
                  value={draft.firstName}
                  onChange={(v) => updateDraft({ firstName: v })}
                  placeholder="First name"
                />
              </div>
            </div>

            {/* Battle Roster */}
            <TextInput
              value={draft.battleRosterNo}
              onChange={(v) => updateDraft({ battleRosterNo: v })}
              placeholder="Battle roster no."
            />

            {/* Sex */}
            <div className="px-4 py-3 border-b border-primary/6">
              <div className="flex gap-1.5">
                {SEX_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateDraft({ sex: draft.sex === opt.value ? '' : opt.value })}
                    className={`w-9 h-9 rounded-full text-[10pt] font-bold transition-all border active:scale-95 ${
                      draft.sex === opt.value
                        ? 'bg-themeblue2 text-white border-transparent'
                        : 'border-tertiary/15 text-tertiary hover:bg-tertiary/5'
                    }`}
                    title={`Sex: ${opt.label}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Blood Type */}
            <div className="px-4 py-3 border-b border-primary/6">
              <div className="flex flex-wrap gap-1">
                {BLOOD_TYPE_OPTIONS.map((bt) => (
                  <button
                    key={bt}
                    type="button"
                    onClick={() => updateDraft({ bloodType: draft.bloodType === bt ? '' : bt })}
                    className={`min-w-[2.25rem] h-9 px-2 rounded-full text-[10pt] font-bold transition-all border active:scale-95 ${
                      draft.bloodType === bt
                        ? 'bg-themeblue2 text-white border-transparent'
                        : 'border-tertiary/15 text-tertiary hover:bg-tertiary/5'
                    }`}
                    title={`Blood type: ${bt}`}
                  >
                    {bt}
                  </button>
                ))}
              </div>
            </div>

            {/* Unit + Service */}
            <div className="flex items-stretch border-b border-primary/6">
              <div className="flex-1 min-w-0">
                <TextInput
                  value={draft.unit}
                  onChange={(v) => updateDraft({ unit: v })}
                  placeholder="Unit designation"
                />
              </div>
              <div className="flex-1 min-w-0 border-l border-primary/6">
                <TextInput
                  value={draft.service}
                  onChange={(v) => updateDraft({ service: v })}
                  placeholder="Branch"
                />
              </div>
            </div>

            {/* Allergies */}
            <TextInput
              value={draft.allergies}
              onChange={(v) => updateDraft({ allergies: v })}
              placeholder="Allergies (NKDA if none)"
            />

            {/* DTG Injury */}
            <div className="flex items-stretch border-b border-primary/6">
              <div className="flex-1 min-w-0">
                <DatePickerInput
                  value={draft.dateTimeOfInjury.slice(0, 10)}
                  onChange={(date) => {
                    const time = draft.dateTimeOfInjury.slice(11) || '08:00'
                    updateDraft({ dateTimeOfInjury: `${date}T${time}` })
                  }}
                  placeholder="Injury date"
                />
              </div>
              <div className="flex-1 min-w-0 border-l border-primary/6">
                <PickerInput
                  value={draft.dateTimeOfInjury.slice(11) ? hhmmToMilitary(draft.dateTimeOfInjury.slice(11)) : ''}
                  onChange={(mil) => {
                    const date = draft.dateTimeOfInjury.slice(0, 10) || new Date().toISOString().slice(0, 10)
                    updateDraft({ dateTimeOfInjury: `${date}T${militaryToHHMM(mil)}` })
                  }}
                  options={MILITARY_TIME_OPTIONS}
                  placeholder="Injury time"
                />
              </div>
            </div>

            {/* DTG Treatment */}
            <div className="flex items-stretch">
              <div className="flex-1 min-w-0">
                <DatePickerInput
                  value={draft.dateTimeOfTreatment.slice(0, 10)}
                  onChange={(date) => {
                    const time = draft.dateTimeOfTreatment.slice(11) || '08:00'
                    updateDraft({ dateTimeOfTreatment: `${date}T${time}` })
                  }}
                  placeholder="Treatment date"
                />
              </div>
              <div className="flex-1 min-w-0 border-l border-primary/6">
                <PickerInput
                  value={draft.dateTimeOfTreatment.slice(11) ? hhmmToMilitary(draft.dateTimeOfTreatment.slice(11)) : ''}
                  onChange={(mil) => {
                    const date = draft.dateTimeOfTreatment.slice(0, 10) || new Date().toISOString().slice(0, 10)
                    updateDraft({ dateTimeOfTreatment: `${date}T${militaryToHHMM(mil)}` })
                  }}
                  options={MILITARY_TIME_OPTIONS}
                  placeholder="Treatment time"
                />
              </div>
            </div>
          </div>
        }
        actions={[
          {
            key: 'reset',
            label: 'Reset',
            icon: RotateCcw,
            onAction: handleReset,
            variant: 'danger',
          },
          {
            key: 'accept',
            label: 'Accept',
            icon: Check,
            onAction: handleAccept,
          },
        ]}
      />
    </div>
  )
})
