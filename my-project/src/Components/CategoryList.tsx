// Components/CategoryList.tsx - Updated
import type { catDataTypes, subCatDataTypes, SearchResultType } from '../Types/CatTypes'
import { catData } from '../Data/CatData'
import { useAppAnimate } from '../Utilities/AnimationConfig'

// Shared shape for guideline-like items (DDX, medcom, stp, gen all have text + optional id)
export interface GuidelineItemData {
    text?: string
    id?: number
    icon?: string
}

// Extracted: Symptom header + guideline sections (shared between desktop and mobile)
// UI modeled after QuestionCard — card-based layout with dot connectors
export function SymptomGuidelines({
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
    // General info rendered in the header card
    const genItems = symptom.gen as GuidelineItemData[] | undefined
    const genText = genItems?.filter(item => item.text)

    // Collect non-gen sections
    const sections: { key: string; label: string; type: 'gen' | 'medcom' | 'stp' | 'DDX'; items: GuidelineItemData[] }[] = []

    const ddxItems = symptom.DDX as GuidelineItemData[] | undefined
    if (ddxItems && ddxItems.length > 0) {
        sections.push({ key: 'ddx', label: 'Differentials (DDx)', type: 'DDX', items: ddxItems })
    }

    const medcomItems = symptom.medcom as GuidelineItemData[] | undefined
    if (medcomItems && medcomItems.length > 0) {
        sections.push({ key: 'medcom', label: 'MEDCOM Training', type: 'medcom', items: medcomItems })
    }

    const stpItems = symptom.stp as GuidelineItemData[] | undefined
    if (stpItems && stpItems.length > 0) {
        sections.push({ key: 'stp', label: 'STP Training', type: 'stp', items: stpItems })
    }

    return (
        <div className="space-y-0">
            {/* Symptom Header Card — includes general guideline info */}
            <div className="flex flex-col items-center">
                <div className="flex flex-col rounded-md w-full overflow-hidden shadow-sm bg-themewhite2 border border-themewhite/10">
                    <div className="px-4 py-3 text-primary/80">
                        <div className="text-[10pt] font-semibold">
                            {symptom.text}
                        </div>
                        <div className="text-[8pt] text-secondary mt-0.5">
                            {category.text}
                        </div>
                        {symptom.description && (
                            <div className="text-[9pt] text-secondary leading-relaxed mt-2">
                                {symptom.description}
                            </div>
                        )}
                    </div>

                    {/* General Information inline in header card */}
                    {genText && genText.length > 0 && (
                        <div className="px-3 pt-0 pb-3">
                            <div className="text-[9pt] font-semibold uppercase tracking-wider text-primary/80 px-1 mb-2">
                                General Information
                            </div>
                            <div className="space-y-2">
                                {genText.map((item, index) => (
                                    <div
                                        key={`gen-${item.id || index}`}
                                        onClick={() => onNavigate(guidelineToResult('gen', item, index, symptom, category))}
                                        className="text-xs p-2 rounded-md bg-themewhite3 text-tertiary cursor-pointer transition-all duration-200 hover:bg-themewhite"
                                    >
                                        <div className="font-normal">
                                            {item.text}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Connector to first section */}
                {sections.length > 0 && (
                    <div className="flex flex-col items-center py-1">
                    </div>
                )}
            </div>

            {/* Guideline Section Cards */}
            {sections.map((section, sectionIdx) => {
                const isTraining = section.type === 'medcom' || section.type === 'stp'

                return (
                    <div key={section.key} className="flex flex-col items-center">
                        <div className="flex flex-col rounded-md w-full overflow-hidden shadow-sm bg-themewhite2 border border-themewhite/10">
                            {/* Section Header */}
                            <div className="px-4 py-3 text-primary/80">
                                <div className="text-[9pt] font-semibold uppercase tracking-wider">
                                    {section.label}
                                </div>
                            </div>

                            {/* Section Items */}
                            <div className="px-3 pt-0 pb-3">
                                <div className="space-y-2">
                                    {section.items.map((item, index) => (
                                        <div
                                            key={`${section.key}-${item.id || index}`}
                                            onClick={() => onNavigate(guidelineToResult(section.type, item, index, symptom, category))}
                                            className="text-xs p-2 rounded-md bg-themewhite3 text-tertiary cursor-pointer transition-all duration-200 hover:bg-themewhite"
                                        >
                                            <div className="font-normal">
                                                {isTraining && item.icon && (
                                                    <span className="text-tertiary mr-1.5 text-[8pt]">{item.icon}</span>
                                                )}
                                                {item.text}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Dot connector between sections */}
                        {sectionIdx < sections.length - 1 && (
                            <div className="flex flex-col items-center py-1">
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
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
    /** When set, renders only the specified mobile carousel panel (no conditional switching, no key remounts) */
    mobilePanel?: 'main' | 'subcategory' | 'guidelines'
}

export function CategoryList({
    selectedCategory,
    selectedSymptom,
    selectedGuideline,
    onNavigate,
    desktopMode = false,
    mobilePanel,
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
        text: item.text ?? '',
        data: {
            categoryId: category.id,
            symptomId: symptom.id,
            categoryRef: category,
            symptomRef: symptom,
            guidelineType: type === 'DDX' ? undefined : type,
            guidelineId: item.id || index
        }
    })

    // Mobile carousel panel mode: render a single always-mounted view
    // Each panel is a separate instance in App.tsx's carousel — no conditional switching
    if (mobilePanel) {
        switch (mobilePanel) {
            case 'main':
                return (
                    <div className="flex flex-col h-full w-full">
                        <div className="flex-1 overflow-y-auto pb-4 bg-themewhite">
                            {catData.map((category) => (
                                category && (
                                    <NavigationRow
                                        key={category.id}
                                        icon={category.icon}
                                        text={category.text}
                                        onClick={() => onNavigate(categoryToResult(category))}
                                        className="rounded-md border-b border-themewhite2/90 hover:bg-themewhite2"
                                    />
                                )
                            ))}
                        </div>
                    </div>
                )
            case 'subcategory':
                return (
                    <div className="flex flex-col h-full w-full">
                        <div className="h-full flex-1 overflow-y-auto pb-4 bg-themewhite">
                            {selectedCategory?.contents?.map((symptom) => (
                                symptom && (
                                    <NavigationRow
                                        key={symptom.id}
                                        icon={symptom.icon || "?"}
                                        text={symptom.text || "Untitled Symptom"}
                                        onClick={() => onNavigate(symptomToResult(symptom, selectedCategory))}
                                        className="rounded-sm border-b border-themewhite2/70"
                                        extraContentClassName="bg-themewhite"
                                    />
                                )
                            ))}
                        </div>
                    </div>
                )
            case 'guidelines':
                return (
                    <div className="flex flex-col h-full w-full">
                        {selectedSymptom && selectedCategory ? (
                            <div className="flex-1 overflow-y-auto p-4">
                                <SymptomGuidelines
                                    symptom={selectedSymptom}
                                    category={selectedCategory}
                                    onNavigate={onNavigate}
                                    guidelineToResult={guidelineToResult}
                                />
                            </div>
                        ) : null}
                    </div>
                )
        }
    }

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
                                    <NavigationRow
                                        key={category.id}
                                        icon={category.icon}
                                        text={category.text}
                                        onClick={() => onNavigate(categoryToResult(category))}
                                        className="rounded-md border-b border-themewhite2/90 hover:bg-themewhite2"
                                    />
                                )
                            ))}

                            {/* State 2: Category selected, no symptom - show its symptoms */}
                            {selectedCategory && !selectedSymptom && (
                                <>
                                    {selectedCategory.contents?.map((symptom) => (
                                        symptom && (
                                            <NavigationRow
                                                key={symptom.id}
                                                icon={symptom.icon || "?"}
                                                text={symptom.text || "Untitled Symptom"}
                                                onClick={() => onNavigate(symptomToResult(symptom, selectedCategory))}
                                                className="rounded-sm border-b border-themewhite2/70 hover:bg-themewhite2"
                                            />
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

    // Fallback — should not be reached in normal usage (mobile uses mobilePanel, desktop uses desktopMode)
    return null
}
