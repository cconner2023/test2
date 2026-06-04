/**
 * Themed emoji reaction glyphs.
 *
 * Reactions ship over the wire as opaque codes (see ReactionContent in
 * src/lib/signal/messageContent.ts); this UI layer is the ONLY place that
 * resolves a code to a glyph. Glyphs are hand-authored filled SVGs drawn with
 * `fill="currentColor"`, so each one is tinted by a theme color token — the
 * palette tracks the active theme instead of baking in fixed emoji colors.
 */

import type { ReactNode } from 'react'

export type ReactionCode = 'up' | 'down' | 'heart' | 'skull' | 'bang'

/** Canonical picker order. */
export const REACTION_CODES: ReactionCode[] = ['up', 'down', 'heart', 'skull', 'bang']

export const REACTION_LABELS: Record<ReactionCode, string> = {
  up: 'Thumbs up',
  down: 'Thumbs down',
  heart: 'Heart',
  skull: 'Skull',
  bang: 'Exclamation',
}

/** Theme color class per glyph — `currentColor` inside the SVG inherits this. */
const REACTION_COLOR: Record<ReactionCode, string> = {
  up: 'text-themegreen',
  down: 'text-tertiary',
  heart: 'text-themeredred',
  skull: 'text-primary',
  bang: 'text-themeyellow',
}

/** Filled 24×24 paths. skull uses even-odd so the eye sockets punch through. */
const REACTION_PATH: Record<ReactionCode, string> = {
  up: 'M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z',
  down: 'M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z',
  heart: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
  skull: 'M12 2C7.6 2 4 5.4 4 9.8c0 2.5 1.2 4.4 3 5.7V18c0 1.1.9 2 2 2h.5v-2.2c0-.3.2-.5.5-.5s.5.2.5.5V20h2v-2.2c0-.3.2-.5.5-.5s.5.2.5.5V20H16c1.1 0 2-.9 2-2v-2.5c1.8-1.3 3-3.2 3-5.7C21 5.4 17.4 2 12 2zM8.8 12.3c-1 0-1.8-.8-1.8-1.8s.8-1.8 1.8-1.8 1.8.8 1.8 1.8-.8 1.8-1.8 1.8zm6.4 0c-1 0-1.8-.8-1.8-1.8s.8-1.8 1.8-1.8 1.8.8 1.8 1.8-.8 1.8-1.8 1.8z',
  bang: 'M10.2 3h3.6l-.6 11h-2.4l-.6-11zM12 17.2a1.9 1.9 0 1 1 0 3.8 1.9 1.9 0 0 1 0-3.8z',
}

export function isReactionCode(s: string): s is ReactionCode {
  return (REACTION_CODES as string[]).includes(s)
}

export function ReactionGlyph({ code, size = 18, className = '' }: { code: ReactionCode; size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden
      className={`${REACTION_COLOR[code]} ${className}`}
    >
      <path fillRule="evenodd" clipRule="evenodd" d={REACTION_PATH[code]} />
    </svg>
  )
}

/** True when a reactions map has at least one reactor on a known code. */
export function hasReactions(reactions: Record<string, string[]> | undefined): boolean {
  if (!reactions) return false
  return REACTION_CODES.some(c => (reactions[c]?.length ?? 0) > 0)
}

/**
 * Circular reaction badges that straddle a message bubble's bottom corner.
 * Each active emoji is a round (or lozenge, when a count is shown) badge;
 * badges the current user authored get a theme ring. Tapping one toggles the
 * current user's own reaction. Positioned absolutely — the parent bubble must
 * be `relative` and reserve a little extra bottom room for the overlap.
 */
export function ReactionChips({
  reactions,
  myUserId,
  align = 'left',
  onToggle,
}: {
  reactions: Record<string, string[]> | undefined
  myUserId?: string
  align?: 'left' | 'right'
  onToggle?: (code: ReactionCode) => void
}): ReactNode {
  if (!reactions) return null
  const active = REACTION_CODES.filter(c => (reactions[c]?.length ?? 0) > 0)
  if (active.length === 0) return null

  return (
    <div className={`absolute -bottom-3 z-[2] flex items-center gap-1 ${align === 'right' ? 'right-2' : 'left-2'}`}>
      {active.map(code => {
        const ids = reactions[code] ?? []
        const count = ids.length
        const mine = !!myUserId && ids.includes(myUserId)
        return (
          <button
            key={code}
            onClick={e => { e.stopPropagation(); onToggle?.(code) }}
            aria-label={`${REACTION_LABELS[code]}${count > 1 ? ` (${count})` : ''}`}
            className={`flex items-center justify-center gap-0.5 h-6 rounded-full bg-themewhite shadow-md active:scale-95 transition-all
                       ${count > 1 ? 'px-1.5 min-w-[1.5rem]' : 'w-6'}
                       ring-1 ${mine ? 'ring-themeblue3' : 'ring-black/5'}`}
          >
            <ReactionGlyph code={code} size={14} />
            {count > 1 && (
              <span className="text-[8pt] font-semibold tabular-nums text-tertiary">{count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
