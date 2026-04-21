import { useState, useCallback, useEffect, useMemo } from 'react';
import { useUserProfile } from '../../Hooks/useUserProfile';
import { useAuthStore } from '../../stores/useAuthStore';
import { updateClinicNoteContent } from '../../lib/supervisorService';
import type { UserTypes, TextExpander } from '../../Data/User';
import type { TemplateNode } from '../../Data/TemplateTypes';
import { parseFieldText, isFlatTemplate, templateNodesToFieldText } from '../../Utilities/templateParser';
import { TextExpanderManager } from './TextExpanderManager';
import type { EditCardState } from './TextExpanderManager';
import { TextTemplateDetailPanel } from './TextTemplateDetailPanel';
import { DEMO_EXPANDER_ABBR, DEMO_EXPANDER_BUILDS } from '../../Data/GuidedTourData';

interface TextTemplatesPanelProps {
    editing?: boolean;
    saveRequested?: boolean;
    onSaveComplete?: () => void;
    onPendingChangesChange?: (hasPending: boolean) => void;
}

export const TextTemplatesPanel = ({
    editing = false, saveRequested, onSaveComplete, onPendingChangesChange,
}: TextTemplatesPanelProps) => {
    const { profile, updateProfile, syncProfileField } = useUserProfile();
    const [scope, setScope] = useState<'personal' | 'clinic'>('personal');
    const clinicTextExpanders = useAuthStore(s => s.clinicTextExpanders);
    const isSupervisorRole = useAuthStore(s => s.isSupervisorRole);
    const clinicId = useAuthStore(s => s.clinicId);

    const textExpanders = profile.textExpanders ?? [];

    const allExpanders = useMemo(() => {
        return [...clinicTextExpanders, ...textExpanders];
    }, [textExpanders, clinicTextExpanders]);

    const clinicAbbrSet = useMemo(() =>
        new Set(clinicTextExpanders.map(e => e.abbr.toLowerCase())),
        [clinicTextExpanders]
    );

    // Staging state
    const [stagedDeletes, setStagedDeletes] = useState<Set<string>>(new Set());
    const [stagedAdds, setStagedAdds] = useState<TextExpander[]>([]);
    const [stagedEdits, setStagedEdits] = useState<Map<string, TextExpander>>(new Map());

    // Input bar state
    const [inputAbbr, setInputAbbr] = useState('');
    const [inputError, setInputError] = useState('');
    const [selectedType, setSelectedType] = useState<'simple' | 'template'>('simple');

    // Inline edit card state
    const [editCard, setEditCard] = useState<EditCardState | null>(null);

    // Detail view for editing existing (tap a card in non-edit mode)
    const [detailExpander, setDetailExpander] = useState<TextExpander | null>(null);
    const [detailSource, setDetailSource] = useState<'personal' | 'clinic'>('personal');

    const hasPending = stagedDeletes.size > 0 || stagedAdds.length > 0 || stagedEdits.size > 0;

    useEffect(() => {
        onPendingChangesChange?.(hasPending);
    }, [hasPending, onPendingChangesChange]);

    const handleUpdate = useCallback((fields: Partial<UserTypes>) => {
        updateProfile(fields);
        const dbFields: Record<string, unknown> = {};
        if (fields.textExpanders !== undefined) dbFields.text_expanders = fields.textExpanders;
        syncProfileField(dbFields);
    }, [updateProfile, syncProfileField]);

    // Commit staged changes when save is requested
    useEffect(() => {
        if (!saveRequested) return;

        // Split staged deletes by provenance
        const clinicDeletes = new Set<string>();
        const personalDeletes = new Set<string>();
        for (const abbr of stagedDeletes) {
            if (clinicAbbrSet.has(abbr.toLowerCase())) clinicDeletes.add(abbr);
            else personalDeletes.add(abbr);
        }

        // Split staged edits by provenance
        const clinicEdits = new Map<string, TextExpander>();
        const personalEdits = new Map<string, TextExpander>();
        for (const [abbr, entry] of stagedEdits) {
            if (clinicAbbrSet.has(abbr.toLowerCase())) clinicEdits.set(abbr, entry);
            else personalEdits.set(abbr, entry);
        }

        // Clinic mutations (deletes + edits from clinic list + adds when scope is clinic)
        const clinicAdds = scope === 'clinic' ? stagedAdds : [];
        if (clinicId && (clinicDeletes.size > 0 || clinicAdds.length > 0 || clinicEdits.size > 0)) {
            let next = clinicTextExpanders
                .filter(e => !clinicDeletes.has(e.abbr))
                .map(e => clinicEdits.get(e.abbr) ?? e);
            if (clinicAdds.length > 0) next = [...next, ...clinicAdds];
            updateClinicNoteContent(clinicId, { textExpanders: next });
            useAuthStore.setState({ clinicTextExpanders: next });
        }

        // Personal mutations (deletes + edits from personal list + adds when scope is personal)
        const personalAdds = scope === 'personal' ? stagedAdds : [];
        if (personalDeletes.size > 0 || personalAdds.length > 0 || personalEdits.size > 0) {
            let next = textExpanders
                .filter(e => !personalDeletes.has(e.abbr))
                .map(e => personalEdits.get(e.abbr) ?? e);
            if (personalAdds.length > 0) next = [...next, ...personalAdds];
            handleUpdate({ textExpanders: next });
        }

        setStagedDeletes(new Set());
        setStagedAdds([]);
        setStagedEdits(new Map());
        setInputAbbr('');
        setInputError('');
        setEditCard(null);
        onSaveComplete?.();
    }, [saveRequested]); // eslint-disable-line react-hooks/exhaustive-deps

    // Clear staging when editing is turned off (cancel)
    useEffect(() => {
        if (!editing) {
            setStagedDeletes(new Set());
            setStagedAdds([]);
            setStagedEdits(new Map());
            setInputAbbr('');
            setInputError('');
            setEditCard(null);
        }
    }, [editing]);

    // Reset staging when scope changes
    useEffect(() => {
        setStagedDeletes(new Set());
        setStagedAdds([]);
        setStagedEdits(new Map());
        setInputAbbr('');
        setInputError('');
        setEditCard(null);
    }, [scope]);

    // Tour system: listen for demo build events
    useEffect(() => {
        const handleSetAbbr = (e: Event) => {
            const abbr = (e as CustomEvent).detail as string;
            setInputAbbr(abbr);
            setSelectedType('simple');
        };
        const handleSubmit = () => {
            setInputAbbr('');
            setInputError('');
            setEditCard({
                abbr: DEMO_EXPANDER_ABBR,
                type: 'simple',
                expansion: '',
                nodes: [],
                fields: {},
                isNew: true,
            });
        };
        const handleBuild = (e: Event) => {
            const step = (e as CustomEvent).detail as string;
            const build = DEMO_EXPANDER_BUILDS[step];
            if (!build) return;
            setEditCard(prev => {
                if (!prev) return prev;
                return { ...prev, expansion: build.expansion, fields: { ...build.fields } };
            });
        };
        const handleAccept = () => {
            const build = DEMO_EXPANDER_BUILDS.complete;
            const nodes = parseFieldText(build.expansion, build.fields);
            setStagedAdds(adds => [...adds, { abbr: DEMO_EXPANDER_ABBR, expansion: '', template: nodes }]);
            setEditCard(null);
        };
        const handleCleanup = () => {
            setStagedAdds([]);
            setEditCard(null);
            setInputAbbr('');
            setInputError('');
        };

        window.addEventListener('tour:expander-set-abbr', handleSetAbbr);
        window.addEventListener('tour:expander-submit', handleSubmit);
        window.addEventListener('tour:expander-build', handleBuild);
        window.addEventListener('tour:expander-accept', handleAccept);
        window.addEventListener('tour:expander-cleanup', handleCleanup);
        return () => {
            window.removeEventListener('tour:expander-set-abbr', handleSetAbbr);
            window.removeEventListener('tour:expander-submit', handleSubmit);
            window.removeEventListener('tour:expander-build', handleBuild);
            window.removeEventListener('tour:expander-accept', handleAccept);
            window.removeEventListener('tour:expander-cleanup', handleCleanup);
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleToggleDelete = useCallback((abbr: string) => {
        setStagedDeletes(prev => {
            const next = new Set(prev);
            if (next.has(abbr)) next.delete(abbr);
            else next.add(abbr);
            return next;
        });
    }, []);

    const handleUnstageAdd = useCallback((abbr: string) => {
        setStagedAdds(prev => prev.filter(e => e.abbr !== abbr));
    }, []);

    // Validate abbreviation and open inline edit card
    const handleInputSubmit = useCallback(() => {
        const trimmed = inputAbbr.trim();
        if (!trimmed) return;
        if (/\s/.test(trimmed)) { setInputError('No spaces allowed'); return; }

        const allAbbrs = [
            ...textExpanders.map(e => e.abbr.toLowerCase()),
            ...clinicTextExpanders.map(e => e.abbr.toLowerCase()),
            ...stagedAdds.map(e => e.abbr.toLowerCase()),
        ];
        if (allAbbrs.includes(trimmed.toLowerCase())) {
            setInputError('Abbreviation already exists');
            return;
        }

        setInputAbbr('');
        setInputError('');
        setEditCard({
            abbr: trimmed,
            type: selectedType,
            expansion: '',
            nodes: [],
            fields: {},
            isNew: true,
        });
    }, [inputAbbr, textExpanders, clinicTextExpanders, stagedAdds, selectedType]);

    const handleClearInput = useCallback(() => {
        setInputAbbr('');
        setInputError('');
    }, []);

    // Edit card accept — stage the new expander
    const handleEditCardAccept = useCallback(() => {
        if (!editCard) return;

        let entry: TextExpander;

        if (editCard.type === 'template') {
            entry = { abbr: editCard.abbr, expansion: '', template: editCard.nodes };
        } else {
            // If the simple text has tracked fields, parse into template nodes
            const hasFields = Object.keys(editCard.fields).some(
                label => editCard.expansion.includes(`[${label}]`),
            );
            if (hasFields) {
                const nodes = parseFieldText(editCard.expansion, editCard.fields);
                entry = { abbr: editCard.abbr, expansion: '', template: nodes };
            } else {
                entry = { abbr: editCard.abbr, expansion: editCard.expansion.trim() };
            }
        }

        if (editCard.isNew) {
            setStagedAdds(prev => [...prev, entry]);
        } else {
            setStagedEdits(prev => {
                const next = new Map(prev);
                next.set(editCard.abbr, entry);
                return next;
            });
        }

        setEditCard(null);
    }, [editCard]);

    // Open inline editor for an existing expander (edit mode tap)
    const handleStartEdit = useCallback((expander: TextExpander) => {
        const current = stagedEdits.get(expander.abbr) ?? expander;
        const nodes = current.template ?? [];
        if (nodes.length > 0 && !isFlatTemplate(nodes)) {
            // Branched template — edit via step builder
            setEditCard({
                abbr: expander.abbr,
                type: 'template',
                expansion: '',
                nodes,
                fields: {},
                isNew: false,
            });
        } else if (nodes.length > 0) {
            // Flat field template — reconstruct simple text + fields
            const round = templateNodesToFieldText(nodes);
            setEditCard({
                abbr: expander.abbr,
                type: 'simple',
                expansion: round?.text ?? '',
                nodes: [],
                fields: round?.fields ?? {},
                isNew: false,
            });
        } else {
            setEditCard({
                abbr: expander.abbr,
                type: 'simple',
                expansion: current.expansion,
                nodes: [],
                fields: {},
                isNew: false,
            });
        }
    }, [stagedEdits]);

    // Delete from inside the inline editor
    const handleEditCardDelete = useCallback(() => {
        if (!editCard) return;
        setStagedDeletes(prev => {
            const next = new Set(prev);
            next.add(editCard.abbr);
            return next;
        });
        // Drop any pending edit for this abbr — the delete supersedes it
        setStagedEdits(prev => {
            if (!prev.has(editCard.abbr)) return prev;
            const next = new Map(prev);
            next.delete(editCard.abbr);
            return next;
        });
        setEditCard(null);
    }, [editCard]);

    const handleEditCardCancel = useCallback(() => {
        setEditCard(null);
    }, []);

    // Open detail for editing an existing expander (non-edit mode tap)
    const handleCardTap = useCallback((expander: TextExpander) => {
        const isClinic = clinicTextExpanders.some(e => e.abbr === expander.abbr);
        if (isClinic && !isSupervisorRole) return; // non-supervisors can't edit clinic items
        setDetailExpander(expander);
        setDetailSource(isClinic ? 'clinic' : 'personal');
    }, [clinicTextExpanders, isSupervisorRole]);

    // Detail panel save handler (editing existing)
    const handleDetailSave = useCallback((entry: TextExpander, originalAbbr?: string) => {
        if (detailSource === 'clinic' && clinicId) {
            const current = [...clinicTextExpanders];
            const next = originalAbbr
                ? current.map(e => e.abbr === originalAbbr ? entry : e)
                : [...current, entry];
            updateClinicNoteContent(clinicId, { textExpanders: next });
            useAuthStore.setState({ clinicTextExpanders: next });
        } else {
            const current = profile.textExpanders ?? [];
            const next = originalAbbr
                ? current.map(e => e.abbr === originalAbbr ? entry : e)
                : [...current, entry];
            handleUpdate({ textExpanders: next });
        }
        setDetailExpander(null);
    }, [detailSource, clinicId, clinicTextExpanders, profile.textExpanders, handleUpdate]);

    // Detail panel delete handler
    const handleDetailDelete = useCallback((abbr: string) => {
        if (detailSource === 'clinic' && clinicId) {
            const next = clinicTextExpanders.filter(e => e.abbr !== abbr);
            updateClinicNoteContent(clinicId, { textExpanders: next });
            useAuthStore.setState({ clinicTextExpanders: next });
        } else {
            const current = profile.textExpanders ?? [];
            const next = current.filter(e => e.abbr !== abbr);
            handleUpdate({ textExpanders: next });
        }
        setDetailExpander(null);
    }, [detailSource, clinicId, clinicTextExpanders, profile.textExpanders, handleUpdate]);

    // ── Detail view for editing existing ──
    if (detailExpander) {
        return (
            <TextTemplateDetailPanel
                expander={detailExpander}
                isNew={false}
                existingAbbrs={allExpanders.map(e => e.abbr)}
                onSave={handleDetailSave}
                onDelete={handleDetailDelete}
                onCancel={() => setDetailExpander(null)}
            />
        );
    }

    // ── List view ──
    return (
        <div data-tour="expander-usage-hint" className="h-full overflow-y-auto">
            <div className="px-5 py-4 space-y-5">
                <p data-tour="expander-edit-hint" className="text-xs text-tertiary leading-relaxed">
                    Autotext shortcuts that expand abbreviations as you type in your notes.
                    {clinicTextExpanders.length > 0 && (
                        <span className="text-tertiary"> Includes clinic-wide shortcuts.</span>
                    )}
                </p>

                <TextExpanderManager
                    expanders={allExpanders}
                    clinicAbbrSet={clinicAbbrSet}
                    editing={editing}
                    stagedDeletes={stagedDeletes}
                    stagedAdds={stagedAdds}
                    stagedEdits={stagedEdits}
                    onToggleDelete={handleToggleDelete}
                    onUnstageAdd={handleUnstageAdd}
                    onCardTap={handleCardTap}
                    onStartEdit={handleStartEdit}
                    inputAbbr={inputAbbr}
                    onInputAbbrChange={(v) => { setInputAbbr(v); setInputError(''); }}
                    onInputAbbrSubmit={handleInputSubmit}
                    inputError={inputError}
                    onClearInput={handleClearInput}
                    selectedType={selectedType}
                    onTypeChange={setSelectedType}
                    editCard={editCard}
                    onEditCardChange={setEditCard}
                    onEditCardAccept={handleEditCardAccept}
                    onEditCardCancel={handleEditCardCancel}
                    onEditCardDelete={handleEditCardDelete}
                    scope={scope}
                    onScopeChange={setScope}
                    isSupervisorRole={isSupervisorRole}
                />
            </div>
        </div>
    );
};
