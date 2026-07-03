/**
 * Single source of truth for the HUD loader geometry.
 *
 * Consumed by BOTH:
 *   - src/Components/HudLoader.tsx (React, runtime)
 *   - vite.config.ts → injects hudSplashMarkup() into index.html's pre-React
 *     splash at build/dev time (the splash can't run JS path helpers before the
 *     bundle loads, so the markup is generated and baked in by the plugin).
 *
 * Keep this DOM-free / dependency-free so it imports cleanly into the Vite
 * config. Edit geometry HERE and both surfaces stay in sync automatically.
 */

const pt = (r: number, a: number, cx = 100, cy = 100): [number, number] => [
  cx + r * Math.cos((a * Math.PI) / 180),
  cy + r * Math.sin((a * Math.PI) / 180),
]

// Arc path on a circle of radius `r`, from `a0`° to `a1`° (0° = 3 o'clock, CW).
export function arc(r: number, a0: number, a1: number) {
  const [x0, y0] = pt(r, a0)
  const [x1, y1] = pt(r, a1)
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0
  const sweep = a1 > a0 ? 1 : 0
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} ${sweep} ${x1.toFixed(2)} ${y1.toFixed(2)}`
}

// Annular sector (curved sweep band) between radii `r0` (inner) and `r1`
// (outer), spanning a0°→a1°. Stops short of center so it reads as an arc band.
export function sector(r0: number, r1: number, a0: number, a1: number) {
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

export interface HudOrbit { dur: number; dir: 1 | -1; dim: string[]; bright: string[] }
export interface HudSweep { dur: number; dir: 1 | -1; d: string; opacity: number }

// Each orbit spins independently — max 2 pieces (1 dim + 1 bright). dim = thin
// muted arcs, bright = accent. Radii vary slightly within an orbit.
export const HUD_GROUPS: HudOrbit[] = [
  { dur: 25, dir: 1, dim: [arc(84, -30, 95)], bright: [arc(90, 60, 10)] },
  { dur: 24, dir: 1, dim: [arc(80, -30, 1)], bright: [arc(76, 60, 180)] },
  { dur: 16, dir: -1, dim: [arc(70, 160, 270)], bright: [arc(65, 50, 67)] },
  // closer to the epicenter
  { dur: 12, dir: -1, dim: [arc(46, 80, 0)], bright: [arc(40, 80, 180)] },
]

// Overlapping curved sweep bands — radii overlap so they cross as they rotate
// at different speeds; all clear the center star.
export const HUD_SWEEPS: HudSweep[] = [
  { dur: 4.5, dir: -1, d: sector(24, 40, 70, 135), opacity: 0.16 }, // near, small
  { dur: 3.4, dir: 1, d: sector(30, 80, -130, -40), opacity: 0.18 },
  { dur: 6, dir: -1, d: sector(50, 82, 30, 95), opacity: 0.14 },
  { dur: 9, dir: 1, d: sector(58, 82, 135, 235), opacity: 0.1 }, // large, pulled inward
  { dur: 12, dir: 1, d: sector(76, 100, -55, 85), opacity: 0.08 }, // large, kept far — offset in depth
  { dur: 5.2, dir: 1, d: sector(44, 64, 195, 240), opacity: 0.15 }, // mid, narrow
  { dur: 8, dir: -1, d: sector(34, 58, 105, 205), opacity: 0.12 }, // long, near-mid, balances the arc
]

export const STAR_SCALE = 1.9

// Structural styling shared by BOTH consumers (stroke widths, opacities, glow
// stops). Color is handled separately: the React component uses Tailwind theme
// classes; the splash uses CSS classes resolving --color-* vars. Edit here.
export const HUD_STYLE = {
  dimWidth: 3.5,
  dimOpacity: 0.5,
  briWidth: 3.5,
  briOpacity: 0.7,
  glow: [
    { offset: '0%', opacity: 0.16 },
    { offset: '60%', opacity: 0.04 },
    { offset: '100%', opacity: 0 },
  ],
}


/**
 * Static SVG inner-markup for the pre-React splash. Uses GLOBAL css classes
 * (.hud-dim/.hud-bri/.hud-sweep/.hud-star/.hud-spin/.hud-breathe) + keyframes
 * (hudCW/hudCCW/hudBreathe) defined in index.html's <style>. Wrap in an
 * <svg viewBox="0 0 200 200">. Theme handled by CSS (incl. .splash-dark).
 */
/**
 * Colors come from CSS classes (.hud-dim/.hud-bri/.hud-sweep/.hud-star + the
 * gradient `stop`s), which resolve `var(--color-themeblueN)` — so the splash
 * tracks the user's SELECTED theme, not just light/dark. Those vars are made
 * available at first paint by the vite plugin (extracts them from App.css) +
 * the inline script setting data-theme. var() can't be used in SVG presentation
 * attributes, hence classes for color; structural styles (width/opacity) inline.
 */
export function hudSplashMarkup(): string {
  const S = HUD_STYLE
  const spin = (dir: 1 | -1, dur: number) =>
    `<g class="hud-spin" style="animation: ${dir === 1 ? 'hudCW' : 'hudCCW'} ${dur}s linear infinite">`
  const stroke = (d: string, cls: string, w: number, o: number) =>
    `<path class="${cls}" d="${d}" fill="none" stroke-width="${w}" stroke-linecap="round" opacity="${o}" />`
  const orbit = (g: HudOrbit) =>
    spin(g.dir, g.dur) +
    g.dim.map(d => stroke(d, 'hud-dim', S.dimWidth, S.dimOpacity)).join('') +
    g.bright.map(d => stroke(d, 'hud-bri', S.briWidth, S.briOpacity)).join('') +
    '</g>'
  const sweep = (s: HudSweep) =>
    spin(s.dir, s.dur) + `<path class="hud-sweep" opacity="${s.opacity}" d="${s.d}" /></g>`
  const star =
    `<g class="hud-breathe"><g transform="translate(100,100) scale(${STAR_SCALE})">` +
    [0, 60, 120]
      .map(r => `<rect class="hud-star" x="-3" y="-11" width="6" height="22" rx="1.5"${r ? ` transform="rotate(${r})"` : ''} />`)
      .join('') +
    '</g></g>'
  const glow =
    '<defs><radialGradient id="hudGlow" cx="50%" cy="50%" r="50%">' +
    S.glow.map(g => `<stop class="hud-glow-stop" offset="${g.offset}" stop-opacity="${g.opacity}" />`).join('') +
    '</radialGradient></defs>' +
    '<circle cx="100" cy="100" r="80" fill="url(#hudGlow)" />'
  return glow + HUD_GROUPS.map(orbit).join('') + HUD_SWEEPS.map(sweep).join('') + star
}
