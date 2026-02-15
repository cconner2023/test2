// components/DecisionMakingItem.tsx - FIXED VERSION
import { useState, useRef, useEffect } from 'react'
import type { decisionMakingType } from '../Types/AlgorithmTypes'
import type { getColorClasses } from '../Utilities/ColorUtilities'
import type { medListTypes } from '../Data/MedData'

interface DecisionMakingItemProps {
    item: decisionMakingType;
    colors: ReturnType<typeof getColorClasses>;
    onMedicationClick: (medication: medListTypes) => void;
    onDdxClick?: (diagnosis: string) => void;
}

// Consolidated badge/pill component
function Pill({
    children,
    onClick,
    className,
    title,
}: {
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
    title?: string;
}) {
    return (
        <button
            className={`px-2 py-1 text-xs bg-themewhite text-primary rounded border border-themegray1/30 ${onClick ? 'hover:bg-themewhite2 transition-colors cursor-pointer' : ''
                } ${className}`}
            onClick={onClick}
            type={onClick ? 'button' : undefined}
            title={title}
        >
            {children}
        </button>
    );
}

function TypeBadge({ item }: {
    item: decisionMakingType;
}) {
    const typeTextMap: Record<string, string> = {
        'dmp': 'Decision Making',
        'mcp': 'Minor Care Protocol',
        'lim': 'Limitations',
    };

    const typeText = typeTextMap[item.type || ''];
    if (!typeText) return null;

    return (
        <div className="text-xs font-medium text-tertiary mb-2">
            {typeText}
        </div>
    );
}

function DifferentialHeader({ ddx, onDdxClick }: {
    ddx: string[];
    onDdxClick?: (diagnosis: string) => void;
}) {
    return (
        <div className="bg-themewhite3 px-3 pt-3 pb-2 border-b border-themegray1/20">
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

// Expandable text component with 2-line truncation
function ExpandableText({ text }: { text: string }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [needsTruncation, setNeedsTruncation] = useState(false);
    const textRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (textRef.current) {
            // Check if text overflows 2 lines
            const lineHeight = parseFloat(getComputedStyle(textRef.current).lineHeight);
            const maxHeight = lineHeight * 2;
            setNeedsTruncation(textRef.current.scrollHeight > maxHeight + 2);
        }
    }, [text]);

    return (
        <div className="text-sm text-primary leading-relaxed mb-3">
            <div
                ref={textRef}
                className={!isExpanded && needsTruncation ? 'line-clamp-2' : ''}
            >
                {text}
            </div>
            {needsTruncation && !isExpanded && (
                <button
                    onClick={() => setIsExpanded(true)}
                    className="text-themeblue1 text-xs mt-1 hover:underline cursor-pointer"
                >
                    ...more
                </button>
            )}
            {needsTruncation && isExpanded && (
                <button
                    onClick={() => setIsExpanded(false)}
                    className="text-themeblue1 text-xs mt-1 hover:underline cursor-pointer"
                >
                    show less
                </button>
            )}
        </div>
    );
}

// Content section component
function ContentSection({
    item,
    onMedicationClick
}: {
    item: decisionMakingType;
    onMedicationClick: (medication: medListTypes) => void;
}) {
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

    // Group ancillary findings by type
    const groupedAncillaryFind = item.ancillaryFind?.reduce((acc, anc) => {
        const type = anc.type || 'other';
        if (!acc[type]) {
            acc[type] = [];
        }
        acc[type].push(anc);
        return acc;
    }, {} as Record<string, typeof item.ancillaryFind>) || {};

    return (
        <>
            {/* Text content with 2-line truncation */}
            {item.text && (
                <ExpandableText text={item.text} />
            )}

            {/* Ancillary Findings */}
            {Object.keys(groupedAncillaryFind).length > 0 && (
                <div className="mb-3">
                    {Object.entries(groupedAncillaryFind).map(([type, items]) => (
                        <div key={type} className="mb-2">
                            <div className="text-xs font-medium text-tertiary mb-1">
                                {getAncillaryLabel(type)}:
                            </div>
                            <div className="flex flex-wrap gap-1">
                                {items.map((anc, index) => (
                                    <Pill key={index}>
                                        {anc.modifier || ''}
                                    </Pill>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Medications */}
            {item.medFind && item.medFind.length > 0 && (
                <div className="mb-3">
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
                <div>
                    <div className="text-xs font-medium text-tertiary mb-1">Special Limitations:</div>
                    <div className="space-y-1">
                        {item.specLim.map((lim, limIndex) => (
                            <div key={limIndex} className="text-sm text-primary">
                                {lim}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </>
    );
}

// Main component - each master item has its own differential and single background
export function DecisionMakingItem({
    item,
    onMedicationClick,
    onDdxClick,
}: DecisionMakingItemProps) {
    const hasDDx = item.ddx && item.ddx.length > 0;
    return (
        <div className="mb-4">
            {/* Single cohesive unit for each master item */}
            <div className="rounded-md bg-themewhite3">
                {/* DIFFERENTIAL HEADER for this specific master item */}
                {hasDDx && (
                    <DifferentialHeader
                        ddx={item.ddx!}
                        onDdxClick={onDdxClick}
                    />
                )}

                {/* Content area - shared background for everything */}
                <div className={`${hasDDx ? 'px-3 pb-3' : 'p-3'}`}>
                    {/* Parent section */}
                    <div>
                        <TypeBadge item={item} />
                        <ContentSection item={item} onMedicationClick={onMedicationClick} />
                    </div>

                    {/* Child section */}
                    {item.assocMcp && (
                        <div className="pt-4 mt-4 border-t border-themegray1/20">
                            <TypeBadge item={item.assocMcp} />
                            <ContentSection item={item.assocMcp} onMedicationClick={onMedicationClick} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}