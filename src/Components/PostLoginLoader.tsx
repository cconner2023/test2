import { useEffect, useState } from 'react'
import { HudLoader } from '@/Components/primitives/HudLoader'

/**
 * Full-screen loading overlay shown during first-time login while
 * profile data is fetched. Signal init continues in the background
 * after this dismisses. Matches the HTML splash screen aesthetic.
 *
 * Returning users never see this — sessionReady starts true for them.
 */
export function PostLoginLoader({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const [opacity, setOpacity] = useState(1)

  useEffect(() => {
    if (ready) {
      setOpacity(0)
      const id = setTimeout(onDone, 500)
      return () => clearTimeout(id)
    }
  }, [ready, onDone])

  return (
    <div
      className="fixed inset-0 z-[9998] flex flex-col items-center justify-center bg-themewhite2"
      style={{ opacity, transition: 'opacity 0.5s ease-out', pointerEvents: opacity === 0 ? 'none' : 'auto' }}
    >
      <HudLoader size={120} />

      <div className="mt-4 font-semibold text-lg tracking-widest text-primary" />

      <div className="mt-3.5 w-[140px] h-[3px] rounded-sm overflow-hidden bg-themeblue3/10 dark:bg-themeblue3/25">
        <div
          className="h-full w-[30%] rounded-sm bg-themeblue2"
          style={{ animation: 'splashPulse 1.2s ease-in-out infinite' }}
        />
      </div>

      <div className="mt-6 text-sm text-secondary">
        Loading profile…
      </div>
    </div>
  )
}
