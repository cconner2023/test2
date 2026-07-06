import { useRef, useLayoutEffect, type ReactNode } from 'react'

/**
 * StackBody — the morph layer shared by every drill-down surface.
 *
 * Extracted from OverlayStack so it can be reused outside the PreviewOverlay card
 * shell (e.g. the full-screen LoginScreen, which is a branded splash, not an
 * anchored popover). OverlayStack still composes it; LoginScreen drives it
 * directly. Same code → identical morph everywhere.
 *
 * When the active screen changes it:
 *  - transitions height old→new (driven by a ResizeObserver, so it also tracks
 *    in-screen content growth — a field revealing, an async panel arriving), and
 *  - fades + slides the incoming content in from the nav direction (push = from
 *    the right, pop = from the left) via the Web Animations API.
 * Same-screen re-renders (drag, filter change, page add) keep the same `screenKey`
 * so they don't re-trigger the slide — only height tracks.
 *
 * Uses only transform/opacity/height — the iOS-Safari-safe set; WAAPI, no global
 * keyframes.
 */
export function StackBody({ screenKey, dir, children }: { screenKey: string; dir: 1 | -1; children: ReactNode }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const inner = innerRef.current
    const wrap = wrapRef.current
    if (!inner || !wrap) return
    const apply = () => { wrap.style.height = `${inner.offsetHeight}px` }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(inner)
    // Slide + fade the new screen's content in from the nav direction.
    inner.animate(
      [
        { opacity: 0, transform: `translateX(${dir * 14}px)` },
        { opacity: 1, transform: 'translateX(0)' },
      ],
      { duration: 220, easing: 'ease-out' },
    )
    return () => ro.disconnect()
  }, [screenKey, dir])

  return (
    <div
      ref={wrapRef}
      style={{ overflow: 'hidden', transition: 'height 260ms cubic-bezier(0.22, 0.61, 0.36, 1)' }}
    >
      <div ref={innerRef} key={screenKey}>
        {children}
      </div>
    </div>
  )
}
