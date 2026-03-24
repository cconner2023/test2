import { useState, useRef, useCallback, useEffect } from 'react';
import { X } from 'lucide-react';
import { useTextExpander } from '../Hooks/useTextExpander';
import { TextExpanderSuggestion } from './TextExpanderSuggestion';
import type { TextExpander } from '../Data/User';

interface ExpandableInputProps {
    value: string;
    onChange: (value: string) => void;
    expanders: TextExpander[];
    expanderEnabled: boolean;
    placeholder?: string;
    className?: string;
    /** Render as <textarea> instead of <input> */
    multiline?: boolean;
    onClick?: (e: React.MouseEvent) => void;
}

export function ExpandableInput({
    value,
    onChange,
    expanders,
    expanderEnabled,
    placeholder,
    className,
    multiline = false,
    onClick,
}: ExpandableInputProps) {
    const [cursorPosition, setCursorPosition] = useState(0);
    const [focused, setFocused] = useState(false);
    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

    const { suggestions, selectedIndex, accept, dismiss, selectNext, selectPrev } =
        useTextExpander({ text: value, cursorPosition, expanders, enabled: expanderEnabled });

    const hasSuggestions = suggestions.length > 0;
    const hasValue = value.trim().length > 0;
    const showClose = focused || hasValue;

    const handleSelect = useCallback((e: React.SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setCursorPosition(e.currentTarget.selectionStart ?? 0);
    }, []);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        onChange(e.target.value);
        setCursorPosition(e.target.selectionStart ?? 0);
    }, [onChange]);

    const handleAccept = useCallback((expander?: TextExpander) => {
        const result = accept(expander);
        if (result) {
            onChange(result.newText);
            setCursorPosition(result.newCursorPosition);
            // Restore cursor position after React re-render
            requestAnimationFrame(() => {
                const el = inputRef.current;
                if (el) {
                    el.setSelectionRange(result.newCursorPosition, result.newCursorPosition);
                }
            });
        }
    }, [accept, onChange]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (!hasSuggestions) return;
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAccept();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            dismiss();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectNext();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectPrev();
        }
    }, [hasSuggestions, handleAccept, dismiss, selectNext, selectPrev]);

    const handleClose = useCallback(() => {
        onChange('');
        setFocused(false);
        inputRef.current?.blur();
    }, [onChange]);

    const handleFocus = useCallback(() => setFocused(true), []);
    const handleBlur = useCallback(() => {
        if (!value.trim()) setFocused(false);
    }, [value]);

    // Auto-resize textarea to fit content
    useEffect(() => {
        const el = inputRef.current;
        if (el && multiline) {
            el.style.height = 'auto';
            el.style.height = `${el.scrollHeight}px`;
        }
    }, [value, multiline]);

    const sharedProps = {
        value,
        onChange: handleChange,
        onSelect: handleSelect,
        onKeyDown: handleKeyDown,
        onFocus: handleFocus,
        onBlur: handleBlur,
        onClick,
        placeholder,
        className: `${className} flex-1 min-w-0`,
    };

    return (
        <div className="relative">
            <div className="flex items-center gap-2">
                {multiline ? (
                    <textarea
                        ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                        {...sharedProps}
                    />
                ) : (
                    <input
                        type="text"
                        ref={inputRef as React.RefObject<HTMLInputElement>}
                        {...sharedProps}
                    />
                )}
                <div className={`transition-all duration-200 overflow-hidden ${
                    showClose ? 'w-9 opacity-100' : 'w-0 opacity-0'
                }`}>
                    <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={handleClose}
                        className="w-9 h-9 rounded-full flex items-center justify-center bg-tertiary/10 active:scale-95 shrink-0"
                        aria-label="Clear"
                    >
                        <X size={16} className="text-tertiary" />
                    </button>
                </div>
            </div>
            {hasSuggestions && (
                <TextExpanderSuggestion
                    suggestions={suggestions}
                    selectedIndex={selectedIndex}
                    onDismiss={dismiss}
                    onAccept={handleAccept}
                />
            )}
        </div>
    );
}
