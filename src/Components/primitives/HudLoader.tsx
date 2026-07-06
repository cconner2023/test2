import { useId } from 'react'
import { HUD_GROUPS, HUD_SWEEPS, STAR_SCALE, HUD_STYLE } from '../lib/hudGeometry'

/**
 * Sci-fi HUD loading animation — animated-SVG loader derived from the
 * "_ideas/HUD loader" comps. Pure strokes + transforms so it stays crisp at any
 * DPI, themeable, and cheap on iOS Safari (we animate only rotate / opacity —
 * never blur filters).
 *
 * Composition: scattered short arc segments at varying radii (no full/continuous
 * rings) spinning at independent speeds, overlapping curved sweep bands, and the
 * Star of Life primitive (copied from LoadingSpinner) at center. Colors use the
 * theme primitives (themeblue1/2/3) so it tracks the active theme.
 *
 * Geometry lives in src/lib/hudGeometry.ts — the SAME source the Vite plugin
 * uses to bake the pre-React splash, so the two never drift. Edit shapes there.
 */

export function HudLoader({ size = 240, className = '' }: { size?: number; className?: string }) {
  const uid = useId().replace(/[:]/g, '')
  const k = (n: string) => `hud-${n}-${uid}`
  const spin = (dir: number, dur: number) => ({
    transformOrigin: '100px 100px',
    animation: `${k(dir === 1 ? 'cw' : 'ccw')} ${dur}s linear infinite`,
  })

  return (
    <div
      className={`text-themeblue2 ${className}`}
      style={{ width: size, height: size, position: 'relative' }}
    >
      <style>{`
        @keyframes ${k('cw')}    { to { transform: rotate(360deg); } }
        @keyframes ${k('ccw')}   { to { transform: rotate(-360deg); } }
        @keyframes ${k('pulse')} { 0%,100% { opacity:.4 } 50% { opacity:1 } }
        @media (prefers-reduced-motion: reduce) {
          .${k('anim')} { animation: ${k('pulse')} 2.4s ease-in-out infinite !important; }
        }
      `}</style>

      <svg viewBox="0 0 200 200" width={size} height={size} fill="none">
        <defs>
          <radialGradient id={k('glow')} cx="50%" cy="50%" r="50%">
            {HUD_STYLE.glow.map((g, i) => (
              <stop key={i} offset={g.offset} stopColor="currentColor" stopOpacity={g.opacity} />
            ))}
          </radialGradient>
        </defs>

        {/* ambient glow (static, no blur filter) */}
        <circle cx="100" cy="100" r="80" fill={`url(#${k('glow')})`} />

        {/* independent arc-segment rings */}
        {HUD_GROUPS.map((g, gi) => (
          <g key={gi} className={k('anim')} style={spin(g.dir, g.dur)}>
            {g.dim.map((d, i) => (
              <path key={`d${i}`} d={d} className="stroke-themeblue1" strokeWidth={HUD_STYLE.dimWidth}
                strokeLinecap="round" opacity={HUD_STYLE.dimOpacity} />
            ))}
            {g.bright.map((d, i) => (
              <path key={`b${i}`} d={d} className="stroke-themeblue2" strokeWidth={HUD_STYLE.briWidth}
                strokeLinecap="round" opacity={HUD_STYLE.briOpacity} />
            ))}
          </g>
        ))}

        {/* overlapping curved sweep bands */}
        {HUD_SWEEPS.map((s, i) => (
          <g key={i} className={k('anim')} style={spin(s.dir, s.dur)}>
            <path d={s.d} className="fill-themeblue2" opacity={s.opacity} />
          </g>
        ))}

        {/* Star of Life — exact LoadingSpinner primitive, scaled & centered.
            Uses the opacity-only hud-breathe pulse (no scale) so any sibling
            (e.g. the label) on the same class stays phase-locked. */}
        <g className="hud-breathe">
          <g transform={`translate(100,100) scale(${STAR_SCALE})`}>
            <rect x="-3" y="-11" width="6" height="22" rx="1.5" className="fill-themeblue3 dark:fill-themeblue1" />
            <rect x="-3" y="-11" width="6" height="22" rx="1.5" className="fill-themeblue3 dark:fill-themeblue1" transform="rotate(60)" />
            <rect x="-3" y="-11" width="6" height="22" rx="1.5" className="fill-themeblue3 dark:fill-themeblue1" transform="rotate(120)" />
          </g>
        </g>
      </svg>
    </div>
  )
}
