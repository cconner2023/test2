import { useState, useCallback, useEffect } from 'react';
import { useUserProfile } from '../../Hooks/useUserProfile';
import type { UserTypes, TextExpander } from '../../Data/User';
import { TextExpanderManager } from './TextExpanderManager';
import { TextTemplateDetailPanel } from './TextTemplateDetailPanel';

interface DetailState {
    expander: TextExpander;
    isNew: boolean;
}

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

    const textExpanders = profile.textExpanders ?? [];

    // Staging state — used only for bulk delete in edit mode
    const [stagedDeletes, setStagedDeletes] = useState<Set<string>>(new Set());

    // Abbreviation input state
    const [inputAbbr, setInputAbbr] = useState('');
    const [inputError, setInputError] = useState('');

    // Inline detail view state
    const [detail, setDetail] = useState<DetailState | null>(null);

    const hasPending = stagedDeletes.size > 0;

    useEffect(() => {
        onPendingChangesChange?.(hasPending);
    }, [hasPending, onPendingChangesChange]);

    const handleUpdate = useCallback((fields: Partial<UserTypes>) => {
        updateProfile(fields);
        const dbFields: Record<string, unknown> = {};
        if (fields.textExpanders !== undefined) dbFields.text_expanders = fields.textExpanders;
        syncProfileField(dbFields);
    }, [updateProfile, syncProfileField]);

    // Commit staged deletes when save is requested
    useEffect(() => {
        if (!saveRequested) return;

        if (stagedDeletes.size > 0) {
            const next = textExpanders.filter(e => !stagedDeletes.has(e.abbr));
            handleUpdate({ textExpanders: next });
        }

        setStagedDeletes(new Set());
        setInputAbbr('');
        setInputError('');
        setDetail(null);
        onSaveComplete?.();
    }, [saveRequested]); // eslint-disable-line react-hooks/exhaustive-deps

    // Clear staging when editing is turned off (cancel)
    useEffect(() => {
        if (!editing) {
            setStagedDeletes(new Set());
            setInputAbbr('');
            setInputError('');
            setDetail(null);
        }
    }, [editing]);

    const handleToggleDelete = useCallback((abbr: string) => {
        setStagedDeletes(prev => {
            const next = new Set(prev);
            if (next.has(abbr)) next.delete(abbr);
            else next.add(abbr);
            return next;
        });
    }, []);

    // Validate abbreviation and open detail inline
    const handleInputSubmit = useCallback(() => {
        const trimmed = inputAbbr.trim();
        if (!trimmed) return;
        if (/\s/.test(trimmed)) { setInputError('No spaces allowed'); return; }

        const allAbbrs = textExpanders.map(e => e.abbr.toLowerCase());
        if (allAbbrs.includes(trimmed.toLowerCase())) {
            setInputError('Abbreviation already exists');
            return;
        }

        setInputAbbr('');
        setInputError('');
        setDetail({ expander: { abbr: trimmed, expansion: '' }, isNew: true });
    }, [inputAbbr, textExpanders]);

    const handleClearInput = useCallback(() => {
        setInputAbbr('');
        setInputError('');
    }, []);

    // Open detail for editing an existing expander
    const handleCardTap = useCallback((expander: TextExpander) => {
        setDetail({ expander, isNew: false });
    }, []);

    // Detail panel save handler
    const handleDetailSave = useCallback((entry: TextExpander, originalAbbr?: string) => {
        const current = profile.textExpanders ?? [];
        const next = originalAbbr
            ? current.map(e => e.abbr === originalAbbr ? entry : e)
            : [...current, entry];

        handleUpdate({ textExpanders: next });
        setDetail(null);
    }, [profile.textExpanders, handleUpdate]);

    // Detail panel delete handler
    const handleDetailDelete = useCallback((abbr: string) => {
        const current = profile.textExpanders ?? [];
        const next = current.filter(e => e.abbr !== abbr);

        handleUpdate({ textExpanders: next });
        setDetail(null);
    }, [profile.textExpanders, handleUpdate]);

    // ── Inline detail view ──
    if (detail) {
        return (
            <TextTemplateDetailPanel
                expander={detail.expander}
                isNew={detail.isNew}
                existingAbbrs={textExpanders.map(e => e.abbr)}
                onSave={handleDetailSave}
                onDelete={!detail.isNew ? handleDetailDelete : undefined}
                onCancel={() => setDetail(null)}
            />
        );
    }

    // ── List view ──
    return (
        <div className="h-full overflow-y-auto">
            <div className="px-5 py-4 space-y-5">
                <p className="text-xs text-tertiary leading-relaxed">
                    Autotext shortcuts that expand abbreviations as you type in your notes.
                </p>

                <TextExpanderManager
                    expanders={textExpanders}
                    editing={editing}
                    stagedDeletes={stagedDeletes}
                    stagedAdds={[]}
                    onToggleDelete={handleToggleDelete}
                    onUnstageAdd={() => {}}
                    onCardTap={handleCardTap}
                    inputAbbr={inputAbbr}
                    onInputAbbrChange={(v) => { setInputAbbr(v); setInputError(''); }}
                    onInputAbbrSubmit={handleInputSubmit}
                    inputError={inputError}
                    onClearInput={handleClearInput}
                />
            </div>
        </div>
    );
};
