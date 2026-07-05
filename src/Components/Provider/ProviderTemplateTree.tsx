import { useMemo } from 'react'
import { FileText, Pencil } from 'lucide-react'
import type { ProviderNoteTemplate } from '../../Data/User'
import { PROVIDER_TOUR_TEMPLATE_PREFIX } from '../../Data/GuidedTourData'

interface ProviderTemplateTreeProps {
  templates: ProviderNoteTemplate[]
  /** Filter rows to templates whose name or field summary matches this query. */
  searchQuery?: string
  /** Highlighted row (desktop: the template open in the right-pane detail). */
  activeTemplateId?: string | null
  /** Row tap — desktop opens the detail pane; mobile applies + closes the sheet. */
  onSelect: (template: ProviderNoteTemplate) => void
  /** Trailing edit affordance (mobile sheet only). Anchor = the row's rect. */
  onEdit?: (template: ProviderNoteTemplate, anchor: DOMRect) => void
  /** Reveal the edit button only on hover (desktop rail); off = always shown (mobile). */
  hoverActions?: boolean
}

/** One-line summary of which note sections a template fills. */
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
 * PropertyLocationTree. Shares that tree's row structure (border-l-2 active
 * rail, hover-gated action) so the desktop rail and mobile Templates sheet read
 * as the same primitive. Templates are flat (no hierarchy), so there are no
 * chevrons or nesting — just selectable rows.
 */
export function ProviderTemplateTree({
  templates,
  searchQuery,
  activeTemplateId,
  onSelect,
  onEdit,
  hoverActions,
}: ProviderTemplateTreeProps) {
  const q = (searchQuery ?? '').trim().toLowerCase()
  const shown = useMemo(() => {
    if (!q) return templates
    return templates.filter(t =>
      t.name.toLowerCase().includes(q) || fieldPreview(t).toLowerCase().includes(q),
    )
  }, [templates, q])

  if (shown.length === 0) {
    return (
      <div className="px-6 py-8 text-center text-[10pt] text-tertiary">
        {q ? 'No matches.' : 'No templates yet.'}
      </div>
    )
  }

  const editBtnCls = `w-7 h-7 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all shrink-0 ${
    hoverActions ? 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100' : ''
  }`

  return (
    <div className="flex flex-col py-1">
      {shown.map((t) => {
        const isActive = activeTemplateId === t.id
        const isTour = t.id.startsWith(PROVIDER_TOUR_TEMPLATE_PREFIX)
        return (
          <div
            key={t.id}
            role="button"
            tabIndex={0}
            data-tmpl-row
            data-tour={isTour ? 'provider-template-apply' : undefined}
            className={`group flex items-center gap-2 py-2 pl-4 pr-4 transition-colors cursor-pointer border-l-2 ${
              isActive
                ? 'bg-themeblue3/8 border-l-themeblue3'
                : 'hover:bg-secondary/5 border-l-transparent'
            }`}
            onClick={() => onSelect(t)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSelect(t) }}
          >
            <span className="w-7 h-7 rounded-lg bg-themeblue2/10 flex items-center justify-center shrink-0">
              <FileText size={14} className="text-themeblue2" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[10pt] font-medium text-primary truncate">{t.name}</p>
              <p className="text-[9pt] text-tertiary truncate">{fieldPreview(t)}</p>
            </div>
            {onEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  const row = (e.currentTarget as HTMLElement).closest('[data-tmpl-row]') as HTMLElement | null
                  if (row) onEdit(t, row.getBoundingClientRect())
                }}
                aria-label="Edit template"
                className={editBtnCls}
              >
                <Pencil size={14} />
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
