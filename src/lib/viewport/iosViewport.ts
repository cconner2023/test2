/**
 * iOS Safari keyboard / scroll shell lock — adapted from Telegram Web (tweb).
 *
 * THE BUG: iOS Safari scrolls the *document* to reveal a focused input. That
 * drags position:fixed UI (our drawers) off the top of the screen — the
 * "drawer flies upward" report. `overflow:hidden` on html/body does NOT stop
 * this; only `position:fixed` does.
 *
 * THE FIX (CSS in App.css under `html.is-ios`):
 *   1. position:fixed html/body  -> document can no longer scroll, so nothing
 *      can drag the drawer up.
 *   2. body height = calc(var(--vh) * 100)  -> sized to the *visual* viewport,
 *      which this module keeps in sync. When the keyboard opens, visualViewport
 *      shrinks, --vh shrinks, and the app region shrinks to sit above the
 *      keyboard instead of being overlapped by it.
 *   3. body { transform: translateZ(0) }  -> makes body the containing block
 *      for position:fixed descendants, so a drawer's `bottom:0` resolves to the
 *      bottom of the visible (--vh) region rather than the full layout viewport.
 *      This is what keeps bottom-anchored drawers above the keyboard.
 *
 * Gated to iOS (iPhone/iPad/iPod, iPadOS-reports-as-Mac, and standalone PWA).
 * No-op on every other platform so the desktop-majority path and Android are
 * left exactly as they were.
 *
 * DELIBERATELY NOT PORTED: tweb's manual touchmove scroll-policing
 * (onTouchMove/onTouchStart). position:fixed body plus the existing
 * `overscroll-behavior:none` (App.css) already stop document scroll and
 * rubber-banding, and a global touch handler conflicts with @use-gesture drawer
 * drag and MapOverlay pan/zoom. Revisit only if on-device testing shows
 * residual viewport drift.
 */
export function setupIOSViewport(): void {
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (!isIOS) return

  document.documentElement.classList.add('is-ios')

  const vv = window.visualViewport
  let lastVH = -1
  let rafId = 0

  const setVH = () => {
    // visualViewport.height reflects the keyboard; window.innerHeight is the
    // fallback when the API is unavailable.
    const h = vv ? vv.height : window.innerHeight
    const vh = +(h * 0.01).toFixed(2)
    if (vh === lastVH) return
    lastVH = vh
    document.documentElement.style.setProperty('--vh', `${vh}px`)
  }

  const schedule = () => {
    cancelAnimationFrame(rafId)
    rafId = requestAnimationFrame(setVH)
  }

  setVH()

  if (vv) {
    vv.addEventListener('resize', schedule)
    vv.addEventListener('scroll', schedule)
  }
  window.addEventListener('resize', schedule)
  window.addEventListener('orientationchange', schedule)
}
