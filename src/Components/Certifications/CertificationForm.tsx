import { useRef, useEffect } from 'react'
import { Trash2, X, Check, RefreshCw } from 'lucide-react'
import { credentials } from '../../Data/User'
import { ToggleSwitch } from '../Settings/ToggleSwitch'
import { DatePickerInput } from '../FormInputs'
import { certPillInput, type CertFormData } from './certHelpers'

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
    <div className="px-4 py-3 bg-tertiary/5 space-y-2">
      <input
        ref={titleRef}
        type="text"
        list={listId}
        value={form.title}
        onChange={(e) => onChange(f => ({ ...f, title: e.target.value }))}
        placeholder="Certification title *"
        className={certPillInput}
      />

      <div className="grid grid-cols-3 gap-2">
        <input
          type="text"
          value={form.cert_number}
          onChange={(e) => onChange(f => ({ ...f, cert_number: e.target.value }))}
          placeholder="Cert #"
          className={certPillInput}
        />
        <DatePickerInput
          value={form.issue_date}
          onChange={(val) => onChange(f => ({ ...f, issue_date: val }))}
          placeholder="Issued"
        />
        <DatePickerInput
          value={form.exp_date}
          onChange={(val) => onChange(f => ({ ...f, exp_date: val }))}
          placeholder="Expires"
        />
      </div>

      <div className="flex items-center gap-2 pt-1">
        <label
          className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0"
          onClick={() => onChange(f => ({ ...f, is_primary: !f.is_primary }))}
        >
          <span className="text-sm text-primary">Primary</span>
          <ToggleSwitch checked={form.is_primary} />
        </label>

        <button
          onClick={onCancel}
          disabled={saving}
          aria-label="Cancel"
          className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all"
        >
          <X size={18} />
        </button>

        {mode === 'edit' && onDelete && (
          <button
            onClick={onDelete}
            disabled={saving}
            aria-label="Delete"
            className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all"
          >
            <Trash2 size={18} />
          </button>
        )}

        <button
          onClick={onSubmit}
          disabled={saving || !canSubmit}
          aria-label={mode === 'add' ? 'Add certification' : 'Save certification'}
          className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-themeblue3 text-white disabled:opacity-30 active:scale-95 transition-all"
        >
          {saving ? <RefreshCw size={16} className="animate-spin" /> : <Check size={18} />}
        </button>
      </div>

      <datalist id={listId}>
        {credentials.map(c => <option key={c} value={c} />)}
      </datalist>
    </div>
  )
}
