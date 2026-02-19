// Data/PhysicalExamData.ts
// Category-specific Physical Exam definitions for all 13 MEDCOM categories.

export type CategoryLetter = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M';

export interface PEItem {
    key: string;
    label: string;
}

export interface PECategoryDef {
    category: CategoryLetter;
    label: string;
    items: PEItem[];
}

export interface VitalSignDef {
    key: string;
    label: string;
    shortLabel: string;
    unit: string;
    placeholder: string;
}

export const VITAL_SIGNS: VitalSignDef[] = [
    { key: 'hr', label: 'Heart Rate', shortLabel: 'HR', unit: 'bpm', placeholder: '60-100' },
    { key: 'rr', label: 'Respirations', shortLabel: 'RR', unit: '/min', placeholder: '12-20' },
    { key: 'bpSys', label: 'BP (Systolic)', shortLabel: 'BPs', unit: 'mmHg', placeholder: '120' },
    { key: 'bpDia', label: 'BP (Diastolic)', shortLabel: 'BPd', unit: 'mmHg', placeholder: '80' },
    { key: 'temp', label: 'Temperature', shortLabel: 'Temp', unit: '°F', placeholder: '98.6' },
    { key: 'ht', label: 'Height', shortLabel: 'Ht', unit: 'in', placeholder: "68" },
    { key: 'wt', label: 'Weight', shortLabel: 'Wt', unit: 'lbs', placeholder: '170' },
];

export type Laterality = 'left' | 'right' | 'bilateral';

// ── Category PE definitions ────────────────────────────────────

const PE_CATEGORIES: Record<CategoryLetter, PECategoryDef> = {
    A: {
        category: 'A',
        label: 'HEENT',
        items: [
            { key: 'ears', label: 'Ears' },
            { key: 'nose', label: 'Nose' },
            { key: 'throat', label: 'Throat' },
            { key: 'oralCavity', label: 'Oral Cavity' },
            { key: 'neck', label: 'Neck' },
        ],
    },
    B: {
        category: 'B',
        label: 'Musculoskeletal',
        items: [
            { key: 'inspection', label: 'Inspection' },
            { key: 'palpation', label: 'Palpation' },
            { key: 'rom', label: 'Range of Motion' },
            { key: 'strength', label: 'Strength' },
            { key: 'specialTests', label: 'Special Tests' },
        ],
    },
    C: {
        category: 'C',
        label: 'Gastrointestinal',
        items: [
            { key: 'inspection', label: 'Inspection' },
            { key: 'auscultation', label: 'Auscultation' },
            { key: 'palpation', label: 'Palpation' },
            { key: 'percussion', label: 'Percussion' },
            { key: 'rectal', label: 'Rectal (if applicable)' },
        ],
    },
    D: {
        category: 'D',
        label: 'Cardiorespiratory',
        items: [
            { key: 'heartSounds', label: 'Heart Sounds' },
            { key: 'lungSounds', label: 'Lung Sounds' },
            { key: 'respEffort', label: 'Respiratory Effort' },
            { key: 'chestWall', label: 'Chest Wall' },
            { key: 'peripheralPulses', label: 'Peripheral Pulses' },
        ],
    },
    E: {
        category: 'E',
        label: 'Genitourinary',
        items: [
            { key: 'abdomen', label: 'Abdomen' },
            { key: 'cva', label: 'Costovertebral Angle' },
            { key: 'extGenitalia', label: 'External Genitalia' },
            { key: 'inguinal', label: 'Inguinal Region' },
        ],
    },
    F: {
        category: 'F',
        label: 'Neuropsychiatric',
        items: [
            { key: 'mentalStatus', label: 'Mental Status' },
            { key: 'cranialNerves', label: 'Cranial Nerves' },
            { key: 'motor', label: 'Motor' },
            { key: 'sensory', label: 'Sensory' },
            { key: 'reflexes', label: 'Reflexes' },
            { key: 'coordination', label: 'Coordination' },
        ],
    },
    G: {
        category: 'G',
        label: 'Constitutional',
        items: [
            { key: 'generalAppearance', label: 'General Appearance' },
            { key: 'skinColorTemp', label: 'Skin Color/Temperature' },
        ],
    },
    H: {
        category: 'H',
        label: 'Eye',
        items: [
            { key: 'visualAcuity', label: 'Visual Acuity' },
            { key: 'pupils', label: 'Pupils' },
            { key: 'eom', label: 'Extraocular Movements' },
            { key: 'conjunctivaSclera', label: 'Conjunctiva/Sclera' },
            { key: 'fundoscopy', label: 'Fundoscopy' },
            { key: 'eyelids', label: 'Eyelids' },
        ],
    },
    I: {
        category: 'I',
        label: 'Gynecological',
        items: [
            { key: 'breast', label: 'Breast' },
            { key: 'extGenitalia', label: 'External Genitalia' },
            { key: 'vaginalCervical', label: 'Vaginal/Cervical' },
            { key: 'uterusAdnexa', label: 'Uterus/Adnexa' },
        ],
    },
    J: {
        category: 'J',
        label: 'Dermatological',
        items: [
            { key: 'locationDistribution', label: 'Location/Distribution' },
            { key: 'morphology', label: 'Morphology' },
            { key: 'color', label: 'Color' },
            { key: 'sizeShape', label: 'Size/Shape' },
            { key: 'textureSurface', label: 'Texture/Surface' },
        ],
    },
    K: {
        category: 'K',
        label: 'Environmental',
        items: [
            { key: 'skinAssessment', label: 'Skin Assessment' },
            { key: 'circulation', label: 'Circulation' },
            { key: 'sensation', label: 'Sensation' },
            { key: 'temperature', label: 'Temperature' },
            { key: 'mentalStatus', label: 'Mental Status' },
        ],
    },
    L: {
        category: 'L',
        label: 'Miscellaneous',
        items: [
            { key: 'generalAppearance', label: 'General Appearance' },
            { key: 'oralDental', label: 'Oral/Dental' },
            { key: 'lymphNodes', label: 'Lymph Nodes' },
        ],
    },
    M: {
        category: 'M',
        label: 'Misc Return',
        items: [
            { key: 'generalAppearance', label: 'General Appearance' },
            { key: 'relevantSystem', label: 'Relevant System' },
            { key: 'comparisonToPrevious', label: 'Comparison to Previous' },
        ],
    },
};

// ── MSK body part mapping (B-1 through B-11) ──────────────────

const MSK_BODY_PARTS: Record<string, string> = {
    'B-1': 'Back',
    'B-2': 'Neck',
    'B-3': 'Shoulder',
    'B-4': 'Elbow',
    'B-5': 'Wrist',
    'B-6': 'Hand',
    'B-7': 'Hip',
    'B-8': 'Knee',
    'B-9': 'Ankle',
    'B-10': 'Foot',
    'B-11': 'Extremity',
};

// ── Helper functions ───────────────────────────────────────────

export function getCategoryFromSymptomCode(code: string): CategoryLetter | null {
    const match = code.match(/^([A-M])-/);
    return match ? (match[1] as CategoryLetter) : null;
}

export function getMSKBodyPart(code: string): { code: string; label: string } | null {
    const label = MSK_BODY_PARTS[code];
    return label ? { code, label } : null;
}

export function getPECategory(letter: CategoryLetter): PECategoryDef {
    return PE_CATEGORIES[letter];
}

export { PE_CATEGORIES };
