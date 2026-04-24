import { Check, X } from 'lucide-react'
import { PasswordInput } from '../FormInputs'

interface ResetPasswordFormProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  onCancel: () => void
  processing?: boolean
  /** Override the minimum password length — defaults to 12 to match adminService. */
  minLength?: number
}

export function ResetPasswordForm({
  value,
  onChange,
  onSubmit,
  onCancel,
  processing,
  minLength = 12,
}: ResetPasswordFormProps) {
  const tooShort = value.length > 0 && value.length < minLength
  const disabled = processing || value.length < minLength

  return (
    <div className="px-4 pb-3.5 bg-tertiary/5" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <PasswordInput
            value={value}
            onChange={onChange}
            placeholder={`New password (min ${minLength} chars)...`}
          />
        </div>
        <button
          onClick={onSubmit}
          disabled={disabled}
          aria-label="Reset password"
          className="shrink-0 w-10 h-10 rounded-full bg-themeyellow text-white flex items-center justify-center disabled:opacity-30 active:scale-95 transition-all"
        >
          <Check size={16} />
        </button>
        <button
          onClick={onCancel}
          aria-label="Cancel"
          className="shrink-0 w-10 h-10 rounded-full text-tertiary flex items-center justify-center active:scale-95 transition-all"
        >
          <X size={16} />
        </button>
      </div>
      {tooShort && (
        <p className="text-xs text-themeredred mt-1.5">Minimum {minLength} characters.</p>
      )}
    </div>
  )
}
