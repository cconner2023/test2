import { useState, useCallback } from 'react';
import { profileAvatars } from '../Data/ProfileAvatars';
import type { ProfileAvatar } from '../Data/ProfileAvatars';

const STORAGE_KEY = 'adtmc_profile_avatar';

function loadAvatarId(): string {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved && profileAvatars.some(a => a.id === saved)) {
            return saved;
        }
    } catch {
        // localStorage unavailable
    }
    // Random assign on first load
    const randomId = profileAvatars[Math.floor(Math.random() * profileAvatars.length)].id;
    try {
        localStorage.setItem(STORAGE_KEY, randomId);
    } catch {
        // localStorage full or unavailable
    }
    return randomId;
}

export function useProfileAvatar() {
    const [avatarId, setAvatarId] = useState<string>(loadAvatarId);

    const currentAvatar: ProfileAvatar =
        profileAvatars.find(a => a.id === avatarId) ?? profileAvatars[0];

    const setAvatar = useCallback((id: string) => {
        setAvatarId(id);
        try {
            localStorage.setItem(STORAGE_KEY, id);
        } catch {
            // localStorage full or unavailable
        }
    }, []);

    return { currentAvatar, setAvatar, avatarList: profileAvatars };
}
