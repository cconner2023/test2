import { type medListTypes } from "../Data/MedData"

export interface AlgorithmType {
    id: string,
    options?: AlgorithmOptions[]
}
export interface AlgorithmOptions {
    text: string,
    type: "choice" | "count" | "action" | "initial" | 'rf',
    questionOptions: questionOptions[],
    answerOptions: answerOptions[],
    performable?: boolean,
    initialVisible?: boolean,
    screenerConfig?: ScreenerConfig
}

export interface questionOptions {
    text: string
}
export interface answerOptions {
    text: string,
    disposition: dispositionType[],
    decisionMaking?: decisionMakingType[] | null,
    next: number | number[] | null,
    selectAll: boolean
}

export interface dispositionType {
    type: "CAT I" | "CAT II" | "CAT III" | "CAT IV" | "OTHER",
    text: string,
    modifier?: string | null,
}

export interface decisionMakingType {
    type?: 'lim' | 'mcp' | 'dmp';
    text?: string;
    assocMcp?: decisionMakingType;  // Self-referential for MCP association
    ancillaryFind?: ancillaryFindType[];
    medFind?: medListTypes[];
    specLim?: string[];  // Changed to string array
    ddx?: string[];
}

// ---------------------------------------------------------------------------
// Screener types (GAD-7, PHQ-2, PHQ-9)
// ---------------------------------------------------------------------------

export interface ScreenerQuestion {
    text: string;
    type?: 'scale' | 'check' | 'info';    // default 'scale'
    scaleOptions?: ScreenerScaleOption[];   // for 'scale' type (per-question override)
    options?: string[];                     // for 'check' type (multi-select labels)
    scored?: boolean;                       // contributes to total? default: true for 'scale', false otherwise
    sectionHeader?: string;                 // renders a section divider above this question
    dynamicContent?: 'wordList' | 'digitStrings' | 'recallWords';  // MACE2 word list / digit string display
}
export interface ScreenerScaleOption { value: number; label: string }
export interface ScreenerInterpretation { minScore: number; maxScore: number; label: string }
export interface ScreenerFollowUp { text: string; options: string[] }

export interface ScreenerWordList {
    name: string;
    words: string[];
    digits: {
        trial1: string[];
        trial2: string[];
    };
}

/** Conditional gate that hides later sections until criteria are met */
export interface ScreenerGate {
    requiredIndex: number;                 // must be 1 (e.g. 1D blow/jolt)
    anyOfIndices: number[];                // at least one must be 1 (e.g. 2A-2D)
    positiveMessage: string;
    negativeMessage: string;
    gatedFromIndex: number;                // questions at/after this index are hidden when gate closed
}

export interface ScreenerConfig {
    id: string;                            // "GAD7", "PHQ2", "PHQ9", "MACE2"
    title: string;                         // "GAD-7 Anxiety Screener"
    instruction: string;                   // "Over the last two weeks..."
    questions: ScreenerQuestion[];
    scaleOptions: ScreenerScaleOption[];
    interpretations: ScreenerInterpretation[];
    threshold: number;                     // Score for Positive/Negative
    invertThreshold?: boolean;             // true = score ≤ threshold is concerning (MACE 2)
    gate?: ScreenerGate;                   // Conditional gate (MACE 2 concussion screening)
    followUp?: ScreenerFollowUp;           // GAD-7 difficulty question
    conditionalExtension?: {               // PHQ-2 → PHQ-9
        screener: ScreenerConfig;          // The extended screener
        threshold: number;                 // Score to trigger extension
        carryOverQuestions: number;         // Questions to pre-fill (2)
    };
    wordLists?: ScreenerWordList[];        // MACE2 word lists (A-F) for random selection
}

// Other types remain the same
export interface ancillaryFindType {
    type?: 'lab' | 'med' | 'rad' | 'refer' | 'protocol';
    modifier?: string;
}