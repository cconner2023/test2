import { useRef, useEffect, useState, useMemo } from 'react';
import PDF417 from 'pdf417-generator';
import type { AlgorithmOptions } from '../Types/AlgorithmTypes';
import type { CardState } from '../Hooks/useAlgorithm';
import { encodeNoteState } from '../Utilities/NoteCodec';

interface NoteBarcodeGeneratorProps {
    algorithmOptions: AlgorithmOptions[];
    cardStates: CardState[];
    noteOptions: {
        includeAlgorithm: boolean;
        includeDecisionMaking: boolean;
        customNote: string;
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
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [encodedValue, setEncodedValue] = useState<string>('');

    const compactString = useMemo(() =>
        encodeNoteState(algorithmOptions, cardStates, noteOptions, symptomCode),
        [algorithmOptions, cardStates, noteOptions.includeAlgorithm, noteOptions.includeDecisionMaking, noteOptions.customNote, symptomCode]
    );

    // Update state and notify parent when encoded value changes
    useEffect(() => {
        setEncodedValue(compactString);
        onEncodedValueChange?.(compactString);
    }, [compactString, onEncodedValueChange]);

    // Render PDF417 barcode on canvas whenever encoded value changes
    useEffect(() => {
        if (!canvasRef.current || !encodedValue) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        if (PDF417 && typeof (PDF417 as any).draw === 'function') {
            (PDF417 as any).draw(encodedValue, canvas);
        } else {
            PDF417(canvas, encodedValue, {
                bw: 2,
                height: 4,
                padding: 10
            });
        }
    }, [encodedValue]);

    const isRow = layout === 'row';

    return (
        <div className="p-2 bg-themewhite2">
            <div className={`flex ${isRow ? 'flex-row items-start gap-3' : 'flex-col items-center gap-3'}`}>
                {/* PDF417 Barcode — fixed display size */}
                <div className={`shrink-0 ${isRow ? '' : 'flex justify-center'}`}>
                    <canvas
                        ref={canvasRef}
                        width={300}
                        height={120}
                        className="border border-gray-300 bg-white rounded-md"
                        style={{ width: '200px', height: 'auto' }}
                    />
                </div>

                {/* Encoded string display */}
                <div className={`text-secondary ${isRow ? 'flex-1 min-w-0' : 'w-full'}`}>
                    <code className="text-xs break-all bg-themewhite3 p-2 rounded block max-h-24 overflow-y-auto">
                        {encodedValue}
                    </code>
                </div>
            </div>
        </div>
    );
}
