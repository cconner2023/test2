import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const UNMOVABLE_ACTIONS = ['settings'] as const
const UNHIDEABLE_ACTIONS = ['settings'] as const

interface NavPreferencesState {
  customOrder: string[] | null
  starred: string[]
  hidden: string[]

  toggleStar: (action: string) => void
  toggleHide: (action: string) => void
  moveItem: (action: string, direction: 'up' | 'down', currentOrder: string[]) => void
  resetToDefault: () => void
}

export const useNavPreferencesStore = create<NavPreferencesState>()(
  persist(
    (set) => ({
      customOrder: null,
      starred: [],
      hidden: [],

      toggleStar: (action) =>
        set((state) => ({
          starred: state.starred.includes(action)
            ? state.starred.filter((a) => a !== action)
            : [...state.starred, action],
        })),

      toggleHide: (action) => {
        if ((UNHIDEABLE_ACTIONS as readonly string[]).includes(action)) return
        set((state) => ({
          hidden: state.hidden.includes(action)
            ? state.hidden.filter((a) => a !== action)
            : [...state.hidden, action],
        }))
      },

      moveItem: (action, direction, currentOrder) => {
        if ((UNMOVABLE_ACTIONS as readonly string[]).includes(action)) return
        set((state) => {
          const order = state.customOrder ? [...state.customOrder] : [...currentOrder]
          const idx = order.indexOf(action)
          if (idx === -1) return state

          const settingsIdx = order.indexOf('settings')
          const lastMovableIdx = settingsIdx !== -1 ? settingsIdx - 1 : order.length - 1

          if (direction === 'up' && idx <= 0) return state
          if (direction === 'down' && idx >= lastMovableIdx) return state

          const swapIdx = direction === 'up' ? idx - 1 : idx + 1
          order[idx] = order[swapIdx]
          order[swapIdx] = action

          return { customOrder: order }
        })
      },

      resetToDefault: () =>
        set({ customOrder: null, starred: [], hidden: [] }),
    }),
    { name: 'nav-preferences' },
  ),
)
