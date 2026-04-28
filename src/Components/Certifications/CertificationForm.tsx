import { useRef, useEffect } from 'react'
import { Trash2, X, Check, RefreshCw } from 'lucide-react'
import { credentials } from '../../Data/User'
import { ToggleSwitch } from '../Settings/ToggleSwitch'
import { TextInput, DatePickerInput } from '../FormInputs'
import type { CertFormData } from './certHelpers'

interface CertificationFormProps {
  form: CertFormData
  onChange: (updater: (prev: CertFormData) => CertFormData) => void
  /** null = add mode, string = edit mode with that cert id */
  mode: 'add' | 'edit'
  saving: boolean
  /** Disable save when title is empty (also enforced here, but callers can add more rules) */
  canSubmit: boolean
  onSubmit: () => void
  onCancel: () => void
  /** Only shown in edit mode */
  onDelete?: () => void
  /** Auto-focus the title input (used when expanding the "add" form) */
  autoFocus?: boolean
  /** Unique id suffix for the datalist, so multiple forms can coexist on one page */
  datalistId?: string
  /** Hide the internal action row when actions live in a parent overlay footer */
  hideActions?: boolean
}

export function CertificationForm({
  form,
  onChange,
  mode,
  saving,
  canSubmit,
  onSubmit,
  onCancel,
  onDelete,
  autoFocus,
  datalistId = 'default',
  hideActions = false,
}: CertificationFormProps) {
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocus) {
      const t = setTimeout(() => titleRef.current?.focus(), 100)
      return () => clearTimeout(t)
    }
  }, [autoFocus])

  const listId = `cert-sug-${datalistId}`

  return (
    <div className="bg-tertiary/5">
      <label className="block border-b border-primary/6">
        <input
          ref={titleRef}
          type="text"
          list={listId}
          value={form.title}
          onChange={(e) => onChange(f => ({ ...f, title: e.target.value }))}
          placeholder="Certification title *"
          className="w-full bg-transparent px-4 py-3 text-base md:text-sm text-primary placeholder:text-tertiary focus:outline-none"
        />
      </label>

      <div className="flex items-stretch border-b border-primary/6">
        <div className="flex-1 min-w-0">
          <TextInput
            value={form.cert_number}
            onChange={(v) => onChange(f => ({ ...f, cert_number: v }))}
            placeholder="Cert #"
          />
        </div>
        <div className="flex-1 min-w-0 border-l border-primary/6">
          <DatePickerInput
            value={form.issue_date}
            onChange={(val) => onChange(f => ({ ...f, issue_date: val }))}
            placeholder="Issued"
          />
        </div>
        <div className="flex-1 min-w-0 border-l border-primary/6">
          <DatePickerInput
            value={form.exp_date}
            onChange={(val) => onChange(f => ({ ...f, exp_date: val }))}
            placeholder="Expires"
          />
        </div>
      </div>

      <label
        className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer border-b border-primary/6"
        onClick={() => onChange(f => ({ ...f, is_primary: !f.is_primary }))}
      >
        <span className="text-base md:text-sm text-primary">Primary</span>
        <ToggleSwitch checked={form.is_primary} />
      </label>

      {!hideActions && (
        <div className="flex items-center justify-end gap-2 px-3 py-2">
          <button
            onClick={onCancel}
            disabled={saving}
            aria-label="Cancel"
            className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all"
          >
            <X size={16} />
          </button>

          {mode === 'edit' && onDelete && (
            <button
              onClick={onDelete}
              disabled={saving}
              aria-label="Delete"
              className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-themeredred active:scale-95 transition-all"
            >
              <Trash2 size={16} />
            </button>
          )}

          <button
            onClick={onSubmit}
            disabled={saving || !canSubmit}
            aria-label={mode === 'add' ? 'Add certification' : 'Save certification'}
            className={`shrink-0 h-9 rounded-full flex items-center justify-center bg-themeblue3 text-white overflow-hidden transition-all duration-300 ease-out active:scale-95 disabled:opacity-30 ${canSubmit ? 'w-9 opacity-100' : 'w-0 opacity-0 pointer-events-none'}`}
          >
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Check size={16} />}
          </button>
        </div>
      )}

      <datalist id={listId}>
        {credentials.map(c => <option key={c} value={c} />)}
      </datalist>
    </div>
  )
}
