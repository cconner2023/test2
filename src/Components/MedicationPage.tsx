import { Pin } from 'lucide-react'
import type { medListTypes } from "../Data/MedData"
import { Section, SectionCard } from './Section'

interface MedicationPageProps {
    medication: medListTypes
    onBack?: () => void
    isFavorite?: boolean
    onToggleFavorite?: () => void
}

function IconList({ items }: { items: Array<{ icon: string; text: string }> }) {
    return (
        <>
            {items.map((item, idx) => (
                <div
                    key={idx}
                    className={`flex items-start gap-3 px-4 py-3 ${idx > 0 ? 'border-t border-tertiary/8' : ''}`}
                >
                    <span className="inline-flex items-center justify-center py-0.5 px-2 rounded-md bg-themeblue3/10 text-themeblue2 text-[8.5pt] font-medium shrink-0">
                        {item.icon}
                    </span>
                    <span className="flex-1 text-sm text-primary">{item.text}</span>
                </div>
            ))}
        </>
    )
}

export function MedicationPage({ medication, isFavorite, onToggleFavorite }: MedicationPageProps) {
    const sections = [
        { key: 'trade', title: 'Trade Name', content: medication.icon?.trim() || null },
        { key: 'indication', title: 'Indication', content: medication.indication?.trim() || null },
        { key: 'contra', title: 'Contraindications', content: medication.contra?.trim() || null },
        { key: 'moi', title: 'Mechanism of Action', content: medication.moi?.trim() || null },
        { key: 'adult', title: 'Adult Dosing', content: medication.adult?.trim() || null },
        { key: 'peds', title: 'Pediatric Dosing', content: medication.peds?.trim() || null },
        { key: 'adverse', title: 'Adverse Reactions', content: medication.adverse?.trim() || null },
    ]

    const hasPreg = medication.preg && medication.preg.length > 0
    const hasAviation = medication.aviation && medication.aviation.length > 0

    return (
        <div className="flex flex-col h-full w-full">
            {onToggleFavorite && (
                <div className="flex justify-end px-4 pt-2">
                    <button
                        onClick={onToggleFavorite}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9pt] font-medium active:scale-95 transition-all border border-tertiary/10"
                        aria-label={isFavorite ? 'Unpin' : 'Pin'}
                    >
                        <Pin
                            size={14}
                            className={isFavorite
                                ? 'fill-themeblue2 text-themeblue2'
                                : 'text-tertiary'
                            }
                        />
                        {isFavorite ? 'Pinned' : 'Pin'}
                    </button>
                </div>
            )}

            <div className="flex-1 overflow-y-auto px-4 py-3 pb-12">
                {sections.map(({ key, title, content }) => {
                    if (!content) return null
                    return (
                        <Section key={key} title={title}>
                            <SectionCard>
                                <p className="px-4 py-3 text-sm text-primary leading-relaxed">
                                    {content}
                                </p>
                            </SectionCard>
                        </Section>
                    )
                })}

                {hasPreg && (
                    <Section title="Pregnancy Considerations">
                        <SectionCard>
                            <IconList items={medication.preg!} />
                        </SectionCard>
                    </Section>
                )}

                {hasAviation && (
                    <Section title="Aviation Considerations">
                        <SectionCard>
                            <IconList items={medication.aviation!} />
                        </SectionCard>
                    </Section>
                )}
            </div>
        </div>
    )
}
