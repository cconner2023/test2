// Components/SearchResults.tsx - Simplified
import type { SearchResultType } from '../Types/CatTypes'

interface SearchResultsProps {
    results: SearchResultType[]
    searchTerm: string
    onResultClick: (result: SearchResultType) => void
    isSearching?: boolean
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

    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto pb-4">
                {results.map((result, index) => (
                    <div
                        key={`${result.type}-${result.id || index}`}
                        className="px-2 py-2 w-full border-b border-themewhite2/50 hover:bg-themewhite2 cursor-pointer"
                        onClick={() => onResultClick(result)}
                    >
                        <div className="flex items-center gap-5">
                            <div className={`text-[8pt] px-2 py-2 rounded-md ${result.type === 'category' ? 'bg-themeblue3 text-primary' :
                                result.type === 'CC' ? 'bg-themewhite2 text-secondary' :
                                    result.type === 'medication' ? 'bg-themeyellowlow/30 text-secondary' :
                                        'bg-themewhite2 text-themeblue1'
                                }`}>
                                {result.type === 'category' ? 'CATEGORY' :
                                    result.type === 'CC' ? 'COMPLAINT' :
                                        result.type === 'medication' ? 'MEDICATION' :
                                            result.guidelineType === 'medcom' ? 'MEDCOM' :
                                                result.guidelineType === 'stp' ? 'STP MANUAL' : 'DDX'}
                            </div>
                            <div className="flex-1">
                                <div className="font-normal text-primary/70">{result.text}</div>
                                {result.contentText && (
                                    <div className="text-xs text-tertiary mt-1">
                                        {result.contentText}
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