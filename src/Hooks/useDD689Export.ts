// Hooks/useDD689Export.ts — Export a note as a filled DD Form 689 PDF
import { useCallback } from 'react';
import type { DD689ExportParams } from '../Utilities/DD689Export';
import { UI_TIMING } from '../Utilities/constants';
import { usePdfExport } from './usePdfExport';

export type ExportStatus = 'idle' | 'generating' | 'done' | 'error';

/** Lazy-loads the DD689 PDF generator and triggers a browser download of the filled form. */
export function useDD689Export() {
    const doExport = useCallback(async (params: DD689ExportParams) => {
        // Double lazy-load: utility module + pdf-lib are both excluded from main bundle
        const { generateDD689Pdf, downloadPdfBytes } = await import('../Utilities/DD689Export');
        const bytes = await generateDD689Pdf(params);
        const filename = `DD689-${params.symptomText?.replace(/[^a-zA-Z0-9]/g, '-') || 'note'}.pdf`;
        downloadPdfBytes(bytes, filename);
    }, []);

    const { status: exportStatus, exportPdf: exportDD689 } = usePdfExport(doExport, {
        resetAfterMs: UI_TIMING.FEEDBACK_DURATION,
    });

    return { exportDD689, exportStatus };
}
