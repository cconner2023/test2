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
}

export function NoteBarcodeGenerator({
    algorithmOptions,
    cardStates,
    noteOptions,
    symptomCode = "A1",
    onEncodedValueChange
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

    return (
        <div className="p-2 bg-themewhite2">
            {/* Barcode display area - stacked vertically (flex-col) for compact presentation */}
            <div className="flex flex-col items-center gap-3">
                {/* PDF417 Barcode */}
                <div className="flex flex-col items-center">
                    <div className="text-[9pt] text-secondary mb-1.5 font-medium">PDF417 Barcode</div>
                    <canvas
                        ref={canvasRef}
                        width={300}
                        height={120}
                        className="border border-gray-300 bg-white rounded-md"
                        style={{ width: '220px', height: 'auto', maxWidth: '100%' }}
                    />
                </div>

                {/* Encoded string display */}
                <div className="text-[10pt] text-secondary w-full">
                    <div className="text-[9pt] mb-1 font-medium text-center">Encoded String:</div>
                    <code className="text-xs break-all bg-themewhite3 p-2 rounded block">
                        {encodedValue}
                    </code>
                </div>
            </div>
        </div>
    );
}
