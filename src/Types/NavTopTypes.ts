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
 * Import/barcode-related props grouped together
 */
interface ImportProps {
  isImportExpanded?: boolean
  onImportExpandToggle?: () => void
  onImportSubmit?: (barcodeText: string) => void
  onImportScan?: () => void
  onImportImage?: () => void
  importError?: string
}

/**
 * Navigation action handlers grouped together
 */
interface NavigationActions {
  onBackClick?: () => void
  onMenuClick?: () => void
  onImportClick?: () => void
  onKnowledgeBaseClick?: () => void
  onSettingsClick?: () => void
  onInfoClick?: () => void
  onMessagesClick?: () => void
  onPropertyClick?: () => void
  onLoRaClick?: () => void
  onMapOverlayClick?: () => void
  onSupervisorClick?: () => void
  onAdminClick?: () => void
}

/**
 * UI state and display props grouped together
 */
interface UIState {
  showBack?: boolean
  showMenu?: boolean
  dynamicTitle?: string
  isMobile: boolean
  isAlgorithmView?: boolean
}

/**
 * Complete NavTop props - now organized into 3 logical groups
 */
export interface NavTopProps {
  search: SearchProps
  import?: ImportProps
  actions: NavigationActions
  ui: UIState
}
