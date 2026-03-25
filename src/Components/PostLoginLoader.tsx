import { useEffect, useState } from 'react'

/**
 * Full-screen loading overlay shown during first-time login while
 * Signal Protocol keys and profile data are fetched. Matches the
 * HTML splash screen aesthetic (reuses its CSS keyframes from index.html).
 *
 * Returning users never see this — sessionReady starts true for them.
 */
export function PostLoginLoader({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const [opacity, setOpacity] = useState(1)
  const [isDark] = useState(() => {
    try {
      const t = localStorage.getItem('theme')
      if (t === 'dark') return true
      if (t === 'light') return false
      return window.matchMedia('(prefers-color-scheme:dark)').matches
    } catch { return false }
  })

  useEffect(() => {
    if (ready) {
      setOpacity(0)
      const id = setTimeout(onDone, 500)
      return () => clearTimeout(id)
    }
  }, [ready, onDone])

  const bg = isDark ? 'rgba(25,35,45,1)' : 'rgba(240,242,245,1)'
  const textColor = isDark ? 'rgba(129,161,181,1)' : 'rgba(0,66,92,1)'
  const subtextColor = isDark ? 'rgba(129,161,181,0.6)' : 'rgba(0,66,92,0.6)'
  const trackBg = isDark ? 'rgba(0,66,92,0.25)' : 'rgba(0,66,92,0.1)'

  return (
    <div
      className="fixed inset-0 z-[9998] flex flex-col items-center justify-center"
      style={{ opacity, transition: 'opacity 0.5s ease-out', pointerEvents: opacity === 0 ? 'none' : 'auto', background: bg }}
    >
      <svg className="w-16 h-16" viewBox="0 0 40 40" fill="none" style={{ animation: 'solSpin 2s linear infinite' }}>
        <g transform="translate(20,20)">
          <rect x="-3" y="-11" width="6" height="22" rx="1.5" fill={textColor} />
          <rect x="-3" y="-11" width="6" height="22" rx="1.5" fill={textColor} transform="rotate(60)" />
          <rect x="-3" y="-11" width="6" height="22" rx="1.5" fill={textColor} transform="rotate(120)" />
        </g>
      </svg>

      <div
        className="mt-4 font-semibold text-lg tracking-widest"
        style={{ fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", color: textColor }}
      >
      </div>

      <div className="mt-3.5 w-[140px] h-[3px] rounded-sm overflow-hidden" style={{ background: trackBg }}>
        <div
          className="h-full w-[30%] rounded-sm"
          style={{ background: 'rgba(21,142,172,1)', animation: 'splashPulse 1.2s ease-in-out infinite' }}
        />
      </div>

      <div
        className="mt-6 text-sm"
        style={{ fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", color: subtextColor }}
      >
        Establishing secure session…
      </div>
    </div>
  )
}
