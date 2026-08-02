import type { ReactNode } from 'react'
import { ChevronRight, ChevronDown, MoreHorizontal } from 'lucide-react'

/**
 * The surfaceless two-level list row shared by the property book's report surfaces —
 * Cluster Hand Receipt (authorized), Cluster Shortages, and a DA 2062's item rows.
 * No card frame: these lists are navigation, not content, so the row carries only a
 * hover tint and a transparent left rail, and selecting one renders the object in the
 * host pane (right pane desktop / detail sheet mobile).
 *
 * Layout is [chevron] title + identifier lines | trailing | ellipsis. Group nodes take
 * `emphasis` and a chevron; their children take depth 1, which indents past the
 * chevron so both titles share a left edge.
 *
 * Two title weights carry the level, and there are only two in the whole rail:
 * a group node is semibold primary, a leaf is normal secondary. Colour does the
 * grouping work indentation alone was doing, which matters most in a narrow rail
 * where the indent step is only 22px. Semibold rather than bold — the rail's
 * section labels are semibold too, and a third weight above them made the tree
 * shout past the headers that organise it.
 */

/** Depth 1 aligns under the parent's title, clearing the parent's chevron. */
function indentOf(depth: number): string {
  return `${16 + depth * 22}px`
}

interface TreeRowProps {
  depth?: number
  /** Collapse state. Omit on a leaf — no chevron renders and the indent is unchanged. */
  expanded?: boolean
  onToggle?: () => void
  title: string
  /** Identifier lines under the title (nomenclature, NSN, LIN, serial). Falsy entries drop
   *  out rather than render blank. */
  sub?: (string | null | undefined | false)[]
  /** Bold title — the group node of a two-level list. */
  emphasis?: boolean
  /** Omit for a non-selectable row; the title block then renders inert. */
  onTap?: () => void
  /** Fills the reserved left rail and tints the row — this is the selected node. */
  active?: boolean
  /** Count or fill bar, sitting between the title block and the ellipsis. */
  trailing?: ReactNode
  /** Renders the trailing ellipsis; receives the button's own rect for menu anchoring. */
  onOpenMenu?: (rect: DOMRect) => void
  menuLabel?: string
}

export function TreeRow({
  depth = 0,
  expanded,
  onToggle,
  title,
  sub,
  emphasis,
  onTap,
  active,
  trailing,
  onOpenMenu,
  menuLabel = 'Row actions',
}: TreeRowProps) {
  const lines = (sub ?? []).filter(Boolean) as string[]
  const identity = (
    <>
      <span className={`block text-[10pt] truncate ${emphasis ? 'font-semibold text-primary' : 'text-secondary'}`}>{title}</span>
      {lines.map((line, i) => (
        <span key={i} className="block text-[9pt] text-tertiary truncate">
          {line}
        </span>
      ))}
    </>
  )
  return (
    <div
      className={`flex items-center gap-2 py-2 pr-3 border-l-2 transition-colors ${
        active ? 'border-l-themeblue3 bg-themeblue3/8' : 'border-l-transparent hover:bg-secondary/5'
      }`}
      style={{ paddingLeft: indentOf(depth) }}
    >
      {expanded != null && (
        <button
          type="button"
          onClick={onToggle}
          aria-label={expanded ? 'Collapse' : 'Expand'}
          className="p-0.5 rounded hover:bg-secondary/10 text-tertiary shrink-0"
        >
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
      )}
      {onTap ? (
        <button type="button" onClick={onTap} className="min-w-0 flex-1 text-left active:opacity-70">
          {identity}
        </button>
      ) : (
        <div className="min-w-0 flex-1">{identity}</div>
      )}
      {trailing}
      {onOpenMenu && (
        <button
          type="button"
          aria-label={menuLabel}
          onClick={(e) => {
            e.stopPropagation()
            onOpenMenu((e.currentTarget as HTMLElement).getBoundingClientRect())
          }}
          className="w-7 h-7 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all shrink-0"
        >
          <MoreHorizontal size={15} />
        </button>
      )}
    </div>
  )
}

/**
 * The numeric trailing a TreeRow carries — a fill count, a signed quantity, a shortfall.
 * `short` reddens it: a line the list only exists to flag as missing.
 */
export function TreeRowCount({ tone = 'muted', children }: { tone?: 'muted' | 'short'; children: ReactNode }) {
  return (
    <span
      className={`text-[10pt] tabular-nums shrink-0 ${tone === 'short' ? 'font-semibold text-themeredred' : 'text-tertiary'}`}
    >
      {children}
    </span>
  )
}
