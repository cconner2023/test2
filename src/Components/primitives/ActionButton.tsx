import type { LucideIcon } from 'lucide-react'

export type ActionButtonVariant = 'default' | 'danger' | 'disabled' | 'success' | 'confirm'

export interface ActionButtonProps {
  icon: LucideIcon
  label: string
  onClick?: () => void
  variant?: ActionButtonVariant
  iconSize?: number
  /** When set, renders a real `<a href>` instead of a `<button>` — the only form
   *  that reliably launches the OS handler for non-http schemes (`mailto:`/`tel:`)
   *  in the installed PWA shell. See src/lib/mailto.ts. `onClick` still fires (e.g.
   *  to close a menu) without blocking native navigation. Ignored when disabled. */
  href?: string
}

/**
 * `success` is blue, not green — it names the active-toggle state, not a commit.
 * Roughly a dozen toggles depend on it, so it can't be repointed. A commit takes
 * `confirm`, which matches `PillButton` accent="success".
 */
const STYLES: Record<ActionButtonVariant, string> = {
  default:  'bg-themeblue2/8 text-primary active:scale-95',
  danger:   'bg-themeredred/8 text-themeredred active:scale-95',
  disabled: 'bg-tertiary/4 text-tertiary cursor-default',
  success:  'bg-themeblue2 text-white active:scale-95',
  confirm:  'bg-themegreen text-white active:scale-95',
}

export function ActionButton({ icon: Icon, label, onClick, variant = 'default', iconSize = 16, href }: ActionButtonProps) {
  const className = `w-9 h-9 rounded-full flex items-center justify-center transition-all ${STYLES[variant]}`
  if (href && variant !== 'disabled') {
    return (
      <a
        href={href}
        onClick={onClick}
        aria-label={label}
        title={label}
        className={className}
      >
        <Icon size={iconSize} />
      </a>
    )
  }
  return (
    <button
      disabled={variant === 'disabled'}
      onClick={onClick}
      aria-label={label}
      title={label}
      className={className}
    >
      <Icon size={iconSize} />
    </button>
  )
}
