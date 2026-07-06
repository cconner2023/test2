import type { ReactNode } from 'react';

/**
 * Selectable chip — Beacon's canonical filled-segment selector (AVPU pattern,
 * VitalsForm.tsx). Flat, NOT a rounded pill: active fills solid bg-themeblue3 /
 * white; inactive is transparent with a press tint. Self-contained `shrink-0`
 * cell — drop into a `ChipBar` (or any `flex items-stretch divide-x` row) and the
 * container supplies the hairline dividers + horizontal scroll.
 */
export function Chip({ active = false, onClick, children, className = '' }: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 px-4 py-2 text-[10pt] font-medium transition-colors ${
        active ? 'bg-themeblue3 text-white' : 'text-primary active:bg-tertiary/5'
      } ${className}`}
    >
      {children}
    </button>
  );
}

/**
 * Horizontal-scroll segmented bar for {@link Chip}s — gives the AVPU look
 * (hairline-divided cells, solid-filled active) for a variable-length list.
 */
export function ChipBar({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`flex items-stretch overflow-x-auto rounded-lg border border-primary/6 divide-x divide-primary/6 ${className}`}
      style={{ scrollbarWidth: 'none' }}
    >
      {children}
    </div>
  );
}
