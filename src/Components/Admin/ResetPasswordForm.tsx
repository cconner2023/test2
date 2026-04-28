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
    <div className="bg-tertiary/5" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center">
        <div className="flex-1 min-w-0">
          <PasswordInput
            value={value}
            onChange={onChange}
            placeholder={`New password (min ${minLength} chars)`}
            hint={tooShort ? `Minimum ${minLength} characters.` : undefined}
          />
        </div>
        <div className="flex items-center gap-2 pr-3 shrink-0">
          <button
            onClick={onCancel}
            aria-label="Cancel"
            className="w-9 h-9 rounded-full text-tertiary flex items-center justify-center active:scale-95 transition-all"
          >
            <X size={16} />
          </button>
          <button
            onClick={onSubmit}
            disabled={disabled}
            aria-label="Reset password"
            className={`h-9 rounded-full bg-themeyellow text-white flex items-center justify-center overflow-hidden transition-all duration-300 ease-out active:scale-95 disabled:opacity-30 ${value.trim() ? 'w-9 opacity-100' : 'w-0 opacity-0 pointer-events-none'}`}
          >
            <Check size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
