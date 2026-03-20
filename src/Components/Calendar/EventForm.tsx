import { useState, useCallback, useImperativeHandle, forwardRef } from 'react'
import { Package } from 'lucide-react'
import type { EventFormData, EventCategory } from '../../Types/CalendarTypes'
import { createEmptyFormData, EVENT_CATEGORIES } from '../../Types/CalendarTypes'
import { TextInput, SelectInput } from '../FormInputs'

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
  medics?: { id: string; initials: string; name: string }[]
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

    return (
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div>
          <TextInput
            label="Title"
            value={form.title}
            onChange={v => updateField('title', v)}
            placeholder="Event title"
            required
          />
          {errors.title && <p className="text-xs text-themeredred mt-1">{errors.title}</p>}
        </div>

        <SelectInput
          label="Category"
          value={form.category}
          onChange={v => updateField('category', v as EventCategory)}
          options={EVENT_CATEGORIES.map(c => ({ value: c.value, label: c.label }))}
          required
        />

        <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-themewhite2 border border-tertiary/10">
          <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">All day</span>
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

        <div className="grid grid-cols-2 gap-3">
          <div>
            <TextInput
              label="Start"
              type="datetime-local"
              value={form.start_time}
              onChange={v => updateField('start_time', v)}
              required={!form.all_day}
            />
            {errors.start_time && <p className="text-xs text-themeredred mt-1">{errors.start_time}</p>}
          </div>
          <div>
            <TextInput
              label="End"
              type="datetime-local"
              value={form.end_time}
              onChange={v => updateField('end_time', v)}
              required={!form.all_day}
            />
            {errors.end_time && <p className="text-xs text-themeredred mt-1">{errors.end_time}</p>}
          </div>
        </div>

        <TextInput
          label="Location"
          value={form.location}
          onChange={v => updateField('location', v)}
          placeholder="Building, room, grid coordinate"
        />

        <div className="grid grid-cols-2 gap-3">
          <TextInput
            label="Uniform"
            value={form.uniform}
            onChange={v => updateField('uniform', v)}
            placeholder="OCP, PT, etc."
          />
          <TextInput
            label="Report Time"
            value={form.report_time}
            onChange={v => updateField('report_time', v)}
            placeholder="e.g. 0545"
          />
        </div>

        <label className="block">
          <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">
            Description / OPORD Notes
          </span>
          <textarea
            value={form.description}
            onChange={e => updateField('description', e.target.value)}
            placeholder="Additional details, instructions, notes..."
            rows={3}
            className="mt-1 w-full px-3 py-2.5 rounded-lg text-primary text-base
                       border border-tertiary/10 focus-within:border-themeblue1/30 focus-within:bg-themewhite2 bg-themewhite dark:bg-themewhite3 focus:outline-none
                       transition-all placeholder:text-tertiary/30 resize-none"
          />
        </label>

        {medics && medics.length > 0 && (
          <div>
            <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">Assigned To</span>
            <div className="mt-1.5 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {medics.map(medic => {
                const isSelected = form.assigned_to.includes(medic.id)
                return (
                  <button
                    key={medic.id}
                    type="button"
                    onClick={() => toggleAssigned(medic.id)}
                    className={`flex items-center gap-1.5 rounded-full border px-1 py-1 pr-2.5 transition-all duration-150 active:scale-95 shrink-0 ${
                      isSelected ? 'bg-themeblue3/10 border-themeblue3/40' : 'border-tertiary/15'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold ${
                      isSelected ? 'bg-themeblue3 text-white' : 'bg-primary/8 text-secondary'
                    }`}>
                      {medic.initials}
                    </div>
                    <span className="text-xs text-primary">{medic.name}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {propertyItems && propertyItems.length > 0 && (
          <div>
            <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">Equipment</span>
            <div className="mt-1.5 flex flex-col gap-1.5">
              {propertyItems.map(item => {
                const isSelected = form.property_item_ids.includes(item.id)
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => togglePropertyItem(item.id)}
                    className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 transition-all duration-150 active:scale-95 text-left ${
                      isSelected ? 'bg-themeblue3/10 border-themeblue3/40' : 'border-tertiary/15'
                    }`}
                  >
                    <Package size={16} className={isSelected ? 'text-themeblue3 shrink-0' : 'text-tertiary shrink-0'} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-primary truncate">{item.name}</p>
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
      </div>
    )
  }
)
