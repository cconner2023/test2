// Data/PhysicalExamData.ts
// Category-specific Physical Exam definitions for all 13 MEDCOM categories.

export type CategoryLetter = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M';

export interface AbnormalOption {
    key: string;
    label: string;
}

export interface PEItem {
    key: string;
    label: string;
    normalText?: string;
    abnormalOptions?: AbnormalOption[];
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

export type SpineRegion = 'cervical' | 'thoracic' | 'lumbar' | 'sacral';

export function isBackPainCode(code: string): boolean {
    return code === 'B-1';
}

// ── Category PE definitions ────────────────────────────────────

const PE_CATEGORIES: Record<CategoryLetter, PECategoryDef> = {
    A: {
        category: 'A',
        label: 'HEENT',
        items: [
            {
                key: 'ears', label: 'Ears',
                normalText: 'TMs intact bilaterally, pearly gray. Canals clear. No erythema or effusion.',
                abnormalOptions: [
                    { key: 'tmErythema', label: 'TM erythema' },
                    { key: 'tmBulging', label: 'TM bulging' },
                    { key: 'tmPerforation', label: 'TM perforation' },
                    { key: 'canalEdema', label: 'Canal edema' },
                    { key: 'cerumenImpaction', label: 'Cerumen impaction' },
                    { key: 'effusion', label: 'Effusion' },
                ],
            },
            {
                key: 'nose', label: 'Nose',
                normalText: 'Nares patent bilaterally. Septum midline. Mucosa pink and moist. No discharge.',
                abnormalOptions: [
                    { key: 'septalDeviation', label: 'Septal deviation' },
                    { key: 'mucosalErythema', label: 'Mucosal erythema' },
                    { key: 'purulentDischarge', label: 'Purulent discharge' },
                    { key: 'epistaxis', label: 'Epistaxis' },
                    { key: 'turbinateHypertrophy', label: 'Turbinate hypertrophy' },
                ],
            },
            {
                key: 'throat', label: 'Throat',
                normalText: 'Pharynx non-erythematous. Tonsils non-enlarged. Uvula midline.',
                abnormalOptions: [
                    { key: 'pharyngealErythema', label: 'Pharyngeal erythema' },
                    { key: 'tonsillarHypertrophy', label: 'Tonsillar hypertrophy' },
                    { key: 'exudate', label: 'Exudate' },
                    { key: 'uvularDeviation', label: 'Uvular deviation' },
                    { key: 'peritonsillarSwelling', label: 'Peritonsillar swelling' },
                ],
            },
            {
                key: 'oralCavity', label: 'Oral Cavity',
                normalText: 'Oral mucosa pink and moist. Dentition intact. No lesions.',
                abnormalOptions: [
                    { key: 'oralLesion', label: 'Oral lesion/ulcer' },
                    { key: 'poorDentition', label: 'Poor dentition' },
                    { key: 'gingivalErythema', label: 'Gingival erythema' },
                    { key: 'thrush', label: 'Thrush' },
                    { key: 'dryMucous', label: 'Dry mucous membranes' },
                ],
            },
            {
                key: 'neck', label: 'Neck',
                normalText: 'Neck supple. Trachea midline. No lymphadenopathy. Thyroid non-enlarged.',
                abnormalOptions: [
                    { key: 'lymphadenopathy', label: 'Lymphadenopathy' },
                    { key: 'limitedROM', label: 'Limited ROM' },
                    { key: 'thyromegaly', label: 'Thyromegaly' },
                    { key: 'meningismus', label: 'Meningismus' },
                    { key: 'jvd', label: 'JVD' },
                    { key: 'trachealDeviation', label: 'Tracheal deviation' },
                ],
            },
            {
                key: 'cv', label: 'CV',
                normalText: 'RRR. No murmurs, gallops, or rubs. Peripheral pulses 2+ bilaterally.',
                abnormalOptions: [
                    { key: 'murmur', label: 'Murmur' },
                    { key: 'gallop', label: 'Gallop (S3/S4)' },
                    { key: 'irregularRhythm', label: 'Irregular rhythm' },
                    { key: 'tachycardia', label: 'Tachycardia' },
                    { key: 'bradycardia', label: 'Bradycardia' },
                    { key: 'diminishedPulses', label: 'Diminished pulses' },
                ],
            },
            {
                key: 'pulm', label: 'PULM',
                normalText: 'Clear to auscultation bilaterally. No wheezes, rales, or rhonchi. Unlabored respirations.',
                abnormalOptions: [
                    { key: 'wheezing', label: 'Wheezing' },
                    { key: 'ralesCrackles', label: 'Rales/crackles' },
                    { key: 'rhonchi', label: 'Rhonchi' },
                    { key: 'diminishedBS', label: 'Diminished breath sounds' },
                    { key: 'stridor', label: 'Stridor' },
                    { key: 'tachypnea', label: 'Tachypnea' },
                ],
            },
        ],
    },
    B: {
        category: 'B',
        label: 'Musculoskeletal',
        items: [
            {
                key: 'inspection', label: 'Inspection',
                normalText: 'No swelling, erythema, ecchymosis, or deformity.',
                abnormalOptions: [
                    { key: 'swelling', label: 'Swelling' },
                    { key: 'erythema', label: 'Erythema' },
                    { key: 'ecchymosis', label: 'Ecchymosis' },
                    { key: 'deformity', label: 'Deformity' },
                    { key: 'atrophy', label: 'Atrophy' },
                    { key: 'asymmetry', label: 'Asymmetry' },
                ],
            },
            {
                key: 'palpation', label: 'Palpation',
                normalText: 'Non-tender. No crepitus or masses.',
                abnormalOptions: [
                    { key: 'pointTenderness', label: 'Point tenderness' },
                    { key: 'crepitus', label: 'Crepitus' },
                    { key: 'massSwelling', label: 'Mass/swelling' },
                    { key: 'warmth', label: 'Warmth' },
                    { key: 'muscleSpasm', label: 'Muscle spasm' },
                ],
            },
            {
                key: 'rom', label: 'Range of Motion',
                normalText: 'Full active and passive ROM without pain.',
                abnormalOptions: [
                    { key: 'decreasedActive', label: 'Decreased active ROM' },
                    { key: 'decreasedPassive', label: 'Decreased passive ROM' },
                    { key: 'painWithROM', label: 'Pain with ROM' },
                    { key: 'mechanicalBlock', label: 'Mechanical block' },
                ],
            },
            {
                key: 'strength', label: 'Strength',
                normalText: '5/5 strength. No weakness.',
                abnormalOptions: [
                    { key: 'decreasedStrength', label: 'Decreased strength' },
                    { key: 'giveWay', label: 'Give-way weakness' },
                    { key: 'painLimited', label: 'Pain-limited' },
                    { key: 'gripWeakness', label: 'Grip weakness' },
                ],
            },
            {
                key: 'specialTests', label: 'Special Tests',
                normalText: 'No positive provocative tests.',
                abnormalOptions: [
                    { key: 'positiveSpecial', label: 'Positive special test (specify)' },
                    { key: 'instability', label: 'Instability' },
                    { key: 'laxity', label: 'Laxity' },
                ],
            },
        ],
    },
    C: {
        category: 'C',
        label: 'Gastrointestinal',
        items: [
            {
                key: 'inspection', label: 'Inspection',
                normalText: 'Abdomen flat, no distension. No visible masses, scars, or hernias.',
                abnormalOptions: [
                    { key: 'distension', label: 'Distension' },
                    { key: 'visibleMass', label: 'Visible mass' },
                    { key: 'surgicalScars', label: 'Surgical scars' },
                    { key: 'hernia', label: 'Hernia' },
                    { key: 'ecchymosis', label: 'Ecchymosis' },
                ],
            },
            {
                key: 'auscultation', label: 'Auscultation',
                normalText: 'Bowel sounds present in all four quadrants. No bruits.',
                abnormalOptions: [
                    { key: 'hyperactiveBS', label: 'Hyperactive BS' },
                    { key: 'hypoactiveBS', label: 'Hypoactive BS' },
                    { key: 'absentBS', label: 'Absent BS' },
                    { key: 'bruit', label: 'Bruit' },
                ],
            },
            {
                key: 'palpation', label: 'Palpation',
                normalText: 'Soft, non-tender. No masses, guarding, or organomegaly.',
                abnormalOptions: [
                    { key: 'tenderness', label: 'Tenderness (specify quadrant)' },
                    { key: 'guarding', label: 'Guarding' },
                    { key: 'rebound', label: 'Rebound' },
                    { key: 'mass', label: 'Mass' },
                    { key: 'hepatomegaly', label: 'Hepatomegaly' },
                    { key: 'splenomegaly', label: 'Splenomegaly' },
                    { key: 'rigidity', label: 'Rigidity' },
                ],
            },
            {
                key: 'percussion', label: 'Percussion',
                normalText: 'Tympanic throughout. No CVA tenderness.',
                abnormalOptions: [
                    { key: 'dullness', label: 'Dullness' },
                    { key: 'shiftingDullness', label: 'Shifting dullness' },
                    { key: 'cvaTenderness', label: 'CVA tenderness' },
                    { key: 'tympanyOverMass', label: 'Tympany over mass' },
                ],
            },
            {
                key: 'rectal', label: 'Rectal',
                normalText: 'Deferred — not indicated.',
                abnormalOptions: [
                    { key: 'hemorrhoids', label: 'Hemorrhoids' },
                    { key: 'fissure', label: 'Fissure' },
                    { key: 'mass', label: 'Mass' },
                    { key: 'occultBlood', label: 'Occult blood positive' },
                    { key: 'tenderness', label: 'Tenderness' },
                    { key: 'rectalTone', label: 'Rectal tone abnormal' },
                ],
            },
        ],
    },
    D: {
        category: 'D',
        label: 'Cardiorespiratory',
        items: [
            {
                key: 'heartSounds', label: 'Heart Sounds',
                normalText: 'RRR. S1/S2 normal. No murmurs, gallops, or rubs.',
                abnormalOptions: [
                    { key: 'murmur', label: 'Murmur (specify)' },
                    { key: 'gallop', label: 'Gallop (S3/S4)' },
                    { key: 'rub', label: 'Rub' },
                    { key: 'irregularRhythm', label: 'Irregular rhythm' },
                    { key: 'tachycardia', label: 'Tachycardia' },
                    { key: 'bradycardia', label: 'Bradycardia' },
                ],
            },
            {
                key: 'lungSounds', label: 'Lung Sounds',
                normalText: 'Clear to auscultation bilaterally. No wheezes, rales, or rhonchi.',
                abnormalOptions: [
                    { key: 'wheezing', label: 'Wheezing' },
                    { key: 'ralesCrackles', label: 'Rales/crackles' },
                    { key: 'rhonchi', label: 'Rhonchi' },
                    { key: 'diminishedBS', label: 'Diminished breath sounds' },
                    { key: 'stridor', label: 'Stridor' },
                    { key: 'pleuralRub', label: 'Pleural rub' },
                ],
            },
            {
                key: 'respEffort', label: 'Respiratory Effort',
                normalText: 'Unlabored. No accessory muscle use. Speaking full sentences.',
                abnormalOptions: [
                    { key: 'tachypnea', label: 'Tachypnea' },
                    { key: 'accessoryMuscle', label: 'Accessory muscle use' },
                    { key: 'tripoding', label: 'Tripoding' },
                    { key: 'nasalFlaring', label: 'Nasal flaring' },
                    { key: 'retractions', label: 'Retractions' },
                    { key: 'speaksFragments', label: 'Speaks in fragments' },
                ],
            },
            {
                key: 'chestWall', label: 'Chest Wall',
                normalText: 'Symmetric rise and fall. Non-tender. No crepitus.',
                abnormalOptions: [
                    { key: 'asymmetricExpansion', label: 'Asymmetric expansion' },
                    { key: 'tenderness', label: 'Tenderness' },
                    { key: 'crepitus', label: 'Crepitus' },
                    { key: 'chestWallDeformity', label: 'Chest wall deformity' },
                    { key: 'surgicalEmphysema', label: 'Surgical emphysema' },
                ],
            },
            {
                key: 'peripheralPulses', label: 'Peripheral Pulses',
                normalText: 'Pulses 2+ and equal bilaterally. Capillary refill < 3 sec. No edema.',
                abnormalOptions: [
                    { key: 'diminishedPulses', label: 'Diminished pulses' },
                    { key: 'absentPulses', label: 'Absent pulses' },
                    { key: 'delayedCapRefill', label: 'Delayed cap refill' },
                    { key: 'peripheralEdema', label: 'Peripheral edema' },
                    { key: 'coolExtremities', label: 'Cool extremities' },
                    { key: 'cyanosis', label: 'Cyanosis' },
                ],
            },
        ],
    },
    E: {
        category: 'E',
        label: 'Genitourinary',
        items: [
            {
                key: 'abdomen', label: 'Abdomen',
                normalText: 'Soft, non-tender. No suprapubic tenderness.',
                abnormalOptions: [
                    { key: 'suprapubicTenderness', label: 'Suprapubic tenderness' },
                    { key: 'distension', label: 'Distension' },
                    { key: 'mass', label: 'Mass' },
                    { key: 'guarding', label: 'Guarding' },
                ],
            },
            {
                key: 'cva', label: 'Costovertebral Angle',
                normalText: 'No CVA tenderness bilaterally.',
                abnormalOptions: [
                    { key: 'cvaTendernessL', label: 'CVA tenderness (L)' },
                    { key: 'cvaTendernessR', label: 'CVA tenderness (R)' },
                    { key: 'cvaTendernessBL', label: 'CVA tenderness (BL)' },
                ],
            },
            {
                key: 'extGenitalia', label: 'External Genitalia',
                normalText: 'Normal appearance. No lesions, discharge, or swelling.',
                abnormalOptions: [
                    { key: 'lesionUlcer', label: 'Lesion/ulcer' },
                    { key: 'discharge', label: 'Discharge' },
                    { key: 'swelling', label: 'Swelling' },
                    { key: 'erythema', label: 'Erythema' },
                    { key: 'hernia', label: 'Hernia' },
                ],
            },
            {
                key: 'inguinal', label: 'Inguinal Region',
                normalText: 'No inguinal lymphadenopathy or hernia.',
                abnormalOptions: [
                    { key: 'lymphadenopathy', label: 'Lymphadenopathy' },
                    { key: 'inguinalHernia', label: 'Inguinal hernia' },
                    { key: 'tenderness', label: 'Tenderness' },
                ],
            },
        ],
    },
    F: {
        category: 'F',
        label: 'Neuropsychiatric',
        items: [
            {
                key: 'mentalStatus', label: 'Mental Status',
                normalText: 'Alert and oriented x4. Mood and affect appropriate. Judgment and insight intact.',
                abnormalOptions: [
                    { key: 'disoriented', label: 'Disoriented (specify)' },
                    { key: 'flatAffect', label: 'Flat affect' },
                    { key: 'labileAffect', label: 'Labile affect' },
                    { key: 'depressedMood', label: 'Depressed mood' },
                    { key: 'anxious', label: 'Anxious' },
                    { key: 'poorInsight', label: 'Poor insight' },
                    { key: 'poorJudgment', label: 'Poor judgment' },
                    { key: 'siHi', label: 'SI/HI (specify)' },
                ],
            },
            {
                key: 'cranialNerves', label: 'Cranial Nerves',
                normalText: 'CN II-XII grossly intact.',
                abnormalOptions: [
                    { key: 'cnDeficit', label: 'CN deficit (specify)' },
                    { key: 'facialAsymmetry', label: 'Facial asymmetry' },
                    { key: 'visualFieldDeficit', label: 'Visual field deficit' },
                    { key: 'hearingDeficit', label: 'Hearing deficit' },
                    { key: 'tongueDeviation', label: 'Tongue deviation' },
                ],
            },
            {
                key: 'motor', label: 'Motor',
                normalText: '5/5 strength in all extremities. Normal tone and bulk.',
                abnormalOptions: [
                    { key: 'focalWeakness', label: 'Focal weakness (specify)' },
                    { key: 'increasedTone', label: 'Increased tone' },
                    { key: 'decreasedTone', label: 'Decreased tone' },
                    { key: 'atrophy', label: 'Atrophy' },
                    { key: 'fasciculations', label: 'Fasciculations' },
                    { key: 'tremor', label: 'Tremor' },
                ],
            },
            {
                key: 'sensory', label: 'Sensory',
                normalText: 'Intact to light touch in all dermatomes.',
                abnormalOptions: [
                    { key: 'decreasedSensation', label: 'Decreased sensation (specify)' },
                    { key: 'numbness', label: 'Numbness' },
                    { key: 'paresthesias', label: 'Paresthesias' },
                    { key: 'dermatomalLoss', label: 'Dermatomal loss' },
                ],
            },
            {
                key: 'reflexes', label: 'Reflexes',
                normalText: '2+ and symmetric throughout. Babinski downgoing bilaterally.',
                abnormalOptions: [
                    { key: 'hyperreflexia', label: 'Hyperreflexia' },
                    { key: 'hyporeflexia', label: 'Hyporeflexia' },
                    { key: 'areflexia', label: 'Areflexia' },
                    { key: 'asymmetricReflexes', label: 'Asymmetric reflexes' },
                    { key: 'babinskiUpgoing', label: 'Babinski upgoing' },
                    { key: 'clonus', label: 'Clonus' },
                ],
            },
            {
                key: 'coordination', label: 'Coordination',
                normalText: 'Finger-to-nose intact. Gait steady. Romberg negative.',
                abnormalOptions: [
                    { key: 'dysmetria', label: 'Dysmetria' },
                    { key: 'intentionTremor', label: 'Intention tremor' },
                    { key: 'ataxicGait', label: 'Ataxic gait' },
                    { key: 'rombergPositive', label: 'Romberg positive' },
                    { key: 'dysdiadochokinesia', label: 'Dysdiadochokinesia' },
                    { key: 'unsteadyGait', label: 'Unsteady gait' },
                ],
            },
        ],
    },
    G: {
        category: 'G',
        label: 'Constitutional',
        items: [
            {
                key: 'generalAppearance', label: 'General Appearance',
                normalText: 'Alert, oriented, no acute distress. Well-developed, well-nourished.',
                abnormalOptions: [
                    { key: 'appearsIll', label: 'Appears ill' },
                    { key: 'acuteDistress', label: 'Acute distress' },
                    { key: 'diaphoretic', label: 'Diaphoretic' },
                    { key: 'pallor', label: 'Pallor' },
                    { key: 'cachexia', label: 'Cachexia' },
                    { key: 'lethargic', label: 'Lethargic' },
                    { key: 'alteredMentalStatus', label: 'Altered mental status' },
                ],
            },
            {
                key: 'skinColorTemp', label: 'Skin Color/Temperature',
                normalText: 'Warm, dry, appropriate color. No cyanosis or pallor.',
                abnormalOptions: [
                    { key: 'diaphoretic', label: 'Diaphoretic' },
                    { key: 'coolClammy', label: 'Cool/clammy' },
                    { key: 'flushed', label: 'Flushed' },
                    { key: 'cyanosis', label: 'Cyanosis' },
                    { key: 'pallor', label: 'Pallor' },
                    { key: 'jaundice', label: 'Jaundice' },
                    { key: 'mottled', label: 'Mottled' },
                ],
            },
        ],
    },
    H: {
        category: 'H',
        label: 'Eye',
        items: [
            {
                key: 'visualAcuity', label: 'Visual Acuity',
                normalText: 'Visual acuity intact bilaterally.',
                abnormalOptions: [
                    { key: 'decreasedAcuityL', label: 'Decreased acuity (L)' },
                    { key: 'decreasedAcuityR', label: 'Decreased acuity (R)' },
                    { key: 'decreasedAcuityBL', label: 'Decreased acuity (BL)' },
                    { key: 'unableToAssess', label: 'Unable to assess' },
                ],
            },
            {
                key: 'pupils', label: 'Pupils',
                normalText: 'PERRLA. No afferent pupillary defect.',
                abnormalOptions: [
                    { key: 'anisocoria', label: 'Anisocoria' },
                    { key: 'fixedPupil', label: 'Fixed pupil' },
                    { key: 'dilatedPupil', label: 'Dilated pupil' },
                    { key: 'constrictedPupil', label: 'Constricted pupil' },
                    { key: 'apdPresent', label: 'APD present' },
                ],
            },
            {
                key: 'eom', label: 'Extraocular Movements',
                normalText: 'EOMI. No nystagmus or diplopia.',
                abnormalOptions: [
                    { key: 'restrictedEOM', label: 'Restricted EOM (specify)' },
                    { key: 'nystagmus', label: 'Nystagmus' },
                    { key: 'diplopia', label: 'Diplopia' },
                    { key: 'strabismus', label: 'Strabismus' },
                ],
            },
            {
                key: 'conjunctivaSclera', label: 'Conjunctiva/Sclera',
                normalText: 'Conjunctivae clear. Sclerae white. No injection or discharge.',
                abnormalOptions: [
                    { key: 'conjunctivalInjection', label: 'Conjunctival injection' },
                    { key: 'subconjunctivalHemorrhage', label: 'Subconjunctival hemorrhage' },
                    { key: 'discharge', label: 'Discharge' },
                    { key: 'chemosis', label: 'Chemosis' },
                    { key: 'icterus', label: 'Icterus' },
                    { key: 'pterygium', label: 'Pterygium' },
                ],
            },
            {
                key: 'fundoscopy', label: 'Fundoscopy',
                normalText: 'Discs sharp. No hemorrhages or exudates.',
                abnormalOptions: [
                    { key: 'discEdema', label: 'Disc edema' },
                    { key: 'hemorrhage', label: 'Hemorrhage' },
                    { key: 'exudate', label: 'Exudate' },
                    { key: 'avNicking', label: 'AV nicking' },
                    { key: 'unableToVisualize', label: 'Unable to visualize' },
                ],
            },
            {
                key: 'eyelids', label: 'Eyelids',
                normalText: 'Lids normal. No edema, ptosis, or lesion.',
                abnormalOptions: [
                    { key: 'lidEdema', label: 'Lid edema' },
                    { key: 'ptosis', label: 'Ptosis' },
                    { key: 'chalazion', label: 'Chalazion' },
                    { key: 'hordeolum', label: 'Hordeolum' },
                    { key: 'laceration', label: 'Laceration' },
                    { key: 'entropion', label: 'Entropion' },
                    { key: 'ectropion', label: 'Ectropion' },
                ],
            },
        ],
    },
    I: {
        category: 'I',
        label: 'Gynecological',
        items: [
            {
                key: 'breast', label: 'Breast',
                normalText: 'Symmetric. No masses, tenderness, or discharge. No axillary lymphadenopathy.',
                abnormalOptions: [
                    { key: 'mass', label: 'Mass' },
                    { key: 'tenderness', label: 'Tenderness' },
                    { key: 'discharge', label: 'Discharge' },
                    { key: 'skinChanges', label: 'Skin changes' },
                    { key: 'axillaryLAD', label: 'Axillary lymphadenopathy' },
                ],
            },
            {
                key: 'extGenitalia', label: 'External Genitalia',
                normalText: 'Normal appearance. No lesions, erythema, or discharge.',
                abnormalOptions: [
                    { key: 'lesionUlcer', label: 'Lesion/ulcer' },
                    { key: 'erythema', label: 'Erythema' },
                    { key: 'edema', label: 'Edema' },
                    { key: 'discharge', label: 'Discharge' },
                    { key: 'mass', label: 'Mass' },
                ],
            },
            {
                key: 'vaginalCervical', label: 'Vaginal/Cervical',
                normalText: 'Cervix appears normal. No cervical motion tenderness. No abnormal discharge.',
                abnormalOptions: [
                    { key: 'cervicalMotionTenderness', label: 'Cervical motion tenderness' },
                    { key: 'abnormalDischarge', label: 'Abnormal discharge' },
                    { key: 'cervicalLesion', label: 'Cervical lesion' },
                    { key: 'friableCervix', label: 'Friable cervix' },
                    { key: 'bleeding', label: 'Bleeding' },
                ],
            },
            {
                key: 'uterusAdnexa', label: 'Uterus/Adnexa',
                normalText: 'Non-tender. Normal size. No adnexal masses.',
                abnormalOptions: [
                    { key: 'uterineTenderness', label: 'Uterine tenderness' },
                    { key: 'enlargedUterus', label: 'Enlarged uterus' },
                    { key: 'adnexalMass', label: 'Adnexal mass' },
                    { key: 'adnexalTenderness', label: 'Adnexal tenderness' },
                ],
            },
        ],
    },
    J: {
        category: 'J',
        label: 'Dermatological',
        items: [
            {
                key: 'locationDistribution', label: 'Location/Distribution',
                normalText: 'Localized. Well-demarcated.',
                abnormalOptions: [
                    { key: 'diffuse', label: 'Diffuse/widespread' },
                    { key: 'bilateral', label: 'Bilateral' },
                    { key: 'dermatomal', label: 'Dermatomal' },
                    { key: 'sunExposed', label: 'Sun-exposed areas' },
                    { key: 'intertriginous', label: 'Intertriginous' },
                ],
            },
            {
                key: 'morphology', label: 'Morphology',
                abnormalOptions: [
                    { key: 'macule', label: 'Macule' },
                    { key: 'papule', label: 'Papule' },
                    { key: 'vesicle', label: 'Vesicle' },
                    { key: 'pustule', label: 'Pustule' },
                    { key: 'plaque', label: 'Plaque' },
                    { key: 'nodule', label: 'Nodule' },
                    { key: 'wheal', label: 'Wheal' },
                    { key: 'erosion', label: 'Erosion' },
                    { key: 'ulcer', label: 'Ulcer' },
                    { key: 'bulla', label: 'Bulla' },
                ],
            },
            {
                key: 'color', label: 'Color',
                abnormalOptions: [
                    { key: 'erythematous', label: 'Erythematous' },
                    { key: 'hyperpigmented', label: 'Hyperpigmented' },
                    { key: 'hypopigmented', label: 'Hypopigmented' },
                    { key: 'violaceous', label: 'Violaceous' },
                    { key: 'blanching', label: 'Blanching' },
                    { key: 'nonBlanching', label: 'Non-blanching' },
                ],
            },
            {
                key: 'sizeShape', label: 'Size/Shape',
                abnormalOptions: [
                    { key: 'lessThan1cm', label: '< 1 cm' },
                    { key: 'oneToFiveCm', label: '1-5 cm' },
                    { key: 'greaterThan5cm', label: '> 5 cm' },
                    { key: 'roundOval', label: 'Round/oval' },
                    { key: 'irregular', label: 'Irregular' },
                    { key: 'linear', label: 'Linear' },
                    { key: 'annular', label: 'Annular' },
                ],
            },
            {
                key: 'textureSurface', label: 'Texture/Surface',
                normalText: 'Smooth surface. No scaling.',
                abnormalOptions: [
                    { key: 'scaling', label: 'Scaling' },
                    { key: 'crusting', label: 'Crusting' },
                    { key: 'weeping', label: 'Weeping' },
                    { key: 'lichenified', label: 'Lichenified' },
                    { key: 'verrucous', label: 'Verrucous' },
                    { key: 'indurated', label: 'Indurated' },
                    { key: 'fluctuant', label: 'Fluctuant' },
                ],
            },
        ],
    },
    K: {
        category: 'K',
        label: 'Environmental',
        items: [
            {
                key: 'skinAssessment', label: 'Skin Assessment',
                normalText: 'Skin intact. No frostbite, burns, or erythema.',
                abnormalOptions: [
                    { key: 'erythema', label: 'Erythema' },
                    { key: 'blistering', label: 'Blistering' },
                    { key: 'eschar', label: 'Eschar' },
                    { key: 'frostnip', label: 'Frostnip' },
                    { key: 'frostbite', label: 'Frostbite (specify degree)' },
                    { key: 'burn', label: 'Burn (specify degree)' },
                    { key: 'maceration', label: 'Maceration' },
                ],
            },
            {
                key: 'circulation', label: 'Circulation',
                normalText: 'Pulses palpable. Capillary refill < 3 sec. No edema.',
                abnormalOptions: [
                    { key: 'diminishedPulses', label: 'Diminished pulses' },
                    { key: 'delayedCapRefill', label: 'Delayed cap refill' },
                    { key: 'edema', label: 'Edema' },
                    { key: 'coolExtremities', label: 'Cool extremities' },
                    { key: 'cyanosis', label: 'Cyanosis' },
                ],
            },
            {
                key: 'sensation', label: 'Sensation',
                normalText: 'Intact to light touch. No numbness or tingling.',
                abnormalOptions: [
                    { key: 'decreasedSensation', label: 'Decreased sensation' },
                    { key: 'numbness', label: 'Numbness' },
                    { key: 'tingling', label: 'Tingling' },
                    { key: 'hyperesthesia', label: 'Hyperesthesia' },
                ],
            },
            {
                key: 'temperature', label: 'Temperature',
                normalText: 'Afebrile. Skin warm to touch.',
                abnormalOptions: [
                    { key: 'hypothermic', label: 'Hypothermic' },
                    { key: 'hyperthermic', label: 'Hyperthermic' },
                    { key: 'coolSkin', label: 'Cool skin' },
                    { key: 'hotFlushed', label: 'Hot/flushed skin' },
                ],
            },
            {
                key: 'mentalStatus', label: 'Mental Status',
                normalText: 'Alert and oriented x4. GCS 15.',
                abnormalOptions: [
                    { key: 'confused', label: 'Confused' },
                    { key: 'lethargic', label: 'Lethargic' },
                    { key: 'combative', label: 'Combative' },
                    { key: 'gcsLow', label: 'GCS < 15 (specify)' },
                    { key: 'alteredMentalStatus', label: 'Altered mental status' },
                ],
            },
        ],
    },
    L: {
        category: 'L',
        label: 'Miscellaneous',
        items: [
            {
                key: 'generalAppearance', label: 'General Appearance',
                normalText: 'Alert, oriented, no acute distress.',
                abnormalOptions: [
                    { key: 'appearsIll', label: 'Appears ill' },
                    { key: 'acuteDistress', label: 'Acute distress' },
                    { key: 'lethargic', label: 'Lethargic' },
                    { key: 'diaphoretic', label: 'Diaphoretic' },
                ],
            },
            {
                key: 'oralDental', label: 'Oral/Dental',
                normalText: 'Oral mucosa intact. Dentition in fair condition.',
                abnormalOptions: [
                    { key: 'dentalCaries', label: 'Dental caries' },
                    { key: 'abscess', label: 'Abscess' },
                    { key: 'oralLesion', label: 'Oral lesion' },
                    { key: 'gingivalBleeding', label: 'Gingival bleeding' },
                    { key: 'looseTooth', label: 'Loose/fractured tooth' },
                    { key: 'trismus', label: 'Trismus' },
                ],
            },
            {
                key: 'lymphNodes', label: 'Lymph Nodes',
                normalText: 'No cervical, axillary, or inguinal lymphadenopathy.',
                abnormalOptions: [
                    { key: 'cervicalLAD', label: 'Cervical LAD' },
                    { key: 'axillaryLAD', label: 'Axillary LAD' },
                    { key: 'inguinalLAD', label: 'Inguinal LAD' },
                    { key: 'generalizedLAD', label: 'Generalized LAD' },
                    { key: 'tenderLAD', label: 'Tender LAD' },
                    { key: 'mattedNodes', label: 'Matted nodes' },
                ],
            },
        ],
    },
    M: {
        category: 'M',
        label: 'Misc Return',
        items: [
            {
                key: 'generalAppearance', label: 'General Appearance',
                normalText: 'Alert, oriented, no acute distress.',
                abnormalOptions: [
                    { key: 'appearsIll', label: 'Appears ill' },
                    { key: 'worsened', label: 'Worsened from prior' },
                    { key: 'noChange', label: 'No change from prior' },
                ],
            },
            {
                key: 'relevantSystem', label: 'Relevant System',
                normalText: 'See system-specific findings above.',
                abnormalOptions: [
                    { key: 'worsened', label: 'Worsened' },
                    { key: 'unchanged', label: 'Unchanged' },
                    { key: 'partiallyImproved', label: 'Partially improved' },
                    { key: 'newFinding', label: 'New finding (specify)' },
                ],
            },
            {
                key: 'comparisonToPrevious', label: 'Comparison to Previous',
                normalText: 'Improved from prior visit.',
                abnormalOptions: [
                    { key: 'worsened', label: 'Worsened' },
                    { key: 'unchanged', label: 'Unchanged' },
                    { key: 'partiallyImproved', label: 'Partially improved' },
                    { key: 'newComplaint', label: 'New complaint' },
                ],
            },
        ],
    },
};

// ── General Findings ───────────────────────────────────────────

export interface GeneralFinding {
    key: string;
    label: string;
    normalText: string;
    abnormalOptions: AbnormalOption[];
}

export const GENERAL_FINDINGS: Record<string, GeneralFinding> = {
    generalAppearance: {
        key: 'gf_appearance',
        label: 'General Appearance',
        normalText: 'Alert, oriented, no acute distress. Well-developed, well-nourished.',
        abnormalOptions: [
            { key: 'ill', label: 'Appears ill' },
            { key: 'distress', label: 'Acute distress' },
            { key: 'diaphoretic', label: 'Diaphoretic' },
            { key: 'pallor', label: 'Pallor' },
            { key: 'lethargic', label: 'Lethargic' },
        ],
    },
    skin: {
        key: 'gf_skin',
        label: 'Skin',
        normalText: 'Warm, dry, intact. No rashes, lesions, or petechiae.',
        abnormalOptions: [
            { key: 'diaphoretic', label: 'Diaphoretic' },
            { key: 'rash', label: 'Rash (specify)' },
            { key: 'pallor', label: 'Pallor' },
            { key: 'cyanosis', label: 'Cyanosis' },
            { key: 'jaundice', label: 'Jaundice' },
            { key: 'coolClammy', label: 'Cool/clammy' },
        ],
    },
    neuroBaseline: {
        key: 'gf_neuro',
        label: 'Neuro',
        normalText: 'Alert and oriented x4. GCS 15.',
        abnormalOptions: [
            { key: 'disoriented', label: 'Disoriented (specify)' },
            { key: 'confused', label: 'Confused' },
            { key: 'lethargic', label: 'Lethargic' },
            { key: 'gcsLow', label: 'GCS < 15 (specify)' },
            { key: 'focalDeficit', label: 'Focal deficit (specify)' },
        ],
    },
    psychiatric: {
        key: 'gf_psych',
        label: 'Psych',
        normalText: 'Appropriate mood and affect. No SI/HI.',
        abnormalOptions: [
            { key: 'depressed', label: 'Depressed mood' },
            { key: 'anxious', label: 'Anxious' },
            { key: 'flatAffect', label: 'Flat affect' },
            { key: 'agitated', label: 'Agitated' },
            { key: 'siHi', label: 'SI/HI (specify)' },
        ],
    },
    cardiovascular: {
        key: 'gf_cardio',
        label: 'Cardiovascular',
        normalText: 'RRR. No murmurs. Peripheral pulses 2+ bilaterally. No edema.',
        abnormalOptions: [
            { key: 'irregular', label: 'Irregular rhythm' },
            { key: 'murmur', label: 'Murmur' },
            { key: 'tachycardia', label: 'Tachycardia' },
            { key: 'edema', label: 'Peripheral edema' },
            { key: 'diminishedPulses', label: 'Diminished pulses' },
        ],
    },
    respiratory: {
        key: 'gf_resp',
        label: 'Respiratory',
        normalText: 'Unlabored. Lungs CTA bilaterally. No wheezes, rales, or rhonchi.',
        abnormalOptions: [
            { key: 'tachypnea', label: 'Tachypnea' },
            { key: 'wheezing', label: 'Wheezing' },
            { key: 'rales', label: 'Rales/crackles' },
            { key: 'diminished', label: 'Diminished breath sounds' },
            { key: 'accessory', label: 'Accessory muscle use' },
        ],
    },
    lymphatic: {
        key: 'gf_lymph',
        label: 'Lymphatic',
        normalText: 'No cervical, axillary, or inguinal lymphadenopathy.',
        abnormalOptions: [
            { key: 'cervicalLAD', label: 'Cervical LAD' },
            { key: 'axillaryLAD', label: 'Axillary LAD' },
            { key: 'inguinalLAD', label: 'Inguinal LAD' },
            { key: 'tenderLAD', label: 'Tender LAD' },
        ],
    },
    abdominal: {
        key: 'gf_abd',
        label: 'Abdomen',
        normalText: 'Soft, non-tender, non-distended. Bowel sounds present.',
        abnormalOptions: [
            { key: 'tenderness', label: 'Tenderness (specify)' },
            { key: 'distension', label: 'Distension' },
            { key: 'guarding', label: 'Guarding' },
            { key: 'rebound', label: 'Rebound' },
        ],
    },
};

export const GENERAL_FINDINGS_MAP: Record<CategoryLetter, string[]> = {
    A: ['generalAppearance', 'skin', 'neuroBaseline', 'lymphatic'],
    B: ['generalAppearance', 'skin', 'neuroBaseline'],
    C: ['generalAppearance', 'skin', 'neuroBaseline', 'cardiovascular'],
    D: ['generalAppearance', 'skin', 'neuroBaseline'],
    E: ['generalAppearance', 'skin', 'neuroBaseline', 'abdominal'],
    F: ['generalAppearance', 'skin', 'psychiatric'],
    G: ['generalAppearance', 'skin', 'neuroBaseline', 'cardiovascular', 'respiratory'],
    H: ['generalAppearance', 'neuroBaseline'],
    I: ['generalAppearance', 'skin', 'neuroBaseline', 'abdominal'],
    J: ['generalAppearance', 'neuroBaseline', 'lymphatic'],
    K: ['generalAppearance', 'neuroBaseline', 'cardiovascular'],
    L: ['generalAppearance', 'skin', 'neuroBaseline'],
    M: ['generalAppearance', 'neuroBaseline'],
};

// Legacy: returns old variable general findings per category (for v2 compact decoding)
export function getLegacyGeneralFindings(letter: CategoryLetter): GeneralFinding[] {
    const keys = GENERAL_FINDINGS_MAP[letter] || [];
    return keys.map(k => GENERAL_FINDINGS[k]).filter(Boolean);
}

// ── Standard Wrapper Items (surround category-specific items) ──
// These 5 items are the same for every category.
// Order: GEN, HEAD, [category items], DERM, NEURO, PSYCH

export const STANDARD_WRAPPERS: GeneralFinding[] = [
    {
        key: 'sw_gen',
        label: 'GEN',
        normalText: 'Alert, oriented, no acute distress. Well-developed, well-nourished.',
        abnormalOptions: [
            { key: 'ill', label: 'Appears ill' },
            { key: 'distress', label: 'Acute distress' },
            { key: 'diaphoretic', label: 'Diaphoretic' },
            { key: 'pallor', label: 'Pallor' },
            { key: 'lethargic', label: 'Lethargic' },
        ],
    },
    {
        key: 'sw_head',
        label: 'HEAD',
        normalText: 'Normocephalic, atraumatic.',
        abnormalOptions: [
            { key: 'trauma', label: 'Trauma/laceration' },
            { key: 'tenderness', label: 'Scalp tenderness' },
            { key: 'deformity', label: 'Deformity' },
            { key: 'swelling', label: 'Swelling' },
        ],
    },
    {
        key: 'sw_derm',
        label: 'DERM',
        normalText: 'Warm, dry, intact. No rashes, lesions, or petechiae.',
        abnormalOptions: [
            { key: 'rash', label: 'Rash (specify)' },
            { key: 'lesion', label: 'Lesion' },
            { key: 'pallor', label: 'Pallor' },
            { key: 'cyanosis', label: 'Cyanosis' },
            { key: 'jaundice', label: 'Jaundice' },
            { key: 'diaphoretic', label: 'Diaphoretic' },
        ],
    },
    {
        key: 'sw_neuro',
        label: 'NEURO',
        normalText: 'Alert and oriented x4. GCS 15. No focal deficits.',
        abnormalOptions: [
            { key: 'disoriented', label: 'Disoriented (specify)' },
            { key: 'confused', label: 'Confused' },
            { key: 'lethargic', label: 'Lethargic' },
            { key: 'gcsLow', label: 'GCS < 15 (specify)' },
            { key: 'focalDeficit', label: 'Focal deficit (specify)' },
        ],
    },
    {
        key: 'sw_psych',
        label: 'PSYCH',
        normalText: 'Appropriate mood and affect. No SI/HI.',
        abnormalOptions: [
            { key: 'depressed', label: 'Depressed mood' },
            { key: 'anxious', label: 'Anxious' },
            { key: 'flatAffect', label: 'Flat affect' },
            { key: 'agitated', label: 'Agitated' },
            { key: 'siHi', label: 'SI/HI (specify)' },
        ],
    },
];

// First WRAPPER_BEFORE_COUNT items go before category items, rest go after
export const WRAPPER_BEFORE_COUNT = 2;

export function getGeneralFindings(_letter: CategoryLetter): GeneralFinding[] {
    return STANDARD_WRAPPERS;
}

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

// ═══════════════════════════════════════════════════════════════════════════════
// ── V2 PE Block Library ────────────────────────────────────────────────────────
// All new exports below. Nothing above this line has been changed.
// ═══════════════════════════════════════════════════════════════════════════════

// ── A. New types ───────────────────────────────────────────────────────────────

export interface PEBlock {
    key: string;
    label: string;
    normalText?: string;
    abnormalOptions: AbnormalOption[];
}

export type PEDepthV2 = 'focused' | 'comprehensive' | 'custom';

// ── B. Baseline Wrapper Blocks ─────────────────────────────────────────────────

export const BASELINE_WRAPPERS: PEBlock[] = [
    {
        key: 'bl_gen',
        label: 'GEN',
        normalText: 'Appears stated age, well-developed, well-nourished, no acute distress.',
        abnormalOptions: [
            { key: 'appears_ill', label: 'Appears ill' },
            { key: 'acute_distress', label: 'Acute distress' },
            { key: 'mild_distress', label: 'Mild distress' },
            { key: 'moderate_distress', label: 'Moderate distress' },
            { key: 'diaphoretic', label: 'Diaphoretic' },
            { key: 'pallor', label: 'Pallor' },
            { key: 'cachexia', label: 'Cachexia' },
            { key: 'thin_appearing', label: 'Thin appearing' },
            { key: 'excess_abdom_adiposity', label: 'Excessive abdominal adiposity' },
            { key: 'lethargic', label: 'Lethargic' },
            { key: 'altered_mental_status', label: 'Altered mental status' },
        ],
    },
    {
        key: 'bl_eyes',
        label: 'EYES',
        normalText: 'PERRL, EOMI, VFFC. Conjunctivae clear, sclerae white.',
        abnormalOptions: [
            { key: 'anisocoria', label: 'Anisocoria' },
            { key: 'fixed_pupil', label: 'Fixed pupil' },
            { key: 'dilated_pupil', label: 'Dilated pupil' },
            { key: 'constricted_pupil', label: 'Constricted pupil' },
            { key: 'apd_present', label: 'APD present' },
            { key: 'restricted_eom', label: 'Restricted EOM' },
            { key: 'nystagmus', label: 'Nystagmus' },
            { key: 'diplopia', label: 'Diplopia' },
            { key: 'conjunctival_injection', label: 'Conjunctival injection' },
            { key: 'subconj_hemorrhage', label: 'Subconjunctival hemorrhage' },
            { key: 'discharge', label: 'Discharge' },
            { key: 'chemosis', label: 'Chemosis' },
            { key: 'icterus', label: 'Icterus' },
            { key: 'lid_edema', label: 'Lid edema' },
            { key: 'ptosis', label: 'Ptosis' },
        ],
    },
    {
        key: 'bl_hent',
        label: 'HENT',
        normalText: 'Normocephalic, atraumatic. TMs intact bilaterally. Nares patent. Oropharynx clear and moist, no erythema.',
        abnormalOptions: [
            { key: 'scalp_tenderness', label: 'Scalp tenderness' },
            { key: 'scalp_laceration', label: 'Scalp laceration' },
            { key: 'tm_erythema', label: 'TM erythema' },
            { key: 'tm_bulging', label: 'TM bulging' },
            { key: 'tm_perforation', label: 'TM perforation' },
            { key: 'canal_edema', label: 'Canal edema' },
            { key: 'cerumen_impaction', label: 'Cerumen impaction' },
            { key: 'effusion', label: 'Effusion' },
            { key: 'septal_deviation', label: 'Septal deviation' },
            { key: 'mucosal_erythema', label: 'Mucosal erythema' },
            { key: 'nasal_discharge', label: 'Nasal discharge' },
            { key: 'turbinate_hypertrophy', label: 'Turbinate hypertrophy' },
            { key: 'pharyngeal_erythema', label: 'Pharyngeal erythema' },
            { key: 'tonsillar_hypertrophy', label: 'Tonsillar hypertrophy' },
            { key: 'exudate', label: 'Exudate' },
            { key: 'peritonsillar_swelling', label: 'Peritonsillar swelling' },
            { key: 'oral_lesion_ulcer', label: 'Oral lesion/ulcer' },
            { key: 'dry_mucous_membranes', label: 'Dry mucous membranes' },
            { key: 'trismus', label: 'Trismus' },
        ],
    },
    {
        key: 'bl_neuro',
        label: 'NEURO',
        normalText: 'A&Ox4, CN II-XII grossly intact, no focal deficits.',
        abnormalOptions: [
            { key: 'disoriented', label: 'Disoriented (specify)' },
            { key: 'confused', label: 'Confused' },
            { key: 'lethargic', label: 'Lethargic' },
            { key: 'gcs_lt_15', label: 'GCS < 15 (specify)' },
            { key: 'focal_deficit', label: 'Focal deficit (specify)' },
            { key: 'cn_deficit', label: 'CN deficit (specify)' },
            { key: 'facial_asymmetry', label: 'Facial asymmetry' },
            { key: 'tremor', label: 'Tremor' },
            { key: 'ataxic_gait', label: 'Ataxic gait' },
            { key: 'romberg_positive', label: 'Romberg positive' },
        ],
    },
    {
        key: 'bl_psych',
        label: 'PSYCH',
        normalText: 'Cooperative, appropriate mood and affect. No SI/HI.',
        abnormalOptions: [
            { key: 'depressed_mood', label: 'Depressed mood' },
            { key: 'anxious', label: 'Anxious' },
            { key: 'flat_affect', label: 'Flat affect' },
            { key: 'labile_affect', label: 'Labile affect' },
            { key: 'agitated', label: 'Agitated' },
            { key: 'poor_insight', label: 'Poor insight' },
            { key: 'poor_judgment', label: 'Poor judgment' },
            { key: 'sihi', label: 'SI/HI (specify)' },
        ],
    },
];

// ── C. Baseline Before Count ───────────────────────────────────────────────────
// GEN, EYES, HENT go before exam body; NEURO, PSYCH go after.

export const BASELINE_BEFORE_COUNT = 3;

// ── D. System Blocks ───────────────────────────────────────────────────────────

export const SYSTEM_BLOCKS: PEBlock[] = [
    {
        key: 'sys_ears',
        label: 'EARS',
        normalText: 'Normal-appearing pinna, nontender. Auricle and EAC normal without drainage or discharge. TM intact, landmarks not distorted, normal light reflex. TM not erythematous, TM mobile. No evidence of effusion.',
        abnormalOptions: [
            { key: 'tm_erythema', label: 'TM erythema' },
            { key: 'tm_bulging', label: 'TM bulging' },
            { key: 'tm_perforation', label: 'TM perforation' },
            { key: 'tm_immobile', label: 'TM immobile' },
            { key: 'canal_edema', label: 'Canal edema' },
            { key: 'cerumen_impaction', label: 'Cerumen impaction' },
            { key: 'effusion', label: 'Effusion' },
            { key: 'otorrhea', label: 'Otorrhea' },
            { key: 'pinna_tenderness', label: 'Pinna tenderness' },
            { key: 'tragal_tenderness', label: 'Tragal tenderness' },
            { key: 'eac_erythema', label: 'EAC erythema' },
        ],
    },
    {
        key: 'sys_nose',
        label: 'NOSE',
        normalText: 'No external deformities. No nasal discharge. Nasal septum midline. Mucosa pink, not erythematous. Turbinates not swollen. No sinus tenderness.',
        abnormalOptions: [
            { key: 'septal_deviation', label: 'Septal deviation' },
            { key: 'mucosal_erythema', label: 'Mucosal erythema' },
            { key: 'purulent_discharge', label: 'Purulent discharge' },
            { key: 'clear_rhinorrhea', label: 'Clear rhinorrhea' },
            { key: 'epistaxis', label: 'Epistaxis' },
            { key: 'turbinate_hypertrophy', label: 'Turbinate hypertrophy' },
            { key: 'frontal_sinus_tenderness', label: 'Frontal sinus tenderness' },
            { key: 'maxillary_sinus_tenderness', label: 'Maxillary sinus tenderness' },
            { key: 'nasal_polyp', label: 'Nasal polyp' },
        ],
    },
    {
        key: 'sys_oral',
        label: 'ORAL CAVITY',
        normalText: 'Mucosa moist and clear without masses, lesions, or ulceration. Dentition intact. Lips normal.',
        abnormalOptions: [
            { key: 'oral_lesion_ulcer', label: 'Oral lesion/ulcer' },
            { key: 'poor_dentition', label: 'Poor dentition' },
            { key: 'dental_caries', label: 'Dental caries' },
            { key: 'gingival_erythema', label: 'Gingival erythema' },
            { key: 'gingival_bleeding', label: 'Gingival bleeding' },
            { key: 'thrush', label: 'Thrush' },
            { key: 'dry_mucous_membranes', label: 'Dry mucous membranes' },
            { key: 'lip_lesion', label: 'Lip lesion' },
            { key: 'abscess', label: 'Abscess' },
        ],
    },
    {
        key: 'sys_pharynx',
        label: 'PHARYNX',
        normalText: 'No erythema, no PND, no drainage. Tonsils Grade 1, symmetric with midline uvula. No exudate noted.',
        abnormalOptions: [
            { key: 'pharyngeal_erythema', label: 'Pharyngeal erythema' },
            { key: 'pnd_present', label: 'PND present' },
            { key: 'tonsillar_hypertrophy_2', label: 'Tonsillar hypertrophy (Grade 2)' },
            { key: 'tonsillar_hypertrophy_3', label: 'Tonsillar hypertrophy (Grade 3)' },
            { key: 'tonsillar_hypertrophy_4', label: 'Tonsillar hypertrophy (Grade 4)' },
            { key: 'exudate', label: 'Exudate' },
            { key: 'peritonsillar_swelling', label: 'Peritonsillar swelling' },
            { key: 'uvular_deviation', label: 'Uvular deviation' },
            { key: 'cobblestoning', label: 'Cobblestoning' },
        ],
    },
    {
        key: 'sys_neck',
        label: 'NECK',
        normalText: 'Supple, non-tender. No lymphadenopathy. No carotid bruits. No JVD. Trachea midline. Thyroid non-enlarged.',
        abnormalOptions: [
            { key: 'ttp', label: 'TTP' },
            { key: 'anterior_cervical_lad', label: 'Anterior cervical LAD' },
            { key: 'posterior_cervical_lad', label: 'Posterior cervical LAD' },
            { key: 'preauricular_lad', label: 'Preauricular LAD' },
            { key: 'supraclavicular_lad', label: 'Supraclavicular LAD' },
            { key: 'carotid_bruit_r', label: 'Carotid bruit R' },
            { key: 'carotid_bruit_l', label: 'Carotid bruit L' },
            { key: 'carotid_bruit_bl', label: 'Carotid bruit b/l' },
            { key: 'jvd', label: 'JVD noted' },
            { key: 'limited_rom', label: 'Limited ROM' },
            { key: 'thyromegaly', label: 'Thyromegaly' },
            { key: 'meningismus', label: 'Meningismus' },
            { key: 'tracheal_deviation', label: 'Tracheal deviation' },
        ],
    },
    {
        key: 'sys_cv',
        label: 'CV',
        normalText: 'Normal rate, regular rhythm. No murmur, rub, or gallop. Peripheral pulses 2+ and equal bilaterally.',
        abnormalOptions: [
            { key: 'tachycardia', label: 'Tachycardia' },
            { key: 'bradycardia', label: 'Bradycardia' },
            { key: 'irregular_rhythm', label: 'Irregular rhythm' },
            { key: 'murmur', label: 'Murmur (specify)' },
            { key: 'rub', label: 'Rub' },
            { key: 'gallop_s3', label: 'Gallop (S3)' },
            { key: 'gallop_s4', label: 'Gallop (S4)' },
            { key: 'diminished_pulses', label: 'Diminished pulses' },
            { key: 'absent_pulses', label: 'Absent pulses' },
            { key: 'delayed_cap_refill', label: 'Delayed cap refill' },
            { key: 'peripheral_edema', label: 'Peripheral edema' },
            { key: 'cool_extremities', label: 'Cool extremities' },
            { key: 'cyanosis', label: 'Cyanosis' },
        ],
    },
    {
        key: 'sys_pulm',
        label: 'PULM',
        normalText: 'CTAB, non-labored respirations. No wheezes, rales, or rhonchi. No accessory muscle use.',
        abnormalOptions: [
            { key: 'wheezing', label: 'Wheezing' },
            { key: 'rales_crackles', label: 'Rales/crackles' },
            { key: 'rhonchi', label: 'Rhonchi' },
            { key: 'diminished_bs', label: 'Diminished breath sounds' },
            { key: 'stridor', label: 'Stridor' },
            { key: 'pleural_rub', label: 'Pleural rub' },
            { key: 'tachypnea', label: 'Tachypnea' },
            { key: 'accessory_muscle_use', label: 'Accessory muscle use' },
            { key: 'retractions', label: 'Retractions' },
            { key: 'nasal_flaring', label: 'Nasal flaring' },
            { key: 'tripoding', label: 'Tripoding' },
            { key: 'speaks_in_fragments', label: 'Speaks in fragments' },
        ],
    },
    {
        key: 'sys_abd',
        label: 'ABD',
        normalText: 'Soft, non-tender, non-distended. No mass visualized or palpated. No muscle guarding. Bowel sounds present x 4 quadrants. No hepatomegaly or splenomegaly.',
        abnormalOptions: [
            { key: 'ttp', label: 'TTP (specify location)' },
            { key: 'distended', label: 'Distended' },
            { key: 'muscle_guarding', label: 'Muscle guarding' },
            { key: 'rigidity', label: 'Rigidity' },
            { key: 'rebound_tenderness', label: 'Rebound tenderness' },
            { key: 'mass', label: 'Mass (specify)' },
            { key: 'hepatomegaly', label: 'Hepatomegaly' },
            { key: 'splenomegaly', label: 'Splenomegaly' },
            { key: 'hyperactive_bs', label: 'Hyperactive BS' },
            { key: 'hypoactive_bs', label: 'Hypoactive BS' },
            { key: 'absent_bs', label: 'Absent BS' },
            { key: 'mcburneys_point', label: "(+) McBurney's point" },
            { key: 'psoas_sign', label: '(+) Psoas sign' },
            { key: 'murphys_sign', label: "(+) Murphy's sign" },
            { key: 'obturator_sign', label: '(+) Obturator sign' },
            { key: 'rovsings_sign', label: "(+) Rovsing's sign" },
            { key: 'cva_tenderness_r', label: 'CVA tenderness R' },
            { key: 'cva_tenderness_l', label: 'CVA tenderness L' },
        ],
    },
    {
        key: 'sys_msk',
        label: 'MSK',
        normalText: 'Normal range of motion and strength. No tenderness, no swelling.',
        abnormalOptions: [
            { key: 'ttp', label: 'TTP (specify)' },
            { key: 'swelling', label: 'Swelling' },
            { key: 'deformity', label: 'Deformity' },
            { key: 'limited_rom', label: 'Limited ROM' },
            { key: 'decreased_strength', label: 'Decreased strength' },
            { key: 'crepitus', label: 'Crepitus' },
            { key: 'instability', label: 'Instability' },
            { key: 'atrophy', label: 'Atrophy' },
            { key: 'muscle_spasm', label: 'Muscle spasm' },
            { key: 'antalgic_gait', label: 'Antalgic gait' },
        ],
    },
    {
        key: 'sys_derm',
        label: 'DERM',
        normalText: 'Skin warm, dry, and appropriate color. No rashes or lesions.',
        abnormalOptions: [
            { key: 'rash', label: 'Rash (specify)' },
            { key: 'lesion', label: 'Lesion (specify)' },
            { key: 'ecchymosis', label: 'Ecchymosis' },
            { key: 'erythema', label: 'Erythema' },
            { key: 'pallor', label: 'Pallor' },
            { key: 'cyanosis', label: 'Cyanosis' },
            { key: 'jaundice', label: 'Jaundice' },
            { key: 'diaphoretic', label: 'Diaphoretic' },
            { key: 'petechiae', label: 'Petechiae' },
            { key: 'wound', label: 'Wound (specify)' },
            { key: 'abscess', label: 'Abscess' },
            { key: 'cellulitis', label: 'Cellulitis' },
        ],
    },
    {
        key: 'sys_extremities',
        label: 'EXTREMITIES',
        normalText: 'Pulses 2+ and equal. No edema, no discoloration. Cap refill < 3 sec.',
        abnormalOptions: [
            { key: 'edema', label: 'Edema (specify)' },
            { key: 'diminished_pulses', label: 'Diminished pulses' },
            { key: 'absent_pulses', label: 'Absent pulses' },
            { key: 'discoloration', label: 'Discoloration' },
            { key: 'delayed_cap_refill', label: 'Delayed cap refill' },
            { key: 'cool_extremities', label: 'Cool extremities' },
            { key: 'clubbing', label: 'Clubbing' },
            { key: 'cyanosis', label: 'Cyanosis' },
        ],
    },
    {
        key: 'sys_gu',
        label: 'GU',
        normalText: 'Normal appearance. No lesions, discharge, or swelling. No inguinal LAD or hernia.',
        abnormalOptions: [
            { key: 'lesion_ulcer', label: 'Lesion/ulcer' },
            { key: 'discharge', label: 'Discharge' },
            { key: 'swelling', label: 'Swelling' },
            { key: 'erythema', label: 'Erythema' },
            { key: 'inguinal_hernia', label: 'Inguinal hernia' },
            { key: 'inguinal_lad', label: 'Inguinal LAD' },
            { key: 'suprapubic_tenderness', label: 'Suprapubic tenderness' },
            { key: 'cva_tenderness_r', label: 'CVA tenderness R' },
            { key: 'cva_tenderness_l', label: 'CVA tenderness L' },
            { key: 'cva_tenderness_bl', label: 'CVA tenderness b/l' },
        ],
    },
    {
        key: 'sys_breast',
        label: 'BREAST',
        normalText: 'Symmetric. No masses, tenderness, or discharge. No axillary LAD.',
        abnormalOptions: [
            { key: 'mass', label: 'Mass' },
            { key: 'tenderness', label: 'Tenderness' },
            { key: 'discharge', label: 'Discharge' },
            { key: 'skin_changes', label: 'Skin changes' },
            { key: 'axillary_lad', label: 'Axillary LAD' },
            { key: 'asymmetry', label: 'Asymmetry' },
        ],
    },
    {
        key: 'sys_rectal',
        label: 'RECTAL',
        normalText: 'Deferred — not indicated.',
        abnormalOptions: [
            { key: 'hemorrhoids', label: 'Hemorrhoids' },
            { key: 'fissure', label: 'Fissure' },
            { key: 'mass', label: 'Mass' },
            { key: 'occult_blood_positive', label: 'Occult blood positive' },
            { key: 'tenderness', label: 'Tenderness' },
            { key: 'rectal_tone_abnormal', label: 'Rectal tone abnormal' },
        ],
    },
    {
        key: 'sys_lymph',
        label: 'LYMPH',
        normalText: 'No cervical, axillary, or inguinal lymphadenopathy.',
        abnormalOptions: [
            { key: 'cervical_lad', label: 'Cervical LAD' },
            { key: 'axillary_lad', label: 'Axillary LAD' },
            { key: 'inguinal_lad', label: 'Inguinal LAD' },
            { key: 'generalized_lad', label: 'Generalized LAD' },
            { key: 'tender_lad', label: 'Tender LAD' },
            { key: 'matted_nodes', label: 'Matted nodes' },
            { key: 'supraclavicular_lad', label: 'Supraclavicular LAD' },
        ],
    },
];

// ── E. Focused Category Blocks (A-M) ──────────────────────────────────────────

export const FOCUSED_CATEGORIES: Record<CategoryLetter, PEBlock[]> = {
    // Category A — HEENT
    A: [
        {
            key: 'cat_a_ears',
            label: 'EARS',
            normalText: 'TMs intact bilaterally, pearly gray. Canals clear. No erythema or effusion.',
            abnormalOptions: [
                { key: 'tm_erythema', label: 'TM erythema' },
                { key: 'tm_bulging', label: 'TM bulging' },
                { key: 'tm_perforation', label: 'TM perforation' },
                { key: 'tm_immobile', label: 'TM immobile' },
                { key: 'canal_edema', label: 'Canal edema' },
                { key: 'cerumen_impaction', label: 'Cerumen impaction' },
                { key: 'effusion', label: 'Effusion' },
                { key: 'otorrhea', label: 'Otorrhea' },
                { key: 'pinna_tenderness', label: 'Pinna tenderness' },
                { key: 'tragal_tenderness', label: 'Tragal tenderness' },
            ],
        },
        {
            key: 'cat_a_nose',
            label: 'NOSE',
            normalText: 'Nares patent bilaterally. Septum midline. Mucosa pink and moist. No discharge.',
            abnormalOptions: [
                { key: 'septal_deviation', label: 'Septal deviation' },
                { key: 'mucosal_erythema', label: 'Mucosal erythema' },
                { key: 'purulent_discharge', label: 'Purulent discharge' },
                { key: 'clear_rhinorrhea', label: 'Clear rhinorrhea' },
                { key: 'epistaxis', label: 'Epistaxis' },
                { key: 'turbinate_hypertrophy', label: 'Turbinate hypertrophy' },
                { key: 'sinus_tenderness', label: 'Sinus tenderness' },
            ],
        },
        {
            key: 'cat_a_throat',
            label: 'THROAT',
            normalText: 'Pharynx non-erythematous. Tonsils non-enlarged. Uvula midline.',
            abnormalOptions: [
                { key: 'pharyngeal_erythema', label: 'Pharyngeal erythema' },
                { key: 'tonsillar_hypertrophy', label: 'Tonsillar hypertrophy' },
                { key: 'exudate', label: 'Exudate' },
                { key: 'peritonsillar_swelling', label: 'Peritonsillar swelling' },
                { key: 'uvular_deviation', label: 'Uvular deviation' },
                { key: 'cobblestoning', label: 'Cobblestoning' },
            ],
        },
        {
            key: 'cat_a_oral',
            label: 'ORAL CAVITY',
            normalText: 'Oral mucosa pink and moist. Dentition intact. No lesions.',
            abnormalOptions: [
                { key: 'oral_lesion_ulcer', label: 'Oral lesion/ulcer' },
                { key: 'poor_dentition', label: 'Poor dentition' },
                { key: 'gingival_erythema', label: 'Gingival erythema' },
                { key: 'thrush', label: 'Thrush' },
                { key: 'dry_mucous_membranes', label: 'Dry mucous membranes' },
            ],
        },
        {
            key: 'cat_a_neck',
            label: 'NECK',
            normalText: 'Neck supple. Trachea midline. No LAD. Thyroid non-enlarged.',
            abnormalOptions: [
                { key: 'lad', label: 'LAD (specify)' },
                { key: 'limited_rom', label: 'Limited ROM' },
                { key: 'thyromegaly', label: 'Thyromegaly' },
                { key: 'meningismus', label: 'Meningismus' },
                { key: 'jvd', label: 'JVD' },
                { key: 'tracheal_deviation', label: 'Tracheal deviation' },
            ],
        },
        {
            key: 'cat_a_cv',
            label: 'CV',
            normalText: 'Regular rate and rhythm. No murmurs, gallops, or rubs. Peripheral pulses 2+ bilaterally.',
            abnormalOptions: [
                { key: 'murmur', label: 'Murmur' },
                { key: 'gallop', label: 'Gallop' },
                { key: 'irregular_rhythm', label: 'Irregular rhythm' },
                { key: 'tachycardia', label: 'Tachycardia' },
                { key: 'bradycardia', label: 'Bradycardia' },
                { key: 'diminished_pulses', label: 'Diminished pulses' },
            ],
        },
        {
            key: 'cat_a_pulm',
            label: 'PULM',
            normalText: 'CTA bilaterally. No wheezes, rales, or rhonchi. Unlabored respirations.',
            abnormalOptions: [
                { key: 'wheezing', label: 'Wheezing' },
                { key: 'rales_crackles', label: 'Rales/crackles' },
                { key: 'rhonchi', label: 'Rhonchi' },
                { key: 'diminished_bs', label: 'Diminished BS' },
                { key: 'stridor', label: 'Stridor' },
            ],
        },
    ],

    // Category B — Musculoskeletal
    B: [
        {
            key: 'cat_b_inspection',
            label: 'INSPECTION',
            normalText: 'No obvious deformity, swelling, erythema, or ecchymosis. Normal posture. Ambulates with normal gait. No asymmetry.',
            abnormalOptions: [
                { key: 'swelling', label: 'Swelling' },
                { key: 'erythema', label: 'Erythema' },
                { key: 'ecchymosis', label: 'Ecchymosis' },
                { key: 'deformity', label: 'Deformity' },
                { key: 'atrophy', label: 'Atrophy' },
                { key: 'asymmetry', label: 'Asymmetry' },
                { key: 'antalgic_gait', label: 'Antalgic gait' },
                { key: 'poor_posture', label: 'Poor/slumped posture' },
                { key: 'limb_ataxia', label: 'Limb ataxia' },
                { key: 'stepoff_deformity', label: 'Step-off deformity' },
                { key: 'edema', label: 'Edema' },
            ],
        },
        {
            key: 'cat_b_palpation',
            label: 'PALPATION',
            normalText: 'Non-tender. No crepitus, masses, or warmth. No muscle spasm.',
            abnormalOptions: [
                { key: 'point_tenderness', label: 'Point tenderness' },
                { key: 'crepitus', label: 'Crepitus' },
                { key: 'mass_swelling', label: 'Mass/swelling' },
                { key: 'warmth', label: 'Warmth' },
                { key: 'muscle_spasm', label: 'Muscle spasm' },
                { key: 'stepoff_deformity', label: 'Step-off deformity' },
                { key: 'effusion', label: 'Effusion' },
            ],
        },
        {
            key: 'cat_b_rom',
            label: 'ROM',
            normalText: 'Full active and passive ROM without pain. No discomfort with movement.',
            abnormalOptions: [
                { key: 'decreased_active_rom', label: 'Decreased active ROM' },
                { key: 'decreased_passive_rom', label: 'Decreased passive ROM' },
                { key: 'pain_with_rom', label: 'Pain with ROM' },
                { key: 'mechanical_block', label: 'Mechanical block' },
                { key: 'tight_hamstrings', label: 'Tight hamstrings b/l' },
            ],
        },
        {
            key: 'cat_b_strength',
            label: 'STRENGTH',
            normalText: '5/5 strength, equal bilaterally.',
            abnormalOptions: [
                { key: 'decreased_strength', label: 'Decreased strength (specify grade)' },
                { key: 'giveway_weakness', label: 'Give-way weakness' },
                { key: 'pain_limited', label: 'Pain-limited' },
                { key: 'grip_weakness', label: 'Grip weakness' },
            ],
        },
        {
            key: 'cat_b_special_tests',
            label: 'SPECIAL TESTS',
            normalText: 'No positive provocative tests.',
            abnormalOptions: [
                { key: 'slr', label: '(+) Straight leg raise' },
                { key: 'faber', label: '(+) FABER' },
                { key: 'fadir', label: '(+) FADIR' },
                { key: 'ober', label: '(+) Ober' },
                { key: 'piriformis', label: '(+) Piriformis test' },
                { key: 'lachman', label: '(+) Lachman' },
                { key: 'anterior_drawer', label: '(+) Anterior drawer' },
                { key: 'posterior_drawer', label: '(+) Posterior drawer' },
                { key: 'mcmurray', label: '(+) McMurray' },
                { key: 'valgus_stress', label: '(+) Valgus stress' },
                { key: 'varus_stress', label: '(+) Varus stress' },
                { key: 'tinel', label: '(+) Tinel' },
                { key: 'phalen', label: '(+) Phalen' },
                { key: 'finkelstein', label: '(+) Finkelstein' },
                { key: 'neer', label: '(+) Neer' },
                { key: 'hawkins', label: '(+) Hawkins' },
                { key: 'empty_can', label: '(+) Empty can' },
                { key: 'speed', label: '(+) Speed' },
                { key: 'apprehension', label: '(+) Apprehension' },
                { key: 'thompson', label: '(+) Thompson' },
                { key: 'talar_tilt', label: '(+) Talar tilt' },
                { key: 'instability', label: 'Instability' },
                { key: 'laxity', label: 'Laxity' },
            ],
        },
        {
            key: 'cat_b_neurovascular',
            label: 'NEUROVASCULAR',
            normalText: 'DTR normal at bilateral knees and ankles. Sensory intact to light touch. 2+ dorsalis pedis / PT pulse b/l.',
            abnormalOptions: [
                { key: 'hyperreflexia', label: 'Hyperreflexia' },
                { key: 'hyporeflexia', label: 'Hyporeflexia' },
                { key: 'areflexia', label: 'Areflexia' },
                { key: 'asymmetric_reflexes', label: 'Asymmetric reflexes' },
                { key: 'decreased_sensation', label: 'Decreased sensation' },
                { key: 'numbness', label: 'Numbness' },
                { key: 'paresthesias', label: 'Paresthesias' },
                { key: 'dermatomal_loss', label: 'Dermatomal loss' },
                { key: 'diminished_pulses', label: 'Diminished pulses' },
                { key: 'absent_pulses', label: 'Absent pulses' },
                { key: 'delayed_cap_refill', label: 'Delayed cap refill' },
            ],
        },
    ],

    // Category C — Gastrointestinal
    C: [
        {
            key: 'cat_c_inspection',
            label: 'INSPECTION',
            normalText: 'Abdomen flat, no distension. No visible masses, scars, or hernias.',
            abnormalOptions: [
                { key: 'distension', label: 'Distension' },
                { key: 'visible_mass', label: 'Visible mass' },
                { key: 'surgical_scars', label: 'Surgical scars' },
                { key: 'hernia', label: 'Hernia' },
                { key: 'ecchymosis', label: 'Ecchymosis' },
            ],
        },
        {
            key: 'cat_c_auscultation',
            label: 'AUSCULTATION',
            normalText: 'Bowel sounds present in all four quadrants. No bruits.',
            abnormalOptions: [
                { key: 'hyperactive_bs', label: 'Hyperactive BS' },
                { key: 'hypoactive_bs', label: 'Hypoactive BS' },
                { key: 'absent_bs', label: 'Absent BS' },
                { key: 'bruit', label: 'Bruit' },
            ],
        },
        {
            key: 'cat_c_palpation',
            label: 'PALPATION',
            normalText: 'Soft, non-tender. No masses, guarding, or organomegaly.',
            abnormalOptions: [
                { key: 'tenderness', label: 'Tenderness (specify quadrant)' },
                { key: 'guarding', label: 'Guarding' },
                { key: 'rebound', label: 'Rebound' },
                { key: 'mass', label: 'Mass' },
                { key: 'hepatomegaly', label: 'Hepatomegaly' },
                { key: 'splenomegaly', label: 'Splenomegaly' },
                { key: 'rigidity', label: 'Rigidity' },
            ],
        },
        {
            key: 'cat_c_percussion',
            label: 'PERCUSSION',
            normalText: 'Tympanic throughout. No CVA tenderness.',
            abnormalOptions: [
                { key: 'dullness', label: 'Dullness' },
                { key: 'shifting_dullness', label: 'Shifting dullness' },
                { key: 'cva_tenderness', label: 'CVA tenderness' },
                { key: 'tympany_over_mass', label: 'Tympany over mass' },
            ],
        },
        {
            key: 'cat_c_rectal',
            label: 'RECTAL',
            normalText: 'Deferred — not indicated.',
            abnormalOptions: [
                { key: 'hemorrhoids', label: 'Hemorrhoids' },
                { key: 'fissure', label: 'Fissure' },
                { key: 'mass', label: 'Mass' },
                { key: 'occult_blood_positive', label: 'Occult blood positive' },
                { key: 'tenderness', label: 'Tenderness' },
                { key: 'rectal_tone_abnormal', label: 'Rectal tone abnormal' },
            ],
        },
    ],

    // Category D — Cardiorespiratory
    D: [
        {
            key: 'cat_d_heart_sounds',
            label: 'HEART SOUNDS',
            normalText: 'Regular rate and rhythm. S1/S2 normal. No murmurs, gallops, or rubs.',
            abnormalOptions: [
                { key: 'murmur', label: 'Murmur (specify)' },
                { key: 'gallop_s3_s4', label: 'Gallop (S3/S4)' },
                { key: 'rub', label: 'Rub' },
                { key: 'irregular_rhythm', label: 'Irregular rhythm' },
                { key: 'tachycardia', label: 'Tachycardia' },
                { key: 'bradycardia', label: 'Bradycardia' },
            ],
        },
        {
            key: 'cat_d_lung_sounds',
            label: 'LUNG SOUNDS',
            normalText: 'CTA bilaterally. No wheezes, rales, or rhonchi.',
            abnormalOptions: [
                { key: 'wheezing', label: 'Wheezing' },
                { key: 'rales_crackles', label: 'Rales/crackles' },
                { key: 'rhonchi', label: 'Rhonchi' },
                { key: 'diminished_bs', label: 'Diminished BS' },
                { key: 'stridor', label: 'Stridor' },
                { key: 'pleural_rub', label: 'Pleural rub' },
            ],
        },
        {
            key: 'cat_d_respiratory_effort',
            label: 'RESPIRATORY EFFORT',
            normalText: 'Unlabored. No accessory muscle use. Speaking full sentences.',
            abnormalOptions: [
                { key: 'tachypnea', label: 'Tachypnea' },
                { key: 'accessory_muscle_use', label: 'Accessory muscle use' },
                { key: 'tripoding', label: 'Tripoding' },
                { key: 'nasal_flaring', label: 'Nasal flaring' },
                { key: 'retractions', label: 'Retractions' },
                { key: 'speaks_in_fragments', label: 'Speaks in fragments' },
            ],
        },
        {
            key: 'cat_d_chest_wall',
            label: 'CHEST WALL',
            normalText: 'Symmetric rise and fall. Non-tender. No crepitus.',
            abnormalOptions: [
                { key: 'asymmetric_expansion', label: 'Asymmetric expansion' },
                { key: 'tenderness', label: 'Tenderness' },
                { key: 'crepitus', label: 'Crepitus' },
                { key: 'chest_wall_deformity', label: 'Chest wall deformity' },
                { key: 'surgical_emphysema', label: 'Surgical emphysema' },
            ],
        },
        {
            key: 'cat_d_peripheral_pulses',
            label: 'PERIPHERAL PULSES',
            normalText: 'Pulses 2+ and equal bilaterally. Cap refill < 3 sec. No edema.',
            abnormalOptions: [
                { key: 'diminished_pulses', label: 'Diminished pulses' },
                { key: 'absent_pulses', label: 'Absent pulses' },
                { key: 'delayed_cap_refill', label: 'Delayed cap refill' },
                { key: 'peripheral_edema', label: 'Peripheral edema' },
                { key: 'cool_extremities', label: 'Cool extremities' },
                { key: 'cyanosis', label: 'Cyanosis' },
            ],
        },
    ],

    // Category E — Genitourinary
    E: [
        {
            key: 'cat_e_abdomen',
            label: 'ABDOMEN',
            normalText: 'Soft, non-tender. No suprapubic tenderness.',
            abnormalOptions: [
                { key: 'suprapubic_tenderness', label: 'Suprapubic tenderness' },
                { key: 'distension', label: 'Distension' },
                { key: 'mass', label: 'Mass' },
                { key: 'guarding', label: 'Guarding' },
            ],
        },
        {
            key: 'cat_e_cva',
            label: 'CVA',
            normalText: 'No CVA tenderness bilaterally.',
            abnormalOptions: [
                { key: 'cva_tenderness_l', label: 'CVA tenderness (L)' },
                { key: 'cva_tenderness_r', label: 'CVA tenderness (R)' },
                { key: 'cva_tenderness_bl', label: 'CVA tenderness (BL)' },
            ],
        },
        {
            key: 'cat_e_external_genitalia',
            label: 'EXTERNAL GENITALIA',
            normalText: 'MALE: circumcised, no lesions, discharge, or swelling. No urethral malformation. Nontender to palpation. Two testicles palpated in scrotum. Scrotum nontender. Normal Prehn\'s, normal cremasteric.',
            abnormalOptions: [
                { key: 'uncircumcised', label: 'Uncircumcised' },
                { key: 'lesion_ulcer', label: 'Lesion/ulcer' },
                { key: 'discharge', label: 'Discharge' },
                { key: 'swelling', label: 'Swelling' },
                { key: 'erythema', label: 'Erythema' },
                { key: 'urethral_malformation', label: 'Urethral malformation' },
            ],
        },
        {
            key: 'cat_e_inguinal',
            label: 'INGUINAL',
            normalText: 'No inguinal LAD or hernia.',
            abnormalOptions: [
                { key: 'lad', label: 'LAD' },
                { key: 'inguinal_hernia', label: 'Inguinal hernia' },
                { key: 'tenderness', label: 'Tenderness' },
            ],
        },
    ],

    // Category F — Neuropsychiatric
    F: [
        {
            key: 'cat_f_mental_status',
            label: 'MENTAL STATUS',
            normalText: 'Alert and oriented x4. Mood and affect appropriate. Judgment and insight intact.',
            abnormalOptions: [
                { key: 'disoriented', label: 'Disoriented (specify)' },
                { key: 'flat_affect', label: 'Flat affect' },
                { key: 'labile_affect', label: 'Labile affect' },
                { key: 'depressed_mood', label: 'Depressed mood' },
                { key: 'anxious', label: 'Anxious' },
                { key: 'poor_insight', label: 'Poor insight' },
                { key: 'poor_judgment', label: 'Poor judgment' },
                { key: 'sihi', label: 'SI/HI (specify)' },
            ],
        },
        {
            key: 'cat_f_cranial_nerves',
            label: 'CRANIAL NERVES',
            normalText: 'CN II-XII grossly intact.',
            abnormalOptions: [
                { key: 'cn_deficit', label: 'CN deficit (specify)' },
                { key: 'facial_asymmetry', label: 'Facial asymmetry' },
                { key: 'visual_field_deficit', label: 'Visual field deficit' },
                { key: 'hearing_deficit', label: 'Hearing deficit' },
                { key: 'tongue_deviation', label: 'Tongue deviation' },
            ],
        },
        {
            key: 'cat_f_motor',
            label: 'MOTOR',
            normalText: '5/5 strength in all extremities. Normal tone and bulk.',
            abnormalOptions: [
                { key: 'focal_weakness', label: 'Focal weakness (specify)' },
                { key: 'increased_tone', label: 'Increased tone' },
                { key: 'decreased_tone', label: 'Decreased tone' },
                { key: 'atrophy', label: 'Atrophy' },
                { key: 'fasciculations', label: 'Fasciculations' },
                { key: 'tremor', label: 'Tremor' },
            ],
        },
        {
            key: 'cat_f_sensory',
            label: 'SENSORY',
            normalText: 'Intact to light touch in all dermatomes.',
            abnormalOptions: [
                { key: 'decreased_sensation', label: 'Decreased sensation (specify)' },
                { key: 'numbness', label: 'Numbness' },
                { key: 'paresthesias', label: 'Paresthesias' },
                { key: 'dermatomal_loss', label: 'Dermatomal loss' },
            ],
        },
        {
            key: 'cat_f_reflexes',
            label: 'REFLEXES',
            normalText: '2+ and symmetric throughout. Babinski downgoing bilaterally.',
            abnormalOptions: [
                { key: 'hyperreflexia', label: 'Hyperreflexia' },
                { key: 'hyporeflexia', label: 'Hyporeflexia' },
                { key: 'areflexia', label: 'Areflexia' },
                { key: 'asymmetric_reflexes', label: 'Asymmetric reflexes' },
                { key: 'babinski_upgoing', label: 'Babinski upgoing' },
                { key: 'clonus', label: 'Clonus' },
            ],
        },
        {
            key: 'cat_f_coordination',
            label: 'COORDINATION',
            normalText: 'Finger-to-nose intact. Gait steady. Romberg negative.',
            abnormalOptions: [
                { key: 'dysmetria', label: 'Dysmetria' },
                { key: 'intention_tremor', label: 'Intention tremor' },
                { key: 'ataxic_gait', label: 'Ataxic gait' },
                { key: 'romberg_positive', label: 'Romberg positive' },
                { key: 'dysdiadochokinesia', label: 'Dysdiadochokinesia' },
                { key: 'unsteady_gait', label: 'Unsteady gait' },
            ],
        },
    ],

    // Category G — Constitutional
    G: [
        {
            key: 'cat_g_general_appearance',
            label: 'GENERAL APPEARANCE',
            normalText: 'Alert, oriented, no acute distress. Well-developed, well-nourished.',
            abnormalOptions: [
                { key: 'appears_ill', label: 'Appears ill' },
                { key: 'acute_distress', label: 'Acute distress' },
                { key: 'diaphoretic', label: 'Diaphoretic' },
                { key: 'pallor', label: 'Pallor' },
                { key: 'cachexia', label: 'Cachexia' },
                { key: 'lethargic', label: 'Lethargic' },
                { key: 'ams', label: 'AMS' },
            ],
        },
        {
            key: 'cat_g_skin_color_temp',
            label: 'SKIN COLOR/TEMP',
            normalText: 'Warm, dry, appropriate color. No cyanosis or pallor.',
            abnormalOptions: [
                { key: 'diaphoretic', label: 'Diaphoretic' },
                { key: 'cool_clammy', label: 'Cool/clammy' },
                { key: 'flushed', label: 'Flushed' },
                { key: 'cyanosis', label: 'Cyanosis' },
                { key: 'pallor', label: 'Pallor' },
                { key: 'jaundice', label: 'Jaundice' },
                { key: 'mottled', label: 'Mottled' },
            ],
        },
        {
            key: 'cat_g_cv',
            label: 'CV',
            normalText: 'RRR. No murmurs. Peripheral pulses 2+ bilaterally. No edema.',
            abnormalOptions: [
                { key: 'irregular_rhythm', label: 'Irregular rhythm' },
                { key: 'murmur', label: 'Murmur' },
                { key: 'tachycardia', label: 'Tachycardia' },
                { key: 'peripheral_edema', label: 'Peripheral edema' },
                { key: 'diminished_pulses', label: 'Diminished pulses' },
            ],
        },
        {
            key: 'cat_g_respiratory',
            label: 'RESPIRATORY',
            normalText: 'Unlabored. Lungs CTA bilaterally. No wheezes, rales, or rhonchi.',
            abnormalOptions: [
                { key: 'tachypnea', label: 'Tachypnea' },
                { key: 'wheezing', label: 'Wheezing' },
                { key: 'rales_crackles', label: 'Rales/crackles' },
                { key: 'diminished_bs', label: 'Diminished BS' },
                { key: 'accessory_muscle_use', label: 'Accessory muscle use' },
            ],
        },
    ],

    // Category H — Eye
    H: [
        {
            key: 'cat_h_visual_acuity',
            label: 'VISUAL ACUITY',
            normalText: 'Visual acuity intact bilaterally.',
            abnormalOptions: [
                { key: 'decreased_acuity_l', label: 'Decreased acuity (L)' },
                { key: 'decreased_acuity_r', label: 'Decreased acuity (R)' },
                { key: 'decreased_acuity_bl', label: 'Decreased acuity (BL)' },
                { key: 'unable_to_assess', label: 'Unable to assess' },
            ],
        },
        {
            key: 'cat_h_pupils',
            label: 'PUPILS',
            normalText: 'PERRLA. No afferent pupillary defect.',
            abnormalOptions: [
                { key: 'anisocoria', label: 'Anisocoria' },
                { key: 'fixed_pupil', label: 'Fixed pupil' },
                { key: 'dilated_pupil', label: 'Dilated pupil' },
                { key: 'constricted_pupil', label: 'Constricted pupil' },
                { key: 'apd_present', label: 'APD present' },
            ],
        },
        {
            key: 'cat_h_eom',
            label: 'EXTRAOCULAR MOVEMENTS',
            normalText: 'EOMI. No nystagmus or diplopia.',
            abnormalOptions: [
                { key: 'restricted_eom', label: 'Restricted EOM (specify)' },
                { key: 'nystagmus', label: 'Nystagmus' },
                { key: 'diplopia', label: 'Diplopia' },
                { key: 'strabismus', label: 'Strabismus' },
            ],
        },
        {
            key: 'cat_h_conjunctiva_sclera',
            label: 'CONJUNCTIVA/SCLERA',
            normalText: 'Conjunctivae clear. Sclerae white. No injection or discharge.',
            abnormalOptions: [
                { key: 'conjunctival_injection', label: 'Conjunctival injection' },
                { key: 'subconj_hemorrhage', label: 'Subconjunctival hemorrhage' },
                { key: 'discharge', label: 'Discharge' },
                { key: 'chemosis', label: 'Chemosis' },
                { key: 'icterus', label: 'Icterus' },
                { key: 'pterygium', label: 'Pterygium' },
            ],
        },
        {
            key: 'cat_h_fundoscopy',
            label: 'FUNDOSCOPY',
            normalText: 'Discs sharp. No hemorrhages or exudates.',
            abnormalOptions: [
                { key: 'disc_edema', label: 'Disc edema' },
                { key: 'hemorrhage', label: 'Hemorrhage' },
                { key: 'exudate', label: 'Exudate' },
                { key: 'av_nicking', label: 'AV nicking' },
                { key: 'unable_to_visualize', label: 'Unable to visualize' },
            ],
        },
        {
            key: 'cat_h_eyelids',
            label: 'EYELIDS',
            normalText: 'Lids normal. No edema, ptosis, or lesion.',
            abnormalOptions: [
                { key: 'lid_edema', label: 'Lid edema' },
                { key: 'ptosis', label: 'Ptosis' },
                { key: 'chalazion', label: 'Chalazion' },
                { key: 'hordeolum', label: 'Hordeolum' },
                { key: 'laceration', label: 'Laceration' },
                { key: 'entropion', label: 'Entropion' },
                { key: 'ectropion', label: 'Ectropion' },
            ],
        },
    ],

    // Category I — Gynecological
    I: [
        {
            key: 'cat_i_breast',
            label: 'BREAST',
            normalText: 'Symmetric. No masses, tenderness, or discharge. No axillary LAD.',
            abnormalOptions: [
                { key: 'mass', label: 'Mass' },
                { key: 'tenderness', label: 'Tenderness' },
                { key: 'discharge', label: 'Discharge' },
                { key: 'skin_changes', label: 'Skin changes' },
                { key: 'axillary_lad', label: 'Axillary LAD' },
            ],
        },
        {
            key: 'cat_i_external_genitalia',
            label: 'EXTERNAL GENITALIA',
            normalText: 'Normal appearance. No lesions, erythema, or discharge.',
            abnormalOptions: [
                { key: 'lesion_ulcer', label: 'Lesion/ulcer' },
                { key: 'erythema', label: 'Erythema' },
                { key: 'edema', label: 'Edema' },
                { key: 'discharge', label: 'Discharge' },
                { key: 'mass', label: 'Mass' },
            ],
        },
        {
            key: 'cat_i_vaginal_cervical',
            label: 'VAGINAL/CERVICAL',
            normalText: 'Cervix appears normal. No cervical motion tenderness. No abnormal discharge.',
            abnormalOptions: [
                { key: 'cmt', label: 'Cervical motion tenderness' },
                { key: 'abnormal_discharge', label: 'Abnormal discharge' },
                { key: 'cervical_lesion', label: 'Cervical lesion' },
                { key: 'friable_cervix', label: 'Friable cervix' },
                { key: 'bleeding', label: 'Bleeding' },
            ],
        },
        {
            key: 'cat_i_uterus_adnexa',
            label: 'UTERUS/ADNEXA',
            normalText: 'Non-tender. Normal size. No adnexal masses.',
            abnormalOptions: [
                { key: 'uterine_tenderness', label: 'Uterine tenderness' },
                { key: 'enlarged_uterus', label: 'Enlarged uterus' },
                { key: 'adnexal_mass', label: 'Adnexal mass' },
                { key: 'adnexal_tenderness', label: 'Adnexal tenderness' },
            ],
        },
    ],

    // Category J — Dermatological
    J: [
        {
            key: 'cat_j_location_distribution',
            label: 'LOCATION/DISTRIBUTION',
            normalText: 'Localized. Well-demarcated.',
            abnormalOptions: [
                { key: 'diffuse_widespread', label: 'Diffuse/widespread' },
                { key: 'bilateral', label: 'Bilateral' },
                { key: 'dermatomal', label: 'Dermatomal' },
                { key: 'sun_exposed', label: 'Sun-exposed areas' },
                { key: 'intertriginous', label: 'Intertriginous' },
            ],
        },
        {
            key: 'cat_j_morphology',
            label: 'MORPHOLOGY',
            abnormalOptions: [
                { key: 'macule', label: 'Macule' },
                { key: 'papule', label: 'Papule' },
                { key: 'vesicle', label: 'Vesicle' },
                { key: 'pustule', label: 'Pustule' },
                { key: 'plaque', label: 'Plaque' },
                { key: 'nodule', label: 'Nodule' },
                { key: 'wheal', label: 'Wheal' },
                { key: 'erosion', label: 'Erosion' },
                { key: 'ulcer', label: 'Ulcer' },
                { key: 'bulla', label: 'Bulla' },
                { key: 'patch', label: 'Patch' },
                { key: 'petechiae', label: 'Petechiae' },
                { key: 'purpura', label: 'Purpura' },
            ],
        },
        {
            key: 'cat_j_color',
            label: 'COLOR',
            abnormalOptions: [
                { key: 'erythematous', label: 'Erythematous' },
                { key: 'hyperpigmented', label: 'Hyperpigmented' },
                { key: 'hypopigmented', label: 'Hypopigmented' },
                { key: 'violaceous', label: 'Violaceous' },
                { key: 'blanching', label: 'Blanching' },
                { key: 'non_blanching', label: 'Non-blanching' },
            ],
        },
        {
            key: 'cat_j_size_shape',
            label: 'SIZE/SHAPE',
            abnormalOptions: [
                { key: 'lt_1cm', label: '< 1 cm' },
                { key: '1_5cm', label: '1-5 cm' },
                { key: 'gt_5cm', label: '> 5 cm' },
                { key: 'round_oval', label: 'Round/oval' },
                { key: 'irregular', label: 'Irregular' },
                { key: 'linear', label: 'Linear' },
                { key: 'annular', label: 'Annular' },
                { key: 'serpiginous', label: 'Serpiginous' },
            ],
        },
        {
            key: 'cat_j_texture_surface',
            label: 'TEXTURE/SURFACE',
            normalText: 'Smooth surface. No scaling.',
            abnormalOptions: [
                { key: 'scaling', label: 'Scaling' },
                { key: 'crusting', label: 'Crusting' },
                { key: 'weeping', label: 'Weeping' },
                { key: 'lichenified', label: 'Lichenified' },
                { key: 'verrucous', label: 'Verrucous' },
                { key: 'indurated', label: 'Indurated' },
                { key: 'fluctuant', label: 'Fluctuant' },
                { key: 'umbilicated', label: 'Umbilicated' },
            ],
        },
        {
            key: 'cat_j_surrounding_skin',
            label: 'SURROUNDING SKIN',
            normalText: 'No surrounding erythema or induration.',
            abnormalOptions: [
                { key: 'surrounding_erythema', label: 'Surrounding erythema' },
                { key: 'induration', label: 'Induration' },
                { key: 'warmth', label: 'Warmth' },
                { key: 'satellite_lesions', label: 'Satellite lesions' },
                { key: 'lymphangitic_streaking', label: 'Lymphangitic streaking' },
            ],
        },
    ],

    // Category K — Environmental
    K: [
        {
            key: 'cat_k_skin_assessment',
            label: 'SKIN ASSESSMENT',
            normalText: 'Skin intact. No frostbite, burns, or erythema.',
            abnormalOptions: [
                { key: 'erythema', label: 'Erythema' },
                { key: 'blistering', label: 'Blistering' },
                { key: 'eschar', label: 'Eschar' },
                { key: 'frostnip', label: 'Frostnip' },
                { key: 'frostbite', label: 'Frostbite (specify degree)' },
                { key: 'burn', label: 'Burn (specify degree)' },
                { key: 'maceration', label: 'Maceration' },
            ],
        },
        {
            key: 'cat_k_circulation',
            label: 'CIRCULATION',
            normalText: 'Pulses palpable. Cap refill < 3 sec. No edema.',
            abnormalOptions: [
                { key: 'diminished_pulses', label: 'Diminished pulses' },
                { key: 'delayed_cap_refill', label: 'Delayed cap refill' },
                { key: 'edema', label: 'Edema' },
                { key: 'cool_extremities', label: 'Cool extremities' },
                { key: 'cyanosis', label: 'Cyanosis' },
            ],
        },
        {
            key: 'cat_k_sensation',
            label: 'SENSATION',
            normalText: 'Intact to light touch. No numbness or tingling.',
            abnormalOptions: [
                { key: 'decreased_sensation', label: 'Decreased sensation' },
                { key: 'numbness', label: 'Numbness' },
                { key: 'tingling', label: 'Tingling' },
                { key: 'hyperesthesia', label: 'Hyperesthesia' },
            ],
        },
        {
            key: 'cat_k_temperature',
            label: 'TEMPERATURE',
            normalText: 'Afebrile. Skin warm to touch.',
            abnormalOptions: [
                { key: 'hypothermic', label: 'Hypothermic' },
                { key: 'hyperthermic', label: 'Hyperthermic' },
                { key: 'cool_skin', label: 'Cool skin' },
                { key: 'hot_flushed_skin', label: 'Hot/flushed skin' },
            ],
        },
        {
            key: 'cat_k_mental_status',
            label: 'MENTAL STATUS',
            normalText: 'Alert and oriented x4. GCS 15.',
            abnormalOptions: [
                { key: 'confused', label: 'Confused' },
                { key: 'lethargic', label: 'Lethargic' },
                { key: 'combative', label: 'Combative' },
                { key: 'gcs_lt_15', label: 'GCS < 15 (specify)' },
                { key: 'ams', label: 'AMS' },
            ],
        },
    ],

    // Category L — Miscellaneous
    L: [
        {
            key: 'cat_l_general_appearance',
            label: 'GENERAL APPEARANCE',
            normalText: 'Alert, oriented, no acute distress.',
            abnormalOptions: [
                { key: 'appears_ill', label: 'Appears ill' },
                { key: 'acute_distress', label: 'Acute distress' },
                { key: 'lethargic', label: 'Lethargic' },
                { key: 'diaphoretic', label: 'Diaphoretic' },
            ],
        },
        {
            key: 'cat_l_oral_dental',
            label: 'ORAL/DENTAL',
            normalText: 'Oral mucosa intact. Dentition in fair condition.',
            abnormalOptions: [
                { key: 'dental_caries', label: 'Dental caries' },
                { key: 'abscess', label: 'Abscess' },
                { key: 'oral_lesion', label: 'Oral lesion' },
                { key: 'gingival_bleeding', label: 'Gingival bleeding' },
                { key: 'loose_fractured_tooth', label: 'Loose/fractured tooth' },
                { key: 'trismus', label: 'Trismus' },
            ],
        },
        {
            key: 'cat_l_lymph_nodes',
            label: 'LYMPH NODES',
            normalText: 'No cervical, axillary, or inguinal LAD.',
            abnormalOptions: [
                { key: 'cervical_lad', label: 'Cervical LAD' },
                { key: 'axillary_lad', label: 'Axillary LAD' },
                { key: 'inguinal_lad', label: 'Inguinal LAD' },
                { key: 'generalized_lad', label: 'Generalized LAD' },
                { key: 'tender_lad', label: 'Tender LAD' },
                { key: 'matted_nodes', label: 'Matted nodes' },
            ],
        },
    ],

    // Category M — Return Visit
    M: [
        {
            key: 'cat_m_general_appearance',
            label: 'GENERAL APPEARANCE',
            normalText: 'Alert, oriented, no acute distress.',
            abnormalOptions: [
                { key: 'appears_ill', label: 'Appears ill' },
                { key: 'worsened_from_prior', label: 'Worsened from prior' },
                { key: 'no_change_from_prior', label: 'No change from prior' },
            ],
        },
        {
            key: 'cat_m_relevant_system',
            label: 'RELEVANT SYSTEM',
            normalText: 'See system-specific findings above.',
            abnormalOptions: [
                { key: 'worsened', label: 'Worsened' },
                { key: 'unchanged', label: 'Unchanged' },
                { key: 'partially_improved', label: 'Partially improved' },
                { key: 'new_finding', label: 'New finding (specify)' },
            ],
        },
        {
            key: 'cat_m_comparison_to_previous',
            label: 'COMPARISON TO PREVIOUS',
            normalText: 'Improved from prior visit.',
            abnormalOptions: [
                { key: 'worsened', label: 'Worsened' },
                { key: 'unchanged', label: 'Unchanged' },
                { key: 'partially_improved', label: 'Partially improved' },
                { key: 'new_complaint', label: 'New complaint' },
            ],
        },
    ],
};

// ── F. Comprehensive Default Template ──────────────────────────────────────────

export const COMPREHENSIVE_DEFAULT_BLOCK_IDS: string[] = [
    'bl_gen',
    'bl_eyes',
    'sys_ears',
    'sys_nose',
    'sys_oral',
    'sys_pharynx',
    'bl_hent',
    'sys_neck',
    'sys_cv',
    'sys_pulm',
    'sys_abd',
    'sys_msk',
    'sys_derm',
    'sys_extremities',
    'bl_neuro',
    'bl_psych',
];

// ── G. Block Library (flat lookup map) ────────────────────────────────────────

function buildBlockLibrary(): Record<string, PEBlock> {
    const lib: Record<string, PEBlock> = {};
    for (const block of BASELINE_WRAPPERS) {
        lib[block.key] = block;
    }
    for (const block of SYSTEM_BLOCKS) {
        lib[block.key] = block;
    }
    for (const blocks of Object.values(FOCUSED_CATEGORIES)) {
        for (const block of blocks) {
            lib[block.key] = block;
        }
    }
    return lib;
}

export const BLOCK_LIBRARY: Record<string, PEBlock> = buildBlockLibrary();

// ── H. Accessor Functions ──────────────────────────────────────────────────────

export function getBaselineWrappers(): PEBlock[] { return BASELINE_WRAPPERS; }
export function getFocusedBlocks(letter: CategoryLetter): PEBlock[] { return FOCUSED_CATEGORIES[letter] || []; }
export function getSystemBlocks(): PEBlock[] { return SYSTEM_BLOCKS; }
export function getBlockByKey(key: string): PEBlock | undefined { return BLOCK_LIBRARY[key]; }

export { PE_CATEGORIES };
