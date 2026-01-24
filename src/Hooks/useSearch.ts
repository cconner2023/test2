// Hooks/useSearch.ts
import { useState, useRef, useCallback } from 'react'
import type { SearchResultType } from '../Types/CatTypes'
import { catData } from '../Data/CatData'
import { medList, type medListTypes } from '../Data/MedData'

export function useSearch() {
    const [searchInput, setSearchInput] = useState("")
    const [searchResults, setSearchResults] = useState<SearchResultType[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const searchTimeoutRef = useRef<number | null>(null)

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
            const results: SearchResultType[] = []
            const lowerValue = value.toLowerCase()

            // === SEARCH MEDICATION LIST ===
            medList.forEach((med: medListTypes, index: number) => {
                // Search medication name (brand/generic)
                if (med.text.toLowerCase().includes(lowerValue)) {
                    results.push({
                        type: 'medication',
                        id: index,
                        icon: med.icon,
                        text: med.text,
                        categoryId: undefined,
                        contentId: undefined,
                        categoryText: 'Medications',
                        contentText: med.indication,
                        medData: med
                    })
                }
            })

            // === SEARCH EXISTING CATDATA ===
            catData.forEach(category => {
                // Search category names
                if (category.text.toLowerCase().includes(lowerValue)) {
                    results.push({
                        type: 'category',
                        id: category.id,
                        icon: category.icon,
                        text: category.text,
                        categoryId: category.id,
                        contentId: undefined,
                        guidelineType: undefined,
                        guidelineId: undefined,
                        categoryText: category.text,
                        contentText: undefined
                    })
                }

                category.contents.forEach(content => {
                    // Search complaint names
                    if (content.text.trim() && content.text.toLowerCase().includes(lowerValue)) {
                        results.push({
                            type: 'CC',
                            categoryId: category.id,
                            contentId: content.id,
                            categoryText: category.text,
                            contentText: content.text,
                            icon: content.icon,
                            text: content.text,
                            id: undefined,
                            guidelineType: undefined,
                            guidelineId: undefined
                        })
                    }

                    // Search DDX
                    if (content.DDX && Array.isArray(content.DDX)) {
                        content.DDX.forEach((DDX, DDXIndex) => {
                            if (DDX && DDX.text && DDX.text.toLowerCase().includes(lowerValue)) {
                                results.push({
                                    type: 'DDX',
                                    categoryId: category.id,
                                    categoryText: category.text,
                                    contentId: content.id,
                                    contentText: content.text,
                                    guidelineType: 'DDX',
                                    guidelineId: DDXIndex,
                                    icon: "DDX",
                                    text: `${DDX.text}`,
                                })
                            }
                        })
                    }

                    // Search medcom (TRAINING data - includes guidelineType)
                    if (content.medcom && Array.isArray(content.medcom)) {
                        content.medcom.forEach(guideline => {
                            if (guideline && guideline.text && guideline.text.toLowerCase().includes(lowerValue)) {
                                results.push({
                                    type: 'training',
                                    categoryId: category.id,
                                    categoryText: category.text,
                                    contentId: content.id,
                                    contentText: content.text,
                                    guidelineType: 'medcom', // This belongs here
                                    guidelineId: guideline.id || 0,
                                    icon: guideline.icon,
                                    text: guideline.text,
                                })
                            }
                        })
                    }

                    // Search stp (TRAINING data - includes guidelineType)
                    if (content.stp && Array.isArray(content.stp)) {
                        content.stp.forEach(guideline => {
                            if (guideline) {
                                if ('options' in guideline && Array.isArray(guideline.options)) {
                                    if (guideline.text && guideline.text.toLowerCase().includes(lowerValue)) {
                                        results.push({
                                            type: 'training',
                                            categoryId: category.id,
                                            categoryText: category.text,
                                            contentId: content.id,
                                            contentText: content.text,
                                            guidelineType: 'stp', // This belongs here
                                            guidelineId: guideline.id || 0,
                                            icon: guideline.icon,
                                            text: guideline.text,
                                        })
                                    }

                                    if (guideline.options && Array.isArray(guideline.options)) {
                                        guideline.options.forEach(option => {
                                            if (option && option.text && option.text.toLowerCase().includes(lowerValue)) {
                                                results.push({
                                                    type: 'training',
                                                    categoryId: category.id,
                                                    categoryText: category.text,
                                                    contentId: content.id,
                                                    contentText: content.text,
                                                    guidelineType: 'stp', // This belongs here
                                                    guidelineId: option.id || 0,
                                                    icon: option.icon,
                                                    text: option.text,
                                                })
                                            }
                                        })
                                    }
                                }
                                else if (guideline.text && guideline.text.toLowerCase().includes(lowerValue)) {
                                    results.push({
                                        type: 'training',
                                        categoryId: category.id,
                                        categoryText: category.text,
                                        contentId: content.id,
                                        contentText: content.text,
                                        guidelineType: 'stp', // This belongs here
                                        guidelineId: guideline.id || 0,
                                        icon: guideline.icon,
                                        text: guideline.text,
                                    })
                                }
                            }
                        })
                    }

                    // Search gen (TRAINING data - includes guidelineType)
                    if (content.gen && Array.isArray(content.gen)) {
                        content.gen.forEach((guideline, index) => {
                            if (guideline && guideline.text && guideline.text.trim() && guideline.text.toLowerCase().includes(lowerValue)) {
                                results.push({
                                    type: 'training',
                                    categoryId: category.id,
                                    categoryText: category.text,
                                    contentId: content.id,
                                    contentText: content.text,
                                    guidelineType: 'gen', // This belongs here
                                    guidelineId: index + 1,
                                    icon: "📝",
                                    text: guideline.text,
                                })
                            }
                        })
                    }
                })
            })

            // Sort results with medication priority
            const sortedResults = results.sort((a, b) => {
                const priorityMap = {
                    'category': 1,
                    'CC': 2,
                    'training': 3,
                    'DDX': 4,
                    'medication': 5
                }

                const priorityA = priorityMap[a.type] || 5
                const priorityB = priorityMap[b.type] || 5

                if (priorityA !== priorityB) {
                    return priorityA - priorityB
                }
                const textA = a.text || ''
                const textB = b.text || ''
                return textA.localeCompare(textB)
            })

            setSearchResults(sortedResults)
            setIsSearching(false)
        }, 300)
    }, [])

    const clearSearch = useCallback(() => {
        setSearchInput("")
        setSearchResults([])
        setIsSearching(false)
        if (searchTimeoutRef.current) {
            window.clearTimeout(searchTimeoutRef.current)
            searchTimeoutRef.current = null
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