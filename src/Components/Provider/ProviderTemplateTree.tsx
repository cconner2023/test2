import { useMemo, useRef, useState } from 'react'
import { Eye, Pencil, Trash2, MoreHorizontal } from 'lucide-react'
import { LiftedRowMenu } from '@/Components/primitives/LiftedRowMenu'
import type { ContextMenuItem } from '@/Components/primitives/ContextMenu'
import { liftPressHandlers, type LiftPressState } from '../liftPress'
import type { ProviderNoteTemplate } from '../../Data/User'

interface ProviderTemplateTreeProps {
  templates: ProviderNoteTemplate[]
  /** Filter rows to templates whose name or field summary matches this query. */
  searchQuery?: string
  /** Highlighted row (desktop: the template open in the right-pane detail). */
  activeTemplateId?: string | null
  /** Row tap — applies the template (desktop: fills the center note; mobile: apply + close). */
  onSelect: (template: ProviderNoteTemplate) => void
  /** Context-menu "View" — open the template's read-only detail (desktop pane). Omit to hide. */
  onView?: (template: ProviderNoteTemplate) => void
  /** Context-menu "Edit" — open the editor. Anchor = the row's rect (mobile popover position). */
  onEdit?: (template: ProviderNoteTemplate, anchor: DOMRect) => void
  /** Context-menu "Delete". */
  onDelete?: (template: ProviderNoteTemplate) => void
  /** Reveal the ellipsis only on hover (desktop rail); off = always shown (mobile). */
  hoverActions?: boolean
}

/** One-line summary of which note sections a template fills — used for search matching. */
function fieldPreview(t: ProviderNoteTemplate): string {
  return [
    (t.hpiExpanderAbbrs?.length || t.hpiExpanderAbbr || t.hpiText) ? 'HPI' : null,
    t.peBlockKeys?.length ? `PE (${t.peBlockKeys.length})` : (t.peExpanderAbbrs?.length || t.peExpanderAbbr || t.peText) ? 'PE' : null,
    (t.assessmentExpanderAbbrs?.length || t.assessmentExpanderAbbr || t.assessmentText) ? 'Assess' : null,
    (t.planExpanderAbbrs?.length || t.planExpanderAbbr || t.planOrderSetId || t.planText) ? 'Plan' : null,
  ].filter(Boolean).join(' · ') || 'Empty template'
}

/**
 * Flat, tree-styled list of note templates — the provider analogue of
 * PropertyLocationTree / MapOverlayTree. Single-line name rows (no icon); a row
 * tap APPLIES the template. View · Edit · Delete ride a lifted context menu
 * opened by the hover-revealed ellipsis (desktop), right-click, or long-press
 * (mobile) — same primitive across platforms. Templates are flat (no hierarchy),
 * so there are no chevrons or nesting.
 */
export function ProviderTemplateTree({
  templates,
  searchQuery,
  activeTemplateId,
  onSelect,
  onView,
  onEdit,
  onDelete,
  hoverActions,
}: ProviderTemplateTreeProps) {
  const q = (searchQuery ?? '').trim().toLowerCase()
  const shown = useMemo(() => {
    if (!q) return templates
    return templates.filter(t =>
      t.name.toLowerCase().includes(q) || fieldPreview(t).toLowerCase().includes(q),
    )
  }, [templates, q])

  // One press is active at a time — a single ref bucket serves every row.
  const pressRef = useRef<LiftPressState | null>(null)
  const [menu, setMenu] = useState<{ template: ProviderNoteTemplate; rect: DOMRect } | null>(null)
  const hasMenu = !!(onView || onEdit || onDelete)

  if (shown.length === 0) {
    return (
      <div className="px-6 py-8 text-center text-[10pt] text-tertiary">
        {q ? 'No matches.' : 'No templates yet.'}
      </div>
    )
  }

  const ellipsisCls = `w-7 h-7 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all shrink-0 ${
    hoverActions ? 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100' : ''
  }`

  return (
    <div className="flex flex-col py-1">
      {shown.map((t) => {
        const isActive = activeTemplateId === t.id
        const press = hasMenu
          ? liftPressHandlers((snap) => setMenu({ template: t, rect: snap.rect }), pressRef)
          : {}
        return (
          <div
            key={t.id}
            role="button"
            tabIndex={0}
            data-tmpl-row
            className={`group flex items-center gap-2 py-2 pl-4 pr-4 transition-colors cursor-pointer border-l-2 ${
              isActive
                ? 'bg-themeblue3/8 border-l-themeblue3'
                : 'hover:bg-secondary/5 border-l-transparent'
            }`}
            onClick={() => { if (pressRef.current?.fired) return; onSelect(t) }}
            onKeyDown={(e) => { if (e.key === 'Enter') onSelect(t) }}
            {...press}
          >
            <p className="flex-1 min-w-0 text-[10pt] font-medium text-primary truncate">{t.name}</p>
            {hasMenu && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  const row = (e.currentTarget as HTMLElement).closest('[data-tmpl-row]') as HTMLElement | null
                  if (row) setMenu({ template: t, rect: row.getBoundingClientRect() })
                }}
                aria-label="Template actions"
                className={ellipsisCls}
              >
                <MoreHorizontal size={15} />
              </button>
            )}
          </div>
        )
      })}

      {/* View · Edit · Delete — lifted context menu (ellipsis / right-click / long-press) */}
      {menu && (() => {
        const t = menu.template
        const items: ContextMenuItem[] = [
          ...(onView ? [{ key: 'view', label: 'View', icon: Eye, onAction: () => onView(t) }] : []),
          ...(onEdit ? [{ key: 'edit', label: 'Edit', icon: Pencil, onAction: () => onEdit(t, menu.rect) }] : []),
          ...(onDelete ? [{ key: 'delete', label: 'Delete', icon: Trash2, destructive: true, onAction: () => onDelete(t) }] : []),
        ]
        return (
          <LiftedRowMenu
            isOpen
            layout="list"
            anchorRect={menu.rect}
            items={items}
            onClose={() => setMenu(null)}
          />
        )
      })()}
    </div>
  )
}
