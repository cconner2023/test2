import { memo, useState, useRef, useCallback } from 'react'
import { Plus, Check, RotateCcw, User } from 'lucide-react'
import { useTC3Store } from '../../stores/useTC3Store'
import { PreviewOverlay } from '../PreviewOverlay'
import { TextInput } from '../FormInputs'
import type { EvacPriority } from '../../Types/TC3Types'

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
  battleRosterNo: '', lastName: '', firstName: '', last4: '',
  unit: '', sex: '' as '' | 'M' | 'F', service: '', allergies: '',
  dateTimeOfInjury: '', dateTimeOfTreatment: '',
}

function hasData(c: typeof EMPTY_CASUALTY) {
  return !!(c.lastName || c.firstName || c.battleRosterNo || c.last4)
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
    setDraft({ ...casualty })
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
    <div>
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
          {/* Name + EVAC header */}
          <div className="flex items-center gap-3 px-4 py-3.5">
            <User size={15} className="text-secondary shrink-0" />
            <p className="flex-1 min-w-0 text-sm font-medium text-primary truncate">
              {[casualty.lastName, casualty.firstName].filter(Boolean).join(', ') || '—'}
            </p>
            {evacuation.priority && (
              <span className={`text-[10px] font-bold w-6 h-6 flex items-center justify-center rounded-full text-white shrink-0 ${
                evacuation.priority === 'Urgent' ? 'bg-themeredred' :
                evacuation.priority === 'Priority' ? 'bg-amber-500' : 'bg-themegreen'
              }`}>
                {evacuation.priority === 'Urgent' ? 'U' : evacuation.priority === 'Priority' ? 'P' : 'R'}
              </span>
            )}
          </div>

          {/* DD1380 fields grid */}
          <div className="px-4 pb-3.5 border-t border-tertiary/8 pt-3 grid grid-cols-2 gap-x-6 gap-y-2.5">
            {casualty.battleRosterNo && (
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-wider text-secondary">Battle Roster</p>
                <p className="text-xs text-primary mt-0.5">{casualty.battleRosterNo}</p>
              </div>
            )}
            {casualty.last4 && (
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-wider text-secondary">Last 4</p>
                <p className="text-xs text-primary mt-0.5">{casualty.last4}</p>
              </div>
            )}
            {casualty.sex && (
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-wider text-secondary">Sex</p>
                <p className="text-xs text-primary mt-0.5">{casualty.sex}</p>
              </div>
            )}
            {casualty.service && (
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-wider text-secondary">Service</p>
                <p className="text-xs text-primary mt-0.5">{casualty.service}</p>
              </div>
            )}
            {casualty.unit && (
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-wider text-secondary">Unit</p>
                <p className="text-xs text-primary mt-0.5">{casualty.unit}</p>
              </div>
            )}
            {casualty.allergies && (
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-wider text-secondary">Allergies</p>
                <p className="text-xs text-primary mt-0.5">{casualty.allergies}</p>
              </div>
            )}
            {casualty.dateTimeOfInjury && (
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-wider text-secondary">DTG Injury</p>
                <p className="text-xs text-primary mt-0.5">{formatDT(casualty.dateTimeOfInjury)}</p>
              </div>
            )}
            {casualty.dateTimeOfTreatment && (
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-wider text-secondary">DTG Treatment</p>
                <p className="text-xs text-primary mt-0.5">{formatDT(casualty.dateTimeOfTreatment)}</p>
              </div>
            )}
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

            {/* Roster + Last 4 */}
            <div className="grid grid-cols-2 gap-2">
              <TextInput
                label="Battle Roster No."
                value={draft.battleRosterNo}
                onChange={(v) => updateDraft({ battleRosterNo: v })}
                placeholder="Roster number"
              />
              <TextInput
                label="Last 4"
                value={draft.last4}
                onChange={(v) => updateDraft({ last4: v.slice(0, 4) })}
                placeholder="0000"
                maxLength={4}
              />
            </div>

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

            {/* Datetime fields */}
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">Injury Date/Time</span>
                <input
                  type="datetime-local"
                  value={draft.dateTimeOfInjury}
                  onChange={(e) => updateDraft({ dateTimeOfInjury: e.target.value })}
                  className="mt-1 w-full px-3 py-2.5 rounded-full text-primary text-sm border border-themeblue3/10 shadow-xs focus:border-themeblue1/30 focus:bg-themewhite2 bg-themewhite dark:bg-themewhite3 focus:outline-none transition-all duration-300"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">Treatment Date/Time</span>
                <input
                  type="datetime-local"
                  value={draft.dateTimeOfTreatment}
                  onChange={(e) => updateDraft({ dateTimeOfTreatment: e.target.value })}
                  className="mt-1 w-full px-3 py-2.5 rounded-full text-primary text-sm border border-themeblue3/10 shadow-xs focus:border-themeblue1/30 focus:bg-themewhite2 bg-themewhite dark:bg-themewhite3 focus:outline-none transition-all duration-300"
                />
              </label>
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
