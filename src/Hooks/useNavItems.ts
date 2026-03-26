import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { menuData } from '../Data/CatData'
import { useAuth } from './useAuth'
import { useNavPreferencesStore } from '../stores/useNavPreferencesStore'
import type { AccessLevel, sideMenuDataType } from '../Types/CatTypes'

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

  const accessChecks: Record<AccessLevel, boolean> = useMemo(() => ({
    public: true,
    authenticated: isAuthenticated,
    provider: isProviderRole,
    supervisor: isSupervisorRole,
    admin: isDevRole,
  }), [isAuthenticated, isProviderRole, isSupervisorRole, isDevRole])

  const gatedItems = useMemo(() => menuData.filter(item => {
    const meetsAccess = accessChecks[item.access ?? 'public']
    const meetsStage = item.stage === 'beta' ? isDevRole : true
    return meetsAccess && meetsStage
  }), [accessChecks, isDevRole])

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
