// Components/SearchResults.tsx — the lifted search dropdown.
//
// Renders as a floating card anchored directly under the search row that owns
// it (NavTop pill on desktop, the collapsing bar on mobile). It overlays the
// page instead of replacing it — callers position it (absolute, under the
// row); this component owns only the card chrome, rows and states.
import { useState, useEffect, useMemo } from 'react';
import {
    LayoutGrid, Stethoscope, ListTree, Pill, GraduationCap, ClipboardCheck,
    Calculator, User, Users, MessageSquare, CalendarDays, Layers, MapPin,
    Package, Warehouse, FileText, Search, type LucideIcon,
} from 'lucide-react';
import type { SearchResultType } from "../Types/CatTypes";
import { Skeleton } from '@/Components/primitives/Skeleton';
import { useMinLoadTime } from '../Hooks/useMinLoadTime';
import { UnderlineTabs } from '@/Components/primitives/UnderlineTabs';
import { kbCategories } from '../Data/KnowledgeBaseCategories'

export interface SearchResultsProps {
    results: SearchResultType[]
    searchTerm: string
    onResultClick: (result: SearchResultType) => void
    isSearching?: boolean
    className?: string
}

// Per-type avatar: icon + tint for the leading circle, label for the fallback subtitle.
const TYPE_CONFIG: Record<string, { label: string; icon: LucideIcon; tint: string }> = {
    category: { label: 'Category', icon: LayoutGrid, tint: 'bg-themeblue3/15 text-themeblue1' },
    CC: { label: 'Complaint', icon: Stethoscope, tint: 'bg-themeblue3/10 text-themeblue1' },
    medication: { label: 'Medication', icon: Pill, tint: 'bg-themeyellowlow/30 text-secondary' },
    training: { label: 'Guideline', icon: GraduationCap, tint: 'bg-themeblue3/10 text-themeblue1' },
    DDX: { label: 'DDX', icon: ListTree, tint: 'bg-themeblue3/10 text-themeblue1' },
    screener: { label: 'Screener', icon: ClipboardCheck, tint: 'bg-themegreen/15 text-themegreen' },
    calculator: { label: 'Calculator', icon: Calculator, tint: 'bg-themeblue2/15 text-themeblue2' },
    'chat-contact': { label: 'Chat', icon: User, tint: 'bg-themeblue1/15 text-themeblue1' },
    'chat-group': { label: 'Group', icon: Users, tint: 'bg-themeblue1/15 text-themeblue1' },
    'chat-message': { label: 'Message', icon: MessageSquare, tint: 'bg-themeblue1/15 text-themeblue1' },
    'calendar-event': { label: 'Event', icon: CalendarDays, tint: 'bg-themepurple/15 text-themepurple' },
    'map-overlay': { label: 'Map', icon: Layers, tint: 'bg-themeyellow/15 text-themeyellow' },
    'map-feature': { label: 'Map pin', icon: MapPin, tint: 'bg-themeyellow/15 text-themeyellow' },
    'property-item': { label: 'Item', icon: Package, tint: 'bg-themeblue2/15 text-themeblue2' },
    'property-zone': { label: 'Zone', icon: Warehouse, tint: 'bg-themeblue2/15 text-themeblue2' },
    'da2062': { label: 'DA 2062', icon: FileText, tint: 'bg-themeblue2/15 text-themeblue2' },
}

const FALLBACK_TYPE = { label: '', icon: Search, tint: 'bg-themewhite2 text-tertiary' }

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

const SCOPES: { key: Exclude<Scope, 'all'>; label: string }[] = [
    { key: 'clinical', label: 'Clinical' },
    { key: 'comms', label: 'Comms' },
    { key: 'calendar', label: 'Calendar' },
    { key: 'map', label: 'Map' },
    { key: 'property', label: 'Property' },
]

const TRAINING_LABELS: Record<string, string> = {
    medcom: 'MEDCOM',
    'stp-task': 'STP task',
}

function typeLabel(result: SearchResultType): string {
    if (result.type === 'training' && result.data?.guidelineType) {
        const label = TRAINING_LABELS[result.data.guidelineType]
        if (label) return label
    }
    return (TYPE_CONFIG[result.type] ?? FALLBACK_TYPE).label
}

/** Secondary line: the result's context (breadcrumb / subtitle) when it has
 *  one, prefixed by its type so the row still says what kind of thing it is. */
function subtitleFor(result: SearchResultType): string {
    const d = result.data
    let detail: string | undefined
    if ((result.type === 'CC' || result.type === 'DDX') && d?.categoryRef) detail = d.categoryRef.text
    else if (result.type === 'training' && d?.guidelineType === 'stp-task' && d.skillLevel) detail = `${d.skillLevel} › ${d.subjectArea}`
    else if (result.type === 'training' && d?.guidelineType === 'medcom' && d?.categoryRef) detail = d.categoryRef.text
    else if ((result.type === 'screener' || result.type === 'calculator') && d?.kbCategoryId) detail = kbCategories.find(c => c.id === d.kbCategoryId)?.description
    else if ((result.type === 'chat-message' || result.type === 'chat-contact') && d?.chatSubtitle) detail = d.chatSubtitle
    else if (result.type === 'calendar-event' && d?.eventSubtitle) detail = d.eventSubtitle
    else if (result.type === 'map-feature' && d?.featureSubtitle) detail = d.featureSubtitle
    else if ((result.type === 'property-item' || result.type === 'da2062') && d?.propertySubtitle) detail = d.propertySubtitle
    const label = typeLabel(result)
    if (!detail) return label
    return label ? `${label} · ${detail}` : detail
}

export function SearchResults({
    results,
    searchTerm,
    onResultClick,
    isSearching = false,
    className = '',
}: SearchResultsProps) {
    const showLoading = useMinLoadTime(isSearching)
    const [scope, setScope] = useState<Scope>('all')

    // Reset to All only when the box is emptied — a chosen scope survives typing.
    useEffect(() => { if (!searchTerm.trim()) setScope('all') }, [searchTerm])

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

    // Nothing typed → no dropdown.
    if (!searchTerm.trim()) return null

    const presentScopes = SCOPES.filter(s => counts[s.key] > 0)

    let body: React.ReactNode
    if (showLoading) {
        body = (
            <div className="py-1" aria-hidden="true">
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                        <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                        <div className="flex-1 min-w-0 space-y-2">
                            <Skeleton className="h-3.5 w-3/5 rounded-full" />
                            <Skeleton className="h-2.5 w-2/5 rounded-full" />
                        </div>
                    </div>
                ))}
            </div>
        )
    } else if (results.length === 0) {
        body = (
            <div className="px-4 py-6 text-center">
                <p className="text-[10pt] text-primary">No results for "{searchTerm.trim()}"</p>
                <p className="text-[9pt] text-tertiary mt-1">Try different keywords</p>
            </div>
        )
    } else {
        body = (
            <>
                {presentScopes.length >= 2 && (
                    <UnderlineTabs
                        tabs={[{ key: 'all' as Scope, label: 'All' }, ...presentScopes]}
                        value={scope}
                        onChange={setScope}
                        ariaLabel="Result type"
                        className="shrink-0 px-4 mb-1 border-b border-primary/6"
                    />
                )}
                <div className="min-h-0 overflow-y-auto overscroll-contain pb-2">
                    {visible.map((result, index) => {
                        const { icon: Icon, tint } = TYPE_CONFIG[result.type] ?? FALLBACK_TYPE
                        return (
                            <button
                                type="button"
                                key={`${result.type}-${result.id}-${result.data?.categoryId || 0}-${index}`}
                                // No preventDefault on mousedown: the pick must blur the field so
                                // the mobile bars drop their focused state and resume scroll-collapse.
                                onClick={() => onResultClick(result)}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-themewhite2 active:bg-themewhite2 transition-colors"
                            >
                                <span className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${tint}`}>
                                    <Icon className="w-[18px] h-[18px]" />
                                </span>
                                <span className="flex-1 min-w-0">
                                    <span className="block text-[11pt] text-primary truncate">{result.text}</span>
                                    <span className="block text-[9pt] text-tertiary truncate mt-0.5">{subtitleFor(result)}</span>
                                </span>
                            </button>
                        )
                    })}
                </div>
            </>
        )
    }

    return (
        <div
            className={`flex flex-col max-h-[min(70vh,560px)] rounded-2xl bg-themewhite border border-primary/6 shadow-lg overflow-hidden pt-1 animate-surface-in-down ${className}`}
            aria-label="Search results"
        >
            {body}
        </div>
    )
}
