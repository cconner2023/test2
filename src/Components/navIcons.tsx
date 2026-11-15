import type { NavigationStore } from '../stores/useNavigationStore'
import { Upload, BookOpen, Package, ClipboardCheck, Settings, HelpCircle, UserCog, Radio, Map as MapIcon, CalendarDays, Stethoscope, MessageSquare, Crosshair, ClipboardList, type LucideIcon } from 'lucide-react'

const NAV_ICONS: Record<string, LucideIcon> = {
  import: Upload,
  knowledgebase: BookOpen,
  messages: MessageSquare,
  property: Package,
  provider: Stethoscope,
  supervisor: ClipboardCheck,
  settings: Settings,
  userGuide: HelpCircle,
  admin: UserCog,
  lora: Radio,
  mapOverlay: MapIcon,
  calendar: CalendarDays,
  tc3: Crosshair,
  trackingBoard: ClipboardList,
}

export function NavIcon({ action, size, className = 'text-primary' }: { action: string; size: number; className?: string }) {
  const Icon = NAV_ICONS[action] ?? HelpCircle
  return <Icon size={size} className={className} />
}

/** Reached from NavTop on desktop (KB button, import field), so the desktop
 *  menu and rail skip them. */
export const DESKTOP_HIDDEN_ACTIONS = new Set(['knowledgebase', 'import'])

/** Open flag and closer per drawer-backed nav action, for the rail's active
 *  state and click-the-open-tool-to-close. */
export const NAV_OPEN_STATE: Record<string, [keyof NavigationStore, (n: NavigationStore) => void]> = {
  provider: ['showProviderDrawer', (n) => n.setShowProviderDrawer(false)],
  supervisor: ['showSupervisorDrawer', (n) => n.setShowSupervisorDrawer(false)],
  admin: ['showAdminDrawer', (n) => n.setShowAdminDrawer(false)],
  tc3: ['showTC3Drawer', (n) => n.setShowTC3Drawer(false)],
  calendar: ['showCalendarDrawer', (n) => n.setShowCalendarDrawer(false)],
  property: ['showPropertyDrawer', (n) => n.setShowPropertyDrawer(false)],
  mapOverlay: ['showMapOverlayDrawer', (n) => n.setShowMapOverlayDrawer(false)],
  trackingBoard: ['showTrackingBoardDrawer', (n) => n.setShowTrackingBoardDrawer(false)],
  messages: ['showMessagesDrawer', (n) => { n.setShowMessagesDrawer(false); n.clearMessagesConversation() }],
  settings: ['showSettings', (n) => n.setShowSettings(false)],
  userGuide: ['showUserGuideDrawer', (n) => n.setShowUserGuideDrawer(false)],
}
