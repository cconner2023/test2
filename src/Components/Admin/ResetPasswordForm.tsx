import { Check, X } from 'lucide-react'
import { PasswordInput } from '../FormInputs'
import { ActionPill } from '../ActionPill'
import { ActionButton } from '../ActionButton'

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
  const canSubmit = !processing && value.length >= minLength

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
        <div
          className="grid pr-2 transition-[grid-template-columns,opacity] duration-300 ease-out"
          style={{
            gridTemplateColumns: value.trim() ? '1fr' : '0fr',
            opacity: value.trim() ? 1 : 0,
          }}
        >
          <div className="overflow-hidden">
            <ActionPill shadow="sm">
              <ActionButton icon={X} label="Cancel" onClick={onCancel} />
              <ActionButton
                icon={Check}
                label="Reset password"
                variant={canSubmit ? 'success' : 'disabled'}
                onClick={onSubmit}
              />
            </ActionPill>
          </div>
        </div>
      </div>
    </div>
  )
}
