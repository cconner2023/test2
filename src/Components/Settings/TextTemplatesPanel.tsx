import { useState, useCallback, useEffect, useMemo } from 'react';
import { useUserProfile } from '../../Hooks/useUserProfile';
import { useAuthStore } from '../../stores/useAuthStore';
import { updateClinicNoteContent } from '../../lib/supervisorService';
import type { UserTypes, TextExpander } from '../../Data/User';
import { parseFieldText } from '../../Utilities/templateParser';
import { TextExpanderManager } from './TextExpanderManager';
import { TextExpanderEditPopover, type TextExpanderEditState, type ExpanderScope } from './TextExpanderEditPopover';
import { DEMO_EXPANDER_ABBR, DEMO_EXPANDER_BUILDS } from '../../Data/GuidedTourData';

export const TextTemplatesPanel = () => {
    const { profile, updateProfile, syncProfileField } = useUserProfile();
    const clinicTextExpanders = useAuthStore(s => s.clinicTextExpanders);
    const isSupervisorRole = useAuthStore(s => s.isSupervisorRole);
    const clinicId = useAuthStore(s => s.clinicId);

    const textExpanders = profile.textExpanders ?? [];
    const [filter, setFilter] = useState('');

    const allExpanders = useMemo(() => {
        return [...clinicTextExpanders, ...textExpanders];
    }, [textExpanders, clinicTextExpanders]);

    const clinicAbbrSet = useMemo(() =>
        new Set(clinicTextExpanders.map(e => e.abbr.toLowerCase())),
        [clinicTextExpanders]
    );

    const [editState, setEditState] = useState<TextExpanderEditState | null>(null);

    const handleUpdate = useCallback((fields: Partial<UserTypes>) => {
        updateProfile(fields);
        const dbFields: Record<string, unknown> = {};
        if (fields.textExpanders !== undefined) dbFields.text_expanders = fields.textExpanders;
        syncProfileField(dbFields);
    }, [updateProfile, syncProfileField]);

    const handleStartNew = useCallback((anchor: HTMLElement) => {
        setEditState({
            mode: 'new',
            type: 'simple',
            anchor: anchor.getBoundingClientRect(),
            source: 'personal',
        });
    }, []);

    const handleCardTap = useCallback((expander: TextExpander, anchor: HTMLElement) => {
        const isClinic = clinicTextExpanders.some(e => e.abbr === expander.abbr);
        if (isClinic && !isSupervisorRole) return;
        setEditState({
            mode: 'edit',
            expander,
            anchor: anchor.getBoundingClientRect(),
            source: isClinic ? 'clinic' : 'personal',
        });
    }, [clinicTextExpanders, isSupervisorRole]);

    const writeClinic = useCallback((next: TextExpander[]) => {
        if (!clinicId) return;
        updateClinicNoteContent(clinicId, { textExpanders: next });
        useAuthStore.setState({ clinicTextExpanders: next });
    }, [clinicId]);

    const handleSave = useCallback((entry: TextExpander, source: ExpanderScope, originalAbbr?: string, originalSource?: ExpanderScope) => {
        const personal = profile.textExpanders ?? [];
        const clinic = clinicTextExpanders;

        // Promotion: remove from old scope, add to new
        if (originalAbbr && originalSource && originalSource !== source) {
            if (originalSource === 'clinic' && clinicId) {
                writeClinic(clinic.filter(e => e.abbr !== originalAbbr));
                handleUpdate({ textExpanders: [...personal, entry] });
            } else {
                handleUpdate({ textExpanders: personal.filter(e => e.abbr !== originalAbbr) });
                if (clinicId) writeClinic([...clinic, entry]);
            }
            setEditState(null);
            return;
        }

        // Same-scope save
        if (source === 'clinic' && clinicId) {
            const next = originalAbbr
                ? clinic.map(e => e.abbr === originalAbbr ? entry : e)
                : [...clinic, entry];
            writeClinic(next);
        } else {
            const next = originalAbbr
                ? personal.map(e => e.abbr === originalAbbr ? entry : e)
                : [...personal, entry];
            handleUpdate({ textExpanders: next });
        }
        setEditState(null);
    }, [profile.textExpanders, clinicTextExpanders, clinicId, writeClinic, handleUpdate]);

    const handleDelete = useCallback((abbr: string) => {
        if (!editState) return;
        if (editState.source === 'clinic' && clinicId) {
            writeClinic(clinicTextExpanders.filter(e => e.abbr !== abbr));
        } else {
            const current = profile.textExpanders ?? [];
            handleUpdate({ textExpanders: current.filter(e => e.abbr !== abbr) });
        }
        setEditState(null);
    }, [editState, clinicId, clinicTextExpanders, profile.textExpanders, writeClinic, handleUpdate]);

    // ── Tour: open popover pre-filled with the demo template ──
    useEffect(() => {
        const handleSubmit = () => {
            setEditState({
                mode: 'new',
                type: 'simple',
                anchor: null,
                source: 'personal',
                seed: { abbr: DEMO_EXPANDER_ABBR, expansion: '' },
            });
        };
        const handleBuild = (e: Event) => {
            const step = (e as CustomEvent).detail as string;
            const build = DEMO_EXPANDER_BUILDS[step];
            if (!build) return;
            window.dispatchEvent(new CustomEvent('tour:expander-detail-build', { detail: build }));
        };
        const handleAccept = () => {
            const build = DEMO_EXPANDER_BUILDS.complete;
            const nodes = parseFieldText(build.expansion, build.fields);
            const entry: TextExpander = { abbr: DEMO_EXPANDER_ABBR, expansion: '', template: nodes };
            const current = profile.textExpanders ?? [];
            handleUpdate({ textExpanders: [...current, entry] });
            setEditState(null);
        };
        const handleCleanup = () => {
            const current = profile.textExpanders ?? [];
            const filtered = current.filter(e => e.abbr !== DEMO_EXPANDER_ABBR);
            if (filtered.length !== current.length) handleUpdate({ textExpanders: filtered });
            setEditState(null);
        };

        window.addEventListener('tour:expander-submit', handleSubmit);
        window.addEventListener('tour:expander-build', handleBuild);
        window.addEventListener('tour:expander-accept', handleAccept);
        window.addEventListener('tour:expander-cleanup', handleCleanup);
        return () => {
            window.removeEventListener('tour:expander-submit', handleSubmit);
            window.removeEventListener('tour:expander-build', handleBuild);
            window.removeEventListener('tour:expander-accept', handleAccept);
            window.removeEventListener('tour:expander-cleanup', handleCleanup);
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div data-tour="expander-usage-hint" className="h-full overflow-y-auto">
            <div className="px-5 py-4 space-y-5">
                <p data-tour="expander-edit-hint" className="text-[10pt] text-tertiary leading-relaxed">
                    Autotext shortcuts that expand abbreviations as you type in your notes.
                    {clinicTextExpanders.length > 0 && (
                        <span className="text-tertiary"> Includes clinic-wide shortcuts.</span>
                    )}
                </p>

                <TextExpanderManager
                    expanders={allExpanders}
                    clinicAbbrSet={clinicAbbrSet}
                    onCardTap={handleCardTap}
                    onStartNew={handleStartNew}
                    filter={filter}
                    onFilterChange={setFilter}
                    isSupervisorRole={isSupervisorRole}
                />
            </div>

            <TextExpanderEditPopover
                state={editState}
                existingAbbrs={allExpanders.map(e => e.abbr)}
                isSupervisorRole={isSupervisorRole}
                onClose={() => setEditState(null)}
                onSave={handleSave}
                onDelete={handleDelete}
            />
        </div>
    );
};
