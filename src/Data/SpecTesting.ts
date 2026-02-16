import type { ScreenerConfig, ScreenerScaleOption, ScreenerWordList } from '../Types/AlgorithmTypes';

// Shared 4-point Likert scale (0-3) used by GAD-7, PHQ-2, PHQ-9
export const likertScale: ScreenerScaleOption[] = [
    { value: 0, label: 'Not at all' },
    { value: 1, label: 'Several days' },
    { value: 2, label: 'More than half the days' },
    { value: 3, label: 'Nearly every day' },
];

// ---------------------------------------------------------------------------
// PHQ-9 (defined first because PHQ-2 references it via conditionalExtension)
// ---------------------------------------------------------------------------

export const PHQ9: ScreenerConfig = {
    id: 'PHQ9',
    title: 'PHQ-9 Depression Screener',
    instruction: 'Over the last 2 weeks, how often have you been bothered by the following problems?',
    questions: [
        { text: 'Little interest or pleasure in doing things' },
        { text: 'Feeling down, depressed or hopeless' },
        { text: 'Trouble falling asleep, staying asleep, or sleeping too much' },
        { text: 'Feeling tired or having little energy' },
        { text: 'Poor appetite or overeating' },
        { text: 'Feeling bad about yourself - or that you\'re a failure or have let yourself or your family down' },
        { text: 'Trouble concentrating on things, such as reading the newspaper or watching television' },
        { text: 'Moving or speaking so slowly that other people could have noticed. Or, the opposite - being so fidgety or restless that you have been moving around a lot more than usual' },
        { text: 'Thoughts that you would be better off dead or of hurting yourself in some way' },
    ],
    scaleOptions: likertScale,
    interpretations: [
        { minScore: 0, maxScore: 4, label: 'Minimal Depression' },
        { minScore: 5, maxScore: 9, label: 'Mild Depression' },
        { minScore: 10, maxScore: 14, label: 'Moderate Depression' },
        { minScore: 15, maxScore: 19, label: 'Moderately Severe Depression' },
        { minScore: 20, maxScore: 27, label: 'Severe Depression' },
    ],
    threshold: 10,
};

// ---------------------------------------------------------------------------
// PHQ-2 (first 2 questions of PHQ-9, extends to PHQ-9 if score >= 3)
// ---------------------------------------------------------------------------

export const PHQ2: ScreenerConfig = {
    id: 'PHQ2',
    title: 'Depression Screening (PHQ-2)',
    instruction: 'Over the last 2 weeks, how often have you been bothered by the following problems?',
    questions: [
        { text: 'Little interest or pleasure in doing things' },
        { text: 'Feeling down, depressed or hopeless' },
    ],
    scaleOptions: likertScale,
    interpretations: [
        { minScore: 0, maxScore: 2, label: 'Negative Screen' },
        { minScore: 3, maxScore: 6, label: 'Positive Screen' },
    ],
    threshold: 3,
    conditionalExtension: {
        screener: PHQ9,
        threshold: 3,
        carryOverQuestions: 2,
    },
};

// ---------------------------------------------------------------------------
// GAD-7 Anxiety Screener
// ---------------------------------------------------------------------------

export const GAD7: ScreenerConfig = {
    id: 'GAD7',
    title: 'GAD-7 Anxiety Screener',
    instruction: 'Over the last two weeks, how often have you been bothered by the following problems?',
    questions: [
        { text: 'Feeling nervous, anxious, or on edge' },
        { text: 'Not being able to stop or control worrying' },
        { text: 'Worrying too much about different things' },
        { text: 'Trouble relaxing' },
        { text: 'Being so restless that it is hard to sit still' },
        { text: 'Becoming easily annoyed or irritable' },
        { text: 'Feeling afraid, as if something awful might happen' },
    ],
    scaleOptions: likertScale,
    interpretations: [
        { minScore: 0, maxScore: 4, label: 'Minimal Anxiety' },
        { minScore: 5, maxScore: 9, label: 'Mild Anxiety' },
        { minScore: 10, maxScore: 14, label: 'Moderate Anxiety' },
        { minScore: 15, maxScore: 21, label: 'Severe Anxiety' },
    ],
    threshold: 10,
    followUp: {
        text: 'If you checked any problems, how difficult have they made it for you to do your work, take care of things at home, or get along with other people?',
        options: [
            'Not difficult at all',
            'Somewhat difficult',
            'Very difficult',
            'Extremely difficult',
        ],
    },
};

// ---------------------------------------------------------------------------
// Shared scales
// ---------------------------------------------------------------------------

function numericScale(max: number): ScreenerScaleOption[] {
    return Array.from({ length: max + 1 }, (_, i) => ({ value: i, label: String(i) }));
}

const yesNoScale: ScreenerScaleOption[] = [
    { value: 0, label: 'No' },
    { value: 1, label: 'Yes' },
];

const yesNoUnknownScale: ScreenerScaleOption[] = [
    { value: 0, label: 'No' },
    { value: 1, label: 'Yes' },
    { value: 2, label: 'Unknown' },
];

const normalAbnormalScale: ScreenerScaleOption[] = [
    { value: 0, label: 'Normal' },
    { value: 1, label: 'Abnormal' },
];

const vomsScale: ScreenerScaleOption[] = [
    { value: 0, label: 'Normal' },
    { value: 1, label: 'Abnormal' },
    { value: 2, label: 'Not Tested' },
];

const MACE2_WORD_LISTS: ScreenerWordList[] = [
    {
        name: 'A',
        words: ['Jacket', 'Pepper', 'Arrow', 'Cotton', 'Movie'],
        digits: {
            trial1: ['4-9-3', '3-8-1-4', '6-2-9-7-1', '7-1-8-4-6-3'],
            trial2: ['6-2-9', '3-2-7-9', '1-5-2-8-5', '5-3-9-1-4-8'],
        },
    },
    {
        name: 'B',
        words: ['Dollar', 'Mirror', 'Honey', 'Saddle', 'Anchor'],
        digits: {
            trial1: ['5-2-6', '1-7-9-5', '4-8-5-2-7', '8-3-1-9-6-4'],
            trial2: ['4-1-5', '4-9-6-8', '6-1-8-4-3', '7-2-7-8-5-6'],
        },
    },
    {
        name: 'C',
        words: ['Finger', 'Blanket', 'Penny', 'Lemon', 'Insect'],
        digits: {
            trial1: ['1-4-2', '6-8-3-1', '4-9-1-5-3', '3-7-6-5-1-9'],
            trial2: ['6-5-8', '3-4-8-1', '6-8-2-5-1', '9-2-6-5-1-4'],
        },
    },
    {
        name: 'D',
        words: ['Baby', 'Perfume', 'Monkey', 'Sunset', 'Iron'],
        digits: {
            trial1: ['7-8-2', '4-1-8-3', '1-7-9-2-6', '2-6-4-8-1-7'],
            trial2: ['9-2-6', '9-7-2-3', '4-1-7-5-2', '8-4-1-9-3-5'],
        },
    },
    {
        name: 'E',
        words: ['Candle', 'Sugar', 'Paper', 'Sandwich', 'Wagon'],
        digits: {
            trial1: ['3-8-2', '2-7-9-3', '4-1-8-6-9', '6-9-7-3-8-2'],
            trial2: ['5-1-8', '2-1-6-9', '9-4-1-7-5', '4-2-7-9-3-8'],
        },
    },
    {
        name: 'F',
        words: ['Elbow', 'Carpet', 'Apple', 'Saddle', 'Bubble'],
        digits: {
            trial1: ['2-7-1', '1-6-8-3', '2-4-7-5-8', '5-8-6-2-4-9'],
            trial2: ['4-7-9', '3-9-2-4', '8-3-9-6-4', '3-1-7-8-2-6'],
        },
    },
];

// ---------------------------------------------------------------------------
// MACE 2 — Military Acute Concussion Evaluation
// Full exam: Red Flags → Screening → Symptoms → History → Cognitive → Neuro → VOMS
// ---------------------------------------------------------------------------

export const MACE2: ScreenerConfig = {
    id: 'MACE2',
    title: 'MACE 2 — Military Acute Concussion Evaluation',
    instruction: 'Use MACE 2 as close to time of injury as possible. Evaluate for red flags in patients with GCS 13-15.',
    questions: [
        // ── Red Flags (indices 0-1) ─────────────────────────────────────
        {
            text: 'Defer MACE 2 if any red flags are present. Immediately consult higher level of care and consider urgent evacuation according to TCCC.',
            type: 'info',
            sectionHeader: 'Red Flags',
        },                                                                          // 0
        {
            text: 'Red flags present:',
            type: 'check',
            options: [
                'Deteriorating level of consciousness',
                'Double vision',
                'Increased restlessness, combative or agitated behavior',
                'Repeat vomiting',
                'Positive structural brain injury detection device result',
                'Seizures',
                'Weakness or tingling in arms or legs',
                'Severe or worsening headache',
            ],
        },                                                                          // 1

        // ── Concussion Screening (indices 2-8) ─────────────────────────
        {
            text: 'Observable signs at time of injury:',
            type: 'check',
            sectionHeader: 'Concussion Screening',
            options: [
                'Lying motionless on the ground',
                'Slow to get up after a direct or indirect blow to the head',
                'Disorientation, confusion, or inability to respond appropriately',
                'Blank or vacant look',
                'Balance difficulties, stumbling, or slow labored movements',
                'Facial injury after head trauma',
            ],
        },                                                                          // 2
        {
            text: 'Type of event (check all that apply):',
            type: 'check',
            options: [
                'Blunt object', 'Sports injury', 'Gunshot wound', 'Fall',
                'Assault', 'Explosion/blast', 'Motor vehicle crash',
                'Fragment', 'Other',
            ],
        },                                                                          // 3
        { text: '(1D) Was there a blow or jolt to the head?', scaleOptions: yesNoScale, scored: false },  // 4
        { text: '(2A) Alteration of consciousness (AOC)?', scaleOptions: yesNoScale, scored: false },     // 5
        { text: '(2B) Loss of consciousness (LOC)?', scaleOptions: yesNoScale, scored: false },           // 6
        { text: '(2C) Post-traumatic amnesia (PTA)?', scaleOptions: yesNoScale, scored: false },          // 7
        { text: '(2D) AOC, LOC, or PTA witnessed?', scaleOptions: yesNoScale, scored: false },            // 8

        // ── Symptoms (index 9) ──────────────────────────────────────────
        {
            text: 'Symptoms (check all that apply):',
            type: 'check',
            sectionHeader: 'Symptoms',
            options: [
                'Headache', 'Dizziness', 'Memory problems', 'Balance problems',
                'Nausea/vomiting', 'Difficulty concentrating', 'Irritability',
                'Visual disturbances', 'Ringing in the ears', 'Other',
            ],
        },                                                                          // 9

        // ═══ GATE: 1D=Yes AND any of 2A-2D=Yes → continue ═══════════
        // Everything below index 10 is hidden when gate is closed

        // ── History (indices 10-12) ─────────────────────────────────────
        { text: 'During the past 12 months, diagnosed with a concussion (not counting this event)?', scaleOptions: yesNoUnknownScale, scored: false, sectionHeader: 'History' },  // 10
        { text: 'History of diagnosed/treated headache disorder or migraine?', scaleOptions: yesNoScale, scored: false },                                                         // 11
        { text: 'History of depression, anxiety, or other behavioral health concerns?', scaleOptions: yesNoScale, scored: false },                                                // 12

        // ── Cognitive Exam — Orientation + Immediate Memory (indices 13-17, SCORED) ──
        { text: 'Orientation — Score one point for each correct response (month, date, day of week, year, time within 1 hour)', scaleOptions: numericScale(5), sectionHeader: 'Cognitive Exam' },  // 13
        {
            text: 'Read the word list to the service member for each trial. Score one point for each word recalled.',
            type: 'info',
            dynamicContent: 'wordList',
        },                                                                          // 14
        { text: 'Immediate Memory — Trial 1 (words recalled)', scaleOptions: numericScale(5) },   // 15
        { text: 'Immediate Memory — Trial 2 (words recalled)', scaleOptions: numericScale(5) },   // 16
        { text: 'Immediate Memory — Trial 3 (words recalled)', scaleOptions: numericScale(5) },   // 17

        // ── Neurological Exam (indices 18-25, NOT scored) ────────────────
        {
            text: 'Speech Fluency — Speech should be fluid and effortless, no pauses or unnatural breaks. Stuttering or struggling to speak is abnormal.',
            scaleOptions: normalAbnormalScale,
            scored: false,
            sectionHeader: 'Neurological Exam',
        },                                                                          // 18
        {
            text: 'Word Finding — Difficulty coming up with names of objects or grasping to find words is abnormal.',
            scaleOptions: normalAbnormalScale,
            scored: false,
        },                                                                          // 19
        {
            text: 'Grip Strength — Should be strong and equal bilaterally. Unequal or weak grip strength is abnormal.',
            scaleOptions: normalAbnormalScale,
            scored: false,
        },                                                                          // 20
        {
            text: 'Pronator Drift — Stand with eyes closed, arms extended forward, palms up. Assess 5-10 seconds. Any arm or palm drift is abnormal.',
            scaleOptions: normalAbnormalScale,
            scored: false,
        },                                                                          // 21
        {
            text: 'Single Leg Stance — Stand on one leg, arms across chest, eyes closed. Time 15 seconds each leg. Loss of balance before 8 seconds is abnormal.',
            scaleOptions: normalAbnormalScale,
            scored: false,
        },                                                                          // 22
        {
            text: 'Tandem Gait — Six heel-to-toe steps, arms at side. Stumbling or shifting feet is abnormal.',
            scaleOptions: normalAbnormalScale,
            scored: false,
        },                                                                          // 23
        {
            text: 'Pupil Response — Pupils should be round, equal, and briskly constrict to light. Unequal size, dilation, or delay is abnormal.',
            scaleOptions: normalAbnormalScale,
            scored: false,
        },                                                                          // 24
        {
            text: 'Eye Tracking — Both eyes should smoothly track side-to-side and up-down. Unequal, irregular, or delayed tracking is abnormal.',
            scaleOptions: normalAbnormalScale,
            scored: false,
        },                                                                          // 25

        // ── Concentration (indices 26-28, SCORED) ────────────────────────
        {
            text: 'Use the same list chosen for Immediate Memory. Read digit strings and have the service member repeat them backward.',
            type: 'info',
            sectionHeader: 'Concentration',
            dynamicContent: 'digitStrings',
        },                                                                          // 26
        { text: 'Concentration — Reverse Digits (total correct)', scaleOptions: numericScale(4) },                                                // 27
        { text: 'Concentration — Months in Reverse Order (Dec through Jan)', scaleOptions: [{ value: 0, label: 'Incorrect' }, { value: 1, label: 'Correct' }] },  // 28

        // ── Delayed Recall (indices 29-30, SCORED) ───────────────────────
        {
            text: 'Ask the service member to recall the word list from Immediate Memory. Do NOT repeat the words.',
            type: 'info',
            sectionHeader: 'Delayed Recall',
            dynamicContent: 'recallWords',
        },                                                                          // 29
        { text: 'Delayed Recall (words recalled)', scaleOptions: numericScale(5) },                                                               // 30

        // ── VOMS (indices 31-39, NOT scored) ─────────────────────────────
        {
            text: 'Vestibular/Ocular-Motor Screening (VOMS). WARNING: Contraindicated with unstable cervical spine. Consider deferring if patient is overtly symptomatic or trained provider unavailable. VOMS should be completed before return to duty.',
            type: 'info',
            sectionHeader: 'VOMS',
        },                                                                          // 31
        {
            text: 'Baseline Symptoms — Record headache, dizziness, nausea, and fogginess (HDNF) on 0-10 scale prior to screening.',
            scaleOptions: vomsScale,
            scored: false,
        },                                                                          // 32
        {
            text: 'Smooth Pursuits — Focus on fingertip target moving horizontally then vertically. Perform twice each direction.',
            scaleOptions: vomsScale,
            scored: false,
        },                                                                          // 33
        {
            text: 'Saccades — Horizontal — Eyes move quickly between two points 30\u00B0 left and right. Perform 10 times.',
            scaleOptions: vomsScale,
            scored: false,
        },                                                                          // 34
        {
            text: 'Saccades — Vertical — Eyes move quickly between two points 30\u00B0 up and down. Perform 10 times.',
            scaleOptions: vomsScale,
            scored: false,
        },                                                                          // 35
        {
            text: 'Convergence — Focus on target at arm\'s length, slowly bring toward nose. Stop at double vision or eye deviation. Measure 3 times. \u22655cm is abnormal.',
            scaleOptions: vomsScale,
            scored: false,
        },                                                                          // 36
        {
            text: 'VOR — Horizontal — Head rotates horizontally focusing on target, 20\u00B0 each side at 180 bpm. Perform 10 times.',
            scaleOptions: vomsScale,
            scored: false,
        },                                                                          // 37
        {
            text: 'VOR — Vertical — Head moves vertically focusing on target, 20\u00B0 up and down at 180 bpm. Perform 10 times.',
            scaleOptions: vomsScale,
            scored: false,
        },                                                                          // 38
        {
            text: 'Visual Motion Sensitivity (VMS) — Stand in busy area, rotate head/eyes/trunk as unit 80\u00B0 right and left at 50 bpm. Perform 5 times.',
            scaleOptions: vomsScale,
            scored: false,
        },                                                                          // 39
    ],
    scaleOptions: [],
    interpretations: [
        { minScore: 0, maxScore: 25, label: 'Abnormal (Positive Screen)' },
        { minScore: 26, maxScore: 30, label: 'Normal (Negative Screen)' },
    ],
    threshold: 25,
    invertThreshold: true,
    gate: {
        requiredIndex: 4,                  // 1D: blow or jolt to the head
        anyOfIndices: [5, 6, 7, 8],        // 2A-2D: AOC, LOC, PTA, witnessed
        positiveMessage: 'POSITIVE CONCUSSION SCREEN — Continue MACE 2. Complete evaluation before prescribing rest.',
        negativeMessage: 'NEGATIVE CONCUSSION SCREEN — Stop MACE 2. Initiate 24-hour rest period.',
        gatedFromIndex: 10,                // History onward hidden when gate closed
    },
    wordLists: MACE2_WORD_LISTS,
};

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/** Whether a question contributes to the screener score total */
export function isQuestionScored(q: { type?: string; scored?: boolean }): boolean {
    if (q.scored !== undefined) return q.scored;
    if (q.type === 'check' || q.type === 'info') return false;
    return true;
}

/** Check if a screener's gate is open based on stored responses */
export function isScreenerGateOpen(screener: ScreenerConfig, responses: number[]): boolean {
    const gate = screener.gate;
    if (!gate) return true;
    const required = responses[gate.requiredIndex] === 1;
    const anyOf = gate.anyOfIndices.some(i => responses[i] === 1);
    return required && anyOf;
}

/** Max possible score (only scored questions) */
export function getScreenerMaxScore(screener: ScreenerConfig): number {
    return screener.questions.reduce((sum, q) => {
        if (!isQuestionScored(q)) return sum;
        const scale = q.scaleOptions ?? screener.scaleOptions;
        if (scale.length === 0) return sum;
        return sum + Math.max(...scale.map(o => o.value));
    }, 0);
}

/** Compute score from responses (only scored questions) */
export function getScreenerScore(screener: ScreenerConfig, responses: number[]): number {
    return screener.questions.reduce((sum, q, i) => {
        if (!isQuestionScored(q)) return sum;
        return sum + (responses[i] ?? 0);
    }, 0);
}

// Registry for looking up screener configs by ID (used by NoteCodec)
export const screenerRegistry: Record<string, ScreenerConfig> = {
    GAD7,
    PHQ2,
    PHQ9,
    MACE2,
};
