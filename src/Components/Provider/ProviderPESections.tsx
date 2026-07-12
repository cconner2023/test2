import { useState, useRef, useCallback } from 'react';
import { Check, Plus, GripVertical, MoreHorizontal, RotateCcw, Trash2, ChevronLeft, ChevronRight, AlertTriangle, PenLine, List } from 'lucide-react';
import { SearchInput } from '@/Components/primitives/SearchInput';
import { HeaderPill, PillButton } from '@/Components/primitives/HeaderPill';
import { ListItemRow } from '@/Components/primitives/ListItemRow';
import { EmptyState } from '@/Components/primitives/EmptyState';
import { AnchoredMenu } from '@/Components/primitives/LiftedRowMenu';
import type { ContextMenuItem } from '@/Components/primitives/ContextMenu';
import { ExamBlockPreview } from '../ExamBlockPreview';
import { generatePEText } from '../PhysicalExam';
import { type StackScreen, type StackNav } from '../stackNav';
import {
  MASTER_BLOCKS_TOP_LEVEL,
  MASTER_BLOCK_LIBRARY,
  MSK_CHILD_KEYS,
  getMasterBlockByKey,
  getBlocksForTemplate,
  applySpecify,
} from '../../Data/PhysicalExamData';
import type { MasterPEBlock, PEBlock } from '../../Data/PhysicalExamData';
import type { PEState, PEItemState } from '../../Types/PETypes';

// ── Item-state helpers (pure; re-expressed from PhysicalExam's block mutators) ──

function defaultItemState(): PEItemState {
  return { status: 'not-examined', selectedNormals: [], selectedAbnormals: [], specifyDetails: {}, findings: '' };
}

function allNormalState(block: PEBlock): PEItemState {
  return { status: 'normal', selectedNormals: block.findings.filter(f => f.normal).map(f => f.key), selectedAbnormals: [], specifyDetails: {}, findings: '' };
}

function allAbnormalState(block: PEBlock): PEItemState {
  return { status: 'abnormal', selectedNormals: [], selectedAbnormals: block.findings.flatMap(f => f.abnormals.map(a => a.key)), specifyDetails: {}, findings: '' };
}

/** All findings visible (template mode = fully expanded), stripped to the PEBlock view shape. */
function toViewBlock(block: MasterPEBlock): PEBlock {
  return { key: block.key, label: block.label, findings: block.findings.map(({ key, normal, abnormals }) => ({ key, normal, abnormals })) };
}

function recomputeStatus(selectedNormals: string[], selectedAbnormals: string[], findings: string): PEItemState['status'] {
  const hasAbnormal = selectedAbnormals.length > 0 || findings.trim().length > 0;
  return hasAbnormal ? 'abnormal' : selectedNormals.length > 0 ? 'normal' : 'not-examined';
}

/** Toggle a normal chip — selecting a normal clears that finding's abnormals. */
function toggleNormal(state: PEItemState, block: PEBlock, findingKey: string): PEItemState {
  const wasSelected = state.selectedNormals.includes(findingKey);
  const selectedNormals = wasSelected
    ? state.selectedNormals.filter(k => k !== findingKey)
    : [...state.selectedNormals, findingKey];
  let selectedAbnormals = state.selectedAbnormals;
  if (!wasSelected) {
    const finding = block.findings.find(f => f.key === findingKey);
    if (finding) {
      const abnKeys = new Set(finding.abnormals.map(a => a.key));
      selectedAbnormals = selectedAbnormals.filter(k => !abnKeys.has(k));
    }
  }
  return { ...state, selectedNormals, selectedAbnormals, status: recomputeStatus(selectedNormals, selectedAbnormals, state.findings) };
}

/** Toggle an abnormal chip — selecting an abnormal clears its finding's normal. */
function toggleAbnormal(state: PEItemState, block: PEBlock, abnormalKey: string): PEItemState {
  const wasSelected = state.selectedAbnormals.includes(abnormalKey);
  const selectedAbnormals = wasSelected
    ? state.selectedAbnormals.filter(k => k !== abnormalKey)
    : [...state.selectedAbnormals, abnormalKey];
  let selectedNormals = state.selectedNormals;
  if (!wasSelected) {
    const finding = block.findings.find(f => f.abnormals.some(a => a.key === abnormalKey));
    if (finding?.normal) selectedNormals = selectedNormals.filter(k => k !== finding.key);
  }
  return { ...state, selectedNormals, selectedAbnormals, status: recomputeStatus(selectedNormals, selectedAbnormals, state.findings) };
}

function setSpecify(state: PEItemState, abnormalKey: string, value: string): PEItemState {
  return { ...state, specifyDetails: { ...(state.specifyDetails ?? {}), [abnormalKey]: value } };
}

/** One-line summary of a block's selected findings (for the drill row subtitle). */
function summarize(block: PEBlock, state: PEItemState): { normals: string[]; abnormals: string[] } {
  const normals: string[] = [];
  const abnormals: string[] = [];
  for (const finding of block.findings) {
    if (finding.normal && state.selectedNormals.includes(finding.key)) normals.push(finding.normal);
    for (const abn of finding.abnormals) {
      if (state.selectedAbnormals.includes(abn.key)) abnormals.push(applySpecify(abn.label, state.specifyDetails?.[abn.key]));
    }
  }
  if (state.findings.trim()) abnormals.push(state.findings.trim());
  return { normals, abnormals };
}

// ── System selector — the block picker's plain list, lifted out of PhysicalExam's
//    PreviewOverlay closure. No card chrome; owns its own search. ───────────────

function PESystemSelector({ selectedKeys, onToggle }: {
  selectedKeys: string[];
  onToggle: (key: string) => void;
}) {
  const [filter, setFilter] = useState('');
  const lc = filter.trim().toLowerCase();
  const tl = lc ? MASTER_BLOCKS_TOP_LEVEL.filter(b => b.label.toLowerCase().includes(lc)) : MASTER_BLOCKS_TOP_LEVEL;
  const childMatch = lc ? MSK_CHILD_KEYS.filter(k => MASTER_BLOCK_LIBRARY[k]?.label.toLowerCase().includes(lc)) : [];
  const showMsk = tl.some(b => b.key === 'msk') || childMatch.length > 0;
  const blocks = showMsk && !tl.some(b => b.key === 'msk') ? [...tl, MASTER_BLOCK_LIBRARY['msk']!] : tl;

  return (
    <div>
      <div className="px-1 pb-2">
        <SearchInput value={filter} onChange={setFilter} placeholder="Search systems" className="w-full" />
      </div>
      <div className="flex flex-col py-1">
        {blocks.map(block => {
          if (!block) return null;
          const selected = selectedKeys.includes(block.key);
          return (
            <div key={block.key}>
              <button
                type="button"
                onClick={() => onToggle(block.key)}
                className={`group w-full flex items-center gap-2 py-2 pl-4 pr-4 text-left transition-colors border-l-2 ${
                  selected ? 'border-l-themeblue3 bg-themeblue3/8' : 'border-l-transparent hover:bg-secondary/5'
                }`}
              >
                <span className="flex-1 min-w-0 text-[10pt] font-medium text-primary truncate">{block.label}</span>
                {selected && <Check size={15} strokeWidth={2.5} className="shrink-0 text-themeblue3" />}
              </button>
              {block.key === 'msk' && selected && MSK_CHILD_KEYS
                .filter(k => !lc || MASTER_BLOCK_LIBRARY[k]?.label.toLowerCase().includes(lc))
                .map(childKey => {
                  const child = MASTER_BLOCK_LIBRARY[childKey];
                  if (!child) return null;
                  const childSel = selectedKeys.includes(childKey);
                  return (
                    <button
                      key={childKey}
                      type="button"
                      onClick={() => onToggle(childKey)}
                      className={`group w-full flex items-center gap-2 py-2 pl-8 pr-4 text-left transition-colors border-l-2 ${
                        childSel ? 'border-l-themeblue3 bg-themeblue3/8' : 'border-l-transparent hover:bg-secondary/5'
                      }`}
                    >
                      <span className="flex-1 min-w-0 text-[9pt] font-medium text-secondary truncate">{child.label}</span>
                      {childSel && <Check size={14} strokeWidth={2.5} className="shrink-0 text-themeblue3" />}
                    </button>
                  );
                })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Center (MAIN pane) — the selected systems as movable cards (grip = drag
//    reorder). Tap a card to open that system's findings in the right pane.
//    Ported from PhysicalExam's ExamItemRow + pointer-drag reorder. ──────────────

function PEDetailRow({ block, state, index, isDragging, dragOffset, onDragStart, onTap }: {
  block: PEBlock;
  state: PEItemState;
  index: number;
  isDragging: boolean;
  dragOffset: number;
  onDragStart: (index: number, e: React.PointerEvent) => void;
  onTap: (blockKey: string) => void;
}) {
  const { normals, abnormals } = summarize(block, state);
  const hasSummary = state.status !== 'not-examined' && (normals.length > 0 || abnormals.length > 0);
  return (
    <div
      data-block-row
      style={isDragging ? { transform: `translateY(${dragOffset}px)`, zIndex: 50, position: 'relative' } : undefined}
      className={isDragging ? 'opacity-80 shadow-lg rounded-lg bg-themewhite2' : ''}
    >
      <ListItemRow
        as="div"
        onClick={() => onTap(block.key)}
        className="py-2.5 active:scale-[0.98] transition-all cursor-pointer"
        left={
          <div
            className="shrink-0 text-tertiary touch-none cursor-grab active:cursor-grabbing"
            onPointerDown={(e) => onDragStart(index, e)}
          >
            <GripVertical size={16} />
          </div>
        }
        center={
          <>
            <p className="text-sm font-medium text-primary truncate">{block.label}</p>
            {hasSummary && (
              <p className="text-[9pt] mt-0.5 whitespace-normal break-words">
                {normals.length > 0 && <span className="text-tertiary">{normals.join(', ')}</span>}
                {normals.length > 0 && abnormals.length > 0 && <span className="text-tertiary"> · </span>}
                {abnormals.length > 0 && <span className="text-primary font-medium">{abnormals.join(', ')}</span>}
              </p>
            )}
          </>
        }
      />
    </div>
  );
}

function PEDetailList({ blocks, items, onTap, onReorder }: {
  blocks: MasterPEBlock[];
  items: Record<string, PEItemState>;
  onTap: (blockKey: string) => void;
  onReorder: (keys: string[]) => void;
}) {
  const dragStateRef = useRef<{ dragIndex: number; currentIndex: number; startY: number; itemHeight: number } | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

  const handleDragStart = useCallback((index: number, e: React.PointerEvent) => {
    const target = (e.currentTarget as HTMLElement).closest('[data-block-row]') as HTMLElement | null;
    if (!target) return;
    dragStateRef.current = { dragIndex: index, currentIndex: index, startY: e.clientY, itemHeight: target.getBoundingClientRect().height };
    setDragIndex(index);
    setDragOffset(0);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handleDragMove = useCallback((e: React.PointerEvent) => {
    const ds = dragStateRef.current;
    if (!ds) return;
    const dy = e.clientY - ds.startY;
    setDragOffset(dy);
    const shift = Math.round(dy / ds.itemHeight);
    ds.currentIndex = Math.max(0, Math.min(blocks.length - 1, ds.dragIndex + shift));
  }, [blocks.length]);

  const handleDragEnd = useCallback(() => {
    const ds = dragStateRef.current;
    if (ds && ds.dragIndex !== ds.currentIndex) {
      const keys = blocks.map(b => b.key);
      const [moved] = keys.splice(ds.dragIndex, 1);
      keys.splice(ds.currentIndex, 0, moved);
      onReorder(keys);
    }
    dragStateRef.current = null;
    setDragIndex(null);
    setDragOffset(0);
  }, [blocks, onReorder]);

  return (
    <div onPointerMove={handleDragMove} onPointerUp={handleDragEnd} onPointerCancel={handleDragEnd}>
      {blocks.map((block, i) => (
        <PEDetailRow
          key={block.key}
          block={toViewBlock(block)}
          state={items[block.key] ?? defaultItemState()}
          index={i}
          isDragging={dragIndex === i}
          dragOffset={dragIndex === i ? dragOffset : 0}
          onDragStart={handleDragStart}
          onTap={onTap}
        />
      ))}
    </div>
  );
}

/**
 * PE section for the desktop center ("main" pane). Once systems are selected they
 * render as movable cards here (drag to reorder); tapping a card opens that
 * system's findings in the right pane. The dashed "+" opens the system selector.
 */
export function PECenter({ selectedBlockKeys, items, onOpenSelector, onOpenBlock, onReorder }: {
  selectedBlockKeys: string[];
  items: Record<string, PEItemState>;
  onOpenSelector: () => void;
  onOpenBlock: (blockKey: string) => void;
  onReorder: (keys: string[]) => void;
}) {
  const blocks = getBlocksForTemplate(selectedBlockKeys);
  return (
    <div className="space-y-3 md:space-y-2">
      <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider">Physical Exam</p>
      {blocks.length > 0 && (
        <PEDetailList blocks={blocks} items={items} onTap={onOpenBlock} onReorder={onReorder} />
      )}
      <EmptyState
        title={blocks.length ? 'Add system' : 'Add physical exam'}
        action={{ icon: Plus, label: blocks.length ? 'Add system' : 'Add physical exam', onClick: () => onOpenSelector() }}
      />
    </div>
  );
}

// Header ellipsis for the findings screen — Refresh (reset block) + Remove.
function PEBlockMenu({ isFreeText, onAllNormal, onAllAbnormal, onToggleFreeText, onRefresh, onRemove }: {
  isFreeText: boolean;
  onAllNormal: () => void;
  onAllAbnormal: () => void;
  onToggleFreeText: () => void;
  onRefresh: () => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  // All Normal / All Abnormal fold in here (the old in-block tap-bar); free-text
  // mode collapses them to a single "Structured findings" switch-back.
  const findingItems: ContextMenuItem[] = isFreeText
    ? [{ key: 'structured', label: 'Structured findings', icon: List, onAction: onToggleFreeText }]
    : [
        { key: 'allNormal', label: 'All Normal', icon: Check, onAction: onAllNormal },
        { key: 'allAbnormal', label: 'All Abnormal', icon: AlertTriangle, onAction: onAllAbnormal },
        { key: 'freetext', label: 'Free text', icon: PenLine, onAction: onToggleFreeText },
      ];
  const items: ContextMenuItem[] = [
    ...findingItems,
    { key: 'refresh', label: 'Refresh', icon: RotateCcw, onAction: onRefresh },
    { key: 'remove', label: 'Remove', icon: Trash2, destructive: true, onAction: onRemove },
  ];
  return (
    <>
      <div ref={anchor} className="flex">
        <HeaderPill>
          <PillButton icon={MoreHorizontal} iconSize={18} label="Block actions" onClick={() => setOpen(true)} />
        </HeaderPill>
      </div>
      <AnchoredMenu isOpen={open} anchorRef={anchor} layout="list" align="left" onClose={() => setOpen(false)} items={items} />
    </>
  );
}

// ── Pane screens: `s-pe` (select systems) → `s-pe-block` (findings) ──

const FRESH_PE_STATE: PEState = {
  categoryLetter: 'A', laterality: 'right', spineRegion: 'lumbar',
  items: {}, vitals: {}, additional: '', mode: 'template', blockKeys: [],
};

/** Seed a template-mode PEState from stored block keys + per-system findings. */
export function makeTemplatePEState(blockKeys: string[], items: Record<string, PEItemState>): PEState {
  return { ...FRESH_PE_STATE, items, blockKeys, blockOrder: blockKeys };
}

export function usePEPaneScreens({
  peState, selectedBlockKeys, onPeStateChange, onBlockKeysChange, onPeNoteChange, onClose, keyPrefix = '',
}: {
  peState: PEState | null;
  selectedBlockKeys: string[];
  onPeStateChange: (s: PEState) => void;
  onBlockKeysChange: (keys: string[]) => void;
  onPeNoteChange: (text: string) => void;
  /** Close the right pane — the selector's Accept + a findings screen's Done. */
  onClose: () => void;
  /** Namespaces the screen keys so a host stack can merge two instances (note vs
   *  template) without collision. Internal nav.replace targets use it too. */
  keyPrefix?: string;
}): { screens: Record<string, StackScreen>; reorder: (keys: string[]) => void } {
  const base = peState ?? FRESH_PE_STATE;
  const SELECT_KEY = `${keyPrefix}s-pe`;
  const BLOCK_KEY = `${keyPrefix}s-pe-block`;

  // Commit a next peState: keep items/blockKeys aligned + re-derive peNote.
  const commit = (items: Record<string, PEItemState>, blockKeys: string[]) => {
    const next: PEState = { ...base, items, blockKeys, blockOrder: blockKeys, mode: 'template' };
    onPeStateChange(next);
    onBlockKeysChange(blockKeys);
    onPeNoteChange(generatePEText(next));
  };

  const toggleSystem = (key: string) => {
    if (selectedBlockKeys.includes(key)) {
      const blockKeys = selectedBlockKeys.filter(k => k !== key);
      const items = { ...base.items };
      delete items[key];
      commit(items, blockKeys);
    } else {
      commit({ ...base.items, [key]: defaultItemState() }, [...selectedBlockKeys, key]);
    }
  };

  const applyItem = (blockKey: string, nextState: PEItemState) => {
    commit({ ...base.items, [blockKey]: nextState }, selectedBlockKeys);
  };

  // Free-text mode (per block) — the whole system's PE portion as one narrative,
  // bound to PEItemState.findings. Seeded from stored state (free-text findings +
  // no chip selections), toggled thereafter from the header ellipsis.
  const [freeTextKeys, setFreeTextKeys] = useState<Set<string>>(() => {
    const s = new Set<string>();
    for (const [key, st] of Object.entries(base.items)) {
      if (st.findings.trim() && st.selectedNormals.length === 0 && st.selectedAbnormals.length === 0) s.add(key);
    }
    return s;
  });

  const toggleFreeText = (blockKey: string) => {
    const next = new Set(freeTextKeys);
    if (next.has(blockKey)) {
      next.delete(blockKey);
    } else {
      next.add(blockKey);
      // Entering free text drops chip selections — findings owns the line now.
      const cur = base.items[blockKey] ?? defaultItemState();
      applyItem(blockKey, { ...cur, selectedNormals: [], selectedAbnormals: [], specifyDetails: {}, status: cur.findings.trim() ? 'abnormal' : 'not-examined' });
    }
    setFreeTextKeys(next);
  };

  const setFreeTextValue = (blockKey: string, value: string) => {
    const cur = base.items[blockKey] ?? defaultItemState();
    applyItem(blockKey, { ...cur, findings: value, selectedNormals: [], selectedAbnormals: [], status: value.trim() ? 'abnormal' : 'not-examined' });
  };

  // Drag reorder (from the center cards) — the selected-systems order drives both
  // the card list and the generated exam text (generatePEText iterates blockKeys).
  const reorder = (keys: string[]) => commit(base.items, keys);

  // Remove a system from the findings screen — deselect it, then advance to the
  // next remaining system (or close back to the center if it was the last).
  const removeSystem = (blockKey: string, nav: StackNav) => {
    const idx = selectedBlockKeys.indexOf(blockKey);
    const remaining = selectedBlockKeys.filter(k => k !== blockKey);
    const items = { ...base.items };
    delete items[blockKey];
    commit(items, remaining);
    if (remaining.length === 0) onClose();
    else nav.replace(BLOCK_KEY, { blockKey: remaining[Math.min(idx, remaining.length - 1)] });
  };

  const screens: Record<string, StackScreen> = {
    // Select systems — tree-item rows, checkmark when selected. Header ✓ accepts
    // the selection and returns to the center (which now shows the movable cards).
    [SELECT_KEY]: {
      title: 'Physical Exam',
      headerActions: (
        <PillButton icon={Check} iconSize={18} accent="success" onClick={onClose} label="Accept" />
      ),
      render: () => <PESystemSelector selectedKeys={selectedBlockKeys} onToggle={toggleSystem} />,
    },
    [BLOCK_KEY]: {
      title: (p: { blockKey: string }) => getMasterBlockByKey(p?.blockKey)?.label ?? 'System',
      // Ellipsis (All Normal · All Abnormal · Free text · Refresh · Remove) rides the
      // header's LEFT, matching the ellipsis-left convention; progression ‹ › are
      // header icons on the right beside Close.
      headerLeft: (p: { blockKey: string }, nav: StackNav) => {
        const master = getMasterBlockByKey(p.blockKey);
        if (!master) return null;
        const view = toViewBlock(master);
        return (
          <PEBlockMenu
            isFreeText={freeTextKeys.has(p.blockKey)}
            onAllNormal={() => applyItem(p.blockKey, allNormalState(view))}
            onAllAbnormal={() => applyItem(p.blockKey, allAbnormalState(view))}
            onToggleFreeText={() => toggleFreeText(p.blockKey)}
            onRefresh={() => applyItem(p.blockKey, defaultItemState())}
            onRemove={() => removeSystem(p.blockKey, nav)}
          />
        );
      },
      headerActions: (p: { blockKey: string }, nav: StackNav) => {
        const idx = selectedBlockKeys.indexOf(p.blockKey);
        const hasPrev = idx > 0;
        const hasNext = idx >= 0 && idx < selectedBlockKeys.length - 1;
        return (
          <>
            {hasPrev && (
              <PillButton icon={ChevronLeft} iconSize={18} label="Previous system"
                onClick={() => nav.replace(BLOCK_KEY, { blockKey: selectedBlockKeys[idx - 1] })} />
            )}
            {hasNext && (
              <PillButton icon={ChevronRight} iconSize={18} label="Next system"
                onClick={() => nav.replace(BLOCK_KEY, { blockKey: selectedBlockKeys[idx + 1] })} />
            )}
          </>
        );
      },
      render: (p: { blockKey: string }) => {
        const master = getMasterBlockByKey(p.blockKey);
        if (!master) return null;
        const view = toViewBlock(master);
        const st = base.items[p.blockKey] ?? defaultItemState();
        return (
          <ExamBlockPreview
            block={view}
            state={{ ...st, specifyDetails: st.specifyDetails ?? {} }}
            freeText={freeTextKeys.has(p.blockKey)}
            onFreeTextChange={v => setFreeTextValue(p.blockKey, v)}
            onToggleNormal={fk => applyItem(p.blockKey, toggleNormal(st, view, fk))}
            onToggleAbnormal={ak => applyItem(p.blockKey, toggleAbnormal(st, view, ak))}
            onSpecifyChange={(ak, v) => applyItem(p.blockKey, setSpecify(st, ak, v))}
          />
        );
      },
    },
  };

  return { screens, reorder };
}
