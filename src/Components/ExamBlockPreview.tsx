import React from 'react';
import type { PEBlock, PEFinding } from '../Data/PhysicalExamData';

type SystemStatus = 'not-examined' | 'normal' | 'abnormal';

interface ItemState {
  status: SystemStatus;
  selectedNormals: string[];
  selectedAbnormals: string[];
  findings: string;
}

interface ExamBlockPreviewProps {
  block: PEBlock;
  state: ItemState;
  filter?: string;
  onToggleNormal: (findingKey: string) => void;
  onToggleAbnormal: (abnormalKey: string) => void;
}

export const ExamBlockPreview: React.FC<ExamBlockPreviewProps> = ({
  block,
  state,
  filter = '',
  onToggleNormal,
  onToggleAbnormal,
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
                    className="text-left px-3 py-1.5 active:bg-tertiary/5 transition-colors"
                    style={{ gridRow: `span ${abnormalCount}` }}
                  >
                    <span className={`text-[9pt] transition-colors ${
                      state.selectedNormals.includes(finding.key)
                        ? 'text-primary font-medium'
                        : 'text-secondary'
                    }`}>
                      {finding.normal}
                    </span>
                  </button>
                ) : (
                  <div style={{ gridRow: `span ${abnormalCount}` }} />
                )}

                {/* Abnormal rows */}
                {finding.abnormals.length > 0 ? (
                  finding.abnormals.map((ab, j) => (
                    <button
                      key={ab.key}
                      type="button"
                      onClick={() => onToggleAbnormal(ab.key)}
                      className={`text-left px-3 py-1.5 border-l border-tertiary/10 active:bg-tertiary/5 transition-colors ${
                        j > 0 ? 'border-t border-tertiary/10' : ''
                      }`}
                    >
                      <span className={`text-[9pt] transition-colors ${
                        state.selectedAbnormals.includes(ab.key)
                          ? 'text-primary font-medium'
                          : 'text-secondary'
                      }`}>
                        {ab.label}
                      </span>
                    </button>
                  ))
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
