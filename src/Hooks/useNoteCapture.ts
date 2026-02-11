import { useCallback } from 'react';
import type { AlgorithmOptions } from '../Types/AlgorithmTypes';
import type { CardState } from './useAlgorithm';
import { assembleNote } from '../Utilities/NoteFormatter';

interface NoteCaptureOptions {
    includeAlgorithm: boolean;
    includeDecisionMaking: boolean;
    customNote: string;
}

interface NoteCaptureResult {
    sections: {
        algorithm?: string;
        decisionMaking?: string;
        customNote: string;
    };
    fullNote: string;
}

export const useNoteCapture = (
    algorithmOptions: AlgorithmOptions[],
    cardStates: CardState[]
) => {
    const generateNote = useCallback((
        options: NoteCaptureOptions,
        dispositionType: string,
        dispositionText: string,
        selectedSymptom?: { icon: string; text: string; }
    ): NoteCaptureResult => {
        return assembleNote(
            options,
            algorithmOptions,
            cardStates,
            dispositionType,
            dispositionText,
            selectedSymptom,
        );
    }, [algorithmOptions, cardStates]);

    return {
        generateNote
    };
};
