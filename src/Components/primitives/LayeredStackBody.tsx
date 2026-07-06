import { useRef, useState, useLayoutEffect, useEffect, type ReactNode } from 'react'
import { SearchInput } from '@/Components/primitives/SearchInput'

/**
 * LayeredStackBody — the MOUNT-PRESERVING sibling of StackBody.
 *
 * StackBody renders only the top screen and keys it, so a push UNMOUNTS the screen
 * beneath. That's correct when a screen's state lives in the host (OverlayStack's
 * Pmcs/Dispatch consumers), but fatal when the base screen owns local state you
 * must keep across a drill — e.g. an edit form whose draft lives in its own
 * useState. Opening a selector would unmount the form and reset every field on the
 * way back.
 *
 * This layer keeps EVERY frame MOUNTED. Each frame holds a STABLE position + key in
 * the tree (never moved between containers), so React never unmounts a lower frame
 * — its state (and any focus/caret on connected nodes) survives. Only the TOP frame
 * is visible (`display:block`); the rest are `display:none` (mounted, zero layout).
 * The container height tracks the visible frame and crossfades on frame change.
 *
 * MORPH = HEIGHT + OPACITY, no horizontal translate. StackBody slides the incoming
 * frame in from the nav direction (translateX). That's safe inside a padded card,
 * but this body runs full-bleed inside a bottom Sheet: on POP the revealed base
 * frame would slide in from translateX(-14px) under `overflow:hidden`, clipping the
 * form's leftmost items (color swatches, avatars) mid-animation. So the layered
 * morph animates height + opacity only — nothing crosses the left clip edge.
 *
 * Shell-agnostic: drop it into a PreviewOverlay card OR a bottom Sheet body. Uses
 * only transform/opacity/height (the iOS-Safari-safe set; WAAPI, no keyframes).
 *
 * Search: when the TOP screen is searchable (host passes `searchPlaceholder`), a
 * pinned SearchInput rides above the morphing frames and its live value is fed to
 * the top frame's render (matching PreviewOverlay's searchable contract). The
 * filter resets whenever the active frame changes.
 *
 * Frames come from useStack (`stack.frames` / `stack.dir`); wrap the host subtree in
 * `<StackNavContext.Provider value={stack.nav}>` so drill-capable leaves morph into
 * this stack instead of opening their own nested overlay.
 */
export function LayeredStackBody({
  frames,
  searchPlaceholder,
}: {
  frames: { key: string; render: (filter?: string) => ReactNode }[]
  /** Set when the TOP screen declared `searchPlaceholder` (host forwards
   *  useStack's resolved value) — renders a pinned search box feeding the top frame. */
  searchPlaceholder?: string
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const frameRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const [filter, setFilter] = useState('')

  const topIndex = frames.length - 1
  const activeKey = frames[topIndex]?.key

  // Reset the search filter whenever the surfaced frame changes (drill or pop) —
  // a fresh screen starts unfiltered.
  useEffect(() => { setFilter('') }, [activeKey])

  useLayoutEffect(() => {
    const wrap = wrapRef.current
    const active = activeKey ? frameRefs.current.get(activeKey) : null
    if (!wrap || !active) return
    // Height tracks the visible frame (ResizeObserver → also follows in-frame
    // growth: a field revealing, async content landing).
    const apply = () => { wrap.style.height = `${active.offsetHeight}px` }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(active)
    // Crossfade the newly-surfaced frame in — opacity only, no translate (see the
    // left-clip note above).
    active.animate(
      [{ opacity: 0 }, { opacity: 1 }],
      { duration: 200, easing: 'ease-out' },
    )
    return () => ro.disconnect()
  }, [activeKey])

  return (
    <>
      {searchPlaceholder && (
        // Sticky so it stays put while a long list scrolls under it (the host scroll
        // region owns the overflow). bg matches the Sheet/overlay card surface.
        <div className="sticky top-0 z-10 px-4 pt-1 pb-1 border-b border-primary/6 bg-themewhite3">
          <SearchInput value={filter} onChange={setFilter} placeholder={searchPlaceholder} />
        </div>
      )}
      <div
        ref={wrapRef}
        style={{ overflow: 'hidden', transition: 'height 260ms cubic-bezier(0.22, 0.61, 0.36, 1)' }}
      >
        {frames.map((f, i) => {
          const isTop = i === topIndex
          return (
            <div
              key={f.key}
              ref={(el) => {
                if (el) frameRefs.current.set(f.key, el)
                else frameRefs.current.delete(f.key)
              }}
              // Hidden frames stay MOUNTED (state preserved) but contribute no layout.
              style={isTop ? undefined : { display: 'none' }}
            >
              {/* Only the visible frame consumes the live search filter; hidden
                  frames render with '' (they aren't being searched). */}
              {f.render(isTop ? filter : '')}
            </div>
          )
        })}
      </div>
    </>
  )
}
