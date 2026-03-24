import { useEffect, useState, useRef } from 'react'

interface TourSpotlightProps {
  target: string
  padding?: number
  onTargetRect?: (rect: DOMRect | null) => void
}

/** Walk up the DOM to find the nearest scrollable ancestor. */
function findScrollParent(el: Element): Element | null {
  let node = el.parentElement
  while (node) {
    const { overflow, overflowY } = getComputedStyle(node)
    if (/(auto|scroll)/.test(overflow + overflowY)) return node
    node = node.parentElement
  }
  return null
}

/** Poll getBoundingClientRect until position stabilizes (3 consecutive frames within 1px). */
function waitForScrollSettle(el: Element, aborted: { current: boolean }): Promise<DOMRect | null> {
  return new Promise(resolve => {
    let lastY = el.getBoundingClientRect().y
    let stableFrames = 0

    const check = () => {
      if (aborted.current) { resolve(null); return }
      const r = el.getBoundingClientRect()
      if (Math.abs(r.y - lastY) < 1) {
        stableFrames++
        if (stableFrames >= 3) { resolve(r); return }
      } else {
        stableFrames = 0
      }
      lastY = r.y
      requestAnimationFrame(check)
    }
    requestAnimationFrame(check)
  })
}

export function TourSpotlight({ target, padding = 8, onTargetRect }: TourSpotlightProps) {
  const [rect, setRect] = useState<DOMRect | null>(null)
  const observerRef = useRef<ResizeObserver | null>(null)
  const prevRectRef = useRef<string>('')

  useEffect(() => {
    // Scene tours render their own mock elements with data-tour attributes.
    // Scope the query to the scene container so we find the mock — not the real app's elements.
    const root = document.querySelector('[data-tour-scene]') ?? document
    const el = root.querySelector(`[data-tour="${target}"]`)
    if (!el) {
      setRect(null)
      onTargetRect?.(null)
      return
    }

    const aborted = { current: false }

    const update = () => {
      if (aborted.current) return
      const r = el.getBoundingClientRect()
      const key = `${r.x},${r.y},${r.width},${r.height}`
      if (key !== prevRectRef.current) {
        prevRectRef.current = key
        setRect(r)
        onTargetRect?.(r)
      }
    }

    // Scroll target into view if not visible within its scroll container
    const r = el.getBoundingClientRect()
    const scrollParent = el.closest('[data-tour-scene]') ?? findScrollParent(el)
    const containerRect = scrollParent?.getBoundingClientRect()
    const inViewport = containerRect
      ? r.top >= containerRect.top && r.bottom <= containerRect.bottom
      : r.top >= 0 && r.bottom <= window.innerHeight

    let animTimer: ReturnType<typeof setTimeout> | null = null

    if (!inViewport) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // Don't render spotlight until scroll finishes — poll for position stability
      waitForScrollSettle(el, aborted).then(settled => {
        if (!settled || aborted.current) return
        update()
        // One more check after cardAppearIn animation (~300ms)
        animTimer = setTimeout(update, 350)
      })
    } else {
      // Already visible — small delay for CSS animation settle, then measure
      setTimeout(update, 50)
      animTimer = setTimeout(update, 350)
    }

    // Track resizes and layout shifts after initial settle
    observerRef.current = new ResizeObserver(update)
    observerRef.current.observe(el)
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)

    return () => {
      aborted.current = true
      if (animTimer) clearTimeout(animTimer)
      observerRef.current?.disconnect()
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [target, onTargetRect])

  if (!rect) return null

  const x = rect.x - padding
  const y = rect.y - padding
  const w = rect.width + padding * 2
  const h = rect.height + padding * 2
  const r = 12 // border radius

  return (
    <svg
      className="fixed inset-0 w-full h-full z-[9998] pointer-events-none transition-all duration-300 ease-out"
      style={{ width: '100vw', height: '100vh' }}
    >
      <defs>
        <mask id="tour-spotlight-mask">
          <rect width="100%" height="100%" fill="white" />
          <rect
            x={x}
            y={y}
            width={w}
            height={h}
            rx={r}
            ry={r}
            fill="black"
            className="transition-all duration-300 ease-out"
          />
        </mask>
      </defs>
      <rect
        width="100%"
        height="100%"
        fill="rgba(0,0,0,0.55)"
        mask="url(#tour-spotlight-mask)"
      />
    </svg>
  )
}
