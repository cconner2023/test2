import { useState, useCallback, useRef } from 'react'
import { FileText, Check, Pencil, Plus } from 'lucide-react'
import { EmptyState } from '../EmptyState'
import { ListItemRow } from '../ListItemRow'
import { PreviewOverlay } from '../PreviewOverlay'
import { ActionPill } from '../ActionPill'
import { ActionButton } from '../ActionButton'
import { useIsMobile } from '../../Hooks/useIsMobile'
import { useUserProfile } from '../../Hooks/useUserProfile'
import { getBlockByKey } from '../../Data/PhysicalExamData'
import type { ProviderNoteTemplate, TextExpander, PlanOrderSet } from '../../Data/User'
import { PLAN_ORDER_LABELS } from '../../Data/User'
import { PROVIDER_TOUR_TEMPLATE_PREFIX } from '../../Data/GuidedTourData'

interface ProviderTemplateListProps {
  templates: ProviderNoteTemplate[]
  onSelect: (template: ProviderNoteTemplate) => void
  /** Opens the new-template editor anchored to the supplied rect */
  onNew?: (anchor: DOMRect) => void
  /** Opens the edit popover for the supplied template */
  onEdit?: (template: ProviderNoteTemplate, anchor: DOMRect) => void
}

function fieldPreview(t: ProviderNoteTemplate): string {
  return [
    (t.hpiExpanderAbbrs?.length || t.hpiExpanderAbbr || t.hpiText) ? 'HPI' : null,
    t.peBlockKeys?.length ? `PE (${t.peBlockKeys.length})` : (t.peExpanderAbbrs?.length || t.peExpanderAbbr || t.peText) ? 'PE' : null,
    (t.assessmentExpanderAbbrs?.length || t.assessmentExpanderAbbr || t.assessmentText) ? 'Assess' : null,
    (t.planExpanderAbbrs?.length || t.planExpanderAbbr || t.planOrderSetId || t.planText) ? 'Plan' : null,
  ].filter(Boolean).join(' · ') || 'Empty template'
}

// ── Preview helpers ─────────────────────────────────────────────────────────

function resolveText(
  text: string | undefined,
  abbrs: string[] | undefined,
  legacyAbbr: string | undefined,
  expanders: TextExpander[],
): string {
  if (text?.trim()) {
    const map = new Map(expanders.map(e => [e.abbr, e.expansion]))
    return text.split(/(\s+)/).map(tok => map.get(tok) ?? tok).join('')
  }
  const list = abbrs?.length ? abbrs : legacyAbbr ? [legacyAbbr] : []
  if (!list.length) return ''
  return list
    .map(abbr => expanders.find(e => e.abbr === abbr)?.expansion ?? abbr)
    .filter(Boolean)
    .join('\n\n')
}

function resolvePlanOrderSet(orderSetId: string | undefined, orderSets: PlanOrderSet[] | undefined): string {
  if (!orderSetId || !orderSets) return ''
  const os = orderSets.find(s => s.id === orderSetId)
  if (!os) return ''
  const labels: Record<string, string> = { ...PLAN_ORDER_LABELS, instructions: 'Instructions' }
  const keys = ['meds', 'lab', 'radiology', 'referral', 'instructions', 'followUp'] as const
  return keys
    .filter(k => os.presets[k]?.length)
    .map(k => `${labels[k]}: ${os.presets[k]!.join('; ')}`)
    .join('\n')
}

function resolvePeBlocks(keys: string[] | undefined): string {
  if (!keys?.length) return ''
  return keys
    .map(k => getBlockByKey(k)?.label)
    .filter(Boolean)
    .join(', ')
}

interface PreviewSection {
  label: string
  content: string
}

function buildPreviewSections(
  t: ProviderNoteTemplate,
  expanders: TextExpander[],
  orderSets: PlanOrderSet[] | undefined,
): PreviewSection[] {
  const sections: PreviewSection[] = []

  const hpi = resolveText(t.hpiText, t.hpiExpanderAbbrs, t.hpiExpanderAbbr, expanders)
  if (hpi) sections.push({ label: 'HPI', content: hpi })

  const peText = resolveText(t.peText, t.peExpanderAbbrs, t.peExpanderAbbr, expanders)
  const peBlocks = resolvePeBlocks(t.peBlockKeys)
  const pe = [peBlocks, peText].filter(Boolean).join('\n')
  if (pe) sections.push({ label: 'Physical Exam', content: pe })

  const assessment = resolveText(t.assessmentText, t.assessmentExpanderAbbrs, t.assessmentExpanderAbbr, expanders)
  if (assessment) sections.push({ label: 'Assessment', content: assessment })

  let plan = resolveText(t.planText, t.planExpanderAbbrs, t.planExpanderAbbr, expanders)
  if (!plan) plan = resolvePlanOrderSet(t.planOrderSetId, orderSets)
  if (plan) sections.push({ label: 'Plan', content: plan })

  return sections
}

// ── Template Preview Content ────────────────────────────────────────────────

function TemplatePreview({ template, expanders, orderSets }: {
  template: ProviderNoteTemplate
  expanders: TextExpander[]
  orderSets: PlanOrderSet[] | undefined
}) {
  const sections = buildPreviewSections(template, expanders, orderSets)

  return (
    <div className="px-4 py-3">
      <p className="text-sm font-semibold text-primary mb-2">{template.name}</p>
      {sections.length ? (
        <div className="space-y-2">
          {sections.map(s => (
            <div key={s.label}>
              <p className="text-[9pt] font-semibold text-tertiary uppercase tracking-wider mb-0.5">{s.label}</p>
              <p className="text-[10pt] text-primary leading-relaxed whitespace-pre-wrap line-clamp-4">{s.content}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[10pt] text-tertiary">Empty template</p>
      )}
    </div>
  )
}

// ── Template Row ────────────────────────────────────────────────────────────

function TemplateRow({ template, onClick }: {
  template: ProviderNoteTemplate
  onClick: (rect: DOMRect) => void
}) {
  const rowRef = useRef<HTMLDivElement>(null)
  const isTourTemplate = template.id.startsWith(PROVIDER_TOUR_TEMPLATE_PREFIX)

  const handleClick = useCallback(() => {
    if (rowRef.current) onClick(rowRef.current.getBoundingClientRect())
  }, [onClick])

  return (
    <div ref={rowRef} data-tour={isTourTemplate ? 'provider-template-apply' : undefined}>
      <ListItemRow
        onClick={handleClick}
        className="px-3 py-2.5 md:py-1.5 hover:bg-themeblue2/8 active:scale-95 transition-all duration-200"
        left={
          <div className="w-8 h-8 md:w-7 md:h-7 rounded-lg bg-themeblue2/10 flex items-center justify-center shrink-0">
            <FileText size={15} className="text-themeblue2" />
          </div>
        }
        center={
          <>
            <p className="text-sm font-medium text-primary truncate">{template.name}</p>
            <p className="text-[9pt] text-tertiary mt-0.5 truncate">{fieldPreview(template)}</p>
          </>
        }
      />
    </div>
  )
}

// ── Main Component ──────────────────────────────────────────────────────────

export function ProviderTemplateList({ templates, onSelect, onNew, onEdit }: ProviderTemplateListProps) {
  const isMobile = useIsMobile()
  const { profile } = useUserProfile()
  const expanders = profile.textExpanders ?? []
  const orderSets = profile.planOrderSets

  // Single context-menu popover: click a row → choose Apply or Edit (with preview).
  const [menuTemplate, setMenuTemplate] = useState<ProviderNoteTemplate | null>(null)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)
  const addPillRef = useRef<HTMLDivElement>(null)

  const handleRowClick = useCallback((template: ProviderNoteTemplate, rect: DOMRect) => {
    setMenuTemplate(template)
    setAnchorRect(rect)
  }, [])

  const handleCloseMenu = useCallback(() => {
    setMenuTemplate(null)
    setAnchorRect(null)
  }, [])

  const handleNewClick = useCallback(() => {
    if (!onNew || !addPillRef.current) return
    onNew(addPillRef.current.getBoundingClientRect())
  }, [onNew])

  const menuActions = menuTemplate ? [
    {
      key: 'apply',
      label: 'Apply',
      icon: Check,
      onAction: () => onSelect(menuTemplate),
    },
    ...(onEdit ? [{
      key: 'edit',
      label: 'Edit',
      icon: Pencil,
      onAction: () => {
        if (anchorRect) onEdit(menuTemplate, anchorRect)
      },
    }] : []),
  ] : []

  return (
    <div className={isMobile ? 'flex flex-col' : 'flex flex-col h-full'}>
      {/* Top padding clears the placement="overlay" ActionPill (top-0 -translate-y-1/2):
          the pill's upper half (~20px) + shadow rides above the first card, and this
          scroll container's overflow-y would otherwise clip it. Desktop left pane sits
          flush under the fixed drawer header with no breathing room, so it needs more
          headroom than the mobile picker. On mobile the Sheet owns the scroller
          (glass-header gotcha — a nested overflow-auto body won't paint behind it). */}
      <div className={`px-2 pb-3 ${isMobile ? 'pt-5' : 'flex-1 overflow-y-auto pt-8'}`}>
        {templates.length ? (
          <div className="relative">
            <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden divide-y divide-tertiary/8">
              {templates.map((t) => (
                <TemplateRow
                  key={t.id}
                  template={t}
                  onClick={(rect) => handleRowClick(t, rect)}
                />
              ))}
            </div>
            {onNew && (
              <ActionPill ref={addPillRef} shadow="sm" placement="overlay">
                <ActionButton icon={Plus} label="New template" onClick={handleNewClick} />
              </ActionPill>
            )}
          </div>
        ) : (
          <EmptyState
            title="No templates yet"
            action={onNew ? {
              icon: Plus,
              label: 'New template',
              onClick: (anchor) => onNew(anchor.getBoundingClientRect()),
            } : undefined}
          />
        )}
      </div>

      <PreviewOverlay
        isOpen={!!menuTemplate}
        onClose={handleCloseMenu}
        anchorRect={anchorRect}
        preview={
          menuTemplate && (
            <TemplatePreview
              template={menuTemplate}
              expanders={expanders}
              orderSets={orderSets}
            />
          )
        }
        previewMaxHeight={isMobile ? '50dvh' : '40dvh'}
        actions={menuActions}
        // On mobile this list lives inside the Templates Sheet (body portal
        // at z-[1200]); the menu would otherwise be trapped under the sheet.
        zIndex={isMobile ? 1300 : undefined}
      />
    </div>
  )
}
