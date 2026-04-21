import React, { useMemo, useState } from 'react';
import type { PlanBlockKey } from '../Data/User';
import { CATEGORY_META } from './Settings/PlanTagManager';

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
}

// ── Category picker (portaled menu) ──

export function CategoryPicker({ value, categories, onChange }: {
  value: string | null;
  categories: { key: string; label: string }[];
  onChange: (key: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const label = value ? categories.find(c => c.key === value)?.label ?? value : 'All';

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="shrink-0 px-2.5 py-2 text-[10pt] font-medium text-tertiary bg-tertiary/5 rounded-full border border-tertiary/15 transition-colors active:scale-95"
      >
        {label}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[100]" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 mb-2 z-[101] w-[min(280px,80vw)] bg-themewhite rounded-2xl shadow-xl border border-tertiary/10 py-2 overflow-y-auto" style={{ maxHeight: '40dvh' }}>
            <p className="px-3 pb-1.5 text-[9pt] md:text-[9pt] font-semibold text-tertiary uppercase tracking-wider">Category</p>
            <button
              type="button"
              onClick={() => { onChange(null); setOpen(false); }}
              className={`w-full text-left px-4 py-2.5 text-xs transition-colors active:scale-[0.98] ${
                value === null ? 'text-primary font-medium bg-tertiary/6' : 'text-tertiary'
              }`}
            >
              All
            </button>
            {categories.map(cat => (
              <button
                key={cat.key}
                type="button"
                onClick={() => { onChange(cat.key); setOpen(false); }}
                className={`w-full text-left px-4 py-2.5 text-xs transition-colors active:scale-[0.98] ${
                  value === cat.key ? 'text-primary font-medium bg-tertiary/6' : 'text-tertiary'
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
}) => {
  const lc = filter.toLowerCase();

  const hasAnyTags = categories.some(c => c.tags.length > 0);

  // Grouped: category order preserved (meds first per CATEGORY_META order), alpha within each group
  const groupedItems = useMemo(() => {
    const result: { catKey: string; tag: string }[] = [];
    for (const cat of categories) {
      if (cat.tags.length === 0) continue;
      if (activeTab && cat.key !== activeTab) continue;
      const selectedSet = new Set(cat.state.selectedTags);
      const matching = cat.tags
        .filter(t => !selectedSet.has(t))
        .filter(t => !lc || t.toLowerCase().includes(lc))
        .sort((a, b) => a.localeCompare(b));
      for (const tag of matching) {
        result.push({ catKey: cat.key, tag });
      }
    }
    return result;
  }, [categories, activeTab, lc]);

  if (!hasAnyTags) {
    return <p className="px-4 py-4 text-[10pt] text-tertiary italic">No plan items configured</p>;
  }

  return (
    <div className="py-1">
      {groupedItems.length > 0 ? (
        <div className="px-3 pb-2 space-y-0.5">
          {groupedItems.map(({ catKey, tag }) => {
            const meta = CATEGORY_META[catKey as PlanBlockKey];
            const CatIcon = meta.icon;
            return (
              <button
                key={`${catKey}-${tag}`}
                type="button"
                onClick={() => onToggleTag(catKey, tag)}
                className="flex items-center gap-2.5 w-full text-left py-1.5 px-2 rounded-lg transition-colors active:scale-[0.98] hover:bg-tertiary/5"
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${meta.bg}`}>
                  <CatIcon size={11} className={meta.color} />
                </div>
                <span className="text-sm text-primary min-w-0 truncate">{tag}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="px-4 py-4 text-[10pt] text-tertiary italic">
          {filter ? 'No matches' : 'No items available'}
        </p>
      )}
    </div>
  );
};
