import { FileText, LayoutTemplate } from 'lucide-react'
import { EmptyState } from '../EmptyState'
import type { ProviderNoteTemplate } from '../../Data/User'

interface ProviderTemplateListProps {
  templates: ProviderNoteTemplate[]
  onSelect: (template: ProviderNoteTemplate) => void
}

export function ProviderTemplateList({ templates, onSelect }: ProviderTemplateListProps) {
  if (!templates.length) {
    return (
      <EmptyState
        icon={<LayoutTemplate size={32} />}
        title="No Templates"
        subtitle="Create note templates in Settings → Note Content to quickly populate provider fields."
      />
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 pt-3 pb-2">
        <p className="text-[9pt] font-semibold text-tertiary/60 uppercase tracking-wider">Templates</p>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-1">
        {templates.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 md:py-1.5 rounded-xl text-left
              hover:bg-themeblue2/8 active:scale-95 transition-all duration-200"
          >
            <div className="w-8 h-8 md:w-7 md:h-7 rounded-lg bg-themeblue2/10 flex items-center justify-center shrink-0">
              <FileText size={15} className="text-themeblue2" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-primary truncate">{t.name}</p>
              <p className="text-[10px] text-tertiary/50 mt-0.5 truncate">
                {[
                  (t.hpiExpanderAbbr || t.hpiText) ? 'HPI' : null,
                  t.peBlockKeys?.length ? `PE (${t.peBlockKeys.length})` : (t.peExpanderAbbr || t.peText) ? 'PE' : null,
                  (t.assessmentExpanderAbbr || t.assessmentText) ? 'Assess' : null,
                  (t.planExpanderAbbr || t.planOrderSetId || t.planText) ? 'Plan' : null,
                ].filter(Boolean).join(' · ') || 'Empty template'}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
