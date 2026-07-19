import { useMemo, type RefObject } from 'react';
import { AnchoredMenu, type MenuCardRow, type SearchLevelSpec } from '@/Components/primitives/LiftedRowMenu';
import { expansionPreview } from '@/Components/Settings/TextExpanderManager';
import type { TextExpander } from '@/Data/User';

/** A text template carrying merge provenance (see useMergedNoteContent.MergedTextExpander). */
type PickableExpander = TextExpander & {
    sourceClinicName?: string | null;
    sourceCollides?: boolean;
};

interface TextTemplatePickerProps {
    /** Controlled visibility — the menu stays mounted so AnchoredMenu plays its
     *  rise-in / fade-out. Host toggles this, not a conditional render. */
    isOpen: boolean;
    /** The trigger button the anchored card pins to (the Brackets affordance). */
    anchorRef: RefObject<HTMLElement | null>;
    expanders: PickableExpander[];
    onPick: (expander: TextExpander) => void;
    onClose: () => void;
}

/**
 * Browse-and-insert panel for text templates — the discovery counterpart to the
 * abbreviation-triggered TextExpanderSuggestion. Opens from the Brackets affordance
 * on a note editor so a user who doesn't know a template's abbr (especially
 * clinic/cluster-scoped ones) can still find and apply it. Applying a *templated*
 * entry starts its fill session via the host's onPick.
 *
 * Rendered as an AnchoredMenu search level (portals to <body> at z-9998), so it
 * escapes any `overflow-hidden` note-card ancestor — the old absolutely-positioned
 * panel was clipped INSIDE the textarea and also fell behind other chrome.
 */
export const TextTemplatePicker = ({ isOpen, anchorRef, expanders, onPick, onClose }: TextTemplatePickerProps) => {
    // Row provenance is carried by array index so the picker can map a selected
    // card back to its source expander (MenuCardRow has no payload slot).
    const spec = useMemo<SearchLevelSpec>(() => ({
        title: 'Text templates',
        placeholder: 'Search templates…',
        emptyText: expanders.length === 0 ? 'No text templates yet' : 'No matching templates',
        rows: (filter: string): MenuCardRow[] => {
            const q = filter.trim().toLowerCase();
            return expanders
                .map((e, i) => ({ e, i }))
                .filter(({ e }) => !q || e.abbr.toLowerCase().includes(q) || e.expansion.toLowerCase().includes(q))
                .map(({ e, i }) => {
                    const preview = expansionPreview(e);
                    return {
                        id: String(i),
                        label: e.abbr,
                        sub: e.sourceClinicName ? `${e.sourceClinicName} · ${preview}` : preview,
                    };
                });
        },
        onPick: (row: MenuCardRow) => {
            const e = expanders[Number(row.id)];
            if (e) onPick(e);
        },
    }), [expanders, onPick]);

    return (
        <AnchoredMenu
            isOpen={isOpen}
            anchorRef={anchorRef}
            anchorRect={null}
            layout="list"
            rootSearch={spec}
            items={[]}
            onClose={onClose}
        />
    );
};
