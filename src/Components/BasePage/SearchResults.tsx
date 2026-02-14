// Components/SearchResults.tsx - COMPLETE WORKING VERSION
import type { SearchResultType } from '../../Types/CatTypes'

export interface SearchResultsProps {
    results: SearchResultType[]
    searchTerm: string
    onResultClick: (result: SearchResultType) => void
    isSearching?: boolean
}

// Badge configuration map for cleaner lookup
const BADGE_CONFIG: Record<string, { label: string; className: string }> = {
    category: { label: 'CATEGORY', className: 'bg-themeblue3 text-primary' },
    CC: { label: 'COMPLAINT', className: 'bg-themewhite2 text-secondary' },
    medication: { label: 'MEDICATION', className: 'bg-themeyellowlow/30 text-secondary' },
    training: { label: 'GUIDELINE', className: 'bg-themewhite2 text-themeblue1' },
    DDX: { label: 'DDX', className: 'bg-themewhite2 text-themeblue1' },
}

// Training type specific labels
const TRAINING_LABELS: Record<string, string> = {
    medcom: 'MEDCOM',
    stp: 'STP',
    gen: 'GUIDELINE'
}

// Get badge info for a result - simplified
function getBadgeInfo(result: SearchResultType) {
    const config = BADGE_CONFIG[result.type] || { label: '', className: '' }

    // Override label for training types
    if (result.type === 'training' && result.icon && TRAINING_LABELS[result.icon]) {
        return { ...config, label: TRAINING_LABELS[result.icon] }
    }

    return config
}

// Badge component for consistent rendering
interface ResultBadgeProps {
    result: SearchResultType
}

function ResultBadge({ result }: ResultBadgeProps) {
    const { label, className } = getBadgeInfo(result)
    return (
        <div className={`text-[8pt] px-2 py-1 rounded-md ${className} shrink-0`}>
            {label}
        </div>
    )
}

export function SearchResults({
    results,
    searchTerm,
    onResultClick,
    isSearching = false
}: SearchResultsProps) {
    if (!searchTerm.trim()) {
        return (
            <div className="h-full w-full mx-5 py-2 flex items-center justify-center text-tertiary">
                <p>Search for symptoms, guidelines, or medications</p>
            </div>
        )
    }

    // Searching state
    if (isSearching) {
        return (
            <div className="h-full w-full flex items-center justify-center text-themeblue1">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-themeblue3 mx-auto mb-3"></div>
                    <p>Searching for "{searchTerm}"...</p>
                </div>
            </div>
        )
    }

    // No results state
    if (results.length === 0) {
        return (
            <div className="h-full flex items-center justify-center text-themeblue1">
                <div className="text-center">
                    <p>No results found for "{searchTerm}"</p>
                    <p className="text-sm mt-2">Try different keywords</p>
                </div>
            </div>
        )
    }

    // Results state
    return (
        <div className="flex flex-col h-full">
            <div className="px-3 py-2 text-xs text-tertiary border-b border-themewhite2">
                Found {results.length} result{results.length !== 1 ? 's' : ''}
            </div>
            <div className="flex-1 overflow-y-auto pb-4">
                {results.map((result, index) => (
                    <div
                        key={`${result.type}-${result.id}-${result.data?.categoryId || 0}-${index}`}
                        className="px-2 py-3 w-full border-b border-themewhite2/50 hover:bg-themewhite2 cursor-pointer transition-colors"
                        onClick={() => onResultClick(result)}
                    >
                        <div className="flex items-start gap-3">
                            {/* Type Badge */}
                            <ResultBadge result={result} />

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                {/* Main text */}
                                <div className="font-normal text-primary/90 truncate">
                                    {result.text}
                                </div>

                                {/* Category for symptoms and guidelines */}
                                {(result.type === 'CC' || result.type === 'training' || result.type === 'DDX') && result.data?.categoryRef && (
                                    <div className="text-[10px] text-themeblue1/70 mt-1">
                                        {result.data.categoryRef.text}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}