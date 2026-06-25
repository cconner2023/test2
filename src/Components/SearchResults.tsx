// Components/SearchResults.tsx - COMPLETE WORKING VERSION
import { useState, useEffect, useMemo } from 'react';
import type { SearchResultType } from "../Types/CatTypes";
import { LoadingSpinner } from './LoadingSpinner';
import { useMinLoadTime } from '../Hooks/useMinLoadTime';
import { Chip, ChipBar } from './Chip';

export interface SearchResultsProps {
    results: SearchResultType[]
    searchTerm: string
    onResultClick: (result: SearchResultType) => void
    isSearching?: boolean
}

import { kbCategories } from '../Data/KnowledgeBaseCategories'

// Badge configuration map for cleaner lookup
const BADGE_CONFIG: Record<string, { label: string; className: string }> = {
    category: { label: 'CATEGORY', className: 'bg-themeblue3/15 text-themeblue1' },
    CC: { label: 'COMPLAINT', className: 'bg-themewhite2 text-secondary' },
    medication: { label: 'MEDICATION', className: 'bg-themeyellowlow/30 text-secondary' },
    training: { label: 'GUIDELINE', className: 'bg-themewhite2 text-themeblue1' },
    DDX: { label: 'DDX', className: 'bg-themewhite2 text-themeblue1' },
    screener: { label: 'SCREENER', className: 'bg-themegreen/15 text-themegreen' },
    calculator: { label: 'CALCULATOR', className: 'bg-themeblue2/15 text-themeblue2' },
    'chat-contact': { label: 'CHAT', className: 'bg-themeblue1/15 text-themeblue1' },
    'chat-group': { label: 'GROUP', className: 'bg-themeblue1/15 text-themeblue1' },
    'chat-message': { label: 'MESSAGE', className: 'bg-themeblue1/15 text-themeblue1' },
    'calendar-event': { label: 'EVENT', className: 'bg-themepurple/15 text-themepurple' },
    'map-overlay': { label: 'MAP', className: 'bg-themeyellow/15 text-themeyellow' },
    'map-feature': { label: 'MAP PIN', className: 'bg-themeyellow/15 text-themeyellow' },
    'property-item': { label: 'ITEM', className: 'bg-themeblue2/15 text-themeblue2' },
    'property-zone': { label: 'ZONE', className: 'bg-themeblue2/15 text-themeblue2' },
    'da2062': { label: 'DA 2062', className: 'bg-themeblue2/15 text-themeblue2' },
}

// Result type → scope bucket for the filter chips.
type Scope = 'all' | 'clinical' | 'comms' | 'calendar' | 'map' | 'property'

const SCOPE_OF: Record<string, Exclude<Scope, 'all'>> = {
    category: 'clinical', CC: 'clinical', DDX: 'clinical',
    training: 'clinical', screener: 'clinical', calculator: 'clinical',
    medication: 'clinical',
    'chat-contact': 'comms', 'chat-group': 'comms', 'chat-message': 'comms',
    'calendar-event': 'calendar',
    'map-overlay': 'map', 'map-feature': 'map',
    'property-item': 'property', 'property-zone': 'property', 'da2062': 'property',
}

// Display order + labels for the scope chips.
const SCOPES: { key: Exclude<Scope, 'all'>; label: string }[] = [
    { key: 'clinical', label: 'Clinical' },
    { key: 'comms', label: 'Comms' },
    { key: 'calendar', label: 'Calendar' },
    { key: 'map', label: 'Map' },
    { key: 'property', label: 'Property' },
]

// Only surface a bucket's count once it's crowded enough that its size helps the
// user decide whether to filter into it.
const COUNT_HINT_THRESHOLD = 10

// Training type specific labels
const TRAINING_LABELS: Record<string, string> = {
    medcom: 'MEDCOM',
    'stp-task': 'STP TASK',
}

// Get badge info for a result - simplified
function getBadgeInfo(result: SearchResultType) {
    const config = BADGE_CONFIG[result.type] || { label: '', className: '' }

    // Override label for training types based on guidelineType
    if (result.type === 'training' && result.data?.guidelineType) {
        const label = TRAINING_LABELS[result.data.guidelineType]
        if (label) return { ...config, label }
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
        <div className={`text-[9pt] px-2 py-1 rounded-md ${className} shrink-0`}>
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
    const showLoading = useMinLoadTime(isSearching)
    const [scope, setScope] = useState<Scope>('all')

    // Reset to All only when the box is emptied — not on every keystroke, so a
    // chosen scope survives further typing.
    useEffect(() => { if (!searchTerm.trim()) setScope('all') }, [searchTerm])

    // Per-scope counts from the full result set (drives which chips render).
    const counts = useMemo(() => {
        const c: Record<string, number> = {}
        for (const r of results) {
            const s = SCOPE_OF[r.type]
            if (s) c[s] = (c[s] ?? 0) + 1
        }
        return c
    }, [results])

    const visible = useMemo(
        () => scope === 'all' ? results : results.filter(r => SCOPE_OF[r.type] === scope),
        [results, scope],
    )

    if (!searchTerm.trim()) {
        return (
            <div className="h-full w-full mx-5 py-2 flex items-center justify-center text-tertiary">
                <p>Search symptoms, medications, screeners, or training</p>
            </div>
        )
    }

    // Searching state
    if (showLoading) {
        return (
            <LoadingSpinner size="md" label={`Searching for "${searchTerm}"...`} className="h-full w-full text-tertiary" />
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

    // Scope chips — only when there's more than one bucket to choose between.
    const presentScopes = SCOPES.filter(s => counts[s.key] > 0)

    // Results state
    return (
        <div className="flex flex-col h-full">
            {presentScopes.length >= 2 && (
                <div className="px-3 pt-2">
                    <ChipBar>
                        <Chip active={scope === 'all'} onClick={() => setScope('all')}>
                            All
                        </Chip>
                        {presentScopes.map(s => (
                            <Chip key={s.key} active={scope === s.key} onClick={() => setScope(s.key)}>
                                {s.label}
                                {counts[s.key] >= COUNT_HINT_THRESHOLD && (
                                    <span className="ml-1 opacity-60">{counts[s.key]}</span>
                                )}
                            </Chip>
                        ))}
                    </ChipBar>
                </div>
            )}
            <div className="px-3 py-2 text-[10pt] text-tertiary border-b border-themewhite2">
                Found {visible.length} result{visible.length !== 1 ? 's' : ''}
            </div>
            <div className="flex-1 overflow-y-auto pb-4">
                {visible.map((result, index) => (
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
                                <div className="font-normal text-primary truncate">
                                    {result.text}
                                </div>

                                {/* Breadcrumb for symptoms, guidelines, and training tasks */}
                                {(result.type === 'CC' || result.type === 'DDX') && result.data?.categoryRef && (
                                    <div className="text-[9pt] text-secondary mt-1">
                                        {result.data.categoryRef.text}
                                    </div>
                                )}
                                {result.type === 'training' && result.data?.guidelineType === 'stp-task' && result.data.skillLevel && (
                                    <div className="text-[9pt] text-secondary mt-1">
                                        {result.data.skillLevel} &gt; {result.data.subjectArea}
                                    </div>
                                )}
                                {result.type === 'training' && result.data?.guidelineType === 'medcom' && result.data?.categoryRef && (
                                    <div className="text-[9pt] text-secondary mt-1">
                                        {result.data.categoryRef.text}
                                    </div>
                                )}
                                {(result.type === 'screener' || result.type === 'calculator') && result.data?.kbCategoryId && (
                                    <div className="text-[9pt] text-secondary mt-1">
                                        {kbCategories.find(c => c.id === result.data!.kbCategoryId)?.description}
                                    </div>
                                )}
                                {result.type === 'chat-message' && result.data?.chatSubtitle && (
                                    <div className="text-[9pt] text-secondary mt-1 truncate">
                                        {result.data.chatSubtitle}
                                    </div>
                                )}
                                {result.type === 'chat-contact' && result.data?.chatSubtitle && (
                                    <div className="text-[9pt] text-secondary mt-1 truncate">
                                        {result.data.chatSubtitle}
                                    </div>
                                )}
                                {result.type === 'calendar-event' && result.data?.eventSubtitle && (
                                    <div className="text-[9pt] text-secondary mt-1 truncate">
                                        {result.data.eventSubtitle}
                                    </div>
                                )}
                                {result.type === 'map-feature' && result.data?.featureSubtitle && (
                                    <div className="text-[9pt] text-secondary mt-1 truncate">
                                        {result.data.featureSubtitle}
                                    </div>
                                )}
                                {(result.type === 'property-item' || result.type === 'da2062') && result.data?.propertySubtitle && (
                                    <div className="text-[9pt] text-secondary mt-1 truncate">
                                        {result.data.propertySubtitle}
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