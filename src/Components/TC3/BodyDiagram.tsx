import { memo, useState, useCallback } from 'react'
import { useTC3Store } from '../../stores/useTC3Store'
import { TC3BodyDiagramSvg } from './TC3BodyDiagramSvg'
import { InjuryPopover } from './InjuryPopover'

/**
 * Body diagram — shows combined posterior + anterior view with the detailed
 * SVG outline. Tap on body to mark injuries; each marker opens an InjuryPopover
 * with type selection, description, and treatment quick-add.
 */
export const BodyDiagram = memo(function BodyDiagram() {
    const injuries = useTC3Store((s) => s.card.injuries)
    const addInjury = useTC3Store((s) => s.addInjury)
    const removeInjury = useTC3Store((s) => s.removeInjury)
    const [editingInjury, setEditingInjury] = useState<string | null>(null)

    const injuryCount = injuries.length

    const handleAddInjury = useCallback((x: number, y: number) => {
        const id = crypto.randomUUID()
        addInjury({ id, x, y, type: 'GSW', description: '' })
        setEditingInjury(id)
    }, [addInjury])

    const editedInjury = editingInjury ? injuries.find(i => i.id === editingInjury) : null

    return (
        <div className="space-y-2">
            <div>
                <h3 className="text-sm font-semibold text-primary mb-1">Injury Locations</h3>
                <p className="text-[11px] text-tertiary/70">DD 1380 Section 3 — Tap on the body to mark injuries</p>
            </div>

            {/* Combined posterior + anterior diagram */}
            <div className="relative">
                <TC3BodyDiagramSvg
                    injuries={injuries}
                    editingInjury={editingInjury}
                    onAddInjury={handleAddInjury}
                    onEditInjury={setEditingInjury}
                />

                {/* Popover for editing injury — positioned below diagram */}
                {editedInjury && (
                    <div className="mt-2">
                        <InjuryPopover
                            injury={editedInjury}
                            onClose={() => setEditingInjury(null)}
                            onRemove={() => { removeInjury(editedInjury.id); setEditingInjury(null) }}
                        />
                    </div>
                )}
            </div>

            {injuryCount > 0 && (
                <p className="text-[9px] text-tertiary/50 text-center">
                    {injuryCount} injur{injuryCount === 1 ? 'y' : 'ies'} marked — tap body to add
                </p>
            )}
            {injuryCount === 0 && (
                <p className="text-[9px] text-tertiary/30 text-center">
                    Tap body to mark injuries
                </p>
            )}
        </div>
    )
})
