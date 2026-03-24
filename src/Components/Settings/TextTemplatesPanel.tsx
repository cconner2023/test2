import { useState, useCallback, useEffect } from 'react';
import { useUserProfile } from '../../Hooks/useUserProfile';
import type { UserTypes, TextExpander } from '../../Data/User';
import type { TemplateNode } from '../../Data/TemplateTypes';
import { parseFieldText } from '../../Utilities/templateParser';
import { TextExpanderManager } from './TextExpanderManager';
import type { EditCardState } from './TextExpanderManager';
import { TextTemplateDetailPanel } from './TextTemplateDetailPanel';

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

    // Staging state
    const [stagedDeletes, setStagedDeletes] = useState<Set<string>>(new Set());
    const [stagedAdds, setStagedAdds] = useState<TextExpander[]>([]);

    // Input bar state
    const [inputAbbr, setInputAbbr] = useState('');
    const [inputError, setInputError] = useState('');
    const [selectedType, setSelectedType] = useState<'simple' | 'template'>('simple');

    // Inline edit card state
    const [editCard, setEditCard] = useState<EditCardState | null>(null);

    // Detail view for editing existing (tap a card in non-edit mode)
    const [detailExpander, setDetailExpander] = useState<TextExpander | null>(null);

    const hasPending = stagedDeletes.size > 0 || stagedAdds.length > 0;

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

        const current = [...textExpanders];
        let next = current.filter(e => !stagedDeletes.has(e.abbr));
        if (stagedAdds.length > 0) {
            next = [...next, ...stagedAdds];
        }

        if (stagedDeletes.size > 0 || stagedAdds.length > 0) {
            handleUpdate({ textExpanders: next });
        }

        setStagedDeletes(new Set());
        setStagedAdds([]);
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
            setInputAbbr('');
            setInputError('');
            setEditCard(null);
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
    }, [inputAbbr, textExpanders, stagedAdds, selectedType]);

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
        }

        setEditCard(null);
    }, [editCard]);

    const handleEditCardCancel = useCallback(() => {
        setEditCard(null);
    }, []);

    // Open detail for editing an existing expander (non-edit mode tap)
    const handleCardTap = useCallback((expander: TextExpander) => {
        setDetailExpander(expander);
    }, []);

    // Detail panel save handler (editing existing)
    const handleDetailSave = useCallback((entry: TextExpander, originalAbbr?: string) => {
        const current = profile.textExpanders ?? [];
        const next = originalAbbr
            ? current.map(e => e.abbr === originalAbbr ? entry : e)
            : [...current, entry];

        handleUpdate({ textExpanders: next });
        setDetailExpander(null);
    }, [profile.textExpanders, handleUpdate]);

    // Detail panel delete handler
    const handleDetailDelete = useCallback((abbr: string) => {
        const current = profile.textExpanders ?? [];
        const next = current.filter(e => e.abbr !== abbr);

        handleUpdate({ textExpanders: next });
        setDetailExpander(null);
    }, [profile.textExpanders, handleUpdate]);

    // ── Detail view for editing existing ──
    if (detailExpander) {
        return (
            <TextTemplateDetailPanel
                expander={detailExpander}
                isNew={false}
                existingAbbrs={textExpanders.map(e => e.abbr)}
                onSave={handleDetailSave}
                onDelete={handleDetailDelete}
                onCancel={() => setDetailExpander(null)}
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
                    stagedAdds={stagedAdds}
                    onToggleDelete={handleToggleDelete}
                    onUnstageAdd={handleUnstageAdd}
                    onCardTap={handleCardTap}
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
                />
            </div>
        </div>
    );
};
