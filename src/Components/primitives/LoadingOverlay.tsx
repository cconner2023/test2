import { memo } from 'react'
import { useSpring, animated } from '@react-spring/web'
import { HudLoader } from '@/Components/primitives/HudLoader'

interface LoadingOverlayProps {
  /** Drives the crossfade. Always mounted; opacity 0↔1 is the on/off. */
  visible: boolean
  /** Border-radius / extra classes so the gate clips to its parent card. Parent must be `relative`. */
  className?: string
  /** HUD diameter in px. The HUD needs ~120px+ to read — do NOT shrink below that.
   *  Section/panel-scoped only; there is no per-row HUD. */
  size?: number
  /** Optional caption under the mark — the admin look: breathing, wide-tracked. */
  label?: string
  /** Stacking class. Separate from className because appending a second z-* utility
   *  there loses to whichever Tailwind emits last. The map needs z-[1002] to clear
   *  Leaflet's panes and controls (z 400-1000). */
  zClassName?: string
}

/**
 * Contained HUD gate for a save or mutation in flight over a form or record card:
 * the region fades to the HUD (siblings outside the gate keep posting), then fades
 * out to reveal the content underneath. Not for a list / panel first load; that is
 * a skeleton (see Skeleton.tsx), because a HUD over rows that are merely arriving
 * reads as a blocking modal.
 *
 * Renders HudLoader directly (not LoadingSpinner) so it escapes the 28/44/72px
 * size floor — the shrunk HUD doesn't read, which is the whole reason this
 * exists. Mechanic mirrors the old scrim: spring fade, always mounted,
 * pointer-events off when hidden so it never blocks input while invisible.
 */
export const LoadingOverlay = memo(function LoadingOverlay({
  visible,
  className = '',
  size = 140,
  label,
  zClassName = 'z-50',
}: LoadingOverlayProps) {
  const spring = useSpring({
    opacity: visible ? 1 : 0,
    config: { tension: 200, friction: 22 },
  })
  return (
    <animated.div
      className={`absolute inset-0 ${zClassName} flex flex-col items-center justify-center gap-5 bg-themewhite dark:bg-themewhite ${className}`}
      style={{ opacity: spring.opacity, pointerEvents: visible ? 'auto' : 'none' }}
    >
      <HudLoader size={size} />
      {label && (
        <div className="hud-breathe text-[11pt] tracking-[0.25em] text-themeblue2/80 font-semibold">
          {label}
        </div>
      )}
    </animated.div>
  )
})
