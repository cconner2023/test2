import { SideNav } from './SideNav'
import { MENU_NAV_WIDTH } from '../Hooks/useMenuSlide'

const RAIL_WIDTH = 56

interface NavRailProps {
  expanded: boolean
  onExpand: () => void
  onClose: () => void
  onMenuItemClick: (action: string) => void
}

/** Desktop (md+) nav. The slot widens in the shell's flex row, pushing the app
 *  card right. Lives outside app-drawer-root so desktop drawers, absolute in
 *  it, open beside the rail instead of over it. */
export function NavRail({ expanded, onExpand, onClose, onMenuItemClick }: NavRailProps) {
  return (
    <nav
      aria-label="Tools"
      className="relative shrink-0 mr-2.5 h-full rounded-lg border border-[rgba(0,0,0,0.04)] bg-themewhite overflow-hidden transition-[width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
      style={{ width: expanded ? MENU_NAV_WIDTH : RAIL_WIDTH }}
    >
      <div className="h-full" style={{ width: MENU_NAV_WIDTH }}>
        <SideNav
          onClose={onClose}
          onMenuItemClick={onMenuItemClick}
          rail={{ collapsed: !expanded, onExpand, onCollapse: onClose }}
        />
      </div>
    </nav>
  )
}
