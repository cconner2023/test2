import { useState, useRef, useCallback } from 'react';
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
    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

    const { suggestions, selectedIndex, accept, dismiss, selectNext, selectPrev } =
        useTextExpander({ text: value, cursorPosition, expanders, enabled: expanderEnabled });

    const hasSuggestions = suggestions.length > 0;

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

    const sharedProps = {
        value,
        onChange: handleChange,
        onSelect: handleSelect,
        onKeyDown: handleKeyDown,
        onClick,
        placeholder,
        className,
    };

    return (
        <div className="relative">
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
