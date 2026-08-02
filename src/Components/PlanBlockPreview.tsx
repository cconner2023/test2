import React, { useMemo, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { PlanBlockKey } from '../Data/User';
import { CATEGORY_META } from './Settings/PlanTagManager';
import { AnchoredMenu } from '@/Components/primitives/LiftedRowMenu';
import type { ContextMenuItem } from '@/Components/primitives/ContextMenu';
import { planTagDisplay } from '@/Utilities/medTag';

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

export function CategoryPicker({ value, categories, onChange, variant = 'pill' }: {
  value: string | null;
  categories: { key: string; label: string; icon?: LucideIcon; color?: string; bg?: string }[];
  onChange: (key: string | null) => void;
  variant?: 'pill' | 'icon';
}) {
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selected = value ? categories.find(c => c.key === value) : null;
  const label = selected?.label ?? value ?? 'All';
  const iconMode = variant === 'icon';
  const triggerCat = selected ?? (iconMode ? categories[0] : null);
  const TriggerIcon = triggerCat?.icon;

  const open = () => setAnchorRect(triggerRef.current?.getBoundingClientRect() ?? null);

  // Each category keeps its colored chip via `node`; selection drives the row highlight.
  const items: ContextMenuItem[] = [
    ...(!iconMode ? [{
      key: '__all__',
      label: 'All',
      selected: value === null,
      onAction: () => onChange(null),
    }] : []),
    ...categories.map(cat => {
      const ItemIcon = cat.icon;
      return {
        key: cat.key,
        label: cat.label,
        selected: value === cat.key,
        onAction: () => onChange(cat.key),
        ...(ItemIcon ? {
          node: (
            <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${cat.bg ?? 'bg-tertiary/10'}`}>
              <ItemIcon size={11} className={cat.color ?? 'text-tertiary'} />
            </span>
          ),
        } : {}),
      } as ContextMenuItem;
    }),
  ];

  return (
    <div className="shrink-0">
      {iconMode && TriggerIcon ? (
        <button
          ref={triggerRef}
          type="button"
          onClick={open}
          aria-label={triggerCat?.label ?? label}
          title={triggerCat?.label ?? label}
          className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors active:scale-95 ${triggerCat?.bg ?? 'bg-tertiary/10'}`}
        >
          <TriggerIcon size={14} className={triggerCat?.color ?? 'text-tertiary'} />
        </button>
      ) : (
        <button
          ref={triggerRef}
          type="button"
          onClick={open}
          className="shrink-0 px-2.5 py-2 text-[10pt] font-medium text-tertiary bg-tertiary/5 rounded-full border border-tertiary/15 transition-colors active:scale-95"
        >
          {label}
        </button>
      )}
      <AnchoredMenu
        isOpen={!!anchorRect}
        anchorRect={anchorRect}
        onClose={() => setAnchorRect(null)}
        layout="list"
        header="Category"
        items={items}
      />
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
                <span className="text-sm text-primary min-w-0 truncate">{planTagDisplay(catKey, tag)}</span>
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
