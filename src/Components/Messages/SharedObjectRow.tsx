/**
 * SharedObjectRow — the canonical "shared object" row: a square icon tile +
 * label/subLabel, optionally tappable with a trailing chevron. One shape for
 * every place an object (calendar event, property item, map overlay) is shown
 * as a card: the chat ref bubble (MessageBubble), the cross-cluster bundle card
 * (SharedBundleCard), and the share picker. Previously each site hand-rolled the
 * same `w-9 h-9 rounded-lg` tile block and they drifted.
 *
 * `tone` themes the row for its surface: 'own' = white-on-blue (own message
 * bubble), 'peer' = primary-on-light (incoming bubble / neutral surface).
 * Pass `onClick` to make it a button (adds interactive chrome + a chevron); the
 * handler receives the event so callers can stopPropagation on tap. Omit it for
 * a static title row. `className` carries per-surface sizing (e.g. the chat
 * bubble's min/max width).
 */
import { ChevronRight, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

const TONE = {
  own: {
    tile: 'bg-white/20',
    icon: 'text-white',
    label: 'text-white',
    sub: 'text-white/70',
    chevron: 'text-white/60',
    hover: 'hover:bg-white/10',
  },
  peer: {
    tile: 'bg-themeblue3/10',
    icon: 'text-themeblue3',
    label: 'text-primary',
    sub: 'text-tertiary',
    chevron: 'text-tertiary',
    hover: 'hover:bg-primary/5',
  },
} as const

interface SharedObjectRowProps {
  icon: LucideIcon
  label: string
  subLabel?: string | null
  /** Surface theming: 'own' = white-on-blue bubble, 'peer' = primary-on-light. */
  tone: 'own' | 'peer'
  /** When set, renders a tappable button (interactive chrome + trailing chevron).
   *  Receives the event so the caller can stopPropagation. */
  onClick?: (e: React.MouseEvent) => void
  /** Trailing slot override — defaults to a chevron when `onClick` is set. */
  right?: ReactNode
  /** Per-surface sizing / extra classes (e.g. chat bubble min/max width). */
  className?: string
}

export function SharedObjectRow({ icon: Icon, label, subLabel, tone, onClick, right, className = '' }: SharedObjectRowProps) {
  const t = TONE[tone]
  const inner = (
    <>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${t.tile}`}>
        <Icon size={17} className={t.icon} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium truncate ${t.label}`}>{label}</p>
        {subLabel && <p className={`text-[9pt] truncate ${t.sub}`}>{subLabel}</p>}
      </div>
      {right ?? (onClick ? <ChevronRight size={16} className={`shrink-0 ${t.chevron}`} /> : null)}
    </>
  )

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={`flex items-center gap-2.5 text-left -mx-1 px-2 py-1 rounded-lg active:scale-[0.98] transition-all ${t.hover} ${className}`}
      >
        {inner}
      </button>
    )
  }
  return <div className={`flex items-center gap-2.5 ${className}`}>{inner}</div>
}
