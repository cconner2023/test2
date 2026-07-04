import { useEffect, useState, type ComponentProps } from 'react'
import { Check } from 'lucide-react'
import { useIsMobile } from '../../Hooks/useIsMobile'
import { PreviewOverlay } from '../PreviewOverlay'
import { Sheet } from '../Sheet'
import { SearchInput } from '../SearchInput'
import { ActionButton } from '../ActionButton'
import { TextInput } from '../FormInputs'
import { useTC3Detail } from './TC3DetailContext'

type Props = ComponentProps<typeof PreviewOverlay>

/**
 * Drop-in replacement for PreviewOverlay used by every TC3 card sub-editor.
 * Same prop surface, but presents per the app's object-detail convention:
 *   • Desktop — the editor docks into TC3Drawer's right pane (via containerRef);
 *     opening it collapses the roster rail (registerDetail drives the drawer).
 *   • Mobile — a bottom Sheet, matching the calendar / property detail primitive.
 * The editor CONTENT (`preview` / `children`) is identical across both; only the
 * surrounding chrome changes.
 */
export function TC3EditorSurface(props: Props) {
  const isMobile = useIsMobile()
  const detail = useTC3Detail()

  // Desktop: while open, collapse the rail and open the right pane. Guarded on
  // `isOpen` so each surface contributes exactly one +1/-1 across its open span.
  useEffect(() => {
    if (isMobile || !detail || !props.isOpen) return
    detail.registerDetail(true)
    return () => detail.registerDetail(false)
  }, [isMobile, detail, props.isOpen])

  if (!isMobile && detail) {
    // Dock into the right pane; ignore anchoring (the pane is the surface).
    return <PreviewOverlay {...props} anchorRect={null} anchored={false} containerRef={detail.paneRef} />
  }

  return <TC3EditorSheet {...props} />
}

function TC3EditorSheet({
  isOpen,
  onClose,
  title,
  preview,
  children,
  actions = [],
  footer,
  rightFooter,
  searchPlaceholder,
  searchPrefix,
  onAdd,
  addPlaceholder = 'New item...',
  addPrefix,
  previewMaxHeight,
  headerCard,
  supplemental,
}: Props) {
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

  // Left-side action pills (e.g. Remove) fold into the Sheet's close cluster.
  const sheetActions =
    actions.length > 0 ? (
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
    ) : undefined

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      zIndex={1200}
      maxHeight={85}
      rightContent={rightFooter}
      actions={sheetActions}
    >
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

        <div className="overflow-y-auto overscroll-contain" style={{ maxHeight: previewMaxHeight ?? '60dvh' }}>
          {content}
        </div>

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
    </Sheet>
  )
}
