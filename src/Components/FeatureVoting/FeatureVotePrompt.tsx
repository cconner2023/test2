/**
 * FeatureVotePrompt — non-blocking login-time toast.
 *
 * Appears after auth + profile ready when there's an open voting cycle and
 * the user hasn't voted yet. Dismissable per-cycle via sessionStorage.
 *
 * Tapping "Vote now" opens Settings directly to the Feature Votes panel.
 */

import { useEffect, useState } from 'react'
import { MessageCircleQuestion, X } from 'lucide-react'
import { useAuthStore } from '../../stores/useAuthStore'
import { useFeatureVotesStore, selectShouldShowPrompt } from '../../stores/useFeatureVotesStore'

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

  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)

  // Hydrate once the user is ready
  useEffect(() => {
    if (!userId || !sessionReady || isGuest) return
    hydrate(userId)
  }, [userId, sessionReady, isGuest, hydrate])

  // Delay showing slightly so it doesn't pop in during the login animation
  useEffect(() => {
    if (!shouldShow) {
      setVisible(false)
      const t = setTimeout(() => setMounted(false), 250)
      return () => clearTimeout(t)
    }
    setMounted(true)
    const t = setTimeout(() => setVisible(true), 1200)
    return () => clearTimeout(t)
  }, [shouldShow])

  if (!mounted || !activeCycle) return null

  const handleDismiss = () => {
    setVisible(false)
    dismissPromptForCycle(activeCycle.id)
  }

  const handleVote = () => {
    setVisible(false)
    dismissPromptForCycle(activeCycle.id)
    onOpenPanel()
  }

  return (
    <div
      className={`fixed left-1/2 -translate-x-1/2 z-[80] transition-all duration-300 ease-out
        bottom-[max(1rem,calc(var(--sab,0px)+1rem))]
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}
      `}
      role="dialog"
      aria-live="polite"
    >
      <div className="mx-4 max-w-md bg-themewhite/95 backdrop-blur-md rounded-2xl shadow-lg border border-tertiary/15 overflow-hidden">
        <div className="flex items-start gap-3 p-4">
          <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-themeblue2/15">
            <MessageCircleQuestion size={18} className="text-themeblue2" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-primary">{activeCycle.title}</p>
            <p className="text-[9pt] text-tertiary mt-0.5">
              {activeCycle.description || 'Help shape what comes next — your vote matters.'}
            </p>
            <div className="flex items-center gap-2 mt-3">
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
            </div>
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
