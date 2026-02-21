import { useMemo, useRef, useCallback } from 'react';
import type { TextExpander } from '../Data/User';

interface UseTextExpanderInput {
    text: string;
    cursorPosition: number;
    expanders: TextExpander[];
    enabled: boolean;
}

interface UseTextExpanderResult {
    suggestion: TextExpander | null;
    currentWord: string;
    accept: () => { newText: string; newCursorPosition: number } | null;
    dismiss: () => void;
}

function extractCurrentWord(text: string, cursor: number): string {
    if (cursor <= 0 || cursor > text.length) return '';
    let start = cursor;
    while (start > 0 && !/\s/.test(text[start - 1])) start--;
    return text.slice(start, cursor);
}

export function useTextExpander({ text, cursorPosition, expanders, enabled }: UseTextExpanderInput): UseTextExpanderResult {
    const dismissedWordRef = useRef<string>('');

    const currentWord = useMemo(
        () => (enabled ? extractCurrentWord(text, cursorPosition) : ''),
        [text, cursorPosition, enabled],
    );

    const suggestion = useMemo(() => {
        if (!currentWord || !enabled || expanders.length === 0) return null;
        if (currentWord.toLowerCase() === dismissedWordRef.current.toLowerCase()) return null;
        const lc = currentWord.toLowerCase();
        return expanders.find((e) => e.abbr.toLowerCase() === lc) ?? null;
    }, [currentWord, enabled, expanders]);

    // Reset dismissed word when the user types something different
    if (currentWord && currentWord.toLowerCase() !== dismissedWordRef.current.toLowerCase()) {
        // Only clear if it's a genuinely different word (not the same dismissed one)
        if (dismissedWordRef.current && currentWord.toLowerCase() !== dismissedWordRef.current.toLowerCase()) {
            dismissedWordRef.current = '';
        }
    }

    const accept = useCallback(() => {
        if (!suggestion) return null;
        const start = cursorPosition - currentWord.length;
        const newText = text.slice(0, start) + suggestion.expansion + text.slice(cursorPosition);
        const newCursorPosition = start + suggestion.expansion.length;
        dismissedWordRef.current = '';
        return { newText, newCursorPosition };
    }, [suggestion, text, cursorPosition, currentWord]);

    const dismiss = useCallback(() => {
        if (currentWord) {
            dismissedWordRef.current = currentWord;
        }
    }, [currentWord]);

    return { suggestion, currentWord, accept, dismiss };
}
