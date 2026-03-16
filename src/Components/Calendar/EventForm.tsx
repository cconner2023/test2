import { useState, useCallback } from 'react'
import { X } from 'lucide-react'
import type { EventFormData, EventCategory } from '../../Types/CalendarTypes'
import { EVENT_CATEGORIES, createEmptyFormData } from '../../Types/CalendarTypes'

interface EventFormProps {
  initialData?: EventFormData
  onSave: (data: EventFormData) => void
  onCancel: () => void
  isEditing?: boolean
}

export function EventForm({ initialData, onSave, onCancel, isEditing }: EventFormProps) {
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

  const inputClass = "w-full rounded-lg border border-primary/15 bg-themewhite px-3 py-2.5 text-sm text-primary placeholder:text-tertiary/40 focus:border-themeblue2 focus:outline-none transition-colors"
  const labelClass = "block text-xs font-medium text-tertiary mb-1"

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-primary/10">
        <h2 className="text-base font-semibold text-primary">
          {isEditing ? 'Edit Event' : 'New Event'}
        </h2>
        <button
          onClick={onCancel}
          className="w-8 h-8 rounded-full flex items-center justify-center text-tertiary hover:bg-primary/5 active:scale-95 transition-all duration-200"
        >
          <X size={18} />
        </button>
      </div>

      {/* Form body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Title */}
        <div>
          <label className={labelClass}>Title</label>
          <input
            type="text"
            value={form.title}
            onChange={e => updateField('title', e.target.value)}
            placeholder="Event title"
            className={`${inputClass} ${errors.title ? 'border-themeredred' : ''}`}
            autoFocus
          />
          {errors.title && <p className="text-xs text-themeredred mt-1">{errors.title}</p>}
        </div>

        {/* Category */}
        <div>
          <label className={labelClass}>Category</label>
          <div className="flex flex-wrap gap-2">
            {EVENT_CATEGORIES.map(cat => (
              <button
                key={cat.value}
                onClick={() => updateField('category', cat.value as EventCategory)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 active:scale-95 ${
                  form.category === cat.value
                    ? 'bg-themeblue3 text-white'
                    : 'bg-primary/5 text-secondary hover:bg-primary/10'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* All day toggle */}
        <div className="flex items-center justify-between">
          <label className="text-sm text-primary">All day</label>
          <button
            onClick={() => updateField('all_day', !form.all_day)}
            className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
              form.all_day ? 'bg-themeblue3' : 'bg-tertiary/30'
            }`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
              form.all_day ? 'translate-x-5' : ''
            }`} />
          </button>
        </div>

        {/* Date/Time */}
        {!form.all_day ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Start</label>
              <input
                type="datetime-local"
                value={form.start_time}
                onChange={e => updateField('start_time', e.target.value)}
                className={`${inputClass} ${errors.start_time ? 'border-themeredred' : ''}`}
              />
              {errors.start_time && <p className="text-xs text-themeredred mt-1">{errors.start_time}</p>}
            </div>
            <div>
              <label className={labelClass}>End</label>
              <input
                type="datetime-local"
                value={form.end_time}
                onChange={e => updateField('end_time', e.target.value)}
                className={`${inputClass} ${errors.end_time ? 'border-themeredred' : ''}`}
              />
              {errors.end_time && <p className="text-xs text-themeredred mt-1">{errors.end_time}</p>}
            </div>
          </div>
        ) : (
          <div>
            <label className={labelClass}>Date</label>
            <input
              type="date"
              value={form.start_time.slice(0, 10)}
              onChange={e => {
                updateField('start_time', e.target.value + 'T00:00')
                updateField('end_time', e.target.value + 'T23:59')
              }}
              className={inputClass}
            />
          </div>
        )}

        {/* Location */}
        <div>
          <label className={labelClass}>Location</label>
          <input
            type="text"
            value={form.location}
            onChange={e => updateField('location', e.target.value)}
            placeholder="Building, room, grid coordinate"
            className={inputClass}
          />
        </div>

        {/* Uniform */}
        <div>
          <label className={labelClass}>Uniform</label>
          <input
            type="text"
            value={form.uniform}
            onChange={e => updateField('uniform', e.target.value)}
            placeholder="e.g. ACUs, PT Gear"
            className={inputClass}
          />
        </div>

        {/* Report time */}
        <div>
          <label className={labelClass}>Report time</label>
          <input
            type="text"
            value={form.report_time}
            onChange={e => updateField('report_time', e.target.value)}
            placeholder="e.g. NLT 0630"
            className={inputClass}
          />
        </div>

        {/* Description */}
        <div>
          <label className={labelClass}>Description / OPORD Notes</label>
          <textarea
            value={form.description}
            onChange={e => updateField('description', e.target.value)}
            placeholder="Additional details, instructions, notes..."
            rows={3}
            className={`${inputClass} resize-none`}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-primary/10">
        <button
          onClick={handleSubmit}
          className="w-full py-2.5 rounded-xl bg-themeblue3 text-white text-sm font-semibold active:scale-95 transition-all duration-200"
        >
          {isEditing ? 'Save Changes' : 'Create Event'}
        </button>
      </div>
    </div>
  )
}
