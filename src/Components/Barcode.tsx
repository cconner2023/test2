import { useRef, useEffect, useState, useMemo } from 'react';
import type { AlgorithmOptions } from '../Types/AlgorithmTypes';
import type { CardState } from '../Hooks/useAlgorithm';
import type { UserTypes } from '../Data/User';
import { encodeNoteState, encryptBarcode } from '../Utilities/NoteCodec';
import { barcodeSymbols, renderBarcodeSymbol, type BarcodeSymbol } from '../Utilities/barcodeCodec';
import { logError } from '../Utilities/ErrorHandler';
import { selectIsAuthenticated, useAuthStore } from '../stores/useAuthStore';
import type { NoteHistory } from '../Utilities/noteHistory';

// ---------------------------------------------------------------------------
// BarcodeDisplay — shared visual component for barcode canvas + encoded text
// ---------------------------------------------------------------------------

interface BarcodeDisplayProps {
    encodedText: string;
    layout?: 'row' | 'col';
}

/** One symbol of a (possibly multi-symbol) series, with an "i / N" caption when N > 1. */
function SymbolCanvas({ symbol, index, total }: { symbol: BarcodeSymbol; index: number; total: number }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!canvasRef.current) return;
        try {
            renderBarcodeSymbol(canvasRef.current, symbol);
        } catch (e) {
            logError('BarcodeDisplay.render', e);
        }
    }, [symbol]);

    return (
        <div className="flex flex-col items-center gap-1">
            <canvas
                ref={canvasRef}
                className="border border-gray-300 bg-white rounded-md"
                style={{ maxWidth: '120px', height: 'auto' }}
            />
            {total > 1 && <span className="text-[9pt] text-tertiary tabular-nums">{index + 1} / {total}</span>}
        </div>
    );
}

/** Renders the Data Matrix symbol(s) alongside the encoded string display. */
export function BarcodeDisplay({ encodedText, layout }: BarcodeDisplayProps) {
    const symbols = useMemo(() => {
        if (!encodedText) return [];
        try {
            return barcodeSymbols(encodedText);
        } catch (e) {
            logError('BarcodeDisplay.symbols', e);
            return [];
        }
    }, [encodedText]);
    const multi = symbols.length > 1;
    const isRow = !multi && (layout ?? (encodedText.length > 300 ? 'col' : 'row')) === 'row';

    return (
        <div className="p-2 bg-themewhite2">
            <div className={`flex ${isRow ? 'flex-row items-start gap-3' : 'flex-col items-center gap-3'}`}>
                <div className={`shrink-0 ${isRow ? '' : 'flex flex-wrap justify-center gap-3'}`}>
                    {symbols.map((s, i) => <SymbolCanvas key={i} symbol={s} index={i} total={symbols.length} />)}
                </div>
                {multi && (
                    <p className="text-[9pt] text-tertiary text-center">Scan all {symbols.length} symbols, in any order</p>
                )}
                <div className={`text-secondary ${isRow ? 'flex-1 min-w-0' : 'w-full'}`}>
                    <code className="text-[10pt] break-all bg-themewhite3 p-2 rounded block max-h-24 overflow-y-auto">
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
        assessmentNote?: string;
        selectedDdx?: string[];
        customDdx?: string[];
        customNote: string;
        physicalExamNote?: string;
        planNote?: string;
        history?: NoteHistory;
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
    const isAuthenticated = useAuthStore(selectIsAuthenticated);

    const compactString = useMemo(() =>
        encodeNoteState(algorithmOptions, cardStates, noteOptions, symptomCode),
        [algorithmOptions, cardStates, noteOptions.includeAlgorithm, noteOptions.includeDecisionMaking, noteOptions.assessmentNote, noteOptions.selectedDdx, noteOptions.customDdx, noteOptions.customNote, noteOptions.physicalExamNote, noteOptions.planNote, noteOptions.history, noteOptions.user, noteOptions.userId, symptomCode]
    );

    // Encrypt (pack + deflate + AES-GCM + base64); skip for guests, fall back to plain ASCII if no key
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const displayValue = isAuthenticated
                ? (await encryptBarcode(compactString)) ?? compactString
                : compactString;
            if (cancelled) return;
            setEncodedText(displayValue);
            onEncodedValueChange?.(displayValue);
        })();
        return () => { cancelled = true; };
    }, [compactString, isAuthenticated, onEncodedValueChange]);

    return <BarcodeDisplay encodedText={encodedText} layout={layout} />;
}
