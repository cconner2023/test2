import { useState, useCallback } from 'react';
import type { UserTypes } from '../Data/User';

const STORAGE_KEY = 'adtmc_user_profile';

function loadProfile(): UserTypes {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            return JSON.parse(saved) as UserTypes;
        }
    } catch {
        // localStorage unavailable or bad JSON
    }
    return {};
}

export function useUserProfile() {
    const [profile, setProfile] = useState<UserTypes>(loadProfile);

    const updateProfile = useCallback((fields: Partial<UserTypes>) => {
        setProfile(prev => {
            const next = { ...prev, ...fields };
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            } catch {
                // localStorage full or unavailable
            }
            return next;
        });
    }, []);

    const clearProfile = useCallback(() => {
        setProfile({});
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch {
            // localStorage unavailable
        }
    }, []);

    return { profile, updateProfile, clearProfile };
}
