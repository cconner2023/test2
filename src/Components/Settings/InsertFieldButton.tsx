import { TextCursor, ChevronDown, X } from 'lucide-react';
import { ActionButton } from '@/Components/primitives/ActionButton';
import { ActionPill } from '@/Components/primitives/ActionPill';
import { TextArea } from '@/Components/primitives/FormInputs';
import type { FieldInfo } from '../../Utilities/templateParser';

/**
 * Insert-field UI for the simple shortcut editor. NO overlay. The TYPE is chosen in
 * the ACTION FOOTER (FieldInsertFooter — mirrors template's AddStepFooter): the `[ ]`
 * trigger morphs in place into [X][Variable][Dropdown]. Picking a type reveals the
 * in-card <InsertFieldForm> (label / options) while the mounted-but-CSS-hidden editor
 * preserves the caret; commit rides the host's rightFooter Insert.
 */

export type FieldType = 'variable' | 'dropdown';

export type InsertDraft = {
    /** null while the user is still picking a type in the footer. */
    type: FieldType | null;
    label: string;
    options: string;
    defaultValue: string;
};

export const emptyInsertDraft: InsertDraft = { type: null, label: '', options: '', defaultValue: '' };

/** Build the FieldInfo (and trimmed label) from a draft, or null when incomplete. */
export function buildFieldInfo(d: InsertDraft): { label: string; field: FieldInfo } | null {
    if (!d.type) return null;
    const label = d.label.trim();
    if (!label) return null;
    if (d.type === 'variable') return { label, field: { type: 'variable' } };
    const opts = d.options.split('\n').map(o => o.trim()).filter(Boolean);
    if (opts.length === 0) return null;
    const def = d.defaultValue.trim();
    return {
        label,
        field: { type: 'dropdown', options: opts, defaultValue: def && opts.includes(def) ? def : opts[0] },
    };
}

/** Footer-LEFT insert control. Off = the `[ ]` trigger; engaged = the type options in
 *  place. onMouseDown-preventDefault on the trigger keeps the editor caret intact. */
export function FieldInsertFooter({
    open, type, onStart, onPick, onCancel,
}: {
    open: boolean;
    type: FieldType | null;
    onStart: () => void;
    onPick: (t: FieldType) => void;
    onCancel: () => void;
}) {
    if (!open) {
        return (
            <ActionPill>
                <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={onStart}
                    title="Insert field"
                    aria-label="Insert field"
                    className="w-9 h-9 rounded-full flex items-center justify-center bg-themeblue2/8 text-themeblue2 active:scale-95 transition-all"
                >
                    <span className="font-mono text-[10pt] font-semibold">[ ]</span>
                </button>
            </ActionPill>
        );
    }
    return (
        <ActionPill>
            <ActionButton icon={X} label="Cancel" onClick={onCancel} />
            <ActionButton icon={TextCursor} label="Variable" variant={type === 'variable' ? 'success' : 'default'} onClick={() => onPick('variable')} />
            <ActionButton icon={ChevronDown} label="Dropdown" variant={type === 'dropdown' ? 'success' : 'default'} onClick={() => onPick('dropdown')} />
        </ActionPill>
    );
}

/** In-card form body (label + dropdown extras). Type is chosen in the footer, so this
 *  only renders once draft.type is set. */
export function InsertFieldForm({
    draft, onChange,
}: {
    draft: InsertDraft;
    onChange: (d: InsertDraft) => void;
}) {
    const opts = draft.options.split('\n').map(o => o.trim()).filter(Boolean);
    const chosenDefault = draft.defaultValue || opts[0];

    return (
        <div className="pb-1">
            <label className="block border-b border-primary/6">
                <input
                    type="text"
                    value={draft.label}
                    onChange={(e) => onChange({ ...draft, label: e.target.value })}
                    placeholder={draft.type === 'dropdown' ? 'Field label (e.g. severity)' : 'Field label (e.g. chief complaint)'}
                    autoFocus
                    className="w-full bg-transparent px-4 py-3 text-base md:text-sm text-primary placeholder:text-tertiary focus:outline-none"
                />
            </label>

            {draft.type === 'variable' ? (
                <p className="px-4 py-3 text-[9pt] text-tertiary">Free text typed in at runtime.</p>
            ) : (
                <>
                    <TextArea
                        value={draft.options}
                        onChange={(v) => onChange({ ...draft, options: v, defaultValue: '' })}
                        placeholder={'Options (one per line)\nmild\nmoderate\nsevere'}
                        inputClassName="w-full bg-transparent px-4 py-3 text-base md:text-sm text-primary placeholder:text-tertiary focus:outline-none resize-none min-h-[4rem] leading-5 font-mono"
                    />
                    {opts.length > 0 && (
                        <div className="px-4 py-3 space-y-1">
                            <p className="text-[9pt] text-tertiary uppercase tracking-wider">Default</p>
                            <div className="flex flex-wrap gap-1">
                                {opts.map(opt => (
                                    <button
                                        key={opt}
                                        type="button"
                                        onClick={() => onChange({ ...draft, defaultValue: opt })}
                                        className={`text-[9pt] px-2 py-1 rounded-full transition-all active:scale-95 ${
                                            opt === chosenDefault
                                                ? 'bg-themeblue3 text-white'
                                                : 'bg-tertiary/8 text-tertiary hover:bg-tertiary/12'
                                        }`}
                                    >
                                        {opt}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
