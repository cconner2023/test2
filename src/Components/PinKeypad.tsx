import { useState, useCallback, useEffect, useRef, type ReactNode } from 'react'
import { Delete, ScanFace } from 'lucide-react'

interface PinKeypadProps {
  onSubmit: (pin: string) => void
  label: string
  error?: string
  disabled?: boolean
  lockoutMessage?: string
  biometricReady?: boolean
  onBiometric?: () => void
  extraContent?: ReactNode
}

export const PinKeypad = ({
  onSubmit,
  label,
  error,
  disabled,
  lockoutMessage,
  biometricReady,
  onBiometric,
  extraContent,
}: PinKeypadProps) => {
  const [digits, setDigits] = useState('')
  const [shaking, setShaking] = useState(false)
  const [showError, setShowError] = useState(false)
  const justSubmitted = useRef(false)

  // Detect error after submission → shake and clear digits
  useEffect(() => {
    if (!justSubmitted.current || !error) return
    justSubmitted.current = false
    setShowError(true)
    setShaking(true)
    setTimeout(() => {
      setShaking(false)
      setDigits('')
    }, 400)
  })

  // Reset when label changes (view transition in setup panel)
  const prevLabel = useRef(label)
  useEffect(() => {
    if (label !== prevLabel.current) {
      setDigits('')
      setShowError(false)
      justSubmitted.current = false
    }
    prevLabel.current = label
  }, [label])

  // Clear visual error when parent clears error prop
  useEffect(() => {
    if (!error) setShowError(false)
  }, [error])

  const handleDigitPress = useCallback((digit: string) => {
    if (disabled) return
    setShowError(false)
    setDigits(prev => {
      const next = prev + digit
      if (next.length === 4) {
        justSubmitted.current = true
        onSubmit(next)
      }
      return next.length <= 4 ? next : prev
    })
  }, [disabled, onSubmit])

  const handleBackspace = useCallback(() => {
    if (disabled) return
    setShowError(false)
    setDigits(prev => prev.slice(0, -1))
  }, [disabled])

  // Keyboard support
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') handleDigitPress(e.key)
      else if (e.key === 'Backspace') handleBackspace()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleDigitPress, handleBackspace])

  const displayText = lockoutMessage ?? (showError ? error : null) ?? label
  const isError = !lockoutMessage && showError && !!error

  const keys = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    [biometricReady ? 'bio' : '', '0', 'back'],
  ]

  return (
    <div className="flex flex-col items-center w-full">
      {/* Label / error / lockout */}
      <p className={`text-sm text-center mb-2 ${isError ? 'text-themeredred' : 'text-tertiary'}`}>
        {displayText}
      </p>

      {/* Dot indicators */}
      <div className={`flex gap-4 mb-8 ${shaking ? 'animate-shake' : ''}`}>
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className={`w-3.5 h-3.5 rounded-full transition-all duration-150 ${
              i < digits.length
                ? isError ? 'bg-themeredred scale-110' : 'bg-themeblue2 scale-110'
                : 'bg-themegray1/50'
            }`}
          />
        ))}
      </div>

      {/* Extra content slot (e.g. password form for permanent lock) */}
      {extraContent}

      {/* Numeric keypad */}
      <div className="grid grid-cols-3 gap-3 w-full">
        {keys.flat().map((key, idx) => {
          if (key === '') return <div key={idx} />
          if (key === 'bio') {
            return (
              <button
                key={idx}
                onClick={onBiometric}
                disabled={disabled}
                className="aspect-square rounded-full flex items-center justify-center
                           active:bg-themeblue2/20 transition-colors disabled:opacity-30"
              >
                <ScanFace size={26} className="text-themeblue2" />
              </button>
            )
          }
          if (key === 'back') {
            return (
              <button
                key={idx}
                onClick={handleBackspace}
                disabled={disabled}
                className="aspect-square rounded-full flex items-center justify-center
                           active:bg-themegray1/20 transition-colors disabled:opacity-30"
              >
                <Delete size={24} className="text-primary" />
              </button>
            )
          }
          return (
            <button
              key={idx}
              onClick={() => handleDigitPress(key)}
              disabled={disabled}
              className="aspect-square rounded-full bg-themewhite2 flex items-center justify-center
                         text-2xl font-medium text-primary
                         active:bg-themegray1/40 transition-colors disabled:opacity-30"
            >
              {key}
            </button>
          )
        })}
      </div>
    </div>
  )
}
