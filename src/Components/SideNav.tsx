import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type MouseEvent } from 'react'
import { Eye, Pin, ChevronUp, ChevronDown, EyeOff, FileText, MoreHorizontal, PanelLeftClose } from 'lucide-react'
import { NavIcon, DESKTOP_HIDDEN_ACTIONS, NAV_OPEN_STATE } from './navIcons'
import { useShallow } from 'zustand/react/shallow'
import { useNavigationStore } from '../stores/useNavigationStore'
import { useAuth } from '../Hooks/useAuth'
import { useAuthStore } from '../stores/useAuthStore'
import { useAvatar } from '../Utilities/AvatarContext'
import { useTotalUnread } from '../stores/useMessagingStore'
import { useFeatureVotesStore, selectHasUnvotedActiveCycle } from '../stores/useFeatureVotesStore'
import { getInitials } from '../Utilities/nameUtils'
import { useNavItems } from '../Hooks/useNavItems'
import { type ContextMenuItem } from '@/Components/primitives/ContextMenu'
import { AnchoredMenu, LiftedRowMenu, MenuListRow } from '@/Components/primitives/LiftedRowMenu'
import { liftPressHandlers, type LiftPressState, type LiftSnapshot } from './liftPress'
import { useSavedNotesStore } from '../stores/useSavedNotesStore'
import { useOpenSavedNote, useSavedNoteActions } from '../Hooks/useOpenSavedNote'
import { useSafeTriangle } from '../Hooks/useSafeTriangle'
import { hotkeyKeys } from '../Hooks/useDesktopHotkeys'
import { PaneCard } from './primitives/PaneCard'
import type { SavedNote } from '../lib/savedNotesDb'

const BETA_ACTIONS = new Set(['lora'])
/** Pinned to the foot of the desktop rail and exempt from reorder / hide. */
const SYSTEM_ACTIONS = new Set(['userGuide', 'settings'])

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
  /** Desktop md+: render as the NavRail, icon-only when collapsed and widening
   *  in place when expanded, instead of the off-canvas panel. */
  rail?: { collapsed: boolean; onExpand: () => void; onCollapse: () => void }
}

export function SideNav({ onClose, onMenuItemClick, rail }: SideNavProps) {
  const { currentAvatar, customImage, isCustom, isInitials } = useAvatar()
  const { profile, isAuthenticated } = useAuth()
  const totalUnread = useTotalUnread()
  const hasUnvotedCycle = useFeatureVotesStore(selectHasUnvotedActiveCycle)
  const isConnected = useSyncExternalStore(subscribeOnline, getOnline)


  const {
    visibleItems, hidden, hiddenCount, currentActionOrder, isDefaultOrder,
    starred, toggleStar, toggleHide, moveItem,
  } = useNavItems()

  // Collapsed-rail hover hint, a PaneCard pinned at a viewport point: the rail's scroller would clip an in-flow one.
  // A note's hint carries its actions, so the pointer can travel onto it (safe triangle).
  const [railTip, setRailTip] = useState<{ text: string; hotkey: string[] | null; detail?: string; note?: SavedNote; x: number; y: number } | null>(null)
  const railTipRef = useRef<HTMLDivElement>(null)
  const closeRailTip = useCallback(() => setRailTip(null), [])
  const tipAim = useSafeTriangle(railTipRef, closeRailTip)
  const cancelTipAim = tipAim.cancel
  useEffect(() => { if (!rail?.collapsed) { cancelTipAim(); setRailTip(null) } }, [rail?.collapsed, cancelTipAim])

  const [lifted, setLifted] = useState<({ action: string; label: string } & LiftSnapshot) | null>(null)
  const pressRef = useRef<LiftPressState | null>(null)

  // My Notes — device-local, scoped to the signed-in user (guest = null).
  const authUserId = useAuthStore(s => s.user?.id ?? null)
  const savedNotes = useSavedNotesStore(s => s.notes)
  const loadSavedNotes = useSavedNotesStore(s => s.load)
  const openSavedNote = useOpenSavedNote()
  const noteActions = useSavedNoteActions()
  const [liftedNote, setLiftedNote] = useState<({ note: SavedNote } & LiftSnapshot) | null>(null)
  const [noteMenu, setNoteMenu] = useState<{ note: SavedNote; rect: DOMRect } | null>(null)
  useEffect(() => { loadSavedNotes(authUserId) }, [authUserId, loadSavedNotes])

  const handleNoteClick = async (note: SavedNote) => {
    if (pressRef.current?.fired) return
    if (await openSavedNote(note)) onClose()
  }

  const handleItemClick = (action: string) => {
    onMenuItemClick(action)
    onClose()
  }

  const makeHandlers = useCallback((action: string, label: string) =>
    liftPressHandlers((snap) => setLifted({ action, label, ...snap }), pressRef), [])

  const handleClick = useCallback((action: string) => {
    if (pressRef.current?.fired) return
    handleItemClick(action)
  }, [onMenuItemClick, onClose])

  const handleProfileClick = () => {
    // Guests have no profile — this card is a logout affordance, matching the
    // settings drawer's guest profile card. Exit guest mode → LoginScreen.
    if (!isAuthenticated) {
      useAuthStore.setState({ isGuest: false })
      onClose()
      return
    }
    handleItemClick('settings-profile')
  }

  // Rail: drawer-backed actions light up while open; clicking the open one closes it.
  const openFlags = useNavigationStore(useShallow(st =>
    Object.fromEntries(Object.entries(NAV_OPEN_STATE).map(([a, [flag]]) => [a, !!st[flag]]))))

  const overlays = (
    <>
      {liftedNote && (
        <LiftedRowMenu
          isOpen
          anchorRect={liftedNote.rect}
          row={<div dangerouslySetInnerHTML={{ __html: liftedNote.html }} />}
          onClose={() => setLiftedNote(null)}
          layout="list"
          items={noteActions(liftedNote.note, onClose)}
        />
      )}

      <AnchoredMenu
        isOpen={!!noteMenu}
        anchorRect={noteMenu?.rect ?? null}
        onClose={() => setNoteMenu(null)}
        align="right"
        layout="list"
        items={noteMenu ? noteActions(noteMenu.note, onClose) : []}
      />

      {lifted && (() => {
        const canMoveUp = currentActionOrder.indexOf(lifted.action) > 0
        const canMoveDown = (() => {
          const idx = currentActionOrder.indexOf(lifted.action)
          const systemIdx = currentActionOrder.findIndex(a => SYSTEM_ACTIONS.has(a))
          return idx < (systemIdx !== -1 ? systemIdx - 1 : currentActionOrder.length - 1)
        })()
        const isStarred = starred.includes(lifted.action)
        const items: ContextMenuItem[] = [
          {
            key: 'pin',
            label: isStarred ? 'Unpin' : 'Pin',
            icon: Pin,
            onAction: () => toggleStar(lifted.action),
          },
          {
            key: 'up',
            label: 'Move Up',
            icon: ChevronUp,
            onAction: () => moveItem(lifted.action, 'up', currentActionOrder),
            disabled: !canMoveUp,
          },
          {
            key: 'down',
            label: 'Move Down',
            icon: ChevronDown,
            onAction: () => moveItem(lifted.action, 'down', currentActionOrder),
            disabled: !canMoveDown,
          },
          {
            key: 'hide',
            label: 'Hide',
            icon: EyeOff,
            onAction: () => toggleHide(lifted.action),
            destructive: true,
          },
        ]
        return (
          <LiftedRowMenu
            isOpen
            anchorRect={lifted.rect}
            row={<div dangerouslySetInnerHTML={{ __html: lifted.html }} />}
            onClose={() => setLifted(null)}
            layout="list"
            items={items}
          />
        )
      })()}
    </>
  )

  if (rail) {
    const { collapsed, onExpand, onCollapse } = rail
    const railItems = visibleItems.filter(i => !DESKTOP_HIDDEN_ACTIONS.has(i.action))
    const systemItems = railItems.filter(i => SYSTEM_ACTIONS.has(i.action))
    // Labels fade in after the width starts moving, out before it shrinks.
    const reveal = `transition-opacity duration-200 ${collapsed ? 'opacity-0 pointer-events-none' : 'opacity-100 delay-100'}`

    const handleRailClick = (action: string) => {
      if (pressRef.current?.fired) return
      if (openFlags[action]) {
        NAV_OPEN_STATE[action][1](useNavigationStore.getState())
        onClose()
      } else {
        handleItemClick(action)
      }
    }

    const railDivider = (key: string) => (
      <div key={key} className={`mx-3 my-1.5 border-t border-tertiary/10 transition-[width] duration-300 ${collapsed ? 'w-8' : 'w-[calc(100%-1.5rem)]'}`} />
    )

    const showTip = (e: MouseEvent<HTMLElement>, text: string, hotkey: string[] | null, detail?: string, note?: SavedNote) => {
      // Mid-aim at an open note card: crossing a neighbour row mustn't steal it.
      if (tipAim.active() && tipAim.holds({ x: e.clientX, y: e.clientY })) return
      tipAim.cancel()
      const r = (e.currentTarget.closest('nav') ?? e.currentTarget).getBoundingClientRect()
      const row = e.currentTarget.getBoundingClientRect()
      setRailTip({ text, hotkey, detail, note, x: r.right + 8, y: row.top + row.height / 2 })
    }

    const railRow = (item: (typeof railItems)[number]) => {
      const active = !!openFlags[item.action]
      const isPinned = SYSTEM_ACTIONS.has(item.action) || item.group === 'utility'
      return (
        <button
          key={item.action}
          onClick={() => handleRailClick(item.action)}
          {...(collapsed || isPinned ? {} : makeHandlers(item.action, item.text))}
          aria-label={item.text}
          aria-pressed={active}
          onMouseEnter={collapsed ? (e) => showTip(e, item.text, hotkeyKeys(item.action)) : undefined}
          onMouseLeave={() => { if (!tipAim.active()) setRailTip(null) }}
          className={`relative flex items-center mx-2 w-[calc(100%-1rem)] h-10 px-1 shrink-0 rounded-full text-left hover:bg-secondary/5 active:scale-95 transition-all`}
        >
          <span className="relative w-8 h-8 shrink-0 rounded-full flex items-center justify-center bg-themewhite2">
            <NavIcon action={item.action} size={16} className={active ? 'stroke-themeblue3 fill-themeblue3/25' : 'stroke-themeblue1'} />
            {item.badge && totalUnread > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-themeredred text-white text-[9pt] font-bold leading-none">
                {totalUnread > 99 ? '99+' : totalUnread}
              </span>
            )}
            {item.action === 'settings' && hasUnvotedCycle && (
              <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-themeredred" aria-label="Unvoted feature cycle" />
            )}
          </span>
          <span className={`ml-3 text-[10pt] font-medium text-primary whitespace-nowrap ${reveal}`}>
            {item.text}
          </span>
        </button>
      )
    }

    return (
      <div className="h-full w-full flex flex-col">
        {/* Same height as the NavTop row so the avatar lines up with the header. */}
        <div className="flex items-center h-13.75 shrink-0">
        <button
          onClick={collapsed ? onExpand : handleProfileClick}
          aria-label={collapsed ? 'Open menu' : 'Profile'}
          className="flex items-center flex-1 min-w-0 h-full px-3 text-left active:scale-95 transition-all"
        >
          <span className="w-8 h-8 rounded-full overflow-hidden shrink-0">
            {isCustom && customImage ? (
              <img src={customImage} alt="Profile" className="w-full h-full object-cover rounded-full" />
            ) : isInitials ? (
              <div className="w-full h-full rounded-full bg-themeblue2/15 flex items-center justify-center">
                <span className="text-[10pt] font-semibold text-themeblue2">
                  {getInitials(profile.firstName, profile.lastName)}
                </span>
              </div>
            ) : (
              <div className="w-full h-full rounded-full overflow-hidden">
                {currentAvatar.svg}
              </div>
            )}
          </span>
          <div className={`ml-3 min-w-0 ${reveal}`}>
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
        <button
          onClick={onCollapse}
          aria-label="Collapse menu"
          className={`w-8 h-8 mr-3 shrink-0 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 ${reveal}`}
        >
          <PanelLeftClose size={16} />
        </button>
        </div>

        <div className={`mx-3 border-t border-tertiary/10 transition-[width] duration-300 ${collapsed ? 'w-8' : 'w-[calc(100%-1.5rem)]'}`} />

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden py-2 space-y-1">
          {/* Roles split from the tool modules; starred items can sit out of group order, so the split follows adjacency. */}
          {railItems.filter(i => !SYSTEM_ACTIONS.has(i.action)).flatMap((item, i, arr) =>
            i > 0 && (arr[i - 1].group === 'roles') !== (item.group === 'roles')
              ? [railDivider(`div-${item.action}`), railRow(item)]
              : [railRow(item)])}

          {!collapsed && hiddenCount > 0 && (
            <button
              onClick={() => hidden.forEach(a => toggleHide(a))}
              className="flex items-center justify-center gap-1.5 w-full py-2.5 mt-2 text-[10pt] text-tertiary hover:text-primary whitespace-nowrap active:scale-95 transition-all"
            >
              <Eye size={12} />
              <span>{hiddenCount} hidden — tap to restore</span>
            </button>
          )}

          {savedNotes.length > 0 && (
            <>
              {railDivider('div-notes')}
              {!collapsed && (
                <p className="pl-4 pt-1 pb-1 text-[9pt] font-semibold text-tertiary uppercase tracking-wider whitespace-nowrap">My Notes</p>
              )}
              {savedNotes.map(note => {
                const label = note.symptomText
                const meta = [note.kind === 'provider' ? 'Provider' : note.dispositionType, new Date(note.savedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })].filter(Boolean).join(' · ')
                return (
                  <div
                    key={note.id}
                    className={`flex items-center mx-2 w-[calc(100%-1rem)] h-10 shrink-0 rounded-full hover:bg-secondary/5 transition-colors`}
                  >
                    <button
                      onClick={() => handleNoteClick(note)}
                      {...(collapsed ? {} : liftPressHandlers((snap) => setLiftedNote({ note, ...snap }), pressRef))}
                      aria-label={label}
                      onMouseEnter={collapsed ? (e) => showTip(e, label, null, meta, note) : undefined}
                      onMouseLeave={collapsed ? (e) => tipAim.track(e) : undefined}
                      className="relative flex items-center flex-1 min-w-0 h-10 px-1 rounded-full text-left active:scale-95 transition-all"
                    >
                      <span className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center bg-themeblue2/10">
                        {note.symptomIcon
                          ? <span className="text-[11pt] leading-none">{note.symptomIcon}</span>
                          : <FileText size={15} className="text-themeblue2" />}
                      </span>
                      <div className={`ml-3 min-w-0 flex-1 ${reveal}`}>
                        <div className="text-[10pt] text-primary font-medium truncate">{label}</div>
                        <div className="text-[9pt] text-tertiary truncate leading-tight">{meta}</div>
                      </div>
                    </button>
                    {!collapsed && (
                      <button
                        onClick={(e) => setNoteMenu({ note, rect: e.currentTarget.getBoundingClientRect() })}
                        aria-label="Note actions"
                        className={`w-7 h-7 mr-1.5 shrink-0 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 ${reveal}`}
                      >
                        <MoreHorizontal size={15} />
                      </button>
                    )}
                  </div>
                )
              })}
            </>
          )}
        </div>

        <div className="pb-2 shrink-0 space-y-1">
          {railDivider('div-system')}
          {systemItems.map(railRow)}
          {!collapsed && (
            <div className="flex items-center gap-1.5 px-4 pt-2 whitespace-nowrap">
              <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-themegreen' : 'bg-tertiary/40'}`} />
              <span className={`text-[9pt] font-medium ${isConnected ? 'text-themegreen' : 'text-tertiary'}`}>
                {isConnected ? 'Connected' : 'Offline'}
              </span>
              <span className="text-[9pt] text-tertiary ml-auto">v{__APP_VERSION__}</span>
            </div>
          )}
        </div>

        <PaneCard
          isOpen={!!railTip}
          onClose={() => setRailTip(null)}
          title={railTip?.text ?? ''}
          anchor={railTip ? { x: railTip.x, y: railTip.y } : undefined}
          interactive={!!railTip?.note}
          anchorRef={railTipRef}
        >
          {railTip?.detail && (
            <p className="px-3 py-2 text-[9pt] text-tertiary whitespace-nowrap">{railTip.detail}</p>
          )}
          {railTip?.note && (
            <div className="w-[216px] border-t border-tertiary/10 divide-y divide-black/[0.06]">
              {noteActions(railTip.note, onClose).map(item => (
                <MenuListRow
                  key={item.key}
                  item={item}
                  onSelect={(it) => { tipAim.cancel(); setRailTip(null); it.onAction?.() }}
                />
              ))}
            </div>
          )}
          {railTip?.hotkey && (
            <div className="flex gap-1 px-3 py-2">
              {railTip.hotkey.map(k => (
                <kbd key={k} className="min-w-6 h-6 px-1.5 inline-flex items-center justify-center rounded-md bg-themewhite border border-tertiary/20 border-b-2 font-[inherit] text-[10pt] font-semibold text-tertiary">
                  {k}
                </kbd>
              ))}
            </div>
          )}
        </PaneCard>
        {overlays}
      </div>
    )
  }

  return (
    <div
      className="h-full w-full bg-themewhite2 flex flex-col"
      style={{ paddingTop: 'var(--sat)' }}
    >
      {/* User profile card */}
      <button
        onClick={handleProfileClick}
        className={`flex items-center gap-3 mx-3 mt-3 mb-2 px-4 py-3.5 rounded-xl hover:bg-secondary/5 active:scale-95 transition-all text-left`}
      >
        <div className={`w-11 h-11 rounded-full overflow-hidden shrink-0`}>
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
          {visibleItems.map((item, i, filtered) => {
            const showGroupDivider = i > 0 && filtered[i - 1].group !== item.group
            const isPinned = SYSTEM_ACTIONS.has(item.action) || item.group === 'utility'

            return (
              <div key={item.action}>
                {showGroupDivider && (
                  <div className="mx-4 my-1.5 border-t border-tertiary/10" />
                )}
                <button
                  onClick={() => handleClick(item.action)}
                  {...(isPinned ? {} : makeHandlers(item.action, item.text))}
                  className={`w-full text-left flex items-center pl-7 pr-4 py-3.5 rounded-xl cursor-pointer hover:bg-secondary/5 active:scale-95 transition-all`}
                >
                  <div className="mr-4 relative">
                    <NavIcon action={item.action} size={20} />
                    {item.badge && totalUnread > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-themeredred text-white text-[9pt] font-bold leading-none">
                        {totalUnread > 99 ? '99+' : totalUnread}
                      </span>
                    )}
                    {item.action === 'settings' && hasUnvotedCycle && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-themeredred" aria-label="Unvoted feature cycle" />
                    )}
                  </div>
                  <span className={`tracking-wide text-[11pt] text-primary font-medium flex-1`}>
                    {item.text}
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
            className="flex items-center justify-center gap-1.5 w-full py-2.5 mt-2 text-[10pt] text-tertiary hover:text-primary active:scale-95 transition-all"
          >
            <Eye size={12} />
            <span>{hiddenCount} hidden — tap to restore</span>
          </button>
        )}

        {savedNotes.length > 0 && (
          <div className="mt-2 mb-2">
            <div className="mx-4 mb-1.5 border-t border-tertiary/10" />
            <p className={`pl-7 pt-1 pb-1 text-[9pt] font-semibold text-tertiary uppercase tracking-wider`}>My Notes</p>
            <div className="space-y-1">
              {savedNotes.map(note => (
                <div key={note.id} className="flex items-center rounded-xl hover:bg-secondary/5 transition-colors">
                <button
                  onClick={() => handleNoteClick(note)}
                  {...liftPressHandlers((snap) => setLiftedNote({ note, ...snap }), pressRef)}
                  className={`flex-1 min-w-0 text-left flex items-center pl-7 pr-2 py-3 rounded-xl cursor-pointer active:scale-95 transition-all`}
                >
                  <div className="min-w-0 flex-1">
                    <div className={`text-[11pt] text-primary font-medium truncate`}>
                      {note.symptomIcon ? `${note.symptomIcon} ` : ''}{note.symptomText}
                    </div>
                    <div className="text-[9pt] text-tertiary truncate">
                      {[note.kind === 'provider' ? 'Provider' : note.dispositionType, new Date(note.savedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                </button>
                <button
                  onClick={(e) => setNoteMenu({ note, rect: e.currentTarget.getBoundingClientRect() })}
                  aria-label="Note actions"
                  className="w-9 h-9 mr-2 shrink-0 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all"
                >
                  <MoreHorizontal size={18} />
                </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-tertiary/10" style={{ paddingBottom: 'calc(var(--sab, 0px) + 0.5rem)' }}>
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

      {overlays}
    </div>
  )
}
