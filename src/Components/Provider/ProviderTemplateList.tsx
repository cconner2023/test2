import { useState, useCallback, useRef } from 'react'
import { FileText, LayoutTemplate, Check } from 'lucide-react'
import { EmptyState } from '../EmptyState'
import { ListItemRow } from '../ListItemRow'
import { PreviewOverlay } from '../PreviewOverlay'
import { useLongPress } from '../../Hooks/useLongPress'
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
              <p className="text-xs text-primary leading-relaxed whitespace-pre-wrap line-clamp-4">{s.content}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-tertiary">Empty template</p>
      )}
    </div>
  )
}

// ── Template Row (handles long-press on mobile) ─────────────────────────────

function TemplateRow({ template, onSelect, onPreview, isMobile }: {
  template: ProviderNoteTemplate
  onSelect: () => void
  onPreview: (rect: DOMRect) => void
  isMobile: boolean
}) {
  const rowRef = useRef<HTMLDivElement>(null)
  const firedRef = useRef(false)

  const handleLongPress = useCallback(() => {
    firedRef.current = true
    if (rowRef.current) {
      onPreview(rowRef.current.getBoundingClientRect())
    }
  }, [onPreview])

  const longPressHandlers = useLongPress(handleLongPress, { delay: 400 })
  const isTourTemplate = template.id.startsWith(PROVIDER_TOUR_TEMPLATE_PREFIX)

  const handleClick = useCallback(() => {
    if (firedRef.current) {
      firedRef.current = false
      return
    }
    onSelect()
  }, [onSelect])

  return (
    <div
      ref={rowRef}
      data-tour={isTourTemplate ? 'provider-template-apply' : undefined}
      {...(isMobile ? longPressHandlers : {})}
      onContextMenu={isMobile ? (e) => e.preventDefault() : undefined}
    >
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

export function ProviderTemplateList({ templates, onSelect, hideHeader }: ProviderTemplateListProps) {
  const isMobile = useIsMobile()
  const { profile } = useUserProfile()
  const expanders = profile.textExpanders ?? []
  const orderSets = profile.planOrderSets

  const [previewTemplate, setPreviewTemplate] = useState<ProviderNoteTemplate | null>(null)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)

  const handlePreview = useCallback((template: ProviderNoteTemplate, rect: DOMRect) => {
    setPreviewTemplate(template)
    setAnchorRect(rect)
  }, [])

  const handleClosePreview = useCallback(() => {
    setPreviewTemplate(null)
    setAnchorRect(null)
  }, [])

  if (!templates.length) {
    return (
      <EmptyState
        icon={<LayoutTemplate size={32} />}
        title="No Templates"
        subtitle="No templates. Create in Settings → Note Content."
      />
    )
  }

  return (
    <div className="flex flex-col h-full">
      {!hideHeader && (
        <div className="px-3 pt-3 pb-2">
          <p className="text-[9pt] font-semibold text-tertiary uppercase tracking-wider">Templates</p>
        </div>
      )}
      <div className={`flex-1 overflow-y-auto px-2 pb-3${hideHeader ? ' pt-2' : ''}`}>
        <div className="rounded-xl bg-themewhite2 overflow-hidden divide-y divide-tertiary/8">
          {templates.map((t) => (
            <TemplateRow
              key={t.id}
              template={t}
              onSelect={() => onSelect(t)}
              onPreview={(rect) => handlePreview(t, rect)}
              isMobile={isMobile}
            />
          ))}
        </div>
      </div>

      {isMobile && (
        <PreviewOverlay
          isOpen={!!previewTemplate}
          onClose={handleClosePreview}
          anchorRect={anchorRect}
          preview={
            previewTemplate && (
              <TemplatePreview
                template={previewTemplate}
                expanders={expanders}
                orderSets={orderSets}
              />
            )
          }
          actions={previewTemplate ? [
            {
              key: 'apply',
              label: 'Apply',
              icon: Check,
              onAction: () => { if (previewTemplate) onSelect(previewTemplate) },
            },
          ] : []}
        />
      )}
    </div>
  )
}
