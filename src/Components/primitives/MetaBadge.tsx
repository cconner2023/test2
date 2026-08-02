import type { ReactNode } from 'react'

/**
 * The small uppercase word that annotates a row without being an action —
 * "Soon" on a feature that is not built yet, "Latest" on the current version.
 *
 * It existed four times in Settings at three different sizes (8.5pt / 9pt / 9pt
 * with a no-op `md:text-[9pt]`) and two class orders, which is what a word this
 * small always turns into when it is retyped per call site. It is deliberately
 * NOT a Chip: a chip is a control you can press, and pressing this does nothing.
 */
export function MetaBadge({ children, tone = 'muted' }: {
    children: ReactNode
    /** `accent` marks something current or new; `muted` marks something absent. */
    tone?: 'muted' | 'accent'
}) {
    return (
        <span className={`text-[9pt] font-semibold uppercase tracking-wide shrink-0 ${
            tone === 'accent' ? 'text-themeblue2' : 'text-tertiary'
        }`}>
            {children}
        </span>
    )
}
