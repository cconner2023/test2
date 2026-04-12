import { useMemo, useState, useCallback, useRef } from 'react'
import { Pin } from 'lucide-react'
import { MedicationPage } from './MedicationPage'
import { medList, type medListTypes } from '../Data/MedData'
import { tc3MedList } from '../Data/TC3MedData'
import { useNavPreferencesStore } from '../stores/useNavPreferencesStore'
import { useShallow } from 'zustand/react/shallow'
import { ContextMenu, type ContextMenuItem } from './ContextMenu'

const LONG_PRESS_MS = 500

function MedicationListItem({ medication, onClick, isPinned, onContextMenu, onTouchStart, onTouchEnd }: {
    medication: medListTypes
    onClick: () => void
    isPinned: boolean
    onContextMenu: (e: React.MouseEvent) => void
    onTouchStart: (e: React.TouchEvent) => void
    onTouchEnd: () => void
}) {
    return (
        <div
            className="flex items-center py-3 px-2 w-full border-b border-themewhite2/70 cursor-pointer rounded-md"
            onClick={onClick}
            onContextMenu={onContextMenu}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            onTouchCancel={onTouchEnd}
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

    // ── Context menu state ───────────────────────────────────
    const [contextMenu, setContextMenu] = useState<{ id: string; position: { x: number; y: number } } | null>(null)
    const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const longPressTriggered = useRef(false)

    const handleTouchStart = useCallback((medId: string, e: React.TouchEvent) => {
        longPressTriggered.current = false
        const touch = e.touches[0]
        const pos = { x: touch.clientX, y: touch.clientY }
        longPressTimer.current = setTimeout(() => {
            longPressTriggered.current = true
            setContextMenu({ id: medId, position: pos })
        }, LONG_PRESS_MS)
    }, [])

    const handleTouchEnd = useCallback(() => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current)
            longPressTimer.current = null
        }
    }, [])

    const handleContextMenu = useCallback((medId: string, e: React.MouseEvent) => {
        e.preventDefault()
        setContextMenu({ id: medId, position: { x: e.clientX, y: e.clientY } })
    }, [])

    const handleMedClick = useCallback((med: medListTypes) => {
        if (longPressTriggered.current) {
            longPressTriggered.current = false
            return
        }
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
                <MedicationPage
                    medication={selectedMedication}
                    isFavorite={pinnedKB.includes('med:' + selectedMedication.icon)}
                    onToggleFavorite={() => togglePinKB('med:' + selectedMedication.icon)}
                />
            </div>
        )
    }

    return (
        <div className="px-4 pb-4">
            {pinnedMeds.length > 0 && (
                <>
                    <div className="flex items-center gap-2 mt-1 mb-1 px-1">
                        <span className="text-[10px] font-semibold text-tertiary uppercase tracking-wider">
                            Pinned
                        </span>
                        <div className="h-px flex-1 bg-tertiary/10" />
                    </div>
                    {pinnedMeds.map(medication => (
                        <MedicationListItem
                            key={`pin-${medication.icon}`}
                            medication={medication}
                            onClick={() => handleMedClick(medication)}
                            isPinned
                            onContextMenu={(e) => handleContextMenu('med:' + medication.icon, e)}
                            onTouchStart={(e) => handleTouchStart('med:' + medication.icon, e)}
                            onTouchEnd={handleTouchEnd}
                        />
                    ))}
                </>
            )}

            {pinnedMeds.length > 0 && otherMeds.length > 0 && (
                <div className="flex items-center gap-2 mt-3 mb-1 px-1">
                    <span className="text-[10px] font-semibold text-tertiary uppercase tracking-wider">
                        All Medications
                    </span>
                    <div className="h-px flex-1 bg-tertiary/10" />
                </div>
            )}

            {otherMeds.map(medication => (
                <MedicationListItem
                    key={`med-${medication.icon}`}
                    medication={medication}
                    onClick={() => handleMedClick(medication)}
                    isPinned={false}
                    onContextMenu={(e) => handleContextMenu('med:' + medication.icon, e)}
                    onTouchStart={(e) => handleTouchStart('med:' + medication.icon, e)}
                    onTouchEnd={handleTouchEnd}
                />
            ))}

            {contextMenu && (
                <ContextMenu
                    x={contextMenu.position.x}
                    y={contextMenu.position.y}
                    onClose={() => setContextMenu(null)}
                    items={[{
                        key: 'pin',
                        label: pinnedKB.includes(contextMenu.id) ? 'Unpin' : 'Pin',
                        icon: Pin,
                        onAction: () => togglePinKB(contextMenu.id),
                    }]}
                />
            )}
        </div>
    )
}
