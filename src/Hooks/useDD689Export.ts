// Hooks/useDD689Export.ts — Export a note as a filled DD Form 689 PDF
import { useCallback } from 'react';
import type { DD689ExportParams } from '../Utilities/DD689Export';
import { usePdfExport } from './usePdfExport';

export type ExportStatus = 'idle' | 'generating' | 'done' | 'error';

/** Lazy-loads the DD689 PDF generator and returns preview data. */
export function useDD689Export() {
    const generateFn = useCallback(async (params: DD689ExportParams) => {
        const { generateDD689Pdf } = await import('../Utilities/DD689Export');
        const bytes = await generateDD689Pdf(params);
        const filename = `DD689-${params.symptomText?.replace(/[^a-zA-Z0-9]/g, '-') || 'note'}.pdf`;
        return { bytes, filename };
    }, []);

    const { status, preview, exportPdf, downloadPreview, clearPreview } = usePdfExport(generateFn);

    return {
        exportDD689: exportPdf,
        exportStatus: status,
        dd689Preview: preview,
        downloadDD689: downloadPreview,
        clearDD689Preview: clearPreview,
    };
}
