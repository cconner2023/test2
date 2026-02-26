import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

export const TextInput = ({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  required = false,
  type = 'text',
  currentValue,
}: {
  label: string
  value: string
  onChange: (val: string) => void
  placeholder?: string
  maxLength?: number
  required?: boolean
  type?: string
  currentValue?: string | null
}) => (
  <label className="block">
    <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">
      {label} {required && <span className="text-themeredred">*</span>}
    </span>
    {currentValue && (
      <div className="text-xs text-tertiary/50 mb-1">
        Current: <span className="font-medium">{currentValue}</span>
      </div>
    )}
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      required={required}
      className="mt-1 w-full px-3 py-2.5 rounded-lg bg-themewhite2 text-primary text-base
                 border border-tertiary/10 focus:border-themeblue2 focus:outline-none
                 transition-colors placeholder:text-tertiary/30"
    />
  </label>
)

export const SelectInput = ({
  label,
  value,
  onChange,
  options,
  placeholder,
  required = false,
  currentValue,
}: {
  label: string
  value: string
  onChange: (val: string) => void
  options: readonly string[]
  placeholder?: string
  required?: boolean
  currentValue?: string | null
}) => (
  <label className="block">
    <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">
      {label} {required && <span className="text-themeredred">*</span>}
    </span>
    {currentValue && (
      <div className="text-xs text-tertiary/50 mb-1">
        Current: <span className="font-medium">{currentValue}</span>
      </div>
    )}
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      className="mt-1 w-full px-3 py-2.5 rounded-lg bg-themewhite2 text-primary text-base
                 border border-tertiary/10 focus:border-themeblue2 focus:outline-none
                 transition-colors appearance-none"
    >
      <option value="">{placeholder ?? 'Select...'}</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  </label>
)

export const PasswordInput = ({
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  disabled,
  inputRef,
  hint,
}: {
  label: string
  value: string
  onChange: (val: string) => void
  placeholder?: string
  autoComplete?: string
  disabled?: boolean
  inputRef?: React.RefObject<HTMLInputElement | null>
  hint?: React.ReactNode
}) => {
  const [show, setShow] = useState(false)

  return (
    <label className="block">
      <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">{label}</span>
      <div className="relative mt-1">
        <input
          ref={inputRef}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          className="w-full px-3 py-2.5 pr-10 rounded-lg bg-themewhite2 text-primary text-base
                     border border-tertiary/10 focus:border-themeblue2 focus:outline-none
                     transition-colors placeholder:text-tertiary/30 disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-tertiary/40 hover:text-tertiary/70 transition-colors"
        >
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {hint}
    </label>
  )
}
