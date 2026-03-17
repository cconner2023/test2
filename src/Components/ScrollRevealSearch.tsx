/**
 * Search bar at the top of scrollable content with spring-parallax collapse.
 * As scroll position increases, the bar smoothly shrinks away.
 * Scroll back to top to reveal it. Spring physics create the parallax lag.
 */
import { X } from 'lucide-react'
import { useRef, useState, useCallback, useEffect, type ReactNode, type Ref } from 'react'
import { useSpring, animated } from '@react-spring/web'
import { SPRING_CONFIGS } from '../Utilities/GestureUtils'

interface ScrollRevealSearchProps {
    value: string
    onChange: (value: string) => void
    placeholder?: string
    children: ReactNode
    className?: string
    enabled?: boolean
    onFocus?: () => void
    /** Exposes the scroll container for external scroll resets */
    ref?: Ref<HTMLDivElement>
}

function setRef<T>(ref: Ref<T> | undefined, value: T | null) {
    if (!ref) return
    if (typeof ref === 'function') ref(value)
    else (ref as React.MutableRefObject<T | null>).current = value
}

export function ScrollRevealSearch({
    value,
    onChange,
    placeholder = 'Search...',
    children,
    className = '',
    enabled = true,
    onFocus,
    ref,
}: ScrollRevealSearchProps) {
    const scrollRef = useRef<HTMLDivElement>(null)
    const mergedRef = useCallback((node: HTMLDivElement | null) => {
        (scrollRef as React.MutableRefObject<HTMLDivElement | null>).current = node
        setRef(ref, node)
    }, [ref])
    const searchRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const hasValue = value.trim().length > 0
    const hasValueRef = useRef(hasValue)
    hasValueRef.current = hasValue

    const [barHeight, setBarHeight] = useState(52)

    useEffect(() => {
        if (!enabled || !searchRef.current) return
        const h = searchRef.current.offsetHeight
        if (h > 0) setBarHeight(h)
    }, [enabled])

    const [spring, api] = useSpring(() => ({
        collapse: 0,
        config: SPRING_CONFIGS.page,
    }))

    useEffect(() => {
        const el = scrollRef.current
        if (!el || !enabled) return

        const onScroll = () => {
            if (hasValueRef.current) {
                api.start({ collapse: 0 })
                return
            }
            const h = searchRef.current?.offsetHeight ?? barHeight
            const collapse = Math.min(el.scrollTop, h)
            api.start({ collapse })
        }

        el.addEventListener('scroll', onScroll, { passive: true })
        return () => el.removeEventListener('scroll', onScroll)
    }, [enabled, api, barHeight])

    // Spring open when user types
    useEffect(() => {
        if (hasValue) api.start({ collapse: 0 })
    }, [hasValue, api])

    const handleClear = useCallback(() => {
        onChange('')
        inputRef.current?.focus()
    }, [onChange])

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            if (hasValue) {
                onChange('')
                inputRef.current?.focus()
            } else {
                inputRef.current?.blur()
            }
        }
    }, [hasValue, onChange])

    return (
        <div ref={mergedRef} className={`h-full overflow-y-auto ${className}`}>
            {enabled && (
                <animated.div
                    className="overflow-hidden"
                    style={{
                        height: spring.collapse.to(c => Math.max(0, barHeight - c)),
                        opacity: spring.collapse.to(c => 1 - (c / barHeight) * 0.6),
                    }}
                >
                    <div ref={searchRef} className="px-3 py-2">
                        <div className="flex items-center transition-colors duration-200 bg-themewhite text-tertiary rounded-full border border-themeblue3/10 shadow-xs focus-within:border-themeblue1/30 focus-within:bg-themewhite2">
                            <input
                                ref={inputRef}
                                type="search"
                                placeholder={placeholder}
                                value={value}
                                onChange={(e) => onChange(e.target.value)}
                                onFocus={onFocus}
                                onKeyDown={handleKeyDown}
                                className="text-tertiary bg-transparent outline-none text-[16px] w-full px-4 py-2 rounded-l-full min-w-0 [&::-webkit-search-cancel-button]:hidden"
                            />
                            {hasValue && (
                                <div
                                    className="flex items-center justify-center px-2 py-2 bg-themewhite2 stroke-themeblue3 rounded-r-full cursor-pointer transition-colors duration-200 hover:bg-themewhite shrink-0 active:scale-95"
                                    onClick={handleClear}
                                >
                                    <X className="w-5 h-5 stroke-themeblue1" />
                                </div>
                            )}
                        </div>
                    </div>
                </animated.div>
            )}
            {children}
        </div>
    )
}
