/**
 * BetweenAssignmentsBanner — non-blocking "you're between clusters" awareness (#4).
 *
 * When a supervisor PCS-abandons a soldier (or they self-leave, see the Settings
 * Leave-Cluster flow), they land in ZERO clusters. The app still works — triage,
 * navigation, personal messages, and personal property are all intact — but the
 * clinic-scoped surfaces (calendar, roster, clinic messages, cluster property) go
 * empty. Without a signal that reads as "expected, not broken."
 *
 * This is that signal: a dismissable banner, never a modal (medics muscle-dismiss
 * blocking prompts under time pressure — see the non-blocking UX rule). There is no
 * self-join yet — re-entry is the gaining unit's supervisor pulling them in, which
 * clears clinicId and hides this automatically.
 *
 * Shows only when the user has NO reachable cluster at all (no home clinic AND no
 * active loan). Dismissable per session (sessionStorage); reappears next load while
 * still in limbo. Mirrors FeatureVotePrompt's toast shape/timing.
 */

import { useEffect, useState } from 'react'
import { Compass, X } from 'lucide-react'
import { useAuthStore } from '../stores/useAuthStore'

const DISMISS_KEY = 'beacon_between_assignments_dismissed'

export function BetweenAssignmentsBanner() {
  const userId = useAuthStore((s) => s.user?.id)
  const sessionReady = useAuthStore((s) => s.sessionReady)
  const isGuest = useAuthStore((s) => s.isGuest)
  const clinicId = useAuthStore((s) => s.clinicId)
  const surrogateCount = useAuthStore((s) => s.surrogateClinicIds.length)

  // In limbo only when there is no reachable cluster at all — a loaned-in medic
  // (surrogate set) still has a working clinic context, so it's not limbo.
  const inLimbo = !!userId && sessionReady && !isGuest && !clinicId && surrogateCount === 0

  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(DISMISS_KEY) === '1' } catch { return false }
  })
  const [visible, setVisible] = useState(false)

  const shouldShow = inLimbo && !dismissed

  // Delay slightly so it doesn't pop in during the login / transfer animation.
  useEffect(() => {
    if (!shouldShow) {
      setVisible(false)
      return
    }
    const t = setTimeout(() => setVisible(true), 1200)
    return () => clearTimeout(t)
  }, [shouldShow])

  if (!inLimbo) return null

  const handleDismiss = () => {
    setVisible(false)
    setDismissed(true)
    try { sessionStorage.setItem(DISMISS_KEY, '1') } catch { /* private mode — ephemeral is fine */ }
  }

  return (
    <div
      className={`fixed left-0 right-0 z-[80] px-4 transition-all duration-300 ease-out
        bottom-[max(1rem,calc(var(--sab,0px)+1rem))]
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}
      `}
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto max-w-md bg-themewhite/95 backdrop-blur-md rounded-2xl shadow-lg border border-tertiary/15 overflow-hidden">
        <div className="flex items-start gap-3 p-4">
          <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-themeblue2/15">
            <Compass size={18} className="text-themeblue2" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-primary">Between assignments</p>
            <p className="text-[9pt] text-tertiary mt-0.5">
              You're not in a cluster right now. Your gaining unit's supervisor will add
              you — then your calendar, roster, and cluster messages come back.
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-tertiary hover:bg-tertiary/10 active:scale-95 transition-all"
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
