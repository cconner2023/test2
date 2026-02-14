import { useState, useCallback } from 'react';
import { profileAvatars } from '../Data/User/ProfileAvatars';
import type { ProfileAvatar } from '../Data/User/ProfileAvatars';

const STORAGE_KEY = 'adtmc_profile_avatar';
const CUSTOM_IMAGE_KEY = 'adtmc_profile_custom_avatar';

function loadAvatarId(): string {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved === 'custom') return saved;
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

function loadCustomImage(): string | null {
    try {
        return localStorage.getItem(CUSTOM_IMAGE_KEY);
    } catch {
        return null;
    }
}

/** Center-crop and resize an image file to a square JPEG data URL. */
export function resizeImage(file: File, maxSize = 160): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = maxSize;
                canvas.height = maxSize;
                const ctx = canvas.getContext('2d');
                if (!ctx) { reject(new Error('Canvas not supported')); return; }

                // Center-crop to square
                const size = Math.min(img.width, img.height);
                const x = (img.width - size) / 2;
                const y = (img.height - size) / 2;

                ctx.drawImage(img, x, y, size, size, 0, 0, maxSize, maxSize);
                resolve(canvas.toDataURL('image/jpeg', 0.8));
            };
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = e.target?.result as string;
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}

export function useProfileAvatar() {
    const [avatarId, setAvatarId] = useState<string>(loadAvatarId);
    const [customImage, setCustomImageState] = useState<string | null>(loadCustomImage);

    const isCustom = avatarId === 'custom' && customImage !== null;

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

    const setCustomImage = useCallback((dataUrl: string) => {
        try {
            localStorage.setItem(CUSTOM_IMAGE_KEY, dataUrl);
            localStorage.setItem(STORAGE_KEY, 'custom');
        } catch {
            // localStorage full or unavailable
            return;
        }
        setCustomImageState(dataUrl);
        setAvatarId('custom');
    }, []);

    const clearCustomImage = useCallback(() => {
        try {
            localStorage.removeItem(CUSTOM_IMAGE_KEY);
        } catch {
            // ignore
        }
        setCustomImageState(null);
        // Fall back to first SVG avatar if custom was active
        const fallback = profileAvatars[0].id;
        setAvatarId(fallback);
        try {
            localStorage.setItem(STORAGE_KEY, fallback);
        } catch {
            // ignore
        }
    }, []);

    return {
        currentAvatar,
        setAvatar,
        avatarList: profileAvatars,
        customImage,
        isCustom,
        setCustomImage,
        clearCustomImage,
    };
}
