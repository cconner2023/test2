import { useState, useCallback, useEffect, useRef } from 'react';
import * as notesApi from '../lib/notesService';

export interface SavedNote {
    id: string;
    encodedText: string;
    createdAt: string;           // ISO date string
    symptomIcon: string;
    symptomText: string;
    dispositionType: string;
    dispositionText: string;
    previewText: string;         // First ~120 chars of decoded note for display
    source?: string;             // Optional tag: 'external source' for imported notes
}

const STORAGE_KEY = 'adtmc_saved_notes';

function loadNotesFromLocalStorage(): SavedNote[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
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
        console.warn('Failed to load saved notes from localStorage, resetting.');
        return [];
    }
}

function persistNotesToLocalStorage(notes: SavedNote[]): boolean {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
        return true;
    } catch (e) {
        console.error('Failed to save notes to localStorage:', e);
        return false;
    }
}

export function useNotesStorage() {
    const [notes, setNotes] = useState<SavedNote[]>(() => loadNotesFromLocalStorage());
    const apiAvailable = useRef<boolean | null>(null);
    const initialLoadDone = useRef(false);

    // Check API availability and load notes from database on mount
    useEffect(() => {
        let cancelled = false;

        async function init() {
            try {
                const health = await notesApi.checkApiHealth();
                if (cancelled) return;

                apiAvailable.current = health.ok;

                if (health.ok) {
                    console.log('[NotesStorage] API server available, loading from database');
                    const dbNotes = await notesApi.fetchNotes();
                    if (cancelled) return;

                    // Merge: if localStorage has notes not in DB, push them to DB
                    const localNotes = loadNotesFromLocalStorage();
                    const dbIds = new Set(dbNotes.map(n => n.id));
                    const notInDb = localNotes.filter(n => !dbIds.has(n.id));

                    if (notInDb.length > 0) {
                        console.log(`[NotesStorage] Syncing ${notInDb.length} local notes to database`);
                        for (const note of notInDb) {
                            try {
                                await notesApi.createNote(note);
                            } catch (err) {
                                console.warn('[NotesStorage] Failed to sync note to DB:', err);
                            }
                        }
                        // Re-fetch to get the complete list
                        const allNotes = await notesApi.fetchNotes();
                        if (!cancelled) {
                            setNotes(allNotes);
                            persistNotesToLocalStorage(allNotes);
                        }
                    } else {
                        setNotes(dbNotes);
                        persistNotesToLocalStorage(dbNotes);
                    }
                } else {
                    console.log('[NotesStorage] API server not available, using localStorage only');
                }
            } catch (err) {
                console.warn('[NotesStorage] API init failed, using localStorage:', err);
                apiAvailable.current = false;
            }
            initialLoadDone.current = true;
        }

        init();
        return () => { cancelled = true; };
    }, []);

    // Keep state in sync if another tab changes localStorage
    useEffect(() => {
        const handleStorage = (e: StorageEvent) => {
            if (e.key === STORAGE_KEY) {
                setNotes(loadNotesFromLocalStorage());
            }
        };
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    const saveNote = useCallback((note: Omit<SavedNote, 'id' | 'createdAt'>): { success: boolean; error?: string; noteId?: string } => {
        const newNote: SavedNote = {
            ...note,
            id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            createdAt: new Date().toISOString(),
        };

        // Update localStorage and state immediately (optimistic)
        const updated = [newNote, ...loadNotesFromLocalStorage()];
        const success = persistNotesToLocalStorage(updated);
        if (success) {
            setNotes(updated);

            // Persist to database asynchronously
            if (apiAvailable.current) {
                notesApi.createNote(newNote).then(() => {
                    console.log(`[NotesStorage] Note ${newNote.id} saved to database`);
                }).catch(err => {
                    console.warn('[NotesStorage] Failed to save note to DB:', err);
                });
            }

            return { success: true, noteId: newNote.id };
        }
        return { success: false, error: 'Storage quota exceeded. Please delete some notes.' };
    }, []);

    const deleteNote = useCallback((noteId: string) => {
        const current = loadNotesFromLocalStorage();
        const updated = current.filter(n => n.id !== noteId);
        persistNotesToLocalStorage(updated);
        setNotes(updated);

        // Delete from database asynchronously
        if (apiAvailable.current) {
            notesApi.deleteNote(noteId).then(() => {
                console.log(`[NotesStorage] Note ${noteId} deleted from database`);
            }).catch(err => {
                console.warn('[NotesStorage] Failed to delete note from DB:', err);
            });
        }
    }, []);

    const clearAllNotes = useCallback(() => {
        // Clear localStorage
        persistNotesToLocalStorage([]);
        setNotes([]);

        // If API available, we'd need to delete all from DB too
        // For now this is a localStorage-only operation
        if (apiAvailable.current) {
            notesApi.fetchNotes().then(dbNotes => {
                for (const note of dbNotes) {
                    notesApi.deleteNote(note.id).catch(() => {});
                }
            }).catch(() => {});
        }
    }, []);

    const updateNote = useCallback((noteId: string, updates: Partial<Omit<SavedNote, 'id'>>, refreshTimestamp = false): { success: boolean; error?: string } => {
        const current = loadNotesFromLocalStorage();
        const index = current.findIndex(n => n.id === noteId);
        if (index === -1) return { success: false, error: 'Note not found.' };
        current[index] = {
            ...current[index],
            ...updates,
            ...(refreshTimestamp ? { createdAt: new Date().toISOString() } : {}),
        };
        const success = persistNotesToLocalStorage(current);
        if (success) {
            setNotes(current);

            // Update in database asynchronously
            if (apiAvailable.current) {
                const dbUpdates = {
                    ...updates,
                    ...(refreshTimestamp ? { createdAt: new Date().toISOString() } : {}),
                };
                notesApi.updateNote(noteId, dbUpdates).then(() => {
                    console.log(`[NotesStorage] Note ${noteId} updated in database`);
                }).catch(err => {
                    console.warn('[NotesStorage] Failed to update note in DB:', err);
                });
            }

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
