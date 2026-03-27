import { useRef, useEffect, useState, useMemo } from 'react';
import type { AlgorithmOptions } from '../Types/AlgorithmTypes';
import type { CardState } from '../Hooks/useAlgorithm';
import type { UserTypes } from '../Data/User';
import { encodeNoteState, encryptBarcodeWithBytes, renderBarcodeToCanvas } from '../Utilities/NoteCodec';
import { logError } from '../Utilities/ErrorHandler';
import { selectIsAuthenticated, useAuthStore } from '../stores/useAuthStore';

// ---------------------------------------------------------------------------
// BarcodeDisplay — shared visual component for barcode canvas + encoded text
// ---------------------------------------------------------------------------

interface BarcodeDisplayProps {
    encodedText: string;
    barcodeBytes?: Uint8Array | null;
    layout?: 'row' | 'col';
}

/** Renders a Data Matrix barcode canvas alongside the encoded string display. */
export function BarcodeDisplay({ encodedText, barcodeBytes, layout }: BarcodeDisplayProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isRow = (layout ?? (encodedText.length > 300 ? 'col' : 'row')) === 'row';

    useEffect(() => {
        if (!canvasRef.current || !encodedText) return;
        try {
            renderBarcodeToCanvas(canvasRef.current, barcodeBytes ?? encodedText);
        } catch (e) {
            logError('BarcodeDisplay.render', e);
        }
    }, [encodedText, barcodeBytes]);

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
        planNote?: string;
        user?: UserTypes;
        userId?: string;
    };
    symptomCode?: string;
    onEncodedValueChange?: (value: string) => void;
    onBarcodeBytesChange?: (bytes: Uint8Array | null) => void;
    layout?: 'row' | 'col';
}

export function NoteBarcodeGenerator({
    algorithmOptions,
    cardStates,
    noteOptions,
    symptomCode = "A1",
    onEncodedValueChange,
    onBarcodeBytesChange,
    layout = 'col'
}: NoteBarcodeGeneratorProps) {
    const [encodedText, setEncodedText] = useState<string>('');
    const [barcodeBytes, setBarcodeBytes] = useState<Uint8Array | null>(null);
    const isAuthenticated = useAuthStore(selectIsAuthenticated);

    const compactString = useMemo(() =>
        encodeNoteState(algorithmOptions, cardStates, noteOptions, symptomCode),
        [algorithmOptions, cardStates, noteOptions.includeAlgorithm, noteOptions.includeDecisionMaking, noteOptions.customNote, noteOptions.physicalExamNote, noteOptions.planNote, noteOptions.user, noteOptions.userId, symptomCode]
    );

    // Encrypt (pack + deflate + AES-GCM + base64); skip for guests, fall back to plain ASCII if no key
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const result = isAuthenticated ? await encryptBarcodeWithBytes(compactString) : null;
            if (cancelled) return;
            const displayValue = result?.text ?? compactString;
            const bytes = result?.bytes ?? null;
            setEncodedText(displayValue);
            setBarcodeBytes(bytes);
            onEncodedValueChange?.(displayValue);
            onBarcodeBytesChange?.(bytes);
        })();
        return () => { cancelled = true; };
    }, [compactString, isAuthenticated, onEncodedValueChange, onBarcodeBytesChange]);

    return <BarcodeDisplay encodedText={encodedText} barcodeBytes={barcodeBytes} layout={layout} />;
}
