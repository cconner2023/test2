import { useMemo, useRef, useCallback, useState } from 'react';
import type { TextExpander } from '../Data/User';

interface UseTextExpanderInput {
    text: string;
    cursorPosition: number;
    expanders: TextExpander[];
    enabled: boolean;
}

interface UseTextExpanderResult {
    suggestions: TextExpander[];
    selectedIndex: number;
    currentWord: string;
    accept: (expander?: TextExpander) => { newText: string; newCursorPosition: number } | null;
    dismiss: () => void;
    selectNext: () => void;
    selectPrev: () => void;
}

function extractCurrentWord(text: string, cursor: number): string {
    if (cursor <= 0 || cursor > text.length) return '';
    let start = cursor;
    while (start > 0 && !/\s/.test(text[start - 1])) start--;
    return text.slice(start, cursor);
}

/** True when the user has typed ≥80% of the abbreviation (case-insensitive, prefix match). */
function isFuzzyMatch(typed: string, abbr: string): boolean {
    const lc = typed.toLowerCase();
    const abbrLc = abbr.toLowerCase();
    if (!abbrLc.startsWith(lc)) return false;
    return lc.length >= Math.ceil(abbr.length * 0.4);
}

export function useTextExpander({ text, cursorPosition, expanders, enabled }: UseTextExpanderInput): UseTextExpanderResult {
    const dismissedWordRef = useRef<string>('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const prevWordRef = useRef<string>('');

    const currentWord = useMemo(
        () => (enabled ? extractCurrentWord(text, cursorPosition) : ''),
        [text, cursorPosition, enabled],
    );

    // Reset selection when the typed word changes
    if (currentWord !== prevWordRef.current) {
        prevWordRef.current = currentWord;
        if (selectedIndex !== 0) setSelectedIndex(0);
    }

    const suggestions = useMemo(() => {
        if (!currentWord || !enabled || expanders.length === 0) return [];
        if (currentWord.toLowerCase() === dismissedWordRef.current.toLowerCase()) return [];
        return expanders.filter((e) => isFuzzyMatch(currentWord, e.abbr));
    }, [currentWord, enabled, expanders]);

    // Reset dismissed word when the user types something genuinely different
    if (currentWord && dismissedWordRef.current && currentWord.toLowerCase() !== dismissedWordRef.current.toLowerCase()) {
        dismissedWordRef.current = '';
    }

    const accept = useCallback((expander?: TextExpander) => {
        const target = expander ?? suggestions[selectedIndex];
        if (!target) return null;
        const start = cursorPosition - currentWord.length;
        const newText = text.slice(0, start) + target.expansion + text.slice(cursorPosition);
        const newCursorPosition = start + target.expansion.length;
        dismissedWordRef.current = '';
        return { newText, newCursorPosition };
    }, [suggestions, selectedIndex, text, cursorPosition, currentWord]);

    const dismiss = useCallback(() => {
        if (currentWord) {
            dismissedWordRef.current = currentWord;
        }
    }, [currentWord]);

    const selectNext = useCallback(() => {
        setSelectedIndex((i) => (i + 1) % (suggestions.length || 1));
    }, [suggestions.length]);

    const selectPrev = useCallback(() => {
        setSelectedIndex((i) => (i - 1 + (suggestions.length || 1)) % (suggestions.length || 1));
    }, [suggestions.length]);

    return { suggestions, selectedIndex, currentWord, accept, dismiss, selectNext, selectPrev };
}
