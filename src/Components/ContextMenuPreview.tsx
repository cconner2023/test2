import { useEffect, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Check, X } from 'lucide-react'
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { SearchInput } from './SearchInput'

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
  /** Action tile buttons rendered in a horizontal bar below the preview */
  actions: ContextMenuAction[]
  /** Override the default max-width (340px) of the card */
  maxWidth?: string
  /** Override the default max-height of the scrollable preview card (default: 40dvh) */
  previewMaxHeight?: string
  /** Adds a search input pinned to the top of the preview card */
  searchPlaceholder?: string
  /** Optional card rendered above the main preview card */
  headerCard?: ReactNode
  /** Optional second card rendered between preview and actions */
  supplemental?: ReactNode
  /** When provided, shows an "Add" action in the bar that reveals an inline input */
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
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [addValue, setAddValue] = useState('')
  const addInputRef = useRef<HTMLInputElement>(null)

  const clearFilter = useCallback(() => setFilter(''), [])

  useEffect(() => {
    if (isVisible) {
      setMounted(true)
      setFilter('')
      setAddOpen(false)
      setAddValue('')
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setOpen(true))
      })
    } else {
      setOpen(false)
      const t = setTimeout(() => setMounted(false), 300)
      return () => clearTimeout(t)
    }
  }, [isVisible])

  useEffect(() => {
    if (addOpen) {
      requestAnimationFrame(() => addInputRef.current?.focus())
    }
  }, [addOpen])

  const handleClose = useCallback(() => {
    setOpen(false)
    setTimeout(onClose, 300)
  }, [onClose])

  const handleAddConfirm = useCallback(() => {
    const trimmed = addValue.trim()
    if (!trimmed || !onAdd) return
    onAdd(trimmed)
    setAddValue('')
    setAddOpen(false)
  }, [addValue, onAdd])

  if (!mounted) return null

  const scoped = !!containerRef?.current
  const containerRect = scoped ? containerRef!.current!.getBoundingClientRect() : null
  const posClass = scoped ? 'absolute' : 'fixed'

  // Transform origin — viewport coords for fixed, container-relative for scoped
  const originX = anchorRect
    ? (anchorRect.left + anchorRect.width / 2) - (containerRect?.left ?? 0)
    : (containerRect?.width ?? window.innerWidth) / 2
  const originY = anchorRect
    ? (anchorRect.top + anchorRect.height / 2) - (containerRect?.top ?? 0)
    : (containerRect?.height ?? window.innerHeight) / 2

  const resolvedPreview = typeof preview === 'function' ? preview(filter, clearFilter) : preview

  return createPortal(
    <>
      {/* Backdrop — blurred + dimmed */}
      <div
        className={`${posClass} inset-0 z-80 transition-all duration-300`}
        style={{
          backgroundColor: open ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0)',
          backdropFilter: open ? 'blur(12px)' : 'blur(0px)',
          WebkitBackdropFilter: open ? 'blur(12px)' : 'blur(0px)',
          pointerEvents: open ? 'auto' : 'none',
        }}
        onClick={handleClose}
      />

      {/* Card — vertically constrained, scrollable preview, pinned action tiles */}
      <div className={`${posClass} inset-0 z-80 flex flex-col items-center justify-center pointer-events-none px-6 py-10`}>
        <div
          className={`pointer-events-auto w-full flex flex-col items-center gap-2.5 max-h-full ${maxWidth ?? 'max-w-[340px]'}`}
          style={{
            transformOrigin: `${originX}px ${originY}px`,
            transform: open ? 'scale(1)' : 'scale(0.88)',
            opacity: open ? 1 : 0,
            transition: 'transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 200ms ease-out',
          }}
        >
          {/* Search — using shared SearchInput primitive */}
          {searchPlaceholder && (
            <div className="w-full shrink-0">
              <SearchInput
                value={filter}
                onChange={setFilter}
                placeholder={searchPlaceholder}
                className="!bg-transparent !border-tertiary/15 !shadow-none text-[10pt]"
              />
            </div>
          )}

          {/* Header cards — floats above main preview; callers supply their own card styling */}
          {headerCard}

          {/* Preview card — scrollable content */}
          <div className="w-full rounded-2xl bg-themewhite shadow-xl border border-tertiary/10 overflow-hidden min-h-0" style={{ maxHeight: previewMaxHeight ?? '40dvh' }}>
            <div className="overflow-y-auto h-full overscroll-contain">
              {resolvedPreview}
            </div>
          </div>

          {/* Add input — floating, animated reveal */}
          {onAdd && (
            <div
              className="w-full grid transition-[grid-template-rows,opacity] duration-300 ease-out"
              style={{
                gridTemplateRows: addOpen ? '1fr' : '0fr',
                opacity: addOpen ? 1 : 0,
              }}
            >
              <div className="overflow-hidden min-h-0">
                <div className="flex items-center gap-2">
                  {addPrefix}
                  <div className="flex-1 relative">
                    <input
                      ref={addInputRef}
                      type="text"
                      value={addValue}
                      onChange={(e) => setAddValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddConfirm() }}
                      placeholder={addPlaceholder}
                      className="w-full text-[10pt] pl-3 pr-3 py-2 rounded-full border border-tertiary/15 bg-transparent text-primary outline-none focus:border-themeblue1/30 placeholder:text-tertiary/30 transition-all duration-200"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => { setAddValue(''); setAddOpen(false) }}
                    className="w-8 h-8 rounded-full bg-tertiary/8 flex items-center justify-center active:scale-95 transition-all"
                  >
                    <X size={14} className="text-tertiary/50" />
                  </button>
                  <button
                    type="button"
                    onClick={handleAddConfirm}
                    disabled={!addValue.trim()}
                    className={`w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition-all ${
                      addValue.trim() ? 'bg-themegreen/15' : 'bg-tertiary/8'
                    }`}
                  >
                    <Check size={14} className={addValue.trim() ? 'text-themegreen' : 'text-tertiary/20'} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Supplemental — optional, rendered without wrapper */}
          {supplemental && (
            <div className="w-full shrink-0">
              {supplemental}
            </div>
          )}

          {/* Action tiles — horizontal bar */}
          {(actions.length > 0 || onAdd) && (() => {
            const leading = onAdd && actions.length > 0 ? actions.slice(0, -1) : actions
            const trailing = onAdd && actions.length > 0 ? actions[actions.length - 1] : null

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
                      handleClose()
                      setTimeout(action.onAction, 320)
                    }
                  }}
                  className={`flex flex-col items-center justify-center gap-0.5 min-w-[56px] px-4 py-2 rounded-lg ${styles.bg} transition-all ${isDisabled ? 'cursor-default' : 'active:scale-95'}`}
                >
                  {Icon && <Icon size={14} className={styles.iconColor} />}
                  {action.label && <span className={`text-[9px] font-medium ${styles.labelColor}`}>{action.label}</span>}
                </button>
              )
            }

            return (
              <div className="shrink-0 flex gap-1 rounded-xl bg-themewhite2 border border-tertiary/15 shadow-lg px-1.5 py-1.5">
                {leading.map(renderAction)}
                {onAdd && (
                  <button
                    onClick={() => setAddOpen(prev => !prev)}
                    className={`flex flex-col items-center justify-center gap-0.5 min-w-[56px] px-4 py-2 rounded-lg transition-all active:scale-95 ${
                      addOpen ? 'bg-themegreen/10' : 'bg-themeblue2/8'
                    }`}
                  >
                    <Plus size={14} className={addOpen ? 'text-themegreen' : 'text-themeblue2'} />
                  </button>
                )}
                {trailing && renderAction(trailing)}
              </div>
            )
          })()}

          {/* Dismiss button */}
          <button
            onClick={handleClose}
            className="shrink-0 w-8 h-8 rounded-full bg-tertiary/15 flex items-center justify-center active:scale-95 transition-all"
          >
            <span className="text-tertiary text-sm">✕</span>
          </button>
        </div>
      </div>
    </>,
    (scoped ? containerRef!.current! : document.body),
  )
}
