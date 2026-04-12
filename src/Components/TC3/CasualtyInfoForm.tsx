import { memo, useState, useRef, useCallback } from 'react'
import { Plus, Check, RotateCcw, User, ChevronRight } from 'lucide-react'
import { useTC3Store } from '../../stores/useTC3Store'
import { PreviewOverlay } from '../PreviewOverlay'
import { TextInput, DatePickerInput, PickerInput } from '../FormInputs'
import type { EvacPriority } from '../../Types/TC3Types'

/** 30-min military time options: "0000", "0030", … "2330" */
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, '0')
  const m = i % 2 === 0 ? '00' : '30'
  return `${h}${m}`
})

function militaryToHHMM(mil: string): string {
  return `${mil.slice(0, 2)}:${mil.slice(2)}`
}

function hhmmToMilitary(hhmm: string): string {
  return hhmm.replace(':', '')
}

const EVAC_OPTIONS: { value: EvacPriority; label: string; color: string }[] = [
  { value: 'Urgent', label: 'U', color: 'bg-themeredred' },
  { value: 'Priority', label: 'P', color: 'bg-amber-500' },
  { value: 'Routine', label: 'R', color: 'bg-themegreen' },
]

const SEX_OPTIONS = [
  { value: 'M' as const, label: 'M' },
  { value: 'F' as const, label: 'F' },
]

const EMPTY_CASUALTY = {
  battleRosterNo: '', lastName: '', firstName: '',
  unit: '', sex: '' as '' | 'M' | 'F', service: '', allergies: '',
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
  const btnRef = useRef<HTMLButtonElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  const [draft, setDraft] = useState({ ...EMPTY_CASUALTY })
  const [draftEvac, setDraftEvac] = useState<EvacPriority>('')

  const openPopover = useCallback((ref: React.RefObject<HTMLElement | null>) => {
    const { battleRosterNo, lastName, firstName, unit, sex, service, allergies, dateTimeOfInjury, dateTimeOfTreatment } = casualty
    setDraft({ battleRosterNo, lastName, firstName, unit, sex, service, allergies, dateTimeOfInjury, dateTimeOfTreatment })
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
        <p className="text-[9pt] font-semibold text-primary/80 uppercase tracking-wider">
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
          <div className="flex items-start gap-3 px-4 py-3.5">
            {evacuation.priority ? (
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5 bg-tertiary/10`}>
                <span className="text-[18px] font-medium text-tertiary/50">
                  {evacuation.priority === 'Urgent' ? 'U' : evacuation.priority === 'Priority' ? 'P' : 'R'}
                </span>
              </div>
            ) : (
              <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-tertiary/10 mt-0.5">
                <User size={18} className="text-tertiary/50" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              {/* Name + chevron */}
              <div className="flex items-center gap-1.5">
                <p className="flex-1 min-w-0 text-sm font-medium text-primary truncate">
                  {[casualty.lastName, casualty.firstName].filter(Boolean).join(', ') || '—'}
                </p>
                <ChevronRight size={16} className="text-tertiary/40 shrink-0" />
              </div>
              {/* Detail grid */}
              <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1">
                <p className="text-[11px] text-secondary flex flex-wrap items-center gap-x-2">
                  {casualty.battleRosterNo && <span className="font-medium uppercase">{casualty.battleRosterNo}</span>}
                  {casualty.sex && <span>{casualty.sex}</span>}
                  {casualty.service && <span>{casualty.service}</span>}
                  {casualty.unit && <span>{casualty.unit}</span>}
                </p>
                <p className="text-[11px] text-secondary truncate">
                  {casualty.allergies
                    ? <><span className="font-medium">Allergies:</span> {casualty.allergies}</>
                    : null}
                </p>
                <p className="text-[11px] text-secondary">
                  {casualty.dateTimeOfInjury
                    ? <><span className="font-medium">Inj</span> {formatDT(casualty.dateTimeOfInjury)}</>
                    : null}
                </p>
                <p className="text-[11px] text-secondary">
                  {casualty.dateTimeOfTreatment ? formatDT(casualty.dateTimeOfTreatment) : null}
                </p>
              </div>
            </div>
          </div>
        </button>
      ) : (
        /* ── Empty state ── */
        <div className="flex flex-col items-center gap-2 py-6">
          <button
            ref={btnRef}
            type="button"
            onClick={() => openPopover(btnRef)}
            className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition-all bg-tertiary/8 border border-dashed border-tertiary/20 text-tertiary/40"
          >
            <Plus size={14} />
          </button>
          <p className="text-[10px] text-tertiary/40">Add casualty details</p>
        </div>
      )}

      {/* ── Edit popover ── */}
      <PreviewOverlay
        isOpen={popoverVisible}
        onClose={() => setPopoverVisible(false)}
        anchorRect={anchorRect}
        maxWidth={380}
        preview={
          <div className="px-4 py-3 space-y-3">
            {/* EVAC Priority */}
            <div>
              <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">EVAC Priority</span>
              <div className="flex gap-1.5 mt-1.5">
                {EVAC_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDraftEvac(prev => prev === opt.value ? '' : opt.value)}
                    className={`w-9 h-9 rounded-full text-xs font-bold transition-all border active:scale-95 ${
                      draftEvac === opt.value
                        ? `${opt.color} text-white border-transparent`
                        : 'border-tertiary/15 text-tertiary hover:bg-tertiary/5'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Name */}
            <div className="grid grid-cols-2 gap-2">
              <TextInput
                label="Last Name"
                value={draft.lastName}
                onChange={(v) => updateDraft({ lastName: v })}
                placeholder="Last name"
              />
              <TextInput
                label="First Name"
                value={draft.firstName}
                onChange={(v) => updateDraft({ firstName: v })}
                placeholder="First name"
              />
            </div>

            {/* Battle Roster */}
            <TextInput
              label="Battle Roster No."
              value={draft.battleRosterNo}
              onChange={(v) => updateDraft({ battleRosterNo: v })}
              placeholder="Roster number"
            />

            {/* Sex */}
            <div>
              <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">Sex</span>
              <div className="flex gap-1.5 mt-1.5">
                {SEX_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateDraft({ sex: draft.sex === opt.value ? '' : opt.value })}
                    className={`w-9 h-9 rounded-full text-xs font-bold transition-all border active:scale-95 ${
                      draft.sex === opt.value
                        ? 'bg-themeblue3 text-white border-transparent'
                        : 'border-tertiary/15 text-tertiary hover:bg-tertiary/5'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Unit + Service */}
            <div className="grid grid-cols-2 gap-2">
              <TextInput
                label="Unit"
                value={draft.unit}
                onChange={(v) => updateDraft({ unit: v })}
                placeholder="Unit designation"
              />
              <TextInput
                label="Service"
                value={draft.service}
                onChange={(v) => updateDraft({ service: v })}
                placeholder="Branch"
              />
            </div>

            {/* Allergies */}
            <TextInput
              label="Allergies"
              value={draft.allergies}
              onChange={(v) => updateDraft({ allergies: v })}
              placeholder="NKDA if none"
            />

            {/* DTG Injury */}
            <div>
              <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">DTG Injury</span>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <DatePickerInput
                  value={draft.dateTimeOfInjury.slice(0, 10)}
                  onChange={(date) => {
                    const time = draft.dateTimeOfInjury.slice(11) || '08:00'
                    updateDraft({ dateTimeOfInjury: `${date}T${time}` })
                  }}
                  placeholder="Date"
                />
                <PickerInput
                  value={draft.dateTimeOfInjury.slice(11) ? hhmmToMilitary(draft.dateTimeOfInjury.slice(11)) : ''}
                  onChange={(mil) => {
                    const date = draft.dateTimeOfInjury.slice(0, 10) || new Date().toISOString().slice(0, 10)
                    updateDraft({ dateTimeOfInjury: `${date}T${militaryToHHMM(mil)}` })
                  }}
                  options={TIME_OPTIONS}
                  placeholder="Time"
                />
              </div>
            </div>

            {/* DTG Treatment */}
            <div>
              <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">DTG Treatment</span>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <DatePickerInput
                  value={draft.dateTimeOfTreatment.slice(0, 10)}
                  onChange={(date) => {
                    const time = draft.dateTimeOfTreatment.slice(11) || '08:00'
                    updateDraft({ dateTimeOfTreatment: `${date}T${time}` })
                  }}
                  placeholder="Date"
                />
                <PickerInput
                  value={draft.dateTimeOfTreatment.slice(11) ? hhmmToMilitary(draft.dateTimeOfTreatment.slice(11)) : ''}
                  onChange={(mil) => {
                    const date = draft.dateTimeOfTreatment.slice(0, 10) || new Date().toISOString().slice(0, 10)
                    updateDraft({ dateTimeOfTreatment: `${date}T${militaryToHHMM(mil)}` })
                  }}
                  options={TIME_OPTIONS}
                  placeholder="Time"
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
