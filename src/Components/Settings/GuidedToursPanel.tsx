import { Check, Play, RotateCcw } from 'lucide-react'
import { useTourContext } from '../Tour/TourProvider'

export function GuidedToursPanel({ onClose }: { onClose: () => void }) {
  const tour = useTourContext()

  if (!tour) return null

  const { availableTours, isCompleted, startTour, resetAllTours } = tour

  // Group by tier
  const tiers: { label: string; key: string }[] = [
    { label: 'Basics', key: 'medic' },
    { label: 'Supervisor', key: 'supervisor' },
    { label: 'Provider', key: 'provider' },
  ]

  const handleStart = (tourId: string) => {
    const tourDef = availableTours.find(t => t.id === tourId)
    if (tourDef?.scene) {
      // Scene tours render their own mock overlay — no need to close Settings
      startTour(tourId)
    } else {
      onClose()
      // Small delay so the Settings drawer closes before tour starts
      setTimeout(() => startTour(tourId), 400)
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-5 py-4 space-y-5">
        <p className="text-sm text-tertiary/70">
          Interactive walkthroughs that highlight features and auto-play through each step. Tap any tour to start.
        </p>

        {tiers.map(tier => {
          const tours = availableTours.filter(t => t.tier === tier.key)
          if (tours.length === 0) return null

          return (
            <div key={tier.key}>
              <p className="text-[9pt] font-semibold text-primary/80 uppercase tracking-wider mb-2">
                {tier.label}
              </p>
              <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
                {tours.map(t => {
                  const completed = isCompleted(t.id)
                  return (
                    <button
                      key={t.id}
                      onClick={() => handleStart(t.id)}
                      className="flex items-center gap-3 w-full px-4 py-3.5 transition-all active:scale-95 hover:bg-themeblue2/5"
                    >
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                        completed ? 'bg-themegreen/10' : 'bg-tertiary/10'
                      }`}>
                        {completed ? (
                          <Check size={18} className="text-themegreen" />
                        ) : (
                          <Play size={16} className="text-tertiary/60 ml-0.5" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-medium text-primary">{t.name}</p>
                        <p className="text-[11px] text-tertiary/70 mt-0.5">{t.description}</p>
                      </div>
                      <span className="text-[11px] text-tertiary/40 font-medium shrink-0">
                        {t.steps.length} steps
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}

        <button
          onClick={resetAllTours}
          className="flex items-center justify-center gap-2 w-full py-3 text-sm text-tertiary/50 hover:text-tertiary/70 active:scale-95 transition-all"
        >
          <RotateCcw size={14} />
          <span>Reset all tours</span>
        </button>
      </div>
    </div>
  )
}
