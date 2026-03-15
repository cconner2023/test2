import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Upload, BookOpen, Mail, Package, ClipboardCheck, Settings, HelpCircle, UserCog, Radio, Map as MapIcon, Eye } from 'lucide-react'
import { useAuth } from '../Hooks/useAuth'
import { useAvatar } from '../Utilities/AvatarContext'
import { useMessagesContext } from '../Hooks/MessagesContext'
import { getInitials } from '../Utilities/nameUtils'
import { useNavItems } from '../Hooks/useNavItems'
import { NavItemContextMenu } from './NavItemContextMenu'

const iconMap: Record<string, React.ReactNode> = {
  'import': <Upload size={20} className="text-primary/70" />,
  'knowledgebase': <BookOpen size={20} className="text-primary/70" />,
  'messages': <Mail size={20} className="text-primary/70" />,
  'property': <Package size={20} className="text-primary/70" />,
  'supervisor': <ClipboardCheck size={20} className="text-primary/70" />,
  'settings': <Settings size={20} className="text-primary/70" />,
  'admin': <UserCog size={20} className="text-primary/70" />,
  'lora': <Radio size={20} className="text-primary/70" />,
  'mapOverlay': <MapIcon size={20} className="text-primary/70" />,
}

const BETA_ACTIONS = new Set(['lora', 'mapOverlay'])
const LONG_PRESS_MS = 500

const subscribeOnline = (cb: () => void) => {
  window.addEventListener('online', cb)
  window.addEventListener('offline', cb)
  return () => {
    window.removeEventListener('online', cb)
    window.removeEventListener('offline', cb)
  }
}
const getOnline = () => navigator.onLine

interface SideNavProps {
  onClose: () => void
  onMenuItemClick: (action: string) => void
}

export function SideNav({ onClose, onMenuItemClick }: SideNavProps) {
  const { currentAvatar, customImage, isCustom, isInitials } = useAvatar()
  const { profile } = useAuth()
  const messagesCtx = useMessagesContext()
  const isConnected = useSyncExternalStore(subscribeOnline, getOnline)

  const {
    visibleItems, hidden, hiddenCount, currentActionOrder, isDefaultOrder,
    starred, toggleStar, toggleHide, moveItem,
  } = useNavItems()

  const [contextMenu, setContextMenu] = useState<{
    action: string
    label: string
    position: { x: number; y: number }
  } | null>(null)

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressFired = useRef(false)

  const totalUnread = useMemo(() => {
    if (!messagesCtx) return 0
    return Object.values(messagesCtx.unreadCounts).reduce((sum, n) => sum + n, 0)
  }, [messagesCtx?.unreadCounts])

  const handleItemClick = (action: string) => {
    onMenuItemClick(action)
    onClose()
  }

  const startLongPress = useCallback((action: string, label: string, e: React.TouchEvent | React.MouseEvent) => {
    if (action === 'settings') return
    longPressFired.current = false
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true
      setContextMenu({ action, label, position: { x: clientX, y: clientY } })
    }, LONG_PRESS_MS)
  }, [])

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  const handleClick = useCallback((action: string) => {
    if (longPressFired.current) {
      longPressFired.current = false
      return
    }
    handleItemClick(action)
  }, [onMenuItemClick, onClose])

  return (
    <div
      className="h-full w-full bg-themewhite flex flex-col"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      {/* User profile card */}
      <button
        onClick={() => handleItemClick('settings-profile')}
        className="flex items-center gap-3 mx-3 mt-3 mb-2 px-4 py-3.5 rounded-xl hover:bg-themewhite2/60 active:scale-95 transform-gpu transition-colors text-left"
      >
        <div className="w-11 h-11 rounded-full overflow-hidden shrink-0">
          {isCustom && customImage ? (
            <img src={customImage} alt="Profile" className="w-full h-full object-cover rounded-full" />
          ) : isInitials ? (
            <div className="w-full h-full rounded-full bg-themeblue2/15 flex items-center justify-center">
              <span className="text-sm font-semibold text-themeblue2">
                {getInitials(profile.firstName, profile.lastName)}
              </span>
            </div>
          ) : (
            <div className="w-full h-full rounded-full overflow-hidden">
              {currentAvatar.svg}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-primary truncate">
            {profile.firstName || profile.lastName
              ? `${profile.rank ? profile.rank + ' ' : ''}${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim()
              : 'Guest'}
          </div>
          {profile.credential && (
            <div className="text-xs text-secondary truncate">{profile.credential}</div>
          )}
        </div>
      </button>

      <div className="mx-4 border-t border-tertiary/10" />

      {/* Menu items */}
      <div className="flex-1 overflow-y-auto px-3 pt-2">
        <div className="space-y-1">
          {visibleItems.map((item, i) => {
            const showGroupDivider = isDefaultOrder && i > 0 && visibleItems[i - 1].group !== item.group
            const isSettings = item.action === 'settings'

            return (
              <div key={item.action}>
                {showGroupDivider && (
                  <div className="mx-4 my-1.5 border-t border-tertiary/10" />
                )}
                <button
                  onClick={() => handleClick(item.action)}
                  onTouchStart={isSettings ? undefined : (e) => startLongPress(item.action, item.text, e)}
                  onTouchEnd={cancelLongPress}
                  onTouchMove={cancelLongPress}
                  onContextMenu={isSettings ? undefined : (e) => {
                    e.preventDefault()
                    setContextMenu({ action: item.action, label: item.text, position: { x: e.clientX, y: e.clientY } })
                  }}
                  className="w-full text-left flex items-center pl-7 pr-4 py-3.5 rounded-xl cursor-pointer hover:bg-themewhite2/60 bg-transparent active:scale-95 transform-gpu transition-colors"
                >
                  <div className="mr-4 relative">
                    {iconMap[item.action] || <HelpCircle size={20} className="text-primary/70" />}
                    {item.badge && totalUnread > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-themeredred text-white text-[10px] font-bold leading-none">
                        {totalUnread > 99 ? '99+' : totalUnread}
                      </span>
                    )}
                  </div>
                  <span className="tracking-wide text-[15px] text-primary/80 font-medium flex-1">
                    {item.text}
                    {BETA_ACTIONS.has(item.action) && (
                      <span className="ml-2 text-[11px] font-semibold text-themeyellow bg-themeyellow/15 px-2 py-0.5 rounded-full align-middle tracking-wide">
                        BETA
                      </span>
                    )}
                  </span>
                </button>
              </div>
            )
          })}
        </div>

        {hiddenCount > 0 && (
          <button
            onClick={() => {
              hidden.forEach(a => toggleHide(a))
            }}
            className="flex items-center justify-center gap-1.5 w-full py-2.5 mt-2 text-xs text-tertiary/50 hover:text-tertiary/70 active:scale-95 transform-gpu transition-colors"
          >
            <Eye size={12} />
            <span>{hiddenCount} hidden — tap to restore</span>
          </button>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-tertiary/10 px-4 py-4 text-center" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}>
        <p className="text-sm text-tertiary/60 font-medium">ADTMC MEDCOM PAM 40-7-21</p>
        <p className="text-xs text-tertiary/40 mt-1">Version {__APP_VERSION__}</p>
        <div className="flex items-center justify-center gap-1.5 mt-2">
          <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-themegreen' : 'bg-tertiary/40'}`} />
          <span className={`text-[11px] font-medium ${isConnected ? 'text-themegreen' : 'text-tertiary/60'}`}>
            {isConnected ? 'Connected' : 'Offline'}
          </span>
        </div>
      </div>

      {contextMenu && (
        <NavItemContextMenu
          action={contextMenu.action}
          label={contextMenu.label}
          isStarred={starred.includes(contextMenu.action)}
          isHidden={false}
          position={contextMenu.position}
          onStar={() => toggleStar(contextMenu.action)}
          onHide={() => toggleHide(contextMenu.action)}
          onMoveUp={() => moveItem(contextMenu.action, 'up', currentActionOrder)}
          onMoveDown={() => moveItem(contextMenu.action, 'down', currentActionOrder)}
          onClose={() => setContextMenu(null)}
          canMoveUp={currentActionOrder.indexOf(contextMenu.action) > 0}
          canMoveDown={(() => {
            const idx = currentActionOrder.indexOf(contextMenu.action)
            const settingsIdx = currentActionOrder.indexOf('settings')
            return idx < (settingsIdx !== -1 ? settingsIdx - 1 : currentActionOrder.length - 1)
          })()}
        />
      )}
    </div>
  )
}
