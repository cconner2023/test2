import { useEffect, useState, type ComponentProps, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, X, type LucideIcon } from 'lucide-react'
import { useIsMobile } from '../../Hooks/useIsMobile'
import { PreviewOverlay } from '../PreviewOverlay'
import { Sheet } from '@/Components/primitives/Sheet'
import { SearchInput } from '@/Components/primitives/SearchInput'
import { HeaderPill, PillButton } from '@/Components/primitives/HeaderPill'
import { TextInput } from '@/Components/primitives/FormInputs'
import { useTC3Detail } from './TC3DetailContext'

// Reuse PreviewOverlay's prop surface so the TC3 forms remain drop-ins, plus a
// structured `saveAction` so the surface owns the Save button markup (rendered
// as a Check PillButton grouped with Close) rather than each form hand-rolling it.
type Props = ComponentProps<typeof PreviewOverlay> & {
  /** Primary save/done action — an icon PillButton grouped in the Close pill.
   *  Its `onAction` is responsible for closing the surface (commit + dismiss). */
  saveAction?: { icon?: LucideIcon; label: string; onAction: () => void }
}

/**
 * The TC3 card sub-editor surface — same prop surface the forms already pass to
 * PreviewOverlay, but presented as the app's object-detail primitive rather than
 * a floating overlay:
 *   • Desktop — rendered DIRECTLY into TC3Drawer's right pane (portaled to
 *     `paneRef`), a plain flex-column with a host-owned header + Close, mirroring
 *     CalendarPanel → EventDetailPanel. Opening it collapses the roster rail.
 *   • Mobile — a bottom Sheet (the same EventDetailPanel `inSheet` primitive).
 * No backdrop, no scale-in float — it reads as a docked detail pane.
 */
export function TC3EditorSurface(props: Props) {
  const isMobile = useIsMobile()
  const detail = useTC3Detail()

  const { isOpen, onClose } = props

  // Desktop: while open, collapse the rail and open the right pane. Guarded on
  // `isOpen` so each surface contributes exactly one +1/-1 across its open span.
  useEffect(() => {
    if (isMobile || !detail || !isOpen) return
    detail.registerDetail(true)
    return () => detail.registerDetail(false)
  }, [isMobile, detail, isOpen])

  const body = useEditorBody(props)

  const { saveAction } = props

  // Save (Check) + Close (X) as a single grouped cluster: one HeaderPill →
  // borderless icons on desktop, a bordered pill on mobile. Same PillButton
  // styling for both; Save carries the success accent (green underline desktop /
  // filled circle mobile) to read as primary.
  const saveClosePills = (
    <>
      {saveAction && (
        <PillButton
          icon={saveAction.icon ?? Check}
          iconSize={16}
          accent="success"
          onClick={saveAction.onAction}
          label={saveAction.label}
        />
      )}
      <PillButton icon={X} iconSize={16} onClick={onClose} label="Close" />
    </>
  )

  // ── Desktop — docked panel portaled into the right pane ──
  // Header mirrors the app's edit-item pane: reset/remove (left) · title ·
  // [ellipsis] Save · Close (right, one borderless cluster).
  if (!isMobile && detail) {
    if (!isOpen || !detail.paneRef.current) return null
    return createPortal(
      <div className="flex flex-col h-full bg-themewhite3">
        <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-primary/10">
          <LeftAction actions={props.actions} onClose={onClose} />
          <span className="text-sm font-medium text-primary truncate min-w-0 flex-1">{props.title}</span>
          <div className="flex items-center gap-2 shrink-0">
            {props.headerActions}
            <HeaderPill>{saveClosePills}</HeaderPill>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-1 py-1">{body}</div>
      </div>,
      detail.paneRef.current,
    )
  }

  // ── Mobile — bottom Sheet ──
  // reset/remove rides the header-left; Save folds into the Sheet's Close pill
  // (Sheet groups `actions` + Close in one HeaderPill). Capped at 60dvh so the
  // sheet never dominates the viewport — the body scrolls past it.
  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={props.title}
      zIndex={1200}
      maxHeight={60}
      leftContent={<LeftAction actions={props.actions} onClose={onClose} />}
      rightContent={props.headerActions ? <div className="flex items-center gap-2">{props.headerActions}</div> : undefined}
      actions={
        saveAction ? (
          <PillButton
            icon={saveAction.icon ?? Check}
            accent="success"
            onClick={saveAction.onAction}
            label={saveAction.label}
          />
        ) : undefined
      }
    >
      {body}
    </Sheet>
  )
}

/** Header-left secondary action(s) — reset / remove. One HeaderPill so it reads
 *  as a grouped pill on mobile and borderless icons on desktop, matching the
 *  Save/Close cluster on the right. */
function LeftAction({ actions = [], onClose }: { actions?: Props['actions']; onClose: () => void }) {
  const items = (actions ?? []).filter((a) => a.icon)
  if (items.length === 0) return null
  return (
    <HeaderPill>
      {items.map((a) => (
        <PillButton
          key={a.key}
          icon={a.icon!}
          iconSize={16}
          label={a.label}
          variant={a.variant === 'danger' ? 'danger' : 'default'}
          onClick={() => {
            if (a.closesOnAction === false) {
              a.onAction()
            } else {
              onClose()
              setTimeout(a.onAction, 320)
            }
          }}
        />
      ))}
    </HeaderPill>
  )
}

/** Shared editor body — headerCard · search · content · add · supplemental · footer. */
function useEditorBody({
  isOpen,
  preview,
  children,
  searchPlaceholder,
  searchPrefix,
  onAdd,
  addPlaceholder = 'New item...',
  addPrefix,
  headerCard,
  supplemental,
  footer,
}: Props): ReactNode {
  const [filter, setFilter] = useState('')
  const [addValue, setAddValue] = useState('')

  useEffect(() => {
    if (isOpen) {
      setFilter('')
      setAddValue('')
    }
  }, [isOpen])

  const content = preview
    ? typeof preview === 'function'
      ? preview(filter, () => setFilter(''))
      : preview
    : children

  const handleAdd = () => {
    const trimmed = addValue.trim()
    if (!trimmed || !onAdd) return
    onAdd(trimmed)
    setAddValue('')
  }

  return (
    <div className="pb-2">
      {headerCard}

      {searchPlaceholder && preview && (
        <div className="border-b border-tertiary/10 px-3 py-2 flex items-center gap-1.5">
          {searchPrefix}
          <div className="flex-1 min-w-0">
            <SearchInput value={filter} onChange={setFilter} placeholder={searchPlaceholder} />
          </div>
        </div>
      )}

      {content}

      {onAdd && (
        <div className="flex items-center gap-2 px-3 py-2.5 border-t border-tertiary/10">
          {addPrefix}
          <div className="flex-1">
            <TextInput
              bare
              value={addValue}
              onChange={setAddValue}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
              placeholder={addPlaceholder}
            />
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!addValue.trim()}
            className={`w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-all shrink-0 ${
              addValue.trim() ? 'bg-themegreen/15' : 'bg-tertiary/8'
            }`}
            aria-label="Add"
          >
            <Check size={16} className={addValue.trim() ? 'text-themegreen' : 'text-tertiary'} />
          </button>
        </div>
      )}

      {supplemental}
      {footer && <div className="px-3 pt-2">{footer}</div>}
    </div>
  )
}
