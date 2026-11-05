/** Filled check badge marking the selected item in a list of cards.
 *  `colorClass` overrides the fill (e.g. a TintedCard's trim / shell colour). */
export function SelectedCheck({ className = '', colorClass = 'bg-themeblue2' }: { className?: string; colorClass?: string }) {
  return (
    <span
      role="img"
      aria-label="Selected"
      className={`w-5 h-5 rounded-full ${colorClass} flex items-center justify-center shrink-0 ${className}`}
    >
      <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden="true">
        <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}
