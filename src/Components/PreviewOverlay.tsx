import { useEffect, useState, useCallback, useRef } from 'react'
import { Plus, Check, X, ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { SearchInput } from './SearchInput'
import { BaseOverlay, Z } from './BaseOverlay'
import { ActionButton } from './ActionButton'
import { TextInput } from './FormInputs'

export interface ContextMenuAction {
  key: string
  label: string
  icon?: LucideIcon
  onAction: () => void
  variant?: 'default' | 'danger' | 'disabled'
  /** When false the popover stays open after firing onAction (default true) */
  closesOnAction?: boolean
}

export function PopoverHeader({ title, onClose, onBack, headerActions }: { title: string; onClose: () => void; onBack?: () => void; headerActions?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 pt-3.5 pb-3">
      <div className="flex items-center gap-1 min-w-0">
        {onBack && (
          <button
            onClick={onBack}
            className="w-8 h-8 rounded-full flex items-center justify-center text-tertiary hover:text-tertiary active:scale-95 transition-all -ml-1"
            aria-label="Back"
          >
            <ChevronLeft size={16} />
          </button>
        )}
        <span className="text-sm font-medium text-primary truncate">{title}</span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {headerActions}
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full flex items-center justify-center text-tertiary hover:text-tertiary active:scale-95 transition-all"
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}

interface PreviewOverlayProps {
  isOpen: boolean
  onClose: () => void
  /** Bounding rect of the long-pressed element — used for transform origin */
  anchorRect: DOMRect | null
  /** Scrollable preview content — receives search filter + clearFilter when searchable */
  preview?: ReactNode | ((filter: string, clearFilter: () => void) => ReactNode)
  /** Simple content mode — when provided without `preview`, renders inside the inner white card */
  children?: ReactNode
  /** Action buttons rendered in the left-side pill in the footer */
  actions?: ContextMenuAction[]
  /** Custom footer content (left side of footer row). Use instead of `actions` for Popover-style pill buttons. */
  footer?: ReactNode
  /** Right-side footer slot — replaces the default dismiss X. Use for scope/category pills (mirror of `footer`). */
  rightFooter?: ReactNode
  /** Title shown in the outer shell header alongside the X close button */
  title?: string
  /** Optional overflow control(s) rendered left of the header X (e.g. an ellipsis
   *  menu for object-level Share/Export/Delete). Requires `title`. */
  headerActions?: ReactNode
  /** When provided, shows a back chevron to the left of the title */
  onBack?: () => void
  /** Override the default max-width (340px) of the card */
  maxWidth?: number | string
  /** Override the default max-height of the scrollable preview card (default: 40dvh) */
  previewMaxHeight?: string
  /** Adds a search input pinned to the top of the inner card */
  searchPlaceholder?: string
  /** Optional element rendered before the search input (e.g. icon category picker) */
  searchPrefix?: ReactNode
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
  /** Position the card adjacent to `anchorRect` (above the anchor, left-aligned)
   *  instead of centering it. Use for button-triggered pickers so the popover
   *  reads as attached to its trigger rather than floating in the middle. */
  anchored?: boolean
  /** Override the z-index tier. Backdrop sits at this value, content at `zIndex + 15`.
   *  Bump above Z.POPOVER (80) when nesting a popover inside another popover. */
  zIndex?: number
}


export function PreviewOverlay({
  isOpen,
  onClose,
  anchorRect,
  preview,
  children,
  actions = [],
  footer,
  title,
  headerActions,
  onBack,
  maxWidth,
  previewMaxHeight,
  searchPlaceholder,
  searchPrefix,
  headerCard,
  supplemental,
  onAdd,
  addPlaceholder = 'New item...',
  addPrefix,
  containerRef,
  rightFooter,
  anchored = false,
  zIndex = Z.POPOVER,
}: PreviewOverlayProps) {
  const [filter, setFilter] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [addValue, setAddValue] = useState('')
  const addInputRef = useRef<HTMLInputElement>(null)

  const clearFilter = useCallback(() => setFilter(''), [])

  useEffect(() => {
    if (isOpen) {
      setFilter('')
      setAddOpen(false)
      setAddValue('')
    }
  }, [isOpen])

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

  const resolvedContent = preview
    ? (typeof preview === 'function' ? preview(filter, clearFilter) : preview)
    : children

  const renderAction = (action: ContextMenuAction) => {
    if (!action.icon) return null
    return (
      <ActionButton
        key={action.key}
        icon={action.icon}
        label={action.label}
        variant={action.variant ?? 'default'}
        onClick={() => {
          if (action.closesOnAction === false) {
            action.onAction()
          } else {
            onClose()
            setTimeout(action.onAction, 320)
          }
        }}
      />
    )
  }

  const leading = onAdd && actions.length > 0 ? actions.slice(0, -1) : actions
  const trailing = onAdd && actions.length > 0 ? actions[actions.length - 1] : null

  return (
    <BaseOverlay isOpen={isOpen} onClose={onClose} zIndex={zIndex} containerRef={containerRef}>
      {(visible, baseZ) => {
        const containerRect = scoped ? containerRef!.current!.getBoundingClientRect() : null
        const originX = anchorRect
          ? (anchorRect.left + anchorRect.width / 2) - (containerRect?.left ?? 0)
          : (containerRect?.width ?? window.innerWidth) / 2
        const originY = anchorRect
          ? (anchorRect.top + anchorRect.height / 2) - (containerRect?.top ?? 0)
          : (containerRect?.height ?? window.innerHeight) / 2

        // Anchored mode: park the card just above the trigger, left-aligned to it
        // and clamped inside the container — so it reads as attached to the button.
        const cardW = typeof maxWidth === 'number' ? maxWidth : 340
        const useAnchored = anchored && !!anchorRect
        const pad = 8
        const gap = 8
        let anchorStyle: React.CSSProperties = {}
        if (useAnchored) {
          const cRect = containerRect ?? { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight }
          const anchorLeft = anchorRect!.left - cRect.left
          const anchorTop = anchorRect!.top - cRect.top
          const anchorCenterX = anchorLeft + anchorRect!.width / 2
          const left = Math.max(pad, Math.min(anchorLeft, cRect.width - cardW - pad))
          const bottom = cRect.height - anchorTop + gap
          anchorStyle = {
            left,
            bottom,
            width: cardW,
            maxHeight: anchorTop - gap - pad,
            transformOrigin: `${anchorCenterX - left}px 100%`,
          }
        }

        return (
          <div
            className={`${posClass} inset-0 pointer-events-none ${useAnchored ? '' : 'flex flex-col items-center justify-center px-6 py-10'}`}
            style={{ zIndex: baseZ + 15 }}
          >
            <div
              className={useAnchored ? 'pointer-events-auto absolute' : 'pointer-events-auto w-full max-h-full'}
              style={{
                ...(useAnchored
                  ? anchorStyle
                  : {
                      maxWidth: typeof maxWidth === 'number' ? maxWidth : maxWidth ?? 340,
                      transformOrigin: `${originX}px ${originY}px`,
                    }),
                transform: visible ? 'scale(1)' : 'scale(0.88)',
                opacity: visible ? 1 : 0,
                transition: 'transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 200ms ease-out',
              }}
            >
              {/* Outer shell */}
              <div className="flex flex-col gap-2 min-h-0">

                {/* Optional content above inner card */}
                {headerCard}

                {/* Inner white card — title + search + scrollable preview. The
                    header also appears for a back chevron / header actions alone
                    (e.g. an OverlayStack drill-down screen with no title). */}
                <div className="bg-themewhite rounded-2xl overflow-hidden min-h-0">
                  {(title || onBack || headerActions) && (
                    <PopoverHeader title={title ?? ''} onClose={onClose} onBack={onBack} headerActions={headerActions} />
                  )}
                  {searchPlaceholder && preview && (
                    <div className="border-b border-tertiary/10 px-2 py-1.5 flex items-center gap-1.5">
                      {searchPrefix}
                      <div className="flex-1 min-w-0">
                        <SearchInput
                          value={filter}
                          onChange={setFilter}
                          placeholder={searchPlaceholder}
                          className="!bg-transparent !border-transparent !shadow-none text-[10pt]"
                        />
                      </div>
                    </div>
                  )}
                  <div className="overflow-y-auto overscroll-contain" style={{ maxHeight: previewMaxHeight ?? '40dvh' }}>
                    {resolvedContent}
                  </div>

                  {/* Add input — additive row at the bottom of the card, revealed by the footer + */}
                  {onAdd && (
                    <div
                      className="grid transition-[grid-template-rows] duration-300 ease-out"
                      style={{ gridTemplateRows: addOpen ? '1fr' : '0fr' }}
                    >
                      <div className="overflow-hidden min-h-0">
                        <div className="flex items-center gap-2 px-3 py-2.5 border-t border-tertiary/10">
                          {addPrefix}
                          <div className="flex-1">
                            <TextInput
                              bare
                              inputRef={addInputRef}
                              value={addValue}
                              onChange={setAddValue}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleAddConfirm() }}
                              placeholder={addPlaceholder}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => { setAddValue(''); setAddOpen(false) }}
                            className="w-8 h-8 rounded-full bg-tertiary/8 flex items-center justify-center active:scale-95 transition-all shrink-0"
                          >
                            <X size={14} className="text-tertiary" />
                          </button>
                          <button
                            type="button"
                            onClick={handleAddConfirm}
                            disabled={!addValue.trim()}
                            className={`w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition-all shrink-0 ${
                              addValue.trim() ? 'bg-themegreen/15' : 'bg-tertiary/8'
                            }`}
                          >
                            <Check size={14} className={addValue.trim() ? 'text-themegreen' : 'text-tertiary'} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Optional content between inner card and footer */}
                {supplemental}

                {/* Footer row — actions pill LEFT, dismiss RIGHT */}
                <div className="flex items-center justify-between px-0.5">
                  {footer ? (
                    footer
                  ) : (actions.length > 0 || onAdd) ? (
                    <div className="flex gap-1 bg-themewhite rounded-2xl px-1.5 py-1.5">
                      {leading.map(renderAction)}
                      {onAdd && (
                        <button
                          onClick={() => setAddOpen(prev => !prev)}
                          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                            addOpen ? 'bg-themegreen/10' : 'bg-themeblue2/8'
                          }`}
                        >
                          <Plus size={16} className={addOpen ? 'text-themegreen' : 'text-themeblue2'} />
                        </button>
                      )}
                      {trailing && renderAction(trailing)}
                    </div>
                  ) : (
                    <div />
                  )}

                  {/* Right slot — rightFooter wins, otherwise dismiss X (omitted
                      when the header already provides its own X) */}
                  {rightFooter ? (
                    rightFooter
                  ) : !(title || onBack || headerActions) ? (
                    <button
                      onClick={onClose}
                      className="w-9 h-9 rounded-full flex items-center justify-center bg-themewhite text-tertiary hover:text-tertiary active:scale-95 transition-all"
                      aria-label="Close"
                    >
                      <X size={16} />
                    </button>
                  ) : null}
                </div>

              </div>
            </div>
          </div>
        )
      }}
    </BaseOverlay>
  )
}
