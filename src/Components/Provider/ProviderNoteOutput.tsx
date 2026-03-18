import { useState, useMemo } from 'react';
import { ActionIconButton } from '../WriteNoteHelpers';
import { BarcodeDisplay } from '../Barcode';
import { useUserProfile } from '../../Hooks/useUserProfile';
import { formatSignature } from '../../Utilities/NoteFormatter';
import { copyWithHtml } from '../../Utilities/clipboardUtils';

import type { ImportedMedicNote } from '../ProviderDrawer'

export interface ProviderNoteOutputProps {
    hpiNote: string;
    peNote: string;
    assessmentNote: string;
    planNote: string;
    importedMedicNote?: ImportedMedicNote | null;
}

export function ProviderNoteOutput({
    hpiNote,
    peNote,
    assessmentNote,
    planNote,
    importedMedicNote,
}: ProviderNoteOutputProps) {
    const { profile } = useUserProfile();
    const [copiedTarget, setCopiedTarget] = useState<'preview' | 'encoded' | null>(null);

    const signature = useMemo(
        () => (profile ? formatSignature(profile) : ''),
        [profile]
    );

    const previewNote = useMemo(() => {
        if (importedMedicNote) {
            const sections: string[] = [];

            sections.push('=== HPI ===');
            if (importedMedicNote.medicHpi) sections.push(importedMedicNote.medicHpi);
            if (hpiNote) {
                sections.push('--- Provider ---');
                sections.push(hpiNote);
            }

            sections.push('');
            sections.push('=== Physical Exam ===');
            if (importedMedicNote.medicPe) sections.push(importedMedicNote.medicPe);
            if (peNote) {
                sections.push('--- Provider ---');
                sections.push(peNote);
            }

            sections.push('');
            sections.push('=== Assessment ===');
            if (importedMedicNote.medicAssessment) sections.push(importedMedicNote.medicAssessment);
            sections.push('--- Provider ---');
            sections.push(assessmentNote);

            sections.push('');
            sections.push('=== Plan ===');
            if (importedMedicNote.medicPlan) sections.push(importedMedicNote.medicPlan);
            sections.push('--- Provider ---');
            sections.push(planNote);

            if (signature) {
                sections.push('');
                sections.push(signature);
            }

            return sections.join('\n');
        }

        const sections: string[] = [];

        sections.push('=== HPI ===');
        sections.push(hpiNote);

        sections.push('');
        sections.push('=== Physical Exam ===');
        sections.push(peNote);

        sections.push('');
        sections.push('=== Assessment ===');
        sections.push(assessmentNote);

        sections.push('');
        sections.push('=== Plan ===');
        sections.push(planNote);

        if (signature) {
            sections.push('');
            sections.push(signature);
        }

        return sections.join('\n');
    }, [hpiNote, peNote, assessmentNote, planNote, importedMedicNote, signature]);

    const encodedValue = previewNote;

    function handleCopy(text: string, target: 'preview' | 'encoded') {
        copyWithHtml(text);
        setCopiedTarget(target);
        setTimeout(() => setCopiedTarget(null), 2000);
    }

    return (
        <div className="space-y-4">
            {/* Note Preview */}
            <div>
                <div className="flex items-center justify-between p-3 rounded-t-md bg-themewhite text-xs text-secondary">
                    <span className="font-medium">Note Preview</span>
                    <ActionIconButton
                        onClick={() => handleCopy(previewNote, 'preview')}
                        status={copiedTarget === 'preview' ? 'done' : 'idle'}
                        variant="copy"
                        title="Copy note text"
                    />
                </div>
                <div className="p-3 rounded-b-md bg-themewhite3 text-tertiary text-[8pt] whitespace-pre-wrap max-h-48 overflow-y-auto border border-themegray1/15">
                    {previewNote || 'No content available'}
                </div>
            </div>

            {/* Encoded Note */}
            <div>
                <div className="flex items-center justify-between p-3 rounded-t-md bg-themewhite text-xs text-secondary">
                    <span className="font-medium">Encoded Note</span>
                    <div className="flex items-center gap-1">
                        <ActionIconButton
                            onClick={() => handleCopy(encodedValue, 'encoded')}
                            status={copiedTarget === 'encoded' ? 'done' : 'idle'}
                            variant="copy"
                            title="Copy encoded text"
                        />
                    </div>
                </div>
                <div className="mt-1">
                    <BarcodeDisplay
                        encodedText={encodedValue}
                        layout={encodedValue.length > 300 ? 'col' : 'row'}
                    />
                </div>
            </div>
        </div>
    );
}
