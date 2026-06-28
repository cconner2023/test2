import { useId } from 'react'

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
 * TEMPORARY: currently wired into the dev-only Admin → Settings sheet as a live
 * preview. Not yet adopted as the app loader.
 */

const pt = (r: number, a: number, cx = 100, cy = 100): [number, number] => [
  cx + r * Math.cos((a * Math.PI) / 180),
  cy + r * Math.sin((a * Math.PI) / 180),
]

// Arc path on a circle of radius `r`, from `a0`° to `a1`° (0° = 3 o'clock, CW).
function arc(r: number, a0: number, a1: number) {
  const [x0, y0] = pt(r, a0)
  const [x1, y1] = pt(r, a1)
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0
  const sweep = a1 > a0 ? 1 : 0
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} ${sweep} ${x1.toFixed(2)} ${y1.toFixed(2)}`
}

// Annular sector (curved sweep band) between radii `r0` (inner) and `r1`
// (outer), spanning a0°→a1°. Stops short of center so it reads as an arc band.
function sector(r0: number, r1: number, a0: number, a1: number) {
  const [ox0, oy0] = pt(r1, a0)
  const [ox1, oy1] = pt(r1, a1)
  const [ix1, iy1] = pt(r0, a1)
  const [ix0, iy0] = pt(r0, a0)
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0
  return [
    `M ${ox0.toFixed(2)} ${oy0.toFixed(2)}`,
    `A ${r1} ${r1} 0 ${large} 1 ${ox1.toFixed(2)} ${oy1.toFixed(2)}`,
    `L ${ix1.toFixed(2)} ${iy1.toFixed(2)}`,
    `A ${r0} ${r0} 0 ${large} 0 ${ix0.toFixed(2)} ${iy0.toFixed(2)}`,
    'Z',
  ].join(' ')
}

// Each orbit spins independently — max 2 pieces (1 dim + 1 bright). dim = thin
// muted arcs, bright = accent. Radii vary slightly within an orbit.
const GROUPS = [
  {
    dur: 25, dir: 1,
    dim: [arc(84, -30, 95)],
    bright: [arc(90, 60, 10)],
  },
    {
    dur: 24, dir: 1,
    dim: [arc(80, -30, 1)],
    bright: [arc(76, 60, 180)],
  },
  {
    dur: 16, dir: -1,
    dim: [arc(70, 160, 270)],
    bright: [arc(65, 50, 67)],
  },

  {
    // closer to the epicenter
    dur: 12, dir: -1,
    dim: [arc(46, 80, 0)],
    bright: [arc(40, 80, 180)],
  },
]

// Overlapping curved sweep bands — radii overlap so they cross as they rotate
// at different speeds; all clear the center star.
const SWEEPS = [
  { dur: 4.5, dir: -1, d: sector(24, 40, 70, 135), opacity: 0.16 }, // near, small
  { dur: 3.4, dir: 1, d: sector(30, 80, -130, -40), opacity: 0.18 },
  { dur: 6, dir: -1, d: sector(50, 82, 30, 95), opacity: 0.14 },
  { dur: 9, dir: 1, d: sector(70, 94, 150, 250), opacity: 0.1 },
  { dur: 12, dir: 1, d: sector(72, 98, -62, 92), opacity: 0.08 }, // far, wide
]

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
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.16" />
            <stop offset="60%" stopColor="currentColor" stopOpacity="0.04" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* ambient glow (static, no blur filter) */}
        <circle cx="100" cy="100" r="80" fill={`url(#${k('glow')})`} />

        {/* independent arc-segment rings */}
        {GROUPS.map((g, gi) => (
          <g key={gi} className={k('anim')} style={spin(g.dir, g.dur)}>
            {g.dim.map((d, i) => (
              <path key={`d${i}`} d={d} className="stroke-themeblue1" strokeWidth="3.5"
                strokeLinecap="round" opacity="0.5" />
            ))}
            {g.bright.map((d, i) => (
              <path key={`b${i}`} d={d} className="stroke-themeblue2" strokeWidth="3.5"
                strokeLinecap="round" opacity="0.70" />
            ))}
          </g>
        ))}

        {/* overlapping curved sweep bands */}
        {SWEEPS.map((s, i) => (
          <g key={i} className={k('anim')} style={spin(s.dir, s.dur)}>
            <path d={s.d} className="fill-themeblue2" opacity={s.opacity} />
          </g>
        ))}

        {/* Star of Life — exact LoadingSpinner primitive, scaled & centered.
            Uses the opacity-only hud-breathe pulse (no scale) so any sibling
            (e.g. the label) on the same class stays phase-locked. */}
        <g className="hud-breathe">
          <g transform="translate(100,100) scale(1.9)">
            <rect x="-3" y="-11" width="6" height="22" rx="1.5" className="fill-themeblue3 dark:fill-themeblue1" />
            <rect x="-3" y="-11" width="6" height="22" rx="1.5" className="fill-themeblue3 dark:fill-themeblue1" transform="rotate(60)" />
            <rect x="-3" y="-11" width="6" height="22" rx="1.5" className="fill-themeblue3 dark:fill-themeblue1" transform="rotate(120)" />
          </g>
        </g>
      </svg>
    </div>
  )
}
