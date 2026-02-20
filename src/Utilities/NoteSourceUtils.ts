/**
 * Formats a noteSource string for display.
 * Centralises the formatting logic used across NavTop, AlgorithmPage, and WriteNotePage.
 */
export function formatNoteSource(noteSource: string | null | undefined, variant: 'short' | 'full' = 'full'): string {
    if (noteSource?.startsWith('external')) {
        return `External${noteSource.includes(':') ? ': ' + noteSource.split(':')[1] : ''}`;
    }
    if (noteSource) {
        return variant === 'short' ? 'Saved' : 'Saved: My Note';
    }
    return 'New Note';
}
