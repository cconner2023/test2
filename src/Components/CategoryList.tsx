// Components/CategoryList.tsx - Updated
import type { catDataTypes, subCatDataTypes, SearchResultType } from '../Types/CatTypes'
import { catData } from '../Data/CatData'
import { useAppAnimate } from '../Utilities/AnimationConfig'

// Shared shape for guideline-like items (DDX, medcom, stp, gen all have text + optional id)
interface GuidelineItemData {
    text?: string
    id?: number
    icon?: string
}

// Guideline Item Component - Reusable for DDX, medcom, stp, gen
interface GuidelineItemProps {
    guideline: GuidelineItemData
    type: 'DDX' | 'medcom' | 'stp' | 'gen'
    index: number
    keyPrefix: string
    onClick: () => void
}

function GuidelineItem({ guideline, keyPrefix, index, onClick }: GuidelineItemProps) {
    if (!guideline?.text) return null

    return (
        <div
            key={`${keyPrefix}-${guideline.id || index}`}
            onClick={onClick}
            className="mb-3 p-3 rounded border border-themewhite2/10 cursor-pointer hover:bg-themewhite2"
        >
            <div className="text-xs font-normal text-secondary">
                {guideline.text}
            </div>
        </div>
    )
}

// Shared guideline section config to avoid duplicating the 4 identical sections
const GUIDELINE_SECTIONS = [
    { key: 'DDX' as const, label: 'Differentials', prefix: 'ddx', field: 'DDX' as const },
    { key: 'medcom' as const, label: 'MEDCOM Training', prefix: 'medcom', field: 'medcom' as const },
    { key: 'stp' as const, label: 'STP Training', prefix: 'stp', field: 'stp' as const },
    { key: 'gen' as const, label: 'General Guidelines', prefix: 'gen', field: 'gen' as const },
] as const

// Extracted: Symptom header + guideline sections (shared between desktop and mobile)
function SymptomGuidelines({
    symptom,
    category,
    onNavigate,
    guidelineToResult,
}: {
    symptom: subCatDataTypes
    category: catDataTypes
    onNavigate: (result: SearchResultType) => void
    guidelineToResult: (
        type: 'gen' | 'medcom' | 'stp' | 'DDX',
        item: GuidelineItemData,
        index: number,
        symptom: subCatDataTypes,
        category: catDataTypes
    ) => SearchResultType
}) {
    return (
        <>
            {/* Symptom Header */}
            <div className="mb-4 pb-4 border-b border-themewhite2">
                <div className="flex items-center gap-3 mb-2">
                    <div className="px-4 py-3 flex text-[12pt] font-bold items-center justify-center shrink-0 bg-themeblue3 text-white rounded-md">
                        {symptom.icon}
                    </div>
                    <h2 className="text-[11pt] font-semibold text-primary flex-1 min-w-0">
                        {symptom.text}
                    </h2>
                </div>
                {symptom.description && (
                    <p className="text-[9.5pt] text-secondary leading-relaxed mt-2 pl-1">
                        {symptom.description}
                    </p>
                )}
            </div>

            {/* Guideline Sections */}
            {GUIDELINE_SECTIONS.map(({ key, label, prefix, field }) => {
                const items = symptom[field] as GuidelineItemData[] | undefined
                if (!items || items.length === 0) return null
                return (
                    <div key={key} className="mb-3">
                        <h3 className="text-[9pt] font-semibold text-themeblue1 uppercase tracking-wide mb-2 pl-1">
                            {label}
                        </h3>
                        {items.map((item, index) => (
                            <GuidelineItem
                                key={`${prefix}-${item.id || index}`}
                                guideline={item}
                                type={key}
                                index={index}
                                keyPrefix={prefix}
                                onClick={() => onNavigate(guidelineToResult(key, item, index, symptom, category))}
                            />
                        ))}
                    </div>
                )
            })}
        </>
    )
}

/** Reusable row component for both categories and symptoms — eliminates duplicated markup */
function NavigationRow({
    icon,
    text,
    onClick,
    className = '',
    extraContentClassName = '',
}: {
    icon: string
    text: string
    onClick: () => void
    className?: string
    extraContentClassName?: string
}) {
    return (
        <div
            className={`flex py-3 px-2 w-full cursor-pointer min-w-0 ${className}`}
            onClick={onClick}
        >
            <div className="px-3 py-2 flex text-[10pt] font-bold items-center justify-center shrink-0 bg-themeblue3 text-white rounded-md">
                {icon}
            </div>
            <div className={`h-full flex-1 min-w-0 p-[4px_10px_4px_10px] text-primary text-[10pt] flex items-center truncate ${extraContentClassName}`}>
                {text}
            </div>
        </div>
    )
}

interface CategoryListProps {
    selectedCategory: catDataTypes | null
    selectedSymptom: subCatDataTypes | null
    selectedGuideline: {
        type: 'gen' | 'medcom' | 'stp' | 'DDX',
        id: number;
        symptomId: number;
    } | null
    onNavigate: (result: SearchResultType) => void
    desktopMode?: boolean
}

export function CategoryList({
    selectedCategory,
    selectedSymptom,
    selectedGuideline,
    onNavigate,
    desktopMode = false,
}: CategoryListProps) {
    const [parentRef] = useAppAnimate('fast')

    // Helper to convert category to SearchResultType
    const categoryToResult = (category: catDataTypes): SearchResultType => ({
        type: 'category',
        id: category.id,
        icon: category.icon,
        text: category.text,
        data: { categoryRef: category }
    })

    // Helper to convert symptom to SearchResultType
    const symptomToResult = (symptom: subCatDataTypes, category: catDataTypes): SearchResultType => ({
        type: 'CC',
        id: symptom.id,
        icon: symptom.icon,
        text: symptom.text,
        data: {
            categoryId: category.id,
            symptomId: symptom.id,
            categoryRef: category,
            symptomRef: symptom
        }
    })

    // Helper to convert guideline to SearchResultType
    const guidelineToResult = (
        type: 'gen' | 'medcom' | 'stp' | 'DDX',
        item: GuidelineItemData,
        index: number,
        symptom: subCatDataTypes,
        category: catDataTypes
    ): SearchResultType => ({
        type: type === 'DDX' ? 'DDX' : 'training',
        id: item.id || index,
        icon: item.icon || (type === 'DDX' ? 'DDX' : '\u{1F4DD}'),
        text: item.text,
        data: {
            categoryId: category.id,
            symptomId: symptom.id,
            categoryRef: category,
            symptomRef: symptom,
            guidelineType: type === 'DDX' ? undefined : type,
            guidelineId: item.id || index
        }
    })

    // Desktop mode: Full navigation flow in a single column (master-detail Column 1)
    // Shows categories → subcategories → symptom info all stacked vertically
    if (desktopMode) {
        return (
            <div ref={parentRef} className="h-full w-full">
                {(!catData || !Array.isArray(catData)) ? (
                    <div key="error" className="h-full flex items-center justify-center text-primary">
                        Error loading category data
                    </div>
                ) : (
                    <div key="desktop-nav" className="flex flex-col h-full w-full">
                        <div className="flex-1 overflow-y-auto pb-4">
                            {/* State 1: No category selected - show all categories */}
                            {!selectedCategory && catData.map((category) => (
                                category && (
                                    <div
                                        key={category.id}
                                        className="flex py-3 px-2 w-full rounded-md border-b border-themewhite2/90 cursor-pointer hover:bg-themewhite2 min-w-0"
                                        onClick={() => onNavigate(categoryToResult(category))}
                                    >
                                        <div className="px-3 py-2 flex text-[10pt] font-bold items-center justify-center shrink-0 bg-themeblue3 text-white rounded-md">
                                            {category.icon}
                                        </div>
                                        <div className="h-full flex-1 min-w-0 p-[4px_10px_4px_10px] text-primary text-[10pt] flex items-center truncate">
                                            {category.text}
                                        </div>
                                    </div>
                                )
                            ))}

                            {/* State 2: Category selected, no symptom - show its symptoms */}
                            {selectedCategory && !selectedSymptom && (
                                <>
                                    {selectedCategory.contents?.map((symptom) => (
                                        symptom && (
                                            <div
                                                key={symptom.id}
                                                className="flex py-3 px-2 w-full rounded-sm border-b border-themewhite2/70 cursor-pointer min-w-0 hover:bg-themewhite2"
                                                onClick={() => onNavigate(symptomToResult(symptom, selectedCategory))}
                                            >
                                                <div className="px-3 py-2 flex text-[10pt] font-bold items-center justify-center shrink-0 bg-themeblue3 text-white rounded-md">
                                                    {symptom.icon || "?"}
                                                </div>
                                                <div className="h-full flex-1 min-w-0 text-primary text-[10pt] p-[4px_10px_4px_10px] flex items-center truncate">
                                                    {symptom.text || "Untitled Symptom"}
                                                </div>
                                            </div>
                                        )
                                    ))}
                                </>
                            )}

                            {/* State 3: Symptom selected - show symptom header and guidelines */}
                            {selectedSymptom && selectedCategory && (
                                <SymptomGuidelines
                                    symptom={selectedSymptom}
                                    category={selectedCategory}
                                    onNavigate={onNavigate}
                                    guidelineToResult={guidelineToResult}
                                />
                            )}
                        </div>
                    </div>
                )}
            </div>
        )
    }

    // Mobile mode: original behavior
    return (
        <div ref={parentRef} className="h-full w-full">
            {(!catData || !Array.isArray(catData)) ? (
                <div key="error" className="h-full flex items-center justify-center text-primary">
                    Error loading category data
                </div>
            ) : (
                <>
                    {!selectedCategory && !selectedSymptom && (
                        <div key="main" className="flex flex-col h-full w-full">
                            <div className="flex-1 overflow-y-auto pb-4 bg-themewhite">
                                {catData.map((category) => (
                                    category && (
                                        <div
                                            key={category.id}
                                            className="flex py-3 px-2 w-full rounded-md border-b border-themewhite2/90 cursor-pointer hover:bg-themewhite2 min-w-0"
                                            onClick={() => onNavigate(categoryToResult(category))}
                                        >
                                            <div className="px-3 py-2 flex text-[10pt] font-bold items-center justify-center shrink-0 bg-themeblue3 text-white rounded-md">
                                                {category.icon}
                                            </div>
                                            <div className="h-full flex-1 min-w-0 p-[4px_10px_4px_10px] text-primary text-[10pt] flex items-center truncate">
                                                {category.text}
                                            </div>
                                        </div>
                                    )
                                ))}
                            </div>
                        </div>
                    )}

                    {/* VIEW 2: Subcategory View - Show only selected category's symptoms */}
                    {selectedCategory && !selectedSymptom && (
                        <div key="cat" className="flex flex-col h-full w-full">
                            <div className="h-full flex-1 overflow-y-auto pb-4 bg-themewhite">
                                {selectedCategory.contents?.map((symptom) => (
                                    symptom && (
                                        <div
                                            key={symptom.id}
                                            className="flex py-3 px-2 w-full rounded-sm border-b border-themewhite2/70 cursor-pointer  min-w-0"
                                            onClick={() => onNavigate(symptomToResult(symptom, selectedCategory))}
                                        >
                                            <div className="px-3 py-2 flex text-[10pt] font-bold items-center justify-center shrink-0 bg-themeblue3 text-white rounded-md">
                                                {symptom.icon || "?"}
                                            </div>
                                            <div className="h-full flex-1 min-w-0 bg-themewhite text-primary text-[10pt] p-[4px_10px_4px_10px] flex items-center truncate">
                                                {symptom.text || "Untitled Symptom"}
                                            </div>
                                        </div>
                                    )
                                ))}
                            </div>
                        </div>
                    )}

                    {/* VIEW 3: Questions View - Show only selected symptom with guidelines */}
                    {selectedSymptom && selectedCategory && (
                        <div key="sym" className="flex flex-col h-full w-full">
                            <div className="flex-1 overflow-y-auto p-4">
                                <SymptomGuidelines
                                    symptom={selectedSymptom}
                                    category={selectedCategory}
                                    onNavigate={onNavigate}
                                    guidelineToResult={guidelineToResult}
                                />
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
