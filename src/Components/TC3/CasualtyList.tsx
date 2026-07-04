import { memo, useMemo, useState } from 'react'
import { MoreHorizontal, FileText, RotateCcw, Trash2, Crosshair } from 'lucide-react'
import { useTC3Store } from '../../stores/useTC3Store'
import { SearchInput } from '../SearchInput'
import { LiftedRowMenu } from '../LiftedRowMenu'
import { type ContextMenuItem } from '../ContextMenu'
import type { TC3Card } from '../../Types/TC3Types'

const PRIORITY_COLOR: Record<string, string> = {
  Urgent: 'bg-themeredred',
  Priority: 'bg-amber-500',
  Routine: 'bg-themegreen',
}

function casualtyName(card: TC3Card): string {
  return [card.casualty.lastName, card.casualty.firstName].filter(Boolean).join(', ')
}

interface CasualtyListProps {
  /** Fired after a card is made active (mobile closes the sheet; desktop no-op). */
  onAfterSelect?: () => void
  /** 'pane' = desktop rail (hover-revealed ellipsis, fills height); 'sheet' =
   *  mobile bottom sheet (ellipsis always shown, capped scroll). Default 'pane'. */
  variant?: 'pane' | 'sheet'
}

/**
 * Casualty roster — the desktop LEFT rail, styled after the property location
 * tree view: compact `border-l-2` rows with a leading priority dot, and a
 * hover-revealed ellipsis that opens a LiftedRowMenu (View note / Reset /
 * Discard). Right-click opens the same menu. Selecting a row makes that casualty
 * active (the main pane / wizard follows). Also hosted in the mobile roster Sheet.
 */
export const CasualtyList = memo(function CasualtyList({ onAfterSelect, variant = 'pane' }: CasualtyListProps) {
  const card = useTC3Store((s) => s.card)
  const casualtyQueue = useTC3Store((s) => s.casualtyQueue)
  const restoreFromQueue = useTC3Store((s) => s.restoreFromQueue)
  const discardFromQueue = useTC3Store((s) => s.discardFromQueue)
  const discardActive = useTC3Store((s) => s.discardActive)
  const resetCard = useTC3Store((s) => s.resetCard)
  const openExportForCard = useTC3Store((s) => s.openExportForCard)

  const [query, setQuery] = useState('')
  const [menu, setMenu] = useState<{ cardId: string; rect: DOMRect } | null>(null)

  const hoverActions = variant === 'pane'

  // Stable order: sort all casualties by creation time
  const all = useMemo(
    () =>
      [
        { card, isActive: true },
        ...casualtyQueue.map((e) => ({ card: e.card, isActive: false })),
      ].sort((a, b) => a.card.createdAt.localeCompare(b.card.createdAt)),
    [card, casualtyQueue],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return all
    return all.filter(({ card: c }) => (casualtyName(c) || 'unknown').toLowerCase().includes(q))
  }, [all, query])

  // Number is the position in the full roster, not the filtered view.
  const numberOf = (id: string) => all.findIndex(({ card: c }) => c.id === id) + 1

  const handleSelect = (cardId: string, isActive: boolean) => {
    if (!isActive) restoreFromQueue(cardId)
    onAfterSelect?.()
  }

  const openMenu = (cardId: string, anchor: HTMLElement | null) => {
    if (anchor) setMenu({ cardId, rect: anchor.getBoundingClientRect() })
  }

  const menuCard = menu ? all.find((a) => a.card.id === menu.cardId) : null
  const menuItems: ContextMenuItem[] = menuCard
    ? [
        { key: 'view', label: 'View note', icon: FileText, onAction: () => openExportForCard(menuCard.card) },
        {
          key: 'reset',
          label: 'Reset card',
          icon: RotateCcw,
          onAction: () => {
            if (!menuCard.isActive) restoreFromQueue(menuCard.card.id)
            resetCard()
          },
        },
        {
          key: 'discard',
          label: 'Discard',
          icon: Trash2,
          destructive: true,
          onAction: () => {
            if (menuCard.isActive) {
              discardActive()
              onAfterSelect?.()
            } else {
              discardFromQueue(menuCard.card.id)
            }
          },
        },
      ]
    : []

  const actionBtnCls = `w-7 h-7 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all shrink-0 ${
    hoverActions ? 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100' : ''
  }`

  const bodyClass =
    variant === 'sheet'
      ? 'max-h-[52dvh] overflow-y-auto overscroll-y-contain'
      : 'flex-1 min-h-0 overflow-y-auto'

  return (
    <div className={`flex flex-col min-h-0${variant === 'pane' ? ' h-full' : ''}`}>
      <div className="shrink-0 px-3 pt-3 pb-2">
        <SearchInput value={query} onChange={setQuery} placeholder="Search casualties…" />
      </div>

      <div className={bodyClass}>
        <div className="flex flex-col py-1">
          {filtered.map(({ card: c, isActive }) => {
            const number = numberOf(c.id)
            const name = casualtyName(c)
            const dotColor = c.evacuation.priority
              ? PRIORITY_COLOR[c.evacuation.priority]
              : isActive ? 'bg-themeblue2' : 'bg-tertiary/40'
            return (
              <div
                key={c.id}
                role="button"
                tabIndex={0}
                data-tc3-row
                className={`group flex items-center gap-2 py-2 pr-2 border-l-2 transition-colors cursor-pointer ${
                  isActive ? 'bg-themeblue3/8 border-l-themeblue3' : 'hover:bg-secondary/5 border-l-transparent'
                }`}
                style={{ paddingLeft: '16px' }}
                onClick={() => handleSelect(c.id, isActive)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSelect(c.id, isActive) }}
                onContextMenu={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  openMenu(c.id, e.currentTarget as HTMLElement)
                }}
              >
                <span className="w-[18px] shrink-0 flex items-center justify-center">
                  <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                </span>
                <span className="text-[10pt] font-medium text-primary truncate flex-1">
                  Casualty {number}
                  {name && <span className="text-tertiary font-normal"> · {name}</span>}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    const row = (e.currentTarget as HTMLElement).closest('[data-tc3-row]') as HTMLElement | null
                    openMenu(c.id, row)
                  }}
                  aria-label="More actions"
                  className={actionBtnCls}
                >
                  <MoreHorizontal size={15} />
                </button>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <p className="px-4 py-6 text-center text-[10pt] text-tertiary">No casualties match.</p>
          )}
        </div>
      </div>

      {menu && menuCard && (
        <LiftedRowMenu
          isOpen
          layout="list"
          anchorRect={menu.rect}
          onClose={() => setMenu(null)}
          items={menuItems}
          row={
            <div className="flex items-center gap-2 px-3 py-2 bg-themewhite">
              <Crosshair size={16} className="text-tertiary shrink-0" />
              <span className="flex-1 min-w-0 text-[10pt] font-medium text-primary truncate">
                Casualty {numberOf(menuCard.card.id)}
                {casualtyName(menuCard.card) ? ` · ${casualtyName(menuCard.card)}` : ''}
              </span>
            </div>
          }
        />
      )}
    </div>
  )
})
