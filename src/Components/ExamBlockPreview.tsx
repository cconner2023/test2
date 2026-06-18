import React from 'react';
import type { PEBlock, PEFinding } from '../Data/PhysicalExamData';
import { isSpecifyLabel } from '../Data/PhysicalExamData';

type SystemStatus = 'not-examined' | 'normal' | 'abnormal';

interface ItemState {
  status: SystemStatus;
  selectedNormals: string[];
  selectedAbnormals: string[];
  specifyDetails?: Record<string, string>;
  findings: string;
}

interface ExamBlockPreviewProps {
  block: PEBlock;
  state: ItemState;
  filter?: string;
  onToggleNormal: (findingKey: string) => void;
  onToggleAbnormal: (abnormalKey: string) => void;
  onSpecifyChange?: (abnormalKey: string, value: string) => void;
}

export const ExamBlockPreview: React.FC<ExamBlockPreviewProps> = ({
  block,
  state,
  filter = '',
  onToggleNormal,
  onToggleAbnormal,
  onSpecifyChange,
}) => {
  const lowerFilter = filter.toLowerCase();
  const filtered = lowerFilter
    ? block.findings.filter((f: PEFinding) => {
        if (f.normal && f.normal.toLowerCase().includes(lowerFilter)) return true;
        if (f.abnormals.some(a => a.label.toLowerCase().includes(lowerFilter))) return true;
        return false;
      })
    : block.findings;

  return (
    <div>
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <span className="text-[9pt] font-semibold text-secondary uppercase tracking-wider">
          {block.label}
        </span>
      </div>

      {/* Findings grid — left: normal, right: abnormals (one per row) */}
      {filtered.length > 0 ? (
        <div className="mb-4 border border-tertiary/10 rounded-xl overflow-hidden">
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
        </div>
      ) : (
        <p className="px-4 pb-4 text-[9pt] text-secondary italic">No matches</p>
      )}
    </div>
  );
};
