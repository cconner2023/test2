import { TextCursorInput, Layers, Check, X, Trash2 } from 'lucide-react';
import type { TextExpander } from '../../Data/User';
import type { TemplateNode } from '../../Data/TemplateTypes';
import type { FieldInfo } from '../../Utilities/templateParser';
import { isFlatTemplate } from '../../Utilities/templateParser';
import { ShortcutStepBuilder } from './ShortcutStepBuilder';
import { FieldTextEditor } from './FieldTextEditor';

/** True only for templates with branches — flat field templates are "simple" */
const hasBranches = (e: TextExpander): boolean =>
    !!(e.template && e.template.length > 0 && !isFlatTemplate(e.template));

const templatePreview = (nodes: TemplateNode[]): string =>
    nodes.map(n => {
        switch (n.type) {
            case 'text': return n.content;
            case 'step': return `[${n.label}]`;
            case 'choice': return `[${n.label}]`;
            case 'branch': return `[${n.triggerField}]`;
        }
    }).join(' - ');

const expansionPreview = (e: TextExpander): string => {
    if (e.template && e.template.length > 0) return templatePreview(e.template);
    return e.expansion;
};

export interface EditCardState {
    abbr: string;
    type: 'simple' | 'template';
    expansion: string;
    nodes: TemplateNode[];
    fields: Record<string, FieldInfo>;
    isNew: boolean;
}

interface TextExpanderManagerProps {
    expanders: TextExpander[];
    editing?: boolean;
    stagedDeletes: Set<string>;
    stagedAdds: TextExpander[];
    stagedEdits?: Map<string, TextExpander>;
    onToggleDelete: (abbr: string) => void;
    onUnstageAdd: (abbr: string) => void;
    onCardTap?: (expander: TextExpander) => void;
    onStartEdit?: (expander: TextExpander) => void;
    /** Abbreviation input */
    inputAbbr: string;
    onInputAbbrChange: (value: string) => void;
    onInputAbbrSubmit: () => void;
    inputError: string;
    onClearInput: () => void;
    /** Type selector */
    selectedType: 'simple' | 'template';
    onTypeChange: (type: 'simple' | 'template') => void;
    /** Inline edit card */
    editCard: EditCardState | null;
    onEditCardChange: (state: EditCardState) => void;
    onEditCardAccept: () => void;
    onEditCardCancel: () => void;
    onEditCardDelete?: () => void;
    /** Current scope for new items */
    scope?: 'personal' | 'clinic';
    /** Callback to change scope */
    onScopeChange?: (scope: 'personal' | 'clinic') => void;
    /** Set of lowercase clinic abbreviations for provenance badges */
    clinicAbbrSet?: Set<string>;
    /** Whether user has supervisor role */
    isSupervisorRole?: boolean;
}

export const TextExpanderManager = ({
    expanders, editing = false,
    stagedDeletes, stagedAdds, stagedEdits, onToggleDelete, onUnstageAdd,
    onCardTap, onStartEdit,
    inputAbbr, onInputAbbrChange, onInputAbbrSubmit, inputError, onClearInput,
    selectedType, onTypeChange,
    editCard, onEditCardChange, onEditCardAccept, onEditCardCancel, onEditCardDelete,
    scope = 'personal', onScopeChange, clinicAbbrSet, isSupervisorRole = false,
}: TextExpanderManagerProps) => {
    const totalCount = expanders.length + stagedAdds.length - stagedDeletes.size;
    const hasItems = expanders.length > 0 || stagedAdds.length > 0;

    const editCardValid = editCard
        ? editCard.type === 'simple'
            ? editCard.expansion.trim().length > 0
            : editCard.nodes.length > 0
        : false;

    return (
        <section className="space-y-3">
            {/* ── Section header ── */}
            <div className="flex items-center gap-2">
                <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">Templates</p>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-tertiary/10 text-tertiary/50 font-medium">
                    {totalCount}
                </span>
            </div>

            {/* ── Edit flow ── */}
            <div className={`overflow-hidden transition-all duration-300 ease-out ${
                editCard ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
            }`}>
                {editCard && editCard.type === 'simple' ? (
                    /* Simple — unified card: header, field editor, footer */
                    <div data-tour="expander-edit-card" className="rounded-xl bg-themewhite2 divide-y divide-tertiary/10">
                        <div className="flex items-center gap-2 px-4 py-3">
                            <p className="text-base font-semibold text-primary font-mono flex-1 min-w-0 truncate">
                                {editCard.abbr}
                            </p>
                            <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-themeblue2/15 text-themeblue2">
                                simple
                            </span>
                        </div>
                        <div className="px-4 py-3">
                            <FieldTextEditor
                                value={editCard.expansion}
                                onChange={(v) => onEditCardChange({ ...editCard, expansion: v })}
                                fields={editCard.fields}
                                onFieldsChange={(f) => onEditCardChange({ ...editCard, fields: f })}
                                placeholder="Text that replaces the shortcut…"
                                autoFocus
                            />
                        </div>
                        <div className="flex items-center justify-end gap-1.5 px-4 py-2.5">
                            {!editCard.isNew && onEditCardDelete && (
                                <button
                                    type="button"
                                    onClick={onEditCardDelete}
                                    className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-themeredred hover:bg-themeredred/10 active:scale-95 transition-all mr-auto"
                                >
                                    <Trash2 size={18} />
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={onEditCardCancel}
                                className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-tertiary hover:bg-tertiary/10 active:scale-95 transition-all"
                            >
                                <X size={18} />
                            </button>
                            <button
                                type="button"
                                data-tour="expander-edit-accept"
                                onClick={onEditCardAccept}
                                disabled={!editCardValid}
                                className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-themeblue3 text-white disabled:opacity-40 active:scale-95 transition-all"
                            >
                                <Check size={18} />
                            </button>
                        </div>
                    </div>
                ) : editCard && editCard.type === 'template' ? (
                    /* Template — separated cards: header, step cards, footer */
                    <div className="space-y-2">
                        <div className="rounded-xl bg-themewhite2 px-4 py-3 flex items-center gap-2">
                            <p className="text-base font-semibold text-primary font-mono flex-1 min-w-0 truncate">
                                {editCard.abbr}
                            </p>
                            <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-themepurple/15 text-themepurple">
                                template
                            </span>
                        </div>

                        <ShortcutStepBuilder
                            nodes={editCard.nodes}
                            onChange={(nodes) => onEditCardChange({ ...editCard, nodes })}
                        />

                        <div className="rounded-xl bg-themewhite2 px-4 py-2.5 flex items-center justify-end gap-1.5">
                            {!editCard.isNew && onEditCardDelete && (
                                <button
                                    type="button"
                                    onClick={onEditCardDelete}
                                    className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-themeredred hover:bg-themeredred/10 active:scale-95 transition-all mr-auto"
                                >
                                    <Trash2 size={18} />
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={onEditCardCancel}
                                className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-tertiary hover:bg-tertiary/10 active:scale-95 transition-all"
                            >
                                <X size={18} />
                            </button>
                            <button
                                type="button"
                                onClick={onEditCardAccept}
                                disabled={!editCardValid}
                                className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-themeblue3 text-white disabled:opacity-40 active:scale-95 transition-all"
                            >
                                <Check size={18} />
                            </button>
                        </div>
                    </div>
                ) : null}
            </div>

            {/* ── Unified card: input bar (when editing) + template list ── */}
            <div data-tour="expander-list" className="rounded-xl bg-themewhite2 overflow-hidden">
                {/* Input bar — inside the list card, edit-gated */}
                <div className={`overflow-hidden transition-all duration-300 ease-out ${
                    editing && !editCard ? 'max-h-16 opacity-100' : 'max-h-0 opacity-0'
                }`}>
                    <div data-tour="expander-input-bar" className="relative px-4 py-3">
                        <div className="flex items-center gap-1.5">
                            {/* Type selector pill */}
                            <button
                                type="button"
                                data-tour="expander-type-hint"
                                onClick={() => onTypeChange(selectedType === 'simple' ? 'template' : 'simple')}
                                className={`shrink-0 px-3 py-2.5 rounded-full text-[11px] font-semibold tracking-wide uppercase transition-all active:scale-95 ${
                                    selectedType === 'template'
                                        ? 'bg-themepurple/15 text-themepurple border border-themepurple/20'
                                        : 'bg-themeblue2/15 text-themeblue2 border border-themeblue2/20'
                                }`}
                            >
                                {selectedType === 'simple' ? 'Simple' : 'Template'}
                            </button>

                            {/* Scope selector — supervisors only */}
                            {isSupervisorRole && (
                                <button
                                    type="button"
                                    onClick={() => onScopeChange?.(scope === 'personal' ? 'clinic' : 'personal')}
                                    className={`shrink-0 px-2.5 py-2.5 rounded-full text-[10px] font-semibold tracking-wide transition-all active:scale-95 ${
                                        scope === 'clinic'
                                            ? 'bg-tertiary/10 text-tertiary border border-tertiary/20'
                                            : 'bg-themeblue2/10 text-themeblue2/70 border border-themeblue2/15'
                                    }`}
                                >
                                    {scope === 'clinic' ? 'Clinic' : 'Personal'}
                                </button>
                            )}

                            {/* Abbreviation input */}
                            <div className="relative flex flex-1 items-center rounded-full border border-themeblue3/10 shadow-xs bg-themewhite focus-within:border-themeblue1/30 focus-within:bg-themewhite2 transition-all duration-300">
                                <input
                                    type="text"
                                    value={inputAbbr}
                                    onChange={(e) => onInputAbbrChange(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onInputAbbrSubmit(); } }}
                                    placeholder="New shortcut…"
                                    className="w-full bg-transparent outline-none text-sm text-primary px-3.5 py-2.5 rounded-full min-w-0 placeholder:text-tertiary/30"
                                />
                            </div>

                            {inputAbbr.trim() && (
                                <>
                                    <button
                                        type="button"
                                        onClick={onClearInput}
                                        className="animate-spring-in shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all"
                                    >
                                        <X size={18} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={onInputAbbrSubmit}
                                        className="animate-spring-in shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-themeblue3 text-white active:scale-95 transition-all"
                                    >
                                        <Check size={18} />
                                    </button>
                                </>
                            )}
                        </div>
                        {inputError && (
                            <div className="absolute left-0 right-0 top-full mt-1.5 z-10">
                                <p className="text-xs font-medium text-themeredred bg-themeredred/5 rounded-full px-4 py-1.5 text-center">
                                    {inputError}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* List items */}
                {hasItems ? (
                    <div className="divide-y divide-tertiary/8 px-2">
                        {/* Staged adds — top of list */}
                        {stagedAdds.map(e => {
                            const isTemplate = hasBranches(e);
                            const Icon = isTemplate ? Layers : TextCursorInput;
                            const iconBg = isTemplate ? 'bg-themepurple/15' : 'bg-themeblue2/15';
                            const iconColor = isTemplate ? 'text-themepurple' : 'text-themeblue2';

                            return (
                                <div
                                    key={`add-${e.abbr}`}
                                    onClick={editing ? () => onUnstageAdd(e.abbr) : undefined}
                                    className="flex items-start gap-3 py-2 px-2 rounded-lg border border-dashed border-themeblue2/30 bg-themeblue2/5 cursor-pointer active:scale-[0.98] transition-all"
                                >
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${iconBg}`}>
                                        <Icon size={14} className={iconColor} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-primary truncate">{e.abbr}</p>
                                        <p className="text-[11px] text-tertiary/50 mt-0.5 leading-relaxed">
                                            {expansionPreview(e)}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Existing expanders */}
                        {expanders.map(orig => {
                            const edited = stagedEdits?.get(orig.abbr);
                            const e = edited ?? orig;
                            const isTemplate = hasBranches(e);
                            const isClinic = clinicAbbrSet?.has(orig.abbr.toLowerCase()) ?? false;
                            const canEdit = editing && (!isClinic || isSupervisorRole);
                            const isMarkedDelete = stagedDeletes.has(orig.abbr);
                            const isMarkedEdit = !!edited;
                            const isOpenInEditor = editCard && !editCard.isNew && editCard.abbr === orig.abbr;
                            const Icon = isTemplate ? Layers : TextCursorInput;
                            const iconBg = isClinic ? 'bg-tertiary/10' : isTemplate ? 'bg-themepurple/15' : 'bg-themeblue2/15';
                            const iconColor = isClinic && !isSupervisorRole ? 'text-tertiary' : isTemplate ? 'text-themepurple' : 'text-themeblue2';

                            const handleClick = editing
                                ? isMarkedDelete
                                    ? () => onToggleDelete(orig.abbr)
                                    : canEdit && onStartEdit
                                        ? () => onStartEdit(orig)
                                        : undefined
                                : onCardTap
                                    ? () => onCardTap(orig)
                                    : undefined;

                            return (
                                <div
                                    key={orig.abbr}
                                    onClick={handleClick}
                                    className={`flex items-start gap-3 py-2 px-2 rounded-lg transition-colors ${
                                        isMarkedDelete
                                            ? 'ring-1 ring-inset ring-themeredred/30 bg-themeredred/5 cursor-pointer active:scale-[0.98]'
                                            : isOpenInEditor
                                                ? 'ring-1 ring-inset ring-themeblue3/40 bg-themeblue3/5'
                                                : isMarkedEdit
                                                    ? 'ring-1 ring-inset ring-themeblue2/30 bg-themeblue2/5 cursor-pointer active:scale-[0.98]'
                                                    : editing && canEdit
                                                        ? 'cursor-pointer active:scale-[0.98] hover:bg-themeblue3/5'
                                                        : editing && !canEdit
                                                            ? 'opacity-60'
                                                            : onCardTap
                                                                ? 'cursor-pointer active:scale-[0.98]'
                                                                : ''
                                    }`}
                                >
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${iconBg}`}>
                                        <Icon size={14} className={iconColor} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <p className={`text-sm font-medium truncate ${
                                                isMarkedDelete ? 'text-themeredred/60 line-through' : 'text-primary'
                                            }`}>{orig.abbr}</p>
                                            {isClinic && (
                                                <span className="text-[9px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded-full bg-tertiary/10 text-tertiary/60 shrink-0">
                                                    Clinic
                                                </span>
                                            )}
                                            {isMarkedEdit && !isMarkedDelete && (
                                                <span className="text-[9px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded-full bg-themeblue2/15 text-themeblue2 shrink-0">
                                                    Edited
                                                </span>
                                            )}
                                        </div>
                                        <p className={`text-[11px] mt-0.5 leading-relaxed ${
                                            isMarkedDelete ? 'text-themeredred/30' : 'text-tertiary/50'
                                        }`}>
                                            {expansionPreview(e)}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <p className="text-sm text-tertiary/50 py-4 text-center">
                        No templates configured
                    </p>
                )}
            </div>
        </section>
    );
};
