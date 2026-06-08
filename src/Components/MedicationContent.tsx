import { useMemo, useState, useCallback, useRef } from 'react'
import { Pin } from 'lucide-react'
import { MedicationPage } from './MedicationPage'
import { Section, SectionCard } from './Section'
import { medList, type medListTypes } from '../Data/MedData'
import { tc3MedList } from '../Data/TC3MedData'
import { useNavPreferencesStore } from '../stores/useNavPreferencesStore'
import { useShallow } from 'zustand/react/shallow'
import { LiftedRowMenu } from './LiftedRowMenu'
import { liftPressHandlers, type LiftPressState, type LiftSnapshot } from './liftPress'

function MedicationListItem({ medication, onClick, isPinned, pressHandlers }: {
    medication: medListTypes
    onClick: () => void
    isPinned: boolean
    pressHandlers: ReturnType<typeof liftPressHandlers>
}) {
    return (
        <div
            className="flex items-center py-3 px-4 w-full border-b border-primary/6 last:border-0 cursor-pointer transition-colors active:bg-themeblue2/5"
            onClick={onClick}
            {...pressHandlers}
        >
            <div className="flex-1 min-w-0">
                <div className="text-[10pt] font-normal text-primary">
                    {medication.icon}
                </div>
                <div className="text-tertiary text-[9pt]">
                    {medication.text}
                </div>
            </div>
            {isPinned && (
                <Pin size={12} className="text-themeblue2/40 shrink-0 mr-1" />
            )}
        </div>
    )
}

interface MedicationContentProps {
    selectedMedication: medListTypes | null
    onMedicationSelect: (medication: medListTypes) => void
    tc3Mode: boolean
    searchQuery: string
}

/**
 * Pure content component for medication list/detail.
 * All state is managed by the parent (KnowledgeBaseDrawer).
 */
export function MedicationContent({
    selectedMedication,
    onMedicationSelect,
    tc3Mode,
    searchQuery,
}: MedicationContentProps) {
    const { pinnedKB, togglePinKB } = useNavPreferencesStore(
        useShallow(s => ({ pinnedKB: s.pinnedKB, togglePinKB: s.togglePinKB }))
    )
    const list = tc3Mode ? tc3MedList : medList

    // ── Lift-and-clone menu (long-press / right-click) ────────
    const [lifted, setLifted] = useState<({ id: string } & LiftSnapshot) | null>(null)
    const pressRef = useRef<LiftPressState | null>(null)

    const makeHandlers = useCallback((id: string) =>
        liftPressHandlers((snap) => setLifted({ id, ...snap }), pressRef), [])

    const handleMedClick = useCallback((med: medListTypes) => {
        if (pressRef.current?.fired) return
        onMedicationSelect(med)
    }, [onMedicationSelect])

    // ── Pinned / unpinned split ──────────────────────────────
    const { pinnedMeds, otherMeds } = useMemo(() => {
        const query = searchQuery.trim().toLowerCase()
        const isPinned = (m: medListTypes) => pinnedKB.includes('med:' + m.icon)
        const matchesQuery = (m: medListTypes) =>
            !query || m.icon.toLowerCase().includes(query) || m.text.toLowerCase().includes(query)

        const pinned: medListTypes[] = []
        const others: medListTypes[] = []
        for (const m of list) {
            if (!matchesQuery(m)) continue
            if (isPinned(m)) pinned.push(m)
            else others.push(m)
        }
        return { pinnedMeds: pinned, otherMeds: others }
    }, [list, pinnedKB, searchQuery])

    if (selectedMedication) {
        return (
            <div className="px-4 pb-4">
                <MedicationPage medication={selectedMedication} />
            </div>
        )
    }

    return (
        <div className="px-4 pb-4">
            {pinnedMeds.length > 0 && (
                <Section title="Pinned" count={pinnedMeds.length}>
                    <SectionCard>
                        {pinnedMeds.map(medication => (
                            <MedicationListItem
                                key={`pin-${medication.icon}`}
                                medication={medication}
                                onClick={() => handleMedClick(medication)}
                                isPinned
                                pressHandlers={makeHandlers('med:' + medication.icon)}
                            />
                        ))}
                    </SectionCard>
                </Section>
            )}

            {otherMeds.length > 0 && (
                <SectionCard>
                    {otherMeds.map(medication => (
                        <MedicationListItem
                            key={`med-${medication.icon}`}
                            medication={medication}
                            onClick={() => handleMedClick(medication)}
                            isPinned={false}
                            pressHandlers={makeHandlers('med:' + medication.icon)}
                        />
                    ))}
                </SectionCard>
            )}

            {lifted && (
                <LiftedRowMenu
                    isOpen
                    anchorRect={lifted.rect}
                    row={<div dangerouslySetInnerHTML={{ __html: lifted.html }} />}
                    onClose={() => setLifted(null)}
                    layout="list"
                    items={[{
                        key: 'pin',
                        label: pinnedKB.includes(lifted.id) ? 'Unpin' : 'Pin',
                        icon: Pin,
                        onAction: () => togglePinKB(lifted.id),
                    }]}
                />
            )}
        </div>
    )
}
