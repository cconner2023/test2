import { useRef } from 'react'
import { Check, Pencil, X } from 'lucide-react'
import { HeaderPill, PillButton } from '@/Components/primitives/HeaderPill'
import { getBlockByKey } from '../../Data/PhysicalExamData'
import type { ProviderNoteTemplate, TextExpander, PlanOrderSet } from '../../Data/User'
import { PLAN_ORDER_LABELS } from '../../Data/User'

// ── Text / order-set resolution (moved from ProviderTemplateList) ────────────

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

// ── Detail body (headerless) ─────────────────────────────────────────────────

/**
 * Scrollable preview of a template's resolved sections — no header. The desktop
 * right-pane stack supplies its own chrome (title + Edit/Apply pills) around this,
 * so the body is shared between the standalone ProviderTemplateDetail and the pane
 * `detail` screen.
 */
export function TemplateDetailBody({
  template, expanders, orderSets,
}: {
  template: ProviderNoteTemplate;
  expanders: TextExpander[];
  orderSets?: PlanOrderSet[];
}) {
  const sections = buildPreviewSections(template, expanders, orderSets);
  return sections.length ? (
    <div className="space-y-3">
      {sections.map(s => (
        <div key={s.label}>
          <p className="text-[9pt] font-semibold text-tertiary uppercase tracking-wider mb-0.5">{s.label}</p>
          <p className="text-[10pt] text-primary leading-relaxed whitespace-pre-wrap">{s.content}</p>
        </div>
      ))}
    </div>
  ) : (
    <p className="text-[10pt] text-tertiary">Empty template</p>
  );
}

// ── Detail pane ──────────────────────────────────────────────────────────────

interface ProviderTemplateDetailProps {
  template: ProviderNoteTemplate
  expanders: TextExpander[]
  orderSets?: PlanOrderSet[]
  onApply: (template: ProviderNoteTemplate) => void
  onEdit: (template: ProviderNoteTemplate, anchor: DOMRect) => void
  onClose: () => void
}

/**
 * Right-pane detail for a selected template (desktop three-zone). Mirrors the
 * property detail pane: title + grouped HeaderPill actions (Edit · Close ·
 * Apply), scrollable preview body. Apply overwrites the note sections; Edit
 * opens ProviderTemplateEditPopover anchored to this pane.
 */
export function ProviderTemplateDetail({
  template,
  expanders,
  orderSets,
  onApply,
  onEdit,
  onClose,
}: ProviderTemplateDetailProps) {
  const editRef = useRef<HTMLDivElement>(null)

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-tertiary/10">
        <p className="flex-1 min-w-0 text-sm font-semibold text-primary truncate">{template.name}</p>
        <div ref={editRef}>
          <HeaderPill>
            <PillButton
              icon={Pencil}
              iconSize={16}
              onClick={() => { if (editRef.current) onEdit(template, editRef.current.getBoundingClientRect()) }}
              label="Edit"
            />
            <PillButton icon={X} iconSize={16} onClick={onClose} label="Close" />
            <PillButton icon={Check} iconSize={16} accent="success" onClick={() => onApply(template)} label="Apply" />
          </HeaderPill>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
        <TemplateDetailBody template={template} expanders={expanders} orderSets={orderSets} />
      </div>
    </div>
  )
}
