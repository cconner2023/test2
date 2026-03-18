import { useState } from 'react';
import { parseNoteEncoding, findAlgorithmByCode, findSymptomByCode, reconstructCardStates } from '../../Utilities/noteParser';
import { isEncryptedBarcode, decryptBarcode } from '../../Utilities/NoteCodec';
import { assembleNote, formatSignature } from '../../Utilities/NoteFormatter';

interface ProviderImportProps {
  hpiNote: string;
  setHpiNote: (note: string) => void;
  peNote: string;
  setPeNote: (note: string) => void;
  assessmentNote: string;
  setAssessmentNote: (note: string) => void;
  planNote: string;
  setPlanNote: (note: string) => void;
  onNext: () => void;
  onMedicNoteImported: (medicNote: {
    medicHpi: string;
    medicPe: string;
    medicAssessment: string;
    medicPlan: string;
    medicName: string;
    medicSignature: string;
  }) => void;
}

type ImportPhase = 'input' | 'overlay';

interface MedicData {
  hpi: string;
  pe: string;
  assessment: string;
  plan: string;
  name: string;
  signature: string;
}

function OverlaySection({
  label,
  medicContent,
  medicName,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  medicContent: string;
  medicName: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">{label}</h3>

      {medicContent && (
        <div className="rounded-xl bg-themewhite2 px-4 py-3">
          <p className="text-[9pt] text-tertiary/50 mb-1">{medicName}</p>
          <div className="text-sm text-primary whitespace-pre-wrap">{medicContent}</div>
        </div>
      )}

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full min-h-[80px] rounded-xl border border-themeblue3/10 shadow-xs bg-themewhite p-3 text-sm text-primary placeholder:text-tertiary/30 focus:border-themeblue1/30 focus:bg-themewhite2 focus:outline-none resize-none transition-all duration-300"
      />
    </div>
  );
}

export function ProviderImport({
  hpiNote,
  setHpiNote,
  peNote,
  setPeNote,
  assessmentNote,
  setAssessmentNote,
  planNote,
  setPlanNote,
  onNext,
  onMedicNoteImported,
}: ProviderImportProps) {
  const [phase, setPhase] = useState<ImportPhase>('input');
  const [inputText, setInputText] = useState('');
  const [decodeError, setDecodeError] = useState('');
  const [medicData, setMedicData] = useState<MedicData | null>(null);

  const handleDecode = async () => {
    setDecodeError('');
    try {
      let payload = inputText.trim();

      if (isEncryptedBarcode(payload)) {
        const decrypted = await decryptBarcode(payload);
        if (!decrypted) {
          setDecodeError('Unable to decrypt. Sign in and sync encryption key.');
          return;
        }
        payload = decrypted;
      }

      const parsed = parseNoteEncoding(payload);
      if (!parsed) {
        setDecodeError('Could not decode note.');
        return;
      }

      const authorLabel = parsed.user
        ? formatSignature(parsed.user) || 'Unknown Medic'
        : 'Unknown Medic';

      // Reconstruct algorithm + decision making as the medic's assessment
      let assessmentText = '';
      if (parsed.symptomCode) {
        const algorithmOptions = findAlgorithmByCode(parsed.symptomCode);
        if (algorithmOptions?.length) {
          const { cardStates, disposition } = reconstructCardStates(algorithmOptions, parsed);
          const symptomInfo = findSymptomByCode(parsed.symptomCode);
          const selectedSymptom = symptomInfo
            ? { icon: symptomInfo.symptom.icon || '', text: symptomInfo.symptom.text || '' }
            : undefined;
          const assembled = assembleNote(
            {
              includeAlgorithm: parsed.flags.includeAlgorithm,
              includeDecisionMaking: parsed.flags.includeDecisionMaking,
              customNote: '',
              physicalExamNote: '',
              planNote: '',
            },
            algorithmOptions,
            cardStates,
            disposition?.type ?? '',
            disposition?.text ?? '',
            selectedSymptom,
          );
          const parts: string[] = [];
          if (assembled.sections.algorithm) parts.push(assembled.sections.algorithm);
          if (assembled.sections.decisionMaking) parts.push(assembled.sections.decisionMaking);
          assessmentText = parts.join('\n\n');
        }
      }

      const medic: MedicData = {
        hpi: parsed.hpiText || '',
        pe: parsed.peText || '',
        assessment: assessmentText,
        plan: parsed.planText || '',
        name: authorLabel,
        signature: authorLabel,
      };

      setMedicData(medic);
      onMedicNoteImported({
        medicHpi: medic.hpi,
        medicPe: medic.pe,
        medicAssessment: medic.assessment,
        medicPlan: medic.plan,
        medicName: medic.name,
        medicSignature: medic.signature,
      });
      setPhase('overlay');
    } catch {
      setDecodeError('Failed to decode note.');
    }
  };

  if (phase === 'overlay' && medicData) {
    return (
      <div className="h-full overflow-y-auto px-4 py-4 space-y-5 pb-8">
        <OverlaySection
          label="HPI"
          medicContent={medicData.hpi}
          medicName={medicData.name}
          value={hpiNote}
          onChange={setHpiNote}
          placeholder="Provider HPI notes..."
        />

        <OverlaySection
          label="Physical Exam"
          medicContent={medicData.pe}
          medicName={medicData.name}
          value={peNote}
          onChange={setPeNote}
          placeholder="Provider PE notes..."
        />

        <OverlaySection
          label="Assessment"
          medicContent={medicData.assessment}
          medicName={medicData.name}
          value={assessmentNote}
          onChange={setAssessmentNote}
          placeholder="Clinical assessment, diagnosis..."
        />

        <OverlaySection
          label="Plan"
          medicContent={medicData.plan}
          medicName={medicData.name}
          value={planNote}
          onChange={setPlanNote}
          placeholder="Treatment plan, orders..."
        />

        <button
          onClick={onNext}
          className="w-full py-3 rounded-lg bg-themeblue3 text-white font-medium text-sm active:scale-95 transition-transform"
        >
          Next
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="text-sm text-tertiary/70">
        Paste an encoded note or scan a barcode to import a medic's note.
      </div>
      <textarea
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        placeholder="Paste encoded note here..."
        className="w-full min-h-[100px] rounded-xl border border-themeblue3/10 shadow-xs bg-themewhite p-3 text-xs text-primary font-mono placeholder:text-tertiary/30 focus:border-themeblue1/30 focus:bg-themewhite2 focus:outline-none resize-none transition-all duration-300"
      />
      {decodeError && (
        <div className="text-xs text-themeredred">{decodeError}</div>
      )}
      <button
        onClick={handleDecode}
        disabled={!inputText.trim()}
        className="w-full py-3 rounded-lg bg-themeblue3 text-white font-medium text-sm active:scale-95 transition-transform disabled:opacity-40"
      >
        Import Note
      </button>
    </div>
  );
}
