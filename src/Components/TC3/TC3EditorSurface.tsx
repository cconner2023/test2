import { useEffect, useState, type ComponentProps, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, X } from 'lucide-react'
import { useIsMobile } from '../../Hooks/useIsMobile'
import { PreviewOverlay } from '../PreviewOverlay'
import { Sheet } from '../Sheet'
import { SearchInput } from '../SearchInput'
import { ActionButton } from '../ActionButton'
import { HeaderPill, PillButton } from '../HeaderPill'
import { TextInput } from '../FormInputs'
import { useTC3Detail } from './TC3DetailContext'

// Reuse PreviewOverlay's prop surface so the TC3 forms remain unchanged drop-ins.
type Props = ComponentProps<typeof PreviewOverlay>

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

  // ── Desktop — docked panel portaled into the right pane ──
  if (!isMobile && detail) {
    if (!isOpen || !detail.paneRef.current) return null
    return createPortal(
      <div className="flex flex-col h-full bg-themewhite3">
        <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-b border-primary/10">
          <span className="text-sm font-medium text-primary truncate min-w-0">{props.title}</span>
          <div className="flex items-center gap-2 shrink-0">
            {props.headerActions}
            <EditorActions actions={props.actions} onClose={onClose} />
            {props.rightFooter}
            <HeaderPill>
              <PillButton icon={X} iconSize={16} onClick={onClose} label="Close" />
            </HeaderPill>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-1 py-1">{body}</div>
      </div>,
      detail.paneRef.current,
    )
  }

  // ── Mobile — bottom Sheet ──
  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={props.title}
      zIndex={1200}
      maxHeight={85}
      rightContent={props.rightFooter}
      actions={<EditorActions actions={props.actions} onClose={onClose} />}
    >
      {body}
    </Sheet>
  )
}

/** Left-side action pills (e.g. Remove) — shared by the desktop header + Sheet. */
function EditorActions({ actions = [], onClose }: { actions?: Props['actions']; onClose: () => void }) {
  if (!actions || actions.length === 0) return null
  return (
    <>
      {actions.map((a) =>
        a.icon ? (
          <ActionButton
            key={a.key}
            icon={a.icon}
            label={a.label}
            variant={a.variant ?? 'default'}
            onClick={() => {
              if (a.closesOnAction === false) {
                a.onAction()
              } else {
                onClose()
                setTimeout(a.onAction, 320)
              }
            }}
          />
        ) : null,
      )}
    </>
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
