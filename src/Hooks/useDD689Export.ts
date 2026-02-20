// Hooks/useDD689Export.ts — Export a note as a filled DD Form 689 PDF
import { useCallback, useState } from 'react';
import type { DD689ExportParams } from '../Utilities/DD689Export';

type ExportStatus = 'idle' | 'generating' | 'done' | 'error';

export function useDD689Export() {
    const [exportStatus, setExportStatus] = useState<ExportStatus>('idle');

    const exportDD689 = useCallback(async (params: DD689ExportParams) => {
        try {
            setExportStatus('generating');

            // Double lazy-load: utility module + pdf-lib are both excluded from main bundle
            const { generateDD689Pdf, downloadPdfBytes } = await import('../Utilities/DD689Export');

            const bytes = await generateDD689Pdf(params);
            const filename = `DD689-${params.symptomText?.replace(/[^a-zA-Z0-9]/g, '-') || 'note'}.pdf`;
            downloadPdfBytes(bytes, filename);

            setExportStatus('done');
            setTimeout(() => setExportStatus('idle'), 2500);
        } catch (err) {
            console.error('DD689 export failed:', err);
            setExportStatus('error');
            setTimeout(() => setExportStatus('idle'), 2500);
        }
    }, []);

    return { exportDD689, exportStatus };
}
