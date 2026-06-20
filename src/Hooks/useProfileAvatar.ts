import { useState, useCallback, useEffect, useRef } from 'react';
import { profileAvatars } from '../Data/ProfileAvatars';
import type { ProfileAvatar } from '../Data/ProfileAvatars';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/useAuthStore';
import { createLogger } from '../Utilities/Logger';
import {
    saveOwnAvatarBlob,
    clearOwnAvatarBlob,
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
 * Manages the signed-in user's avatar: selection, custom-image upload/encryption,
 * and localStorage persistence. Cross-device sync is now sourced from the profile
 * cache (PROFILE_SELECT pulls avatar_id/avatar_blob; useProfileRealtime applies
 * live deltas) — this hook no longer owns a Supabase fetch or realtime channel.
 * Self-only: localStorage keys are device-global, so `userId` is the signed-in
 * user (also the cache-seed key), not an arbitrary profile.
 */
export function useProfileAvatar(userId?: string) {
    const [avatarId, setAvatarId] = useState<string>(loadAvatarId);
    const [customImage, setCustomImageState] = useState<string | null>(loadCustomImage);
    const pushedRef = useRef(false);
    const lastBlobKeyRef = useRef<string | null>(null);

    // Avatar now lives on the profile cache: PROFILE_SELECT pulls avatar_id /
    // avatar_blob and useProfileRealtime applies cross-device deltas. This hook
    // reads from the store instead of owning a Supabase fetch + realtime channel
    // (the channel moved to useProfileRealtime; owning it here, mounted twice,
    // was the duplicate-topic "binding mismatch" source).
    const storeAvatarId = useAuthStore(s => s.profile.avatarId);
    const storeAvatarBlob = useAuthStore(s => s.profile.avatarBlob);

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

    // Adopt the avatar from the profile cache whenever it resolves or changes
    // cross-device. storeAvatarId is undefined until the profile loads, null when
    // nothing is set remotely, else a valid id. The single profiles-row sub
    // (useProfileRealtime) feeds cross-device deltas here; the login fetch lands
    // via PROFILE_SELECT. No per-hook fetch or channel anymore.
    useEffect(() => {
        if (storeAvatarId === undefined || storeAvatarId === null) return;
        setAvatarId(prev => {
            if (prev === storeAvatarId) return prev;
            if (storeAvatarId !== 'initials' && storeAvatarId !== 'custom' && !profileAvatars.some(a => a.id === storeAvatarId)) return prev;
            try { localStorage.setItem(STORAGE_KEY, storeAvatarId); } catch { /* */ }
            if (storeAvatarId !== 'custom') {
                try { localStorage.removeItem(CUSTOM_IMAGE_KEY); } catch { /* */ }
                setCustomImageState(null);
            }
            return storeAvatarId;
        });
        // Custom photo set/changed elsewhere — decrypt the cached blob when it's
        // new (keyed by blob content so a cross-device photo change is picked up,
        // and the same blob is never re-decrypted in a loop).
        if (storeAvatarId === 'custom' && storeAvatarBlob) {
            const blobKey = JSON.stringify(storeAvatarBlob);
            // Decrypt when the blob is new/changed, OR when we're on 'custom' with
            // no local image (covers custom→initials→same-custom, where the key is
            // unchanged but the image was cleared).
            if (lastBlobKeyRef.current !== blobKey || !customImage) {
                lastBlobKeyRef.current = blobKey;
                void decryptAvatarToUrl(storeAvatarBlob).then(url => {
                    if (!url) return;
                    setCustomImageState(url);
                    try { localStorage.setItem(CUSTOM_IMAGE_KEY, url); } catch { /* */ }
                    if (userId) seedAvatarCache(`user:${userId}`, url);
                });
            }
        }
    }, [storeAvatarId, storeAvatarBlob, userId, customImage]);

    // First login with nothing saved remotely: push this device's local choice
    // up once (mirrors the old fetch effect's null-remote branch).
    useEffect(() => {
        if (!userId || pushedRef.current || storeAvatarId === undefined) return;
        pushedRef.current = true;
        if (storeAvatarId === null) {
            if (avatarId === 'custom' && customImage) void saveOwnAvatarBlob(customImage);
            else if (avatarId !== 'initials') syncAvatarToSupabase(userId, avatarId);
        }
    }, [userId, storeAvatarId, avatarId, customImage]);

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
