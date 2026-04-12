import { useEffect, useState, useCallback, useRef } from 'react'
import { Plus, Check, X } from 'lucide-react'
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { SearchInput } from './SearchInput'
import { BaseOverlay } from './BaseOverlay'
import { PopoverHeader } from './Popover'

export interface ContextMenuAction {
  key: string
  label: string
  icon?: LucideIcon
  onAction: () => void
  variant?: 'default' | 'danger' | 'disabled'
  /** When false the popover stays open after firing onAction (default true) */
  closesOnAction?: boolean
}

interface ContextMenuPreviewProps {
  isVisible: boolean
  onClose: () => void
  /** Bounding rect of the long-pressed element — used for transform origin */
  anchorRect: DOMRect | null
  /** Scrollable preview content — receives search filter + clearFilter when searchable */
  preview: ReactNode | ((filter: string, clearFilter: () => void) => ReactNode)
  /** Action buttons rendered in the left-side pill in the footer */
  actions: ContextMenuAction[]
  /** Title shown in the outer shell header alongside the X close button */
  title?: string
  /** Override the default max-width (340px) of the card */
  maxWidth?: string
  /** Override the default max-height of the scrollable preview card (default: 40dvh) */
  previewMaxHeight?: string
  /** Adds a search input pinned to the top of the inner card */
  searchPlaceholder?: string
  /** Optional content rendered between the shell header and the inner card */
  headerCard?: ReactNode
  /** Optional content rendered between the inner card and the footer */
  supplemental?: ReactNode
  /** When provided, shows an "Add" button in the action pill that reveals an inline input */
  onAdd?: (value: string) => void
  /** Placeholder for the add input */
  addPlaceholder?: string
  /** Optional element rendered before the add input (e.g. category selector) */
  addPrefix?: ReactNode
  /** When provided, scopes the popover to this container (absolute instead of fixed).
   *  The container element must have `position: relative` and a defined height. */
  containerRef?: React.RefObject<HTMLElement | null>
}

const ACTION_STYLES = {
  default: {
    bg: 'bg-themeblue2/8',
    iconColor: 'text-themeblue2',
    labelColor: 'text-themeblue2',
  },
  danger: {
    bg: 'bg-themeredred/8',
    iconColor: 'text-themeredred',
    labelColor: 'text-themeredred',
  },
  disabled: {
    bg: 'bg-tertiary/4',
    iconColor: 'text-tertiary/20',
    labelColor: 'text-tertiary/20',
  },
} as const

export function ContextMenuPreview({
  isVisible,
  onClose,
  anchorRect,
  preview,
  actions,
  title,
  maxWidth,
  previewMaxHeight,
  searchPlaceholder,
  headerCard,
  supplemental,
  onAdd,
  addPlaceholder = 'New item...',
  addPrefix,
  containerRef,
}: ContextMenuPreviewProps) {
  const [filter, setFilter] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [addValue, setAddValue] = useState('')
  const addInputRef = useRef<HTMLInputElement>(null)

  const clearFilter = useCallback(() => setFilter(''), [])

  useEffect(() => {
    if (isVisible) {
      setFilter('')
      setAddOpen(false)
      setAddValue('')
    }
  }, [isVisible])

  useEffect(() => {
    if (addOpen) {
      requestAnimationFrame(() => addInputRef.current?.focus())
    }
  }, [addOpen])

  const handleAddConfirm = useCallback(() => {
    const trimmed = addValue.trim()
    if (!trimmed || !onAdd) return
    onAdd(trimmed)
    setAddValue('')
    setAddOpen(false)
  }, [addValue, onAdd])

  const scoped = !!containerRef?.current
  const posClass = scoped ? 'absolute' : 'fixed'

  const resolvedPreview = typeof preview === 'function' ? preview(filter, clearFilter) : preview

  const renderAction = (action: ContextMenuAction) => {
    const isDisabled = action.variant === 'disabled'
    const styles = ACTION_STYLES[action.variant ?? 'default']
    const Icon = action.icon
    return (
      <button
        key={action.key}
        disabled={isDisabled}
        onClick={() => {
          if (isDisabled) return
          if (action.closesOnAction === false) {
            action.onAction()
          } else {
            onClose()
            setTimeout(action.onAction, 320)
          }
        }}
        className={`flex flex-col items-center justify-center gap-0.5 min-w-[52px] px-3 py-2 rounded-xl ${styles.bg} transition-all ${isDisabled ? 'cursor-default' : 'active:scale-95'}`}
      >
        {Icon && <Icon size={14} className={styles.iconColor} />}
        {action.label && <span className={`text-[9px] font-medium ${styles.labelColor}`}>{action.label}</span>}
      </button>
    )
  }

  const leading = onAdd && actions.length > 0 ? actions.slice(0, -1) : actions
  const trailing = onAdd && actions.length > 0 ? actions[actions.length - 1] : null

  return (
    <BaseOverlay isOpen={isVisible} onClose={onClose} backdrop="blur" zIndex={80} containerRef={containerRef}>
      {(visible) => {
        const containerRect = scoped ? containerRef!.current!.getBoundingClientRect() : null
        const originX = anchorRect
          ? (anchorRect.left + anchorRect.width / 2) - (containerRect?.left ?? 0)
          : (containerRect?.width ?? window.innerWidth) / 2
        const originY = anchorRect
          ? (anchorRect.top + anchorRect.height / 2) - (containerRect?.top ?? 0)
          : (containerRect?.height ?? window.innerHeight) / 2

        return (
          <div className={`${posClass} inset-0 z-[80] flex flex-col items-center justify-center pointer-events-none px-6 py-10`}>
            <div
              className={`pointer-events-auto w-full max-h-full ${maxWidth ?? 'max-w-[340px]'}`}
              style={{
                transformOrigin: `${originX}px ${originY}px`,
                transform: visible ? 'scale(1)' : 'scale(0.88)',
                opacity: visible ? 1 : 0,
                transition: 'transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 200ms ease-out',
              }}
            >
              {/* Outer shell */}
              <div className="flex flex-col gap-2 min-h-0">

                {/* Shell header — shared with Popover */}
                {title && <PopoverHeader title={title} onClose={onClose} />}

                {/* Optional content above inner card */}
                {headerCard}

                {/* Inner white card — search + scrollable preview */}
                <div className="bg-themewhite rounded-xl overflow-hidden min-h-0">
                  {searchPlaceholder && (
                    <div className="border-b border-tertiary/10 px-2 py-1.5">
                      <SearchInput
                        value={filter}
                        onChange={setFilter}
                        placeholder={searchPlaceholder}
                        className="!bg-transparent !border-transparent !shadow-none text-[10pt]"
                      />
                    </div>
                  )}
                  <div className="overflow-y-auto overscroll-contain" style={{ maxHeight: previewMaxHeight ?? '40dvh' }}>
                    {resolvedPreview}
                  </div>
                </div>

                {/* Optional content between inner card and footer */}
                {supplemental}

                {/* Add input — animated reveal */}
                {onAdd && (
                  <div
                    className="grid transition-[grid-template-rows,opacity] duration-300 ease-out"
                    style={{
                      gridTemplateRows: addOpen ? '1fr' : '0fr',
                      opacity: addOpen ? 1 : 0,
                    }}
                  >
                    <div className="overflow-hidden min-h-0">
                      <div className="flex items-center gap-2 pt-1">
                        {addPrefix}
                        <div className="flex-1">
                          <input
                            ref={addInputRef}
                            type="text"
                            value={addValue}
                            onChange={(e) => setAddValue(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleAddConfirm() }}
                            placeholder={addPlaceholder}
                            className="w-full text-[10pt] pl-3 pr-3 py-2 rounded-full border border-tertiary/15 bg-themewhite text-primary outline-none focus:border-themeblue1/30 placeholder:text-tertiary/30 transition-all duration-200"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => { setAddValue(''); setAddOpen(false) }}
                          className="w-8 h-8 rounded-full bg-tertiary/8 flex items-center justify-center active:scale-95 transition-all shrink-0"
                        >
                          <X size={14} className="text-tertiary/50" />
                        </button>
                        <button
                          type="button"
                          onClick={handleAddConfirm}
                          disabled={!addValue.trim()}
                          className={`w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition-all shrink-0 ${
                            addValue.trim() ? 'bg-themegreen/15' : 'bg-tertiary/8'
                          }`}
                        >
                          <Check size={14} className={addValue.trim() ? 'text-themegreen' : 'text-tertiary/20'} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Footer row — actions pill LEFT, dismiss RIGHT */}
                <div className="flex items-center justify-between px-0.5">
                  {(actions.length > 0 || onAdd) ? (
                    <div className="flex gap-1 bg-themewhite rounded-2xl px-1.5 py-1.5">
                      {leading.map(renderAction)}
                      {onAdd && (
                        <button
                          onClick={() => setAddOpen(prev => !prev)}
                          className={`flex flex-col items-center justify-center gap-0.5 min-w-[52px] px-3 py-2 rounded-xl transition-all active:scale-95 ${
                            addOpen ? 'bg-themegreen/10' : 'bg-themeblue2/8'
                          }`}
                        >
                          <Plus size={14} className={addOpen ? 'text-themegreen' : 'text-themeblue2'} />
                        </button>
                      )}
                      {trailing && renderAction(trailing)}
                    </div>
                  ) : (
                    <div />
                  )}

                  {/* Dismiss */}
                  <button
                    onClick={onClose}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-tertiary/50 hover:text-tertiary active:scale-95 transition-all"
                    aria-label="Close"
                  >
                    <X size={15} />
                  </button>
                </div>

              </div>
            </div>
          </div>
        )
      }}
    </BaseOverlay>
  )
}
