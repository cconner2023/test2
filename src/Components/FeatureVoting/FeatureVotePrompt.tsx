/**
 * FeatureVotePrompt — non-blocking login-time toast.
 *
 * Appears after auth + profile ready when there's an open voting cycle and
 * the user hasn't voted yet. Dismissable per-cycle via sessionStorage.
 *
 * Tapping "Vote now" opens Settings directly to the Feature Votes panel.
 */

import { useEffect, useState } from 'react'
import { MessageCircleQuestion } from 'lucide-react'
import { useAuthStore } from '../../stores/useAuthStore'
import { useFeatureVotesStore, selectShouldShowPrompt } from '../../stores/useFeatureVotesStore'
import { TopBanner } from '../primitives/TopBanner'

interface Props {
  onOpenPanel: () => void
}

export function FeatureVotePrompt({ onOpenPanel }: Props) {
  const userId = useAuthStore((s) => s.user?.id)
  const sessionReady = useAuthStore((s) => s.sessionReady)
  const isGuest = useAuthStore((s) => s.isGuest)

  const activeCycle = useFeatureVotesStore((s) => s.activeCycle)
  const shouldShow = useFeatureVotesStore(selectShouldShowPrompt)
  const dismissPromptForCycle = useFeatureVotesStore((s) => s.dismissPromptForCycle)
  const hydrate = useFeatureVotesStore((s) => s.hydrate)

  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!userId || !sessionReady || isGuest) return
    hydrate(userId)
  }, [userId, sessionReady, isGuest, hydrate])

  // Delay so it doesn't pop in during the login animation
  useEffect(() => {
    if (!shouldShow) { setVisible(false); return }
    const t = setTimeout(() => setVisible(true), 1200)
    return () => clearTimeout(t)
  }, [shouldShow])

  const cycle = visible && shouldShow ? activeCycle : null

  const handleDismiss = () => {
    setVisible(false)
    if (activeCycle) dismissPromptForCycle(activeCycle.id)
  }

  const handleVote = () => {
    handleDismiss()
    onOpenPanel()
  }

  return (
    <TopBanner
      item={cycle}
      tone="info"
      icon={MessageCircleQuestion}
      zIndex={78}
      onDismiss={handleDismiss}
      title={(c) => c.title}
      body={(c) => c.description || 'Help shape what comes next — your vote matters.'}
      actions={() => (
        <>
          <button
            onClick={handleVote}
            className="px-3 py-1.5 rounded-xl text-[9pt] font-semibold text-white bg-themeblue3 active:scale-95 transition-all"
          >
            Vote now
          </button>
          <button
            onClick={handleDismiss}
            className="px-3 py-1.5 rounded-xl text-[9pt] font-medium text-tertiary active:scale-95 transition-all"
          >
            Later
          </button>
        </>
      )}
    />
  )
}
