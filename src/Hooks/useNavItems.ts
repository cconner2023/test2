import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { menuData } from '../Data/CatData'
import { useAuth } from './useAuth'
import { PROPERTY_MANAGEMENT_ENABLED, LORA_MESH_ENABLED, MAP_OVERLAY_ENABLED, CALENDAR_ENABLED } from '../lib/featureFlags'
import { useNavPreferencesStore } from '../stores/useNavPreferencesStore'
import type { sideMenuDataType } from '../Types/CatTypes'

interface UseNavItemsReturn {
  visibleItems: sideMenuDataType[]
  hidden: string[]
  hiddenCount: number
  currentActionOrder: string[]
  isDefaultOrder: boolean
  starred: string[]
  toggleStar: (action: string) => void
  toggleHide: (action: string) => void
  moveItem: (action: string, direction: 'up' | 'down', currentOrder: string[]) => void
  resetToDefault: () => void
}

export function useNavItems(): UseNavItemsReturn {
  const { isAuthenticated, isSupervisorRole, isDevRole, isProviderRole } = useAuth()

  const { customOrder, starred, hidden, toggleStar, toggleHide, moveItem, resetToDefault } =
    useNavPreferencesStore(useShallow((s) => ({
      customOrder: s.customOrder,
      starred: s.starred,
      hidden: s.hidden,
      toggleStar: s.toggleStar,
      toggleHide: s.toggleHide,
      moveItem: s.moveItem,
      resetToDefault: s.resetToDefault,
    })))

  const gatedItems = useMemo(() => menuData.filter(item => {
    if (!item.gateKey) return true
    if (item.gateKey === 'authenticated') return isAuthenticated
    if (item.gateKey === 'property') return isAuthenticated && PROPERTY_MANAGEMENT_ENABLED && isDevRole
    if (item.gateKey === 'provider') return isProviderRole
    if (item.gateKey === 'supervisor') return isSupervisorRole
    if (item.gateKey === 'admin') return isDevRole
    if (item.gateKey === 'lora') return isAuthenticated && (LORA_MESH_ENABLED || isDevRole)
    if (item.gateKey === 'mapOverlay') return isAuthenticated && (MAP_OVERLAY_ENABLED || isDevRole)
    if (item.gateKey === 'calendar') return isAuthenticated && (CALENDAR_ENABLED || isDevRole)
    return true
  }), [isAuthenticated, isSupervisorRole, isDevRole, isProviderRole])

  const visibleItems = useMemo(() => {
    const gatedActions = new Set(gatedItems.map(i => i.action))
    const itemMap = new Map(gatedItems.map(i => [i.action, i]))

    let ordered = customOrder
      ? customOrder.filter(a => gatedActions.has(a)).map(a => itemMap.get(a)!)
      : [...gatedItems]

    if (customOrder) {
      const inOrder = new Set(customOrder)
      const missing = gatedItems.filter(i => !inOrder.has(i.action))
      const settingsIdx = ordered.findIndex(i => i.action === 'settings')
      if (settingsIdx !== -1) {
        ordered.splice(settingsIdx, 0, ...missing)
      } else {
        ordered.push(...missing)
      }
    }

    const pinnedActions = new Set(['settings'])
    const hiddenSet = new Set(hidden)
    ordered = ordered.filter(i => !hiddenSet.has(i.action) || pinnedActions.has(i.action))

    const starredSet = new Set(starred)
    const starredItems = ordered.filter(i => starredSet.has(i.action) && !pinnedActions.has(i.action))
    const unstarredItems = ordered.filter(i => !starredSet.has(i.action) || pinnedActions.has(i.action))

    return [...starredItems, ...unstarredItems]
  }, [gatedItems, customOrder, starred, hidden])

  const hiddenCount = useMemo(() => {
    const gatedActions = new Set(gatedItems.map(i => i.action))
    return hidden.filter(a => gatedActions.has(a)).length
  }, [gatedItems, hidden])

  const isDefaultOrder = customOrder === null && starred.length === 0

  const currentActionOrder = useMemo(() => visibleItems.map(i => i.action), [visibleItems])

  return {
    visibleItems,
    hidden,
    hiddenCount,
    currentActionOrder,
    isDefaultOrder,
    starred,
    toggleStar,
    toggleHide,
    moveItem,
    resetToDefault,
  }
}
