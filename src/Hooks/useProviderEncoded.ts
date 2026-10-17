import { useState, useMemo, useEffect } from 'react';
import { useUserProfile } from './useUserProfile';
import { encodeProviderNote, encodeProviderBundle } from '../Utilities/noteParser';
import { encryptBarcode } from '../Utilities/barcodeCodec';
import { selectIsAuthenticated, useAuthStore } from '../stores/useAuthStore';
import type { ImportedMedicNote } from '../Components/ProviderDrawer';
import type { PEState } from '../Types/PETypes';

interface ProviderEncodedInput {
    hpiNote: string;
    peNote: string;
    peState?: PEState | null;
    assessmentNote: string;
    planNote: string;
    importedMedicNote?: ImportedMedicNote | null;
    medicBarcode?: string;
}

/**
 * Provider note barcode string — the bundle (medic + provider) when a medic note
 * was imported, else provider-only; AES "enc:" token when signed in. Lifted out of
 * ProviderNoteOutput so the drawer can save the same string to My Notes.
 */
export function useProviderEncoded({
    hpiNote, peNote, peState, assessmentNote, planNote, importedMedicNote, medicBarcode,
}: ProviderEncodedInput): string {
    const { profile } = useUserProfile();
    const isAuthenticated = useAuthStore(selectIsAuthenticated);
    const userId = useAuthStore(s => s.user?.id);

    const compactString = useMemo(() => {
        const providerOptions = {
            hpiNote,
            peNote,
            peState: peState ?? undefined,
            assessmentNote,
            planNote,
            user: profile ?? undefined,
            userId: userId ?? undefined,
        };

        if (importedMedicNote && medicBarcode) {
            return encodeProviderBundle(medicBarcode, providerOptions);
        }
        return encodeProviderNote(providerOptions);
    }, [hpiNote, peNote, peState, assessmentNote, planNote, profile, userId, importedMedicNote, medicBarcode]);

    const [encodedValue, setEncodedValue] = useState(compactString);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!isAuthenticated) {
                if (!cancelled) { setEncodedValue(compactString); }
                return;
            }
            try {
                const encrypted = await encryptBarcode(compactString);
                if (!cancelled) {
                    setEncodedValue(encrypted ?? compactString);
                }
            } catch {
                if (!cancelled) { setEncodedValue(compactString); }
            }
        })();
        return () => { cancelled = true; };
    }, [compactString, isAuthenticated]);

    return encodedValue;
}
