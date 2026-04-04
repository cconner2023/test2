import React, { useMemo } from 'react';
import { Check } from 'lucide-react';

type BlockStatus = 'inactive' | 'active';

interface BlockState {
  status: BlockStatus;
  selectedTags: string[];
  freeText: string;
}

// ── Multi-category preview (used by the single FAB popover) ──

interface CategoryEntry {
  key: string;
  label: string;
  tags: string[];
  state: BlockState;
}

interface PlanAllBlocksPreviewProps {
  categories: CategoryEntry[];
  filter?: string;
  onToggleTag: (categoryKey: string, tag: string) => void;
  focusKey?: string | null;
}

export const PlanAllBlocksPreview: React.FC<PlanAllBlocksPreviewProps> = ({
  categories,
  filter = '',
  onToggleTag,
  focusKey,
}) => {
  const lc = filter.toLowerCase();

  const filtered = useMemo(() => {
    if (!lc) return categories.filter(c => c.tags.length > 0);
    return categories
      .map(c => ({
        ...c,
        tags: c.tags.filter(t => t.toLowerCase().includes(lc)),
      }))
      .filter(c => c.tags.length > 0 || c.label.toLowerCase().includes(lc));
  }, [categories, lc]);

  if (filtered.length === 0) {
    return <p className="px-4 py-4 text-[10pt] text-tertiary/40 italic">No matches</p>;
  }

  return (
    <div className="py-1">
      {filtered.map(cat => {
        const hasSelected = cat.state.selectedTags.length > 0;
        const sorted = [...cat.tags].sort((a, b) => a.localeCompare(b));
        const isFocused = focusKey === cat.key;
        return (
          <div key={cat.key} data-plan-category={cat.key}>
            {/* Category header */}
            <div className={`px-4 pt-3 pb-1.5 flex items-center gap-2 ${isFocused ? 'bg-themeblue3/5' : ''}`}>
              <span className={`w-3 h-3 rounded-full shrink-0 transition-colors ${
                hasSelected ? 'bg-themegreen' : 'bg-tertiary/15'
              }`} />
              <span className="text-xs font-semibold text-secondary uppercase tracking-wider flex-1">
                {cat.label}
              </span>
              {hasSelected && (
                <span className="text-[10px] text-themegreen">{cat.state.selectedTags.length}</span>
              )}
            </div>
            {/* Tags */}
            {sorted.length > 0 && (
              <div className="mx-4 mb-3 border border-tertiary/10 rounded-xl overflow-hidden">
                {sorted.map((tag, i) => {
                  const selected = cat.state.selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => onToggleTag(cat.key, tag)}
                      className={`flex items-center gap-3 w-full text-left px-4 py-2.5 transition-colors active:scale-[0.98] ${
                        i > 0 ? 'border-t border-tertiary/10' : ''
                      } ${selected ? 'bg-themegreen/5' : ''}`}
                    >
                      <span className={`w-4 h-4 rounded-full shrink-0 flex items-center justify-center transition-colors duration-200 ${
                        selected
                          ? 'bg-themegreen'
                          : 'ring-[1.5px] ring-inset ring-tertiary/25 bg-transparent'
                      }`}>
                        {selected && <Check size={10} className="text-white" strokeWidth={3} />}
                      </span>
                      <span className={`text-[11pt] ${selected ? 'text-primary' : 'text-tertiary/60'}`}>
                        {tag}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
