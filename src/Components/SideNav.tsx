import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { Upload, BookOpen, Mail, Package, ClipboardCheck, Settings, HelpCircle, X, UserCog } from 'lucide-react'
import { menuData as allMenuData } from '../Data/CatData'
import { useAuth } from '../Hooks/useAuth'
import { useAvatar } from '../Utilities/AvatarContext'
import { useMessagesContext } from '../Hooks/MessagesContext'
import { getInitials } from '../Utilities/nameUtils'
import { PROPERTY_MANAGEMENT_ENABLED } from '../lib/featureFlags'
import { HeaderPill, PillButton } from './HeaderPill'

const iconMap: Record<string, React.ReactNode> = {
  'import': <Upload size={20} className="text-primary/70" />,
  'knowledgebase': <BookOpen size={20} className="text-primary/70" />,
  'messages': <Mail size={20} className="text-primary/70" />,
  'property': <Package size={20} className="text-primary/70" />,
  'supervisor': <ClipboardCheck size={20} className="text-primary/70" />,
  'settings': <Settings size={20} className="text-primary/70" />,
  'admin': <UserCog size={20} className="text-primary/70" />,
}

// navigator.onLine subscription for useSyncExternalStore
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
  isOpen: boolean
  onClose: () => void
  onMenuItemClick: (action: string) => void
}

export function SideNav({ isOpen, onClose, onMenuItemClick }: SideNavProps) {
  const { currentAvatar, customImage, isCustom, isInitials } = useAvatar()
  const { profile, isAuthenticated, isSupervisorRole, isDevRole } = useAuth()
  const messagesCtx = useMessagesContext()
  const isConnected = useSyncExternalStore(subscribeOnline, getOnline)

  const totalUnread = useMemo(() => {
    if (!messagesCtx) return 0
    return Object.values(messagesCtx.unreadCounts).reduce((sum, n) => sum + n, 0)
  }, [messagesCtx?.unreadCounts])

  const menuData = useMemo(() => allMenuData.filter(item => {
    if (!item.gateKey) return true
    if (item.gateKey === 'authenticated') return isAuthenticated
    if (item.gateKey === 'property') return isAuthenticated && PROPERTY_MANAGEMENT_ENABLED
    if (item.gateKey === 'supervisor') return isSupervisorRole
    if (item.gateKey === 'admin') return isDevRole
    return true
  }), [isAuthenticated, isSupervisorRole, isDevRole])

  // Body scroll lock
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  const handleItemClick = (action: string) => {
    onMenuItemClick(action)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50"
      style={{ pointerEvents: isOpen ? 'auto' : 'none' }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        style={{
          opacity: isOpen ? 1 : 0,
          transition: 'opacity 300ms ease-out',
        }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed top-0 left-0 bottom-0 w-[80%] max-w-[320px] bg-themewhite shadow-xl flex flex-col"
        style={{
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 300ms cubic-bezier(0.32, 0.72, 0, 1)',
          paddingTop: 'env(safe-area-inset-top)',
        }}
      >
        {/* Header: close button */}
        <div className="flex justify-end px-2 pt-2 pb-1">
          <HeaderPill>
            <PillButton icon={X} onClick={onClose} label="Close" />
          </HeaderPill>
        </div>

        {/* User profile card — taps to settings */}
        <button
          onClick={() => handleItemClick('settings-profile')}
          className="flex items-center gap-3 mx-3 mb-2 px-4 py-3.5 rounded-xl hover:bg-themewhite2/60 active:scale-[0.97] transform-gpu transition-colors text-left"
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

        {/* Divider */}
        <div className="mx-4 border-t border-tertiary/10" />

        {/* Menu items — scrollable */}
        <div className="flex-1 overflow-y-auto px-3 pt-2">
          <div className="space-y-1">
            {menuData.map((item) => (
              <button
                key={item.action}
                onClick={() => handleItemClick(item.action)}
                className="w-full text-left flex items-center pl-7 pr-4 py-3.5 rounded-xl cursor-pointer hover:bg-themewhite2/60 bg-transparent active:scale-[0.97] transform-gpu transition-colors"
              >
                <div className="mr-4 relative">
                  {iconMap[item.action] || <HelpCircle size={20} className="text-primary/70" />}
                  {item.badge && totalUnread > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                      {totalUnread > 99 ? '99+' : totalUnread}
                    </span>
                  )}
                </div>
                <span className="tracking-wide text-[15px] text-primary/80 font-medium">
                  {item.text}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Footer: title, version, connectivity */}
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
      </div>
    </div>
  )
}
