import { useCallback } from 'react';
import type { UserTypes } from '../Data/User';
import { useAuthStore } from '../stores/useAuthStore';
import { supabase } from '../lib/supabase';

/** Provides the user profile from the auth store with helpers to update locally and sync fields to Supabase. */
export function useUserProfile() {
    const profile = useAuthStore((s) => s.profile);
    const patchProfile = useAuthStore((s) => s.patchProfile);
    const user = useAuthStore((s) => s.user);

    /** Merge fields into in-memory profile + localStorage. Synchronous, no network. */
    const updateProfile = useCallback((fields: Partial<UserTypes>) => {
        patchProfile(fields);
    }, [patchProfile]);

    /** Fire-and-forget push of profile fields to Supabase (for authenticated users only) */
    const syncProfileField = useCallback((fields: Record<string, unknown>) => {
        if (!user) return;
        supabase.from('profiles').update(fields).eq('id', user.id)
            .then(({ error }) => {
                if (error) console.error('syncProfileField failed:', error);
            });
    }, [user]);

    return { profile, updateProfile, syncProfileField };
}
