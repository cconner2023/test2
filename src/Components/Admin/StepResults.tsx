import { Check, X, RefreshCw } from 'lucide-react'
import { ActionPill } from '../ActionPill'
import { ActionButton } from '../ActionButton'

export interface StepResult {
  key: string
  label: string
  ok: boolean
  error?: string
  /** True while the step is in flight. When set, the row renders a spinner
   *  regardless of `ok`. Clear to false (or omit) on completion. */
  pending?: boolean
}

interface StepResultsProps {
  steps: StepResult[]
  /** Provide to render a retry control for failed steps. */
  onRetry?: () => void
  retrying?: boolean
  className?: string
}

export function StepResults({ steps, onRetry, retrying, className = '' }: StepResultsProps) {
  if (steps.length === 0) return null
  const anyPending = steps.some(s => s.pending)
  const anyFailed = steps.some(s => !s.pending && !s.ok)
  const headerTone = anyPending
    ? 'bg-themeblue2/8 text-themeblue2'
    : anyFailed
      ? 'bg-themeredred/8 text-themeredred'
      : 'bg-themegreen/8 text-themegreen'
  const headerLabel = anyPending
    ? `Saving ${steps.length} step${steps.length === 1 ? '' : 's'}…`
    : anyFailed
      ? `${steps.filter(s => !s.ok).length} of ${steps.length} step(s) failed`
      : `All ${steps.length} step(s) succeeded`

  return (
    <div role="status" className={`rounded-2xl overflow-hidden border border-primary/8 ${className}`}>
      <div className={`px-3 py-2 text-[9pt] font-semibold uppercase tracking-wider ${headerTone}`}>
        {headerLabel}
      </div>
      <ul className="divide-y divide-primary/6 bg-themewhite2">
        {steps.map(step => {
          const iconTone = step.pending
            ? 'bg-themeblue2/12 text-themeblue2'
            : step.ok
              ? 'bg-themegreen/12 text-themegreen'
              : 'bg-themeredred/12 text-themeredred'
          const textTone = step.pending
            ? 'text-tertiary'
            : step.ok
              ? 'text-primary'
              : 'text-themeredred'
          const ariaLabel = step.pending ? 'In progress' : step.ok ? 'Succeeded' : 'Failed'
          return (
            <li key={step.key} className="flex items-start gap-2.5 px-3 py-2">
              <span
                className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${iconTone}`}
                aria-label={ariaLabel}
              >
                {step.pending
                  ? <RefreshCw size={12} className="animate-spin" />
                  : step.ok
                    ? <Check size={12} />
                    : <X size={12} />}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`text-[10pt] ${textTone}`}>{step.label}</p>
                {!step.pending && !step.ok && step.error && (
                  <p className="text-[9pt] text-tertiary mt-0.5">{step.error}</p>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      {!anyPending && anyFailed && onRetry && (
        <div className="px-3 py-2 bg-themewhite2 border-t border-primary/6 flex justify-end">
          <ActionPill shadow="sm">
            <ActionButton
              icon={RefreshCw}
              label={retrying ? 'Retrying…' : 'Retry failed'}
              variant={retrying ? 'disabled' : 'default'}
              onClick={onRetry}
            />
          </ActionPill>
        </div>
      )}
    </div>
  )
}
