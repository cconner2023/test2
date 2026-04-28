import { X } from 'lucide-react';
import type { ActiveNode } from '../Hooks/useTemplateSession';

interface TemplateOverlayProps {
    activeNode: ActiveNode;
    showDropdown: boolean;
    selectedChoiceIndex: number;
    onSelectOption: (value: string) => void;
    onDismissDropdown: () => void;
    onEndSession: () => void;
}

export const TemplateOverlay = ({
    activeNode,
    showDropdown,
    selectedChoiceIndex,
    onSelectOption,
    onDismissDropdown,
    onEndSession,
}: TemplateOverlayProps) => {
    const isChoice = activeNode.type === 'choice';
    const isBranch = activeNode.type === 'branch';
    const hasOptions = isChoice || isBranch;
    const filteredOptions = hasOptions && activeNode.options
        ? activeNode.options.filter((o) => o.trim() !== '')
        : [];

    return (
        <div
            onMouseDown={(e) => e.preventDefault()}
            className="absolute left-2 right-2 bottom-1 z-10 rounded-lg bg-themewhite border border-themeblue2/25 shadow-lg animate-in fade-in slide-in-from-bottom-1 duration-150 overflow-hidden px-3 py-2"
        >
            <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[10pt] font-medium text-tertiary">
                    {activeNode.label}
                </span>
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (isChoice && showDropdown) {
                            onDismissDropdown();
                        } else {
                            onEndSession();
                        }
                    }}
                    className="shrink-0 p-0.5 rounded hover:bg-tertiary/10 transition-colors"
                    aria-label={isChoice && showDropdown ? 'Dismiss options' : 'End template'}
                    tabIndex={-1}
                >
                    <X size={14} className="text-tertiary" />
                </button>
            </div>

            {/* Option pills (choice or inline branch) */}
            {hasOptions && showDropdown && (
                <div className="flex flex-wrap gap-1.5">
                    {filteredOptions.map((option, idx) => {
                        const isFocused = idx === selectedChoiceIndex;
                        return (
                            <button
                                key={option}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onSelectOption(option);
                                }}
                                className={`text-[9pt] px-2.5 py-1 rounded-full font-medium transition-colors ${
                                    isFocused
                                        ? isBranch
                                            ? 'bg-themepurple text-white ring-2 ring-themepurple/40'
                                            : 'bg-themeblue2 text-white ring-2 ring-themeblue2/40'
                                        : isBranch
                                            ? 'bg-themepurple/10 text-themepurple hover:bg-themepurple/20'
                                            : 'bg-themeblue2/10 text-themeblue2 hover:bg-themeblue2/20'
                                }`}
                                tabIndex={-1}
                            >
                                {option}
                            </button>
                        );
                    })}
                    {/* "Other" only for choice, not for inline branch */}
                    {isChoice && (
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onDismissDropdown();
                            }}
                            className={`text-[9pt] px-2.5 py-1 rounded-full font-medium transition-colors ${
                                selectedChoiceIndex === filteredOptions.length
                                    ? 'bg-tertiary/30 text-tertiary ring-2 ring-tertiary/30'
                                    : 'bg-tertiary/10 text-tertiary hover:bg-tertiary/20'
                            }`}
                            tabIndex={-1}
                        >
                            Other
                        </button>
                    )}
                </div>
            )}

            {/* Typing hint for step or dismissed choice dropdown */}
            {activeNode.type === 'step' && (
                <p className="text-[9pt] text-tertiary">
                    Type your response, then press Enter to continue
                </p>
            )}
            {isChoice && !showDropdown && (
                <p className="text-[9pt] text-tertiary">
                    Type your response, then press Enter to continue
                </p>
            )}
        </div>
    );
};
