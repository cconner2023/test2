import type { NavigationStore } from '../stores/useNavigationStore'
import { Upload, BookOpen, Package, ClipboardCheck, Settings, HelpCircle, UserCog, Radio, Map as MapIcon, CalendarDays, Stethoscope, MessageSquare, Crosshair, createLucideIcon, type LucideIcon } from 'lucide-react'

/** lucide v1 `playing-cards-fan` — not in our 0.562 build. */
export const PlayingCardsFan = createLucideIcon('playing-cards-fan', [
  ['path', { d: 'M12.65 7.65a2 2 0 012.629-1.046l5.51 2.374a2 2 0 011.046 2.628l-3.957 9.184a2 2 0 01-2.628 1.046l-5.51-2.374a2 2 0 01-1.046-2.628z', key: 'a' }],
  ['path', { d: 'M18 7.777V4a2 2 0 00-2-2h-6a2 2 0 00-2 2v10a2 2 0 001.137 1.805', key: 'b' }],
  ['path', { d: 'm8 4.389-4.364.809a2 2 0 00-1.602 2.33l1.822 9.833a2 2 0 002.331 1.602l2.542-.47', key: 'c' }],
])

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
  trackingBoard: PlayingCardsFan,
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
