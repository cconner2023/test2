// components/DecisionMakingItem.tsx - FIXED VERSION
import { useMemo, memo } from 'react'
import type { decisionMakingType } from '../Types/AlgorithmTypes'
import type { medListTypes } from '../Data/MedData'
import { SectionHeader } from './Section'

interface DecisionMakingItemProps {
    item: decisionMakingType;
    onMedicationClick: (medication: medListTypes, anchorRect: DOMRect) => void;
}

// Consolidated badge/pill component
function Pill({
    children,
    onClick,
    className,
    title,
}: {
    children: React.ReactNode;
    onClick?: (rect: DOMRect) => void;
    className?: string;
    title?: string;
}) {
    return (
        <button
            className={`px-2 py-0.5 text-[9pt] rounded-full bg-tertiary/5 text-tertiary transition-colors active:scale-95 ${onClick ? 'cursor-pointer' : ''} ${className}`}
            onClick={(e) => onClick?.((e.currentTarget as HTMLButtonElement).getBoundingClientRect())}
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
        <div className="text-[9pt] font-semibold text-tertiary uppercase tracking-wide mb-1.5">
            {typeText}
        </div>
    );
}

function TextBlock({ text }: { text: string }) {
    return (
        <div className="text-[10pt] text-primary leading-relaxed">
            {text}
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
    const groupedAncillaryFind = useMemo(() =>
        item.ancillaryFind?.reduce((acc, anc) => {
            const type = anc.type || 'other';
            if (!acc[type]) {
                acc[type] = [];
            }
            acc[type].push(anc);
            return acc;
        }, {} as Record<string, typeof item.ancillaryFind>) || {},
        [item.ancillaryFind],
    );

    return (
        <div className="space-y-2">
            {item.text && (
                <TextBlock text={item.text} />
            )}

            {/* Ancillary Findings */}
            {Object.keys(groupedAncillaryFind).length > 0 && (
                <div className="space-y-2">
                    {Object.entries(groupedAncillaryFind).map(([type, items]) => (
                        <div key={type}>
                            <div className="text-[9pt] font-semibold text-tertiary uppercase tracking-wide mb-1">{getAncillaryLabel(type)}</div>
                            <div className="text-[9pt] text-primary">
                                {items.map(anc => anc.modifier).filter(Boolean).join('; ')}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Medications */}
            {item.medFind && item.medFind.length > 0 && (
                <div>
                    <div className="text-[9pt] font-semibold text-tertiary uppercase tracking-wide mb-1">Medications</div>
                    <div className="flex flex-wrap gap-1">
                        {item.medFind.map((med, medIndex) => (
                            <Pill
                                key={medIndex}
                                onClick={(rect) => onMedicationClick(med, rect)}
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
                    <div className="text-[9pt] font-semibold text-tertiary uppercase tracking-wide mb-1">Limitations</div>
                    <div className="text-[9pt] text-primary">
                        {item.specLim.join('; ')}
                    </div>
                </div>
            )}
        </div>
    );
}

// Main component - each master item is a section: DDx header + card
export const DecisionMakingItem = memo(function DecisionMakingItem({
    item,
    onMedicationClick,
}: DecisionMakingItemProps) {
    const hasDDx = item.ddx && item.ddx.length > 0;
    return (
        <div>
            {/* DDx as section header above card */}
            {hasDDx && (
                <div className="pb-2"><SectionHeader>
                    {item.ddx!.join(' · ')}
                </SectionHeader></div>
            )}

            <div className="rounded-2xl bg-themewhite2 overflow-hidden">
                <div className="px-4 py-3 space-y-3">
                    {/* Parent section */}
                    <div>
                        <TypeBadge item={item} />
                        <ContentSection item={item} onMedicationClick={onMedicationClick} />
                    </div>

                    {/* Child section */}
                    {item.assocMcp && (
                        <div>
                            <TypeBadge item={item.assocMcp} />
                            <ContentSection item={item.assocMcp} onMedicationClick={onMedicationClick} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});