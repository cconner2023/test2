import type { ReactNode } from 'react';
import { Copy, Share2, FileDown } from 'lucide-react';
import { OverlayActionMenu } from '@/Components/primitives/OverlayActionMenu';

const SECTION_HEADER_CLASS = 'text-[9pt] font-semibold text-tertiary tracking-widest uppercase';

/**
 * Note Preview + Encoded Note sections of the Full Note page. Shared by
 * WriteNotePage, the base Import Note drawer and the provider Note Output so a written note and an
 * imported one present the same text, data matrices and actions.
 */
export function NoteOutputSections({
    previewNote,
    barcode,
    onCopyNote,
    onExportSF600,
    onCopyEncoded,
    onShare,
    onExportDD689,
    encodedLength = 0,
}: {
    previewNote: string;
    /** Data-matrix renderer (NoteBarcodeGenerator for a live note, BarcodeDisplay for an imported one). */
    barcode: ReactNode;
    onCopyNote: () => void;
    onExportSF600: () => void;
    onCopyEncoded: () => void;
    onShare: () => void;
    onExportDD689: () => void;
    /** Encoded string length — past 2000 chars the matrix may not scan reliably. */
    encodedLength?: number;
}) {
    return (
        <>
            {/* Note Preview */}
            <section>
                <div className="pb-2 flex items-center gap-2">
                    <p className={SECTION_HEADER_CLASS}>Note Preview</p>
                </div>
                <div className="relative">
                    {/* Plain rows, not `render` tiles: a rendered item owns its own
                        button and the menu stays open, which left the SF600 preview
                        stranded behind it. */}
                    <OverlayActionMenu
                        shadow="sm"
                        items={[
                            { key: 'copy', label: 'Copy note text', icon: Copy, onAction: onCopyNote },
                            { key: 'export', label: 'Export SF600 PDF', icon: FileDown, onAction: onExportSF600 },
                        ]}
                    />
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
                    <OverlayActionMenu
                        shadow="sm"
                        items={[
                            { key: 'copy', label: 'Copy encoded text', icon: Copy, onAction: onCopyEncoded },
                            { key: 'share', label: 'Share note as image', icon: Share2, onAction: onShare },
                            { key: 'export', label: 'Export DD689 PDF', icon: FileDown, onAction: onExportDD689 },
                        ]}
                    />
                    <div className="rounded-2xl bg-themewhite2 overflow-hidden">
                        <div className="px-4 pt-3 pb-3">
                            {barcode}
                        </div>
                    </div>
                </div>
                {encodedLength > 2000 && (
                    <div className="text-[10pt] text-themeyellow mt-2 px-1">
                        Note is large ({encodedLength} chars) — barcode may not scan reliably. Consider shortening text fields.
                    </div>
                )}
            </section>
        </>
    );
}
