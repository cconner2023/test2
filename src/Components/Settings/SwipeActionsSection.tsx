import { Reply, Forward, Ban, MoreHorizontal, Trash2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Section } from '../Section'
import { OverlayActionMenu } from '../OverlayActionMenu'
import type { ContextMenuItem } from '../ContextMenu'
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
 * Persistence rides the profiles row exactly like `theme`: updateProfile patches
 * the in-memory/localStorage cache for an instant local apply, syncProfileField
 * fire-and-forget pushes swipe_actions to Supabase for cross-device sync.
 */

interface Display {
  label: string
  icon: LucideIcon
  /** Tailwind bg class for the revealed example panel. `null` = no panel (off). */
  panel: string | null
}

// The pool offered by the picker. Single-use actions (reply / forward / delete /
// menu) dedupe across directions; `off` is multi-use. `delete` is per-message
// gated downstream — MessageBubble resolves it to `off` on messages the user
// can't delete (non-own), so binding it here is always safe.
const POOL: SwipeBinding[] = ['reply', 'forward', 'delete', 'menu', 'off']

const DISPLAY: Record<SwipeBinding, Display> = {
  reply: { label: 'Reply', icon: Reply, panel: 'bg-themeblue2' },
  forward: { label: 'Forward', icon: Forward, panel: 'bg-themeblue1' },
  menu: { label: 'More', icon: MoreHorizontal, panel: 'bg-themeblue3' },
  off: { label: 'None', icon: Ban, panel: null },
  delete: { label: 'Delete', icon: Trash2, panel: 'bg-themeredred' },
}

const DIRECTIONS: { key: keyof SwipeActions; label: string; side: 'left' | 'right' }[] = [
  // ltr = "swipe right" → reveal sits on the LEFT; rtl = "swipe left" → RIGHT.
  { key: 'ltr', label: 'Swipe right', side: 'left' },
  { key: 'rtl', label: 'Swipe left', side: 'right' },
]

/** Outlook-style example: a message row with the revealed action panel on `side`. */
function ExampleRow({ binding, side }: { binding: SwipeBinding; side: 'left' | 'right' }) {
  const d = DISPLAY[binding] ?? DISPLAY.off
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

interface DirectionRowProps {
  dir: keyof SwipeActions
  label: string
  side: 'left' | 'right'
  swipe: SwipeActions
  onSelect: (dir: keyof SwipeActions, value: SwipeBinding) => void
}

function DirectionRow({ dir, label, side, swipe, onSelect }: DirectionRowProps) {
  const current = swipe[dir]
  const d = DISPLAY[current] ?? DISPLAY.off
  const other: keyof SwipeActions = dir === 'ltr' ? 'rtl' : 'ltr'

  // Available actions: anything not already used by the other direction, plus
  // `off` (multi-use) and the current binding itself (so it shows as selected).
  const items: ContextMenuItem[] = POOL
    .filter((b) => b === 'off' || b === current || swipe[other] !== b)
    .map((b) => ({
      key: b,
      label: DISPLAY[b].label,
      icon: DISPLAY[b].icon,
      selected: current === b,
      onAction: () => onSelect(dir, b),
    }))

  return (
    <div className="relative rounded-2xl bg-themewhite2 p-3">
      <div className="mb-2.5 min-w-0">
        <p className="text-sm font-medium text-primary">{label}</p>
        <p className="text-[9pt] text-tertiary">{d.label}</p>
      </div>
      <ExampleRow binding={current} side={side} />

      <OverlayActionMenu items={items} />
    </div>
  )
}

export function SwipeActionsSection() {
  const { profile, updateProfile, syncProfileField } = useUserProfile()
  const swipe = resolveSwipeActions(profile?.swipeActions)

  const select = (dir: keyof SwipeActions, value: SwipeBinding) => {
    if (swipe[dir] === value) return
    const next: SwipeActions = { ...swipe, [dir]: value }
    updateProfile({ swipeActions: next })   // instant local (memory + localStorage)
    syncProfileField({ swipe_actions: next }) // cross-device push
  }

  return (
    <Section title="Swipe actions" className="">
      <div className="space-y-3">
        {DIRECTIONS.map(({ key, label, side }) => (
          <DirectionRow
            key={key}
            dir={key}
            label={label}
            side={side}
            swipe={swipe}
            onSelect={select}
          />
        ))}
      </div>
    </Section>
  )
}
