import type { ReactNode } from 'react';

/**
 * Labelled field cell — title top-left, hint top-right, value below.
 *
 * The title sits ABOVE the value, never leading it on the left. A left-label
 * column has to be wide enough for the longest label in the set, so every other
 * row donates that width to a label it does not need, and the value column
 * drifts further right the moment one label grows. Stacking keeps the full cell
 * width available to the input and keeps the values on a common left edge.
 *
 * Pass `bare` when the parent owns the dividers — {@link FieldGrid} does.
 */
export function FieldCell({ label, labelNode, hint, hintClass = 'text-tertiary', bare, className = '', children }: {
  label?: string;
  /** Replaces the plain title when the header needs to be composed. */
  labelNode?: ReactNode;
  hint?: ReactNode;
  hintClass?: string;
  bare?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-0.5 px-3 py-2 ${bare ? '' : 'border-b border-primary/6 last:border-0'} ${className}`}>
      <div className="flex items-baseline justify-between gap-2 min-w-0">
        {labelNode ?? <FieldLabel>{label}</FieldLabel>}
        {hint && <span className={`text-[8.5pt] font-medium truncate ${hintClass}`}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

/** The title on its own, for headers that compose their own row. */
export function FieldLabel({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <span className={`text-[9pt] font-semibold text-tertiary uppercase tracking-widest shrink-0 ${className}`}>
      {children}
    </span>
  );
}

/**
 * Grid of {@link FieldCell}s. Give the cells `bare` — the grid owns every
 * divider, because a cell cannot know whether it sits at the end of a row.
 *
 * Hairlines are cell BORDERS, not a `gap-px` + opaque-cell sandwich, so the
 * cells stay transparent and take whatever surface hosts them (write-note PE
 * popover vs. drawer). `-mb-px` + clipping hides the last row's trailing border.
 */
export function FieldGrid({ cols = 2, className = '', children }: {
  cols?: 1 | 2;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`grid overflow-hidden -mb-px [&>*]:border-b [&>*]:border-primary/6 ${
        cols === 2 ? 'grid-cols-2 [&>*:nth-child(odd)]:border-r' : 'grid-cols-1'
      } ${className}`}
    >
      {children}
    </div>
  );
}
