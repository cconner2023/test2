// Hooks/useSearch.ts
import { useState, useRef, useCallback, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { catData } from '../Data/CatData'
import { medList } from '../Data/MedData'
import { stp68wTraining } from '../Data/TrainingTaskList'
import { kbCategories } from '../Data/KnowledgeBaseCategories'
import { useMessagingStore } from '../stores/useMessagingStore'
import { useCalendarStore } from '../stores/useCalendarStore'
import { useMapOverlaysStore, useMapOverlaysCache } from '../stores/useMapOverlaysStore'
import { useClinicMedics } from './useClinicMedics'
import { useAuth } from './useAuth'
import { getDisplayName } from '../Utilities/nameUtils'
import type { SearchResultType } from '../Types/CatTypes'
import type { ClinicMedic } from '../Types/SupervisorTestTypes'

/**
 * Provides debounced search across categories, symptoms, medications, training tasks, and guidelines.
 * Builds a search index on first render and filters with type-priority sorting.
 */
export function useSearch() {
    const [searchInput, setSearchInput] = useState('')
    const [staticResults, setStaticResults] = useState<SearchResultType[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const searchTimeoutRef = useRef<number>(0)

    // ── Live chat search inputs (authenticated only) ─────────────────
    const { isAuthenticated, user, profile, clinicId } = useAuth()
    const userId = user?.id ?? null
    const { medics } = useClinicMedics()
    const conversations = useMessagingStore(useShallow(s => s.conversations))
    const groups = useMessagingStore(useShallow(s => s.groups))
    const deletedConversations = useMessagingStore(useShallow(s => s.deletedConversations))

    // ── Live calendar + map search inputs ────────────────────────────
    const calendarEvents = useCalendarStore(useShallow(s => s.events))
    useMapOverlaysCache(isAuthenticated ? clinicId : null)
    const overlays = useMapOverlaysStore(useShallow(s => s.overlays))

    const selfMedic: ClinicMedic | null = useMemo(() => (
        userId
            ? { id: userId, firstName: profile.firstName ?? null, lastName: profile.lastName ?? 'Notes', middleInitial: null, rank: profile.rank ?? null, credential: null, avatarId: null }
            : null
    ), [userId, profile.firstName, profile.lastName, profile.rank])

    // Build search index once with references
    const searchIndex = useMemo(() => {
        const items: SearchResultType[] = []

        // Helper to add guideline items
        const addGuidelines = (
            guidelines: Array<{ id?: number; icon?: string; text?: string }> | undefined,
            category: typeof catData[0],
            symptom: NonNullable<typeof catData[0]['contents']>[0],
            guidelineType: string,
            resultType: 'training' | 'DDX',
            defaultIcon: string
        ) => {
            guidelines?.forEach((guideline, index) => {
                if (guideline?.text) {
                    items.push({
                        type: resultType,
                        id: guideline.id ?? index,
                        icon: guideline.icon || defaultIcon,
                        text: guideline.text,
                        data: {
                            categoryId: category.id,
                            symptomId: symptom.id,
                            categoryRef: category,
                            symptomRef: symptom,
                            guidelineType,
                            guidelineId: guideline.id ?? index
                        }
                    })
                }
            })
        }

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

                // Guidelines
                addGuidelines(symptom.DDX, category, symptom, 'DDX', 'DDX', 'DDX')
                addGuidelines(symptom.medcom, category, symptom, 'medcom', 'training', '💊')
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

        // Build reverse map: task ID → first symptom/category context from catData
        const taskSymptomMap = new Map<string, { categoryId: number; symptomId: number; categoryRef: typeof catData[0]; symptomRef: NonNullable<typeof catData[0]['contents']>[0] }>()
        catData.forEach(category => {
            category.contents?.forEach(symptom => {
                symptom.stp?.forEach(stpEntry => {
                    if ('icon' in stpEntry && stpEntry.icon && !taskSymptomMap.has(stpEntry.icon)) {
                        taskSymptomMap.set(stpEntry.icon, {
                            categoryId: category.id,
                            symptomId: symptom.id,
                            categoryRef: category,
                            symptomRef: symptom,
                        })
                    }
                })
            })
        })

        // STP Training Tasks (deduplicated — same task can appear in multiple skill levels)
        const seenTaskIds = new Set<string>()
        stp68wTraining.forEach(skillLevelEntry => {
            skillLevelEntry.subjectArea.forEach(area => {
                area.tasks.forEach(task => {
                    if (!seenTaskIds.has(task.id)) {
                        seenTaskIds.add(task.id)
                        const symptomContext = taskSymptomMap.get(task.id)
                        items.push({
                            type: 'training',
                            id: items.length,
                            icon: '📋',
                            text: task.title,
                            data: {
                                guidelineType: 'stp-task',
                                taskId: task.id,
                                skillLevel: skillLevelEntry.skillLevel,
                                subjectArea: area.name,
                                ...(symptomContext && {
                                    categoryId: symptomContext.categoryId,
                                    symptomId: symptomContext.symptomId,
                                    categoryRef: symptomContext.categoryRef,
                                    symptomRef: symptomContext.symptomRef,
                                }),
                            }
                        })
                    }
                })
            })
        })

        // Screeners & Calculators from KB categories
        kbCategories.forEach((cat, index) => {
            if (cat.comingSoon) return
            if (cat.group === 'screening') {
                items.push({
                    type: 'screener',
                    id: index,
                    icon: '🧠',
                    text: cat.label,
                    data: { kbCategoryId: cat.id }
                })
            } else if (cat.group === 'calculators') {
                items.push({
                    type: 'calculator',
                    id: index,
                    icon: '🔢',
                    text: cat.label,
                    data: { kbCategoryId: cat.id }
                })
            }
        })

        return items
    }, [])

    const handleSearchChange = useCallback((value: string) => {
        setSearchInput(value)

        if (!value.trim()) {
            setStaticResults([])
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
            const typePriority: Record<string, number> = {
                'category': 1,
                'CC': 2,
                'screener': 3,
                'calculator': 3,
                'training': 4,
                'DDX': 5,
                'medication': 6
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

            setStaticResults(results)
            setIsSearching(false)
        }, 150)
    }, [searchIndex])

    const clearSearch = useCallback(() => {
        setSearchInput('')
        setStaticResults([])
        setIsSearching(false)
        if (searchTimeoutRef.current) {
            window.clearTimeout(searchTimeoutRef.current)
            searchTimeoutRef.current = 0
        }
    }, [])

    // ── Reactive chat search — runs on every keystroke against live IDB state ──
    const chatResults = useMemo<SearchResultType[]>(() => {
        const q = searchInput.trim().toLowerCase()
        if (!q || !isAuthenticated || !userId) return []

        const allMedics: ClinicMedic[] = selfMedic ? [selfMedic, ...medics] : medics
        const medicMap = new Map<string, ClinicMedic>()
        for (const m of allMedics) medicMap.set(m.id, m)

        const out: SearchResultType[] = []
        const matchedKeys = new Set<string>()

        // 1. Contact matches by name / rank / credential / clinic
        for (const m of allMedics) {
            const haystacks = [
                m.firstName,
                m.lastName,
                m.rank,
                m.credential,
                m.clinicName,
                [m.rank, m.lastName].filter(Boolean).join(' '),
            ]
            if (haystacks.some(h => h?.toLowerCase().includes(q))) {
                if (matchedKeys.has(m.id)) continue
                matchedKeys.add(m.id)
                out.push({
                    type: 'chat-contact',
                    id: m.id,
                    icon: '💬',
                    text: getDisplayName(m),
                    data: {
                        peerId: m.id,
                        peerName: getDisplayName(m),
                        chatSubtitle: m.clinicName ?? undefined,
                    },
                })
            }
        }

        // 2. Group matches by name
        for (const g of Object.values(groups)) {
            if (g.systemType) continue
            if (g.name.toLowerCase().includes(q)) {
                if (matchedKeys.has(g.groupId)) continue
                matchedKeys.add(g.groupId)
                out.push({
                    type: 'chat-group',
                    id: g.groupId,
                    icon: '👥',
                    text: g.name,
                    data: {
                        groupId: g.groupId,
                        peerName: g.name,
                    },
                })
            }
        }

        // 3. Message content matches — first hit per conversation
        for (const [key, msgs] of Object.entries(conversations)) {
            if (matchedKeys.has(key)) continue
            if (groups[key]?.systemType) continue
            const tombstoneAt = deletedConversations[key]
            for (const msg of msgs) {
                if (msg.threadId || msg.messageType === 'request-accepted') continue
                if (tombstoneAt && msg.createdAt < tombstoneAt) continue
                const text = msg.plaintext
                if (text && text.toLowerCase().includes(q)) {
                    const isGroup = !!groups[key]
                    const medic = medicMap.get(key)
                    const peerName = isGroup
                        ? groups[key].name
                        : (medic ? getDisplayName(medic) : (key === userId ? 'Notes' : 'Unknown'))
                    out.push({
                        type: 'chat-message',
                        id: `${key}:${msg.id ?? msg.createdAt}`,
                        icon: isGroup ? '👥' : '💬',
                        text,
                        data: {
                            peerId: isGroup ? undefined : key,
                            groupId: isGroup ? key : undefined,
                            peerName,
                            matchedText: text,
                            chatSubtitle: peerName,
                        },
                    })
                    matchedKeys.add(key)
                    break
                }
            }
        }

        return out.slice(0, 40)
    }, [searchInput, isAuthenticated, userId, selfMedic, medics, groups, conversations, deletedConversations])

    const calendarResults = useMemo<SearchResultType[]>(() => {
        const q = searchInput.trim().toLowerCase()
        if (!q || !isAuthenticated) return []

        const out: SearchResultType[] = []
        for (const event of calendarEvents) {
            const hay = [event.title, event.description, event.location, event.opord_notes]
            if (!hay.some(h => h?.toLowerCase().includes(q))) continue
            const date = event.start_time?.slice(0, 10) ?? ''
            const subtitle = [date, event.category].filter(Boolean).join(' · ')
            out.push({
                type: 'calendar-event',
                id: event.id,
                icon: '📅',
                text: event.title || '(untitled event)',
                data: {
                    eventId: event.id,
                    eventSubtitle: subtitle,
                },
            })
            if (out.length >= 20) break
        }
        return out
    }, [searchInput, isAuthenticated, calendarEvents])

    const mapResults = useMemo<SearchResultType[]>(() => {
        const q = searchInput.trim().toLowerCase()
        if (!q || !isAuthenticated) return []

        const out: SearchResultType[] = []
        for (const overlay of overlays) {
            const overlayNameHit = overlay.name?.toLowerCase().includes(q)
                || overlay.description?.toLowerCase().includes(q)
            if (overlayNameHit) {
                out.push({
                    type: 'map-overlay',
                    id: overlay.id,
                    icon: '🗺️',
                    text: overlay.name || '(untitled overlay)',
                    data: {
                        overlayId: overlay.id,
                        overlayName: overlay.name,
                    },
                })
                if (out.length >= 20) break
            }
            for (const feature of overlay.features) {
                if (out.length >= 20) break
                const label = feature.label?.toLowerCase()
                const notes = feature.notes?.toLowerCase()
                if (!label?.includes(q) && !notes?.includes(q)) continue
                out.push({
                    type: 'map-feature',
                    id: `${overlay.id}:${feature.id}`,
                    icon: feature.type === 'route' ? '➰' : feature.type === 'area' ? '⬛' : '📍',
                    text: feature.label || `(${feature.type})`,
                    data: {
                        overlayId: overlay.id,
                        overlayName: overlay.name,
                        featureId: feature.id,
                        featureSubtitle: overlay.name,
                    },
                })
            }
            if (out.length >= 20) break
        }
        return out
    }, [searchInput, isAuthenticated, overlays])

    const searchResults = useMemo<SearchResultType[]>(
        () => [...chatResults, ...calendarResults, ...mapResults, ...staticResults],
        [chatResults, calendarResults, mapResults, staticResults],
    )

    return {
        searchInput,
        setSearchInput,
        searchResults,
        isSearching,
        handleSearchChange,
        clearSearch,
    }
}