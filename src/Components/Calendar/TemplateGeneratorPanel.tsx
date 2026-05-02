import { useState, useMemo, useEffect, useImperativeHandle, forwardRef } from 'react'
import { Trash2 } from 'lucide-react'
import { PickerInput, DatePickerInput, TimeInput } from '../FormInputs'
import { SectionCard } from '../Section'
import { PreviewOverlay } from '../PreviewOverlay'
import { ActionPill } from '../ActionPill'
import { ActionButton } from '../ActionButton'
import { ConfirmDialog } from '../ConfirmDialog'
import { useAuthStore } from '../../stores/useAuthStore'
import { useClinicMedics } from '../../Hooks/useClinicMedics'
import { useClinicAppointmentTypes } from '../../Hooks/useClinicAppointmentTypes'
import { useCalendarWrite } from '../../Hooks/useCalendarWrite'
import { generateId, PROVIDER_HUDDLE_TASK_ID, toLocalISOString, MILITARY_TIME_OPTIONS } from '../../Types/CalendarTypes'
import type { CalendarEvent } from '../../Types/CalendarTypes'
import { getInitials } from '../../Utilities/nameUtils'

export interface TemplateGeneratorHandle {
  submit: () => void
  canSubmit: boolean
}

interface TemplateGeneratorPanelProps {
  clinicId: string
  userId: string
  onDone: () => void
}

interface SlotPreview {
  start: Date
  end: Date
  label: string
}

function buildSlots(fromDate: string, toDate: string, startHHMM: string, endHHMM: string, durationMin: number): SlotPreview[] {
  if (!fromDate || !toDate || !startHHMM || !endHHMM || !durationMin) return []
  if (startHHMM.length !== 4 || endHHMM.length !== 4) return []

  const sH = parseInt(startHHMM.slice(0, 2), 10)
  const sM = parseInt(startHHMM.slice(2), 10)
  const eH = parseInt(endHHMM.slice(0, 2), 10)
  const eM = parseInt(endHHMM.slice(2), 10)
  if ([sH, sM, eH, eM].some(Number.isNaN)) return []
  if (eH * 60 + eM <= sH * 60 + sM) return []

  const [fy, fm, fd] = fromDate.split('-').map(Number)
  const [ty, tm, td] = toDate.split('-').map(Number)
  if ([fy, fm, fd, ty, tm, td].some(Number.isNaN)) return []

  const cursorDate = new Date(fy, fm - 1, fd)
  const lastDate = new Date(ty, tm - 1, td)
  if (lastDate < cursorDate) return []

  const slots: SlotPreview[] = []
  while (cursorDate <= lastDate) {
    const dayStart = new Date(cursorDate.getFullYear(), cursorDate.getMonth(), cursorDate.getDate(), sH, sM)
    const dayEnd = new Date(cursorDate.getFullYear(), cursorDate.getMonth(), cursorDate.getDate(), eH, eM)
    let cursor = dayStart
    while (cursor.getTime() + durationMin * 60_000 <= dayEnd.getTime()) {
      const slotEnd = new Date(cursor.getTime() + durationMin * 60_000)
      slots.push({
        start: new Date(cursor),
        end: slotEnd,
        label: `${pad(cursor.getMonth() + 1)}/${pad(cursor.getDate())} ${pad(cursor.getHours())}${pad(cursor.getMinutes())}–${pad(slotEnd.getHours())}${pad(slotEnd.getMinutes())}`,
      })
      cursor = slotEnd
    }
    cursorDate.setDate(cursorDate.getDate() + 1)
  }
  return slots
}

function pad(n: number): string { return String(n).padStart(2, '0') }

export const TemplateGeneratorPanel = forwardRef<TemplateGeneratorHandle, TemplateGeneratorPanelProps>(
  function TemplateGeneratorPanel({ clinicId, userId, onDone }, ref) {
    const isSupervisor = useAuthStore(s => s.isSupervisorRole)
    const { medics } = useClinicMedics()
    const apptTypes = useClinicAppointmentTypes()
    const { writeEvent } = useCalendarWrite()

    const [providerId, setProviderId] = useState('')
    const [apptTypeId, setApptTypeId] = useState('')
    const [fromDate, setFromDate] = useState('')
    const [toDate, setToDate] = useState('')
    const [startHHMM, setStartHHMM] = useState('0700')
    const [endHHMM, setEndHHMM] = useState('1100')
    const [submitting, setSubmitting] = useState(false)
    const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
    const [removedKeys, setRemovedKeys] = useState<Set<string>>(() => new Set())
    const [slotPopover, setSlotPopover] = useState<{ slot: SlotPreview; anchor: DOMRect } | null>(null)
    const [confirmRemoveSlot, setConfirmRemoveSlot] = useState<SlotPreview | null>(null)

    const apptType = useMemo(
      () => apptTypes.find(t => t.id === apptTypeId) ?? null,
      [apptTypes, apptTypeId]
    )

    const apptTypeOptions = useMemo(
      () => [...apptTypes]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(t => ({ value: t.id, label: `${t.name} — ${t.duration_min}m` })),
      [apptTypes]
    )

    const providerOptions = useMemo(
      () => medics
        .filter(m => m.roles?.includes('provider') && m.clinicId === clinicId)
        .map(p => ({
          value: p.id,
          label: [p.rank, p.lastName, p.firstName ? p.firstName.charAt(0) + '.' : null]
            .filter(Boolean).join(' ') || getInitials(p.firstName, p.lastName) || 'Provider',
        })),
      [medics, clinicId]
    )

    const slots = useMemo(
      () => buildSlots(fromDate, toDate, startHHMM, endHHMM, apptType?.duration_min ?? 0),
      [fromDate, toDate, startHHMM, endHHMM, apptType]
    )

    // Reset per-slot removals whenever the input window changes — stale removals from a
    // different generation shape don't apply.
    useEffect(() => {
      setRemovedKeys(new Set())
    }, [fromDate, toDate, startHHMM, endHHMM, apptType])

    const activeSlots = useMemo(
      () => slots.filter(s => !removedKeys.has(toLocalISOString(s.start))),
      [slots, removedKeys]
    )

    const canSubmit = isSupervisor && !!providerId && !!apptType && activeSlots.length > 0 && !submitting

    async function handleGenerate() {
      if (!canSubmit || !apptType) return
      setSubmitting(true)
      setProgress({ done: 0, total: activeSlots.length })
      const now = new Date().toISOString()

      for (let i = 0; i < activeSlots.length; i++) {
        const slot = activeSlots[i]
        const ev: CalendarEvent = {
          id: generateId(),
          clinic_id: clinicId,
          title: apptType.name,
          description: null,
          category: 'templated',
          status: 'pending',
          start_time: toLocalISOString(slot.start),
          end_time: toLocalISOString(slot.end),
          all_day: false,
          location: null,
          opord_notes: null,
          uniform: null,
          report_time: null,
          assigned_to: [providerId],
          property_item_ids: [],
          room_id: null,
          huddle_task_id: PROVIDER_HUDDLE_TASK_ID,
          structured_location: null,
          resource_allocations: null,
          created_by: userId,
          created_at: now,
          updated_at: now,
        }
        try { await writeEvent(ev) } catch { /* per-slot failure doesn't abort the run */ }
        setProgress({ done: i + 1, total: activeSlots.length })
      }

      setSubmitting(false)
      onDone()
    }

    function handleRemoveSlot(slot: SlotPreview) {
      setRemovedKeys(prev => {
        const next = new Set(prev)
        next.add(toLocalISOString(slot.start))
        return next
      })
      setConfirmRemoveSlot(null)
      setSlotPopover(null)
    }

    useImperativeHandle(ref, () => ({ submit: handleGenerate, canSubmit }), [canSubmit, handleGenerate])

    if (!isSupervisor) return null

    return (
      <div data-tour="template-form" className="flex flex-col h-full overflow-y-auto px-4 py-4">
        <div className="rounded-2xl overflow-hidden">
          <div data-tour="template-provider">
            <PickerInput
              value={providerId}
              onChange={setProviderId}
              options={providerOptions}
              placeholder="Provider *"
              required
            />
          </div>

          {apptTypeOptions.length === 0 ? (
            <p data-tour="template-appt-type" className="px-4 py-3 text-[10pt] text-tertiary border-b border-primary/6">
              No appointment types defined. Add types in calendar settings before generating templates.
            </p>
          ) : (
            <div data-tour="template-appt-type">
              <PickerInput
                value={apptTypeId}
                onChange={setApptTypeId}
                options={apptTypeOptions}
                placeholder="Appointment type *"
                required
              />
            </div>
          )}

          <div data-tour="template-date-time" className="flex items-stretch border-b border-primary/6">
            <div className="flex-1 min-w-0">
              <DatePickerInput
                value={fromDate}
                onChange={setFromDate}
                placeholder="Start date"
              />
            </div>
            <div className="flex-1 min-w-0 border-l border-primary/6">
              <PickerInput
                value={startHHMM}
                onChange={setStartHHMM}
                options={MILITARY_TIME_OPTIONS}
                placeholder="Start time"
                required
                header={<TimeInput value={startHHMM} onChange={setStartHHMM} label="Start" />}
              />
            </div>
          </div>

          <div className="flex items-stretch border-b border-primary/6">
            <div className="flex-1 min-w-0">
              <DatePickerInput
                value={toDate}
                onChange={setToDate}
                placeholder="End date"
                minDate={fromDate}
              />
            </div>
            <div className="flex-1 min-w-0 border-l border-primary/6">
              <PickerInput
                value={endHHMM}
                onChange={setEndHHMM}
                options={MILITARY_TIME_OPTIONS}
                placeholder="End time"
                required
                header={<TimeInput value={endHHMM} onChange={setEndHHMM} label="End" />}
              />
            </div>
          </div>
        </div>

        {slots.length > 0 && (
          <div data-tour="template-slot-preview" className="mt-4">
            <div className="px-1 pb-2 flex items-center gap-2">
              <p className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">Preview</p>
              <span className="text-[9pt] px-1.5 py-0.5 rounded-full bg-tertiary/10 text-tertiary font-medium">
                {activeSlots.length}{removedKeys.size > 0 ? ` / ${slots.length}` : ''}
              </span>
              {submitting && progress && (
                <span className="text-[9pt] text-tertiary tabular-nums ml-auto">
                  {progress.done} / {progress.total}
                </span>
              )}
            </div>
            <SectionCard>
              <div className="max-h-60 overflow-y-auto">
                {activeSlots.length === 0 ? (
                  <p className="px-4 py-3 text-[10pt] text-tertiary">All slots removed.</p>
                ) : (
                  activeSlots.map(s => {
                    const key = toLocalISOString(s.start)
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={(e) => setSlotPopover({ slot: s, anchor: e.currentTarget.getBoundingClientRect() })}
                        className="w-full flex items-center gap-3 py-2 px-4 text-left border-b border-primary/6 last:border-b-0 hover:bg-secondary/5 active:scale-[0.99] transition-all"
                      >
                        <span className="text-[10pt] font-mono text-secondary tabular-nums">{s.label}</span>
                      </button>
                    )
                  })
                )}
              </div>
            </SectionCard>
          </div>
        )}

        <PreviewOverlay
          isOpen={!!slotPopover}
          onClose={() => setSlotPopover(null)}
          anchorRect={slotPopover?.anchor ?? null}
          title={slotPopover ? slotPopover.slot.label : undefined}
          maxWidth={300}
          footer={
            slotPopover ? (
              <ActionPill>
                <ActionButton
                  icon={Trash2}
                  label="Remove slot"
                  variant="danger"
                  onClick={() => {
                    const slot = slotPopover.slot
                    setSlotPopover(null)
                    setTimeout(() => setConfirmRemoveSlot(slot), 320)
                  }}
                />
              </ActionPill>
            ) : undefined
          }
        >
          {slotPopover && (
            <div className="px-4 py-3 text-[10pt] text-secondary space-y-1">
              <p>
                <span className="text-tertiary">Provider · </span>
                {providerOptions.find(p => p.value === providerId)?.label ?? '—'}
              </p>
              <p>
                <span className="text-tertiary">Type · </span>
                {apptType ? `${apptType.name} (${apptType.duration_min}m)` : '—'}
              </p>
            </div>
          )}
        </PreviewOverlay>

        <ConfirmDialog
          visible={!!confirmRemoveSlot}
          title="Remove this slot?"
          subtitle={confirmRemoveSlot ? `${confirmRemoveSlot.label} will not be generated.` : ''}
          confirmLabel="Remove"
          cancelLabel="Keep"
          variant="danger"
          onConfirm={() => confirmRemoveSlot && handleRemoveSlot(confirmRemoveSlot)}
          onCancel={() => setConfirmRemoveSlot(null)}
        />
      </div>
    )
  }
)
