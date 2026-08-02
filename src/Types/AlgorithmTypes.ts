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
    text: string,
    /**
     * Optional routing tag — composes this list item into a structured note
     * section based on the medic's YES/NO answer (selected = YES).
     *   - hpi: YES → positive history statement, NO → pertinent negative.
     *   - pe:  YES → abnormal finding (abnormalKey), NO → normal finding.
     * Untagged options behave exactly as before. Plan is already structured via
     * decisionMaking (ancillaryFind / medFind / specLim).
     *
     * An array routes one option to multiple sections at once — for compound
     * criteria where YES means yes to all parts (e.g. "Stiff Neck AND Fever" →
     * stiff neck to HPI, fever to PE). A single object behaves as before.
     */
    noteTag?: NoteTag | NoteTag[]
}

export type NoteTag =
    | {
        target: 'hpi',
        /** Override the noun used in prose (e.g. "cough" for an option labeled "No Cough"). */
        label?: string,
        /** Flip polarity — YES becomes a pertinent negative. For negatively-phrased
         *  criteria like "No Cough" where selected = absence. */
        invert?: boolean,
        /** Timeframe qualifier ("> 7 days", "within 24 hours"). With a label it
         *  trails the phrase ("fever > 48 hours"); without one it qualifies the
         *  presenting complaint itself ("Presents with sore throat > 10 days"). */
        duration?: string,
        /** Join the phrase to the "Presents with …" lead rather than the Reports
         *  list — for context that reads with the complaint (significant MOI). */
        lead?: boolean,
    }
    | { target: 'pe'; findingKey: string; abnormalKey?: string }
export interface answerOptions {
    text: string,
    disposition: dispositionType[],
    decisionMaking?: decisionMakingType[] | null,
    next: number | number[] | null,
    selectAll: boolean,
    /** Result statement composed into the note's ASSESSMENT when this answer is
     *  chosen — for cards that record a test result rather than a symptom. */
    noteResult?: string
}

export interface dispositionType {
    type: "CAT I" | "CAT II" | "CAT III" | "CAT IV" | "OTHER",
    text: string,
    modifier?: string | null,
    /** "Screen X if present" redirects — tappable jumps to another algorithm. */
    screenRefs?: dispositionScreenRef[],
    /** Care the disposition itself calls for, in note wording, composed into the
     *  PLAN. The modifier is screen shorthand ("place mask"); this is what the
     *  note says ("given face mask"). Screening redirects carry none. */
    planInstructions?: string[],
    /** Orders the disposition itself calls for (labs to send, who to refer to),
     *  composed into their own PLAN block. Same shape as decisionMakingType. */
    planOrders?: Partial<Record<'referral' | 'lab' | 'radiology' | 'followUp', string[]>>,
}

export interface dispositionScreenRef {
    /** Target algorithm id (the subCat `icon`), e.g. "A-3". */
    id: string,
    /** Chip label shown to the user, e.g. "Cold Symptoms". */
    label: string,
}

export interface decisionMakingType {
    type?: 'lim' | 'mcp' | 'dmp';
    text?: string;
    assocMcp?: decisionMakingType;  // Self-referential for MCP association
    ancillaryFind?: ancillaryFindType[];
    medFind?: medListTypes[];
    specLim?: string[];  // Changed to string array
    ddx?: string[];
    /** Discrete patient-care instructions composed into the note's PLAN section
     *  (consolidates the minor-care protocol prose into actionable items).
     *  Medications belong in medFind and orders in planOrders/ancillaryFind —
     *  an instruction that repeats either one prints twice. */
    planInstructions?: string[];
    /** Orders composed into their own PLAN block. ancillaryFind already routes
     *  lab/rad/refer/med automatically; this covers what it cannot express —
     *  chiefly follow-up intervals. */
    planOrders?: Partial<Record<'referral' | 'lab' | 'radiology' | 'followUp', string[]>>;
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