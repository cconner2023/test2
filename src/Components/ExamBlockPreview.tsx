import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { TextInput } from '@/Components/primitives/FormInputs';
import type { PEBlock, PEFinding, Laterality } from '../Data/PhysicalExamData';
import { isSpecifyLabel } from '../Data/PhysicalExamData';

type SystemStatus = 'not-examined' | 'normal' | 'abnormal';

interface ItemState {
  status: SystemStatus;
  selectedNormals: string[];
  selectedAbnormals: string[];
  specifyDetails?: Record<string, string>;
  findings: string;
  laterality?: Laterality;
}

/** Custom (free-text) findings ride the per-block `findings` string, '; '-joined —
 *  the field the codec already encodes and the note text already renders. */
export function splitCustomFindings(findings: string): string[] {
  return findings.split(';').map(s => s.trim()).filter(Boolean);
}

export function addCustomFinding(findings: string, text: string): string {
  return [...splitCustomFindings(findings), text.trim()].join('; ');
}

export function removeCustomFinding(findings: string, index: number): string {
  return splitCustomFindings(findings).filter((_, i) => i !== index).join('; ');
}

const LATERALITY_OPTIONS: { value: Laterality; label: string }[] = [
  { value: 'left', label: 'L' },
  { value: 'right', label: 'R' },
  { value: 'bilateral', label: 'BILAT' },
];

interface ExamBlockPreviewProps {
  block: PEBlock;
  state: ItemState;
  filter?: string;
  onToggleNormal: (findingKey: string) => void;
  onToggleAbnormal: (abnormalKey: string) => void;
  onSpecifyChange?: (abnormalKey: string, value: string) => void;
  /** Mark every finding normal / abnormal — renders a tap row atop the block. */
  onAllNormal?: () => void;
  onAllAbnormal?: () => void;
  /** Per-block side — rendered only for `lateral` blocks. Re-tapping the active side clears it. */
  onLateralityChange?: (lat: Laterality) => void;
  /** Removes a custom finding (index into splitCustomFindings(state.findings)). */
  onRemoveCustom?: (index: number) => void;
  /** Renders an inline "Add custom finding" row — omit when the host supplies its own add input. */
  onAddCustom?: (text: string) => void;
}

export const ExamBlockPreview: React.FC<ExamBlockPreviewProps> = ({
  block,
  state,
  filter = '',
  onToggleNormal,
  onToggleAbnormal,
  onSpecifyChange,
  onAllNormal,
  onAllAbnormal,
  onLateralityChange,
  onRemoveCustom,
  onAddCustom,
}) => {
  const [draft, setDraft] = useState('');
  const lowerFilter = filter.toLowerCase();
  const customs = splitCustomFindings(state.findings)
    .map((label, index) => ({ label, index }))
    .filter(c => !lowerFilter || c.label.toLowerCase().includes(lowerFilter));
  const submitDraft = () => {
    const text = draft.trim();
    if (!text || !onAddCustom) return;
    onAddCustom(text);
    setDraft('');
  };
  const filtered = lowerFilter
    ? block.findings.filter((f: PEFinding) => {
        if (f.normal && f.normal.toLowerCase().includes(lowerFilter)) return true;
        if (f.abnormals.some(a => a.label.toLowerCase().includes(lowerFilter))) return true;
        return false;
      })
    : block.findings;

  return (
    <div className="pt-2">
      {block.lateral && onLateralityChange && (
        <div className="flex gap-1 mb-2">
          {LATERALITY_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onLateralityChange(opt.value)}
              className={`px-3 py-1 text-[10pt] rounded-full transition-colors active:scale-95 ${
                state.laterality === opt.value
                  ? 'bg-themeblue3 text-white'
                  : 'bg-themewhite3 text-secondary'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
      {/* Findings grid — left: normal, right: abnormals (one per row).
          The block label is owned by the hosting overlay header, not repeated here. */}
      {filtered.length > 0 || customs.length > 0 ? (
        <div className="mb-4 border border-tertiary/10 rounded-xl overflow-hidden">
          {/* Quick actions — mark the whole block normal / abnormal. Not a finding
              row; sits above the first, aligned to the normal / abnormal columns. */}
          {(onAllNormal || onAllAbnormal) && (
            <div className="grid grid-cols-[7rem_1fr] border-b border-tertiary/10">
              <button
                type="button"
                onClick={onAllNormal}
                className="text-left px-3 py-2 active:bg-tertiary/5 transition-colors"
              >
                <span className="text-[9pt] font-medium text-secondary">All Normal</span>
              </button>
              <button
                type="button"
                onClick={onAllAbnormal}
                className="text-left px-3 py-2 border-l border-tertiary/10 active:bg-tertiary/5 transition-colors"
              >
                <span className="text-[9pt] font-medium text-secondary">All Abnormal</span>
              </button>
            </div>
          )}
          {filtered.map((finding: PEFinding, i: number) => {
            const abnormalCount = Math.max(finding.abnormals.length, 1);
            const hasNormal = !!finding.normal;

            return (
              <div
                key={finding.key}
                className={`grid grid-cols-[7rem_1fr] ${i > 0 ? 'border-t border-tertiary/10' : ''}`}
              >
                {/* Normal cell — spans all abnormal rows */}
                {hasNormal ? (
                  <button
                    type="button"
                    onClick={() => onToggleNormal(finding.key)}
                    className={`text-left px-3 py-1.5 transition-colors ${
                      state.selectedNormals.includes(finding.key)
                        ? 'bg-themegreen/10'
                        : 'active:bg-tertiary/5'
                    }`}
                    style={{ gridRow: `span ${abnormalCount}` }}
                  >
                    <span className="text-[9pt] text-secondary">
                      {finding.normal}
                    </span>
                  </button>
                ) : (
                  <div style={{ gridRow: `span ${abnormalCount}` }} />
                )}

                {/* Abnormal rows */}
                {finding.abnormals.length > 0 ? (
                  finding.abnormals.map((ab, j) => {
                    const selected = state.selectedAbnormals.includes(ab.key);
                    const showSpecify = selected && isSpecifyLabel(ab.label);
                    return (
                      <div
                        key={ab.key}
                        className={`border-l border-tertiary/10 ${j > 0 ? 'border-t border-tertiary/10' : ''} ${
                          selected ? 'bg-themeredred/10' : ''
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => onToggleAbnormal(ab.key)}
                          className={`w-full text-left px-3 py-1.5 transition-colors ${
                            selected ? '' : 'active:bg-tertiary/5'
                          }`}
                        >
                          <span className="text-[9pt] text-secondary">
                            {ab.label}
                          </span>
                        </button>
                        {showSpecify && onSpecifyChange && (
                          <div className="px-3 pb-1.5 -mt-0.5">
                            <input
                              type="text"
                              value={state.specifyDetails?.[ab.key] ?? ''}
                              onChange={(e) => onSpecifyChange(ab.key, e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              placeholder="Specify…"
                              className="w-full text-[9pt] text-primary bg-themewhite2 border border-tertiary/20 rounded-md px-2 py-1 focus:outline-none focus:border-themeblue3/40"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="border-l border-tertiary/10" />
                )}
              </div>
            );
          })}
          {/* Custom findings — free text entered by the examiner; always abnormal. */}
          {customs.map(({ label, index }) => (
            <div key={`custom-${index}`} className="grid grid-cols-[7rem_1fr] border-t border-tertiary/10">
              <div />
              <div className="border-l border-tertiary/10 bg-themeredred/10 flex items-center">
                <span className="flex-1 min-w-0 px-3 py-1.5 text-[9pt] text-secondary break-words">{label}</span>
                {onRemoveCustom && (
                  <button
                    type="button"
                    onClick={() => onRemoveCustom(index)}
                    className="shrink-0 w-7 h-7 mr-1 flex items-center justify-center rounded-full text-tertiary active:scale-95 transition-all"
                    aria-label="Remove custom finding"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="px-4 pb-4 text-[9pt] text-secondary italic">No matches</p>
      )}
      {onAddCustom && (
        <div className="flex items-center border-b border-primary/6">
          <div className="flex-1 min-w-0">
            <TextInput
              bare
              value={draft}
              onChange={setDraft}
              placeholder="Add custom finding..."
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitDraft(); } }}
            />
          </div>
          {draft.trim() && (
            <button
              type="button"
              onClick={submitDraft}
              className="shrink-0 w-9 h-9 mr-2 flex items-center justify-center rounded-full bg-themeblue3 text-white active:scale-95 transition-all"
              aria-label="Add custom finding"
            >
              <Plus size={16} />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
