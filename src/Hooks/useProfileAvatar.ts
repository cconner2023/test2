import { useState, useCallback, useEffect, useRef } from 'react';
import { profileAvatars } from '../Data/ProfileAvatars';
import type { ProfileAvatar } from '../Data/ProfileAvatars';
import { supabase } from '../lib/supabase';
import { usePageVisibility } from './usePageVisibility';
import { useSupabaseSubscription } from './useSupabaseSubscription';
import { createLogger } from '../Utilities/Logger';
import type { AvatarBlob } from '../Types/SupervisorTestTypes';
import {
    saveOwnAvatarBlob,
    clearOwnAvatarBlob,
    fetchOwnAvatarBlob,
    decryptAvatarToUrl,
    seedAvatarCache,
} from '../lib/avatarBlobService';

const logger = createLogger('ProfileAvatar');

const STORAGE_KEY = 'adtmc_profile_avatar';
const CUSTOM_IMAGE_KEY = 'adtmc_profile_custom_avatar';

function loadAvatarId(): string {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved === 'custom' || saved === 'initials') return saved;
        if (saved && profileAvatars.some(a => a.id === saved)) {
            return saved;
        }
    } catch {
        // localStorage unavailable
    }
    // Default to initials for new users
    try {
        localStorage.setItem(STORAGE_KEY, 'initials');
    } catch {
        // localStorage full or unavailable
    }
    return 'initials';
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
            if (error) logger.error('Failed to sync avatar:', error.message);
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

/**
 * Manages profile avatar selection, custom image upload, localStorage persistence,
 * and cross-device sync via Supabase realtime.
 */
export function useProfileAvatar(userId?: string) {
    const [avatarId, setAvatarId] = useState<string>(loadAvatarId);
    const [customImage, setCustomImageState] = useState<string | null>(loadCustomImage);
    const hasSyncedRef = useRef<string | null>(null);
    const isPageVisible = usePageVisibility();

    const isCustom = avatarId === 'custom' && customImage !== null;
    const isInitials = avatarId === 'initials';

    const currentAvatar: ProfileAvatar =
        profileAvatars.find(a => a.id === avatarId) ?? profileAvatars[0];

    // Seed the shared avatar cache from this device's local custom photo so the
    // signed-in user's own UserAvatar (nav, lists) renders without a decrypt.
    useEffect(() => {
        if (userId && customImage && avatarId === 'custom') {
            seedAvatarCache(`user:${userId}`, customImage);
        }
    }, [userId, customImage, avatarId]);

    // On login, fetch avatar_id from Supabase and apply it (once per userId)
    useEffect(() => {
        if (!userId || hasSyncedRef.current === userId) return;
        hasSyncedRef.current = userId;

        supabase
            .from('profiles')
            .select('avatar_id, avatar_blob')
            .eq('id', userId)
            .single()
            .then(({ data }) => {
                const remoteId = data?.avatar_id;
                if (!remoteId) {
                    // No avatar saved remotely yet — push the local one up. A local
                    // custom photo persists its encrypted blob; everything else is
                    // just the avatar_id string.
                    if (avatarId === 'custom' && customImage) {
                        void saveOwnAvatarBlob(customImage);
                    } else {
                        syncAvatarToSupabase(userId, avatarId);
                    }
                    return;
                }
                // Custom photo: adopt 'custom' and rehydrate the image from the
                // encrypted blob when this device has none (e.g. a fresh device).
                if (remoteId === 'custom') {
                    setAvatarId('custom');
                    try { localStorage.setItem(STORAGE_KEY, 'custom'); } catch { /* */ }
                    const blob = (data?.avatar_blob as AvatarBlob | null | undefined) ?? null;
                    if (customImage) {
                        seedAvatarCache(`user:${userId}`, customImage);
                    } else if (blob) {
                        decryptAvatarToUrl(blob).then(url => {
                            if (!url) return;
                            setCustomImageState(url);
                            try { localStorage.setItem(CUSTOM_IMAGE_KEY, url); } catch { /* */ }
                            seedAvatarCache(`user:${userId}`, url);
                        });
                    }
                    return;
                }
                // Apply remote avatar if it's a valid pre-made avatar or 'initials'
                if (remoteId === 'initials' || profileAvatars.some(a => a.id === remoteId)) {
                    setAvatarId(remoteId);
                    try { localStorage.setItem(STORAGE_KEY, remoteId); } catch { /* */ }
                }
            });
    }, [userId, avatarId]);

    // Realtime: subscribe to avatar_id changes on the user's own profile row
    // so that changing avatar on one device updates all other logged-in devices.
    // Pauses when the page is backgrounded to reduce battery drain.
    useSupabaseSubscription<{ avatar_id: string | null; avatar_blob?: AvatarBlob | null }>({
        shouldSubscribe: !!userId && isPageVisible,
        channelName: `profile-avatar:${userId ?? ''}`,
        postgresFilter: { table: 'profiles', filter: `id=eq.${userId}` },
        onPayload: (payload) => {
            if (payload.eventType !== 'UPDATE') return;
            const newRow = payload.new as { avatar_id: string | null; avatar_blob?: AvatarBlob | null };
            const remoteId = newRow.avatar_id;
            if (!remoteId) return;

            // Only apply if it differs from the current local state
            // Accept 'initials' as a valid remote avatar value
            setAvatarId(prev => {
                if (prev === remoteId) return prev;
                if (remoteId !== 'initials' && remoteId !== 'custom' && !profileAvatars.some(a => a.id === remoteId)) return prev;
                try { localStorage.setItem(STORAGE_KEY, remoteId); } catch { /* */ }
                // If switching away from custom, clear the custom image locally
                if (remoteId !== 'custom') {
                    try { localStorage.removeItem(CUSTOM_IMAGE_KEY); } catch { /* */ }
                    setCustomImageState(null);
                }
                return remoteId;
            });

            // Custom photo set/changed on another device — decrypt the new blob
            // (carried inline on the realtime row; fall back to a fetch) and adopt it.
            if (remoteId === 'custom') {
                const apply = (url: string | null) => {
                    if (!url) return;
                    setCustomImageState(url);
                    try { localStorage.setItem(CUSTOM_IMAGE_KEY, url); } catch { /* */ }
                    if (userId) seedAvatarCache(`user:${userId}`, url);
                };
                const blob = newRow.avatar_blob ?? null;
                if (blob) void decryptAvatarToUrl(blob).then(apply);
                else void fetchOwnAvatarBlob().then(b => { if (b) void decryptAvatarToUrl(b).then(apply); });
            }
        },
        logger,
    });

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
        // Seed the shared cache so the signed-in user's photo renders instantly
        // everywhere (nav, lists) before the network round-trip completes.
        if (userId) seedAvatarCache(`user:${userId}`, dataUrl);
        // Persist the encrypted blob AND flip avatar_id to 'custom' in one write
        // (replaces the old avatar_id-only sync, which left peers with no image).
        void saveOwnAvatarBlob(dataUrl);
    }, [userId]);

    const clearCustomImage = useCallback(() => {
        try {
            localStorage.removeItem(CUSTOM_IMAGE_KEY);
        } catch {
            // ignore
        }
        setCustomImageState(null);
        // Fall back to initials when custom image is cleared
        setAvatarId('initials');
        try {
            localStorage.setItem(STORAGE_KEY, 'initials');
        } catch {
            // ignore
        }
        if (userId) syncAvatarToSupabase(userId, 'initials');
        // Drop the persisted encrypted blob too (avatar_id handled above).
        void clearOwnAvatarBlob();
    }, [userId]);

    return {
        currentAvatar,
        setAvatar,
        avatarList: profileAvatars,
        customImage,
        isCustom,
        isInitials,
        setCustomImage,
        clearCustomImage,
    };
}
