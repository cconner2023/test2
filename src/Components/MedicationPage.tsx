import type { medListTypes } from "../Data/MedData"

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
            <div className="text-[9pt] font-normal text-primary mb-2">
                {title}
            </div>
            <div className="text-[9pt] text-secondary px-2 py-2 rounded border border-themewhite2/20 bg-themewhite3">
                {content}
            </div>
        </div>
    )
}
// Helper component for array items with icons
function IconList({ items }: { items: Array<{ icon: string; text: string }> }) {
    return (
        <div className="space-y-1">
            {items.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                    <span>{item.icon}</span>
                    <span>{item.text}</span>
                </div>
            ))}
        </div>
    )
}

export function MedicationPage({ medication }: MedicationPageProps) {
    // Define all sections with their rendering logic
    const sections = [
        // String sections
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
            title: 'Adverse Reaction',
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
            <div className="flex-1 overflow-y-auto">
                <div className="flex flex-col backdrop-blur-2xl rounded-md h-full">
                    {/* Medication Header */}
                    <div className="flex my-2 mx-2 h-max w-full shrink-0">
                        <div className="py-2 px-2 flex text-[10pt] font-normal items-center justify-center shrink-0 
                                      bg-themeyellowlow/70 text-primary rounded-md">
                            {medication.icon}
                        </div>
                        <div className="flex text-[10pt] text-primary font-normal items-center w-full pl-2">
                            generic: {medication.text}
                        </div>
                    </div>

                    {/* Medication Details */}
                    <div className="flex-1 w-full overflow-y-auto p-2 space-y-4">
                        {sections.map(({ key, title, content }) => {
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