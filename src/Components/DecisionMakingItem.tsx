// components/DecisionMakingItem.tsx
//
// Typography follows the app section grammar, not UserGuideBody's document
// scale: DDx is a SectionHeader, matching the Full Note tab's section labels in
// the same drawer. Tiers below it separate by weight and color, never by a size
// that competes with the drawer title. No card container.
import { useMemo, memo } from 'react'
import type { decisionMakingType } from '../Types/AlgorithmTypes'
import type { medListTypes } from '../Data/MedData'
import { SectionHeader } from '@/Components/primitives/Section'

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
            className={`px-2.5 py-1 text-[10pt] rounded-full bg-tertiary/5 text-tertiary transition-colors active:scale-95 ${onClick ? 'cursor-pointer' : ''} ${className}`}
            onClick={(e) => onClick?.((e.currentTarget as HTMLButtonElement).getBoundingClientRect())}
            type={onClick ? 'button' : undefined}
            title={title}
        >
            {children}
        </button>
    );
}

function TypeHeading({ item }: {
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
        <h3 className="text-[10pt] font-semibold text-primary mb-1.5">
            {typeText}
        </h3>
    );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
    return (
        <p className="text-[10pt] font-semibold text-tertiary mt-4 mb-1.5">
            {children}
        </p>
    );
}

/** Enumerable values, rendered as the guide renders a list block. */
function ValueList({ values }: { values: string[] }) {
    return (
        <ul className="mb-2.5 space-y-2">
            {values.map((value, i) => (
                <li key={i} className="pl-3 border-l-2 border-themeblue2/30 text-[10pt] text-secondary leading-relaxed">
                    {value}
                </li>
            ))}
        </ul>
    );
}

function TextBlock({ text }: { text: string }) {
    return (
        <p className="text-[10pt] text-secondary leading-relaxed mb-2.5">
            {text}
        </p>
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
        <div>
            {item.text && (
                <TextBlock text={item.text} />
            )}

            {/* Ancillary Findings */}
            {Object.entries(groupedAncillaryFind).map(([type, items]) => {
                const values = (items ?? []).map(anc => anc.modifier).filter((m): m is string => !!m);
                if (values.length === 0) return null;
                return (
                    <div key={type}>
                        <FieldLabel>{getAncillaryLabel(type)}</FieldLabel>
                        <ValueList values={values} />
                    </div>
                );
            })}

            {/* Medications */}
            {item.medFind && item.medFind.length > 0 && (
                <div className="mb-2.5">
                    <FieldLabel>Medications</FieldLabel>
                    <div className="flex flex-wrap gap-1.5">
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
                    <FieldLabel>Limitations</FieldLabel>
                    <ValueList values={item.specLim} />
                </div>
            )}
        </div>
    );
}

// Main component - each master item is a guide-style section: DDx heading, then
// one subsection per content type.
export const DecisionMakingItem = memo(function DecisionMakingItem({
    item,
    onMedicationClick,
}: DecisionMakingItemProps) {
    const hasDDx = item.ddx && item.ddx.length > 0;
    return (
        <section>
            {hasDDx && (
                <div className="mb-2.5">
                    <SectionHeader>{item.ddx!.join(' · ')}</SectionHeader>
                </div>
            )}

            <TypeHeading item={item} />
            <ContentSection item={item} onMedicationClick={onMedicationClick} />

            {item.assocMcp && (
                <div className="mt-5">
                    <TypeHeading item={item.assocMcp} />
                    <ContentSection item={item.assocMcp} onMedicationClick={onMedicationClick} />
                </div>
            )}
        </section>
    );
});