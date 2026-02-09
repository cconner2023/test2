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

// Section ordering: General Info first, then Differentials, then Training (separated by category)
const GUIDELINE_SECTIONS = [
    { key: 'gen' as const, label: 'General Information', prefix: 'gen', field: 'gen' as const },
    { key: 'DDX' as const, label: 'Differentials (DDx)', prefix: 'ddx', field: 'DDX' as const },
    { key: 'medcom' as const, label: 'MEDCOM Training', prefix: 'medcom', field: 'medcom' as const },
    { key: 'stp' as const, label: 'STP Training', prefix: 'stp', field: 'stp' as const },
] as const

// Section icon mapping for visual consistency
function getSectionIcon(key: string): string {
    switch (key) {
        case 'gen': return '📋'
        case 'DDX': return '🔍'
        case 'medcom': return '🎖️'
        case 'stp': return '📖'
        default: return '📝'
    }
}

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
    // Check if any training sections have content
    const hasTraining = (symptom.medcom?.length ?? 0) > 0 || (symptom.stp?.length ?? 0) > 0

    return (
        <>
            {/* Symptom Header — consistent with WriteNotePage header style */}
            <div className="mb-5 pb-4 border-b border-themewhite2">
                <div className="flex items-center gap-3 mb-2">
                    <div className="px-4 py-3 flex text-[12pt] font-bold items-center justify-center shrink-0 bg-themeblue3 text-white rounded-md">
                        {symptom.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-[11pt] font-semibold text-primary leading-tight">
                            {symptom.text}
                        </h2>
                        <span className="text-[8pt] text-secondary mt-0.5 block">
                            {category.text}
                        </span>
                    </div>
                </div>
                {symptom.description && (
                    <p className="text-[9.5pt] text-secondary leading-relaxed mt-2 pl-1">
                        {symptom.description}
                    </p>
                )}
            </div>

            {/* General Information Section */}
            {(() => {
                const genItems = symptom.gen as GuidelineItemData[] | undefined
                const hasGenContent = genItems && genItems.some(item => item.text)
                if (!hasGenContent) return null
                return (
                    <div className="mb-5">
                        <div className="flex items-center gap-2 mb-2 pl-1">
                            <span className="text-[9pt]">{getSectionIcon('gen')}</span>
                            <h3 className="text-[9pt] font-semibold text-themeblue1 uppercase tracking-wide">
                                General Information
                            </h3>
                        </div>
                        {genItems!.map((item, index) => (
                            <GuidelineItem
                                key={`gen-${item.id || index}`}
                                guideline={item}
                                type="gen"
                                index={index}
                                keyPrefix="gen"
                                onClick={() => onNavigate(guidelineToResult('gen', item, index, symptom, category))}
                            />
                        ))}
                    </div>
                )
            })()}

            {/* Differentials Section */}
            {(() => {
                const ddxItems = symptom.DDX as GuidelineItemData[] | undefined
                if (!ddxItems || ddxItems.length === 0) return null
                return (
                    <div className="mb-5">
                        <div className="flex items-center gap-2 mb-2 pl-1">
                            <span className="text-[9pt]">{getSectionIcon('DDX')}</span>
                            <h3 className="text-[9pt] font-semibold text-themeblue1 uppercase tracking-wide">
                                Differentials (DDx)
                            </h3>
                        </div>
                        {ddxItems.map((item, index) => (
                            <GuidelineItem
                                key={`ddx-${item.id || index}`}
                                guideline={item}
                                type="DDX"
                                index={index}
                                keyPrefix="ddx"
                                onClick={() => onNavigate(guidelineToResult('DDX', item, index, symptom, category))}
                            />
                        ))}
                    </div>
                )
            })()}

            {/* Training Section — MEDCOM and STP separated with a shared "Training" heading */}
            {hasTraining && (
                <div className="mb-3">
                    <div className="flex items-center gap-2 mb-3 pl-1">
                        <span className="text-[9pt]">📚</span>
                        <h3 className="text-[9pt] font-semibold text-themeblue1 uppercase tracking-wide">
                            Training References
                        </h3>
                    </div>

                    {/* MEDCOM Training */}
                    {symptom.medcom && symptom.medcom.length > 0 && (
                        <div className="mb-4 ml-1">
                            <h4 className="text-[8.5pt] font-medium text-secondary mb-1.5 pl-1 flex items-center gap-1.5">
                                <span>{getSectionIcon('medcom')}</span>
                                MEDCOM
                            </h4>
                            {(symptom.medcom as GuidelineItemData[]).map((item, index) => (
                                <GuidelineItem
                                    key={`medcom-${item.id || index}`}
                                    guideline={item}
                                    type="medcom"
                                    index={index}
                                    keyPrefix="medcom"
                                    onClick={() => onNavigate(guidelineToResult('medcom', item, index, symptom, category))}
                                />
                            ))}
                        </div>
                    )}

                    {/* STP Training */}
                    {symptom.stp && symptom.stp.length > 0 && (
                        <div className="mb-4 ml-1">
                            <h4 className="text-[8.5pt] font-medium text-secondary mb-1.5 pl-1 flex items-center gap-1.5">
                                <span>{getSectionIcon('stp')}</span>
                                STP
                            </h4>
                            {(symptom.stp as GuidelineItemData[]).map((item, index) => (
                                <GuidelineItem
                                    key={`stp-${item.id || index}`}
                                    guideline={item}
                                    type="stp"
                                    index={index}
                                    keyPrefix="stp"
                                    onClick={() => onNavigate(guidelineToResult('stp', item, index, symptom, category))}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
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
