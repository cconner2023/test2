import { useState, useCallback, useEffect } from 'react';

export interface SavedNote {
    id: string;
    encodedText: string;
    createdAt: string;           // ISO date string
    symptomIcon: string;
    symptomText: string;
    dispositionType: string;
    dispositionText: string;
    previewText: string;         // First ~120 chars of decoded note for display
}

const STORAGE_KEY = 'adtmc_saved_notes';

function loadNotes(): SavedNote[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        // Validate each entry has required fields (parsed is unknown[])
        return parsed.filter(
            (n: unknown): n is SavedNote => {
                const record = n as Record<string, unknown>;
                return (
                    typeof record.id === 'string' &&
                    typeof record.encodedText === 'string' &&
                    typeof record.createdAt === 'string'
                );
            }
        );
    } catch {
        // Corrupted cache - return empty
        console.warn('Failed to load saved notes from localStorage, resetting.');
        return [];
    }
}

function persistNotes(notes: SavedNote[]): boolean {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
        return true;
    } catch (e) {
        // Quota exceeded or other storage error
        console.error('Failed to save notes to localStorage:', e);
        return false;
    }
}

export function useNotesStorage() {
    const [notes, setNotes] = useState<SavedNote[]>(() => loadNotes());

    // Keep state in sync if another tab changes localStorage
    useEffect(() => {
        const handleStorage = (e: StorageEvent) => {
            if (e.key === STORAGE_KEY) {
                setNotes(loadNotes());
            }
        };
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    const saveNote = useCallback((note: Omit<SavedNote, 'id' | 'createdAt'>): { success: boolean; error?: string } => {
        const newNote: SavedNote = {
            ...note,
            id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            createdAt: new Date().toISOString(),
        };

        const updated = [newNote, ...loadNotes()]; // prepend newest
        const success = persistNotes(updated);
        if (success) {
            setNotes(updated);
            return { success: true };
        }
        return { success: false, error: 'Storage quota exceeded. Please delete some notes.' };
    }, []);

    const deleteNote = useCallback((noteId: string) => {
        const current = loadNotes();
        const updated = current.filter(n => n.id !== noteId);
        persistNotes(updated);
        setNotes(updated);
    }, []);

    const clearAllNotes = useCallback(() => {
        persistNotes([]);
        setNotes([]);
    }, []);

    const updateNote = useCallback((noteId: string, updates: Partial<Omit<SavedNote, 'id' | 'createdAt'>>): { success: boolean; error?: string } => {
        const current = loadNotes();
        const index = current.findIndex(n => n.id === noteId);
        if (index === -1) return { success: false, error: 'Note not found.' };
        current[index] = { ...current[index], ...updates };
        const success = persistNotes(current);
        if (success) {
            setNotes(current);
            return { success: true };
        }
        return { success: false, error: 'Failed to update note.' };
    }, []);

    return {
        notes,
        saveNote,
        updateNote,
        deleteNote,
        clearAllNotes,
    };
}
