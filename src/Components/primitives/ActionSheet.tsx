import { useCallback, useEffect, useRef, useState } from 'react'
import { useSpring, useTransition, animated } from '@react-spring/web'
import { ChevronLeft, type LucideIcon } from 'lucide-react'
import { useIsMobile } from '../Hooks/useIsMobile'
import { Sheet } from './Sheet'
import { Z } from './BaseOverlay'
import { Menu } from './Menu'

export interface ActionSheetOption {
  key: string
  label: string
  icon?: LucideIcon
  variant?: 'default' | 'danger'
  /** Terminal action. Omit on rows that only carry `children` (a group gateway). */
  onAction?: () => void
  /** Nested options — tapping this row drills into a sub-menu instead of firing.
   *  The sheet header gains a Back affordance (same Back pill the property
   *  item-detail edit view uses). Keeps the top level short. */
  children?: ActionSheetOption[]
  /** data-tour anchor on this option's button (used by guided tours) */
  tourTag?: string
}

interface ActionSheetProps {
  visible: boolean
  title: string
  options: ActionSheetOption[]
  onClose: () => void
  /** Override the mobile Sheet z-tier. Needed when launched from a surface mounted
   *  OUTSIDE a host detail sheet (e.g. the shared ItemActionMenu), where the default
   *  Z.MODAL (70) would fall behind that z1200 sheet. Ignored on desktop (Menu). */
  zIndex?: number
}

/**
 * ActionSheet — dual-mode option list: Sheet on mobile, Menu on desktop.
 * Wraps the new overlay primitives so consumers don't need to pick.
 */
export function ActionSheet({ visible, title, options, onClose, zIndex = Z.MODAL }: ActionSheetProps) {
  const isMobile = useIsMobile()
  // Drill-down path: keys of the group rows we've descended through. Empty = top.
  const [path, setPath] = useState<string[]>([])

  // Reset to the top level whenever the sheet closes.
  useEffect(() => { if (!visible) setPath([]) }, [visible])

  // Resolve the level the path points at (stops early if a key went stale).
  let currentOptions = options
  let currentTitle = title
  for (const key of path) {
    const group = currentOptions.find((o) => o.key === key)
    if (!group?.children?.length) break
    currentOptions = group.children
    currentTitle = group.label
  }
  const inSub = path.length > 0
  const goBack = () => setPath((p) => p.slice(0, -1))

  const handleOption = (option: ActionSheetOption) => {
    if (option.children?.length) { setPath((p) => [...p, option.key]); return }
    onClose()
    setTimeout(() => option.onAction?.(), 320)
  }

  // ── Drill-down morph (mobile) ───────────────────────────────────────────────
  // Descending pushes the new level in from the right; Back pops it back out to
  // the right. The card also height-morphs between levels (react-spring — the
  // same primitive the Sheet's loading morph uses) so it never hard-cuts.
  const levelKey = path.join('|') || 'root'
  const prevDepth = useRef(path.length)
  const direction = path.length >= prevDepth.current ? 1 : -1
  useEffect(() => { prevDepth.current = path.length }, [path.length])

  // Target height = the level we're settling on, read off an invisible sizer
  // (the transition layers are absolute, so they can't size the card themselves).
  // Measured via a callback ref (not a mount effect) so it re-attaches every time
  // the sheet opens the sizer node — a []-dep effect would run once while the
  // Sheet is still closed (node absent) and never measure, leaving height at 0.
  const [targetH, setTargetH] = useState<number>()
  const roRef = useRef<ResizeObserver | null>(null)
  const sizerRef = useCallback((node: HTMLDivElement | null) => {
    roRef.current?.disconnect()
    if (!node) return
    const measure = () => setTargetH(node.offsetHeight)
    measure()
    roRef.current = new ResizeObserver(measure)
    roRef.current.observe(node)
  }, [])
  const firstH = useRef(true)
  const heightSpring = useSpring({
    height: targetH ?? 0,
    immediate: firstH.current, // snap to the first measured height; morph after
    config: { tension: 320, friction: 30 },
  })
  useEffect(() => { if (targetH != null) firstH.current = false }, [targetH])

  const rowTransitions = useTransition({ key: levelKey, options: currentOptions }, {
    keys: (l) => l.key,
    from: { opacity: 0, transform: `translateX(${direction * 16}px)` },
    enter: { opacity: 1, transform: 'translateX(0px)' },
    leave: { opacity: 0, transform: `translateX(${direction * -16}px)` },
    config: { tension: 320, friction: 30 },
  })

  const renderRows = (opts: ActionSheetOption[]) => (
    // List-style rows — mirrors the calendar filter options (and the intake-form
    // channel picker): full-bleed rows in a bordered card, icon + left-aligned
    // label, divider between rows.
    <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 divide-y divide-themeblue3/10 overflow-hidden">
      {opts.map((opt) => {
        const isDanger = opt.variant === 'danger'
        const Icon = opt.icon
        return (
          <button
            key={opt.key}
            data-tour={opt.tourTag}
            onClick={() => handleOption(opt)}
            className="w-full flex items-center gap-3 py-2.5 px-4 text-left transition-colors active:scale-95 hover:bg-secondary/5"
          >
            {Icon && (
              <Icon size={16} className={`shrink-0 ${isDanger ? 'text-themeredred' : 'text-themeblue2'}`} />
            )}
            <span className={`text-[10pt] font-medium truncate flex-1 ${isDanger ? 'text-themeredred' : 'text-primary'}`}>
              {opt.label}
            </span>
          </button>
        )
      })}
    </div>
  )

  // Back affordance — plain ChevronLeft button (no HeaderPill circle), matching
  // the property nav-sheet's in-sheet back button (PropertyNavSheet leftContent).
  const backPill = inSub ? (
    <button
      onClick={goBack}
      aria-label="Back"
      className="w-9 h-9 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all"
    >
      <ChevronLeft size={20} />
    </button>
  ) : undefined

  if (isMobile) {
    return (
      <Sheet isOpen={visible} onClose={onClose} title={currentTitle} leftContent={backPill} hideClose zIndex={zIndex}>
        <div className="px-4 pb-5 pt-2">
          {/* Height-morphing stage: the settling level is measured off an
              invisible sizer; the visible levels cross-slide over it. */}
          <animated.div className="relative overflow-hidden" style={{ height: heightSpring.height }}>
            <div ref={sizerRef} aria-hidden className="invisible absolute inset-x-0 top-0">
              {renderRows(currentOptions)}
            </div>
            {rowTransitions((style, lvl) => (
              <animated.div style={style} className="absolute inset-x-0 top-0">
                {renderRows(lvl.options)}
              </animated.div>
            ))}
          </animated.div>
          <button
            onClick={onClose}
            className="w-full py-2.5 mt-2.5 rounded-2xl text-[10pt] font-medium text-tertiary active:scale-95 transition-all hover:bg-secondary/5"
          >
            Cancel
          </button>
        </div>
      </Sheet>
    )
  }

  return (
    <Menu
      isOpen={visible}
      onClose={onClose}
      title={currentTitle}
      leftContent={backPill}
      options={currentOptions.map((o) => ({
        key: o.key,
        label: o.label,
        icon: o.icon,
        variant: o.variant,
        tourTag: o.tourTag,
        keepOpen: !!o.children?.length,
        onAction: o.children?.length ? () => setPath((p) => [...p, o.key]) : (o.onAction ?? (() => {})),
      }))}
    />
  )
}
