/** Shared search input with two variants:
 *  - `underline` (default): border-b only, search icon, used inline within panels/drawers/overlays.
 *  - `bordered`: rounded-full pill with shadow; reserved for NavTop and other top-level chrome.
 */
import { Search, X } from 'lucide-react'
import { forwardRef, useRef, type KeyboardEvent } from 'react'

interface SearchInputProps {
    value: string
    onChange: (value: string) => void
    onSubmit?: () => void
    placeholder?: string
    className?: string
    autoFocus?: boolean
    hideSearchIcon?: boolean
    variant?: 'underline' | 'bordered'
    onFocus?: () => void
    onBlur?: () => void
    onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void
    dataTour?: string
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
    function SearchInput(
        {
            value,
            onChange,
            onSubmit,
            placeholder = 'Search...',
            className = '',
            autoFocus = false,
            hideSearchIcon = false,
            variant = 'underline',
            onFocus,
            onBlur,
            onKeyDown,
            dataTour,
        },
        externalRef,
    ) {
        const fallbackRef = useRef<HTMLInputElement>(null)
        const setRef = (node: HTMLInputElement | null) => {
            fallbackRef.current = node
            if (typeof externalRef === 'function') externalRef(node)
            else if (externalRef) (externalRef as React.MutableRefObject<HTMLInputElement | null>).current = node
        }
        const hasValue = value.trim().length > 0
        const isBordered = variant === 'bordered'

        const wrapperClasses = isBordered
            ? `rounded-full border border-themeblue3/10 shadow-xs bg-themewhite
               focus-within:border-themeblue1/30 focus-within:bg-themewhite2`
            : `border-b border-themeblue3/15 bg-transparent
               focus-within:border-themeblue1/40`

        return (
            <div
                className={`relative flex items-center transition-all duration-300 ${wrapperClasses} ${className}`}
                {...(dataTour ? { 'data-tour': dataTour } : {})}
            >
                {!hideSearchIcon && (
                    <Search
                        size={16}
                        className={`absolute ${isBordered ? 'left-3' : 'left-1'} text-tertiary pointer-events-none`}
                    />
                )}
                <input
                    ref={setRef}
                    type="search"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onFocus={onFocus}
                    onBlur={onBlur}
                    onKeyDown={(e) => {
                        onKeyDown?.(e)
                        if (!e.defaultPrevented && e.key === 'Enter' && onSubmit) {
                            e.preventDefault()
                            onSubmit()
                        }
                    }}
                    placeholder={placeholder}
                    autoFocus={autoFocus}
                    className={`w-full bg-transparent outline-none text-[12pt] text-tertiary
                        ${hideSearchIcon ? 'pl-3' : isBordered ? 'pl-9' : 'pl-7'} pr-2 py-2
                        ${isBordered ? 'rounded-l-full' : ''} min-w-0 placeholder:text-tertiary
                        [&::-webkit-search-cancel-button]:hidden`}
                />
                {hasValue && onSubmit && (
                    <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={onSubmit}
                        className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center
                            bg-themeblue3 text-white active:scale-95 transition-all"
                        aria-label="Submit search"
                    >
                        <Search size={13} />
                    </button>
                )}
                {hasValue && (
                    <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { onChange(''); fallbackRef.current?.focus() }}
                        className={`flex items-center justify-center shrink-0 cursor-pointer transition-all duration-300
                            ${isBordered
                                ? 'px-2 py-2 bg-themewhite2 rounded-r-full hover:bg-themewhite'
                                : 'px-1 py-2 hover:opacity-70'}`}
                        aria-label="Clear search"
                    >
                        <X size={isBordered ? 18 : 16} className="stroke-themeblue1" />
                    </button>
                )}
            </div>
        )
    },
)
