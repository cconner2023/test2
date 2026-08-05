import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check } from 'lucide-react'
import { UI_TIMING } from '@/Utilities/constants'
import { onCopied } from '@/lib/copyFeedback'

const FADE_MS = 200

/**
 * The copy confirmation surface — a centred card that fades in, holds, and dismisses
 * itself. Mounted ONCE, at the app root; `copyWithHtml` raises it, so consumers never
 * track a `copied` flag of their own.
 *
 * Non-blocking by construction: no scrim and `pointer-events-none` throughout, so it
 * confirms without interrupting whatever the medic does next. It replaced the
 * per-button status morph (icon swap + spinner + colour change), which animated inside
 * menu rows and read as churn.
 *
 * The z sits above AnchoredMenu's 9998 portal rather than on the `Z` scale — a copy
 * fired from a menu row has to confirm over that menu.
 */
export function CopiedModal() {
  const [label, setLabel] = useState<string | null>(null)
  const [visible, setVisible] = useState(false)
  const timers = useRef<number[]>([])

  useEffect(() => {
    const clear = () => { timers.current.forEach(clearTimeout); timers.current = [] }
    const unsubscribe = onCopied((next) => {
      // A second copy restarts the hold rather than stacking cards.
      clear()
      setLabel(next)
      timers.current.push(window.setTimeout(() => setVisible(true), 0))
      timers.current.push(window.setTimeout(() => setVisible(false), UI_TIMING.COPY_FEEDBACK))
      timers.current.push(window.setTimeout(() => setLabel(null), UI_TIMING.COPY_FEEDBACK + FADE_MS))
    })
    return () => { unsubscribe(); clear() }
  }, [])

  if (!label) return null

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center pointer-events-none px-6"
      style={{ zIndex: 10000 }}
      role="status"
      aria-live="polite"
    >
      <div
        className={`bg-themewhite3 rounded-2xl surface-shadow px-7 py-6 flex flex-col items-center gap-2.5 transition-all ease-out ${
          visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
        style={{ transitionDuration: `${FADE_MS}ms` }}
      >
        <div className="w-12 h-12 rounded-full bg-themeblue2/10 flex items-center justify-center">
          <Check className="w-6 h-6 text-themeblue2" />
        </div>
        <p className="text-[10pt] font-medium text-primary">{label}</p>
      </div>
    </div>,
    document.body,
  )
}
