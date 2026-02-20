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

export function getGeneralFindings(letter: CategoryLetter): GeneralFinding[] {
    const keys = GENERAL_FINDINGS_MAP[letter] || [];
    return keys.map(k => GENERAL_FINDINGS[k]).filter(Boolean);
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

export { PE_CATEGORIES };
