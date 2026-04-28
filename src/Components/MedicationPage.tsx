import { Pin } from 'lucide-react'
import type { medListTypes } from "../Data/MedData"
import { Section, SectionCard } from './Section'
import { ActionPill } from './ActionPill'

interface MedicationPageProps {
    medication: medListTypes
    onBack?: () => void
    isFavorite?: boolean
    onToggleFavorite?: () => void
}

function IconList({ items }: { items: Array<{ icon: string; text: string }> }) {
    return (
        <>
            {items.map((item, idx) => {
                const letter = item.icon.replace(/^Class\s+/, '')
                return (
                    <div
                        key={idx}
                        className={`flex items-baseline gap-2 px-4 py-3 ${idx > 0 ? 'border-t border-primary/6' : ''}`}
                    >
                        <span className="text-sm font-semibold text-primary shrink-0">{letter}:</span>
                        <span className="flex-1 text-sm text-primary">{item.text}</span>
                    </div>
                )
            })}
        </>
    )
}

/**
 * Embeddable medication sections — content only, no scroll wrapper, no favorites pill.
 * Used by MedicationPage (full-page) and DecisionMaking (popover).
 */
export function MedicationSections({ medication }: { medication: medListTypes }) {
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
        <>
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
        </>
    )
}

export function MedicationPage({ medication, isFavorite, onToggleFavorite }: MedicationPageProps) {
    return (
        <div className="flex flex-col h-full w-full">
            {onToggleFavorite && (
                <div className="flex justify-end px-4 pt-2">
                    <ActionPill>
                        <button
                            type="button"
                            onClick={onToggleFavorite}
                            aria-label={isFavorite ? 'Unpin' : 'Pin'}
                            title={isFavorite ? 'Unpin' : 'Pin'}
                            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                                isFavorite ? 'bg-themeblue2 text-white' : 'bg-themeblue2/8 text-primary'
                            }`}
                        >
                            <Pin className="w-4 h-4" />
                        </button>
                    </ActionPill>
                </div>
            )}

            <div className="flex-1 overflow-y-auto px-4 py-3 pb-12">
                <MedicationSections medication={medication} />
            </div>
        </div>
    )
}
