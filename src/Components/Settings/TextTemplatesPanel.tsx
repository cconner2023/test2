import { useState, useCallback, useMemo } from 'react';
import { useUserProfile } from '../../Hooks/useUserProfile';
import { useAuthStore } from '../../stores/useAuthStore';
import { useEditableClinicContent } from '../../Hooks/useEditableClinicContent';
import type { UserTypes, TextExpander } from '../../Data/User';
import { Plus, Check, Trash2, CheckSquare, TextCursorInput, Layers } from 'lucide-react';
import { SearchInput } from '@/Components/primitives/SearchInput';
import { PillButton } from '@/Components/primitives/HeaderPill';
import { HeaderMenuPill } from '@/Components/primitives/HeaderMenuPill';
import { OverlayHeaderMenu } from '@/Components/primitives/OverlayHeaderMenu';
import { ConfirmDialog } from '@/Components/primitives/ConfirmDialog';
import type { ContextMenuItem } from '@/Components/primitives/ContextMenu';
import { TextExpanderManager, expansionPreview, hasBranches } from './TextExpanderManager';
import { ContentStack, useRowMenu, itemMenuItems } from './contentPrimitives';
import { usePublishHeaderActions } from './panelHeaderSlot';
import { exportTemplatesCSV } from '../../Utilities/noteBlocksCSV';
import { TextExpanderEditPopover, type TextExpanderEditState, type ExpanderScope } from './TextExpanderEditPopover';
import type { CardMorphHost } from '@/Components/primitives/OverlayStack';
import { useClusterEditItem } from './ClusterEditPicker';
import { useNoteBlocksTransferItems } from './NoteBlocksTransferMenu';
import { useNoteBlocksTransfer } from '../../Hooks/useNoteBlocksTransfer';

/** Text templates (autotext shortcuts).
 *
 *  Header (published to the container): Add [New shortcut, New template,
 *  Multiselect] and ⋯ [cluster, share, export, import]. Tapping a row lifts it
 *  with [Open, Edit, Share, Export, Delete]. Editors are PaneStack — a Sheet on
 *  mobile; `cardHost` (desktop Settings) morphs them into the subpage card. */
export const TextTemplatesPanel = ({ cardHost }: { cardHost?: CardMorphHost } = {}) => {
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
        cardHost,
        data: { textExpanders },
        hasData: textExpanders.length > 0,
    });

    const handleUpdate = useCallback((fields: Partial<UserTypes>) => {
        updateProfile(fields);
        const dbFields: Record<string, unknown> = {};
        if (fields.textExpanders !== undefined) dbFields.text_expanders = fields.textExpanders;
        syncProfileField(dbFields);
    }, [updateProfile, syncProfileField]);

    const startNew = useCallback((type: 'simple' | 'template') => {
        setEditState({ mode: 'new', type, anchor: null, source: 'personal' });
    }, []);

    const isClinicItem = useCallback((e: TextExpander) => clinicAbbrSet.has(e.abbr.toLowerCase()), [clinicAbbrSet]);
    const canEditItem = useCallback((e: TextExpander) => !isClinicItem(e) || !!isSupervisorRole, [isClinicItem, isSupervisorRole]);

    const startEdit = useCallback((expander: TextExpander) => {
        if (!canEditItem(expander)) return;
        setEditState({ mode: 'edit', expander, anchor: null, source: isClinicItem(expander) ? 'clinic' : 'personal' });
    }, [canEditItem, isClinicItem]);

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

    const deleteItems = useCallback((abbrs: Set<string>) => {
        const clinicDrop = clinicTextExpanders.filter(x => abbrs.has(x.abbr));
        if (clinicDrop.length > 0 && editingClinicId) writeClinic(clinicTextExpanders.filter(x => !abbrs.has(x.abbr)));
        const personal = profile.textExpanders ?? [];
        if (personal.some(x => abbrs.has(x.abbr))) handleUpdate({ textExpanders: personal.filter(x => !abbrs.has(x.abbr)) });
    }, [clinicTextExpanders, editingClinicId, writeClinic, profile.textExpanders, handleUpdate]);

    // ── Row menu + Open view ───────────────────────────────────────
    const rowMenu = useRowMenu();
    const [viewing, setViewing] = useState<TextExpander | null>(null);
    const itemActions = useCallback((e: TextExpander, withOpen: boolean): ContextMenuItem[] => itemMenuItems({
        canEdit: canEditItem(e),
        onOpen: withOpen ? () => setViewing(e) : undefined,
        onEdit: () => { setViewing(null); startEdit(e); },
        onShare: () => transfer.share({ textExpanders: [e] }, e.abbr),
        onExport: () => exportTemplatesCSV([e]),
        onDelete: () => { setViewing(null); deleteItems(new Set([e.abbr])); },
    }), [canEditItem, startEdit, transfer, deleteItems]);

    // ── Multiselect ────────────────────────────────────────────────
    const [selectMode, setSelectMode] = useState(false);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [confirmDelete, setConfirmDelete] = useState(false);
    const exitSelect = useCallback(() => { setSelectMode(false); setSelected(new Set()); }, []);
    const hasEditable = allExpanders.some(canEditItem);

    // ── Container header: Add + ⋯ ──────────────────────────────────
    const addItems: ContextMenuItem[] = [
        { key: 'new-simple', label: 'New shortcut', icon: TextCursorInput, onAction: () => startNew('simple') },
        { key: 'new-template', label: 'New template', icon: Layers, onAction: () => startNew('template') },
        ...(hasEditable ? [{ key: 'multiselect', label: 'Multiselect', icon: CheckSquare, onAction: () => setSelectMode(true) }] : []),
    ];
    const moreItems: ContextMenuItem[] = [...(clusterItem ? [clusterItem] : []), ...transferItems];

    usePublishHeaderActions(selectMode ? (
        <>
            {selected.size > 0 && (
                <PillButton icon={Trash2} iconSize={18} variant="danger" label={`Delete ${selected.size}`} onClick={() => setConfirmDelete(true)} />
            )}
            <PillButton icon={Check} iconSize={18} label="Done" onClick={exitSelect} />
        </>
    ) : (
        <HeaderMenuPill icon={Plus} label="Add" items={addItems} />
    ), selectMode ? [] : moreItems);

    return (
        <>
            {/* The pane body owns its scroll (the desktop subpage card is `fill`). */}
            <div className="h-full overflow-y-auto overscroll-contain">
            <div className="px-3 pb-2 pt-[calc(var(--drawer-header-h,3.5rem)+0.75rem)]">
                <SearchInput
                    value={filter}
                    onChange={setFilter}
                    placeholder="Search shortcuts..."
                />
            </div>
            <div className="px-5 py-4 space-y-5">
                    <p className="text-[10pt] text-tertiary leading-relaxed">
                        {selectMode ? 'Select shortcuts to delete.' : 'Autotext shortcuts that expand abbreviations as you type in your notes.'}
                        {!selectMode && clinicTextExpanders.length > 0 && (
                            <span className="text-tertiary"> Includes cluster-wide shortcuts.</span>
                        )}
                    </p>

                    <TextExpanderManager
                        expanders={allExpanders}
                        clinicAbbrSet={clinicAbbrSet}
                        onCardTap={(e, el) => rowMenu.open(el, itemActions(e, true))}
                        filter={filter}
                        isSupervisorRole={isSupervisorRole}
                        selectMode={selectMode}
                        selected={selected}
                        onToggleSelect={(e) => setSelected(prev => {
                            const n = new Set(prev);
                            n.has(e.abbr) ? n.delete(e.abbr) : n.add(e.abbr);
                            return n;
                        })}
                    />
            </div>
            </div>

            {rowMenu.node}

            <ContentStack
                isOpen={!!viewing}
                onClose={() => setViewing(null)}
                initial={{ key: 'view' }}
                cardHost={cardHost}
                screens={{
                    view: {
                        title: viewing?.abbr ?? '',
                        headerLeft: <OverlayHeaderMenu items={viewing ? itemActions(viewing, false) : []} align="left" />,
                        render: () => viewing ? (
                            <div className="px-4 pb-4 space-y-2">
                                <p className="text-[9pt] font-semibold uppercase tracking-wider text-tertiary">
                                    {hasBranches(viewing) ? 'Template' : 'Shortcut'}
                                </p>
                                <p className="text-sm text-primary whitespace-pre-wrap break-words rounded-xl bg-themewhite2 px-3 py-2.5">
                                    {expansionPreview(viewing)}
                                </p>
                            </div>
                        ) : null,
                    },
                }}
            />

            <ConfirmDialog
                visible={confirmDelete}
                variant="danger"
                title={`Delete ${selected.size} item${selected.size === 1 ? '' : 's'}?`}
                confirmLabel="Delete"
                onConfirm={() => {
                    deleteItems(selected);
                    setConfirmDelete(false);
                    exitSelect();
                }}
                onCancel={() => setConfirmDelete(false)}
            />

            <TextExpanderEditPopover
                state={editState}
                existingAbbrs={allExpanders.map(e => e.abbr)}
                isSupervisorRole={isSupervisorRole}
                onClose={() => setEditState(null)}
                onSave={handleSave}
                cardHost={cardHost}
            />

            {transfer.picker}
            {transferOverlays}
        </>
    );
};
