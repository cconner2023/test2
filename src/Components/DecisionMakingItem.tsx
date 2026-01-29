// components/DecisionMakingItem.tsx - SIMPLIFIED VERSION
import type { decisionMakingType } from '../Types/AlgorithmTypes'
import type { getColorClasses } from '../Utilities/ColorUtilities'
import type { medListTypes } from '../Data/MedData'

interface DecisionMakingItemProps {
    item: decisionMakingType;
    colors: ReturnType<typeof getColorClasses>;
    onMedicationClick: (medication: medListTypes) => void;
    onDdxClick?: (diagnosis: string) => void;
    isNested?: boolean;
    showDdxHeader?: boolean;
}

// Consolidated badge/pill component
function Pill({
    children,
    onClick,
    className,
}: {
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
    title?: string | undefined;
}) {
    const baseClasses = 'px-2 py-0.5 text-xs bg-themewhite text-primary rounded border border-themegray1/30';
    const interactiveClasses = onClick ? 'hover:bg-themewhite2 hover:border-themegray1/50 transition-colors cursor-pointer' : '';

    const Component = onClick ? 'button' : 'span';

    return (
        <Component
            className={`${baseClasses} ${interactiveClasses} ${className}`}
            onClick={onClick}
            type={onClick ? 'button' : undefined}
        >
            {children}
        </Component>
    );
}

// Type badge component
function TypeBadge({ item }: {
    item: decisionMakingType;
}) {
    const typeTextMap: Record<string, string> = {
        'dmp': 'Decision Making',
        'mcp': 'Minor Care Protocol',
        'lim': 'Limitations',
    };

    const typeText = typeTextMap[item.type || ''];

    if (!typeText) {
        return null;
    }

    return (
        <div className="px-2 py-2 text-xs font-medium rounded bg-themewhite text-secondary border border-themegray1/30 shrink-0">
            {typeText}
        </div>
    );
}

// Sticky Differential Header Component
function DifferentialHeader({ ddx, onDdxClick }: {
    ddx: string[];
    onDdxClick?: (diagnosis: string) => void;
}) {
    return (
        <div className="sticky top-0 z-10 bg-inherit -mx-3 -mt-3 mb-3 px-3 pt-3 pb-2 border-b border-themegray1/20">
            <div className="text-xs font-medium text-tertiary mb-1">
                {ddx.length === 1 ? 'Differential Diagnosis:' : 'Differential Diagnoses:'}
            </div>
            <div className="flex flex-wrap gap-1">
                {ddx.map((diagnosis, index) => (
                    <Pill
                        key={index}
                        onClick={onDdxClick ? () => onDdxClick(diagnosis) : undefined}
                        title={onDdxClick ? `Click to view ${diagnosis} details` : undefined}
                    >
                        {diagnosis}
                    </Pill>
                ))}
            </div>
        </div>
    );
}
// components/DecisionMakingItem.tsx - UPDATED VERSION
export function DecisionMakingItem({
    item,
    colors,
    onMedicationClick,
    onDdxClick,
    isNested = false,
    showDdxHeader = true,
}: DecisionMakingItemProps) {
    const getAncillaryLabel = (type?: string) => {
        const labels: Record<string, string> = {
            'lab': 'Lab',
            'refer': 'Referral',
            'med': 'Other Medication',
            'rad': 'Imaging',
            'protocol': 'Other Protocol'
        };
        return labels[type || ''] || type || 'Test';
    };

    const hasDDx = item.ddx && item.ddx.length > 0;
    const shouldShowDdxHeader = showDdxHeader && hasDDx;

    // Group ancillary findings by type for better organization
    const groupedAncillaryFind = item.ancillaryFind?.reduce((acc, anc) => {
        const type = anc.type || 'other';
        if (!acc[type]) {
            acc[type] = [];
        }
        acc[type].push(anc);
        return acc;
    }, {} as Record<string, typeof item.ancillaryFind>) || {};

    return (
        <div className={`${isNested ? 'mt-3 pt-3 border-t border-themegray1/20' : 'mb-3'}`}>
            {/* Main Content Card */}
            <div className={`rounded border border-themegray1/20 ${isNested ? 'bg-themewhite2' : 'bg-themewhite3'} p-3`}>
                {/* STICKY DIFFERENTIAL HEADER */}
                {shouldShowDdxHeader && (
                    <DifferentialHeader
                        ddx={item.ddx!}
                        onDdxClick={onDdxClick}
                    />
                )}

                {/* Content with Type Badge on Right */}
                <div className={shouldShowDdxHeader ? 'pt-1' : ''}>
                    {/* Header row with paragraph and badge */}
                    <div className="flex justify-between items-start mb-2">
                        {/* Paragraph text */}
                        {item.text && (
                            <div className="text-sm text-primary leading-relaxed flex-1 pr-4">
                                {item.text}
                            </div>
                        )}

                        {/* Type badge on the right */}
                        <TypeBadge item={item} />
                    </div>

                    {/* Content sections */}
                    <div className="space-y-2">
                        {/* Ancillary Findings - GROUPED BY TYPE */}
                        {Object.keys(groupedAncillaryFind).length > 0 && (
                            <div className="mb-2 mt-2 space-y-2">
                                {Object.entries(groupedAncillaryFind).map(([type, items]) => (
                                    <div key={type} className="space-y-1">
                                        <div className="text-xs font-medium text-tertiary">
                                            {getAncillaryLabel(type)}:
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {items.map((anc, index) => (
                                                <Pill key={index}>
                                                    {anc.modifier ? `${anc.modifier}` : anc.modifier || ''}
                                                </Pill>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Medications */}
                        {item.medFind && item.medFind.length > 0 && (
                            <div className="mb-2 mt-2">
                                <div className="text-xs font-medium text-tertiary mb-1">Medications:</div>
                                <div className="flex flex-wrap gap-1">
                                    {item.medFind.map((med, medIndex) => (
                                        <Pill
                                            key={medIndex}
                                            onClick={() => onMedicationClick(med)}
                                            title={`Click to view ${med.text} details`}
                                        >
                                            {med.text}
                                        </Pill>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Special Limitations */}
                        {item.specLim && item.specLim.length > 0 && (
                            <div className="mb-2 mt-2">
                                <div className="text-xs font-medium text-tertiary mb-1">Special Limitations:</div>
                                <div className="space-y-1">
                                    {item.specLim.map((lim, limIndex) => (
                                        <div key={limIndex} className="text-sm text-primary pl-2 border-l-2 border-themegray1/40">
                                            {lim}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Nested Associated MCP */}
            {item.assocMcp && (
                <DecisionMakingItem
                    item={item.assocMcp}
                    colors={colors}
                    onMedicationClick={onMedicationClick}
                    onDdxClick={onDdxClick}
                    isNested={true}
                    showDdxHeader={false}
                />
            )}
        </div>
    );
}