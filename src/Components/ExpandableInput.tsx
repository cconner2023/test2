import { useState, useRef, useCallback, useEffect } from 'react';
import { X } from 'lucide-react';
import { useTextExpander } from '../Hooks/useTextExpander';
import { useTemplateSession } from '../Hooks/useTemplateSession';
import { TextExpanderSuggestion } from './TextExpanderSuggestion';
import { TemplateOverlay } from './TemplateOverlay';
import type { TextExpander } from '../Data/User';

interface ExpandableInputProps {
    value: string;
    onChange: (value: string) => void;
    expanders: TextExpander[];
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
    placeholder,
    className,
    multiline = false,
    onClick,
}: ExpandableInputProps) {
    const [cursorPosition, setCursorPosition] = useState(0);
    const [focused, setFocused] = useState(false);
    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

    const { suggestions, selectedIndex, accept, dismiss, selectNext, selectPrev } =
        useTextExpander({ text: value, cursorPosition, expanders });

    const {
        session: templateSession,
        stepStartRef,
        startSession,
        fillCurrentAndAdvance,
        dismissDropdown,
        selectNextChoice,
        selectPrevChoice,
        endSession,
    } = useTemplateSession();

    const hasSuggestions = suggestions.length > 0 && !templateSession.isActive;
    const hasValue = value.trim().length > 0;
    const showClose = focused || hasValue;

    const applyCursor = useCallback((pos: number) => {
        setCursorPosition(pos);
        requestAnimationFrame(() => {
            const el = inputRef.current;
            if (el) el.setSelectionRange(pos, pos);
        });
    }, []);

    const handleSelect = useCallback((e: React.SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setCursorPosition(e.currentTarget.selectionStart ?? 0);
    }, []);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        onChange(e.target.value);
        setCursorPosition(e.target.selectionStart ?? 0);
    }, [onChange]);

    const handleAccept = useCallback((expander?: TextExpander) => {
        const target = expander ?? suggestions[selectedIndex];
        const result = accept(expander);
        if (!result) return;

        // Template expander — start a template session instead of plain insertion
        if (target?.template && target.template.length > 0) {
            // accept() replaced the abbreviation with '' — result.newText has abbr removed
            const tmpl = startSession(result.newText, result.newCursorPosition, target.template);
            onChange(tmpl.newText);
            applyCursor(tmpl.cursorPosition);
            return;
        }

        // Simple expander — apply the expansion text directly
        onChange(result.newText);
        applyCursor(result.newCursorPosition);
    }, [accept, suggestions, selectedIndex, onChange, startSession, applyCursor]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        // --- Template session keyboard handlers ---
        if (templateSession.isActive && templateSession.activeNode) {
            const { activeNode } = templateSession;

            if (e.key === 'Escape') {
                e.preventDefault();
                if (activeNode.type === 'choice' && templateSession.showDropdown) {
                    dismissDropdown();
                } else {
                    endSession();
                }
                return;
            }
            if (templateSession.showDropdown && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
                e.preventDefault();
                if (e.key === 'ArrowRight') selectNextChoice();
                else selectPrevChoice();
                return;
            }
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (templateSession.showDropdown && templateSession.selectedChoiceIndex >= 0 && activeNode.options) {
                    const opts = activeNode.options.filter((o) => o.trim() !== '');
                    if (templateSession.selectedChoiceIndex < opts.length) {
                        const result = fillCurrentAndAdvance(value, opts[templateSession.selectedChoiceIndex]);
                        if (result) { onChange(result.newText); applyCursor(result.cursorPosition); }
                    } else if (activeNode.type === 'choice') {
                        dismissDropdown();
                    }
                    return;
                }
                if (activeNode.type === 'branch') return;
                const typedValue = value.slice(stepStartRef.current, cursorPosition);
                const result = fillCurrentAndAdvance(value, typedValue);
                if (result) { onChange(result.newText); applyCursor(result.cursorPosition); }
                return;
            }
            if (activeNode.type === 'branch') {
                if (!e.shiftKey) e.preventDefault();
                return;
            }
            return;
        }

        // --- Text expander keyboard handlers ---
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
    }, [templateSession, hasSuggestions, handleAccept, dismiss, selectNext, selectPrev,
        value, cursorPosition, stepStartRef, fillCurrentAndAdvance, dismissDropdown,
        selectNextChoice, selectPrevChoice, endSession, onChange, applyCursor]);

    const handleClose = useCallback(() => {
        onChange('');
        setFocused(false);
        if (templateSession.isActive) endSession();
        inputRef.current?.blur();
    }, [onChange, templateSession.isActive, endSession]);

    const handleFocus = useCallback(() => setFocused(true), []);
    const handleBlur = useCallback(() => {
        if (templateSession.isActive) endSession();
        if (!value.trim()) setFocused(false);
    }, [value, templateSession.isActive, endSession]);

    // Auto-resize textarea to fit content
    useEffect(() => {
        const el = inputRef.current;
        if (el && multiline) {
            el.style.height = 'auto';
            el.style.height = `${el.scrollHeight}px`;
            // Scroll into view after resize so the input doesn't grow off-screen
            if (document.activeElement === el) {
                el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
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
            <div className={`flex gap-2 ${multiline ? 'items-start' : 'items-center'}`}>
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
            {templateSession.isActive && templateSession.activeNode && (
                <TemplateOverlay
                    activeNode={templateSession.activeNode}
                    showDropdown={templateSession.showDropdown}
                    selectedChoiceIndex={templateSession.selectedChoiceIndex}
                    onSelectOption={(val) => {
                        const result = fillCurrentAndAdvance(value, val);
                        if (result) { onChange(result.newText); applyCursor(result.cursorPosition); }
                    }}
                    onDismissDropdown={dismissDropdown}
                    onEndSession={endSession}
                />
            )}
        </div>
    );
}
