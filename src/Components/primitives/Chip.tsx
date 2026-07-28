import type { ReactNode } from 'react';

/**
 * Toggle chip — Beacon's single flat segmented selector. Flat, NOT a rounded
 * pill: active fills solid (themeblue3 by default) with white text, inactive is
 * transparent with a press tint.
 *
 * Height is the invariant: `min-h-[44px]` clears the iOS touch floor, which the
 * old `py-0.5` segmented copies did not. A `dense` escape hatch is deliberately
 * absent — that is how the codebase ended up with six chip sizes.
 *
 * Type scale follows content, not call site: with a `sublabel` the chip reads as
 * the AVPU two-line cell (bold code over its expansion), without one it is a
 * single `text-[10pt]` row. Drop into a {@link ChipBar}, which owns layout,
 * dividers and horizontal scroll.
 */
export function Chip({ active = false, onClick, sublabel, activeClass = 'bg-themeblue3', title, className = '', children }: {
  active?: boolean;
  onClick?: () => void;
  /** Secondary line under the label — AVPU-style code + expansion. */
  sublabel?: ReactNode;
  /** Active fill, for axes that carry their own colour (EVAC precedence, AVPU). */
  activeClass?: string;
  title?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`shrink-0 min-h-[44px] px-4 flex flex-col items-center justify-center py-2 transition-colors ${
        active ? activeClass : 'active:bg-tertiary/5'
      } ${className}`}
    >
      <span className={`${sublabel ? 'text-sm font-bold' : 'text-[10pt] font-medium'} ${active ? 'text-white' : 'text-primary'}`}>
        {children}
      </span>
      {sublabel && (
        <span className={`text-[8pt] ${active ? 'text-white/80' : 'text-tertiary'}`}>{sublabel}</span>
      )}
    </button>
  );
}

/**
 * Segmented bar for {@link Chip}s — hairline-divided cells, solid-filled active.
 * Owns layout so the chip stays dumb:
 *
 * - `layout="fixed"` — equal-split cells for a known short option set (AVPU,
 *   °F/°C, oral/rectal). Tightens horizontal padding since the row is shared out.
 * - `layout="scroll"` — default; `shrink-0` cells in a horizontal scroller for
 *   variable-length lists (blood type, order sets, search scopes).
 * - `layout="wrap"` — every option stays visible on its own hairline-bordered
 *   cell. For multi-select sets where scrolling an option out of sight would
 *   lose it (screener checkboxes), not as a way to avoid choosing a layout.
 *
 * `bordered` adds the rounded container. Leave it off inside a form cell or
 * section block that already supplies its own edges (all of TC3); turn it on
 * when the bar floats on an open background.
 */
export function ChipBar({ layout = 'scroll', bordered = false, className = '', children }: {
  layout?: 'fixed' | 'scroll' | 'wrap';
  bordered?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const layoutCx = {
    fixed: 'divide-x divide-primary/6 [&>button]:flex-1 [&>button]:px-2',
    scroll: 'divide-x divide-primary/6 overflow-x-auto',
    wrap: 'flex-wrap gap-1.5 [&>button]:border [&>button]:border-primary/6',
  }[layout];

  return (
    <div
      className={`flex items-stretch ${layoutCx} ${bordered ? 'rounded-lg border border-primary/6' : ''} ${className}`}
      style={layout === 'scroll' ? { scrollbarWidth: 'none' } : undefined}
    >
      {children}
    </div>
  );
}

/**
 * Single-select {@link ChipBar} over a plain string union — the common case, so
 * the option list does not have to be hand-mapped at every call site. Reach for
 * `ChipBar` + `Chip` directly when options carry their own labels, colours or
 * sublabels, or when selection is multiple.
 */
export function Segmented<T extends string>({ options, value, onChange, capitalize, layout = 'scroll', activeClass, className = '' }: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  capitalize?: boolean;
  layout?: 'fixed' | 'scroll';
  activeClass?: string;
  className?: string;
}) {
  return (
    <ChipBar layout={layout} className={className}>
      {options.map((opt) => (
        <Chip
          key={opt}
          active={value === opt}
          activeClass={activeClass}
          onClick={() => onChange(opt)}
          className={capitalize ? 'capitalize' : ''}
        >
          {opt}
        </Chip>
      ))}
    </ChipBar>
  );
}
