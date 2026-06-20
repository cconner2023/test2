import { Reply, Forward, Trash2, MoreHorizontal, Ban, ArrowRight, ArrowLeft, Check } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Section, SectionCard } from '../Section'
import { useUserProfile } from '../../Hooks/useUserProfile'
import {
  resolveSwipeActions,
  type SwipeActions,
  type SwipeBinding,
} from '../../Utilities/swipeActions'

/**
 * Messaging-settings picker for chat-message swipe bindings — mirrors the
 * appearance-theme selection concept (selectable rows with a check) so it reads
 * the same as the rest of settings. One choice per direction.
 *
 * Persistence rides the profiles row exactly like `theme`: updateProfile patches
 * the in-memory/localStorage cache for an instant local apply, syncProfileField
 * fire-and-forget pushes swipe_actions to Supabase for cross-device sync. The
 * login fetch (useAuthStore PROFILE_SELECT) hydrates it back on a fresh device.
 */

const OPTIONS: { value: SwipeBinding; label: string; sublabel: string; icon: LucideIcon; danger?: boolean; muted?: boolean }[] = [
  { value: 'reply', label: 'Reply', sublabel: 'Quote and focus the composer', icon: Reply },
  { value: 'forward', label: 'Forward', sublabel: 'Open the forward picker', icon: Forward },
  { value: 'delete', label: 'Delete', sublabel: 'Your own messages only', icon: Trash2, danger: true },
  { value: 'menu', label: 'Ellipses (More)', sublabel: 'Lift the bubble + full menu', icon: MoreHorizontal },
  { value: 'off', label: 'Off', sublabel: 'Disable this swipe', icon: Ban, muted: true },
]

const DIRECTIONS: { key: keyof SwipeActions; label: string; hint: string; arrow: LucideIcon }[] = [
  { key: 'ltr', label: 'Swipe right', hint: 'drag left → right', arrow: ArrowRight },
  { key: 'rtl', label: 'Swipe left', hint: 'drag right → left', arrow: ArrowLeft },
]

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
      <p className="text-[9pt] text-tertiary -mt-1 mb-3">
        Choose what a one-finger swipe on a message does. Mobile only.
      </p>

      <div className="space-y-4">
        {DIRECTIONS.map(({ key, label, hint, arrow: Arrow }) => {
          const current = swipe[key]
          return (
            <div key={key}>
              <div className="flex items-center gap-1.5 mb-1.5 px-1">
                <Arrow size={14} className="text-themeblue2 shrink-0" />
                <p className="text-[10pt] font-semibold text-primary">{label}</p>
                <span className="text-[9pt] text-tertiary ml-auto">{hint}</span>
              </div>

              <SectionCard>
                <div className="divide-y divide-themeblue3/8">
                  {OPTIONS.map((opt) => {
                    const selected = current === opt.value
                    const Icon = opt.icon
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => select(key, opt.value)}
                        aria-pressed={selected}
                        className={`w-full flex items-center gap-3 py-2.5 px-3 text-left transition-colors active:bg-black/[0.04] ${
                          selected ? 'bg-themeblue2/[0.06]' : ''
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            opt.danger ? 'bg-themeredred/12' : opt.muted ? 'bg-primary/8' : 'bg-themeblue2/12'
                          }`}
                        >
                          <Icon
                            size={16}
                            className={opt.danger ? 'text-themeredred' : opt.muted ? 'text-tertiary' : 'text-themeblue2'}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm truncate ${selected ? 'font-semibold text-primary' : 'font-medium text-primary'}`}>
                            {opt.label}
                          </p>
                          <p className="text-[9pt] text-tertiary truncate">{opt.sublabel}</p>
                        </div>
                        {selected && (
                          <div className="w-5 h-5 rounded-full bg-themeblue2 flex items-center justify-center shrink-0">
                            <Check size={12} className="text-white" strokeWidth={3} />
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </SectionCard>
            </div>
          )
        })}
      </div>
    </Section>
  )
}
