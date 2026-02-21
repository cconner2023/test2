import { X } from 'lucide-react';
import type { TextExpander } from '../Data/User';

interface TextExpanderSuggestionProps {
    suggestions: TextExpander[];
    selectedIndex: number;
    onDismiss: () => void;
}

export const TextExpanderSuggestion = ({ suggestions, selectedIndex, onDismiss }: TextExpanderSuggestionProps) => {
    return (
        <div className="absolute left-2 right-2 bottom-1 z-10 rounded-lg bg-themewhite border border-themeblue2/25 shadow-lg animate-in fade-in slide-in-from-bottom-1 duration-150 overflow-hidden">
            {suggestions.map((s, i) => {
                const isSelected = i === selectedIndex;
                const firstLine = s.expansion.split('\n')[0];
                const isMultiLine = s.expansion.includes('\n');
                const preview = firstLine.length > 80
                    ? firstLine.slice(0, 77) + '...'
                    : firstLine + (isMultiLine ? ' ...' : '');

                return (
                    <div
                        key={s.abbr}
                        className={`flex items-center gap-2 px-3 py-2 ${isSelected ? 'bg-themeblue2/8' : ''} ${i > 0 ? 'border-t border-tertiary/8' : ''}`}
                    >
                        <code className="shrink-0 text-[11px] font-mono font-semibold bg-themeblue2/10 text-themeblue2 px-1.5 py-0.5 rounded self-start mt-0.5">
                            {s.abbr}
                        </code>
                        <span className="text-tertiary/50 text-xs shrink-0 self-start mt-0.5">&rarr;</span>
                        <span className="text-sm text-tertiary truncate flex-1 min-w-0">{preview}</span>
                        {isSelected && (
                            <kbd className="shrink-0 text-[10px] text-tertiary/50 border border-tertiary/15 rounded px-1.5 py-0.5 font-mono self-start mt-0.5">
                                Enter &crarr;
                            </kbd>
                        )}
                    </div>
                );
            })}
            <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDismiss(); }}
                className="absolute top-1.5 right-1.5 p-0.5 rounded hover:bg-tertiary/10 transition-colors"
                aria-label="Dismiss suggestions"
                tabIndex={-1}
            >
                <X size={14} className="text-tertiary/40" />
            </button>
        </div>
    );
};
