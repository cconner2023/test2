import { useCallback } from 'react';
import type { UserTypes } from '../Data/User';
import { useAuthStore } from '../stores/useAuthStore';

const STORAGE_KEY = 'adtmc_user_profile';

export function useUserProfile() {
    const profile = useAuthStore((s) => s.profile);
    const refreshProfile = useAuthStore((s) => s.refreshProfile);

    const updateProfile = useCallback((fields: Partial<UserTypes>) => {
        // Update localStorage and trigger store refresh
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            const current = saved ? JSON.parse(saved) : {};
            const next = { ...current, ...fields };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
            // localStorage unavailable
        }
        refreshProfile();
    }, [refreshProfile]);

    const clearProfile = useCallback(() => {
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch {
            // localStorage unavailable
        }
        refreshProfile();
    }, [refreshProfile]);

    return { profile, updateProfile, clearProfile };
}
