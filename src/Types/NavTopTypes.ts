// Types/NavTopTypes.ts - Grouped prop interfaces for NavTop component

/**
 * Search-related props grouped together
 */
export interface SearchProps {
  searchInput: string
  onSearchChange: (value: string) => void
  onSearchFocus?: () => void
  onSearchClear?: () => void
  searchInputRef?: React.RefObject<HTMLInputElement>
  isSearchExpanded?: boolean
  onSearchExpandToggle?: () => void
}

/**
 * Navigation action handlers grouped together
 */
export interface NavigationActions {
  onBackClick?: () => void
  onMenuClick?: () => void
  onImportClick?: () => void
  onMedicationClick?: () => void
  onSettingsClick?: () => void
  onInfoClick?: () => void
}

/**
 * UI state and display props grouped together
 */
export interface UIState {
  showBack?: boolean
  showMenu?: boolean
  dynamicTitle?: string
  showDynamicTitle?: boolean
  showMedicationList?: boolean
  medicationButtonText?: string
  isMobile: boolean
}

/**
 * Complete NavTop props - now organized into 3 logical groups
 */
export interface NavTopProps {
  search: SearchProps
  actions: NavigationActions
  ui: UIState
}
