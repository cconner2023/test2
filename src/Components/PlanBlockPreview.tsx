import React, { useMemo, useState } from 'react';

import { X } from 'lucide-react';

type BlockStatus = 'inactive' | 'active';

interface BlockState {
  status: BlockStatus;
  selectedTags: string[];
  freeText: string;
}

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
  activeTab: string | null;
  onTabChange: (key: string) => void;
}

// ── Category picker (portaled menu) ──

export function CategoryPicker({ value, categories, onChange }: {
  value: string | null;
  categories: { key: string; label: string }[];
  onChange: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const label = value ? categories.find(c => c.key === value)?.label ?? value : 'Select';

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="shrink-0 px-2.5 py-2 text-[10pt] font-medium text-tertiary/60 bg-tertiary/5 rounded-full border border-tertiary/15 transition-colors active:scale-95"
      >
        {label}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[100]" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 mb-2 z-[101] w-[min(280px,80vw)] bg-themewhite rounded-2xl shadow-xl border border-tertiary/10 py-2 overflow-y-auto" style={{ maxHeight: '40dvh' }}>
            <p className="px-3 pb-1.5 text-[9px] font-semibold text-tertiary/40 uppercase tracking-wider">Category</p>
            {categories.map(cat => (
              <button
                key={cat.key}
                type="button"
                onClick={() => { onChange(cat.key); setOpen(false); }}
                className={`w-full text-left px-4 py-2.5 text-xs transition-colors active:scale-[0.98] ${
                  value === cat.key ? 'text-primary font-medium bg-tertiary/6' : 'text-tertiary/60'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Main preview ──

export const PlanAllBlocksPreview: React.FC<PlanAllBlocksPreviewProps> = ({
  categories,
  filter = '',
  onToggleTag,
  activeTab,
  onTabChange,
}) => {
  const lc = filter.toLowerCase();

  const availableTabs = useMemo(() =>
    categories.filter(c => c.tags.length > 0),
    [categories],
  );

  const activeCat = useMemo(() =>
    availableTabs.find(c => c.key === activeTab) ?? availableTabs[0] ?? null,
    [availableTabs, activeTab],
  );

  // When filtering: search across ALL categories. Otherwise: show active tab only.
  const { availableItems, crossCategoryResults } = useMemo(() => {
    if (!activeCat) return { availableItems: [], crossCategoryResults: [] };

    const selectedSet = new Set(activeCat.state.selectedTags);
    const available = activeCat.tags
      .filter(t => !selectedSet.has(t))
      .filter(t => !lc || t.toLowerCase().includes(lc))
      .sort((a, b) => a.localeCompare(b));

    // Universal search: when filtering, also search other categories
    const crossResults: { catKey: string; catLabel: string; tag: string; isSelected: boolean }[] = [];
    if (lc) {
      for (const cat of categories) {
        if (cat.key === activeCat.key) continue;
        const catSelectedSet = new Set(cat.state.selectedTags);
        for (const tag of cat.tags) {
          if (tag.toLowerCase().includes(lc)) {
            crossResults.push({
              catKey: cat.key,
              catLabel: cat.label,
              tag,
              isSelected: catSelectedSet.has(tag),
            });
          }
        }
      }
    }

    return { availableItems: available, crossCategoryResults: crossResults };
  }, [activeCat, lc, categories]);

  if (availableTabs.length === 0) {
    return <p className="px-4 py-4 text-[10pt] text-tertiary/40 italic">No plan items configured</p>;
  }

  return (
    <div className="py-1">
      {/* Tab bar — horizontal carousel with fade edges */}
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-themewhite to-transparent z-10" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-themewhite to-transparent z-10" />
        <div className="px-3 pt-3 pb-2.5 flex overflow-x-auto gap-1" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch', scrollSnapType: 'x mandatory' }}>
          {availableTabs.map(cat => {
            const isActive = activeCat?.key === cat.key;
            const hasSelected = cat.state.selectedTags.length > 0;
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => onTabChange(cat.key)}
                style={{ scrollSnapAlign: 'start' }}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95 flex items-center justify-center gap-1.5 ${
                  isActive
                    ? 'bg-tertiary/10 text-primary'
                    : 'text-tertiary/50'
                }`}
              >
                {hasSelected && (
                  <span className="w-1.5 h-1.5 rounded-full bg-tertiary/40 shrink-0" />
                )}
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active section content */}
      {activeCat && (
        <div>
          {/* Available items — toggle to select */}
          {availableItems.length > 0 && (
            <div className="px-4 pb-2">
              <div className="border border-tertiary/10 rounded-xl overflow-hidden">
                {availableItems.map((tag, i) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => onToggleTag(activeCat.key, tag)}
                    className={`flex items-center gap-3 w-full text-left px-4 py-2.5 transition-colors active:scale-[0.98] ${
                      i > 0 ? 'border-t border-tertiary/10' : ''
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full shrink-0 ring-[1.5px] ring-inset ring-tertiary/25 bg-transparent" />
                    <span className="text-[11pt] text-tertiary/60">{tag}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Cross-category search results */}
          {crossCategoryResults.length > 0 && (
            <div className="px-4 pb-2">
              <p className="text-[9px] font-semibold text-tertiary/40 uppercase tracking-wider mb-1.5 mt-1">Other sections</p>
              <div className="border border-tertiary/10 rounded-xl overflow-hidden">
                {crossCategoryResults.map((result, i) => (
                  <button
                    key={`${result.catKey}-${result.tag}`}
                    type="button"
                    onClick={() => onToggleTag(result.catKey, result.tag)}
                    className={`flex items-center gap-3 w-full text-left px-4 py-2.5 transition-colors active:scale-[0.98] ${
                      i > 0 ? 'border-t border-tertiary/10' : ''
                    }`}
                  >
                    <span className={`w-4 h-4 rounded-full shrink-0 ring-[1.5px] ring-inset ${
                      result.isSelected ? 'ring-primary bg-primary/15' : 'ring-tertiary/25 bg-transparent'
                    }`} />
                    <span className={`text-[11pt] flex-1 min-w-0 truncate ${result.isSelected ? 'text-primary' : 'text-tertiary/60'}`}>{result.tag}</span>
                    <span className="text-[9px] text-tertiary/30 shrink-0">{result.catLabel}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {availableItems.length === 0 && crossCategoryResults.length === 0 && !filter && (
            <p className="px-4 py-4 text-[10pt] text-tertiary/40 italic">No items available</p>
          )}
        </div>
      )}
    </div>
  );
};
