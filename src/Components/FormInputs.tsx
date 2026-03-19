import { useState, useRef, useEffect } from 'react'
import { Eye, EyeOff, ChevronDown } from 'lucide-react'

export const TextInput = ({
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  maxLength,
  required = false,
  type = 'text',
  currentValue,
  hint,
}: {
  label?: string
  value: string
  onChange: (val: string) => void
  onBlur?: () => void
  placeholder?: string
  maxLength?: number
  required?: boolean
  type?: string
  currentValue?: string | null
  hint?: string | null
}) => (
  <label className="block">
    {label && (
      <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">
        {label} {required && <span className="text-themeredred">*</span>}
      </span>
    )}
    {currentValue && (
      <div className="text-xs text-tertiary/50 mb-1">
        Current: <span className="font-medium">{currentValue}</span>
      </div>
    )}
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      maxLength={maxLength}
      required={required}
      className={`${label ? 'mt-1' : ''} w-full px-3 py-2.5 rounded-lg text-primary text-base
                 border border-tertiary/10 focus-within:border-themeblue1/30 focus-within:bg-themewhite2 bg-themewhite dark:bg-themewhite3 focus:outline-none
                 transition-all placeholder:text-tertiary/30`}
    />
    {hint && (
      <span className="mt-1 block text-xs text-themeredred">{hint}</span>
    )}
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

export const PickerInput = ({
  value,
  onChange,
  options,
  placeholder,
  required = false,
}: {
  value: string
  onChange: (val: string) => void
  options: readonly string[]
  placeholder?: string
  required?: boolean
}) => {
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  const ref = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    if (open) {
      const idx = value ? options.indexOf(value) : 0
      setHighlighted(idx >= 0 ? idx : 0)
    }
  }, [open, options, value])

  useEffect(() => {
    if (!open || highlighted < 0) return
    const el = listRef.current?.children[highlighted] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [highlighted, open])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        setOpen(true)
      }
      return
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlighted(i => Math.min(i + 1, options.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlighted(i => Math.max(i - 1, 0))
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (highlighted >= 0 && highlighted < options.length) {
          onChange(options[highlighted])
          setOpen(false)
        }
        break
      case 'Escape':
        e.preventDefault()
        setOpen(false)
        break
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        className={`w-full px-3 py-2.5 rounded-lg text-left text-base
                   border border-tertiary/10 focus:border-themeblue1/30 focus:bg-themewhite2 bg-themewhite dark:bg-themewhite3 focus:outline-none
                   transition-all flex items-center justify-between active:scale-[0.98] ${
                     value ? 'text-primary' : 'text-tertiary/30'
                   }`}
      >
        <span className="truncate">{value || placeholder || 'Select...'}</span>
        <ChevronDown size={16} className={`shrink-0 ml-2 text-tertiary/40 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {required && !value && (
        <input tabIndex={-1} className="absolute inset-0 opacity-0 pointer-events-none" required value="" onChange={() => {}} />
      )}
      {open && (
        <div ref={listRef} className="absolute z-50 left-0 right-0 top-full mt-1 max-h-52 overflow-y-auto rounded-xl border border-tertiary/10 bg-themewhite dark:bg-themewhite3 shadow-lg">
          {options.map((opt, i) => (
            <button
              key={opt}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setHighlighted(i)}
              onClick={() => { onChange(opt); setOpen(false) }}
              className={`w-full text-left px-3 py-2.5 text-sm transition-colors active:scale-95 ${
                i === highlighted ? 'text-themeblue3 font-medium bg-themeblue3/5' : opt === value ? 'text-themeblue3 font-medium' : 'text-primary hover:bg-themeblue3/5'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

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
  label?: string
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
      {label && <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">{label}</span>}
      <div className={`relative ${label ? 'mt-1' : ''}`}>
        <input
          ref={inputRef}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          className="w-full px-3 py-2.5 pr-10 rounded-lg bg-themewhite dark:bg-themewhite3 text-primary text-base
                     border border-tertiary/10 focus-within:border-themeblue1/30 focus-within:bg-themewhite2 focus:outline-none transition-all placeholder:text-tertiary/30 disabled:opacity-50"
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
