// components/DecisionMakingItem.tsx
import type { decisionMakingType } from '../Types/AlgorithmTypes'
import type { getColorClasses } from '../Utilities/ColorUtilities'
import type { medListTypes } from '../Data/MedData'

interface DecisionMakingItemProps {
    item: decisionMakingType;
    colors: ReturnType<typeof getColorClasses>;
    onMedicationClick: (medication: medListTypes) => void;
    onDdxClick?: (diagnosis: string) => void;
    isNested?: boolean;
}

function DecisionMakingHeader({ item, colors, onDdxClick }: {
    item: decisionMakingType;
    colors: ReturnType<typeof getColorClasses>;
    onDdxClick?: (diagnosis: string) => void;
}) {
    const getTypeText = (type?: string) => {
        switch (type) {
            case 'dmp': return 'Decision Making';
            case 'mcp': return 'Minor Care Protocol';
            case 'lim': return 'Limitations';
            default: return '';
        }
    };

    const hasDDx = item.ddx && item.ddx.length > 0;
    const headerClass = hasDDx
        ? 'sticky top-0 z-10 bg-inherit -mx-3 -mt-3 mb-2 px-3 pt-3 pb-2 border-b border-themegray1/20'
        : 'mb-2';

    return (
        <div className={headerClass}>
            <div className="flex justify-between items-start min-h-[28px]">
                {/* Differential Diagnosis when exists */}
                <div className="flex-1">
                    {hasDDx && (
                        <>
                            <div className="text-xs font-medium text-tertiary mb-1">
                                {item.ddx!.length === 1 ? 'Differential Diagnosis:' : 'Differential Diagnoses:'}
                            </div>
                            <div className="flex flex-wrap gap-1">
                                {item.ddx!.map((diagnosis, index) => (
                                    onDdxClick ? (
                                        <button
                                            key={index}
                                            onClick={() => onDdxClick(diagnosis)}
                                            className="px-2 py-0.5 text-xs bg-themewhite text-primary rounded border border-themegray1/30 hover:bg-themewhite2 hover:border-themegray1/50 transition-colors cursor-pointer"
                                            title={`Click to view ${diagnosis} details`}
                                            type="button"
                                        >
                                            {diagnosis}
                                        </button>
                                    ) : (
                                        <span
                                            key={index}
                                            className="px-2 py-0.5 text-xs bg-themewhite text-primary rounded border border-themegray1/30"
                                        >
                                            {diagnosis}
                                        </span>
                                    )
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* Type badge */}
                <div className={`ml-2 px-2 py-2 text-xs font-medium rounded bg-themewhite text-secondary border border-themegray1/30 flex-shrink-0`}>
                    {getTypeText(item.type)}
                </div>
            </div>
        </div>
    );
}

export function DecisionMakingItem({
    item,
    colors,
    onMedicationClick,
    onDdxClick,
    isNested = false,
}: DecisionMakingItemProps) {
    const getAncillaryLabel = (type?: string) => {
        const labels: Record<string, string> = {
            'lab': 'Lab',
            'refer': 'Referral',
            'med': 'Other Medication',
            'rad': 'Imaging'
        };
        return labels[type || ''] || type || 'Test';
    };

    const hasDDx = item.ddx && item.ddx.length > 0;

    return (
        <div className={`${isNested ? 'ml-1 pl-1 relative' : 'mb-3'}`}>
            {/* Left connecting line for nested items */}
            {isNested && (
                <div className="absolute top-0 -left-1 w-1 h-full border-l border-themegray1/20" />
            )}

            {/* Main Content Card */}
            <div className={`rounded border border-themegray1/20 ${isNested ? 'bg-themewhite2' : 'bg-themewhite3'} p-3 relative`}>
                {/* Header with conditional sticky behavior */}
                <DecisionMakingHeader
                    item={item}
                    colors={colors}
                    onDdxClick={onDdxClick}
                />

                {/* Main Content Area */}
                <div className={hasDDx ? 'pt-1' : ''}>
                    {/* Text Content */}
                    {item.text && (
                        <div className="text-sm text-primary leading-relaxed py-2 px-2">
                            {item.text}
                        </div>
                    )}

                    {/* Ancillary Findings */}
                    {item.ancillaryFind && item.ancillaryFind.length > 0 && (
                        <div className="mb-2">
                            <div className="text-xs text-tertiary mb-1">
                                {item.ancillaryFind.length === 1
                                    ? `${getAncillaryLabel(item.ancillaryFind[0].type)}:`
                                    : ''}
                            </div>
                            <div className="flex flex-wrap gap-1">
                                {item.ancillaryFind.map((anc, index) => (
                                    <span
                                        key={index}
                                        className="px-2 py-0.5 text-xs bg-themewhite text-primary rounded border border-themegray1/30"
                                    >
                                        {anc.modifier ? `${anc.modifier}` : ''}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Medications */}
                    {item.medFind && item.medFind.length > 0 && (
                        <div className="mb-2">
                            <div className="text-xs font-medium text-tertiary mb-1">Medications:</div>
                            <div className="flex flex-wrap gap-1">
                                {item.medFind.map((med, medIndex) => (
                                    <button
                                        key={medIndex}
                                        onClick={() => onMedicationClick(med)}
                                        className="px-2 py-0.5 text-xs bg-themewhite text-primary rounded border border-themegray1/30 hover:bg-themewhite2 hover:border-themegray1/50 transition-colors cursor-pointer"
                                        title={`Click to view ${med.text} details`}
                                        type="button"
                                    >
                                        {med.text}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Special Limitations */}
                    {item.specLim && item.specLim.length > 0 && (
                        <div className="mb-2">
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

                    {/* Nested Associated MCP */}
                    {item.assocMcp && (
                        <div className="mt-3 pt-3 border-t border-themegray1/20">
                            <DecisionMakingItem
                                item={item.assocMcp}
                                colors={colors}
                                onMedicationClick={onMedicationClick}
                                onDdxClick={onDdxClick}
                                isNested={true}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}