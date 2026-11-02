/**
 * Horizontally scrollable underlined tab list — text labels, the active one
 * bold with a themeblue3 underline. Tapping a tab scrolls it into view.
 * Used by the Tracking Board category bar and the search dropdown scopes.
 */
export function UnderlineTabs<T extends string>({
    tabs,
    value,
    onChange,
    ariaLabel,
    className = '',
}: {
    tabs: { key: T; label: React.ReactNode }[]
    value: T
    onChange: (key: T) => void
    ariaLabel?: string
    className?: string
}) {
    return (
        <div
            role="tablist"
            aria-label={ariaLabel}
            className={`flex gap-5 px-1 overflow-x-auto ${className}`}
            style={{ scrollbarWidth: 'none' }}
        >
            {tabs.map(t => {
                const active = value === t.key
                return (
                    <button
                        key={t.key}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => { onChange(t.key); e.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' }) }}
                        className={`shrink-0 min-h-[44px] border-b-2 text-[10pt] transition-colors ${
                            active ? 'border-themeblue3 text-primary font-semibold' : 'border-transparent text-tertiary font-medium'
                        }`}
                    >
                        {t.label}
                    </button>
                )
            })}
        </div>
    )
}
