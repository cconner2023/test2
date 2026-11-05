import type { ReactNode } from 'react'
import { SelectedCheck } from './SelectedCheck'

/** Shell tint + footer text class. Footer text stays text-primary — accent
 *  tokens stay dark in dark themes and vanish on the tinted shell. */
export interface CardTint {
  shell: string
  foot: string
}

/** Full-size head — big mono title with a small line under it. Shared by the
 *  card and anything that grows out of it (TrackingCardOverlay). */
export function TintedCardHead({ title, subtitle, monoSubtitle = true }: {
  title: ReactNode
  subtitle?: ReactNode
  monoSubtitle?: boolean
}) {
  return (
    <>
      <p className="text-[16pt] leading-tight font-mono font-bold tracking-wide text-primary truncate">{title}</p>
      {subtitle != null && (
        <p className={`mt-0.5 text-[9pt] ${monoSubtitle ? 'font-mono ' : ''}font-medium text-tertiary truncate`}>{subtitle}</p>
      )}
    </>
  )
}

/** Full-size footer band on the tint — left label, right mono stamp. */
export function TintedCardFoot({ tint, left, right }: { tint: CardTint; left: ReactNode; right?: ReactNode }) {
  return (
    <div className={`flex items-center justify-between gap-3 px-3 pt-1.5 pb-0.5 text-[8pt] font-semibold uppercase tracking-wider ${tint.foot}`}>
      <span className="truncate">{left}</span>
      {right != null && <span className="font-mono shrink-0">{right}</span>}
    </div>
  )
}

interface TintedCardProps {
  tint: CardTint
  title: ReactNode
  subtitle?: ReactNode
  monoSubtitle?: boolean
  /** One-line secondary text in the white inner card. */
  note?: ReactNode
  footLeft: ReactNode
  footRight?: ReactNode
  /** Condensed rail size — title · subtitle on one line, smaller foot. */
  compact?: boolean
  /** Check badge in the card's top-right corner — this is the open/active card. */
  selected?: boolean
}

/**
 * Tinted shell → white inner card (title, subtitle, note) → footer band on the
 * tint. The board scans by color before text. Pure presentation — wrap it in a
 * SwipeActionRow / button for gestures. Used by the Tracking Board (BRN cards)
 * and the TC3 casualty roster.
 */
export function TintedCard({ tint, title, subtitle, monoSubtitle = true, note, footLeft, footRight, compact = false, selected = false }: TintedCardProps) {
  if (compact) {
    return (
      <div className={`p-1 ${tint.shell}`}>
        <div className="rounded-lg bg-themewhite px-3 py-1.5 shadow-sm min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[11pt] leading-tight font-mono font-bold tracking-wide text-primary truncate">{title}</span>
            <span className="flex items-center gap-1.5 shrink-0">
              {subtitle != null && (
                <span className={`text-[8pt] ${monoSubtitle ? 'font-mono ' : ''}font-medium text-tertiary`}>{subtitle}</span>
              )}
              {selected && <SelectedCheck className="-my-1" colorClass={tint.shell} />}
            </span>
          </div>
          {note && <p className="mt-0.5 text-[8.5pt] text-secondary truncate">{note}</p>}
        </div>
        <div className={`flex items-center justify-between gap-2 px-2 pt-1 text-[7.5pt] font-semibold uppercase tracking-wider ${tint.foot}`}>
          <span className="truncate">{footLeft}</span>
          {footRight != null && <span className="font-mono shrink-0">{footRight}</span>}
        </div>
      </div>
    )
  }
  return (
    <div className={`p-1.5 ${tint.shell}`}>
      <div className={`relative rounded-xl bg-themewhite py-3 pl-4 shadow-sm min-w-0 ${selected ? 'pr-10' : 'pr-4'}`}>
        {selected && <SelectedCheck className="absolute top-3 right-3" colorClass={tint.shell} />}
        <TintedCardHead title={title} subtitle={subtitle} monoSubtitle={monoSubtitle} />
        {note && <p className="mt-1 text-[9.5pt] text-secondary truncate">{note}</p>}
      </div>
      <TintedCardFoot tint={tint} left={footLeft} right={footRight} />
    </div>
  )
}
