import { useState, useCallback, useImperativeHandle, forwardRef } from 'react'
import { Package } from 'lucide-react'
import type { EventFormData, EventCategory } from '../../Types/CalendarTypes'
import { createEmptyFormData, EVENT_CATEGORIES } from '../../Types/CalendarTypes'
import { PickerInput, DatePickerInput } from '../FormInputs'
import { UserAvatar } from '../Settings/UserAvatar'

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

interface EventFormProps {
  initialData?: EventFormData
  onSave: (data: EventFormData) => void
  isEditing?: boolean
  medics?: { id: string; initials: string; name: string; credential?: string; avatarId?: string | null; firstName?: string | null; lastName?: string | null }[]
  propertyItems?: PropertyItemOption[]
}

export const EventForm = forwardRef<EventFormHandle, EventFormProps>(
  function EventForm({ initialData, onSave, isEditing, medics, propertyItems }, ref) {
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
      if (!form.title.trim()) errs.title = 'Title is required'
      if (!form.all_day) {
        if (!form.start_time) errs.start_time = 'Start time is required'
        if (!form.end_time) errs.end_time = 'End time is required'
        if (form.start_time && form.end_time && form.start_time >= form.end_time) {
          errs.end_time = 'End must be after start'
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

    const inputCx = 'w-full rounded-full py-2.5 px-4 border border-themeblue3/10 shadow-xs focus:border-themeblue1/30 focus:bg-themewhite2 focus:outline-none text-sm bg-themewhite2 text-primary placeholder:text-tertiary/30 transition-all duration-300'

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
            if (cat) updateField('category', cat.value as EventCategory)
          }}
          options={EVENT_CATEGORIES.map(c => c.label)}
          placeholder="Category"
          required
        />

        <div className="flex items-center justify-between px-4 py-2.5 rounded-full border border-themeblue3/10 shadow-xs bg-themewhite2">
          <span className="text-sm text-tertiary/50">All day</span>
          <button
            type="button"
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
            className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
              form.all_day ? 'bg-themeblue3' : 'bg-tertiary/30'
            }`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
              form.all_day ? 'translate-x-5' : ''
            }`} />
          </button>
        </div>

        {/* Start date + time */}
        <div>
          <div className={`grid gap-2 ${form.all_day ? '' : 'grid-cols-2'}`}>
            <DatePickerInput
              value={startDate}
              onChange={handleStartDateChange}
              placeholder="Start date"
            />
            {!form.all_day && (
              <PickerInput
                value={startTime ? hhmmToMilitary(startTime) : ''}
                onChange={handleStartTimeChange}
                options={TIME_OPTIONS}
                placeholder="Start time"
                required
              />
            )}
          </div>
          {errors.start_time && <p className="text-xs text-themeredred mt-1 pl-4">{errors.start_time}</p>}
        </div>

        {/* End date + time */}
        <div>
          <div className={`grid gap-2 ${form.all_day ? '' : 'grid-cols-2'}`}>
            <DatePickerInput
              value={endDate}
              onChange={handleEndDateChange}
              placeholder="End date"
              minDate={startDate}
            />
            {!form.all_day && (
              <PickerInput
                value={endTime ? hhmmToMilitary(endTime) : ''}
                onChange={handleEndTimeChange}
                options={TIME_OPTIONS}
                placeholder="End time"
                required
              />
            )}
          </div>
          {errors.end_time && <p className="text-xs text-themeredred mt-1 pl-4">{errors.end_time}</p>}
        </div>

        <input
          type="text"
          value={form.location}
          onChange={e => updateField('location', e.target.value)}
          placeholder="Location"
          className={inputCx}
        />

        <textarea
          value={form.description}
          onChange={e => updateField('description', e.target.value)}
          placeholder="Description / OPORD notes"
          rows={3}
          className="w-full rounded-2xl py-2.5 px-4 border border-themeblue3/10 shadow-xs focus:border-themeblue1/30 focus:bg-themewhite2 focus:outline-none text-sm bg-themewhite2 text-primary placeholder:text-tertiary/30 transition-all duration-300 resize-none"
        />

        {medics && medics.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">Personnel</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-tertiary/10 text-tertiary/50 font-medium">
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
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-150 active:scale-[0.98] ${
                      isSelected ? 'bg-themeblue3/8' : ''
                    }`}
                  >
                    <UserAvatar
                      avatarId={medic.avatarId}
                      firstName={medic.firstName}
                      lastName={medic.lastName}
                      className="w-10 h-10"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-primary truncate">{medic.name}</p>
                      {medic.credential && (
                        <p className="text-[10px] text-tertiary/50 truncate">{medic.credential}</p>
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
              <span className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">Equipment</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-tertiary/10 text-tertiary/50 font-medium">
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
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-150 active:scale-[0.98] ${
                      isSelected ? 'bg-themeblue3/8' : ''
                    }`}
                  >
                    <Package size={16} className={isSelected ? 'text-themeblue3 shrink-0' : 'text-tertiary shrink-0'} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-primary truncate">{item.name}</p>
                      {item.nsn && <p className="text-[10px] text-tertiary truncate">{item.nsn}</p>}
                    </div>
                    {item.serial_number && (
                      <span className="text-[10px] text-tertiary shrink-0">S/N {item.serial_number}</span>
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
