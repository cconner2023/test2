import { useRef, useEffect, useState } from 'react';
import PDF417 from 'pdf417-generator';
import type { AlgorithmOptions } from '../Types/AlgorithmTypes';
import type { CardState } from '../Hooks/useAlgorithm';

interface NoteCaptureOptions {
    includeAlgorithm: boolean;
    customNote: string;
}

interface NoteBarcodeGeneratorProps {
    algorithmOptions: AlgorithmOptions[];
    cardStates: CardState[];
    noteOptions: NoteCaptureOptions;
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
    const { includeAlgorithm } = noteOptions;

    const getLastVisibleCard = () => {
        for (let i = cardStates.length - 1; i >= 0; i--) {
            if (cardStates[i]?.isVisible) {
                return i;
            }
        }
        return -1;
    };

    const generateCompactString = () => {
        if (!includeAlgorithm) {
            const emptyValue = '';
            setEncodedValue(emptyValue);
            onEncodedValueChange?.(emptyValue);
            return emptyValue;
        }

        const parts: string[] = [];
        parts.push(symptomCode);

        if (cardStates[0]?.selectedOptions) {
            const totalOptions = algorithmOptions[0]?.questionOptions?.length || 0;
            let binary = '';
            for (let i = 0; i < totalOptions; i++) {
                binary += cardStates[0].selectedOptions.includes(i) ? '1' : '0';
            }
            parts.push(`R${parseInt(binary || '0', 2).toString(36)}`);
        }

        const lastCardIndex = getLastVisibleCard();
        if (lastCardIndex > 0) {
            const state = cardStates[lastCardIndex];
            parts.push(`L${lastCardIndex}`);
            if (state.selectedOptions.length > 0) {
                parts.push(`S${[...state.selectedOptions].sort().join('')}`);
            }
            if (state.answer) {
                const card = algorithmOptions[lastCardIndex];
                const answerIndex = card?.questionOptions?.findIndex(
                    opt => opt.text === state.answer?.text
                );
                if (answerIndex !== undefined && answerIndex >= 0) {
                    parts.push(`A${answerIndex}`);
                }
            }
        }

        const result = parts.join('|');
        setEncodedValue(result);
        onEncodedValueChange?.(result);
        return result;
    };

    useEffect(() => {
        if (!canvasRef.current || !includeAlgorithm) return;

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
    }, [algorithmOptions, cardStates, includeAlgorithm, symptomCode]);

    // Initial generation
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