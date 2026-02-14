import type { medListTypes } from "../../../Data/Medication/MedData"

interface MedicationPageProps {
    medication: medListTypes
    onBack?: () => void
}

interface DetailSectionProps {
    title: string
    content: React.ReactNode
    className?: string
}

function DetailSection({ title, content, className = "" }: DetailSectionProps) {
    return (
        <div className={className}>
            <div className="text-[10pt] font-normal text-primary mb-1.5 uppercase tracking-wide">
                {title}
            </div>
            <div className="text-[9pt] text-tertiary px-3 py-2.5 rounded-lg border border-themeblue1/10 bg-themewhite">
                {content}
            </div>
        </div>
    )
}

function IconList({ items }: { items: Array<{ icon: string; text: string }> }) {
    return (
        <div className="space-y-2">
            {items.map((item, index) => (
                <div key={index} className="flex items-start gap-3">
                    <span className="inline-flex items-center justify-center py-0.5 px-2 rounded-md bg-themeblue3 text-secondary text-[8.5pt] font-normal">
                        {item.icon}
                    </span>
                    <span className="flex-1 pt-0.5 text-secondary">{item.text}</span>
                </div>
            ))}
        </div>
    )
}

export function MedicationPage({ medication }: MedicationPageProps) {
    const sections = [
        {
            key: 'trade',
            title: 'trade',
            content: medication.icon?.trim() || null
        },
        {
            key: 'indication',
            title: 'Indication',
            content: medication.indication?.trim() || null
        },
        {
            key: 'contra',
            title: 'Contraindications',
            content: medication.contra?.trim() || null
        },
        {
            key: 'moi',
            title: 'Mechanism of Action',
            content: medication.moi?.trim() || null
        },
        {
            key: 'adult',
            title: 'Adult Dosing',
            content: medication.adult?.trim() || null
        },
        {
            key: 'peds',
            title: 'Pediatric Dosing',
            content: medication.peds?.trim() || null
        },
        {
            key: 'adverse',
            title: 'Adverse Reactions',
            content: medication.adverse?.trim() || null
        },
        {
            key: 'preg',
            title: 'Pregnancy Considerations',
            content: medication.preg && medication.preg.length > 0
                ? <IconList items={medication.preg} />
                : null
        },
        {
            key: 'aviation',
            title: 'Aviation Considerations',
            content: medication.aviation && medication.aviation.length > 0
                ? <IconList items={medication.aviation} />
                : null
        }
    ]

    return (
        <div className="flex flex-col h-full w-full">
            {/* Content only - header will be provided by parent component */}
            <div className="flex-1 overflow-y-auto p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Left Column */}
                    <div className="space-y-4">
                        {sections.slice(0, 4).map(({ key, title, content }) => {
                            if (!content) return null
                            return (
                                <DetailSection
                                    key={key}
                                    title={title}
                                    content={content}
                                />
                            )
                        })}
                    </div>

                    {/* Right Column */}
                    <div className="space-y-4">
                        {sections.slice(4).map(({ key, title, content }) => {
                            if (!content) return null
                            return (
                                <DetailSection
                                    key={key}
                                    title={title}
                                    content={content}
                                />
                            )
                        })}
                    </div>
                </div>
            </div>
        </div>
    )
}