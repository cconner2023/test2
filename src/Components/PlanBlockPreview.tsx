import React, { useMemo } from 'react';
import { Check } from 'lucide-react';

type BlockStatus = 'inactive' | 'active';

interface BlockState {
  status: BlockStatus;
  selectedTags: string[];
  freeText: string;
}

interface PlanBlockPreviewProps {
  label: string;
  tags: string[];
  state: BlockState;
  filter?: string;
  onToggleTag: (tag: string) => void;
}

export const PlanBlockPreview: React.FC<PlanBlockPreviewProps> = ({
  label,
  tags,
  state,
  filter = '',
  onToggleTag,
}) => {
  const sorted = useMemo(() => [...tags].sort((a, b) => a.localeCompare(b)), [tags]);

  const filtered = useMemo(() => {
    if (!filter) return sorted;
    const lower = filter.toLowerCase();
    return sorted.filter(tag => tag.toLowerCase().includes(lower));
  }, [sorted, filter]);

  return (
    <div>
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <span className="text-xs font-semibold text-secondary uppercase tracking-wider">
          {label}
        </span>
      </div>

      {/* Items */}
      {filtered.length > 0 ? (
        <div className="mx-4 mb-4 border border-tertiary/10 rounded-xl overflow-hidden">
          {filtered.map((tag, i) => {
            const selected = state.selectedTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => onToggleTag(tag)}
                className={`flex items-center gap-3 w-full text-left px-4 py-2.5 transition-colors active:scale-[0.98] ${
                  i > 0 ? 'border-t border-tertiary/10' : ''
                } ${selected ? 'bg-themegreen/5' : ''}`}
              >
                <span className={`w-4 h-4 rounded-full shrink-0 flex items-center justify-center transition-colors duration-200 ${
                  selected
                    ? 'bg-themegreen'
                    : 'ring-[1.5px] ring-inset ring-tertiary/25 bg-transparent'
                }`}>
                  {selected && <Check size={10} className="text-white" strokeWidth={3} />}
                </span>
                <span className={`text-[11pt] ${selected ? 'text-primary' : 'text-tertiary/60'}`}>
                  {tag}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="px-4 pb-4 text-[10pt] text-tertiary/40 italic">No matches</p>
      )}
    </div>
  );
};
