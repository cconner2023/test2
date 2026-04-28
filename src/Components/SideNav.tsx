import { useCallback, useRef, useState, useSyncExternalStore } from 'react'
import { Upload, BookOpen, Package, ClipboardCheck, Settings, HelpCircle, UserCog, Radio, Map as MapIcon, Eye, CalendarDays, Stethoscope, MessageSquare, X, Pin, ChevronUp, ChevronDown, EyeOff, Crosshair } from 'lucide-react'
import { useAuth } from '../Hooks/useAuth'
import { useAuthStore } from '../stores/useAuthStore'
import { useAvatar } from '../Utilities/AvatarContext'
import { useTotalUnread } from '../stores/useMessagingStore'
import { useFeatureVotesStore, selectHasUnvotedActiveCycle } from '../stores/useFeatureVotesStore'
import { getInitials } from '../Utilities/nameUtils'
import { useNavItems } from '../Hooks/useNavItems'
import { ContextMenu, type ContextMenuItem } from './ContextMenu'

const iconMapMobile: Record<string, React.ReactNode> = {
  'import': <Upload size={20} className="text-primary" />,
  'knowledgebase': <BookOpen size={20} className="text-primary" />,
  'messages': <MessageSquare size={20} className="text-primary" />,
  'property': <Package size={20} className="text-primary" />,
  'provider': <Stethoscope size={20} className="text-primary" />,
  'supervisor': <ClipboardCheck size={20} className="text-primary" />,
  'settings': <Settings size={20} className="text-primary" />,
  'admin': <UserCog size={20} className="text-primary" />,
  'lora': <Radio size={20} className="text-primary" />,
  'mapOverlay': <MapIcon size={20} className="text-primary" />,
  'calendar': <CalendarDays size={20} className="text-primary" />,
  'tc3': <Crosshair size={20} className="text-primary" />,
}

const iconMapDesktop: Record<string, React.ReactNode> = {
  'import': <Upload size={16} className="text-primary" />,
  'knowledgebase': <BookOpen size={16} className="text-primary" />,
  'messages': <MessageSquare size={16} className="text-primary" />,
  'property': <Package size={16} className="text-primary" />,
  'provider': <Stethoscope size={16} className="text-primary" />,
  'supervisor': <ClipboardCheck size={16} className="text-primary" />,
  'settings': <Settings size={16} className="text-primary" />,
  'admin': <UserCog size={16} className="text-primary" />,
  'lora': <Radio size={16} className="text-primary" />,
  'mapOverlay': <MapIcon size={16} className="text-primary" />,
  'calendar': <CalendarDays size={16} className="text-primary" />,
  'tc3': <Crosshair size={16} className="text-primary" />,
}

const BETA_ACTIONS = new Set(['lora', 'mapOverlay', 'property', 'tc3'])
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
  isMobile?: boolean
}

export function SideNav({ onClose, onMenuItemClick, isMobile = true }: SideNavProps) {
  const { currentAvatar, customImage, isCustom, isInitials } = useAvatar()
  const { profile } = useAuth()
  const tc3Mode = useAuthStore((s) => s.profile.tc3Mode) ?? false
  const totalUnread = useTotalUnread()
  const hasUnvotedCycle = useFeatureVotesStore(selectHasUnvotedActiveCycle)
  const isConnected = useSyncExternalStore(subscribeOnline, getOnline)

  const iconMap = isMobile ? iconMapMobile : iconMapDesktop
  const DESKTOP_HIDDEN_ACTIONS = new Set(['knowledgebase', 'import'])

  const [feedbackDismissed, setFeedbackDismissed] = useState(() => {
    try { return localStorage.getItem('feedback-banner-dismissed') === '1' } catch { return false }
  })
  const dismissFeedback = useCallback(() => {
    setFeedbackDismissed(true)
    try { localStorage.setItem('feedback-banner-dismissed', '1') } catch { }
  }, [])

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
      style={isMobile ? { paddingTop: 'var(--sat)' } : undefined}
    >
      {/* User profile card */}
      <button
        data-tour="sidenav-profile"
        onClick={() => handleItemClick('settings-profile')}
        className={`flex items-center gap-3 mx-3 mt-3 mb-2 px-4 ${isMobile ? 'py-3.5' : 'py-2.5'} rounded-xl hover:bg-themewhite2/60 active:scale-95 transform-gpu transition-colors text-left`}
      >
        <div className={`${isMobile ? 'w-11 h-11' : 'w-9 h-9'} rounded-full overflow-hidden shrink-0`}>
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
            <div className="text-[10pt] text-secondary truncate">{profile.credential}</div>
          )}
        </div>
      </button>

      <div className="mx-4 border-t border-tertiary/10" />

      {/* Menu items */}
      <div className="flex-1 overflow-y-auto px-3 pt-2">
        <div className="space-y-1">
          {visibleItems.filter(item => isMobile || !DESKTOP_HIDDEN_ACTIONS.has(item.action)).map((item, i, filtered) => {
            const showGroupDivider = i > 0 && filtered[i - 1].group !== item.group
            const isPinned = item.action === 'settings' || item.group === 'utility'

            return (
              <div key={item.action}>
                {showGroupDivider && (
                  <div className="mx-4 my-1.5 border-t border-tertiary/10" />
                )}
                <button
                  data-tour={`sidenav-${item.action}`}
                  onClick={() => handleClick(item.action)}
                  onTouchStart={isPinned ? undefined : (e) => startLongPress(item.action, item.text, e)}
                  onTouchEnd={cancelLongPress}
                  onTouchMove={cancelLongPress}
                  onContextMenu={isPinned ? undefined : (e) => {
                    e.preventDefault()
                    setContextMenu({ action: item.action, label: item.text, position: { x: e.clientX, y: e.clientY } })
                  }}
                  className={`w-full text-left flex items-center ${isMobile ? 'pl-7 pr-4 py-3.5' : 'pl-5 pr-3 py-2.5'} rounded-xl cursor-pointer hover:bg-themewhite2/60 bg-transparent active:scale-95 transform-gpu transition-colors`}
                >
                  <div className="mr-4 relative">
                    {iconMap[item.action] || <HelpCircle size={20} className="text-primary" />}
                    {item.badge && totalUnread > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-themeredred text-white text-[9pt] font-bold leading-none">
                        {totalUnread > 99 ? '99+' : totalUnread}
                      </span>
                    )}
                    {item.action === 'settings' && hasUnvotedCycle && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-themeredred" aria-label="Unvoted feature cycle" />
                    )}
                  </div>
                  <span className={`tracking-wide ${isMobile ? 'text-[11pt]' : 'text-[10pt]'} text-primary font-medium flex-1`}>
                    {item.action === 'tc3' ? (tc3Mode ? 'ADTMC' : 'TC3') : item.text}
                    {BETA_ACTIONS.has(item.action) && (
                      <span className="ml-2 text-[9pt] font-semibold text-themeyellow bg-themeyellow/15 px-2 py-0.5 rounded-full align-middle tracking-wide">
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
            className="flex items-center justify-center gap-1.5 w-full py-2.5 mt-2 text-[10pt] text-tertiary hover:text-tertiary active:scale-95 transform-gpu transition-colors"
          >
            <Eye size={12} />
            <span>{hiddenCount} hidden — tap to restore</span>
          </button>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-tertiary/10" style={{ paddingBottom: 'calc(var(--sab, 0px) + 0.5rem)' }}>
        {!feedbackDismissed && (
          <div className="px-3 pt-2">
            <button
              onClick={() => { onMenuItemClick('settings-feedback'); onClose() }}
              className={`w-full text-left flex items-center ${isMobile ? 'pl-7 pr-3 py-3.5' : 'pl-5 pr-2 py-2.5'} rounded-xl hover:bg-themewhite2/60 bg-transparent active:scale-95 transform-gpu transition-colors`}
            >
              <div className="mr-4">
                <MessageSquare size={isMobile ? 20 : 16} className="text-primary" />
              </div>
              <span className={`tracking-wide ${isMobile ? 'text-[11pt]' : 'text-[10pt]'} text-primary font-medium flex-1`}>
                Share Feedback
              </span>
              <div
                role="button"
                onClick={(e) => { e.stopPropagation(); dismissFeedback() }}
                className="p-1.5 rounded-full hover:bg-tertiary/10 text-tertiary hover:text-tertiary transition-colors"
              >
                <X size={14} />
              </div>
            </button>
          </div>
        )}
        <div className="px-4 py-3 text-center">
          <p className="text-[10pt] text-tertiary">Version {__APP_VERSION__}</p>
          <div className="flex items-center justify-center gap-1.5 mt-2">
            <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-themegreen' : 'bg-tertiary/40'}`} />
            <span className={`text-[9pt] font-medium ${isConnected ? 'text-themegreen' : 'text-tertiary'}`}>
              {isConnected ? 'Connected' : 'Offline'}
            </span>
          </div>
        </div>
      </div>

      {contextMenu && (() => {
        const canMoveUp = currentActionOrder.indexOf(contextMenu.action) > 0
        const canMoveDown = (() => {
          const idx = currentActionOrder.indexOf(contextMenu.action)
          const settingsIdx = currentActionOrder.indexOf('settings')
          return idx < (settingsIdx !== -1 ? settingsIdx - 1 : currentActionOrder.length - 1)
        })()
        const isStarred = starred.includes(contextMenu.action)
        const items: ContextMenuItem[] = [
          {
            key: 'pin',
            label: isStarred ? 'Unpin' : 'Pin',
            icon: Pin,
            onAction: () => toggleStar(contextMenu.action),
          },
          {
            key: 'up',
            label: 'Move Up',
            icon: ChevronUp,
            onAction: () => moveItem(contextMenu.action, 'up', currentActionOrder),
            disabled: !canMoveUp,
          },
          {
            key: 'down',
            label: 'Move Down',
            icon: ChevronDown,
            onAction: () => moveItem(contextMenu.action, 'down', currentActionOrder),
            disabled: !canMoveDown,
          },
          {
            key: 'hide',
            label: 'Hide',
            icon: EyeOff,
            onAction: () => toggleHide(contextMenu.action),
            destructive: true,
          },
        ]
        return (
          <ContextMenu
            x={contextMenu.position.x}
            y={contextMenu.position.y}
            onClose={() => setContextMenu(null)}
            items={items}
          />
        )
      })()}
    </div>
  )
}
