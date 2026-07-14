import { memo, useState, useRef, useCallback, useMemo } from 'react'
import { Plus, Check, RotateCcw, User, ChevronRight, MapPin } from 'lucide-react'
import { useTC3Store } from '../../stores/useTC3Store'
import { useMapOverlaysStore } from '../../stores/useMapOverlaysStore'
import { useNavigationStore } from '../../stores/useNavigationStore'
import { OverlaySnapshot } from '../MapOverlay/OverlaySnapshot'
import { TC3EditorSurface } from './TC3EditorSurface'
import { TextInput, DatePickerInput, PickerInput } from '@/Components/primitives/FormInputs'
import { EmptyState } from '@/Components/primitives/EmptyState'
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
  unit: '', sex: 'M' as '' | 'M' | 'F', bloodType: 'A+' as BloodType, service: '', allergies: '',
  dateTimeOfInjury: '', dateTimeOfTreatment: '',
}

// Card presents once ANY user-entered field is set (sex/bloodType are excluded —
// they default to M / A+ and would otherwise force the card to always show). DTG
// auto-populates on open, so accepting a fresh card surfaces it even before a name
// is typed — the medic can fill the blanks later.
function hasData(c: typeof EMPTY_CASUALTY) {
  return !!(
    c.lastName || c.firstName || c.battleRosterNo ||
    c.unit || c.service || c.allergies ||
    c.dateTimeOfInjury || c.dateTimeOfTreatment
  )
}

/** Local `YYYY-MM-DDTHH:MM` for auto-populating DTG fields on a fresh card.
 *  Minutes are snapped to the nearest 30 so the value lands on a valid
 *  MILITARY_TIME_OPTIONS entry (otherwise the time picker renders blank). */
function nowLocalISO() {
  const d = new Date()
  d.setMinutes(d.getMinutes() < 15 ? 0 : d.getMinutes() < 45 ? 30 : 60, 0, 0)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
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
  const expectant = useTC3Store((s) => s.card.expectant)
  const setExpectant = useTC3Store((s) => s.setExpectant)

  // Reverse of the FeatureEditor TC3 link: find the casualty pin (if any) whose
  // opaque tc3_card_id points back at this card, so the medic can see — and tap
  // to — where on the map this casualty is pinned. Opaque-id only; no PHI flows
  // onto the map (the link resolves to a glyph, never patient detail).
  const cardId = useTC3Store((s) => s.card.id)
  const overlays = useMapOverlaysStore((s) => s.overlays)
  const setShowMapOverlayDrawer = useNavigationStore((s) => s.setShowMapOverlayDrawer)
  const pinned = useMemo(() => {
    for (const o of overlays) {
      const feat = o.features.find((f) => f.tc3_card_id === cardId)
      if (feat) return { overlayId: o.id, feature: feat }
    }
    return null
  }, [overlays, cardId])

  const [popoverVisible, setPopoverVisible] = useState(false)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  const [draft, setDraft] = useState({ ...EMPTY_CASUALTY })
  const [draftEvac, setDraftEvac] = useState<EvacPriority>('Urgent')
  const [draftExpectant, setDraftExpectant] = useState(false)

  const openPopover = useCallback((ref: React.RefObject<HTMLElement | null>) => {
    const { battleRosterNo, lastName, firstName, unit, sex, bloodType, service, allergies, dateTimeOfInjury, dateTimeOfTreatment } = casualty
    const now = nowLocalISO()
    setDraft({
      battleRosterNo, lastName, firstName, unit, sex, bloodType, service, allergies,
      dateTimeOfInjury: dateTimeOfInjury || now,
      dateTimeOfTreatment: dateTimeOfTreatment || now,
    })
    setDraftEvac(evacuation.priority)
    setDraftExpectant(expectant)
    setAnchorRect(ref.current?.getBoundingClientRect() ?? null)
    setPopoverVisible(true)
  }, [casualty, evacuation.priority, expectant])

  const handleAccept = useCallback(() => {
    updateCasualty(draft)
    updateEvacuation({ priority: draftEvac })
    setExpectant(draftExpectant)
  }, [draft, draftEvac, draftExpectant, updateCasualty, updateEvacuation, setExpectant])

  const handleReset = useCallback(() => {
    setDraft({ ...EMPTY_CASUALTY })
    setDraftEvac('Urgent')
    setDraftExpectant(false)
    updateCasualty(EMPTY_CASUALTY)
    updateEvacuation({ priority: 'Urgent' })
    setExpectant(false)
  }, [updateCasualty, updateEvacuation, setExpectant])

  const updateDraft = useCallback((fields: Partial<typeof draft>) => {
    setDraft(prev => ({ ...prev, ...fields }))
  }, [])

  const populated = hasData(casualty)

  return (
    <div>
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
            {expectant ? (
              <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-neutral-800">
                <span className="text-[14pt] font-medium text-white">E</span>
              </div>
            ) : evacuation.priority ? (
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

      {/* ── Pinned-on-map snapshot (reverse TC3 link) ── */}
      {pinned && (
        <button
          type="button"
          onClick={() => setShowMapOverlayDrawer(true, pinned.overlayId, pinned.feature.id)}
          className="mt-2 w-full rounded-2xl border border-themeblue3/10 overflow-hidden text-left active:scale-95 transition-all"
        >
          <OverlaySnapshot features={[pinned.feature]} width={320} height={110} fill />
          <div className="flex items-center gap-2 px-4 py-2 bg-themewhite2">
            <MapPin size={15} className="text-themeblue3 shrink-0" />
            <span className="flex-1 min-w-0 text-[10pt] font-medium text-primary truncate">
              {pinned.feature.label || 'Pinned on map'}
            </span>
            <ChevronRight size={16} className="text-tertiary shrink-0" />
          </div>
        </button>
      )}

      {/* ── Edit popover ── */}
      <TC3EditorSurface
        isOpen={popoverVisible}
        onClose={() => setPopoverVisible(false)}
        anchorRect={anchorRect}
        maxWidth={380}
        title="Casualty Info"
        preview={
          <div>
            {/* Triage — EVAC precedence (U/P/R) + Expectant. Expectant is a
                separate disposition (sinks to the foot of the ladder), so it is
                mutually exclusive with an evac priority here. */}
            <div className="px-4 py-3 border-b border-primary/6">
              <span className="text-[9pt] font-semibold text-tertiary uppercase tracking-widest">Triage</span>
              <div className="mt-1.5 flex overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                {EVAC_OPTIONS.map((opt) => {
                  const selected = draftEvac === opt.value && !draftExpectant
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => { setDraftExpectant(false); setDraftEvac(prev => prev === opt.value ? '' : opt.value) }}
                      className={`shrink-0 px-4 py-1.5 transition-colors ${
                        selected ? opt.color : 'active:bg-tertiary/5'
                      }`}
                      title={`EVAC: ${opt.label}`}
                    >
                      <span className={`text-[9pt] transition-colors ${
                        selected ? 'text-white font-medium' : 'text-secondary'
                      }`}>
                        {opt.label}
                      </span>
                    </button>
                  )
                })}
                <button
                  type="button"
                  onClick={() => setDraftExpectant(v => !v)}
                  className={`shrink-0 px-4 py-1.5 transition-colors ${
                    draftExpectant ? 'bg-neutral-800' : 'active:bg-tertiary/5'
                  }`}
                  title="Expectant"
                >
                  <span className={`text-[9pt] transition-colors ${
                    draftExpectant ? 'text-white font-medium' : 'text-secondary'
                  }`}>
                    E
                  </span>
                </button>
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
              <span className="text-[9pt] font-semibold text-tertiary uppercase tracking-widest">Sex</span>
              <div className="mt-1.5 flex overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                {SEX_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateDraft({ sex: draft.sex === opt.value ? '' : opt.value })}
                    className={`shrink-0 px-4 py-1.5 transition-colors ${
                      draft.sex === opt.value ? 'bg-themeblue3' : 'active:bg-tertiary/5'
                    }`}
                    title={`Sex: ${opt.label}`}
                  >
                    <span className={`text-[9pt] transition-colors ${
                      draft.sex === opt.value ? 'text-white font-medium' : 'text-secondary'
                    }`}>
                      {opt.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Blood Type */}
            <div className="px-4 py-3 border-b border-primary/6">
              <span className="text-[9pt] font-semibold text-tertiary uppercase tracking-widest">Blood Type</span>
              <div className="mt-1.5 flex overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                {BLOOD_TYPE_OPTIONS.map((bt) => (
                  <button
                    key={bt}
                    type="button"
                    onClick={() => updateDraft({ bloodType: draft.bloodType === bt ? '' : bt })}
                    className={`shrink-0 px-4 py-1.5 transition-colors ${
                      draft.bloodType === bt ? 'bg-themeblue3' : 'active:bg-tertiary/5'
                    }`}
                    title={`Blood type: ${bt}`}
                  >
                    <span className={`text-[9pt] transition-colors ${
                      draft.bloodType === bt ? 'text-white font-medium' : 'text-secondary'
                    }`}>
                      {bt}
                    </span>
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
        ]}
        saveAction={{ icon: Check, label: 'Accept', onAction: () => { handleAccept(); setPopoverVisible(false); } }}
      />
    </div>
  )
})
