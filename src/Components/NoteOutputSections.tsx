import type { ReactNode } from 'react';
import { Copy, Share2, FileDown, Stethoscope } from 'lucide-react';
import { OverlayActionMenu } from '@/Components/primitives/OverlayActionMenu';
import type { ActionSheetOption } from '@/Components/primitives/ActionSheet';

const SECTION_HEADER_CLASS = 'text-[9pt] font-semibold text-tertiary tracking-widest uppercase';

/**
 * Export rows for a note's Finish (Check FAB) ActionSheet, after its save /
 * log rows: SF600, DD689, share image, and — for providers — Edit in Provider.
 * Copy stays on each section's corner button for quick reach.
 */
export function noteExportOptions(a: {
    onExportSF600: () => void;
    onExportDD689: () => void;
    onShare: () => void;
    /** Provider role only — reopens the note in the Provider drawer. */
    onEditInProvider?: () => void;
}): ActionSheetOption[] {
    return [
        { key: 'sf600', label: 'Export SF600 PDF', icon: FileDown, onAction: a.onExportSF600 },
        { key: 'dd689', label: 'Export DD689 PDF', icon: FileDown, onAction: a.onExportDD689 },
        { key: 'share', label: 'Share note as image', icon: Share2, onAction: a.onShare },
        ...(a.onEditInProvider
            ? [{ key: 'edit-provider', label: 'Edit in Provider', icon: Stethoscope, onAction: a.onEditInProvider }]
            : []),
    ];
}

/**
 * Note Preview + Encoded Note sections of a terminal note page. Shared by
 * WriteNotePage, the base Import Note drawer and the provider Note Output so a
 * written note and an imported one present the same text and data matrices.
 * Each section carries only a copy button; exports live in the Finish menu.
 */
export function NoteOutputSections({
    previewNote,
    barcode,
    onCopyNote,
    onCopyEncoded,
}: {
    previewNote: string;
    /** Data-matrix renderer (NoteBarcodeGenerator for a live note, BarcodeDisplay for an imported one). */
    barcode: ReactNode;
    onCopyNote: () => void;
    onCopyEncoded: () => void;
}) {
    return (
        <>
            {/* Note Preview */}
            <section>
                <div className="pb-2 flex items-center gap-2">
                    <p className={SECTION_HEADER_CLASS}>Note Preview</p>
                </div>
                <div className="relative">
                    <OverlayActionMenu shadow="sm" items={[{ key: 'copy', label: 'Copy note text', icon: Copy, onAction: onCopyNote }]} />
                    <div className="rounded-2xl bg-themewhite2 overflow-hidden">
                        <div className="px-4 pt-3 pb-3 text-tertiary text-[9pt] whitespace-pre-wrap max-h-48 overflow-y-auto">
                            {previewNote || "No content selected"}
                        </div>
                    </div>
                </div>
            </section>

            {/* Encoded Note / Barcode */}
            <section>
                <div className="pb-2 flex items-center gap-2">
                    <p className={SECTION_HEADER_CLASS}>Encoded Note</p>
                </div>
                <div className="relative">
                    <OverlayActionMenu shadow="sm" items={[{ key: 'copy', label: 'Copy encoded text', icon: Copy, onAction: onCopyEncoded }]} />
                    <div className="rounded-2xl bg-themewhite2 overflow-hidden">
                        <div className="px-4 pt-3 pb-3">
                            {barcode}
                        </div>
                    </div>
                </div>
            </section>
        </>
    );
}
