// Hooks/useDD1380Export.ts — Export a TC3 card as a filled DD Form 1380 PDF
import { useCallback } from 'react';
import type { DD1380ExportParams } from '../Utilities/DD1380Export';
import { usePdfExport } from './usePdfExport';

export type ExportStatus = 'idle' | 'generating' | 'done' | 'error';

export function useDD1380Export() {
    const generateFn = useCallback(async (params: DD1380ExportParams) => {
        const { generateDD1380Pdf } = await import('../Utilities/DD1380Export');
        const bytes = await generateDD1380Pdf(params);
        const filename = `DD1380-${params.card.casualty.lastName || 'card'}.pdf`;
        return { bytes, filename };
    }, []);

    const { status, preview, exportPdf, downloadPreview, clearPreview } = usePdfExport(generateFn);

    return {
        exportDD1380: exportPdf,
        dd1380ExportStatus: status,
        dd1380Preview: preview,
        downloadDD1380: downloadPreview,
        clearDD1380Preview: clearPreview,
    };
}
