/** Shared pill-shaped search input matching the NavTop search style. */
import { Search, X } from 'lucide-react'
import { useRef } from 'react'

interface SearchInputProps {
    value: string
    onChange: (value: string) => void
    onSubmit?: () => void
    placeholder?: string
    className?: string
    autoFocus?: boolean
    hideSearchIcon?: boolean
}

export const SearchInput = ({
    value,
    onChange,
    onSubmit,
    placeholder = 'Search...',
    className = '',
    autoFocus = false,
    hideSearchIcon = false,
}: SearchInputProps) => {
    const inputRef = useRef<HTMLInputElement>(null)
    const hasValue = value.trim().length > 0

    return (
        <div
            className={`relative flex items-center rounded-full border border-themeblue3/10 shadow-xs bg-themewhite
                focus-within:border-themeblue1/30 focus-within:bg-themewhite2 transition-all duration-300 ${className}`}
        >
            {!hideSearchIcon && <Search size={16} className="absolute left-3 text-tertiary/50 pointer-events-none" />}
            <input
                ref={inputRef}
                type="search"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && onSubmit) { e.preventDefault(); onSubmit() } }}
                placeholder={placeholder}
                autoFocus={autoFocus}
                className={`w-full bg-transparent outline-none text-[16px] text-tertiary ${hideSearchIcon ? 'pl-3' : 'pl-9'} pr-2 py-2
                    rounded-l-full min-w-0 placeholder:text-tertiary/30
                    [&::-webkit-search-cancel-button]:hidden`}
            />
            {hasValue && onSubmit && (
                <button
                    type="button"
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
                    onClick={() => { onChange(''); inputRef.current?.focus() }}
                    className="flex items-center justify-center px-2 py-2 bg-themewhite2 rounded-r-full
                        cursor-pointer transition-all duration-300 hover:bg-themewhite shrink-0"
                >
                    <X size={18} className="stroke-themeblue1" />
                </button>
            )}
        </div>
    )
}
