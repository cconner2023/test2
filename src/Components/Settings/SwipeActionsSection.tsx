import { useState } from 'react'
import { Reply, Forward, Ban, Check } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Section } from '../Section'
import { PreviewOverlay } from '../PreviewOverlay'
import { useUserProfile } from '../../Hooks/useUserProfile'
import {
  resolveSwipeActions,
  type SwipeActions,
  type SwipeBinding,
} from '../../Utilities/swipeActions'

/**
 * Messaging-settings picker for chat-message swipe bindings — Outlook-mobile
 * style. Each direction shows the CURRENT action plus a small live example of
 * the reveal (coloured panel + icon on the swipe side); tapping "Change" opens a
 * PreviewOverlay anchored to the row to pick a new one. Kept deliberately simple:
 * only reply / forward / off are selectable.
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

// What the picker exposes — simple immediate actions only. Legacy delete/menu
// bindings still resolve in the model but are no longer offered here.
const OPTIONS: SwipeBinding[] = ['reply', 'forward', 'off']

const DISPLAY: Record<SwipeBinding, Display> = {
  reply: { label: 'Reply', icon: Reply, panel: 'bg-themeblue2' },
  forward: { label: 'Forward', icon: Forward, panel: 'bg-themeblue1' },
  off: { label: 'None', icon: Ban, panel: null },
  // legacy values — shown if a user persisted them before the simplification
  delete: { label: 'Delete', icon: Ban, panel: 'bg-themeredred' },
  menu: { label: 'More', icon: Ban, panel: 'bg-themeblue3' },
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

export function SwipeActionsSection() {
  const { profile, updateProfile, syncProfileField } = useUserProfile()
  const swipe = resolveSwipeActions(profile?.swipeActions)

  const [picking, setPicking] = useState<keyof SwipeActions | null>(null)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)

  const openPicker = (dir: keyof SwipeActions, e: React.MouseEvent) => {
    setAnchorRect(e.currentTarget.getBoundingClientRect())
    setPicking(dir)
  }

  const select = (dir: keyof SwipeActions, value: SwipeBinding) => {
    setPicking(null)
    if (swipe[dir] === value) return
    const next: SwipeActions = { ...swipe, [dir]: value }
    updateProfile({ swipeActions: next })   // instant local (memory + localStorage)
    syncProfileField({ swipe_actions: next }) // cross-device push
  }

  return (
    <Section title="Swipe actions" className="">
      <div className="space-y-3">
        {DIRECTIONS.map(({ key, label, side }) => {
          const current = swipe[key]
          const d = DISPLAY[current] ?? DISPLAY.off
          return (
            <div key={key} className="rounded-2xl border border-themeblue3/10 bg-themewhite2 p-3">
              <div className="flex items-center justify-between mb-2.5">
                <div className="min-w-0">
                  <p className="text-[11pt] font-semibold text-primary leading-tight">{label}</p>
                  <p className="text-[9pt] text-tertiary">{d.label}</p>
                </div>
                <button
                  type="button"
                  onClick={(e) => openPicker(key, e)}
                  className="text-[9pt] font-semibold text-themeblue2 uppercase tracking-wide px-2 py-1 rounded-md active:scale-95 transition-transform shrink-0"
                >
                  Change
                </button>
              </div>
              <ExampleRow binding={current} side={side} />
            </div>
          )
        })}
      </div>

      <PreviewOverlay
        isOpen={picking !== null}
        onClose={() => setPicking(null)}
        anchorRect={anchorRect}
        anchored
        title={picking === 'ltr' ? 'Swipe right' : 'Swipe left'}
        maxWidth={260}
      >
        <div className="py-1">
          {OPTIONS.map((value) => {
            const d = DISPLAY[value]
            const Icon = d.icon
            const selected = picking !== null && swipe[picking] === value
            return (
              <button
                key={value}
                type="button"
                onClick={() => picking && select(picking, value)}
                aria-pressed={selected}
                className={`w-full flex items-center gap-3 py-2.5 px-4 text-left transition-colors active:bg-black/[0.04] ${
                  selected ? 'bg-themeblue2/[0.06]' : ''
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    value === 'off' ? 'bg-primary/8' : 'bg-themeblue2/12'
                  }`}
                >
                  <Icon size={16} className={value === 'off' ? 'text-tertiary' : 'text-themeblue2'} />
                </div>
                <p className={`flex-1 text-sm ${selected ? 'font-semibold text-primary' : 'font-medium text-primary'}`}>
                  {d.label}
                </p>
                {selected && (
                  <div className="w-5 h-5 rounded-full bg-themeblue2 flex items-center justify-center shrink-0">
                    <Check size={12} className="text-white" strokeWidth={3} />
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </PreviewOverlay>
    </Section>
  )
}
