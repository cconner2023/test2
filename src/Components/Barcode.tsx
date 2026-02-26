import { useRef, useEffect, useState, useMemo } from 'react';
import type { AlgorithmOptions } from '../Types/AlgorithmTypes';
import type { CardState } from '../Hooks/useAlgorithm';
import type { UserTypes } from '../Data/User';
import { encodeNoteState, encryptBarcode, renderBarcodeToCanvas } from '../Utilities/NoteCodec';
import { logError } from '../Utilities/ErrorHandler';

// ---------------------------------------------------------------------------
// BarcodeDisplay — shared visual component for barcode canvas + encoded text
// ---------------------------------------------------------------------------

interface BarcodeDisplayProps {
    encodedText: string;
    layout?: 'row' | 'col';
}

/** Renders a Data Matrix barcode canvas alongside the encoded string display. */
export function BarcodeDisplay({ encodedText, layout }: BarcodeDisplayProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isRow = (layout ?? (encodedText.length > 300 ? 'col' : 'row')) === 'row';

    useEffect(() => {
        if (!canvasRef.current || !encodedText) return;
        try {
            renderBarcodeToCanvas(canvasRef.current, encodedText);
        } catch (e) {
            logError('BarcodeDisplay.render', e);
        }
    }, [encodedText]);

    return (
        <div className="p-2 bg-themewhite2">
            <div className={`flex ${isRow ? 'flex-row items-start gap-3' : 'flex-col items-center gap-3'}`}>
                <div className={`shrink-0 ${isRow ? '' : 'flex justify-center'}`}>
                    <canvas
                        ref={canvasRef}
                        className="border border-gray-300 bg-white rounded-md"
                        style={{ maxWidth: '120px', height: 'auto' }}
                    />
                </div>
                <div className={`text-secondary ${isRow ? 'flex-1 min-w-0' : 'w-full'}`}>
                    <code className="text-xs break-all bg-themewhite3 p-2 rounded block max-h-24 overflow-y-auto">
                        {encodedText}
                    </code>
                </div>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// NoteBarcodeGenerator — encodes + encrypts note state, then displays barcode
// ---------------------------------------------------------------------------

interface NoteBarcodeGeneratorProps {
    algorithmOptions: AlgorithmOptions[];
    cardStates: CardState[];
    noteOptions: {
        includeAlgorithm: boolean;
        includeDecisionMaking: boolean;
        customNote: string;
        physicalExamNote?: string;
        user?: UserTypes;
        userId?: string;
    };
    symptomCode?: string;
    onEncodedValueChange?: (value: string) => void;
    layout?: 'row' | 'col';
}

export function NoteBarcodeGenerator({
    algorithmOptions,
    cardStates,
    noteOptions,
    symptomCode = "A1",
    onEncodedValueChange,
    layout = 'col'
}: NoteBarcodeGeneratorProps) {
    const [encodedText, setEncodedText] = useState<string>('');

    const compactString = useMemo(() =>
        encodeNoteState(algorithmOptions, cardStates, noteOptions, symptomCode),
        [algorithmOptions, cardStates, noteOptions.includeAlgorithm, noteOptions.includeDecisionMaking, noteOptions.customNote, noteOptions.physicalExamNote, noteOptions.user, noteOptions.userId, symptomCode]
    );

    // Encrypt (pack + deflate + AES-GCM + base64); fall back to plain ASCII if no key
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const encrypted = await encryptBarcode(compactString);
            if (cancelled) return;
            const displayValue = encrypted ?? compactString;
            setEncodedText(displayValue);
            onEncodedValueChange?.(displayValue);
        })();
        return () => { cancelled = true; };
    }, [compactString, onEncodedValueChange]);

    return <BarcodeDisplay encodedText={encodedText} layout={layout} />;
}
