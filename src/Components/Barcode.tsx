import { useRef, useEffect, useState } from 'react';
import PDF417 from 'pdf417-generator';
import type { AlgorithmOptions } from '../Types/AlgorithmTypes';
import type { CardState } from '../Hooks/useAlgorithm';

interface NoteBarcodeOptions {
    includeAlgorithm: boolean;
    includeDecisionMaking: boolean;
    customNote: string;
}

interface NoteBarcodeGeneratorProps {
    algorithmOptions: AlgorithmOptions[];
    cardStates: CardState[];
    noteOptions: NoteBarcodeOptions;
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

    const generateCompactString = () => {
        const parts: string[] = [];

        // 1. Symptom code (e.g. "A1")
        parts.push(symptomCode);

        // 2. Red flag selections (card 0 if RF type)
        const rfCard = algorithmOptions[0];
        if (rfCard?.type === 'rf' && cardStates[0]?.selectedOptions) {
            const totalOptions = rfCard.questionOptions?.length || 0;
            let bitmask = 0;
            for (let i = 0; i < totalOptions; i++) {
                if (cardStates[0].selectedOptions.includes(i)) {
                    bitmask |= (1 << i);
                }
            }
            parts.push(`R${bitmask.toString(36)}`);
        } else {
            parts.push('R0');
        }

        // 3. Each visible non-RF card: {index}.{selBitmaskBase36}.{answerIndex}
        for (let i = 0; i < cardStates.length; i++) {
            const state = cardStates[i];
            const card = algorithmOptions[i];
            if (!state?.isVisible || !card || card.type === 'rf') continue;

            let selBitmask = 0;
            for (const optIdx of state.selectedOptions) {
                selBitmask |= (1 << optIdx);
            }

            // Answer index from answerOptions (not questionOptions)
            let answerIdx = -1;
            if (state.answer) {
                answerIdx = card.answerOptions.findIndex(a => a.text === state.answer?.text);
            }

            parts.push(`${i}.${selBitmask.toString(36)}.${answerIdx}`);
        }

        // 4. HPI text (base64 encoded for barcode safety)
        const customNote = noteOptions.customNote?.trim();
        if (customNote) {
            try {
                parts.push(`H${btoa(encodeURIComponent(customNote))}`);
            } catch {
                parts.push(`H${encodeURIComponent(customNote)}`);
            }
        }

        // 5. Flags: bit0=includeAlgorithm, bit1=includeDM, bit2=includeHPI
        let flags = 0;
        if (noteOptions.includeAlgorithm) flags |= 1;
        if (noteOptions.includeDecisionMaking) flags |= 2;
        if (customNote) flags |= 4;
        parts.push(`F${flags}`);

        const result = parts.join('|');
        setEncodedValue(result);
        onEncodedValueChange?.(result);
        return result;
    };

    useEffect(() => {
        if (!canvasRef.current) return;

        const dataString = generateCompactString();
        if (!dataString) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        if (PDF417 && typeof (PDF417 as any).draw === 'function') {
            (PDF417 as any).draw(dataString, canvas);
        } else {
            PDF417(canvas, dataString, {
                bw: 2,
                height: 4,
                padding: 10
            });
        }
    }, [algorithmOptions, cardStates, noteOptions.includeAlgorithm, noteOptions.includeDecisionMaking, noteOptions.customNote, symptomCode]);

    useEffect(() => {
        generateCompactString();
    }, []);

    return (
        <div className="p-2 bg-themewhite2">
            <div className="flex gap-5 justify-between items-center">
                <canvas
                    ref={canvasRef}
                    width={500}
                    height={200}
                    className="border border-gray-300 bg-white rounded-md"
                />
                <div className="text-[10pt] text-secondary p-3 w-full">
                    <div className="font-[9pt] mb-1">Encoded String:</div>
                    <code className="text-xs break-all bg-themewhite3 p-2 rounded block">
                        {encodedValue}
                    </code>
                </div>
            </div>
        </div>
    );
}
