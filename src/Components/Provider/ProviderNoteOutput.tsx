import { useState, useMemo } from 'react';
import { useClusterLabel } from '../../Utilities/clusterLabel';
import { useSF600Export } from '../../Hooks/useSF600Export';
import { useDD689Export } from '../../Hooks/useDD689Export';
import { NoteOutputSections } from '../NoteOutputSections';
import { BarcodeDisplay } from '../Barcode';
import { useUserProfile } from '../../Hooks/useUserProfile';
import { useIsMobile } from '../../Hooks/useIsMobile';
import { useNoteShare } from '../../Hooks/useNoteShare';
import { formatSignature } from '../../Utilities/NoteFormatter';
import { copyWithHtml } from '../../Utilities/clipboardUtils';
import { useAuthStore } from '../../stores/useAuthStore';
import { PdfPreviewModal } from '../PdfPreviewModal';
import { PatientIdPopover, type PatientIdForm } from '../PatientIdPopover';
import type { PatientIdentification } from '../../Utilities/SF600Export';
import type { DD689Extras } from '../../Utilities/DD689Export';

import type { ImportedMedicNote } from '../ProviderDrawer'

export interface ProviderNoteOutputProps {
    hpiNote: string;
    peNote: string;
    assessmentNote: string;
    planNote: string;
    importedMedicNote?: ImportedMedicNote | null;
    /** From useProviderEncoded — the drawer owns it so Done can save it to My Notes. */
    encodedValue: string;
}

export function ProviderNoteOutput({
    hpiNote,
    peNote,
    assessmentNote,
    planNote,
    importedMedicNote,
    encodedValue,
}: ProviderNoteOutputProps) {
    const { profile } = useUserProfile();
    const isMobile = useIsMobile();
    const { shareNote } = useNoteShare();
    const { exportSF600, sf600ExportStatus, sf600Preview, downloadSF600, clearSF600Preview } = useSF600Export();
    const { exportDD689, exportStatus, dd689Preview, downloadDD689, clearDD689Preview } = useDD689Export();

    const signature = useMemo(
        () => (profile ? formatSignature(profile) : ''),
        [profile]
    );

    // SF600 / DD689 facility line — cluster nickname, falling back to unit name.
    const formClinicName = useClusterLabel(useAuthStore(s => s.clinicId), profile.clinicName);

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

            // Every block is signed by its author
            const providerSig = signature || 'Unknown Provider';
            layout.forEach(([header, medicText, providerText]) => {
                if (!medicText && !providerText) return;
                sections.push(header);
                if (medicText) {
                    sections.push(medicText);
                    sections.push(medicSignature);
                }
                if (providerText) {
                    sections.push(providerText);
                    sections.push(providerSig);
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

    function handleShare() {
        shareNote({ encodedText: encodedValue, symptomText: 'Provider Note' }, isMobile);
    }

    const [patientGate, setPatientGate] = useState<PatientIdForm | null>(null);

    function doExportSF600(patient: PatientIdentification) {
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
            patient,
            facility: formClinicName || undefined,
        });
    }

    function handleExportDD689(patient: PatientIdentification, extras: DD689Extras) {
        exportDD689({
            encodedValue,
            dispositionType: '',
            dispositionText: '',
            symptomText: 'Provider Note',
            clinicName: formClinicName || '',
            authorLine: signature || undefined,
            patient,
            ...extras,
        });
    }

    return (
        <div className="space-y-4">
            <NoteOutputSections
                previewNote={previewNote}
                onCopyNote={() => copyWithHtml(previewNote)}
                onExportSF600={() => { if (previewNote) setPatientGate('sf600'); }}
                onCopyEncoded={() => copyWithHtml(encodedValue)}
                onShare={handleShare}
                onExportDD689={() => setPatientGate('dd689')}
                encodedLength={encodedValue.length}
                barcode={<BarcodeDisplay encodedText={encodedValue} layout={encodedValue.length > 300 ? 'col' : 'row'} />}
            />
            <PatientIdPopover
                isOpen={patientGate !== null}
                anchorRect={null}
                form={patientGate ?? undefined}
                onClose={() => setPatientGate(null)}
                onConfirm={(patient, extras) => patientGate === 'dd689' ? handleExportDD689(patient, extras) : doExportSF600(patient)}
            />
            <PdfPreviewModal
                preview={sf600Preview ?? dd689Preview ?? null}
                generating={sf600ExportStatus === 'generating' || exportStatus === 'generating'}
                onDownload={sf600Preview ? downloadSF600 : downloadDD689}
                onClose={sf600Preview ? clearSF600Preview : clearDD689Preview}
            />
        </div>
    );
}
