import React, { useMemo, useState, useRef, useCallback } from 'react';

import { GripVertical, X } from 'lucide-react';
import type { PlanOrderSet } from '../Data/User';

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
  onReorderTag: (categoryKey: string, fromIndex: number, toIndex: number) => void;
  orderSets?: PlanOrderSet[];
  activeSetIds?: Set<string>;
  onToggleOrderSet?: (os: PlanOrderSet) => void;
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
        className="shrink-0 px-2.5 py-2 text-[10px] font-medium text-tertiary/60 bg-tertiary/5 rounded-full border border-tertiary/15 transition-colors active:scale-95"
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
  onReorderTag,
  orderSets = [],
  activeSetIds,
  onToggleOrderSet,
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
  const { selectedTags, availableItems, crossCategoryResults } = useMemo(() => {
    if (!activeCat) return { selectedTags: [], availableItems: [], crossCategoryResults: [] };

    // Active tab's selected items (always visible)
    const selected = activeCat.state.selectedTags;
    const selectedSet = new Set(selected);
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

    return { selectedTags: selected, availableItems: available, crossCategoryResults: crossResults };
  }, [activeCat, lc, categories]);

  // ── Drag state for selected item reorder ──
  const dragRef = useRef<{
    index: number;
    currentIndex: number;
    startY: number;
    itemHeight: number;
  } | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

  const handleDragStart = useCallback((index: number, e: React.PointerEvent) => {
    const row = (e.currentTarget as HTMLElement).closest('[data-tag-row]') as HTMLElement | null;
    if (!row) return;
    dragRef.current = {
      index,
      currentIndex: index,
      startY: e.clientY,
      itemHeight: row.getBoundingClientRect().height,
    };
    setDragIndex(index);
    setDragOffset(0);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handleDragMove = useCallback((e: React.PointerEvent) => {
    const ds = dragRef.current;
    if (!ds) return;
    const dy = e.clientY - ds.startY;
    setDragOffset(dy);
    ds.currentIndex = Math.max(0, Math.min(selectedTags.length - 1, ds.index + Math.round(dy / ds.itemHeight)));
  }, [selectedTags.length]);

  const handleDragEnd = useCallback(() => {
    const ds = dragRef.current;
    if (ds && ds.index !== ds.currentIndex && activeCat) {
      onReorderTag(activeCat.key, ds.index, ds.currentIndex);
    }
    dragRef.current = null;
    setDragIndex(null);
    setDragOffset(0);
  }, [activeCat, onReorderTag]);

  // Order sets
  const showOrderSets = orderSets.length > 0 && !!onToggleOrderSet;
  const filteredOrderSets = useMemo(() => {
    if (!lc) return orderSets;
    return orderSets.filter(os => os.name.toLowerCase().includes(lc));
  }, [orderSets, lc]);

  if (availableTabs.length === 0 && !showOrderSets) {
    return <p className="px-4 py-4 text-[10pt] text-tertiary/40 italic">No plan items configured</p>;
  }

  return (
    <div className="py-1">
      {/* Order Sets — above tabs, always accessible */}
      {showOrderSets && filteredOrderSets.length > 0 && (
        <div className="px-4 pt-2 pb-2 border-b border-tertiary/8">
          <p className="text-[9px] font-semibold text-tertiary/40 uppercase tracking-wider mb-1.5">Order Sets</p>
          <div className="flex flex-wrap gap-1.5">
            {filteredOrderSets.map(os => {
              const isActive = activeSetIds?.has(os.id) ?? false;
              return (
                <button
                  key={os.id}
                  type="button"
                  onClick={() => onToggleOrderSet!(os)}
                  className={`px-2.5 py-1 text-[10pt] rounded-full transition-colors active:scale-95 ${
                    isActive
                      ? 'bg-tertiary/8 text-primary font-medium'
                      : 'bg-tertiary/5 text-tertiary/40'
                  }`}
                >
                  {os.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab bar — scrollable on mobile */}
      <div className="px-3 pt-2.5 pb-2 flex overflow-x-auto gap-1" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
        {availableTabs.map(cat => {
          const isActive = activeCat?.key === cat.key;
          const hasSelected = cat.state.selectedTags.length > 0;
          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => onTabChange(cat.key)}
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

      {/* Active section content */}
      {activeCat && (
        <div>
          {/* Selected items — drag to reorder */}
          {selectedTags.length > 0 && (
            <div
              className="px-4 pb-2"
              onPointerMove={handleDragMove}
              onPointerUp={handleDragEnd}
              onPointerCancel={handleDragEnd}
            >
              <div className="border border-tertiary/10 rounded-xl overflow-hidden">
                {selectedTags.map((tag, i) => {
                  const isDragging = dragIndex === i;
                  return (
                    <div
                      key={tag}
                      data-tag-row
                      style={isDragging ? { transform: `translateY(${dragOffset}px)`, zIndex: 50, position: 'relative' } : undefined}
                      className={`flex items-center gap-2 px-3 py-2.5 bg-tertiary/4 ${
                        i > 0 ? 'border-t border-tertiary/10' : ''
                      } ${isDragging ? 'opacity-80 shadow-lg rounded-lg bg-themewhite2' : ''}`}
                    >
                      <div
                        className="shrink-0 text-tertiary/30 touch-none cursor-grab active:cursor-grabbing"
                        onPointerDown={(e) => { e.stopPropagation(); handleDragStart(i, e); }}
                      >
                        <GripVertical size={16} />
                      </div>
                      <span className="flex-1 text-[11pt] text-primary min-w-0 truncate">{tag}</span>
                      <button
                        type="button"
                        onClick={() => onToggleTag(activeCat.key, tag)}
                        className="shrink-0 p-1 text-tertiary/30 active:text-themeredred transition-colors"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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
          {selectedTags.length === 0 && availableItems.length === 0 && crossCategoryResults.length === 0 && !filter && (
            <p className="px-4 py-4 text-[10pt] text-tertiary/40 italic">No items available</p>
          )}
        </div>
      )}
    </div>
  );
};
