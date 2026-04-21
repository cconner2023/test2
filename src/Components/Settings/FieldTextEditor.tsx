import { useRef, useEffect, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { TextCursor, ChevronDown, Trash2 } from 'lucide-react';
import { InsertFieldButton } from './InsertFieldButton';
import type { FieldInfo } from '../../Utilities/templateParser';

// ─── Segment helpers ─────────────────────────────────────────────────

type Segment = { type: 'text'; value: string } | { type: 'field'; label: string };

function toSegments(value: string, fields: Record<string, FieldInfo>): Segment[] {
    if (!value) return [];
    const segs: Segment[] = [];
    const parts = value.split(/(\[[^\]]+\])/);
    for (const p of parts) {
        if (!p) continue;
        const m = p.match(/^\[([^\]]+)\]$/);
        if (m && fields[m[1]]) {
            segs.push({ type: 'field', label: m[1] });
        } else {
            segs.push({ type: 'text', value: p });
        }
    }
    return segs;
}

// ─── DOM helpers ─────────────────────────────────────────────────────

function makePill(label: string, field: FieldInfo | undefined): HTMLSpanElement {
    const pill = document.createElement('span');
    pill.setAttribute('data-field', label);
    if (field) pill.setAttribute('data-field-info', JSON.stringify(field));
    pill.contentEditable = 'false';

    // Base pill styling
    const base = 'inline-flex items-center gap-0.5 px-2 py-0.5 mx-0.5 rounded-full text-[9pt] font-medium cursor-pointer select-none align-baseline';

    if (field?.type === 'dropdown') {
        pill.className = `${base} bg-themeblue2/15 text-themeblue2`;
        const lbl = document.createElement('span');
        lbl.textContent = field.defaultValue ?? field.options?.[0] ?? label;
        pill.appendChild(lbl);
        const arrow = document.createElement('span');
        arrow.className = 'text-[9pt] md:text-[9pt] text-themeblue2/50 ml-0.5';
        arrow.textContent = '▾';
        pill.appendChild(arrow);
    } else {
        pill.className = `${base} bg-themeblue2/10 text-themeblue2/80`;
        pill.textContent = label;
    }

    return pill;
}

function renderToDOM(el: HTMLElement, segments: Segment[], fields: Record<string, FieldInfo>) {
    el.innerHTML = '';
    if (segments.length === 0) {
        el.appendChild(document.createElement('br'));
        return;
    }
    for (const seg of segments) {
        if (seg.type === 'text') {
            el.appendChild(document.createTextNode(seg.value));
        } else {
            el.appendChild(makePill(seg.label, fields[seg.label]));
        }
    }
    // Ensure trailing cursor target after a pill
    const last = el.lastChild;
    if (last && last.nodeType !== Node.TEXT_NODE) {
        el.appendChild(document.createTextNode('\u200B'));
    }
}

function readEditorDOM(el: HTMLElement, fields: Record<string, FieldInfo>): { value: string; activeLabels: Set<string> } {
    let value = '';
    const activeLabels = new Set<string>();

    const walkChildren = (parent: Node, prependNewline: boolean) => {
        if (prependNewline && value.length > 0) value += '\n';
        for (const node of parent.childNodes) {
            if (node.nodeType === Node.TEXT_NODE) {
                value += (node.textContent || '').replace(/\u200B/g, '');
            } else if (node instanceof HTMLElement) {
                const fl = node.getAttribute('data-field');
                if (fl && fields[fl]) {
                    value += `[${fl}]`;
                    activeLabels.add(fl);
                } else if (node.nodeName === 'BR') {
                    value += '\n';
                } else if (node.nodeName === 'DIV' || node.nodeName === 'P') {
                    walkChildren(node, true);
                } else {
                    walkChildren(node, false);
                }
            }
        }
    };

    walkChildren(el, false);

    // Trim leading/trailing newlines added by browser (preserve intentional spaces)
    value = value.replace(/^\n+/, '').replace(/\n$/, '');

    return { value, activeLabels };
}

// ─── Component ───────────────────────────────────────────────────────

interface FieldTextEditorProps {
    value: string;
    onChange: (value: string) => void;
    fields: Record<string, FieldInfo>;
    onFieldsChange: (fields: Record<string, FieldInfo>) => void;
    placeholder?: string;
    autoFocus?: boolean;
}

export const FieldTextEditor = ({
    value, onChange, fields, onFieldsChange, placeholder, autoFocus,
}: FieldTextEditorProps) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const lastSyncedRef = useRef({ value, fields });
    const skipNextSync = useRef(false);
    const savedRangeRef = useRef<Range | null>(null);
    const [editingField, setEditingField] = useState<{ label: string; rect: DOMRect } | null>(null);

    // ── Save selection whenever cursor moves inside the editor ──
    useEffect(() => {
        const handleSelChange = () => {
            const el = editorRef.current;
            if (!el) return;
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) {
                savedRangeRef.current = sel.getRangeAt(0).cloneRange();
            }
        };
        document.addEventListener('selectionchange', handleSelChange);
        return () => document.removeEventListener('selectionchange', handleSelChange);
    }, []);

    // ── Initial render ──
    useEffect(() => {
        const el = editorRef.current;
        if (!el) return;
        const segs = toSegments(value, fields);
        renderToDOM(el, segs, fields);
        lastSyncedRef.current = { value, fields };
        if (autoFocus) {
            el.focus();
            const sel = window.getSelection();
            if (sel) { sel.selectAllChildren(el); sel.collapseToEnd(); }
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Re-render DOM when value/fields change from outside ──
    useEffect(() => {
        if (skipNextSync.current) { skipNextSync.current = false; return; }
        const prev = lastSyncedRef.current;
        if (value === prev.value && fields === prev.fields) return;

        const el = editorRef.current;
        if (!el) return;
        const segs = toSegments(value, fields);
        renderToDOM(el, segs, fields);
        lastSyncedRef.current = { value, fields };
    }, [value, fields]);

    // ── Sync state from DOM on every input ──
    const syncFromDOM = useCallback((currentFields: Record<string, FieldInfo>) => {
        const el = editorRef.current;
        if (!el) return;

        const { value: newValue, activeLabels } = readEditorDOM(el, currentFields);

        // Clean up removed fields
        const removed = Object.keys(currentFields).filter(k => !activeLabels.has(k));
        let nextFields = currentFields;
        if (removed.length > 0) {
            nextFields = { ...currentFields };
            for (const k of removed) delete nextFields[k];
        }

        lastSyncedRef.current = { value: newValue, fields: nextFields };
        skipNextSync.current = true;
        onChange(newValue);
        if (removed.length > 0) onFieldsChange(nextFields);
    }, [onChange, onFieldsChange]);

    const handleInput = useCallback(() => {
        syncFromDOM(fields);
    }, [fields, syncFromDOM]);

    // ── Copy: plain text with [label] markers + HTML with pill metadata ──
    const handleCopy = useCallback((e: React.ClipboardEvent) => {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;

        const fragment = sel.getRangeAt(0).cloneContents();

        // Plain text: convert pills to [label]
        let plain = '';
        const walkText = (node: Node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                plain += (node.textContent || '').replace(/\u200B/g, '');
            } else if (node instanceof HTMLElement) {
                const fl = node.getAttribute('data-field');
                if (fl) { plain += `[${fl}]`; }
                else { for (const c of node.childNodes) walkText(c); }
            }
        };
        for (const c of fragment.childNodes) walkText(c);

        // HTML: browser serializes the fragment including data-field-info attrs
        const wrap = document.createElement('div');
        wrap.appendChild(fragment);

        e.clipboardData.setData('text/plain', plain);
        e.clipboardData.setData('text/html', wrap.innerHTML);
        e.preventDefault();
    }, []);

    // ── Cut: copy + delete selection + sync ──
    const handleCut = useCallback((e: React.ClipboardEvent) => {
        handleCopy(e);
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) sel.getRangeAt(0).deleteContents();
        syncFromDOM(fields);
    }, [handleCopy, fields, syncFromDOM]);

    // ── Paste: reconstruct pills from HTML, or insert plain text ──
    const handlePaste = useCallback((e: React.ClipboardEvent) => {
        e.preventDefault();
        const el = editorRef.current;
        if (!el) return;

        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        const range = sel.getRangeAt(0);
        range.deleteContents();

        let newFields = { ...fields };
        const fragment = document.createDocumentFragment();
        const html = e.clipboardData.getData('text/html');

        if (html && html.includes('data-field')) {
            // Came from our editor — parse and reconstruct pills
            const temp = document.createElement('div');
            temp.innerHTML = html;

            const walk = (parent: Node) => {
                for (const node of Array.from(parent.childNodes)) {
                    if (node.nodeType === Node.TEXT_NODE) {
                        const t = (node.textContent || '').replace(/\u200B/g, '');
                        if (t) fragment.appendChild(document.createTextNode(t));
                    } else if (node instanceof HTMLElement) {
                        const fl = node.getAttribute('data-field');
                        const raw = node.getAttribute('data-field-info');
                        if (fl && raw) {
                            try {
                                const info = JSON.parse(raw) as FieldInfo;
                                fragment.appendChild(makePill(fl, info));
                                newFields[fl] = info;
                            } catch {
                                fragment.appendChild(document.createTextNode(node.textContent || ''));
                            }
                        } else if (node.nodeName === 'BR') {
                            fragment.appendChild(document.createElement('br'));
                        } else {
                            walk(node);
                        }
                    }
                }
            };
            walk(temp);
        } else {
            // Plain text fallback
            const text = e.clipboardData.getData('text/plain') || '';
            if (text) fragment.appendChild(document.createTextNode(text));
        }

        range.insertNode(fragment);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);

        // Sync state
        const { value: newValue } = readEditorDOM(el, newFields);
        lastSyncedRef.current = { value: newValue, fields: newFields };
        skipNextSync.current = true;
        onChange(newValue);
        onFieldsChange(newFields);
    }, [fields, onChange, onFieldsChange]);

    // ── Insert field pill at saved cursor position ──
    const handleInsert = useCallback((label: string, field: FieldInfo) => {
        const el = editorRef.current;
        if (!el) return;

        el.focus();
        const sel = window.getSelection();
        const pill = makePill(label, field);
        const spacer = document.createTextNode('\u200B');

        // Restore the saved range (cursor was inside editor before popover stole focus)
        const saved = savedRangeRef.current;
        if (saved && el.contains(saved.startContainer)) {
            if (sel) {
                sel.removeAllRanges();
                sel.addRange(saved);
            }
            saved.deleteContents();
            saved.insertNode(spacer);
            saved.insertNode(pill);
            const after = saved.cloneRange();
            after.setStartAfter(spacer);
            after.collapse(true);
            sel?.removeAllRanges();
            sel?.addRange(after);
        } else {
            // No saved position — append at end
            el.appendChild(pill);
            el.appendChild(spacer);
            if (sel) {
                const range = document.createRange();
                range.setStartAfter(spacer);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
            }
        }

        const newFields = { ...fields, [label]: field };
        lastSyncedRef.current = { value: '', fields: newFields };
        skipNextSync.current = true;

        const { value: newValue } = readEditorDOM(el, newFields);
        lastSyncedRef.current = { value: newValue, fields: newFields };
        onChange(newValue);
        onFieldsChange(newFields);
    }, [fields, onChange, onFieldsChange]);

    // ── Pill tap → edit popover ──
    const handleClick = useCallback((e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        const pill = target.closest('[data-field]') as HTMLElement | null;
        if (pill && editorRef.current?.contains(pill)) {
            e.preventDefault();
            const label = pill.getAttribute('data-field')!;
            setEditingField({ label, rect: pill.getBoundingClientRect() });
        } else {
            setEditingField(null);
        }
    }, []);

    // ── Delete field from editor ──
    const handleDeleteField = useCallback((label: string) => {
        const el = editorRef.current;
        if (!el) return;

        const pill = el.querySelector(`[data-field="${CSS.escape(label)}"]`);
        if (pill) pill.remove();

        const newFields = { ...fields };
        delete newFields[label];

        const { value: newValue } = readEditorDOM(el, newFields);
        lastSyncedRef.current = { value: newValue, fields: newFields };
        skipNextSync.current = true;
        onChange(newValue);
        onFieldsChange(newFields);
        setEditingField(null);
        el.focus();
    }, [fields, onChange, onFieldsChange]);

    // ── Update default for a dropdown ──
    const handleSetDefault = useCallback((label: string, defaultValue: string) => {
        const newField = { ...fields[label], defaultValue };
        const newFields = { ...fields, [label]: newField };

        // Re-render pill in DOM
        const el = editorRef.current;
        if (el) {
            const pill = el.querySelector(`[data-field="${CSS.escape(label)}"]`);
            if (pill) pill.replaceWith(makePill(label, newField));
        }

        lastSyncedRef.current = { ...lastSyncedRef.current, fields: newFields };
        skipNextSync.current = true;
        onFieldsChange(newFields);

        // Keep the popover open with updated rect
        const newPill = el?.querySelector(`[data-field="${CSS.escape(label)}"]`);
        if (newPill) {
            setEditingField({ label, rect: newPill.getBoundingClientRect() });
        }
    }, [fields, onFieldsChange]);

    // ── Popover portal ──
    const popover = editingField && fields[editingField.label] && createPortal(
        <FieldEditPopover
            label={editingField.label}
            field={fields[editingField.label]}
            rect={editingField.rect}
            onDelete={() => handleDeleteField(editingField.label)}
            onSetDefault={(v) => handleSetDefault(editingField.label, v)}
            onClose={() => setEditingField(null)}
        />,
        document.body,
    );

    const showPlaceholder = !value;

    return (
        <div className="space-y-2">
            <div className="relative">
                <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={handleInput}
                    onClick={handleClick}
                    onCopy={handleCopy}
                    onCut={handleCut}
                    onPaste={handlePaste}
                    onBlur={() => setTimeout(() => setEditingField(null), 200)}
                    className="w-full min-h-[100px] bg-transparent outline-none text-sm text-primary leading-relaxed whitespace-pre-wrap break-words"
                />
                {showPlaceholder && placeholder && (
                    <div className="absolute inset-0 text-sm text-tertiary pointer-events-none leading-relaxed">
                        {placeholder}
                    </div>
                )}
            </div>
            <div className="flex items-center gap-1.5">
                <InsertFieldButton onInsert={handleInsert} />
            </div>
            {popover}
        </div>
    );
};

// ─── Field Edit Popover ──────────────────────────────────────────────

interface FieldEditPopoverProps {
    label: string;
    field: FieldInfo;
    rect: DOMRect;
    onDelete: () => void;
    onSetDefault: (val: string) => void;
    onClose: () => void;
}

const FieldEditPopover = ({ label, field, rect, onDelete, onSetDefault, onClose }: FieldEditPopoverProps) => {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handle = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        };
        document.addEventListener('mousedown', handle);
        return () => document.removeEventListener('mousedown', handle);
    }, [onClose]);

    return (
        <div
            ref={ref}
            className="fixed z-[9999] rounded-xl bg-themewhite2 border border-tertiary/15 shadow-lg min-w-[180px] overflow-hidden"
            style={{ top: rect.bottom + 6, left: rect.left }}
        >
            <div className="p-2.5 space-y-2">
                <div className="flex items-center gap-2">
                    {field.type === 'dropdown'
                        ? <ChevronDown size={12} className="text-themeblue2 shrink-0" />
                        : <TextCursor size={12} className="text-themeblue2/70 shrink-0" />
                    }
                    <p className="text-sm font-medium text-primary flex-1 min-w-0 truncate">{label}</p>
                    <button
                        type="button"
                        onClick={onDelete}
                        className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-themeredred/10 active:scale-95 transition-all"
                    >
                        <Trash2 size={13} className="text-themeredred/50" />
                    </button>
                </div>

                {field.type === 'dropdown' && field.options && field.options.length > 0 && (
                    <div className="space-y-1">
                        <p className="text-[9pt] md:text-[9pt] text-tertiary uppercase tracking-wider">Default</p>
                        <div className="flex flex-wrap gap-1">
                            {field.options.map(opt => {
                                const isDefault = opt === (field.defaultValue ?? field.options![0]);
                                return (
                                    <button
                                        key={opt}
                                        type="button"
                                        onClick={() => onSetDefault(opt)}
                                        className={`text-[9pt] px-2 py-1 rounded-full transition-all active:scale-95 ${
                                            isDefault
                                                ? 'bg-themeblue3 text-white'
                                                : 'bg-tertiary/8 text-tertiary hover:bg-tertiary/12'
                                        }`}
                                    >
                                        {opt}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
