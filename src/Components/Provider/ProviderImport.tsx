import { useState, useRef, useCallback } from 'react';
import { X, ImagePlus, CheckCircle, ChevronRight } from 'lucide-react';
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
      <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">{label}</p>

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (file.type.startsWith('image/')) {
      setDecodeError('Image barcode scanning coming soon. Paste the encoded text instead.');
      return;
    }
    const text = await file.text();
    setInputText(text.trim());
  }, []);

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

        <div className="flex items-center justify-end pt-4">
          <button
            onClick={onNext}
            className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 active:scale-95 transition-all md:w-auto md:h-auto md:px-5 md:py-2.5 md:rounded-xl md:gap-2 bg-themeblue3 text-white"
            aria-label="Next"
          >
            <span className="hidden md:inline text-sm font-medium">Next</span>
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 flex items-center">
          <div className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 text-tertiary/50 hover:text-themeblue3 active:scale-95 transition-colors"
              title="Upload image"
            >
              <ImagePlus size={16} />
            </button>
          </div>
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && inputText.trim()) handleDecode(); }}
            className="w-full rounded-full py-2.5 pl-12 pr-10 border border-themegray1 focus:border-themeblue2 focus:outline-none text-sm bg-themewhite text-tertiary"
            placeholder="Paste encoded note or scan"
          />
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center">
            {inputText ? (
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => setInputText('')}
                  className="p-1 text-tertiary/40 hover:text-tertiary active:scale-95 transition-colors"
                  title="Clear"
                >
                  <X size={14} />
                </button>
                <button
                  type="button"
                  onClick={handleDecode}
                  className="p-1 text-themeblue3 hover:text-themeblue3/80 active:scale-95 transition-colors"
                  title="Decode"
                >
                  <CheckCircle size={22} />
                </button>
              </div>
            ) : (
              <span className="p-1 text-tertiary/20">
                <CheckCircle size={22} />
              </span>
            )}
          </div>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
      {decodeError && (
        <div className="text-xs text-themeredred">{decodeError}</div>
      )}
    </div>
  );
}
