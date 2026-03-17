import { useState, useCallback, useImperativeHandle, forwardRef } from 'react'
import type { EventFormData } from '../../Types/CalendarTypes'
import { createEmptyFormData } from '../../Types/CalendarTypes'
import { TextInput } from '../FormInputs'

export interface EventFormHandle {
  submit: () => void
}

interface EventFormProps {
  initialData?: EventFormData
  onSave: (data: EventFormData) => void
  isEditing?: boolean
}

export const EventForm = forwardRef<EventFormHandle, EventFormProps>(
  function EventForm({ initialData, onSave, isEditing }, ref) {
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

    return (
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
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

        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">All day</span>
          <button
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

        <TextInput
          label="Location"
          value={form.location}
          onChange={v => updateField('location', v)}
          placeholder="Building, room, grid coordinate"
        />

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
      </div>
    )
  }
)
