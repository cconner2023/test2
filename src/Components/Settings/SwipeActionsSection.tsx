import { Reply, Forward, Ban, MoreHorizontal, Trash2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Section, SectionCard } from '@/Components/primitives/Section'
import { OverlayActionMenu } from '@/Components/primitives/OverlayActionMenu'
import type { ContextMenuItem } from '@/Components/primitives/ContextMenu'
import { useUserProfile } from '../../Hooks/useUserProfile'
import {
  resolveSwipeActions,
  type SwipeActions,
  type SwipeBinding,
} from '../../Utilities/swipeActions'

/**
 * Messaging-settings picker for chat-message swipe bindings — Outlook-mobile
 * style. Each direction shows the CURRENT action plus a small live example of
 * the reveal (coloured panel + icon on the swipe side); the corner action
 * primitive (OverlayActionMenu — overlay ActionPill + AnchoredMenu) collapses to
 * an ellipsis riding the card's top edge and opens the list to pick a new one.
 *
 * Each selectable action is single-use across the two directions: an action
 * already bound to one direction is dropped from the OTHER direction's menu, so
 * 'More' (or reply/forward) never appears twice. `off` is the exception — both
 * directions may be off. The current binding is always offered for its own
 * direction so it can render as selected.
 *
 * The card itself is generic (`SwipeBindingPicker`) — Tracking Board reuses it
 * with its own pool/display. Messaging persistence rides the profiles row exactly like `theme`: updateProfile patches
 * the in-memory/localStorage cache for an instant local apply, syncProfileField
 * fire-and-forget pushes swipe_actions to Supabase for cross-device sync.
 */

/** How a binding renders in the picker (and, for consumers, in the swipe reveal). */
export interface SwipeBindingDisplay {
  label: string
  icon: LucideIcon
  /** Tailwind bg class for the revealed example panel. `null` = no panel (off). */
  panel: string | null
}

/** Any two-direction binding pair (messaging's SwipeActions, tracking's, …). */
export interface SwipePair<B extends string> {
  ltr: B
  rtl: B
}

// The pool offered by the messaging picker. Single-use actions (reply / forward /
// delete / menu) dedupe across directions; `off` is multi-use. `delete` is
// per-message gated downstream — MessageBubble resolves it to `off` on messages
// the user can't delete (non-own), so binding it here is always safe.
const POOL: SwipeBinding[] = ['reply', 'forward', 'delete', 'menu', 'off']

const DISPLAY: Record<SwipeBinding, SwipeBindingDisplay> = {
  reply: { label: 'Reply', icon: Reply, panel: 'bg-themeblue2' },
  forward: { label: 'Forward', icon: Forward, panel: 'bg-themeblue1' },
  menu: { label: 'More', icon: MoreHorizontal, panel: 'bg-themeblue3' },
  off: { label: 'None', icon: Ban, panel: null },
  delete: { label: 'Delete', icon: Trash2, panel: 'bg-themeredred' },
}

const DIRECTIONS: { key: 'ltr' | 'rtl'; label: string; side: 'left' | 'right' }[] = [
  // ltr = "swipe right" → reveal sits on the LEFT; rtl = "swipe left" → RIGHT.
  { key: 'ltr', label: 'Swipe right', side: 'left' },
  { key: 'rtl', label: 'Swipe left', side: 'right' },
]

/** Outlook-style example: a row with the revealed action panel on `side`. */
function ExampleRow({ d, side }: { d: SwipeBindingDisplay; side: 'left' | 'right' }) {
  const Icon = d.icon
  const panel = d.panel && (
    <div className={`w-12 flex items-center justify-center ${d.panel}`}>
      <Icon size={16} className="text-white" />
    </div>
  )
  return (
    <div className={`flex items-stretch h-11 rounded-lg overflow-hidden border border-themeblue3/10 ${d.panel ? '' : 'opacity-50'}`}>
      {side === 'left' && panel}
      <div className="flex-1 flex items-center gap-2 px-3 bg-themewhite">
        <div className="w-6 h-6 rounded-full bg-tertiary/15 shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-1.5 w-1/3 rounded-full bg-tertiary/25" />
          <div className="h-1.5 w-2/3 rounded-full bg-tertiary/12" />
        </div>
      </div>
      {side === 'right' && panel}
    </div>
  )
}

interface DirectionRowProps<B extends string> {
  dir: 'ltr' | 'rtl'
  label: string
  side: 'left' | 'right'
  value: SwipePair<B>
  pool: readonly B[]
  display: Record<B, SwipeBindingDisplay>
  off: B
  onSelect: (dir: 'ltr' | 'rtl', value: B) => void
}

function DirectionRow<B extends string>({ dir, label, side, value, pool, display, off, onSelect }: DirectionRowProps<B>) {
  const current = value[dir]
  const d = display[current] ?? display[off]
  const other = dir === 'ltr' ? 'rtl' : 'ltr'

  // Available actions: anything not already used by the other direction, plus
  // `off` (multi-use) and the current binding itself (so it shows as selected).
  const items: ContextMenuItem[] = pool
    .filter((b) => b === off || b === current || value[other] !== b)
    .map((b) => ({
      key: b,
      label: display[b].label,
      icon: display[b].icon,
      selected: current === b,
      onAction: () => onSelect(dir, b),
    }))

  return (
    // SectionCard clips (overflow-hidden), so the overlay pill rides a sibling
    // under a relative wrapper or its top half is cut off.
    <div className="relative">
      <SectionCard className="p-3">
        <div className="mb-2.5 min-w-0">
          <p className="text-sm font-medium text-primary">{label}</p>
          <p className="text-[9pt] text-tertiary">{d.label}</p>
        </div>
        <ExampleRow d={d} side={side} />
      </SectionCard>

      <OverlayActionMenu items={items} />
    </div>
  )
}

/**
 * Generic two-direction swipe-binding picker — the Messaging settings card,
 * parameterized by pool/display so other surfaces (Tracking Board) reuse it.
 * `off` names the multi-use "None" binding. Caller owns persistence.
 */
export function SwipeBindingPicker<B extends string>({ value, pool, display, off, onChange, title = 'Swipe actions' }: {
  value: SwipePair<B>
  pool: readonly B[]
  display: Record<B, SwipeBindingDisplay>
  off: B
  onChange: (next: SwipePair<B>) => void
  title?: string
}) {
  const select = (dir: 'ltr' | 'rtl', b: B) => {
    if (value[dir] === b) return
    onChange({ ...value, [dir]: b })
  }
  return (
    <Section title={title} className="">
      <div className="space-y-3">
        {DIRECTIONS.map(({ key, label, side }) => (
          <DirectionRow
            key={key}
            dir={key}
            label={label}
            side={side}
            value={value}
            pool={pool}
            display={display}
            off={off}
            onSelect={select}
          />
        ))}
      </div>
    </Section>
  )
}

export function SwipeActionsSection() {
  const { profile, updateProfile, syncProfileField } = useUserProfile()
  const swipe = resolveSwipeActions(profile?.swipeActions)

  const change = (next: SwipeActions) => {
    updateProfile({ swipeActions: next })   // instant local (memory + localStorage)
    syncProfileField({ swipe_actions: next }) // cross-device push
  }

  return <SwipeBindingPicker value={swipe} pool={POOL} display={DISPLAY} off="off" onChange={change} />
}
