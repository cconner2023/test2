import { useState, useMemo, useEffect } from 'react';
import { ActionIconButton, exportStatusToIconStatus } from '../WriteNoteHelpers';
import { useSF600Export } from '../../Hooks/useSF600Export';
import { BarcodeDisplay } from '../Barcode';
import { useUserProfile } from '../../Hooks/useUserProfile';
import { useIsMobile } from '../../Hooks/useIsMobile';
import { useNoteShare } from '../../Hooks/useNoteShare';
import { formatSignature } from '../../Utilities/NoteFormatter';
import { copyWithHtml } from '../../Utilities/clipboardUtils';
import { encodeProviderNote, encodeProviderBundle } from '../../Utilities/noteParser';
import { encryptBarcode } from '../../Utilities/barcodeCodec';
import { selectIsAuthenticated, useAuthStore } from '../../stores/useAuthStore';
import { PdfPreviewModal } from '../PdfPreviewModal';

import type { ImportedMedicNote } from '../ProviderDrawer'
import type { PEState } from '../../Types/PETypes'
import { ActionPill } from '../ActionPill'

export interface ProviderNoteOutputProps {
    hpiNote: string;
    peNote: string;
    peState?: PEState | null;
    assessmentNote: string;
    planNote: string;
    importedMedicNote?: ImportedMedicNote | null;
    medicBarcode?: string;
}

export function ProviderNoteOutput({
    hpiNote,
    peNote,
    peState,
    assessmentNote,
    planNote,
    importedMedicNote,
    medicBarcode,
}: ProviderNoteOutputProps) {
    const { profile } = useUserProfile();
    const isMobile = useIsMobile();
    const { shareNote, shareStatus } = useNoteShare();
    const { exportSF600, sf600ExportStatus, sf600Preview, downloadSF600, clearSF600Preview } = useSF600Export();
    const [copiedTarget, setCopiedTarget] = useState<'preview' | 'encoded' | null>(null);

    const signature = useMemo(
        () => (profile ? formatSignature(profile) : ''),
        [profile]
    );

    const isAuthenticated = useAuthStore(selectIsAuthenticated);
    const userId = useAuthStore(s => s.user?.id);

    const compactString = useMemo(() => {
        const providerOptions = {
            hpiNote,
            peNote,
            peState: peState ?? undefined,
            assessmentNote,
            planNote,
            user: profile ?? undefined,
            userId: userId ?? undefined,
        };

        if (importedMedicNote && medicBarcode) {
            return encodeProviderBundle(medicBarcode, providerOptions);
        }
        return encodeProviderNote(providerOptions);
    }, [hpiNote, peNote, peState, assessmentNote, planNote, profile, userId, importedMedicNote, medicBarcode]);

    const [encodedValue, setEncodedValue] = useState(compactString);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!isAuthenticated) {
                if (!cancelled) { setEncodedValue(compactString); }
                return;
            }
            try {
                const encrypted = await encryptBarcode(compactString);
                if (!cancelled) {
                    setEncodedValue(encrypted ?? compactString);
                }
            } catch {
                if (!cancelled) { setEncodedValue(compactString); }
            }
        })();
        return () => { cancelled = true; };
    }, [compactString, isAuthenticated]);

    const medicSignature = importedMedicNote?.medicSignature || '';

    const previewNote = useMemo(() => {
        const sections: string[] = [];
        const medic = importedMedicNote;
        const sameAuthor = !!medic && !!medicSignature && medicSignature === signature;

        if (medic && !sameAuthor) {
            const layout: [string, string?, string?][] = [
                ['SUBJECTIVE', medic.medicHpi || undefined, hpiNote || undefined],
                ['OBJECTIVE', medic.medicPe || undefined, peNote || undefined],
                ['ASSESSMENT', medic.medicAssessment || undefined, assessmentNote || undefined],
                ['PLAN', medic.medicPlan || undefined, planNote || undefined],
            ];

            // Find last index where each voice has content
            let lastMedic = -1, lastProvider = -1;
            for (let i = layout.length - 1; i >= 0; i--) {
                if (lastMedic < 0 && layout[i][1]) lastMedic = i;
                if (lastProvider < 0 && layout[i][2]) lastProvider = i;
            }

            layout.forEach(([header, medicText, providerText], i) => {
                if (!medicText && !providerText) return;
                sections.push(header);
                if (medicText) {
                    sections.push(medicText);
                    if (i === lastMedic && medicSignature) sections.push(medicSignature);
                }
                if (providerText) {
                    if (medicText) sections.push('Provider');
                    sections.push(providerText);
                    if (i === lastProvider && signature) sections.push(signature);
                }
            });
        } else {
            // Solo provider or same-author (medic editing own note as provider)
            const addSection = (header: string, medicText?: string, providerText?: string) => {
                const combined = [medicText, providerText].filter(Boolean).join('\n');
                if (!combined) return;
                sections.push(header);
                sections.push(combined);
            };
            if (medic) {
                addSection('SUBJECTIVE', medic.medicHpi, hpiNote);
                addSection('OBJECTIVE', medic.medicPe, peNote);
                addSection('ASSESSMENT', medic.medicAssessment, assessmentNote);
                addSection('PLAN', medic.medicPlan, planNote);
            } else {
                addSection('SUBJECTIVE', undefined, hpiNote);
                addSection('OBJECTIVE', undefined, peNote);
                addSection('ASSESSMENT', undefined, assessmentNote);
                addSection('PLAN', undefined, planNote);
            }
            if (signature) { sections.push(signature); }
        }

        return sections.join('\n');
    }, [hpiNote, peNote, assessmentNote, planNote, importedMedicNote, signature, medicSignature]);

    function handleCopy(text: string, target: 'preview' | 'encoded') {
        copyWithHtml(text);
        setCopiedTarget(target);
        setTimeout(() => setCopiedTarget(null), 2000);
    }

    function handleShare() {
        shareNote({ encodedText: encodedValue, symptomText: 'Provider Note' }, isMobile);
    }

    function handleExportSF600() {
        if (!previewNote) return;
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
        const nameParts = [profile.lastName, profile.firstName, profile.middleInitial].filter(Boolean).join(' ');
        const suffix = [profile.credential, profile.rank, profile.component].filter(Boolean).join(', ');
        const sigName = suffix ? `${nameParts} ${suffix}` : nameParts;
        exportSF600({
            noteText: previewNote,
            date: dateStr,
            signatureName: sigName || undefined,
        });
    }

    const shareBtnStatus = shareStatus === 'idle' ? 'idle'
        : shareStatus === 'copied' || shareStatus === 'shared' ? 'done'
            : 'busy';

    return (
        <div className="space-y-4" data-tour="provider-output">
            {/* Note Preview */}
            <div>
                <div className="pb-2 flex items-center justify-between">
                    <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider">Note Preview</p>
                    <ActionPill>
                        <ActionIconButton
                            onClick={() => handleCopy(previewNote, 'preview')}
                            status={copiedTarget === 'preview' ? 'done' : 'idle'}
                            variant="copy"
                            title="Copy note text"
                        />
                        <ActionIconButton
                            onClick={handleExportSF600}
                            status={exportStatusToIconStatus(sf600ExportStatus)}
                            variant="pdf"
                            title="Export SF600 PDF"
                        />
                    </ActionPill>
                </div>
                <div className="rounded-xl bg-themewhite2 overflow-hidden">
                    <div className="px-4 py-3 text-tertiary text-[9pt] whitespace-pre-wrap max-h-48 md:max-h-80 overflow-y-auto">
                        {previewNote
                            ? previewNote.split('\n').filter(l => !l.startsWith('Signed:')).join('\n').trim()
                            : 'No content available'}
                    </div>
                </div>
            </div>

            {/* Encoded Note */}
            <div>
                <div className="pb-2 flex items-center justify-between">
                    <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider">Encoded Note</p>
                    <ActionPill>
                        <ActionIconButton
                            onClick={handleShare}
                            status={shareBtnStatus}
                            variant="share"
                            title="Copy barcode image"
                        />
                        <ActionIconButton
                            onClick={() => handleCopy(encodedValue, 'encoded')}
                            status={copiedTarget === 'encoded' ? 'done' : 'idle'}
                            variant="copy"
                            title="Copy encoded text"
                        />
                    </ActionPill>
                </div>
                <div>
                    <BarcodeDisplay
                        encodedText={encodedValue}
                        layout={encodedValue.length > 300 ? 'col' : 'row'}
                    />
                </div>
                {encodedValue.length > 2000 && (
                    <div className="text-[10pt] text-themeyellow mt-2 px-1">
                        Note is large ({encodedValue.length} chars) — barcode may not scan reliably. Consider shortening text fields.
                    </div>
                )}
            </div>
            <PdfPreviewModal
                preview={sf600Preview}
                onDownload={downloadSF600}
                onClose={clearSF600Preview}
            />
        </div>
    );
}
