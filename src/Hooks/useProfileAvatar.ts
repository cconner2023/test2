import { useState, useCallback, useEffect, useRef } from 'react';
import { profileAvatars } from '../Data/ProfileAvatars';
import type { ProfileAvatar } from '../Data/ProfileAvatars';
import { supabase } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { usePageVisibility } from './usePageVisibility';

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

/** Save avatar_id to Supabase profile (fire-and-forget). */
function syncAvatarToSupabase(userId: string, avatarId: string) {
    supabase
        .from('profiles')
        .update({ avatar_id: avatarId })
        .eq('id', userId)
        .then(({ error }) => {
            if (error) console.error('Failed to sync avatar:', error.message);
        });
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

export function useProfileAvatar(userId?: string) {
    const [avatarId, setAvatarId] = useState<string>(loadAvatarId);
    const [customImage, setCustomImageState] = useState<string | null>(loadCustomImage);
    const hasSyncedRef = useRef<string | null>(null);
    const isPageVisible = usePageVisibility();

    const isCustom = avatarId === 'custom' && customImage !== null;

    const currentAvatar: ProfileAvatar =
        profileAvatars.find(a => a.id === avatarId) ?? profileAvatars[0];

    // On login, fetch avatar_id from Supabase and apply it (once per userId)
    useEffect(() => {
        if (!userId || hasSyncedRef.current === userId) return;
        hasSyncedRef.current = userId;

        supabase
            .from('profiles')
            .select('avatar_id')
            .eq('id', userId)
            .single()
            .then(({ data }) => {
                const remoteId = data?.avatar_id;
                if (!remoteId) {
                    // No avatar saved remotely yet — push the local one up
                    syncAvatarToSupabase(userId, avatarId);
                    return;
                }
                // Apply remote avatar if it's a valid pre-made avatar
                if (profileAvatars.some(a => a.id === remoteId)) {
                    setAvatarId(remoteId);
                    try { localStorage.setItem(STORAGE_KEY, remoteId); } catch { /* */ }
                }
            });
    }, [userId, avatarId]);

    // Realtime: subscribe to avatar_id changes on the user's own profile row
    // so that changing avatar on one device updates all other logged-in devices.
    // Pauses when the page is backgrounded to reduce battery drain.
    useEffect(() => {
        if (!userId || !isPageVisible) return;

        const channel: RealtimeChannel = supabase
            .channel(`profile-avatar:${userId}`)
            .on<{ avatar_id: string | null }>(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'profiles',
                    filter: `id=eq.${userId}`,
                },
                (payload) => {
                    const remoteId = payload.new.avatar_id;
                    if (!remoteId) return;

                    // Only apply if it differs from the current local state
                    setAvatarId(prev => {
                        if (prev === remoteId) return prev;
                        try { localStorage.setItem(STORAGE_KEY, remoteId); } catch { /* */ }
                        // If switching away from custom, clear the custom image locally
                        if (remoteId !== 'custom') {
                            try { localStorage.removeItem(CUSTOM_IMAGE_KEY); } catch { /* */ }
                            setCustomImageState(null);
                        }
                        return remoteId;
                    });
                },
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userId, isPageVisible]);

    const setAvatar = useCallback((id: string) => {
        setAvatarId(id);
        try {
            localStorage.setItem(STORAGE_KEY, id);
        } catch {
            // localStorage full or unavailable
        }
        if (userId) syncAvatarToSupabase(userId, id);
    }, [userId]);

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
        if (userId) syncAvatarToSupabase(userId, 'custom');
    }, [userId]);

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
        if (userId) syncAvatarToSupabase(userId, fallback);
    }, [userId]);

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
