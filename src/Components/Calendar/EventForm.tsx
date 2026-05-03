import { useState, useCallback, useImperativeHandle, forwardRef, useEffect } from 'react'
import { Package } from 'lucide-react'
import type { EventFormData, EventCategory, EventStatus } from '../../Types/CalendarTypes'
import { createEmptyFormData, EVENT_CATEGORIES, MILITARY_TIME_OPTIONS, militaryToHHMM, hhmmToMilitary } from '../../Types/CalendarTypes'
import { TextInput, PickerInput, DatePickerInput, TimeInput } from '../FormInputs'
import { UserAvatar } from '../Settings/UserAvatar'
import { useIsMobile } from '../../Hooks/useIsMobile'
import { MedevacForm } from '../Medevac/MedevacForm'
import { emptyMedevacRequest } from '../../Types/MedevacTypes'


const STATUS_OPTIONS: { value: EventStatus; label: string; activeClass: string }[] = [
  { value: 'pending',     label: 'Pending',   activeClass: 'bg-tertiary/15 text-primary' },
  { value: 'in_progress', label: 'Active',    activeClass: 'bg-themeblue1/15 text-themeblue1' },
  { value: 'completed',   label: 'Done',      activeClass: 'bg-themegreen/15 text-themegreen' },
  { value: 'cancelled',   label: 'Cancelled', activeClass: 'bg-themeredred/15 text-themeredred' },
]

export interface EventFormHandle {
  submit: () => void
}

export interface PropertyItemOption {
  id: string
  name: string
  nsn: string | null
  serial_number: string | null
}

export interface OverlayOption {
  id: string
  name: string
}

export interface RoomOption {
  id: string
  name: string
}

export interface HuddleTaskOption {
  id: string
  name: string
}

interface EventFormProps {
  initialData?: EventFormData
  onSave: (data: EventFormData) => void
  isEditing?: boolean
  medics?: { id: string; initials: string; name: string; credential?: string; avatarId?: string | null; firstName?: string | null; lastName?: string | null }[]
  propertyItems?: PropertyItemOption[]
  overlayOptions?: OverlayOption[]
  /** Active clinic rooms — passed from CalendarPanel. Empty = no room picker shown. */
  roomOptions?: RoomOption[]
  /** Supervisor-defined huddle tasks (e.g. "Front Desk"). Picker shown only when category === 'huddle'. */
  huddleTaskOptions?: HuddleTaskOption[]
}

export const EventForm = forwardRef<EventFormHandle, EventFormProps>(
  function EventForm({ initialData, onSave, isEditing, medics, propertyItems, overlayOptions, roomOptions, huddleTaskOptions }, ref) {
    const isMobile = useIsMobile()
    const [form, setForm] = useState<EventFormData>(initialData ?? createEmptyFormData())
    const [errors, setErrors] = useState<Record<string, string>>({})

    const isTask = form.category === 'task'

    const updateField = useCallback(<K extends keyof EventFormData>(key: K, value: EventFormData[K]) => {
      setForm(prev => ({ ...prev, [key]: value }))
      setErrors(prev => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }, [])

    const validate = useCallback((): boolean => {
      const errs: Record<string, string> = {}
      if (!form.title.trim()) errs.title = 'Title required.'
      if (isTask) {
        // Tasks need only a start date — end mirrors start at submit.
        if (!form.start_time) errs.start_time = 'Date required.'
      } else if (!form.all_day) {
        if (!form.start_time) errs.start_time = 'Start time required.'
        if (!form.end_time) errs.end_time = 'End time required.'
        if (form.start_time && form.end_time && form.start_time >= form.end_time) {
          errs.end_time = 'End time must follow start.'
        }
      }
      setErrors(errs)
      return Object.keys(errs).length === 0
    }, [form, isTask])

    const handleSubmit = useCallback(() => {
      if (!validate()) return
      // Tasks are inherently all-day events on their assigned day — anchor to T00:00–T23:59
      // so they ride the existing all-day band in DayView / TripleDayView.
      const payload: EventFormData = isTask
        ? (() => {
            const dateKey = (form.start_time.slice(0, 10)) || new Date().toISOString().slice(0, 10)
            return { ...form, all_day: true, start_time: `${dateKey}T00:00`, end_time: `${dateKey}T23:59` }
          })()
        : form
      onSave(payload)
    }, [form, validate, onSave, isTask])

    useImperativeHandle(ref, () => ({ submit: handleSubmit }), [handleSubmit])

    // Tour-driven category override (lets the guided tour reveal huddle pickers)
    useEffect(() => {
      const onSetCategory = (e: Event) => {
        const detail = (e as CustomEvent<EventCategory>).detail
        if (!detail) return
        setForm(prev => ({ ...prev, category: detail }))
      }
      window.addEventListener('tour:calendar-select-category', onSetCategory)
      return () => window.removeEventListener('tour:calendar-select-category', onSetCategory)
    }, [])

    const toggleAssigned = useCallback((userId: string) => {
      setForm(prev => ({
        ...prev,
        assigned_to: prev.assigned_to.includes(userId)
          ? prev.assigned_to.filter(id => id !== userId)
          : [...prev.assigned_to, userId]
      }))
    }, [])

    const togglePropertyItem = useCallback((itemId: string) => {
      setForm(prev => ({
        ...prev,
        property_item_ids: prev.property_item_ids.includes(itemId)
          ? prev.property_item_ids.filter(id => id !== itemId)
          : [...prev.property_item_ids, itemId]
      }))
    }, [])

    const categoryLabel = EVENT_CATEGORIES.find(c => c.value === form.category)?.label ?? ''

    // Derive date/time parts from stored datetime strings ("2026-03-22T14:30")
    const startDate = form.start_time.slice(0, 10)
    const startTime = form.start_time.slice(11, 16) // "14:30"
    const endDate = form.end_time.slice(0, 10)
    const endTime = form.end_time.slice(11, 16)

    const handleStartDateChange = useCallback((dateStr: string) => {
      const time = form.start_time.slice(11) || '08:00'
      updateField('start_time', `${dateStr}T${time}`)
      // If end date is before new start date, sync it
      const currentEnd = form.end_time.slice(0, 10)
      if (!currentEnd || currentEnd < dateStr) {
        const endTime = form.end_time.slice(11) || '09:00'
        updateField('end_time', `${dateStr}T${endTime}`)
      }
    }, [form.start_time, form.end_time, updateField])

    const handleEndDateChange = useCallback((dateStr: string) => {
      const time = form.end_time.slice(11) || '09:00'
      updateField('end_time', `${dateStr}T${time}`)
    }, [form.end_time, updateField])

    const handleStartTimeChange = useCallback((mil: string) => {
      const date = form.start_time.slice(0, 10) || new Date().toISOString().slice(0, 10)
      updateField('start_time', `${date}T${militaryToHHMM(mil)}`)
    }, [form.start_time, updateField])

    const handleEndTimeChange = useCallback((mil: string) => {
      const date = form.end_time.slice(0, 10) || new Date().toISOString().slice(0, 10)
      updateField('end_time', `${date}T${militaryToHHMM(mil)}`)
    }, [form.end_time, updateField])

    return (
      <div className="px-4 py-4">
        <div className="rounded-2xl overflow-hidden">
          <div data-tour="event-form-title">
            <TextInput
              value={form.title}
              onChange={v => updateField('title', v)}
              placeholder={isTask ? 'Task title *' : 'Event title *'}
              required
              hint={errors.title}
            />
          </div>

          {form.category !== 'templated' && !isTask && (
            <div data-tour="event-form-category">
              <PickerInput
                value={categoryLabel}
                onChange={v => {
                  const cat = EVENT_CATEGORIES.find(c => c.label === v)
                  if (!cat) return
                  updateField('category', cat.value as EventCategory)
                  if (cat.value === 'medevac' && !form.medevac_data) {
                    updateField('medevac_data', emptyMedevacRequest())
                  }
                }}
                options={EVENT_CATEGORIES.filter(c => !c.hidden).map(c => c.label)}
                placeholder="Category *"
                required
              />
            </div>
          )}

          {isEditing && (
            <div className="px-4 py-3 border-b border-primary/6">
              <div className="grid grid-cols-4 gap-1">
                {STATUS_OPTIONS.map(opt => {
                  const isActive = form.status === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => updateField('status', opt.value)}
                      className={`rounded-full py-1.5 text-[9pt] font-semibold tracking-wide transition-all duration-150 active:scale-95 border ${isActive
                          ? `${opt.activeClass} border-transparent`
                          : 'border-themeblue3/10 bg-themewhite text-tertiary'
                        }`}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* All-day toggle row — hidden for tasks (zero-duration, single-day) */}
          {!isTask && (
          <label
            className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer border-b border-primary/6"
            onClick={() => {
              const next = !form.all_day
              updateField('all_day', next)
              if (next) {
                const dateStr = form.start_time.slice(0, 10)
                if (dateStr) {
                  updateField('start_time', dateStr + 'T00:00')
                  updateField('end_time', dateStr + 'T23:59')
                }
              }
            }}
          >
            <span className="text-base md:text-sm text-primary">All day</span>
            <div
              className={`relative w-9 h-5 shrink-0 rounded-full transition-colors duration-200 ${form.all_day ? 'bg-themeblue3' : 'bg-tertiary/20'
                }`}
            >
              <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${form.all_day ? 'translate-x-4' : 'translate-x-0'
                }`} />
            </div>
          </label>
          )}

          {/* Start date + time — fully hidden for tasks (implied day of creation) */}
          {!isTask && (
          <div data-tour="event-form-datetime">
            <div className="flex items-stretch border-b border-primary/6">
              <div className="flex-1 min-w-0">
                <DatePickerInput
                  value={startDate}
                  onChange={handleStartDateChange}
                  placeholder="Start date"
                />
              </div>
              {!form.all_day && !isTask && (
                <div className="flex-1 min-w-0 border-l border-primary/6">
                  <PickerInput
                    value={startTime ? hhmmToMilitary(startTime) : ''}
                    onChange={handleStartTimeChange}
                    options={MILITARY_TIME_OPTIONS}
                    placeholder="Start time"
                    required
                    header={
                      <TimeInput
                        value={startTime ? hhmmToMilitary(startTime) : ''}
                        onChange={handleStartTimeChange}
                        label="Start"
                      />
                    }
                  />
                </div>
              )}
            </div>
            {errors.start_time && <p className="px-4 py-2 text-[10pt] text-themeredred border-b border-primary/6">{errors.start_time}</p>}
          </div>
          )}

          {/* End date + time — hidden for tasks (mirrors start at submit) */}
          {!isTask && (
          <>
          <div className="flex items-stretch border-b border-primary/6">
            <div className="flex-1 min-w-0">
              <DatePickerInput
                value={endDate}
                onChange={handleEndDateChange}
                placeholder="End date"
                minDate={startDate}
              />
            </div>
            {!form.all_day && (
              <div className="flex-1 min-w-0 border-l border-primary/6">
                <PickerInput
                  value={endTime ? hhmmToMilitary(endTime) : ''}
                  onChange={handleEndTimeChange}
                  options={MILITARY_TIME_OPTIONS}
                  placeholder="End time"
                  required
                  header={
                    <TimeInput
                      value={endTime ? hhmmToMilitary(endTime) : ''}
                      onChange={handleEndTimeChange}
                      label="End"
                    />
                  }
                />
              </div>
            )}
          </div>
          {errors.end_time && <p className="px-4 py-2 text-[10pt] text-themeredred border-b border-primary/6">{errors.end_time}</p>}
          </>
          )}

          {form.category !== 'medevac' && !isTask && (
            <TextInput
              value={form.location}
              onChange={v => updateField('location', v)}
              placeholder="Location"
            />
          )}

          {form.category !== 'medevac' && !isTask && roomOptions && roomOptions.length > 0 && (
            <div data-tour="event-form-room">
              <PickerInput
                value={form.room_id ?? ''}
                onChange={v => updateField('room_id', v || null)}
                options={[{ value: '', label: 'No room' }, ...roomOptions.map(r => ({ value: r.id, label: r.name }))]}
                placeholder="Clinic room"
              />
            </div>
          )}

          {form.category === 'huddle' && huddleTaskOptions && huddleTaskOptions.length > 0 && (
            <div data-tour="event-form-huddle-task">
              <PickerInput
                value={form.huddle_task_id ?? ''}
                onChange={v => updateField('huddle_task_id', v || null)}
                options={[{ value: '', label: 'Provider pairing (no task)' }, ...huddleTaskOptions.map(t => ({ value: t.id, label: t.name }))]}
                placeholder="Huddle task"
              />
              <p className="px-4 py-2 text-[9pt] text-tertiary border-b border-primary/6">
                Leave blank for an on-shift provider block. Pick a task to assign someone to a station like Front Desk.
              </p>
            </div>
          )}

          {!isTask && overlayOptions && overlayOptions.length > 0 && (
            <PickerInput
              value={form.structured_location?.overlay_id ?? ''}
              onChange={v => {
                if (!v) {
                  updateField('structured_location', null)
                } else {
                  updateField('structured_location', { overlay_id: v })
                  if (form.category === 'other') updateField('category', 'mission')
                }
              }}
              options={[{ value: '', label: 'No overlay' }, ...overlayOptions.map(o => ({ value: o.id, label: o.name }))]}
              placeholder="Map overlay"
            />
          )}

          {form.category !== 'medevac' && (
            <label className="block">
              <textarea
                value={form.description}
                onChange={e => updateField('description', e.target.value)}
                placeholder="Description / OPORD notes"
                rows={3}
                className="w-full bg-transparent px-4 py-3 text-base md:text-sm text-primary placeholder:text-tertiary focus:outline-none resize-none"
              />
            </label>
          )}
        </div>

        {/* 9-line MEDEVAC — shown when category is medevac */}
        {form.category === 'medevac' && (
          <div className="mt-3">
            <MedevacForm
              value={form.medevac_data}
              onChange={req => updateField('medevac_data', req)}
            />
          </div>
        )}

        {medics && medics.length > 0 && (
          <div className="mt-3">
            <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider mb-2">
              Personnel ({form.assigned_to.length})
            </p>
            <div className="rounded-2xl bg-themewhite2 overflow-hidden">
              {medics.map(medic => {
                const isSelected = form.assigned_to.includes(medic.id)
                return (
                  <button
                    key={medic.id}
                    type="button"
                    onClick={() => toggleAssigned(medic.id)}
                    className={`w-full flex items-center text-left transition-all duration-150 active:scale-[0.98] border-b border-primary/6 last:border-b-0 ${
                      isMobile ? 'gap-3 px-4 py-3' : 'gap-2 px-3 py-2'
                    } ${isSelected ? 'bg-themeblue3/8' : ''}`}
                  >
                    <UserAvatar
                      avatarId={medic.avatarId}
                      firstName={medic.firstName}
                      lastName={medic.lastName}
                      className={isMobile ? 'w-10 h-10' : 'w-7 h-7'}
                    />
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium text-primary truncate ${isMobile ? 'text-sm' : 'text-[10pt]'}`}>{medic.name}</p>
                      {medic.credential && (
                        <p className="text-[9pt] text-tertiary truncate">{medic.credential}</p>
                      )}
                    </div>
                    {isSelected && (
                      <div className="w-2 h-2 rounded-full bg-themeblue3 shrink-0" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {!isTask && propertyItems && propertyItems.length > 0 && (
          <div className="mt-3">
            <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider mb-2">
              Equipment ({form.property_item_ids.length})
            </p>
            <div className="rounded-2xl bg-themewhite2 overflow-hidden">
              {propertyItems.map(item => {
                const isSelected = form.property_item_ids.includes(item.id)
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => togglePropertyItem(item.id)}
                    className={`w-full flex items-center text-left transition-all duration-150 active:scale-[0.98] border-b border-primary/6 last:border-b-0 ${
                      isMobile ? 'gap-3 px-4 py-3' : 'gap-2 px-3 py-2'
                    } ${isSelected ? 'bg-themeblue3/8' : ''}`}
                  >
                    <Package size={isMobile ? 16 : 14} className={isSelected ? 'text-themeblue2 shrink-0' : 'text-tertiary shrink-0'} />
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium text-primary truncate ${isMobile ? 'text-sm' : 'text-[10pt]'}`}>{item.name}</p>
                      {item.nsn && <p className="text-[9pt] text-tertiary truncate">{item.nsn}</p>}
                    </div>
                    {item.serial_number && (
                      <span className="text-[9pt] text-tertiary shrink-0">S/N {item.serial_number}</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Bottom scroll padding */}
        <div className="h-24 shrink-0" />
      </div>
    )
  }
)
