// Hooks/useClinicNameResolver.ts — Resolve clinic name from clinicId via Supabase
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

/** Module-level cache to avoid re-fetching the same clinic name. */
const clinicNameCache = new Map<string, string>();

/** Returns the clinic name for the given clinicId, or null if not yet resolved / not found. */
export function useClinicName(clinicId: string | null): string | null {
    const [name, setName] = useState<string | null>(() => {
        if (!clinicId) return null;
        return clinicNameCache.get(clinicId) ?? null;
    });

    useEffect(() => {
        if (!clinicId) {
            setName(null);
            return;
        }

        // Already cached
        if (clinicNameCache.has(clinicId)) {
            setName(clinicNameCache.get(clinicId)!);
            return;
        }

        let cancelled = false;

        supabase
            .from('clinics')
            .select('name')
            .eq('id', clinicId)
            .single()
            .then(({ data }) => {
                if (cancelled) return;
                const resolved = data?.name ?? null;
                if (resolved) {
                    clinicNameCache.set(clinicId, resolved);
                }
                setName(resolved);
            });

        return () => { cancelled = true; };
    }, [clinicId]);

    return name;
}
