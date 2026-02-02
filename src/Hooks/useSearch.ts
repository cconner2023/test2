// Hooks/useSearch.ts
import { useState, useRef, useCallback, useMemo } from 'react'
import { catData } from '../Data/CatData'
import { medList } from '../Data/MedData'
import type { SearchResultType } from '../Types/CatTypes'

export function useSearch() {
    const [searchInput, setSearchInput] = useState('')
    const [searchResults, setSearchResults] = useState<SearchResultType[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const searchTimeoutRef = useRef<number>(0)

    // Build search index once with references
    const searchIndex = useMemo(() => {
        const items: SearchResultType[] = []

        // Categories
        catData.forEach(category => {
            items.push({
                type: 'category',
                id: category.id,
                icon: category.icon,
                text: category.text,
                data: {
                    categoryRef: category,
                    categoryId: category.id
                }
            })
        })

        // Symptoms and guidelines
        catData.forEach(category => {
            category.contents?.forEach(symptom => {
                // Symptom itself
                items.push({
                    type: 'CC',
                    id: symptom.id,
                    icon: symptom.icon,
                    text: symptom.text,
                    data: {
                        categoryId: category.id,
                        symptomId: symptom.id,
                        categoryRef: category,
                        symptomRef: symptom
                    }
                })

                // DDX items
                symptom.DDX?.forEach((ddx, index) => {
                    if (ddx?.text) {
                        items.push({
                            type: 'DDX',
                            id: index,
                            icon: 'DDX',
                            text: ddx.text,
                            data: {
                                categoryId: category.id,
                                symptomId: symptom.id,
                                categoryRef: category,
                                symptomRef: symptom,
                                guidelineType: 'DDX',
                                guidelineId: index
                            }
                        })
                    }
                })

                // Medcom guidelines
                symptom.medcom?.forEach(guideline => {
                    if (guideline?.text) {
                        items.push({
                            type: 'training',
                            id: guideline.id || 0,
                            icon: guideline.icon || '💊',
                            text: guideline.text,
                            data: {
                                categoryId: category.id,
                                symptomId: symptom.id,
                                categoryRef: category,
                                symptomRef: symptom,
                                guidelineType: 'medcom',
                                guidelineId: guideline.id || 0
                            }
                        })
                    }
                })

                // STP guidelines
                symptom.stp?.forEach(guideline => {
                    if (guideline?.text) {
                        items.push({
                            type: 'training',
                            id: guideline.id || 0,
                            icon: guideline.icon || '📋',
                            text: guideline.text,
                            data: {
                                categoryId: category.id,
                                symptomId: symptom.id,
                                categoryRef: category,
                                symptomRef: symptom,
                                guidelineType: 'stp',
                                guidelineId: guideline.id || 0
                            }
                        })
                    }
                })

                // GEN guidelines
                symptom.gen?.forEach((guideline, index) => {
                    if (guideline?.text) {
                        items.push({
                            type: 'training',
                            id: index,
                            icon: '📝',
                            text: guideline.text,
                            data: {
                                categoryId: category.id,
                                symptomId: symptom.id,
                                categoryRef: category,
                                symptomRef: symptom,
                                guidelineType: 'gen',
                                guidelineId: index
                            }
                        })
                    }
                })
            })
        })

        // Medications
        medList.forEach((medication, index) => {
            items.push({
                type: 'medication',
                id: index,
                icon: medication.icon,
                text: medication.text,
                data: {
                    medicationData: medication
                }
            })
        })

        return items
    }, [])

    const handleSearchChange = useCallback((value: string) => {
        setSearchInput(value)

        if (!value.trim()) {
            setSearchResults([])
            setIsSearching(false)
            return
        }

        setIsSearching(true)

        if (searchTimeoutRef.current) {
            window.clearTimeout(searchTimeoutRef.current)
        }

        searchTimeoutRef.current = window.setTimeout(() => {
            const lowerValue = value.toLowerCase()

            // Filter and sort
            const typePriority = {
                'category': 1,
                'CC': 2,
                'training': 3,
                'DDX': 4,
                'medication': 5
            }

            const filteredItems = searchIndex
                .filter(item => item.text.toLowerCase().includes(lowerValue))
                .slice(0, 100)

            const results = filteredItems
                .sort((a, b) => {
                    const priorityA = typePriority[a.type] || 5
                    const priorityB = typePriority[b.type] || 5
                    if (priorityA !== priorityB) return priorityA - priorityB
                    return a.text.localeCompare(b.text)
                })

            setSearchResults(results)
            setIsSearching(false)
        }, 150)
    }, [searchIndex])

    const clearSearch = useCallback(() => {
        setSearchInput('')
        setSearchResults([])
        setIsSearching(false)
        if (searchTimeoutRef.current) {
            window.clearTimeout(searchTimeoutRef.current)
            searchTimeoutRef.current = 0
        }
    }, [])

    return {
        searchInput,
        setSearchInput,
        searchResults,
        isSearching,
        handleSearchChange,
        clearSearch,
    }
}