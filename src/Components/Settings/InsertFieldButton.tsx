import { TextCursor, ChevronDown } from 'lucide-react';
import { TextArea } from '@/Components/primitives/FormInputs';
import { FooterPill } from '@/Components/primitives/FooterPill';
import { FooterMenuButton } from '@/Components/primitives/FooterMenuButton';
import type { ContextMenuItem } from '@/Components/primitives/ContextMenu';
import { HINT } from './TemplateBuilder';
import type { FieldInfo } from '../../Utilities/templateParser';
import { ListGroupLabel } from '@/Components/primitives/Section';

/**
 * Insert-field UI for the simple shortcut editor. NO overlay. The TYPE is chosen in
 * the ACTION FOOTER (FieldInsertFooter — mirrors template's AddStepFooter): the `[ ]`
 * trigger opens a lifted menu of the field types. Picking a type reveals the in-card
 * <InsertFieldForm> (label / options) while the mounted-but-CSS-hidden editor
 * preserves the caret; commit rides the host's rightFooter Insert.
 */

export type FieldType = 'variable' | 'dropdown';

export type InsertDraft = {
    /** null when no insert is in progress — picking a type in the footer menu is
     *  what starts one, so this doubles as the form-stage flag. */
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

/** Footer-LEFT insert control — the `[ ]` trigger, options in a lifted menu. Stays
 *  mounted through the form stage, so `type` marks the row the draft is already on
 *  and re-picking switches type without discarding the label/options typed so far. */
export function FieldInsertFooter({
    type, onPick,
}: {
    type: FieldType | null;
    onPick: (t: FieldType) => void;
}) {
    const items: ContextMenuItem[] = [
        { key: 'variable', label: 'Variable', icon: TextCursor, selected: type === 'variable', onAction: () => onPick('variable') },
        { key: 'dropdown', label: 'Dropdown', icon: ChevronDown, selected: type === 'dropdown', onAction: () => onPick('dropdown') },
    ];
    return (
        <FooterPill>
            <FooterMenuButton
                label="Insert field"
                items={items}
                node={<span className="font-mono text-[10pt] font-semibold">[ ]</span>}
            />
        </FooterPill>
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
                    placeholder={HINT.label}
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
                        placeholder={HINT.options}
                        inputClassName="w-full bg-transparent px-4 py-3 text-base md:text-sm text-primary placeholder:text-tertiary focus:outline-none resize-none min-h-[4rem] leading-5 font-mono"
                    />
                    {opts.length > 0 && (
                        <div className="px-4 py-3 space-y-1">
                            <ListGroupLabel inset={false}>Default</ListGroupLabel>
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
