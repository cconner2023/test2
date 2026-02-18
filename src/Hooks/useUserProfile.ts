import { useState, useCallback, useEffect } from 'react';
import type { UserTypes } from '../Data/User';
import { supabase } from '../lib/supabase';
import { isPinEnabled, hydrateFromCloud } from '../lib/pinService';

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

function saveProfile(profile: UserTypes) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch {
        // localStorage full or unavailable
    }
}

export function useUserProfile() {
    const [profile, setProfile] = useState<UserTypes>(loadProfile);

    // Sync profile from Supabase on auth state changes
    useEffect(() => {
        const fetchProfile = async (userId: string) => {
            const { data } = await supabase
                .from('profiles')
                .select('first_name, last_name, middle_initial, credential, component, rank, uic, clinics(name)')
                .eq('id', userId)
                .single();

            if (data) {
                // clinics is returned as an object { name } or null from the foreign-key join
                const clinicRow = data.clinics as { name: string } | null;

                const next: UserTypes = {
                    firstName: data.first_name ?? undefined,
                    lastName: data.last_name ?? undefined,
                    middleInitial: data.middle_initial ?? undefined,
                    credential: (data.credential as UserTypes['credential']) ?? undefined,
                    component: (data.component as UserTypes['component']) ?? undefined,
                    rank: data.rank ?? undefined,
                    uic: data.uic ?? undefined,
                    clinicName: clinicRow?.name ?? undefined,
                };

                // Best-effort: fetch security columns (may not exist pre-migration)
                try {
                    const { data: sec } = await supabase
                        .from('profiles')
                        .select('pin_hash, pin_salt, notifications_enabled')
                        .eq('id', userId)
                        .single();

                    if (sec) {
                        if (sec.pin_hash && sec.pin_salt && !isPinEnabled()) {
                            hydrateFromCloud(sec.pin_hash, sec.pin_salt);
                        }
                        next.notificationsEnabled = sec.notifications_enabled ?? false;
                    }
                } catch {
                    // columns don't exist yet — ignore
                }

                setProfile(next);
                saveProfile(next);
            }
        };

        // Check current session on mount
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user) {
                fetchProfile(user.id);
            }
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
                if (session?.user) {
                    fetchProfile(session.user.id);
                } else if (event === 'SIGNED_OUT') {
                    setProfile({});
                    try {
                        localStorage.removeItem(STORAGE_KEY);
                    } catch {
                        // localStorage unavailable
                    }
                }
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    const updateProfile = useCallback((fields: Partial<UserTypes>) => {
        setProfile(prev => {
            const next = { ...prev, ...fields };
            saveProfile(next);
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
