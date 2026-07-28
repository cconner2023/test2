import { useState, useRef, useCallback } from 'react';
import { Check, X, RotateCcw, GripVertical, MoreHorizontal, Type } from 'lucide-react';
import { SearchInput } from '@/Components/primitives/SearchInput';
import { HeaderPill, PillButton } from '@/Components/primitives/HeaderPill';
import { AnchoredMenu } from '@/Components/primitives/LiftedRowMenu';
import type { ContextMenuItem } from '@/Components/primitives/ContextMenu';
import { Chip, ChipBar } from '@/Components/primitives/Chip';
import { TextSectionEditor } from './ProviderPaneSections';
import { PlanAllBlocksPreview } from '../PlanBlockPreview';
import { generatePlanText } from '../Plan';
import { type StackScreen } from '../stackNav';
import { PLAN_ORDER_CATEGORIES, PLAN_ORDER_LABELS } from '../../Data/User';
import type { PlanBlockKey, PlanOrderSet, PlanOrderTags } from '../../Data/User';
import type { MergedPlanOrderSet } from '../../Hooks/useMergedNoteContent';
import type { PlanState, PlanBlockState } from '../../Types/PlanTypes';

// Display order: meds → lab → radiology → referral → instructions → followUp
// (matches Plan.tsx's ALL_BLOCK_KEYS).
const ALL_BLOCK_KEYS: PlanBlockKey[] = [
  ...PLAN_ORDER_CATEGORIES.filter(k => k !== 'followUp'),
  'instructions',
  'followUp',
];

const BLOCK_LABELS: Record<PlanBlockKey, string> = { ...PLAN_ORDER_LABELS, instructions: 'Instructions' };

// ── State helpers (pure; re-expressed from Plan's block mutators) ──

function defaultBlockState(): PlanBlockState {
  return { status: 'inactive', selectedTags: [], freeText: '' };
}

function freshStates(): Record<PlanBlockKey, PlanBlockState> {
  return {
    referral: defaultBlockState(), meds: defaultBlockState(), radiology: defaultBlockState(),
    lab: defaultBlockState(), followUp: defaultBlockState(), instructions: defaultBlockState(),
  };
}

function emptyCustomTags(): Record<PlanBlockKey, string[]> {
  return { referral: [], meds: [], radiology: [], lab: [], followUp: [], instructions: [] };
}

export function freshPlanState(): PlanState {
  return { states: freshStates(), customTags: emptyCustomTags(), activeSetIds: [], blockOrder: [] };
}

export const FRESH_PLAN_STATE: PlanState = freshPlanState();

/** Configured + custom tags per category — what the picker shows. */
function allTagsFor(
  ps: PlanState, orderTags: PlanOrderTags, instructionTags: string[],
): Record<PlanBlockKey, string[]> {
  const base: Record<PlanBlockKey, string[]> = {
    referral: orderTags.referral, meds: orderTags.meds, radiology: orderTags.radiology,
    lab: orderTags.lab, followUp: orderTags.followUp, instructions: instructionTags,
  };
  for (const key of ALL_BLOCK_KEYS) {
    if (ps.customTags[key].length > 0) base[key] = [...base[key], ...ps.customTags[key]];
  }
  return base;
}

function ensureOrdered(blockOrder: PlanBlockKey[], key: PlanBlockKey): PlanBlockKey[] {
  return blockOrder.includes(key) ? blockOrder : [...blockOrder, key];
}

/** Toggle a single item within a category (add / remove). generatePlanText iterates
 *  blockOrder, so a newly-touched category must be appended there or its line drops. */
function toggleTag(ps: PlanState, key: PlanBlockKey, tag: string): PlanState {
  const current = ps.states[key].selectedTags;
  const selectedTags = current.includes(tag) ? current.filter(t => t !== tag) : [...current, tag];
  return {
    ...ps,
    states: { ...ps.states, [key]: { ...ps.states[key], selectedTags, status: selectedTags.length ? 'active' : 'inactive' } },
    blockOrder: ensureOrdered(ps.blockOrder, key),
  };
}

/** Reorder a selected item within its category (drag-rearrange). */
function reorderTag(ps: PlanState, key: PlanBlockKey, from: number, to: number): PlanState {
  const tags = [...ps.states[key].selectedTags];
  const [moved] = tags.splice(from, 1);
  tags.splice(to, 0, moved);
  return { ...ps, states: { ...ps.states, [key]: { ...ps.states[key], selectedTags: tags } } };
}

/** Apply / un-apply an order set — unions (or removes) its preset items across categories. */
export function applyOrderSet(ps: PlanState, os: PlanOrderSet): PlanState {
  const isActive = ps.activeSetIds.includes(os.id);
  const states = { ...ps.states };
  let blockOrder = ps.blockOrder;
  for (const key of ALL_BLOCK_KEYS) {
    const preset = os.presets[key];
    if (!preset || preset.length === 0) continue;
    if (isActive) {
      const remaining = states[key].selectedTags.filter(t => !preset.includes(t));
      states[key] = { ...states[key], selectedTags: remaining, status: remaining.length ? 'active' : 'inactive' };
    } else {
      const merged = [...new Set([...states[key].selectedTags, ...preset])];
      states[key] = { ...states[key], selectedTags: merged, status: 'active' };
      blockOrder = ensureOrdered(blockOrder, key);
    }
  }
  return {
    ...ps,
    states,
    blockOrder,
    activeSetIds: isActive ? ps.activeSetIds.filter(id => id !== os.id) : [...ps.activeSetIds, os.id],
  };
}

// ── Selected list — flat, cross-category, grip-drag to rearrange (within a
//    category) + X to remove. Ported from Plan's ActiveItemsCard. ────────────────

interface SelectedEntry { catKey: PlanBlockKey; tag: string }

function SelectedList({ items, onReorder, onRemove }: {
  items: SelectedEntry[];
  onReorder: (catKey: PlanBlockKey, from: number, to: number) => void;
  onRemove: (catKey: PlanBlockKey, tag: string) => void;
}) {
  const dragRef = useRef<{ index: number; currentIndex: number; startY: number; itemHeight: number } | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

  const handleDragStart = useCallback((index: number, e: React.PointerEvent) => {
    const row = (e.currentTarget as HTMLElement).closest('[data-selected-row]') as HTMLElement | null;
    if (!row) return;
    dragRef.current = { index, currentIndex: index, startY: e.clientY, itemHeight: row.getBoundingClientRect().height };
    setDragIndex(index);
    setDragOffset(0);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handleDragMove = useCallback((e: React.PointerEvent) => {
    const ds = dragRef.current;
    if (!ds) return;
    const dy = e.clientY - ds.startY;
    setDragOffset(dy);
    ds.currentIndex = Math.max(0, Math.min(items.length - 1, ds.index + Math.round(dy / ds.itemHeight)));
  }, [items.length]);

  const handleDragEnd = useCallback(() => {
    const ds = dragRef.current;
    if (ds && ds.index !== ds.currentIndex) {
      const dragged = items[ds.index];
      const target = items[ds.currentIndex];
      // Reorder only within the same category (output regroups by category anyway).
      if (dragged.catKey === target.catKey) {
        const catItems = items.filter(x => x.catKey === dragged.catKey);
        const from = catItems.findIndex(x => x.tag === dragged.tag);
        const to = catItems.findIndex(x => x.tag === target.tag);
        if (from !== -1 && to !== -1) onReorder(dragged.catKey, from, to);
      }
    }
    dragRef.current = null;
    setDragIndex(null);
    setDragOffset(0);
  }, [items, onReorder]);

  return (
    <div onPointerMove={handleDragMove} onPointerUp={handleDragEnd} onPointerCancel={handleDragEnd}>
      {items.map((it, i) => {
        const isDragging = dragIndex === i;
        return (
          <div
            key={`${it.catKey}-${it.tag}`}
            data-selected-row
            style={isDragging ? { transform: `translateY(${dragOffset}px)`, zIndex: 50, position: 'relative' } : undefined}
            className={`flex items-center gap-2 py-1.5 ${isDragging ? 'opacity-80 shadow-lg rounded-lg bg-themewhite2' : ''}`}
          >
            <div
              className="shrink-0 text-tertiary touch-none cursor-grab active:cursor-grabbing"
              onPointerDown={(e) => { e.stopPropagation(); handleDragStart(i, e); }}
            >
              <GripVertical size={16} />
            </div>
            <span className="flex-1 text-sm text-primary break-words min-w-0">{it.tag}</span>
            <button
              type="button"
              onClick={() => onRemove(it.catKey, it.tag)}
              className="shrink-0 p-1 text-tertiary active:text-themeredred transition-colors"
              aria-label={`Remove ${it.tag}`}
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ── Editor body — modeled on OrderSetEditPopover ("creating an order set"): search
//    (+ custom add) on top → order-set chips → Selected list → all-category picker.
//    Category is implicit (each tag knows its category). ─────────────────────────

function PlanEditorBody({ planState, orderSets, allTags, showFreeText, onToggleTag, onReorderTag, onApplyOrderSet, onAdditionalChange }: {
  planState: PlanState;
  orderSets: MergedPlanOrderSet[];
  allTags: Record<PlanBlockKey, string[]>;
  /** Header ellipsis "Free text" reveals the block; once it holds text it stays open. */
  showFreeText: boolean;
  onToggleTag: (key: PlanBlockKey, tag: string) => void;
  onReorderTag: (key: PlanBlockKey, from: number, to: number) => void;
  onApplyOrderSet: (os: PlanOrderSet) => void;
  onAdditionalChange: (value: string) => void;
}) {
  const [search, setSearch] = useState('');
  const additional = planState.additional ?? '';
  const freeTextOpen = showFreeText || !!additional.trim();

  const selectedFlat: SelectedEntry[] = ALL_BLOCK_KEYS.flatMap(key =>
    planState.states[key].selectedTags.map(tag => ({ catKey: key, tag })),
  );

  const categories = ALL_BLOCK_KEYS.map(key => ({
    key, label: BLOCK_LABELS[key], tags: allTags[key], state: planState.states[key],
  }));

  return (
    <div className="space-y-3">
      {/* Search on top. Free-text + Reset now live in the header ellipsis (left of title). */}
      <SearchInput value={search} onChange={setSearch} placeholder="Search items" className="w-full" />

      {/* Free-text block — the shared expander-aware section primitive (same as HPI /
          Assessment), appended to the plan. */}
      {freeTextOpen && (
        <div>
          <p className="text-[9pt] font-semibold text-tertiary uppercase tracking-widest pb-2">Free Text</p>
          <TextSectionEditor value={additional} onChange={onAdditionalChange} placeholder="Free text…" />
        </div>
      )}

      {/* Order sets — with the rest of the plan, above the picker (not the center). */}
      {orderSets.length > 0 && (
        <div>
          <p className="text-[9pt] font-semibold text-tertiary uppercase tracking-widest pb-2">Order Sets</p>
          <ChipBar bordered>
            {orderSets.map(os => {
              const active = planState.activeSetIds.includes(os.id);
              return (
                <Chip key={os.id} active={active} onClick={() => onApplyOrderSet(os)}>
                  {os.name}
                  {os.sourceCollides && (
                    <span className={`ml-1 text-[8pt] ${active ? 'text-white/80' : 'text-themeblue2/80'}`}>· {os.sourceClinicName ?? 'Personal'}</span>
                  )}
                </Chip>
              );
            })}
          </ChipBar>
        </div>
      )}

      {/* Selected items — flat, cross-category, drag to rearrange, X to remove. */}
      {selectedFlat.length > 0 && (
        <div className="border-b border-primary/6 pb-2">
          <p className="text-[9pt] font-semibold text-tertiary uppercase tracking-widest pt-1 pb-1">Selected Items</p>
          <SelectedList items={selectedFlat} onReorder={onReorderTag} onRemove={onToggleTag} />
        </div>
      )}

      {/* Available items — the all-category picker, mirroring the Order Sets / Selected headers. */}
      <div>
        <p className="text-[9pt] font-semibold text-tertiary uppercase tracking-widest pb-2">Available Items</p>
        <PlanAllBlocksPreview
          categories={categories}
          filter={search}
          onToggleTag={(k, t) => onToggleTag(k as PlanBlockKey, t)}
          activeTab={null}
        />
      </div>
    </div>
  );
}

// Header ellipsis for the plan screen — Free text (reveal block) + Reset (clear plan).
// Rides the header's LEFT (pane shell), matching the ellipsis-left convention (see
// PEBlockMenu). Overlay shells that ignore headerLeft instead feed `planHeaderMenuItems`
// into an OverlayHeaderMenu in headerActions (see ProviderTemplateEditPopover).
function PlanHeaderMenu({ items }: { items: ContextMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  return (
    <>
      <div ref={anchor} className="flex">
        <HeaderPill>
          <PillButton icon={MoreHorizontal} iconSize={18} label="Plan actions" onClick={() => setOpen(true)} />
        </HeaderPill>
      </div>
      <AnchoredMenu isOpen={open} anchorRef={anchor} layout="list" align="left" onClose={() => setOpen(false)} items={items} />
    </>
  );
}

// ── Pane screen: a single `s-plan` editor (no per-category drill) ──

export function usePlanPaneScreens({
  planState, orderTags, instructionTags, orderSets, onPlanStateChange, onPlanNoteChange, onClose,
}: {
  planState: PlanState | null;
  orderTags: PlanOrderTags;
  instructionTags: string[];
  orderSets: MergedPlanOrderSet[];
  onPlanStateChange: (s: PlanState) => void;
  onPlanNoteChange: (text: string) => void;
  /** Close the right pane (the editor's Done). */
  onClose: () => void;
}): { screens: Record<string, StackScreen>; headerMenuItems: ContextMenuItem[] } {
  const base = planState ?? FRESH_PLAN_STATE;
  const allTags = allTagsFor(base, orderTags, instructionTags);
  const [showFreeText, setShowFreeText] = useState(false);

  const commit = (next: PlanState) => {
    onPlanStateChange(next);
    onPlanNoteChange(generatePlanText(next));
  };

  // Free text (reveal block) + Reset (clear plan) — shared by the pane's headerLeft
  // ellipsis and any overlay shell that surfaces them via headerActions.
  const headerMenuItems: ContextMenuItem[] = [
    { key: 'freetext', label: 'Free text', icon: Type, onAction: () => setShowFreeText(true) },
    { key: 'reset', label: 'Reset', icon: RotateCcw, destructive: true, onAction: () => commit(freshPlanState()) },
  ];

  const screens: Record<string, StackScreen> = {
    's-plan': {
      title: 'Plan',
      // Ellipsis (Free text · Reset) rides the header's LEFT; Done joins Close on the right.
      headerLeft: (
        <PlanHeaderMenu items={headerMenuItems} />
      ),
      headerActions: (
        <PillButton icon={Check} iconSize={18} accent="success" onClick={onClose} label="Done" />
      ),
      render: () => (
        <PlanEditorBody
          planState={base}
          orderSets={orderSets}
          allTags={allTags}
          showFreeText={showFreeText}
          onToggleTag={(key, tag) => commit(toggleTag(base, key, tag))}
          onReorderTag={(key, from, to) => commit(reorderTag(base, key, from, to))}
          onApplyOrderSet={(os) => commit(applyOrderSet(base, os))}
          onAdditionalChange={(value) => commit({ ...base, additional: value })}
        />
      ),
    },
  };

  return { screens, headerMenuItems };
}
