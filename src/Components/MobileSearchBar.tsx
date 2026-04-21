/**
 * MobileSearchBar — Signal-style collapsing search bar for mobile.
 *
 * States:
 *   Resting   — full pill bar visible at scroll top (search icon + placeholder)
 *   Collapsed — height tracks scrollTop 1:1 (direct DOM writes, no spring)
 *   Focused   — same pill becomes active, close button appears beside it
 *               (shortens pill width), parent hides header via onFocusChange
 *
 * Overscroll: mild upward translateY (0.3x factor) on iOS bounce.
 */
import { Search, X } from 'lucide-react'
import {
    useRef,
    useState,
    useCallback,
    useEffect,
    forwardRef,
    type ReactNode,
} from 'react'

const VARIANT_PLACEHOLDERS: Record<string, string> = {
    default: 'Search...',
    messages: 'Search conversations...',
    admin: 'Search...',
    supervisor: 'Search personnel...',
    property: 'Search items...',
}

const OVERSCROLL_FACTOR = 0.3

interface MobileSearchBarProps {
    value: string
    onChange: (value: string) => void
    placeholder?: string
    children: ReactNode
    className?: string
    style?: React.CSSProperties
    enabled?: boolean
    onFocus?: () => void
    /** Called when focus state changes — parent uses this to hide/show header content */
    onFocusChange?: (focused: boolean) => void
    variant?: 'default' | 'messages' | 'admin' | 'supervisor' | 'property'
    /** When true, skip creating own scroll container — parent handles scrolling */
    inheritScroll?: boolean
    /** data-tour attribute for in-app tour targeting */
    dataTour?: string
}

function setExternalRef<T>(ref: React.Ref<T> | undefined, value: T | null) {
    if (!ref) return
    if (typeof ref === 'function') ref(value)
    else (ref as React.MutableRefObject<T | null>).current = value
}

export const MobileSearchBar = forwardRef<HTMLDivElement, MobileSearchBarProps>(
    function MobileSearchBar(
        {
            value,
            onChange,
            placeholder,
            children,
            className = '',
            style,
            enabled = true,
            onFocus,
            onFocusChange,
            variant = 'default',
            inheritScroll = false,
            dataTour,
        },
        externalRef,
    ) {
        const resolvedPlaceholder =
            placeholder ?? VARIANT_PLACEHOLDERS[variant] ?? 'Search...'

        const scrollRef = useRef<HTMLDivElement>(null)
        const wrapperRef = useRef<HTMLDivElement>(null)
        const innerRef = useRef<HTMLDivElement>(null)
        const inputRef = useRef<HTMLInputElement>(null)
        // Resolved scroll container — either our own div or the nearest scrollable ancestor
        const resolvedScrollRef = useRef<HTMLElement | null>(null)

        const [barHeight, setBarHeight] = useState(52)
        const [focused, setFocused] = useState(false)

        const hasValue = value.trim().length > 0
        const hasValueRef = useRef(hasValue)
        hasValueRef.current = hasValue

        const focusedRef = useRef(focused)
        focusedRef.current = focused

        // Merge external ref with internal scroll ref
        const mergedScrollRef = useCallback(
            (node: HTMLDivElement | null) => {
                ;(
                    scrollRef as React.MutableRefObject<HTMLDivElement | null>
                ).current = node
                setExternalRef(externalRef, node)
            },
            [externalRef],
        )

        // Measure bar height after mount
        useEffect(() => {
            if (!enabled || !wrapperRef.current) return
            const h = wrapperRef.current.offsetHeight
            if (h > 0) setBarHeight(h)
        }, [enabled])

        // ── Scroll-driven collapse (direct DOM writes, no spring) ────────
        useEffect(() => {
            // When inheritScroll is true, our own div doesn't scroll —
            // walk up the DOM to find the nearest scrollable ancestor.
            let el: HTMLElement | null = scrollRef.current
            if (inheritScroll && el) {
                let parent = el.parentElement
                while (parent) {
                    const { overflowY } = getComputedStyle(parent)
                    if (overflowY === 'auto' || overflowY === 'scroll') {
                        el = parent
                        break
                    }
                    parent = parent.parentElement
                }
            }
            const wrapper = wrapperRef.current
            if (!el || !wrapper || !enabled) return
            resolvedScrollRef.current = el

            let rafId: number | null = null

            const onScroll = () => {
                if (rafId !== null) return
                rafId = requestAnimationFrame(() => {
                    rafId = null
                    if (focusedRef.current || hasValueRef.current) {
                        wrapper.style.height = `${barHeight}px`
                        wrapper.style.opacity = '1'
                        if (innerRef.current) {
                            innerRef.current.style.transform = 'translateY(0px)'
                        }
                        return
                    }
                    const scrollTop = el.scrollTop
                    if (scrollTop < 0) {
                        // iOS bounce overscroll — mild parallax upward
                        wrapper.style.height = `${barHeight}px`
                        wrapper.style.opacity = '1'
                        if (innerRef.current) {
                            innerRef.current.style.transform = `translateY(${scrollTop * OVERSCROLL_FACTOR}px)`
                        }
                    } else {
                        const collapsed = Math.min(scrollTop, barHeight)
                        wrapper.style.height = `${barHeight - collapsed}px`
                        wrapper.style.opacity = String(
                            1 - (collapsed / barHeight) * 0.6,
                        )
                        if (innerRef.current) {
                            innerRef.current.style.transform = 'translateY(0px)'
                        }
                    }
                })
            }

            el.addEventListener('scroll', onScroll, { passive: true })
            return () => {
                el.removeEventListener('scroll', onScroll)
                if (rafId !== null) cancelAnimationFrame(rafId)
            }
        }, [enabled, barHeight, inheritScroll])

        // Keep bar expanded when value is present or focused
        useEffect(() => {
            if (!wrapperRef.current) return
            if (hasValue || focused) {
                wrapperRef.current.style.height = `${barHeight}px`
                wrapperRef.current.style.opacity = '1'
            }
        }, [hasValue, focused, barHeight])

        // ── Focus management ─────────────────────────────────────────────
        const handleFocus = useCallback(() => {
            setFocused(true)
            onFocus?.()
            onFocusChange?.(true)
            // Scroll to top so search bar is fully visible
            const scrollEl = resolvedScrollRef.current ?? scrollRef.current
            if (scrollEl) {
                scrollEl.scrollTo({ top: 0, behavior: 'smooth' })
            }
        }, [onFocus, onFocusChange])

        const handleClose = useCallback(() => {
            onChange('')
            setFocused(false)
            inputRef.current?.blur()
            onFocusChange?.(false)
            // Recompute collapse to current scroll position
            const el = resolvedScrollRef.current ?? scrollRef.current
            const wrapper = wrapperRef.current
            if (!el || !wrapper) return
            const scrollTop = el.scrollTop
            const collapsed = Math.max(0, Math.min(scrollTop, barHeight))
            wrapper.style.height = `${barHeight - collapsed}px`
            wrapper.style.opacity = String(
                1 - (collapsed / barHeight) * 0.6,
            )
        }, [onChange, onFocusChange, barHeight])

        const handleBlur = useCallback(() => {
            // Only unfocus if there's no value — if searching, stay focused
            if (!hasValueRef.current) {
                setFocused(false)
                onFocusChange?.(false)
                // Recompute collapse
                const el = resolvedScrollRef.current ?? scrollRef.current
                const wrapper = wrapperRef.current
                if (!el || !wrapper) return
                const scrollTop = el.scrollTop
                const collapsed = Math.max(0, Math.min(scrollTop, barHeight))
                wrapper.style.height = `${barHeight - collapsed}px`
                wrapper.style.opacity = String(
                    1 - (collapsed / barHeight) * 0.6,
                )
            }
        }, [onFocusChange, barHeight])

        // Unfocus when value is cleared externally (e.g., search result clicked navigates away)
        useEffect(() => {
            if (focused && !hasValue && document.activeElement !== inputRef.current) {
                setFocused(false)
                onFocusChange?.(false)
                const el = resolvedScrollRef.current ?? scrollRef.current
                const wrapper = wrapperRef.current
                if (el && wrapper) {
                    const collapsed = Math.max(0, Math.min(el.scrollTop, barHeight))
                    wrapper.style.height = `${barHeight - collapsed}px`
                    wrapper.style.opacity = String(1 - (collapsed / barHeight) * 0.6)
                }
            }
        }, [focused, hasValue, onFocusChange, barHeight])

        const handleClear = useCallback(() => {
            onChange('')
            inputRef.current?.focus()
        }, [onChange])

        const handleKeyDown = useCallback(
            (e: React.KeyboardEvent) => {
                if (e.key === 'Escape') {
                    if (hasValue) {
                        onChange('')
                        inputRef.current?.focus()
                    } else {
                        handleClose()
                    }
                }
            },
            [hasValue, onChange, handleClose],
        )

        if (!enabled) {
            return (
                <div
                    ref={mergedScrollRef}
                    className={`${inheritScroll ? '' : 'h-full overflow-y-auto'} ${className}`}
                    style={style}
                >
                    {children}
                </div>
            )
        }

        return (
            <div
                ref={mergedScrollRef}
                className={`${inheritScroll ? '' : 'h-full overflow-y-auto'} ${className}`}
                style={style}
            >
                {/* Inline search bar — collapses with scroll, expands on focus */}
                <div
                    ref={wrapperRef}
                    className="overflow-hidden shrink-0"
                    style={{ height: barHeight, opacity: 1 }}
                >
                    <div ref={innerRef} className="px-3 py-2">
                        <div className="flex items-center gap-2">
                            <div
                                {...(dataTour ? { 'data-tour': dataTour } : {})}
                                className={`flex-1 min-w-0 flex items-center transition-colors duration-200 bg-themewhite text-tertiary rounded-full border shadow-xs ${
                                focused
                                    ? 'border-themeblue1/30 bg-themewhite2'
                                    : 'border-themeblue3/10'
                            }`}>
                                <Search
                                    size={16}
                                    className="ml-3 shrink-0 text-tertiary"
                                />
                                <input
                                    ref={inputRef}
                                    type="search"
                                    placeholder={resolvedPlaceholder}
                                    value={value}
                                    onChange={(e) => onChange(e.target.value)}
                                    onFocus={handleFocus}
                                    onBlur={handleBlur}
                                    onKeyDown={handleKeyDown}
                                    className="text-tertiary bg-transparent outline-none text-[12pt] w-full px-3 py-2 min-w-0 placeholder:text-tertiary [&::-webkit-search-cancel-button]:hidden"
                                />
                                {hasValue && (
                                    <div
                                        className="flex items-center justify-center px-2 py-2 bg-themewhite2 rounded-r-full cursor-pointer active:scale-95 shrink-0"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={handleClear}
                                    >
                                        <X className="w-5 h-5 stroke-themeblue1" />
                                    </div>
                                )}
                            </div>
                            {/* Close button — appears when focused, shortens pill width */}
                            <div className={`transition-all duration-200 overflow-hidden ${
                                focused ? 'w-10 opacity-100' : 'w-0 opacity-0'
                            }`}>
                                <button
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={handleClose}
                                    className="w-10 h-10 rounded-full flex items-center justify-center bg-tertiary/10 active:scale-95 shrink-0"
                                    aria-label="Cancel search"
                                >
                                    <X size={18} className="text-tertiary" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {children}
            </div>
        )
    },
)
