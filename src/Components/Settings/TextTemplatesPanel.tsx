import { useState, useCallback, useEffect, useMemo } from 'react';
import { useUserProfile } from '../../Hooks/useUserProfile';
import { useAuthStore } from '../../stores/useAuthStore';
import { useEditableClinicContent } from '../../Hooks/useEditableClinicContent';
import type { UserTypes, TextExpander } from '../../Data/User';
import { parseFieldText } from '../../Utilities/templateParser';
import { SearchInput } from '../SearchInput';
import { TextExpanderManager } from './TextExpanderManager';
import { TextExpanderEditPopover, type TextExpanderEditState, type ExpanderScope } from './TextExpanderEditPopover';
import { useClusterEditItem } from './ClusterEditPicker';
import { useNoteBlocksTransferItems } from './NoteBlocksTransferMenu';
import { useNoteBlocksTransfer } from '../../Hooks/useNoteBlocksTransfer';
import { DEMO_EXPANDER_ABBR, DEMO_EXPANDER_BUILDS } from '../../Data/GuidedTourData';

export const TextTemplatesPanel = () => {
    const { profile, updateProfile, syncProfileField } = useUserProfile();
    const transfer = useNoteBlocksTransfer();
    const isSupervisorRole = useAuthStore(s => s.isSupervisorRole);
    const homeClinicId = useAuthStore(s => s.clinicId);
    const [editingClinicId, setEditingClinicId] = useState<string | null>(homeClinicId);
    const { content: clinicContent, update: updateClinicContent } = useEditableClinicContent(editingClinicId);
    const clinicTextExpanders = clinicContent.textExpanders;

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

    // ── Consolidated corner ⋯ actions (cluster picker + Share/Export/Import) ──
    const clusterItem = useClusterEditItem({ selectedClinicId: editingClinicId, onSelect: setEditingClinicId });
    const { items: transferItems, overlays: transferOverlays } = useNoteBlocksTransferItems({
        baseName: 'text templates',
        kind: 'templates',
        data: { textExpanders },
        hasData: textExpanders.length > 0,
    });
    const cornerItems = [...(clusterItem ? [clusterItem] : []), ...transferItems];

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
        if (!editingClinicId) return;
        updateClinicContent({ textExpanders: next });
    }, [editingClinicId, updateClinicContent]);

    const handleSave = useCallback((entry: TextExpander, source: ExpanderScope, originalAbbr?: string, originalSource?: ExpanderScope) => {
        const personal = profile.textExpanders ?? [];
        const clinic = clinicTextExpanders;

        // Promotion: remove from old scope, add to new
        if (originalAbbr && originalSource && originalSource !== source) {
            if (originalSource === 'clinic' && editingClinicId) {
                writeClinic(clinic.filter(e => e.abbr !== originalAbbr));
                handleUpdate({ textExpanders: [...personal, entry] });
            } else {
                handleUpdate({ textExpanders: personal.filter(e => e.abbr !== originalAbbr) });
                if (editingClinicId) writeClinic([...clinic, entry]);
            }
            setEditState(null);
            return;
        }

        // Same-scope save
        if (source === 'clinic' && editingClinicId) {
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
    }, [profile.textExpanders, clinicTextExpanders, editingClinicId, writeClinic, handleUpdate]);

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
        <>
            <div className="px-3 pb-2 pt-[calc(var(--drawer-header-h,3.5rem)+0.75rem)]">
                <SearchInput
                    value={filter}
                    onChange={setFilter}
                    placeholder="Search shortcuts..."
                />
            </div>
            <div data-tour="expander-usage-hint" className="px-5 py-4 space-y-5">
                    <p data-tour="expander-edit-hint" className="text-[10pt] text-tertiary leading-relaxed">
                        Autotext shortcuts that expand abbreviations as you type in your notes.
                        {clinicTextExpanders.length > 0 && (
                            <span className="text-tertiary"> Includes cluster-wide shortcuts.</span>
                        )}
                    </p>

                    <TextExpanderManager
                        expanders={allExpanders}
                        clinicAbbrSet={clinicAbbrSet}
                        onCardTap={handleCardTap}
                        onStartNew={handleStartNew}
                        onShareItem={(e) => transfer.share({ textExpanders: [e] }, e.abbr)}
                        onDeleteItem={(e) => {
                            const isClinic = clinicAbbrSet.has(e.abbr.toLowerCase());
                            if (isClinic && editingClinicId) writeClinic(clinicTextExpanders.filter(x => x.abbr !== e.abbr));
                            else handleUpdate({ textExpanders: (profile.textExpanders ?? []).filter(x => x.abbr !== e.abbr) });
                        }}
                        filter={filter}
                        isSupervisorRole={isSupervisorRole}
                        cornerItems={cornerItems}
                    />
            </div>

            <TextExpanderEditPopover
                state={editState}
                existingAbbrs={allExpanders.map(e => e.abbr)}
                isSupervisorRole={isSupervisorRole}
                onClose={() => setEditState(null)}
                onSave={handleSave}
            />

            {transfer.picker}
            {transferOverlays}
        </>
    );
};
