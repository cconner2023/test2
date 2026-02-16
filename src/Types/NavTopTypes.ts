// Types/NavTopTypes.ts - Grouped prop interfaces for NavTop component

/**
 * Search-related props grouped together
 */
interface SearchProps {
  searchInput: string
  onSearchChange: (value: string) => void
  onSearchFocus?: () => void
  onSearchClear?: () => void
  onSearchCollapse?: () => void
  searchInputRef?: React.RefObject<HTMLInputElement>
  isSearchExpanded?: boolean
  onSearchExpandToggle?: () => void
}

/**
 * Navigation action handlers grouped together
 */
interface NavigationActions {
  onBackClick?: () => void
  onMenuClick?: () => void
  onMenuClose?: () => void
  onImportClick?: () => void
  onMedicationClick?: () => void
  onSettingsClick?: () => void
  onInfoClick?: () => void
}

/**
 * Mobile avatar data for the menu trigger button
 */
interface MobileAvatarData {
  avatarSvg: React.ReactNode
  customImage: string | null
  isCustom: boolean
}

/**
 * UI state and display props grouped together
 */
interface UIState {
  showBack?: boolean
  showMenu?: boolean
  dynamicTitle?: string
  medicationButtonText?: string
  isMobile: boolean
  isAlgorithmView?: boolean
  isMenuOpen?: boolean
  mobileAvatar?: MobileAvatarData
}

/**
 * Complete NavTop props - now organized into 3 logical groups
 */
export interface NavTopProps {
  search: SearchProps
  actions: NavigationActions
  ui: UIState
}
