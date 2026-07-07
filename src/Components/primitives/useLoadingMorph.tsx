import { useEffect, useRef, useState } from 'react'
import { useSpring, type SpringValue } from '@react-spring/web'
import { DRAWER_TIMING } from '@/Utilities/constants'

/**
 * useLoadingMorph — the ONE loading-morph engine shared by every opt-in surface.
 *
 * The "HUD puck grows into the surface" morph used to be forked: Sheet.tsx carried
 * the canonical 5-phase machine (vessel slides up → collapses to a HUD puck that
 * holds through the load → expands into the settled content), while PreviewOverlay
 * had an older, diverged 2-state (`settled` bool) copy. Same idea, two feels. This
 * hook is the single implementation — the phase machine, the three springs, and the
 * HUD ↔ content crossfade timing all live here so both shells morph identically.
 *
 * The ONLY per-surface difference is the entrance (`hasVessel`):
 *  - Sheet (bottom-anchored): plays SHAPE 1 — a blank full-width vessel slides up on
 *    the CSS slide, THEN collapses inward to the puck. Pass hasVessel=true + vesselH.
 *  - PreviewOverlay (scales in from its anchor): has no "slide up" moment, so it opens
 *    STRAIGHT as the puck (no vessel/collapse). Pass hasVessel=false.
 *
 * Phases: enter (vessel, hasVessel only) → collapse → hud (puck rests) → expand → done.
 * A no-vessel surface starts at `hud` when it opens loading and skips enter/collapse.
 *
 * The consumer owns measurement (its full width/height, and the vessel height) and
 * renders the returned springs; the hook owns state + transitions only. Uses only
 * width/height/opacity/transform springs — the iOS-Safari-safe set.
 *
 * A future `check` dwell (HUD morphing to a checkmark) slots in at the hud→expand seam.
 */

export type MorphPhase = 'enter' | 'collapse' | 'hud' | 'expand' | 'done'

export interface LoadingMorph {
  /** Whether the consumer opted in (loading prop present + enabled). */
  opted: boolean
  /** Current phase of the shared machine. */
  phase: MorphPhase
  /** True while the surface is the settled HUD puck (collapse or hud). Consumers
   *  gate their content-height measurement on this (the puck's squeezed width makes
   *  the content's scrollHeight bogus). */
  isPuck: boolean
  /** Spring-driven puck↔surface width/height — put on the morphing wrapper. */
  morph: { width: SpringValue<number>; height: SpringValue<number> }
  /** HUD layer crossfade — opacity in as it collapses to the puck, dissolves out
   *  (scale 1.08) on expand. */
  hudFade: { opacity: SpringValue<number>; scale: SpringValue<number> }
  /** Content layer fade — blank through vessel + puck, fades in a beat into expand. */
  contentFade: { opacity: SpringValue<number> }
}

export function useLoadingMorph({
  loading,
  enabled = true,
  shown = true,
  fullW,
  fullH,
  vesselH,
  puckW = 140,
  puckH,
  hasVessel,
  config = { tension: 210, friction: 24 },
}: {
  /** The consumer's `loading` prop. `undefined` ⇒ not opted in ⇒ classic path only. */
  loading: boolean | undefined
  /** Extra gate beyond `loading !== undefined` (e.g. Sheet: !isSnap). Default true. */
  enabled?: boolean
  /** Whether the surface is currently shown/slid-in. Distinguishes a fresh open
   *  (play the vessel) from a re-load over a settled surface (collapse straight to
   *  the puck). Only consulted when hasVessel. */
  shown?: boolean
  /** Settled (full) width to grow into. */
  fullW: number
  /** Settled (full) height to grow into. */
  fullH: number
  /** Shape-1 vessel height — the blank surface that slides up before collapsing.
   *  hasVessel surfaces only. */
  vesselH?: number
  /** Puck (HUD) width. Default 140. */
  puckW?: number
  /** Puck (HUD) height. */
  puckH: number
  /** Plays the shape-1 vessel entrance (Sheet=true). A surface that scales in from
   *  its anchor (PreviewOverlay) passes false and opens straight as the puck. */
  hasVessel: boolean
  config?: { tension: number; friction: number }
}): LoadingMorph {
  const opted = loading !== undefined && enabled

  // A no-vessel surface opened mid-load starts AT the puck (avoids a one-frame full
  // card before the effect flips it). A vessel surface starts at 'done' and lets the
  // entrance effect drive it (its first frame is off-screen on the slide anyway).
  const [phase, setPhase] = useState<MorphPhase>(() =>
    loading && !hasVessel ? 'hud' : 'done',
  )
  const phaseRef = useRef<MorphPhase>(phase)
  phaseRef.current = phase

  const isPuck = phase === 'collapse' || phase === 'hud'

  const fullWResolved = fullW || puckW
  const targetW = isPuck ? puckW : fullWResolved
  const targetH = phase === 'enter'
    ? (vesselH ?? (fullH || puckH))
    : isPuck ? puckH : (fullH || puckH)

  const morph = useSpring({
    width: targetW,
    height: targetH,
    // The vessel (shape 1) snaps to full size and rides in on the CSS slide — only
    // collapse → puck and puck → sheet actually animate their size.
    immediate: phase === 'enter',
    config,
    onRest: () => {
      if (phaseRef.current === 'collapse') setPhase('hud')
      else if (phaseRef.current === 'expand') setPhase('done')
    },
  })
  // HUD: blank through the vessel, fades in as it collapses to the puck, then
  // dissolves outward (scale 1.08) as the surface expands.
  const hudFade = useSpring({
    opacity: isPuck ? 1 : 0,
    scale: phase === 'expand' || phase === 'done' ? 1.08 : 1,
    config,
  })
  // Content: blank through vessel + puck, fades in a beat into expand. ONLY the
  // expand fade-in animates — hiding is instant (immediate) so the vessel is truly
  // blank on entry and the initial 'done' frame never bleeds the settled surface
  // through the slide-in (the old pre-collapse flash).
  const contentFade = useSpring({
    opacity: phase === 'expand' || phase === 'done' ? 1 : 0,
    immediate: phase !== 'expand',
    delay: phase === 'expand' ? 90 : 0,
    config,
  })

  // Entrance: `loading` rising drives the vessel in (hasVessel) or rests straight as
  // the puck (no vessel). A re-load over a settled surface collapses to the puck.
  useEffect(() => {
    if (!opted) return
    if (loading) {
      setPhase(p =>
        hasVessel
          ? (p === 'done' && shown ? 'collapse' : 'enter')
          : 'hud',
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, opted])

  // Vessel → puck: let the slide-up land, then collapse inward (hasVessel only).
  useEffect(() => {
    if (!hasVessel || phase !== 'enter') return
    const t = window.setTimeout(() => setPhase('collapse'), DRAWER_TIMING.TRANSITION)
    return () => window.clearTimeout(t)
  }, [phase, hasVessel])

  // Settled puck → expand once the load clears. The future checkmark dwell slots in
  // right here, between `hud` settling and the expand.
  useEffect(() => {
    if (phase === 'hud' && !loading) setPhase('expand')
  }, [phase, loading])

  return { opted, phase, isPuck, morph, hudFade, contentFade }
}
