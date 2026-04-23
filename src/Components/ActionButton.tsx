import type { LucideIcon } from 'lucide-react'

export type ActionButtonVariant = 'default' | 'danger' | 'disabled' | 'success'

export interface ActionButtonProps {
  icon: LucideIcon
  label: string
  onClick: () => void
  variant?: ActionButtonVariant
  iconSize?: number
}

const STYLES: Record<ActionButtonVariant, string> = {
  default:  'bg-themeblue2/8 text-primary active:scale-95',
  danger:   'bg-themeredred/8 text-themeredred active:scale-95',
  disabled: 'bg-tertiary/4 text-tertiary cursor-default',
  success:  'bg-themeblue2 text-white active:scale-95',
}

export function ActionButton({ icon: Icon, label, onClick, variant = 'default', iconSize = 16 }: ActionButtonProps) {
  return (
    <button
      disabled={variant === 'disabled'}
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${STYLES[variant]}`}
    >
      <Icon size={iconSize} />
    </button>
  )
}
