import { Scrim } from '@/Components/primitives/Scrim'
import { DRAWER_FADE_TRANSITION } from '../Utilities/constants'
import { SideNav } from './SideNav'
import { MENU_NAV_WIDTH } from '../Hooks/useMenuSlide'

const RAIL_WIDTH = 56

interface NavRailProps {
  expanded: boolean
  onExpand: () => void
  onClose: () => void
  onMenuItemClick: (action: string) => void
}

/** Desktop (md+) nav. The slot holds the collapsed width in the shell's flex
 *  row; the panel widens over the app card so expanding never reflows the app.
 *  Lives outside app-drawer-root so desktop drawers, absolute in it, open
 *  beside the rail instead of over it. */
export function NavRail({ expanded, onExpand, onClose, onMenuItemClick }: NavRailProps) {
  return (
    <>
      <Scrim
        variant="solid"
        progress={expanded ? 1 : 0}
        zIndex={69}
        transition={DRAWER_FADE_TRANSITION}
        onClick={onClose}
      />
      <div className="relative shrink-0 mr-2.5 h-full z-[70]" style={{ width: RAIL_WIDTH }}>
        <nav
          aria-label="Tools"
          className="absolute inset-y-0 left-0 rounded-lg border border-[rgba(0,0,0,0.04)] bg-themewhite overflow-hidden transition-[width,box-shadow] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
          style={{
            width: expanded ? MENU_NAV_WIDTH : RAIL_WIDTH,
            boxShadow: expanded ? '0 8px 30px rgba(0,0,0,0.12)' : 'none',
          }}
        >
          <div className="h-full" style={{ width: MENU_NAV_WIDTH }}>
            <SideNav
              onClose={onClose}
              onMenuItemClick={onMenuItemClick}
              rail={{ collapsed: !expanded, onExpand }}
            />
          </div>
        </nav>
      </div>
    </>
  )
}
