import { X } from 'lucide-react';
import type { TextExpander } from '../Data/User';

interface TextExpanderSuggestionProps {
    suggestion: TextExpander;
    onDismiss: () => void;
}

export const TextExpanderSuggestion = ({ suggestion, onDismiss }: TextExpanderSuggestionProps) => {
    const truncated = suggestion.expansion.length > 80
        ? suggestion.expansion.slice(0, 77) + '...'
        : suggestion.expansion;

    return (
        <div className="absolute left-2 right-2 bottom-1 z-10 flex items-center gap-2 px-3 py-2 rounded-lg bg-themewhite border border-themeblue2/25 shadow-lg animate-in fade-in slide-in-from-bottom-1 duration-150">
            <code className="shrink-0 text-[11px] font-mono font-semibold bg-themeblue2/10 text-themeblue2 px-1.5 py-0.5 rounded">
                {suggestion.abbr}
            </code>
            <span className="text-tertiary/50 text-xs shrink-0">&rarr;</span>
            <span className="text-sm text-tertiary truncate flex-1 min-w-0">{truncated}</span>
            <kbd className="shrink-0 text-[10px] text-tertiary/50 border border-tertiary/15 rounded px-1.5 py-0.5 font-mono">
                Enter &crarr;
            </kbd>
            <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDismiss(); }}
                className="shrink-0 p-0.5 rounded hover:bg-tertiary/10 transition-colors"
                aria-label="Dismiss suggestion"
                tabIndex={-1}
            >
                <X size={14} className="text-tertiary/40" />
            </button>
        </div>
    );
};
