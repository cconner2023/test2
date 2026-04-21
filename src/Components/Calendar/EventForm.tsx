import { useState, useCallback, useImperativeHandle, forwardRef } from 'react'
import { Package } from 'lucide-react'
import type { EventFormData, EventCategory, EventStatus } from '../../Types/CalendarTypes'
import { createEmptyFormData, EVENT_CATEGORIES } from '../../Types/CalendarTypes'
import { PickerInput, DatePickerInput } from '../FormInputs'
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

/** Generate 30-min military time options: "0000", "0030", … "2330" */
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, '0')
  const m = i % 2 === 0 ? '00' : '30'
  return `${h}${m}`
})

/** "0630" → "06:30" for datetime-local string */
function militaryToHHMM(mil: string): string {
  return `${mil.slice(0, 2)}:${mil.slice(2)}`
}

/** "06:30" → "0630" for display */
function hhmmToMilitary(hhmm: string): string {
  return hhmm.replace(':', '')
}

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

interface EventFormProps {
  initialData?: EventFormData
  onSave: (data: EventFormData) => void
  isEditing?: boolean
  medics?: { id: string; initials: string; name: string; credential?: string; avatarId?: string | null; firstName?: string | null; lastName?: string | null }[]
  propertyItems?: PropertyItemOption[]
  overlayOptions?: OverlayOption[]
}

export const EventForm = forwardRef<EventFormHandle, EventFormProps>(
  function EventForm({ initialData, onSave, isEditing, medics, propertyItems, overlayOptions }, ref) {
    const isMobile = useIsMobile()
    const [form, setForm] = useState<EventFormData>(initialData ?? createEmptyFormData())
    const [errors, setErrors] = useState<Record<string, string>>({})

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
      if (!form.all_day) {
        if (!form.start_time) errs.start_time = 'Start time required.'
        if (!form.end_time) errs.end_time = 'End time required.'
        if (form.start_time && form.end_time && form.start_time >= form.end_time) {
          errs.end_time = 'End time must follow start.'
        }
      }
      setErrors(errs)
      return Object.keys(errs).length === 0
    }, [form])

    const handleSubmit = useCallback(() => {
      if (validate()) onSave(form)
    }, [form, validate, onSave])

    useImperativeHandle(ref, () => ({ submit: handleSubmit }), [handleSubmit])

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

    const inputCx = `w-full rounded-full border border-themeblue3/10 shadow-xs focus:border-themeblue1/30 focus:bg-themewhite2 focus:outline-none bg-themewhite2 text-primary placeholder:text-tertiary transition-all duration-300 ${
      isMobile ? 'py-2.5 px-4 text-sm' : 'py-2 px-3 text-xs'
    }`

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
      <div className="px-4 py-4 space-y-3">
        <div>
          <input
            type="text"
            value={form.title}
            onChange={e => updateField('title', e.target.value)}
            placeholder="Event title *"
            className={inputCx}
          />
          {errors.title && <p className="text-xs text-themeredred mt-1 pl-4">{errors.title}</p>}
        </div>

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
          options={EVENT_CATEGORIES.map(c => c.label)}
          placeholder="Category"
          required
        />

        {isEditing && (
          <div>
            <span className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase mb-1.5 block">Status</span>
            <div className="grid grid-cols-4 gap-1">
              {STATUS_OPTIONS.map(opt => {
                const isActive = form.status === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateField('status', opt.value)}
                    className={`rounded-full py-1.5 text-[9pt] font-semibold tracking-wide transition-all duration-150 active:scale-95 border ${
                      isActive
                        ? `${opt.activeClass} border-transparent`
                        : 'border-themeblue3/10 bg-themewhite2 text-tertiary'
                    }`}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Start date + time */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">Start</span>
            <label
              className="flex items-center gap-2 cursor-pointer"
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
              <span className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">All day</span>
              <div
                className={`relative w-9 h-5 shrink-0 rounded-full transition-colors duration-200 ${
                  form.all_day ? 'bg-themeblue3' : 'bg-tertiary/20'
                }`}
              >
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                  form.all_day ? 'translate-x-4' : 'translate-x-0'
                }`} />
              </div>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <DatePickerInput
              value={startDate}
              onChange={handleStartDateChange}
              placeholder="Start date"
            />
            {!form.all_day ? (
              <PickerInput
                value={startTime ? hhmmToMilitary(startTime) : ''}
                onChange={handleStartTimeChange}
                options={TIME_OPTIONS}
                placeholder="Start time"
                required
              />
            ) : <div />}
          </div>
          {errors.start_time && <p className="text-xs text-themeredred mt-1 pl-4">{errors.start_time}</p>}
        </div>

        {/* End date + time */}
        <div>
          <span className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase mb-1.5 block">End</span>
          <div className="grid grid-cols-2 gap-2">
            <DatePickerInput
              value={endDate}
              onChange={handleEndDateChange}
              placeholder="End date"
              minDate={startDate}
            />
            {!form.all_day ? (
              <PickerInput
                value={endTime ? hhmmToMilitary(endTime) : ''}
                onChange={handleEndTimeChange}
                options={TIME_OPTIONS}
                placeholder="End time"
                required
              />
            ) : <div />}
          </div>
          {errors.end_time && <p className="text-xs text-themeredred mt-1 pl-4">{errors.end_time}</p>}
        </div>

        {form.category !== 'medevac' && (
          <input
            type="text"
            value={form.location}
            onChange={e => updateField('location', e.target.value)}
            placeholder="Location"
            className={inputCx}
          />
        )}

        {overlayOptions && overlayOptions.length > 0 && (
          <div>
            <span className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase mb-1.5 block">Map Overlay</span>
            <select
              value={form.structured_location?.overlay_id ?? ''}
              onChange={e => {
                const id = e.target.value
                if (!id) {
                  updateField('structured_location', null)
                } else {
                  updateField('structured_location', { overlay_id: id })
                  // Auto-suggest mission category when overlay is linked
                  if (form.category === 'other') updateField('category', 'mission')
                }
              }}
              className={`w-full rounded-full border border-themeblue3/10 shadow-xs focus:border-themeblue1/30 focus:bg-themewhite2 focus:outline-none bg-themewhite2 text-primary transition-all duration-300 appearance-none ${
                isMobile ? 'py-2.5 px-4 text-sm' : 'py-2 px-3 text-xs'
              } ${!form.structured_location?.overlay_id ? 'text-tertiary' : ''}`}
            >
              <option value="">No overlay</option>
              {overlayOptions.map(o => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
        )}

        {form.category !== 'medevac' && (
          <textarea
            value={form.description}
            onChange={e => updateField('description', e.target.value)}
            placeholder="Description / OPORD notes"
            rows={3}
            className={`w-full rounded-2xl border border-themeblue3/10 shadow-xs focus:border-themeblue1/30 focus:bg-themewhite2 focus:outline-none bg-themewhite2 text-primary placeholder:text-tertiary transition-all duration-300 resize-none ${
              isMobile ? 'py-2.5 px-4 text-sm' : 'py-2 px-3 text-xs'
            }`}
          />
        )}

        {/* 9-line MEDEVAC — shown when category is medevac */}
        {form.category === 'medevac' && (
          <MedevacForm
            value={form.medevac_data}
            onChange={req => updateField('medevac_data', req)}
          />
        )}

        {medics && medics.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">Personnel</span>
              <span className="text-[9pt] px-1.5 py-0.5 rounded-full bg-tertiary/10 text-tertiary font-medium">
                {form.assigned_to.length}
              </span>
            </div>
            <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
              {medics.map(medic => {
                const isSelected = form.assigned_to.includes(medic.id)
                return (
                  <button
                    key={medic.id}
                    type="button"
                    onClick={() => toggleAssigned(medic.id)}
                    className={`w-full flex items-center text-left transition-all duration-150 active:scale-[0.98] ${
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
                      <p className={`font-medium text-primary truncate ${isMobile ? 'text-sm' : 'text-xs'}`}>{medic.name}</p>
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

        {propertyItems && propertyItems.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">Equipment</span>
              <span className="text-[9pt] px-1.5 py-0.5 rounded-full bg-tertiary/10 text-tertiary font-medium">
                {form.property_item_ids.length}
              </span>
            </div>
            <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
              {propertyItems.map(item => {
                const isSelected = form.property_item_ids.includes(item.id)
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => togglePropertyItem(item.id)}
                    className={`w-full flex items-center text-left transition-all duration-150 active:scale-[0.98] ${
                      isMobile ? 'gap-3 px-4 py-3' : 'gap-2 px-3 py-2'
                    } ${isSelected ? 'bg-themeblue3/8' : ''}`}
                  >
                    <Package size={isMobile ? 16 : 14} className={isSelected ? 'text-themeblue3 shrink-0' : 'text-tertiary shrink-0'} />
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium text-primary truncate ${isMobile ? 'text-sm' : 'text-xs'}`}>{item.name}</p>
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
