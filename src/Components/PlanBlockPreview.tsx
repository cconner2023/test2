import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { LucideIcon } from 'lucide-react';
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

export function CategoryPicker({ value, categories, onChange, variant = 'pill' }: {
  value: string | null;
  categories: { key: string; label: string; icon?: LucideIcon; color?: string; bg?: string }[];
  onChange: (key: string | null) => void;
  variant?: 'pill' | 'icon';
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [menuRect, setMenuRect] = useState<{ top: number; bottom: number; left: number } | null>(null);

  const selected = value ? categories.find(c => c.key === value) : null;
  const label = selected?.label ?? value ?? 'All';
  const iconMode = variant === 'icon';
  const triggerCat = selected ?? (iconMode ? categories[0] : null);
  const TriggerIcon = triggerCat?.icon;

  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setMenuRect({ top: rect.top, bottom: rect.bottom, left: rect.left });
  }, [open]);

  const winW = typeof window !== 'undefined' ? window.innerWidth : 0;
  const winH = typeof window !== 'undefined' ? window.innerHeight : 0;
  const menuWidth = Math.min(280, winW * 0.8);
  const menuLeft = menuRect ? Math.max(8, Math.min(menuRect.left, winW - menuWidth - 8)) : 0;
  const spaceAbove = menuRect ? menuRect.top : 0;
  const spaceBelow = menuRect ? winH - menuRect.bottom : 0;
  const openUp = spaceAbove > spaceBelow;
  const menuBottom = menuRect ? winH - menuRect.top + 8 : 0;
  const menuTop = menuRect ? menuRect.bottom + 8 : 0;

  return (
    <div className="shrink-0">
      {iconMode && TriggerIcon ? (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(o => !o)}
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
          onClick={() => setOpen(o => !o)}
          className="shrink-0 px-2.5 py-2 text-[10pt] font-medium text-tertiary bg-tertiary/5 rounded-full border border-tertiary/15 transition-colors active:scale-95"
        >
          {label}
        </button>
      )}
      {open && menuRect && typeof document !== 'undefined' && createPortal(
        <>
          <div className="fixed inset-0 z-[200]" onClick={() => setOpen(false)} />
          <div
            className="fixed z-[201] bg-themewhite rounded-2xl shadow-xl border border-tertiary/10 py-2 overflow-y-auto"
            style={{
              left: menuLeft,
              ...(openUp ? { bottom: menuBottom } : { top: menuTop }),
              width: menuWidth,
              maxHeight: `${Math.min(0.4 * winH, (openUp ? spaceAbove : spaceBelow) - 16)}px`,
            }}
          >
            <p className="px-3 pb-1.5 text-[9pt] md:text-[9pt] font-semibold text-tertiary uppercase tracking-wider">Category</p>
            {!iconMode && (
              <button
                type="button"
                onClick={() => { onChange(null); setOpen(false); }}
                className={`w-full text-left px-4 py-2.5 text-[10pt] transition-colors active:scale-[0.98] ${
                  value === null ? 'text-primary font-medium bg-tertiary/6' : 'text-tertiary'
                }`}
              >
                All
              </button>
            )}
            {categories.map(cat => {
              const ItemIcon = cat.icon;
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => { onChange(cat.key); setOpen(false); }}
                  className={`w-full flex items-center gap-2.5 text-left px-4 py-2.5 text-[10pt] transition-colors active:scale-[0.98] ${
                    value === cat.key ? 'text-primary font-medium bg-tertiary/6' : 'text-tertiary'
                  }`}
                >
                  {iconMode && ItemIcon && (
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${cat.bg ?? 'bg-tertiary/10'}`}>
                      <ItemIcon size={11} className={cat.color ?? 'text-tertiary'} />
                    </span>
                  )}
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </>,
        document.body
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
