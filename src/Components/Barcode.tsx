import { useRef, useEffect, useState, useMemo } from 'react';
import bwipjs from 'bwip-js';
import type { AlgorithmOptions } from '../Types/AlgorithmTypes';
import type { CardState } from '../Hooks/useAlgorithm';
import type { UserTypes } from '../Data/User';
import { encodeNoteState } from '../Utilities/NoteCodec';

interface NoteBarcodeGeneratorProps {
    algorithmOptions: AlgorithmOptions[];
    cardStates: CardState[];
    noteOptions: {
        includeAlgorithm: boolean;
        includeDecisionMaking: boolean;
        customNote: string;
        physicalExamNote?: string;
        user?: UserTypes;
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
        [algorithmOptions, cardStates, noteOptions.includeAlgorithm, noteOptions.includeDecisionMaking, noteOptions.customNote, noteOptions.physicalExamNote, noteOptions.user, symptomCode]
    );

    // Update state and notify parent when encoded value changes
    useEffect(() => {
        setEncodedValue(compactString);
        onEncodedValueChange?.(compactString);
    }, [compactString, onEncodedValueChange]);

    // Render Data Matrix barcode on canvas whenever encoded value changes
    useEffect(() => {
        if (!canvasRef.current || !encodedValue) return;

        try {
            bwipjs.toCanvas(canvasRef.current, {
                bcid: 'datamatrix',
                text: encodedValue,
                scale: 3,
                padding: 4,
            });
        } catch (e) {
            console.error('Data Matrix render failed:', e);
        }
    }, [encodedValue]);

    const isRow = layout === 'row';

    return (
        <div className="p-2 bg-themewhite2">
            <div className={`flex ${isRow ? 'flex-row items-start gap-3' : 'flex-col items-center gap-3'}`}>
                {/* Data Matrix Barcode */}
                <div className={`shrink-0 ${isRow ? '' : 'flex justify-center'}`}>
                    <canvas
                        ref={canvasRef}
                        className="border border-gray-300 bg-white rounded-md"
                        style={{ maxWidth: '200px', height: 'auto' }}
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
