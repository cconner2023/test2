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
 * still in limbo. Rendered through TopBanner.
 */

import { useEffect, useState } from 'react'
import { Compass } from 'lucide-react'
import { TopBanner } from './primitives/TopBanner'
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

  const handleDismiss = () => {
    setVisible(false)
    setDismissed(true)
    try { sessionStorage.setItem(DISMISS_KEY, '1') } catch { /* private mode — ephemeral is fine */ }
  }

  return (
    <TopBanner
      item={inLimbo && visible ? true : null}
      tone="info"
      icon={Compass}
      zIndex={78}
      onDismiss={handleDismiss}
      title={() => 'Between assignments'}
      body={() => "You're not in a cluster right now. Your gaining unit's supervisor will add you — then your calendar, roster, and cluster messages come back."}
    />
  )
}
