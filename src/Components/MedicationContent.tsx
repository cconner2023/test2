import { useMemo, useCallback } from 'react'
import { Star } from 'lucide-react'
import { MedicationPage } from './MedicationPage'
import { medList, type medListTypes } from '../Data/MedData'
import { tc3MedList } from '../Data/TC3MedData'
import { useUserProfile } from '../Hooks/useUserProfile'

function MedicationListItem({ medication, onClick, isFavorite, onToggleFavorite }: {
    medication: medListTypes
    onClick: () => void
    isFavorite: boolean
    onToggleFavorite: () => void
}) {
    return (
        <div
            className="flex items-center py-3 px-2 w-full border-b border-themewhite2/70 cursor-pointer rounded-md"
            onClick={onClick}
        >
            <div className="flex-1 min-w-0">
                <div className="text-[10pt] font-normal text-primary">
                    {medication.icon}
                </div>
                <div className="text-tertiary text-[9pt]">
                    {medication.text}
                </div>
            </div>
            <button
                onClick={(e) => { e.stopPropagation(); onToggleFavorite() }}
                className="p-1.5 shrink-0 active:scale-95 transition-all"
                aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
                <Star
                    size={18}
                    className={isFavorite
                        ? 'fill-themeblue2 text-themeblue2'
                        : 'text-tertiary/30'
                    }
                />
            </button>
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
    const { profile, updateProfile, syncProfileField } = useUserProfile()
    const favorites = profile.favoriteMedications ?? []
    const list = tc3Mode ? tc3MedList : medList

    const toggleFavorite = useCallback((tradeName: string) => {
        const current = profile.favoriteMedications ?? []
        const next = current.includes(tradeName)
            ? current.filter(n => n !== tradeName)
            : [...current, tradeName]
        updateProfile({ favoriteMedications: next })
        syncProfileField({ favorite_medications: next })
    }, [profile.favoriteMedications, updateProfile, syncProfileField])

    const { favoriteMeds, otherMeds } = useMemo(() => {
        const query = searchQuery.trim().toLowerCase()
        const isFav = (m: medListTypes) => favorites.includes(m.icon)
        const matchesQuery = (m: medListTypes) =>
            !query || m.icon.toLowerCase().includes(query) || m.text.toLowerCase().includes(query)

        const favs: medListTypes[] = []
        const others: medListTypes[] = []
        for (const m of list) {
            if (!matchesQuery(m)) continue
            if (isFav(m)) favs.push(m)
            else others.push(m)
        }
        return { favoriteMeds: favs, otherMeds: others }
    }, [list, favorites, searchQuery])

    if (selectedMedication) {
        return (
            <div className="h-full overflow-y-auto px-4 pb-4">
                <MedicationPage
                    medication={selectedMedication}
                    isFavorite={favorites.includes(selectedMedication.icon)}
                    onToggleFavorite={() => toggleFavorite(selectedMedication.icon)}
                />
            </div>
        )
    }

    return (
        <div className="h-full overflow-y-auto px-4 pb-4">
            {favoriteMeds.length > 0 && (
                <>
                    <div className="flex items-center gap-2 mt-1 mb-1 px-1">
                        <span className="text-[10px] font-semibold text-tertiary uppercase tracking-wider">
                            Favorites
                        </span>
                        <div className="h-px flex-1 bg-tertiary/10" />
                    </div>
                    {favoriteMeds.map(medication => (
                        <MedicationListItem
                            key={`fav-${medication.icon}`}
                            medication={medication}
                            onClick={() => onMedicationSelect(medication)}
                            isFavorite
                            onToggleFavorite={() => toggleFavorite(medication.icon)}
                        />
                    ))}
                </>
            )}

            {favoriteMeds.length > 0 && otherMeds.length > 0 && (
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
                    onClick={() => onMedicationSelect(medication)}
                    isFavorite={false}
                    onToggleFavorite={() => toggleFavorite(medication.icon)}
                />
            ))}
        </div>
    )
}
