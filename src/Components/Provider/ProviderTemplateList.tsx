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
  /** Hide the section header (e.g. when rendered inside a drawer that already has a title) */
  hideHeader?: boolean
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

export function ProviderTemplateList({ templates, onSelect, hideHeader, onNew, onEdit }: ProviderTemplateListProps) {
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
    <div className="flex flex-col h-full">
      {!hideHeader && (
        <div className="px-3 pt-3 pb-2">
          <p className="text-[9pt] font-semibold text-tertiary uppercase tracking-wider">Templates</p>
        </div>
      )}
      <div className={`flex-1 overflow-y-auto px-2 pb-3${hideHeader ? ' pt-2' : ''}`}>
        {templates.length ? (
          <div className="rounded-xl bg-themewhite2 overflow-hidden divide-y divide-tertiary/8">
            {templates.map((t) => (
              <TemplateRow
                key={t.id}
                template={t}
                onClick={(rect) => handleRowClick(t, rect)}
              />
            ))}
          </div>
        ) : (
          <EmptyState title="No templates yet" />
        )}
      </div>

      {onNew && (
        <div className="px-3 pb-3 flex justify-end">
          <ActionPill ref={addPillRef} shadow="sm">
            <ActionButton icon={Plus} label="New template" onClick={handleNewClick} />
          </ActionPill>
        </div>
      )}

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
      />
    </div>
  )
}
