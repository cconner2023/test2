// Data/PhysicalExamData.ts
// Physical exam block definitions using paired findings model.
// Consolidated master blocks with tiered findings for baseline/expanded PE.

// ── Existing type exports (preserve) ──────────────────────────
export type CategoryLetter = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M';
export type Laterality = 'left' | 'right' | 'bilateral';
export type SpineRegion = 'cervical' | 'thoracic' | 'lumbar' | 'sacral';

// ── Paired findings model ─────────────────────────────────────
export interface AbnormalOption {
    key: string;
    label: string;
}

export interface PEFinding {
    key: string;
    normal: string;
    abnormals: AbnormalOption[];
}

export interface PEBlock {
    key: string;
    label: string;
    findings: PEFinding[];
}

export interface VitalSignDef {
    key: string;
    label: string;
    shortLabel: string;
    unit: string;
    placeholder: string;
}

// ── Master block types ────────────────────────────────────────
export interface MasterPEFinding {
    key: string;
    normal: string;
    abnormals: AbnormalOption[];
    tier: 'baseline' | 'expanded';
}

export interface MasterPEBlock {
    key: string;
    label: string;
    findings: MasterPEFinding[];
    /** If set, this block is a child of another block (e.g. msk_back is child of msk) */
    parent?: string;
}

export const VITAL_SIGNS: VitalSignDef[] = [
    { key: 'hr',    label: 'Heart Rate',      shortLabel: 'HR',   unit: 'bpm',  placeholder: '60-100' },
    { key: 'rr',    label: 'Respirations',    shortLabel: 'RR',   unit: '/min', placeholder: '12-20'  },
    { key: 'bpSys', label: 'BP (Systolic)',   shortLabel: 'BPs',  unit: 'mmHg', placeholder: '120'    },
    { key: 'bpDia', label: 'BP (Diastolic)',  shortLabel: 'BPd',  unit: 'mmHg', placeholder: '80'     },
    { key: 'temp',  label: 'Temperature',     shortLabel: 'Temp', unit: '°F',   placeholder: '98.6'   },
    { key: 'ht',    label: 'Height',          shortLabel: 'Ht',   unit: 'in',   placeholder: '68'     },
    { key: 'wt',    label: 'Weight',          shortLabel: 'Wt',   unit: 'lbs',  placeholder: '170'    },
];

export function isBackPainCode(code: string): boolean {
    return code === 'B-1';
}

// ══════════════════════════════════════════════════════════════
// MASTER BLOCKS — consolidated PE with tiered findings
// ══════════════════════════════════════════════════════════════

export const MASTER_BLOCKS: MasterPEBlock[] = [
    {
        key: 'gen',
        label: 'General',
        findings: [
        { key: 'appearsStatedAge', normal: 'Appears stated age', abnormals: [], tier: 'baseline' },
        { key: 'wnwd', normal: 'WNWD', abnormals: [
                { key: 'thinAppearing', label: 'Thin appearing' },
                { key: 'excessiveAbdominalAdiposity', label: 'Excessive abdominal adiposity' },
                { key: 'cachexia', label: 'Cachexia' },
            ], tier: 'baseline' },
        { key: 'noAcuteDistress', normal: 'No acute distress', abnormals: [
                { key: 'acuteDistress', label: 'Acute distress' },
                { key: 'mildDistress', label: 'Mild distress' },
                { key: 'moderateDistress', label: 'Moderate distress' },
            ], tier: 'baseline' },
        { key: 'alert', normal: 'Alert', abnormals: [{ key: 'lethargic', label: 'Lethargic' }, { key: 'ams', label: 'AMS' }], tier: 'expanded' },
        { key: 'wellNourished', normal: 'Well-nourished', abnormals: [{ key: 'appearsIll', label: 'Appears ill' }], tier: 'expanded' },
        { key: 'noDiaphoresis', normal: 'No diaphoresis', abnormals: [{ key: 'diaphoretic', label: 'Diaphoretic' }], tier: 'expanded' },
        { key: 'goodColor', normal: 'Good color', abnormals: [{ key: 'pallor', label: 'Pallor' }], tier: 'expanded' },
        { key: 'improvedFromPrior', normal: 'Improved from prior', abnormals: [{ key: 'worsenedFromPrior', label: 'Worsened from prior' }, { key: 'noChangeFromPrior', label: 'No change from prior' }], tier: 'expanded' },
        ],
    },

    {
        key: 'head',
        label: 'Head',
        findings: [
        { key: 'normocephalicAtraumatic', normal: 'NCAT', abnormals: [{ key: 'scalpTenderness', label: 'Scalp tenderness' }, { key: 'scalpLaceration', label: 'Scalp laceration' }], tier: 'baseline' },
        ],
    },

    {
        key: 'eyes',
        label: 'Eyes',
        findings: [
        { key: 'perrl', normal: 'PERRL', abnormals: [
                { key: 'anisocoria', label: 'Anisocoria' },
                { key: 'fixedPupil', label: 'Fixed pupil' },
                { key: 'dilatedPupil', label: 'Dilated pupil' },
                { key: 'constrictedPupil', label: 'Constricted pupil' },
                { key: 'apdPresent', label: 'APD present' },
            ], tier: 'baseline' },
        { key: 'eomi', normal: 'EOMI', abnormals: [
                { key: 'restrictedEom', label: 'Restricted EOM' },
                { key: 'nystagmus', label: 'Nystagmus' },
                { key: 'diplopia', label: 'Diplopia' },
                { key: 'strabismus', label: 'Strabismus' },
            ], tier: 'baseline' },
        { key: 'vffc', normal: 'VFFC', abnormals: [{ key: 'visualFieldDeficit', label: 'Visual field deficit' }], tier: 'baseline' },
        { key: 'visualAcuityIntactBilaterally', normal: 'Visual acuity intact bilaterally', abnormals: [
                { key: 'decreasedAcuityL', label: 'Decreased acuity (L)' },
                { key: 'decreasedAcuityR', label: 'Decreased acuity (R)' },
                { key: 'decreasedAcuityBl', label: 'Decreased acuity (BL)' },
            ], tier: 'expanded' },
        { key: 'conjunctivaeClear', normal: 'Conjunctivae clear', abnormals: [
                { key: 'conjunctivalInjection', label: 'Conjunctival injection' },
                { key: 'chemosis', label: 'Chemosis' },
                { key: 'subconjunctivalHemorrhage', label: 'Subconjunctival hemorrhage' },
            ], tier: 'expanded' },
        { key: 'scleraeWhite', normal: 'Sclerae white', abnormals: [{ key: 'icterus', label: 'Icterus' }], tier: 'expanded' },
        { key: 'discsSharp', normal: 'Discs sharp', abnormals: [{ key: 'discEdema', label: 'Disc edema' }, { key: 'hemorrhageFundus', label: 'Hemorrhage' }], tier: 'expanded' },
        { key: 'lidsNormal', normal: 'Lids normal', abnormals: [
                { key: 'chalazion', label: 'Chalazion' },
                { key: 'hordeolum', label: 'Hordeolum' },
                { key: 'ptosis', label: 'Ptosis' },
                { key: 'lidEdema', label: 'Lid edema' },
            ], tier: 'expanded' },
        { key: 'noDischargeEye', normal: 'No discharge', abnormals: [{ key: 'dischargeEye', label: 'Discharge' }], tier: 'expanded' },
        { key: 'noPterygium', normal: 'No pterygium', abnormals: [{ key: 'pterygium', label: 'Pterygium' }], tier: 'expanded' },
        ],
    },

    {
        key: 'ears',
        label: 'Ears',
        findings: [
        { key: 'pinnaNormalNontender', normal: 'Pinna normal, nontender', abnormals: [{ key: 'pinnaTenderness', label: 'Pinna tenderness' }, { key: 'tragalTenderness', label: 'Tragal tenderness' }], tier: 'baseline' },
        { key: 'mastoidNontender', normal: 'Mastoid nontender', abnormals: [{ key: 'mastoidTtp', label: 'Mastoid TTP' }], tier: 'baseline' },
        { key: 'eacClear', normal: 'EAC clear', abnormals: [
                { key: 'eacErythema', label: 'EAC erythema' },
                { key: 'canalEdema', label: 'Canal edema' },
                { key: 'cerumenImpaction', label: 'Cerumen impaction' },
            ], tier: 'baseline' },
        { key: 'tmIntact', normal: 'TM intact', abnormals: [
                { key: 'tmErythema', label: 'TM erythema' },
                { key: 'tmBulging', label: 'TM bulging' },
                { key: 'tmPerforation', label: 'TM perforation' },
                { key: 'tmEffusion', label: 'TM effusion' },
            ], tier: 'expanded' },
        { key: 'normalLightReflex', normal: 'Normal light reflex', abnormals: [{ key: 'landmarksDistorted', label: 'Landmarks distorted' }], tier: 'expanded' },
        { key: 'tmMobile', normal: 'TM mobile', abnormals: [{ key: 'tmImmobile', label: 'TM immobile' }], tier: 'expanded' },
        { key: 'noEffusion', normal: 'No effusion', abnormals: [{ key: 'effusion', label: 'Effusion' }], tier: 'expanded' },
        { key: 'canalClear', normal: 'Canal clear', abnormals: [{ key: 'cerumenImpactionExp', label: 'Cerumen impaction' }], tier: 'expanded' },
        ],
    },

    {
        key: 'nose',
        label: 'Nose',
        findings: [
        { key: 'noExternalDeformities', normal: 'No external deformities', abnormals: [], tier: 'baseline' },
        { key: 'noNasalDischarge', normal: 'No nasal discharge', abnormals: [
                { key: 'purulentDischarge', label: 'Purulent discharge' },
                { key: 'clearRhinorrhea', label: 'Clear rhinorrhea' },
                { key: 'epistaxis', label: 'Epistaxis' },
            ], tier: 'baseline' },
        { key: 'septumMidline', normal: 'Septum midline', abnormals: [{ key: 'septalDeviation', label: 'Septal deviation' }], tier: 'baseline' },
        { key: 'mucosaPink', normal: 'Mucosa pink', abnormals: [{ key: 'mucosalErythema', label: 'Mucosal erythema' }], tier: 'expanded' },
        { key: 'turbinatesNotSwollen', normal: 'Turbinates not swollen', abnormals: [{ key: 'turbinateHypertrophy', label: 'Turbinate hypertrophy' }], tier: 'expanded' },
        { key: 'noSinusTenderness', normal: 'No sinus tenderness', abnormals: [{ key: 'frontalSinusTenderness', label: 'Frontal sinus tenderness' }, { key: 'maxillarySinusTenderness', label: 'Maxillary sinus tenderness' }], tier: 'expanded' },
        { key: 'naresPatent', normal: 'Nares patent bilaterally', abnormals: [], tier: 'expanded' },
        ],
    },

    {
        key: 'oral_throat',
        label: 'Oral/Throat',
        findings: [
        { key: 'mucosaMoistAndClear', normal: 'Mucosa moist and clear', abnormals: [{ key: 'dryMucousMembranes', label: 'Dry mucous membranes' }, { key: 'thrush', label: 'Thrush' }], tier: 'baseline' },
        { key: 'noMassesOrLesions', normal: 'No masses or lesions', abnormals: [{ key: 'oralLesionUlcer', label: 'Oral lesion/ulcer' }, { key: 'abscess', label: 'Abscess' }], tier: 'baseline' },
        { key: 'noErythemaPharynx', normal: 'No erythema', abnormals: [{ key: 'pharyngealErythema', label: 'Pharyngeal erythema' }], tier: 'baseline' },
        { key: 'noPndOrDrainage', normal: 'No PND or drainage', abnormals: [{ key: 'pndPresent', label: 'PND present' }, { key: 'cobblestoning', label: 'Cobblestoning' }], tier: 'baseline' },
        { key: 'dentitionIntact', normal: 'Dentition intact', abnormals: [{ key: 'poorDentition', label: 'Poor dentition' }, { key: 'dentalCaries', label: 'Dental caries' }], tier: 'expanded' },
        { key: 'gingivaHealthy', normal: 'Gingiva healthy', abnormals: [{ key: 'gingivalErythema', label: 'Gingival erythema' }, { key: 'gingivalBleeding', label: 'Gingival bleeding' }], tier: 'expanded' },
        { key: 'tonsilsGrade1', normal: 'Tonsils Grade 1', abnormals: [{ key: 'tonsillarHypertrophyGrade2', label: 'Tonsillar hypertrophy (Grade 2)' }, { key: 'tonsillarHypertrophyGrade3', label: 'Tonsillar hypertrophy (Grade 3)' }], tier: 'expanded' },
        { key: 'symmetricMidlineUvula', normal: 'Symmetric, midline uvula', abnormals: [{ key: 'uvularDeviation', label: 'Uvular deviation' }, { key: 'peritonsillarSwelling', label: 'Peritonsillar swelling' }], tier: 'expanded' },
        { key: 'noTonsillarExudate', normal: 'No tonsillar exudate', abnormals: [{ key: 'tonsillarExudate', label: 'Tonsillar exudate' }], tier: 'expanded' },
        { key: 'lipsNormal', normal: 'Lips normal', abnormals: [{ key: 'lipLesion', label: 'Lip lesion' }], tier: 'expanded' },
        { key: 'noTrismus', normal: 'No trismus', abnormals: [{ key: 'trismus', label: 'Trismus' }], tier: 'expanded' },
        ],
    },

    {
        key: 'neck',
        label: 'Neck',
        findings: [
        { key: 'supple', normal: 'Supple', abnormals: [{ key: 'meningismus', label: 'Meningismus' }], tier: 'baseline' },
        { key: 'nonTenderNeck', normal: 'Non-tender', abnormals: [{ key: 'ttpNeck', label: 'TTP' }], tier: 'baseline' },
        { key: 'noLymphadenopathy', normal: 'No lymphadenopathy', abnormals: [
                { key: 'cervicalLad', label: 'Cervical LAD' },
                { key: 'preauricularLad', label: 'Preauricular LAD' },
                { key: 'supraclavicularLad', label: 'Supraclavicular LAD' },
            ], tier: 'baseline' },
        { key: 'noCarotidBruits', normal: 'No carotid bruits', abnormals: [{ key: 'carotidBruitR', label: 'Carotid bruit R' }, { key: 'carotidBruitL', label: 'Carotid bruit L' }], tier: 'expanded' },
        { key: 'noJvd', normal: 'No JVD', abnormals: [{ key: 'jvdNoted', label: 'JVD noted' }], tier: 'expanded' },
        { key: 'tracheaMidline', normal: 'Trachea midline', abnormals: [{ key: 'trachealDeviation', label: 'Tracheal deviation' }], tier: 'expanded' },
        { key: 'thyroidNonEnlarged', normal: 'Thyroid non-enlarged', abnormals: [{ key: 'thyromegaly', label: 'Thyromegaly' }], tier: 'expanded' },
        { key: 'fullRomNeck', normal: 'Full ROM', abnormals: [{ key: 'limitedRomNeck', label: 'Limited ROM' }], tier: 'expanded' },
        ],
    },

    {
        key: 'cv',
        label: 'Cardiovascular',
        findings: [
        { key: 'normalRate', normal: 'Normal rate', abnormals: [{ key: 'tachycardia', label: 'Tachycardia' }, { key: 'bradycardia', label: 'Bradycardia' }], tier: 'baseline' },
        { key: 'regularRhythm', normal: 'Regular rhythm', abnormals: [{ key: 'irregularRhythm', label: 'Irregular rhythm' }], tier: 'baseline' },
        { key: 'noMurmur', normal: 'No murmur', abnormals: [{ key: 'murmurSpecify', label: 'Murmur (specify)' }], tier: 'baseline' },
        { key: 'noRub', normal: 'No rub', abnormals: [{ key: 'rub', label: 'Rub' }], tier: 'baseline' },
        { key: 'noGallop', normal: 'No gallop', abnormals: [{ key: 'gallopS3', label: 'Gallop (S3)' }, { key: 'gallopS4', label: 'Gallop (S4)' }], tier: 'baseline' },
        { key: 'pulses2PlusEqualBilaterally', normal: 'Pulses 2+ equal bilaterally', abnormals: [{ key: 'diminishedPulses', label: 'Diminished pulses' }, { key: 'absentPulses', label: 'Absent pulses' }], tier: 'expanded' },
        { key: 'capRefillLt3Sec', normal: 'Cap refill < 3 sec', abnormals: [{ key: 'delayedCapRefill', label: 'Delayed cap refill' }], tier: 'expanded' },
        { key: 'noEdemaCV', normal: 'No edema', abnormals: [{ key: 'peripheralEdema', label: 'Peripheral edema' }], tier: 'expanded' },
        { key: 'warmExtremitiesCV', normal: 'Warm extremities', abnormals: [{ key: 'coolExtremities', label: 'Cool extremities' }, { key: 'cyanosis', label: 'Cyanosis' }], tier: 'expanded' },
        { key: 's1S2Normal', normal: 'S1/S2 normal', abnormals: [], tier: 'expanded' },
        ],
    },

    {
        key: 'pulm',
        label: 'Pulmonary',
        findings: [
        { key: 'ctaBilaterally', normal: 'CTA bilaterally', abnormals: [{ key: 'diminishedBreathSounds', label: 'Diminished breath sounds' }], tier: 'baseline' },
        { key: 'nonLaboredRespirations', normal: 'Non-labored respirations', abnormals: [{ key: 'tachypnea', label: 'Tachypnea' }], tier: 'baseline' },
        { key: 'noWheezes', normal: 'No wheezes', abnormals: [{ key: 'wheezing', label: 'Wheezing' }], tier: 'baseline' },
        { key: 'noRales', normal: 'No rales', abnormals: [{ key: 'ralesCrackles', label: 'Rales/crackles' }], tier: 'baseline' },
        { key: 'noRhonchi', normal: 'No rhonchi', abnormals: [{ key: 'rhonchi', label: 'Rhonchi' }], tier: 'expanded' },
        { key: 'noStridor', normal: 'No stridor', abnormals: [{ key: 'stridor', label: 'Stridor' }], tier: 'expanded' },
        { key: 'noPleuralRub', normal: 'No pleural rub', abnormals: [{ key: 'pleuralRub', label: 'Pleural rub' }], tier: 'expanded' },
        { key: 'noAccessoryMuscleUse', normal: 'No accessory muscle use', abnormals: [
                { key: 'accessoryMuscleUse', label: 'Accessory muscle use' },
                { key: 'retractions', label: 'Retractions' },
                { key: 'nasalFlaring', label: 'Nasal flaring' },
                { key: 'tripoding', label: 'Tripoding' },
            ], tier: 'expanded' },
        { key: 'speakingFullSentences', normal: 'Speaking full sentences', abnormals: [{ key: 'speaksInFragments', label: 'Speaks in fragments' }], tier: 'expanded' },
        { key: 'symmetricRiseFall', normal: 'Symmetric rise and fall', abnormals: [{ key: 'asymmetricExpansion', label: 'Asymmetric expansion' }, { key: 'chestWallDeformity', label: 'Chest wall deformity' }], tier: 'expanded' },
        { key: 'nonTenderChest', normal: 'Non-tender', abnormals: [{ key: 'tendernessChest', label: 'Tenderness' }, { key: 'crepitusChest', label: 'Crepitus' }], tier: 'expanded' },
        ],
    },

    {
        key: 'abd',
        label: 'Abdomen',
        findings: [
        { key: 'soft', normal: 'Soft', abnormals: [{ key: 'rigidity', label: 'Rigidity' }], tier: 'baseline' },
        { key: 'nonTenderAbd', normal: 'Non-tender', abnormals: [{ key: 'ttpSpecifyLocation', label: 'TTP (specify location)' }], tier: 'baseline' },
        { key: 'nonDistended', normal: 'Non-distended', abnormals: [{ key: 'distended', label: 'Distended' }], tier: 'baseline' },
        { key: 'noMassesAbd', normal: 'No masses', abnormals: [{ key: 'massSpecify', label: 'Mass (specify)' }], tier: 'baseline' },
        { key: 'noGuarding', normal: 'No guarding', abnormals: [{ key: 'muscleGuarding', label: 'Muscle guarding' }, { key: 'reboundTenderness', label: 'Rebound tenderness' }], tier: 'baseline' },
        { key: 'bsPresentX4Quadrants', normal: 'BS present x 4 quadrants', abnormals: [
                { key: 'hyperactiveBs', label: 'Hyperactive BS' },
                { key: 'hypoactiveBs', label: 'Hypoactive BS' },
                { key: 'absentBs', label: 'Absent BS' },
            ], tier: 'baseline' },
        { key: 'noHepatomegaly', normal: 'No hepatomegaly', abnormals: [{ key: 'hepatomegaly', label: 'Hepatomegaly' }], tier: 'expanded' },
        { key: 'noSplenomegaly', normal: 'No splenomegaly', abnormals: [{ key: 'splenomegaly', label: 'Splenomegaly' }], tier: 'expanded' },
        { key: 'negMcBurneys', normal: '(-) McBurney\'s', abnormals: [{ key: 'posMcBurneysPoint', label: '(+) McBurney\'s point' }], tier: 'expanded' },
        { key: 'negPsoasSign', normal: '(-) Psoas sign', abnormals: [{ key: 'posPsoasSign', label: '(+) Psoas sign' }], tier: 'expanded' },
        { key: 'negMurphys', normal: '(-) Murphy\'s', abnormals: [{ key: 'posMurphysSign', label: '(+) Murphy\'s sign' }], tier: 'expanded' },
        { key: 'negObturator', normal: '(-) Obturator', abnormals: [{ key: 'posObturatorSign', label: '(+) Obturator sign' }], tier: 'expanded' },
        { key: 'negRovsings', normal: '(-) Rovsing\'s', abnormals: [{ key: 'posRovsingSign', label: '(+) Rovsing\'s sign' }], tier: 'expanded' },
        { key: 'noCvaTenderness', normal: 'No CVA tenderness', abnormals: [{ key: 'cvaTendernessR', label: 'CVA tenderness R' }, { key: 'cvaTendernessL', label: 'CVA tenderness L' }], tier: 'expanded' },
        { key: 'tympanicThroughout', normal: 'Tympanic throughout', abnormals: [{ key: 'dullness', label: 'Dullness' }, { key: 'shiftingDullness', label: 'Shifting dullness' }], tier: 'expanded' },
        { key: 'noBruits', normal: 'No bruits', abnormals: [{ key: 'bruit', label: 'Bruit' }], tier: 'expanded' },
        { key: 'noScars', normal: 'No scars', abnormals: [{ key: 'surgicalScars', label: 'Surgical scars' }], tier: 'expanded' },
        { key: 'noHernias', normal: 'No hernias', abnormals: [{ key: 'hernia', label: 'Hernia' }], tier: 'expanded' },
        ],
    },

    {
        key: 'msk',
        label: 'Musculoskeletal',
        findings: [
        { key: 'normalRom', normal: 'Normal ROM', abnormals: [{ key: 'limitedRom', label: 'Limited ROM' }], tier: 'baseline' },
        { key: 'normalStrength', normal: 'Normal strength', abnormals: [{ key: 'decreasedStrength', label: 'Decreased strength' }], tier: 'baseline' },
        { key: 'nonTenderMsk', normal: 'Non-tender', abnormals: [{ key: 'ttpSpecify', label: 'TTP (specify)' }], tier: 'baseline' },
        { key: 'noSwelling', normal: 'No swelling', abnormals: [{ key: 'swelling', label: 'Swelling' }, { key: 'edema', label: 'Edema' }], tier: 'baseline' },
        { key: 'noDeformity', normal: 'No deformity', abnormals: [{ key: 'deformity', label: 'Deformity' }, { key: 'stepOffDeformity', label: 'Step-off deformity' }], tier: 'baseline' },
        { key: 'noCrepitus', normal: 'No crepitus', abnormals: [{ key: 'crepitus', label: 'Crepitus' }], tier: 'baseline' },
        { key: 'stable', normal: 'Stable', abnormals: [{ key: 'instability', label: 'Instability' }], tier: 'expanded' },
        { key: 'noAtrophy', normal: 'No atrophy', abnormals: [{ key: 'atrophy', label: 'Atrophy' }], tier: 'expanded' },
        { key: 'noSpasm', normal: 'No spasm', abnormals: [{ key: 'muscleSpasm', label: 'Muscle spasm' }], tier: 'expanded' },
        { key: 'normalGaitMsk', normal: 'Normal gait', abnormals: [{ key: 'antalgicGait', label: 'Antalgic gait' }, { key: 'limbAtaxia', label: 'Limb ataxia' }], tier: 'expanded' },
        { key: 'fullActiveRom', normal: 'Full active ROM', abnormals: [{ key: 'decreasedActiveRom', label: 'Decreased active ROM' }], tier: 'expanded' },
        { key: 'fullPassiveRom', normal: 'Full passive ROM', abnormals: [{ key: 'decreasedPassiveRom', label: 'Decreased passive ROM' }], tier: 'expanded' },
        { key: 'noPainWithMovement', normal: 'No pain with movement', abnormals: [{ key: 'painWithRom', label: 'Pain with ROM' }], tier: 'expanded' },
        { key: 'strength55', normal: '5/5 strength', abnormals: [{ key: 'decreasedStrengthGrade', label: 'Decreased strength (specify grade)' }], tier: 'expanded' },
        { key: 'equalBilaterally', normal: 'Equal bilaterally', abnormals: [{ key: 'unequal', label: 'Unequal' }], tier: 'expanded' },
        { key: 'noWarmth', normal: 'No warmth', abnormals: [{ key: 'warmth', label: 'Warmth' }], tier: 'expanded' },
        { key: 'noEffusionPalp', normal: 'No effusion', abnormals: [{ key: 'effusionPalp', label: 'Effusion' }], tier: 'expanded' },
        { key: 'normalPosture', normal: 'Normal posture', abnormals: [{ key: 'poorSlumpedPosture', label: 'Poor/slumped posture' }], tier: 'expanded' },
        { key: 'dtrNormal', normal: 'DTR normal bilaterally', abnormals: [
                { key: 'hyperreflexia', label: 'Hyperreflexia' },
                { key: 'hyporeflexia', label: 'Hyporeflexia' },
                { key: 'areflexia', label: 'Areflexia' },
            ], tier: 'expanded' },
        { key: 'sensoryIntactMsk', normal: 'Sensory intact to light touch', abnormals: [
                { key: 'decreasedSensation', label: 'Decreased sensation' },
                { key: 'numbness', label: 'Numbness' },
                { key: 'paresthesias', label: 'Paresthesias' },
            ], tier: 'expanded' },
        ],
    },
    // ── MSK Child Blocks (body-part-specific special tests) ──────
    // Ordered anatomically top-to-bottom for coherent output
    {
        key: 'msk_neck',
        label: 'Neck',
        parent: 'msk',
        findings: [
        { key: 'spurlings', normal: "(-) Spurling's", abnormals: [{ key: 'spurlingsPos', label: "(+) Spurling's" }], tier: 'expanded' },
        { key: 'hoffmans', normal: "(-) Hoffman's", abnormals: [{ key: 'hoffmansPos', label: "(+) Hoffman's" }], tier: 'expanded' },
        ],
    },
    {
        key: 'msk_shoulder',
        label: 'Shoulder',
        parent: 'msk',
        findings: [
        { key: 'neer', normal: '(-) Neer', abnormals: [{ key: 'neerPos', label: '(+) Neer' }], tier: 'expanded' },
        { key: 'hawkins', normal: '(-) Hawkins', abnormals: [{ key: 'hawkinsPos', label: '(+) Hawkins' }], tier: 'expanded' },
        { key: 'emptyCan', normal: '(-) Empty can', abnormals: [{ key: 'emptyCanPos', label: '(+) Empty can' }], tier: 'expanded' },
        { key: 'speed', normal: '(-) Speed', abnormals: [{ key: 'speedPos', label: '(+) Speed' }], tier: 'expanded' },
        { key: 'apprehension', normal: '(-) Apprehension', abnormals: [{ key: 'apprehensionPos', label: '(+) Apprehension' }], tier: 'expanded' },
        { key: 'relocation', normal: '(-) Relocation', abnormals: [{ key: 'relocationPos', label: '(+) Relocation' }], tier: 'expanded' },
        { key: 'obriens', normal: "(-) O'Brien's", abnormals: [{ key: 'obriensPos', label: "(+) O'Brien's" }], tier: 'expanded' },
        { key: 'crossBodyAdduction', normal: '(-) Cross-body adduction', abnormals: [{ key: 'crossBodyAdductionPos', label: '(+) Cross-body adduction' }], tier: 'expanded' },
        { key: 'dropArm', normal: '(-) Drop arm', abnormals: [{ key: 'dropArmPos', label: '(+) Drop arm' }], tier: 'expanded' },
        { key: 'liftOff', normal: '(-) Lift-off', abnormals: [{ key: 'liftOffPos', label: '(+) Lift-off' }], tier: 'expanded' },
        ],
    },
    {
        key: 'msk_elbow',
        label: 'Elbow',
        parent: 'msk',
        findings: [
        { key: 'tinelCubital', normal: '(-) Tinel (cubital tunnel)', abnormals: [{ key: 'tinelCubitalPos', label: '(+) Tinel (cubital tunnel)' }], tier: 'expanded' },
        { key: 'valgusStress', normal: '(-) Valgus stress', abnormals: [{ key: 'valgusStressPos', label: '(+) Valgus stress' }], tier: 'expanded' },
        { key: 'varusStress', normal: '(-) Varus stress', abnormals: [{ key: 'varusStressPos', label: '(+) Varus stress' }], tier: 'expanded' },
        ],
    },
    {
        key: 'msk_wrist',
        label: 'Wrist',
        parent: 'msk',
        findings: [
        { key: 'tinelCarpal', normal: '(-) Tinel (carpal tunnel)', abnormals: [{ key: 'tinelCarpalPos', label: '(+) Tinel (carpal tunnel)' }], tier: 'expanded' },
        { key: 'phalen', normal: '(-) Phalen', abnormals: [{ key: 'phalenPos', label: '(+) Phalen' }], tier: 'expanded' },
        { key: 'finkelstein', normal: '(-) Finkelstein', abnormals: [{ key: 'finkelsteinPos', label: '(+) Finkelstein' }], tier: 'expanded' },
        { key: 'watsonsScaphoid', normal: "(-) Watson's (scaphoid shift)", abnormals: [{ key: 'watsonsScaphoidPos', label: "(+) Watson's (scaphoid shift)" }], tier: 'expanded' },
        ],
    },
    {
        key: 'msk_hand',
        label: 'Hand',
        parent: 'msk',
        findings: [
        { key: 'tinelCarpalH', normal: '(-) Tinel (carpal tunnel)', abnormals: [{ key: 'tinelCarpalHPos', label: '(+) Tinel (carpal tunnel)' }], tier: 'expanded' },
        { key: 'phalenH', normal: '(-) Phalen', abnormals: [{ key: 'phalenHPos', label: '(+) Phalen' }], tier: 'expanded' },
        { key: 'finkelsteinH', normal: '(-) Finkelstein', abnormals: [{ key: 'finkelsteinHPos', label: '(+) Finkelstein' }], tier: 'expanded' },
        { key: 'grindTest1stCmc', normal: '(-) Grind test (1st CMC)', abnormals: [{ key: 'grindTest1stCmcPos', label: '(+) Grind test (1st CMC)' }], tier: 'expanded' },
        ],
    },
    {
        key: 'msk_back',
        label: 'Back',
        parent: 'msk',
        findings: [
        { key: 'straightLegRaise', normal: '(-) Straight leg raise', abnormals: [{ key: 'straightLegRaisePos', label: '(+) Straight leg raise' }], tier: 'expanded' },
        { key: 'faber', normal: '(-) FABER', abnormals: [{ key: 'faberPos', label: '(+) FABER' }], tier: 'expanded' },
        { key: 'fadir', normal: '(-) FADIR', abnormals: [{ key: 'fadirPos', label: '(+) FADIR' }], tier: 'expanded' },
        { key: 'ober', normal: '(-) Ober', abnormals: [{ key: 'oberPos', label: '(+) Ober' }], tier: 'expanded' },
        { key: 'piriformisTest', normal: '(-) Piriformis test', abnormals: [{ key: 'piriformisTestPos', label: '(+) Piriformis test' }], tier: 'expanded' },
        { key: 'slumpTest', normal: '(-) Slump test', abnormals: [{ key: 'slumpTestPos', label: '(+) Slump test' }], tier: 'expanded' },
        ],
    },
    {
        key: 'msk_hip',
        label: 'Hip',
        parent: 'msk',
        findings: [
        { key: 'faberHip', normal: '(-) FABER', abnormals: [{ key: 'faberHipPos', label: '(+) FABER' }], tier: 'expanded' },
        { key: 'fadirHip', normal: '(-) FADIR', abnormals: [{ key: 'fadirHipPos', label: '(+) FADIR' }], tier: 'expanded' },
        { key: 'oberHip', normal: '(-) Ober', abnormals: [{ key: 'oberHipPos', label: '(+) Ober' }], tier: 'expanded' },
        { key: 'trendelenburg', normal: '(-) Trendelenburg', abnormals: [{ key: 'trendelenburgPos', label: '(+) Trendelenburg' }], tier: 'expanded' },
        { key: 'thomasTest', normal: '(-) Thomas test', abnormals: [{ key: 'thomasTestPos', label: '(+) Thomas test' }], tier: 'expanded' },
        { key: 'logRoll', normal: '(-) Log roll', abnormals: [{ key: 'logRollPos', label: '(+) Log roll' }], tier: 'expanded' },
        { key: 'piriformisTestHip', normal: '(-) Piriformis test', abnormals: [{ key: 'piriformisTestHipPos', label: '(+) Piriformis test' }], tier: 'expanded' },
        ],
    },
    {
        key: 'msk_knee',
        label: 'Knee',
        parent: 'msk',
        findings: [
        { key: 'lachman', normal: '(-) Lachman', abnormals: [{ key: 'lachmanPos', label: '(+) Lachman' }], tier: 'expanded' },
        { key: 'anteriorDrawer', normal: '(-) Anterior drawer', abnormals: [{ key: 'anteriorDrawerPos', label: '(+) Anterior drawer' }], tier: 'expanded' },
        { key: 'posteriorDrawer', normal: '(-) Posterior drawer', abnormals: [{ key: 'posteriorDrawerPos', label: '(+) Posterior drawer' }], tier: 'expanded' },
        { key: 'mcmurray', normal: '(-) McMurray', abnormals: [{ key: 'mcmurrayPos', label: '(+) McMurray' }], tier: 'expanded' },
        { key: 'valgusStressKnee', normal: '(-) Valgus stress', abnormals: [{ key: 'valgusStressKneePos', label: '(+) Valgus stress' }], tier: 'expanded' },
        { key: 'varusStressKnee', normal: '(-) Varus stress', abnormals: [{ key: 'varusStressKneePos', label: '(+) Varus stress' }], tier: 'expanded' },
        { key: 'patellarApprehension', normal: '(-) Patellar apprehension', abnormals: [{ key: 'patellarApprehensionPos', label: '(+) Patellar apprehension' }], tier: 'expanded' },
        { key: 'patellarGrind', normal: '(-) Patellar grind', abnormals: [{ key: 'patellarGrindPos', label: '(+) Patellar grind' }], tier: 'expanded' },
        ],
    },
    {
        key: 'msk_ankle',
        label: 'Ankle',
        parent: 'msk',
        findings: [
        { key: 'anteriorDrawerAnkle', normal: '(-) Anterior drawer', abnormals: [{ key: 'anteriorDrawerAnklePos', label: '(+) Anterior drawer' }], tier: 'expanded' },
        { key: 'talarTilt', normal: '(-) Talar tilt', abnormals: [{ key: 'talarTiltPos', label: '(+) Talar tilt' }], tier: 'expanded' },
        { key: 'thompson', normal: '(-) Thompson', abnormals: [{ key: 'thompsonPos', label: '(+) Thompson' }], tier: 'expanded' },
        { key: 'squeezeTest', normal: '(-) Squeeze test', abnormals: [{ key: 'squeezeTestPos', label: '(+) Squeeze test' }], tier: 'expanded' },
        { key: 'externalRotationStress', normal: '(-) External rotation stress', abnormals: [{ key: 'externalRotationStressPos', label: '(+) External rotation stress' }], tier: 'expanded' },
        ],
    },
    {
        key: 'msk_foot',
        label: 'Foot',
        parent: 'msk',
        findings: [
        { key: 'tinelTarsal', normal: '(-) Tinel (tarsal tunnel)', abnormals: [{ key: 'tinelTarsalPos', label: '(+) Tinel (tarsal tunnel)' }], tier: 'expanded' },
        { key: 'squeezeTestMtp', normal: '(-) Squeeze test (MTP)', abnormals: [{ key: 'squeezeTestMtpPos', label: '(+) Squeeze test (MTP)' }], tier: 'expanded' },
        ],
    },
    {
        key: 'msk_extremity',
        label: 'Extremity',
        parent: 'msk',
        findings: [],
    },

    {
        key: 'derm',
        label: 'Dermatological',
        findings: [
        { key: 'skinWarm', normal: 'Skin warm', abnormals: [{ key: 'coolClammy', label: 'Cool/clammy' }], tier: 'baseline' },
        { key: 'skinDry', normal: 'Skin dry', abnormals: [{ key: 'diaphoretic', label: 'Diaphoretic' }], tier: 'baseline' },
        { key: 'appropriateColor', normal: 'Appropriate color', abnormals: [
                { key: 'pallor', label: 'Pallor' },
                { key: 'cyanosisDerm', label: 'Cyanosis' },
                { key: 'jaundice', label: 'Jaundice' },
                { key: 'flushed', label: 'Flushed' },
                { key: 'mottled', label: 'Mottled' },
            ], tier: 'baseline' },
        { key: 'noRashes', normal: 'No rashes', abnormals: [
                { key: 'rashSpecify', label: 'Rash (specify)' },
                { key: 'erythema', label: 'Erythema' },
                { key: 'petechiae', label: 'Petechiae' },
            ], tier: 'baseline' },
        { key: 'noLesions', normal: 'No lesions', abnormals: [
                { key: 'lesionSpecify', label: 'Lesion (specify)' },
                { key: 'ecchymosis', label: 'Ecchymosis' },
                { key: 'woundSpecify', label: 'Wound (specify)' },
                { key: 'abscessDerm', label: 'Abscess' },
                { key: 'cellulitis', label: 'Cellulitis' },
            ], tier: 'baseline' },
        { key: 'localized', normal: 'Localized', abnormals: [
                { key: 'diffuseWidespread', label: 'Diffuse/widespread' },
                { key: 'bilateral', label: 'Bilateral' },
                { key: 'dermatomal', label: 'Dermatomal' },
            ], tier: 'expanded' },
        { key: 'wellDemarcated', normal: 'Well-demarcated', abnormals: [], tier: 'expanded' },
        { key: 'smoothSurface', normal: 'Smooth surface', abnormals: [
                { key: 'scaling', label: 'Scaling' },
                { key: 'crusting', label: 'Crusting' },
                { key: 'weeping', label: 'Weeping' },
                { key: 'lichenified', label: 'Lichenified' },
                { key: 'indurated', label: 'Indurated' },
            ], tier: 'expanded' },
        { key: 'noSurroundingErythema', normal: 'No surrounding erythema', abnormals: [{ key: 'surroundingErythema', label: 'Surrounding erythema' }, { key: 'induration', label: 'Induration' }], tier: 'expanded' },
        { key: 'noWarmthDerm', normal: 'No warmth', abnormals: [{ key: 'warmthDerm', label: 'Warmth' }], tier: 'expanded' },
        { key: 'noSatelliteLesions', normal: 'No satellite lesions', abnormals: [{ key: 'satelliteLesions', label: 'Satellite lesions' }], tier: 'expanded' },
        { key: 'noLymphangiaticStreaking', normal: 'No lymphangitic streaking', abnormals: [{ key: 'lymphangiticStreaking', label: 'Lymphangitic streaking' }], tier: 'expanded' },
        { key: 'skinIntact', normal: 'Skin intact', abnormals: [
                { key: 'maceration', label: 'Maceration' },
                { key: 'frostbite', label: 'Frostbite (specify degree)' },
                { key: 'burn', label: 'Burn (specify degree)' },
            ], tier: 'expanded' },
        ],
    },

    {
        key: 'neuro',
        label: 'Neurological',
        findings: [
        { key: 'aoX4', normal: 'A&Ox4', abnormals: [{ key: 'disorientedSpecify', label: 'Disoriented (specify)' }, { key: 'confused', label: 'Confused' }], tier: 'baseline' },
        { key: 'cnIiXiiGrosslyIntact', normal: 'CN II-XII grossly intact', abnormals: [{ key: 'cnDeficitSpecify', label: 'CN deficit (specify)' }, { key: 'facialAsymmetry', label: 'Facial asymmetry' }], tier: 'baseline' },
        { key: 'normalGait', normal: 'Normal gait', abnormals: [{ key: 'ataxicGait', label: 'Ataxic gait' }, { key: 'rombergPositive', label: 'Romberg positive' }], tier: 'baseline' },
        { key: 'noFacialAsymmetry', normal: 'No facial asymmetry', abnormals: [{ key: 'facialAsymmetryExp', label: 'Facial asymmetry' }], tier: 'expanded' },
        { key: 'visualFieldsIntact', normal: 'Visual fields intact', abnormals: [{ key: 'visualFieldDeficitNeuro', label: 'Visual field deficit' }], tier: 'expanded' },
        { key: 'hearingIntact', normal: 'Hearing intact', abnormals: [{ key: 'hearingDeficit', label: 'Hearing deficit' }], tier: 'expanded' },
        { key: 'tongueMidline', normal: 'Tongue midline', abnormals: [{ key: 'tongueDeviation', label: 'Tongue deviation' }], tier: 'expanded' },
        { key: 'strength55AllExt', normal: '5/5 strength all extremities', abnormals: [{ key: 'focalWeaknessSpecify', label: 'Focal weakness (specify)' }], tier: 'expanded' },
        { key: 'normalTone', normal: 'Normal tone', abnormals: [{ key: 'increasedTone', label: 'Increased tone' }, { key: 'decreasedTone', label: 'Decreased tone' }], tier: 'expanded' },
        { key: 'noFasciculations', normal: 'No fasciculations', abnormals: [{ key: 'fasciculations', label: 'Fasciculations' }], tier: 'expanded' },
        { key: 'noTremor', normal: 'No tremor', abnormals: [{ key: 'tremor', label: 'Tremor' }], tier: 'expanded' },
        { key: 'intactToLightTouch', normal: 'Intact to light touch', abnormals: [
                { key: 'decreasedSensationSpecify', label: 'Decreased sensation (specify)' },
                { key: 'numbnessSensory', label: 'Numbness' },
                { key: 'paresthesiasSensory', label: 'Paresthesias' },
                { key: 'dermatomalLossSensory', label: 'Dermatomal loss' },
            ], tier: 'expanded' },
        { key: 'twoPlusSymmetric', normal: '2+ symmetric throughout', abnormals: [
                { key: 'hyperreflexiaF', label: 'Hyperreflexia' },
                { key: 'hyporeflexiaF', label: 'Hyporeflexia' },
                { key: 'areflexiaF', label: 'Areflexia' },
                { key: 'asymmetricReflexesF', label: 'Asymmetric reflexes' },
            ], tier: 'expanded' },
        { key: 'babinskiDowngoing', normal: 'Babinski downgoing b/l', abnormals: [{ key: 'babinskiUpgoing', label: 'Babinski upgoing' }, { key: 'clonus', label: 'Clonus' }], tier: 'expanded' },
        { key: 'fingerToNoseIntact', normal: 'Finger-to-nose intact', abnormals: [{ key: 'dysmetria', label: 'Dysmetria' }, { key: 'dysdiadochokinesia', label: 'Dysdiadochokinesia' }], tier: 'expanded' },
        { key: 'rombergNegative', normal: 'Romberg negative', abnormals: [{ key: 'rombergPositiveExp', label: 'Romberg positive' }], tier: 'expanded' },
        ],
    },

    {
        key: 'psych',
        label: 'Psychiatric',
        findings: [
        { key: 'appropriateMood', normal: 'Appropriate mood', abnormals: [{ key: 'depressedMood', label: 'Depressed mood' }, { key: 'anxious', label: 'Anxious' }], tier: 'baseline' },
        { key: 'appropriateAffect', normal: 'Appropriate affect', abnormals: [{ key: 'flatAffect', label: 'Flat affect' }, { key: 'labileAffect', label: 'Labile affect' }], tier: 'baseline' },
        { key: 'intactJudgment', normal: 'Intact judgment', abnormals: [{ key: 'poorJudgment', label: 'Poor judgment' }], tier: 'expanded' },
        { key: 'intactInsight', normal: 'Intact insight', abnormals: [{ key: 'poorInsight', label: 'Poor insight' }], tier: 'expanded' },
        { key: 'noSiHi', normal: 'No SI/HI', abnormals: [{ key: 'siHiSpecify', label: 'SI/HI (specify)' }], tier: 'expanded' },
        { key: 'alertAndOrientedX4Psych', normal: 'Alert and oriented x4', abnormals: [{ key: 'confusedPsych', label: 'Confused' }, { key: 'amsPsych', label: 'AMS' }], tier: 'expanded' },
        { key: 'gcs15', normal: 'GCS 15', abnormals: [{ key: 'gcsLt15', label: 'GCS < 15 (specify)' }], tier: 'expanded' },
        { key: 'cooperative', normal: 'Cooperative', abnormals: [{ key: 'lethargicPsych', label: 'Lethargic' }, { key: 'combative', label: 'Combative' }], tier: 'expanded' },
        ],
    },

    {
        key: 'extremities',
        label: 'Extremities',
        findings: [
        { key: 'pulses2PlusEqual', normal: 'Pulses 2+ equal', abnormals: [{ key: 'diminishedPulsesExt', label: 'Diminished pulses' }, { key: 'absentPulsesExt', label: 'Absent pulses' }], tier: 'baseline' },
        { key: 'noEdemaExt', normal: 'No edema', abnormals: [{ key: 'edemaSpecify', label: 'Edema (specify)' }], tier: 'baseline' },
        { key: 'noDiscoloration', normal: 'No discoloration', abnormals: [{ key: 'discoloration', label: 'Discoloration' }, { key: 'cyanosisExt', label: 'Cyanosis' }], tier: 'baseline' },
        { key: 'capRefillLt3SecExt', normal: 'Cap refill < 3 sec', abnormals: [{ key: 'delayedCapRefillExt', label: 'Delayed cap refill' }], tier: 'expanded' },
        { key: 'warm', normal: 'Warm', abnormals: [{ key: 'coolExtremitiesExt', label: 'Cool extremities' }], tier: 'expanded' },
        { key: 'noClubbing', normal: 'No clubbing', abnormals: [{ key: 'clubbing', label: 'Clubbing' }], tier: 'expanded' },
        { key: 'intactToLightTouchExt', normal: 'Intact to light touch', abnormals: [
                { key: 'decreasedSensationExt', label: 'Decreased sensation' },
                { key: 'numbnessExt', label: 'Numbness' },
                { key: 'tinglingExt', label: 'Tingling' },
            ], tier: 'expanded' },
        { key: 'afebrile', normal: 'Afebrile', abnormals: [{ key: 'hypothermic', label: 'Hypothermic' }, { key: 'hyperthermic', label: 'Hyperthermic' }], tier: 'expanded' },
        ],
    },

    {
        key: 'gu',
        label: 'Genitourinary',
        findings: [
        { key: 'normalAppearance', normal: 'Normal appearance', abnormals: [{ key: 'lesionUlcer', label: 'Lesion/ulcer' }], tier: 'baseline' },
        { key: 'noDischargeGu', normal: 'No discharge', abnormals: [{ key: 'discharge', label: 'Discharge' }], tier: 'baseline' },
        { key: 'noSwellingGu', normal: 'No swelling', abnormals: [{ key: 'swellingGu', label: 'Swelling' }], tier: 'baseline' },
        { key: 'noErythemaGu', normal: 'No erythema', abnormals: [{ key: 'erythemaGu', label: 'Erythema' }], tier: 'baseline' },
        { key: 'noInguinalHernia', normal: 'No inguinal hernia', abnormals: [{ key: 'inguinalHernia', label: 'Inguinal hernia' }], tier: 'expanded' },
        { key: 'noInguinalLad', normal: 'No inguinal LAD', abnormals: [{ key: 'inguinalLad', label: 'Inguinal LAD' }], tier: 'expanded' },
        { key: 'noSuprapubicTenderness', normal: 'No suprapubic tenderness', abnormals: [{ key: 'suprapubicTenderness', label: 'Suprapubic tenderness' }], tier: 'expanded' },
        { key: 'noCvaTendernessGu', normal: 'No CVA tenderness', abnormals: [
                { key: 'cvaTendernessRGu', label: 'CVA tenderness R' },
                { key: 'cvaTendernessLGu', label: 'CVA tenderness L' },
                { key: 'cvaTendernessBlGu', label: 'CVA tenderness b/l' },
            ], tier: 'expanded' },
        { key: 'noLesionsGen', normal: 'No lesions', abnormals: [{ key: 'lesionUlcerGen', label: 'Lesion/ulcer' }], tier: 'expanded' },
        { key: 'noDischargeGen', normal: 'No discharge', abnormals: [{ key: 'dischargeGen', label: 'Discharge' }], tier: 'expanded' },
        { key: 'twoTestesPalpated', normal: 'Two testes palpated in scrotum', abnormals: [], tier: 'expanded' },
        { key: 'noHerniaInguinal', normal: 'No hernia', abnormals: [{ key: 'inguinalHerniaExp', label: 'Inguinal hernia' }], tier: 'expanded' },
        ],
    },

    {
        key: 'breast',
        label: 'Breast',
        findings: [
        { key: 'symmetric', normal: 'Symmetric', abnormals: [{ key: 'asymmetry', label: 'Asymmetry' }], tier: 'baseline' },
        { key: 'noMassesBreast', normal: 'No masses', abnormals: [{ key: 'mass', label: 'Mass' }], tier: 'baseline' },
        { key: 'nonTenderBreast', normal: 'Non-tender', abnormals: [{ key: 'tenderness', label: 'Tenderness' }], tier: 'baseline' },
        { key: 'noDischargeBreast', normal: 'No discharge', abnormals: [{ key: 'dischargeBreast', label: 'Discharge' }], tier: 'expanded' },
        { key: 'normalSkin', normal: 'Normal skin', abnormals: [{ key: 'skinChanges', label: 'Skin changes' }], tier: 'expanded' },
        { key: 'noAxillaryLad', normal: 'No axillary LAD', abnormals: [{ key: 'axillaryLad', label: 'Axillary LAD' }], tier: 'expanded' },
        ],
    },

    {
        key: 'gyn',
        label: 'Gynecological',
        findings: [
        { key: 'normalAppearanceGyn', normal: 'Normal appearance', abnormals: [{ key: 'massGyn', label: 'Mass' }, { key: 'lesionUlcerGyn', label: 'Lesion/ulcer' }], tier: 'expanded' },
        { key: 'noErythemaGyn', normal: 'No erythema', abnormals: [{ key: 'erythemaGyn', label: 'Erythema' }], tier: 'expanded' },
        { key: 'noEdemaGyn', normal: 'No edema', abnormals: [{ key: 'edemaGyn', label: 'Edema' }], tier: 'expanded' },
        { key: 'noDischargeGyn', normal: 'No discharge', abnormals: [{ key: 'dischargeGyn', label: 'Discharge' }], tier: 'expanded' },
        { key: 'cervixAppearsNormal', normal: 'Cervix appears normal', abnormals: [{ key: 'cervicalLesion', label: 'Cervical lesion' }, { key: 'friableCervix', label: 'Friable cervix' }], tier: 'expanded' },
        { key: 'noCervicalMotionTenderness', normal: 'No cervical motion tenderness', abnormals: [{ key: 'cervicalMotionTenderness', label: 'Cervical motion tenderness' }], tier: 'expanded' },
        { key: 'noAbnormalDischarge', normal: 'No abnormal discharge', abnormals: [{ key: 'abnormalDischarge', label: 'Abnormal discharge' }, { key: 'bleeding', label: 'Bleeding' }], tier: 'expanded' },
        { key: 'nonTenderUterus', normal: 'Non-tender', abnormals: [{ key: 'uterineTenderness', label: 'Uterine tenderness' }, { key: 'adnexalTenderness', label: 'Adnexal tenderness' }], tier: 'expanded' },
        { key: 'normalSize', normal: 'Normal size', abnormals: [{ key: 'enlargedUterus', label: 'Enlarged uterus' }], tier: 'expanded' },
        { key: 'noAdnexalMasses', normal: 'No adnexal masses', abnormals: [{ key: 'adnexalMass', label: 'Adnexal mass' }], tier: 'expanded' },
        ],
    },

    {
        key: 'lymph',
        label: 'Lymph Nodes',
        findings: [
        { key: 'noCervicalLad', normal: 'No cervical LAD', abnormals: [{ key: 'cervicalLadLymph', label: 'Cervical LAD' }], tier: 'baseline' },
        { key: 'noAxillaryLadLymph', normal: 'No axillary LAD', abnormals: [{ key: 'axillaryLadLymph', label: 'Axillary LAD' }], tier: 'baseline' },
        { key: 'noInguinalLadLymph', normal: 'No inguinal LAD', abnormals: [{ key: 'inguinalLadLymph', label: 'Inguinal LAD' }], tier: 'expanded' },
        { key: 'noGeneralizedLad', normal: 'No generalized LAD', abnormals: [
                { key: 'generalizedLad', label: 'Generalized LAD' },
                { key: 'tenderLad', label: 'Tender LAD' },
                { key: 'mattedNodes', label: 'Matted nodes' },
                { key: 'supraclavicularLadLymph', label: 'Supraclavicular LAD' },
            ], tier: 'expanded' },
        ],
    },

    {
        key: 'rectal',
        label: 'Rectal',
        findings: [
        { key: 'deferredNotIndicated', normal: 'Deferred -- not indicated', abnormals: [
                { key: 'hemorrhoids', label: 'Hemorrhoids' },
                { key: 'fissure', label: 'Fissure' },
                { key: 'massRectal', label: 'Mass' },
                { key: 'occultBloodPositive', label: 'Occult blood positive' },
                { key: 'tendernessRectal', label: 'Tenderness' },
                { key: 'rectalToneAbnormal', label: 'Rectal tone abnormal' },
            ], tier: 'baseline' },
        ],
    },

];

export const MASTER_BLOCK_LIBRARY: Record<string, MasterPEBlock> = Object.fromEntries(
    MASTER_BLOCKS.map(b => [b.key, b])
);

export function getMasterBlocks(): MasterPEBlock[] { return MASTER_BLOCKS; }
export function getMasterBlockByKey(key: string): MasterPEBlock | undefined { return MASTER_BLOCK_LIBRARY[key]; }

/** MSK child block keys, ordered anatomically top-to-bottom */
export const MSK_CHILD_KEYS: string[] = MASTER_BLOCKS
    .filter(b => b.parent === 'msk')
    .map(b => b.key);

/** Set of all MSK child block keys for quick lookup */
export const MSK_CHILD_KEY_SET: Set<string> = new Set(MSK_CHILD_KEYS);

/** Top-level blocks only (excludes MSK children) — used by block pickers that show children separately */
export const MASTER_BLOCKS_TOP_LEVEL: MasterPEBlock[] = MASTER_BLOCKS.filter(b => !b.parent);

/** Map symptom code (e.g. 'B-3') to the corresponding MSK child block key */
const SYMPTOM_TO_MSK_CHILD: Record<string, string> = {
    'B-1': 'msk_back',
    'B-2': 'msk_neck',
    'B-3': 'msk_shoulder',
    'B-4': 'msk_elbow',
    'B-5': 'msk_wrist',
    'B-6': 'msk_hand',
    'B-7': 'msk_hip',
    'B-8': 'msk_knee',
    'B-9': 'msk_ankle',
    'B-10': 'msk_foot',
    'B-11': 'msk_extremity',
};

export function getMSKChildKey(symptomCode: string): string | null {
    const dashCode = symptomCode.includes('-') ? symptomCode : symptomCode.replace(/([A-M])(\d+)/, '$1-$2');
    return SYMPTOM_TO_MSK_CHILD[dashCode] ?? null;
}

// ── Focused exam layout ──────────────────────────────────────

/** Baseline wrapper blocks shown before the focused blocks (baseline findings only). */
export const BASELINE_BEFORE: string[] = ['gen', 'head', 'eyes'];

/** Baseline wrapper blocks shown after the focused blocks (baseline findings only). */
export const BASELINE_AFTER: string[] = ['neuro', 'psych'];

/** Category-specific blocks to show in focused mode (all findings expanded). */
export const FOCUSED_EXPANSION: Record<CategoryLetter, string[]> = {
    A: ['ears', 'nose', 'oral_throat', 'neck', 'cv', 'pulm'],
    B: ['msk'],  // Base; getBlocksForFocusedExam resolves the child block from symptomCode
    C: ['abd', 'rectal'],
    D: ['cv', 'pulm'],
    E: ['abd', 'gu'],
    F: ['neuro', 'psych'],
    G: ['gen', 'derm', 'cv', 'pulm'],
    H: ['eyes'],
    I: ['breast', 'gyn'],
    J: ['derm'],
    K: ['extremities', 'derm', 'psych'],
    L: ['gen', 'oral_throat', 'lymph'],
    M: ['gen'],
};

/**
 * Get blocks for a focused exam — bookend layout:
 * [baseline-before] → [category-specific expanded] → [baseline-after]
 *
 * - Baseline-before/after blocks show only `tier: 'baseline'` findings
 * - Category-specific blocks show ALL findings (baseline + expanded)
 * - If a baseline block also appears in the expansion list, it's promoted to fully expanded
 *   and removed from its baseline position to avoid duplication
 */
export function getBlocksForFocusedExam(category: CategoryLetter, symptomCode?: string): {
    blocks: MasterPEBlock[];
    expandedKeys: Set<string>;
} {
    let expansionKeys = FOCUSED_EXPANSION[category] || [];

    // For category B, resolve the MSK child block from symptom code
    if (category === 'B' && symptomCode) {
        const childKey = getMSKChildKey(symptomCode);
        if (childKey) {
            expansionKeys = [...expansionKeys, childKey];
        }
    }
    const expandedSet = new Set(expansionKeys);

    // Collect unique block keys in order: before → focused → after
    // If a baseline block also appears in expansion, skip it from baseline position
    const orderedKeys: string[] = [];
    const seen = new Set<string>();

    for (const key of BASELINE_BEFORE) {
        if (!expandedSet.has(key) && !seen.has(key)) {
            orderedKeys.push(key);
            seen.add(key);
        }
    }
    for (const key of expansionKeys) {
        if (!seen.has(key)) {
            orderedKeys.push(key);
            seen.add(key);
        }
    }
    for (const key of BASELINE_AFTER) {
        if (!expandedSet.has(key) && !seen.has(key)) {
            orderedKeys.push(key);
            seen.add(key);
        }
    }

    const blocks = orderedKeys
        .map(k => MASTER_BLOCK_LIBRARY[k])
        .filter((b): b is MasterPEBlock => b !== undefined);

    return { blocks, expandedKeys: expandedSet };
}

/** Get blocks for a provider template — returns only the selected master blocks (all findings shown) */
export function getBlocksForTemplate(keys: string[]): MasterPEBlock[] {
    return keys.map(k => MASTER_BLOCK_LIBRARY[k]).filter((b): b is MasterPEBlock => b !== undefined);
}

// ══════════════════════════════════════════════════════════════
// @deprecated — Legacy data below. Use MASTER_BLOCKS instead.
// Kept for backward compatibility during migration.
// ══════════════════════════════════════════════════════════════

/** @deprecated Use MASTER_BLOCKS */
export const BASELINE_BEFORE_COUNT = 3;

/** @deprecated Use MASTER_BLOCKS */
export const BASELINE_WRAPPERS: PEBlock[] = [
    {
        key: 'bl_gen',
        label: 'GEN',
        findings: [
            { key: 'appearsStatedAge', normal: 'Appears stated age', abnormals: [] },
            { key: 'wnwd', normal: 'WNWD', abnormals: [
                { key: 'thinAppearing', label: 'Thin appearing' },
                { key: 'excessiveAbdominalAdiposity', label: 'Excessive abdominal adiposity' },
            ] },
            { key: 'noAcuteDistress', normal: 'No acute distress', abnormals: [
                { key: 'acuteDistress', label: 'Acute distress' },
                { key: 'mildDistress', label: 'Mild distress' },
                { key: 'moderateDistress', label: 'Moderate distress' },
            ] },
        ],
    },
    {
        key: 'bl_eyes',
        label: 'EYES',
        findings: [
            { key: 'perrl', normal: 'PERRL', abnormals: [
                { key: 'anisocoria', label: 'Anisocoria' },
                { key: 'fixedPupil', label: 'Fixed pupil' },
                { key: 'dilatedPupil', label: 'Dilated pupil' },
                { key: 'constrictedPupil', label: 'Constricted pupil' },
                { key: 'apdPresent', label: 'APD present' },
            ] },
            { key: 'eomi', normal: 'EOMI', abnormals: [
                { key: 'restrictedEom', label: 'Restricted EOM' },
                { key: 'nystagmus', label: 'Nystagmus' },
                { key: 'diplopia', label: 'Diplopia' },
            ] },
            { key: 'vffc', normal: 'VFFC', abnormals: [
                { key: 'visualFieldDeficit', label: 'Visual field deficit' },
            ] },
        ],
    },
    {
        key: 'bl_hent',
        label: 'HENT',
        findings: [
            { key: 'normocephalicAtraumatic', normal: 'NCAT', abnormals: [
                { key: 'scalpTenderness', label: 'Scalp tenderness' },
                { key: 'scalpLaceration', label: 'Scalp laceration' },
            ] },
        ],
    },
    {
        key: 'bl_neuro',
        label: 'NEURO',
        findings: [
            { key: 'aoX4', normal: 'A&Ox4', abnormals: [
                { key: 'disorientedSpecify', label: 'Disoriented (specify)' },
                { key: 'confused', label: 'Confused' },
            ] },
            { key: 'cnIiXiiGrosslyIntact', normal: 'CN II-XII grossly intact', abnormals: [
                { key: 'cnDeficitSpecify', label: 'CN deficit (specify)' },
                { key: 'facialAsymmetry', label: 'Facial asymmetry' },
            ] },
            { key: 'normalGait', normal: 'Normal gait', abnormals: [
                { key: 'ataxicGait', label: 'Ataxic gait' },
                { key: 'rombergPositive', label: 'Romberg positive' },
            ] },
        ],
    },
    {
        key: 'bl_psych',
        label: 'PSYCH',
        findings: [
            { key: 'appropriateMood', normal: 'Appropriate mood', abnormals: [
                { key: 'depressedMood', label: 'Depressed mood' },
                { key: 'anxious', label: 'Anxious' },
            ] },
            { key: 'appropriateAffect', normal: 'Appropriate affect', abnormals: [
                { key: 'flatAffect', label: 'Flat affect' },
                { key: 'labileAffect', label: 'Labile affect' },
            ] },
        ],
    },
];

/** @deprecated Use MASTER_BLOCKS */
export const SYSTEM_BLOCKS: PEBlock[] = [
    {
        key: 'sys_ears',
        label: 'Ears',
        findings: [
            {
                key: 'pinnaNormalNontender',
                normal: 'Pinna normal, nontender',
                abnormals: [
                    { key: 'pinnaTenderness', label: 'Pinna tenderness' },
                    { key: 'tragalTenderness', label: 'Tragal tenderness' },
                ],
            },
            {
                key: 'mastoidNontender',
                normal: 'Mastoid nontender',
                abnormals: [
                    { key: 'mastoidTtp', label: 'Mastoid TTP' },
                ],
            },
            {
                key: 'eacClear',
                normal: 'EAC clear',
                abnormals: [
                    { key: 'eacErythema', label: 'EAC erythema' },
                ],
            },
            {
                key: 'tmIntact',
                normal: 'TM intact',
                abnormals: [
                    { key: 'tmErythema', label: 'TM erythema' },
                    { key: 'tmBulging', label: 'TM bulging' },
                    { key: 'tmPerforation', label: 'TM perforation' },
                    { key: 'tmEffusion', label: 'TM effusion' },
                ],
            },
            {
                key: 'normalLightReflex',
                normal: 'Normal light reflex',
                abnormals: [
                    { key: 'landmarksDistorted', label: 'Landmarks distorted' },
                ],
            },
            {
                key: 'tmNotErythematous',
                normal: 'TM not erythematous',
                abnormals: [
                    { key: 'tmErythemaB', label: 'TM erythema' },
                ],
            },
            {
                key: 'tmMobile',
                normal: 'TM mobile',
                abnormals: [
                    { key: 'tmImmobile', label: 'TM immobile' },
                ],
            },
            {
                key: 'canalClear',
                normal: 'Canal clear',
                abnormals: [
                    { key: 'cerumenImpaction', label: 'Cerumen impaction' },
                ],
            },
        ],
    },
    {
        key: 'sys_nose',
        label: 'Nose',
        findings: [
            {
                key: 'noExternalDeformities',
                normal: 'No external deformities',
                abnormals: [],
            },
            {
                key: 'noNasalDischarge',
                normal: 'No nasal discharge',
                abnormals: [
                    { key: 'purulentDischarge', label: 'Purulent discharge' },
                    { key: 'clearRhinorrhea', label: 'Clear rhinorrhea' },
                    { key: 'epistaxis', label: 'Epistaxis' },
                ],
            },
            {
                key: 'septumMidline',
                normal: 'Septum midline',
                abnormals: [
                    { key: 'septalDeviation', label: 'Septal deviation' },
                ],
            },
            {
                key: 'mucosaPink',
                normal: 'Mucosa pink',
                abnormals: [
                    { key: 'mucosalErythema', label: 'Mucosal erythema' },
                ],
            },
            {
                key: 'turbinatesNotSwollen',
                normal: 'Turbinates not swollen',
                abnormals: [
                    { key: 'turbinateHypertrophy', label: 'Turbinate hypertrophy' },
                ],
            },
            {
                key: 'noSinusTenderness',
                normal: 'No sinus tenderness',
                abnormals: [
                    { key: 'frontalSinusTenderness', label: 'Frontal sinus tenderness' },
                    { key: 'maxillarySinusTenderness', label: 'Maxillary sinus tenderness' },
                ],
            },
        ],
    },
    {
        key: 'sys_oral',
        label: 'Oral Cavity',
        findings: [
            {
                key: 'mucosaMoistAndClear',
                normal: 'Mucosa moist and clear',
                abnormals: [
                    { key: 'dryMucousMembranes', label: 'Dry mucous membranes' },
                    { key: 'thrush', label: 'Thrush' },
                ],
            },
            {
                key: 'noMassesOrLesions',
                normal: 'No masses or lesions',
                abnormals: [
                    { key: 'oralLesionUlcer', label: 'Oral lesion/ulcer' },
                    { key: 'abscess', label: 'Abscess' },
                ],
            },
            {
                key: 'dentitionIntact',
                normal: 'Dentition intact',
                abnormals: [
                    { key: 'poorDentition', label: 'Poor dentition' },
                    { key: 'dentalCaries', label: 'Dental caries' },
                ],
            },
            {
                key: 'gingivaHealthy',
                normal: 'Gingiva healthy',
                abnormals: [
                    { key: 'gingivalErythema', label: 'Gingival erythema' },
                    { key: 'gingivalBleeding', label: 'Gingival bleeding' },
                ],
            },
            {
                key: 'lipsNormal',
                normal: 'Lips normal',
                abnormals: [
                    { key: 'lipLesion', label: 'Lip lesion' },
                ],
            },
        ],
    },
    {
        key: 'sys_pharynx',
        label: 'Pharynx',
        findings: [
            {
                key: 'noErythema',
                normal: 'No erythema',
                abnormals: [
                    { key: 'pharyngealErythema', label: 'Pharyngeal erythema' },
                ],
            },
            {
                key: 'noPndOrDrainage',
                normal: 'No PND or drainage',
                abnormals: [
                    { key: 'pndPresent', label: 'PND present' },
                    { key: 'cobblestoning', label: 'Cobblestoning' },
                ],
            },
            {
                key: 'tonsilsGrade1',
                normal: 'Tonsils Grade 1',
                abnormals: [
                    { key: 'tonsillarHypertrophyGrade2', label: 'Tonsillar hypertrophy (Grade 2)' },
                    { key: 'tonsillarHypertrophyGrade3', label: 'Tonsillar hypertrophy (Grade 3)' },
                    { key: 'tonsillarHypertrophyGrade4', label: 'Tonsillar hypertrophy (Grade 4)' },
                ],
            },
            {
                key: 'symmetricMidlineUvula',
                normal: 'Symmetric, midline uvula',
                abnormals: [
                    { key: 'uvularDeviation', label: 'Uvular deviation' },
                    { key: 'peritonsillarSwelling', label: 'Peritonsillar swelling' },
                ],
            },
            {
                key: 'noTonsillarExudate',
                normal: 'No tonsillar exudate',
                abnormals: [
                    { key: 'tonsillarExudate', label: 'Tonsillar exudate' },
                ],
            },
        ],
    },
    {
        key: 'sys_neck',
        label: 'Neck',
        findings: [
            {
                key: 'supple',
                normal: 'Supple',
                abnormals: [
                    { key: 'meningismus', label: 'Meningismus' },
                ],
            },
            {
                key: 'nonTender',
                normal: 'Non-tender',
                abnormals: [
                    { key: 'ttp', label: 'TTP' },
                ],
            },
            {
                key: 'noLymphadenopathy',
                normal: 'No lymphadenopathy',
                abnormals: [
                    { key: 'cervicalLad', label: 'Cervical LAD' },
                    { key: 'preauricularLad', label: 'Preauricular LAD' },
                    { key: 'supraclavicularLad', label: 'Supraclavicular LAD' },
                ],
            },
            {
                key: 'noCarotidBruits',
                normal: 'No carotid bruits',
                abnormals: [
                    { key: 'carotidBruitR', label: 'Carotid bruit R' },
                    { key: 'carotidBruitL', label: 'Carotid bruit L' },
                    { key: 'carotidBruitBl', label: 'Carotid bruit b/l' },
                ],
            },
            {
                key: 'noJvd',
                normal: 'No JVD',
                abnormals: [
                    { key: 'jvdNoted', label: 'JVD noted' },
                ],
            },
            {
                key: 'tracheaMidline',
                normal: 'Trachea midline',
                abnormals: [
                    { key: 'trachealDeviation', label: 'Tracheal deviation' },
                ],
            },
            {
                key: 'thyroidNonEnlarged',
                normal: 'Thyroid non-enlarged',
                abnormals: [
                    { key: 'thyromegaly', label: 'Thyromegaly' },
                ],
            },
            {
                key: 'fullRom',
                normal: 'Full ROM',
                abnormals: [
                    { key: 'limitedRom', label: 'Limited ROM' },
                ],
            },
        ],
    },
    {
        key: 'sys_cv',
        label: 'CV',
        findings: [
            {
                key: 'normalRate',
                normal: 'Normal rate',
                abnormals: [
                    { key: 'tachycardia', label: 'Tachycardia' },
                    { key: 'bradycardia', label: 'Bradycardia' },
                ],
            },
            {
                key: 'regularRhythm',
                normal: 'Regular rhythm',
                abnormals: [
                    { key: 'irregularRhythm', label: 'Irregular rhythm' },
                ],
            },
            {
                key: 'noMurmur',
                normal: 'No murmur',
                abnormals: [
                    { key: 'murmurSpecify', label: 'Murmur (specify)' },
                ],
            },
            {
                key: 'noRub',
                normal: 'No rub',
                abnormals: [
                    { key: 'rub', label: 'Rub' },
                ],
            },
            {
                key: 'noGallop',
                normal: 'No gallop',
                abnormals: [
                    { key: 'gallopS3', label: 'Gallop (S3)' },
                    { key: 'gallopS4', label: 'Gallop (S4)' },
                ],
            },
            {
                key: 'pulses2PlusEqualBilaterally',
                normal: 'Pulses 2+ equal bilaterally',
                abnormals: [
                    { key: 'diminishedPulses', label: 'Diminished pulses' },
                    { key: 'absentPulses', label: 'Absent pulses' },
                ],
            },
            {
                key: 'capRefillLt3Sec',
                normal: 'Cap refill < 3 sec',
                abnormals: [
                    { key: 'delayedCapRefill', label: 'Delayed cap refill' },
                ],
            },
            {
                key: 'noEdema',
                normal: 'No edema',
                abnormals: [
                    { key: 'peripheralEdema', label: 'Peripheral edema' },
                ],
            },
            {
                key: 'warmExtremities',
                normal: 'Warm extremities',
                abnormals: [
                    { key: 'coolExtremities', label: 'Cool extremities' },
                    { key: 'cyanosis', label: 'Cyanosis' },
                ],
            },
        ],
    },
    {
        key: 'sys_pulm',
        label: 'Pulm',
        findings: [
            {
                key: 'ctaBilaterally',
                normal: 'CTA bilaterally',
                abnormals: [
                    { key: 'diminishedBreathSounds', label: 'Diminished breath sounds' },
                ],
            },
            {
                key: 'nonLaboredRespirations',
                normal: 'Non-labored respirations',
                abnormals: [
                    { key: 'tachypnea', label: 'Tachypnea' },
                ],
            },
            {
                key: 'noWheezes',
                normal: 'No wheezes',
                abnormals: [
                    { key: 'wheezing', label: 'Wheezing' },
                ],
            },
            {
                key: 'noRales',
                normal: 'No rales',
                abnormals: [
                    { key: 'ralesCrackles', label: 'Rales/crackles' },
                ],
            },
            {
                key: 'noRhonchi',
                normal: 'No rhonchi',
                abnormals: [
                    { key: 'rhonchi', label: 'Rhonchi' },
                ],
            },
            {
                key: 'noStridor',
                normal: 'No stridor',
                abnormals: [
                    { key: 'stridor', label: 'Stridor' },
                ],
            },
            {
                key: 'noPleuralRub',
                normal: 'No pleural rub',
                abnormals: [
                    { key: 'pleuralRub', label: 'Pleural rub' },
                ],
            },
            {
                key: 'noAccessoryMuscleUse',
                normal: 'No accessory muscle use',
                abnormals: [
                    { key: 'accessoryMuscleUse', label: 'Accessory muscle use' },
                    { key: 'retractions', label: 'Retractions' },
                    { key: 'nasalFlaring', label: 'Nasal flaring' },
                    { key: 'tripoding', label: 'Tripoding' },
                ],
            },
            {
                key: 'speakingFullSentences',
                normal: 'Speaking full sentences',
                abnormals: [
                    { key: 'speaksInFragments', label: 'Speaks in fragments' },
                ],
            },
        ],
    },
    {
        key: 'sys_abd',
        label: 'Abd',
        findings: [
            {
                key: 'soft',
                normal: 'Soft',
                abnormals: [
                    { key: 'rigidity', label: 'Rigidity' },
                ],
            },
            {
                key: 'nonTenderAbd',
                normal: 'Non-tender',
                abnormals: [
                    { key: 'ttpSpecifyLocation', label: 'TTP (specify location)' },
                ],
            },
            {
                key: 'nonDistended',
                normal: 'Non-distended',
                abnormals: [
                    { key: 'distended', label: 'Distended' },
                ],
            },
            {
                key: 'noMassesAbd',
                normal: 'No masses',
                abnormals: [
                    { key: 'massSpecify', label: 'Mass (specify)' },
                ],
            },
            {
                key: 'noGuarding',
                normal: 'No guarding',
                abnormals: [
                    { key: 'muscleGuarding', label: 'Muscle guarding' },
                    { key: 'reboundTenderness', label: 'Rebound tenderness' },
                ],
            },
            {
                key: 'bsPresentX4Quadrants',
                normal: 'BS present x 4 quadrants',
                abnormals: [
                    { key: 'hyperactiveBs', label: 'Hyperactive BS' },
                    { key: 'hypoactiveBs', label: 'Hypoactive BS' },
                    { key: 'absentBs', label: 'Absent BS' },
                ],
            },
            {
                key: 'noHepatomegaly',
                normal: 'No hepatomegaly',
                abnormals: [
                    { key: 'hepatomegaly', label: 'Hepatomegaly' },
                ],
            },
            {
                key: 'noSplenomegaly',
                normal: 'No splenomegaly',
                abnormals: [
                    { key: 'splenomegaly', label: 'Splenomegaly' },
                ],
            },
            {
                key: 'negMcBurneys',
                normal: "(-) McBurney's",
                abnormals: [
                    { key: 'posMcBurneysPoint', label: "(+) McBurney's point" },
                ],
            },
            {
                key: 'negPsoasSign',
                normal: '(-) Psoas sign',
                abnormals: [
                    { key: 'posPsoasSign', label: '(+) Psoas sign' },
                ],
            },
            {
                key: 'negMurphys',
                normal: "(-) Murphy's",
                abnormals: [
                    { key: 'posMurphysSign', label: "(+) Murphy's sign" },
                ],
            },
            {
                key: 'negObturator',
                normal: '(-) Obturator',
                abnormals: [
                    { key: 'posObturatorSign', label: '(+) Obturator sign' },
                ],
            },
            {
                key: 'negRovsings',
                normal: "(-) Rovsing's",
                abnormals: [
                    { key: 'posRovsingSign', label: "(+) Rovsing's sign" },
                ],
            },
            {
                key: 'noCvaTenderness',
                normal: 'No CVA tenderness',
                abnormals: [
                    { key: 'cvaTendernessR', label: 'CVA tenderness R' },
                    { key: 'cvaTendernessL', label: 'CVA tenderness L' },
                ],
            },
        ],
    },
    {
        key: 'sys_msk',
        label: 'MSK (General)',
        findings: [
            {
                key: 'normalRom',
                normal: 'Normal ROM',
                abnormals: [
                    { key: 'limitedRom', label: 'Limited ROM' },
                ],
            },
            {
                key: 'normalStrength',
                normal: 'Normal strength',
                abnormals: [
                    { key: 'decreasedStrength', label: 'Decreased strength' },
                ],
            },
            {
                key: 'nonTenderMsk',
                normal: 'Non-tender',
                abnormals: [
                    { key: 'ttpSpecify', label: 'TTP (specify)' },
                ],
            },
            {
                key: 'noSwelling',
                normal: 'No swelling',
                abnormals: [
                    { key: 'swelling', label: 'Swelling' },
                ],
            },
            {
                key: 'noDeformity',
                normal: 'No deformity',
                abnormals: [
                    { key: 'deformity', label: 'Deformity' },
                ],
            },
            {
                key: 'noCrepitus',
                normal: 'No crepitus',
                abnormals: [
                    { key: 'crepitus', label: 'Crepitus' },
                ],
            },
            {
                key: 'stable',
                normal: 'Stable',
                abnormals: [
                    { key: 'instability', label: 'Instability' },
                ],
            },
            {
                key: 'noAtrophy',
                normal: 'No atrophy',
                abnormals: [
                    { key: 'atrophy', label: 'Atrophy' },
                ],
            },
            {
                key: 'noSpasm',
                normal: 'No spasm',
                abnormals: [
                    { key: 'muscleSpasm', label: 'Muscle spasm' },
                ],
            },
            {
                key: 'normalGait',
                normal: 'Normal gait',
                abnormals: [
                    { key: 'antalgicGait', label: 'Antalgic gait' },
                ],
            },
        ],
    },
    {
        key: 'sys_derm',
        label: 'Derm',
        findings: [
            {
                key: 'skinWarm',
                normal: 'Skin warm',
                abnormals: [
                    { key: 'coolClammy', label: 'Cool/clammy' },
                ],
            },
            {
                key: 'skinDry',
                normal: 'Skin dry',
                abnormals: [
                    { key: 'diaphoretic', label: 'Diaphoretic' },
                ],
            },
            {
                key: 'appropriateColor',
                normal: 'Appropriate color',
                abnormals: [
                    { key: 'pallor', label: 'Pallor' },
                    { key: 'cyanosisDerm', label: 'Cyanosis' },
                    { key: 'jaundice', label: 'Jaundice' },
                ],
            },
            {
                key: 'noRashes',
                normal: 'No rashes',
                abnormals: [
                    { key: 'rashSpecify', label: 'Rash (specify)' },
                    { key: 'erythema', label: 'Erythema' },
                    { key: 'petechiae', label: 'Petechiae' },
                ],
            },
            {
                key: 'noLesions',
                normal: 'No lesions',
                abnormals: [
                    { key: 'lesionSpecify', label: 'Lesion (specify)' },
                    { key: 'ecchymosis', label: 'Ecchymosis' },
                    { key: 'woundSpecify', label: 'Wound (specify)' },
                    { key: 'abscessDerm', label: 'Abscess' },
                    { key: 'cellulitis', label: 'Cellulitis' },
                ],
            },
        ],
    },
    {
        key: 'sys_extremities',
        label: 'Extremities',
        findings: [
            {
                key: 'pulses2PlusEqual',
                normal: 'Pulses 2+ equal',
                abnormals: [
                    { key: 'diminishedPulsesExt', label: 'Diminished pulses' },
                    { key: 'absentPulsesExt', label: 'Absent pulses' },
                ],
            },
            {
                key: 'noEdemaExt',
                normal: 'No edema',
                abnormals: [
                    { key: 'edemaSpecify', label: 'Edema (specify)' },
                ],
            },
            {
                key: 'noDiscoloration',
                normal: 'No discoloration',
                abnormals: [
                    { key: 'discoloration', label: 'Discoloration' },
                    { key: 'cyanosisExt', label: 'Cyanosis' },
                ],
            },
            {
                key: 'capRefillLt3SecExt',
                normal: 'Cap refill < 3 sec',
                abnormals: [
                    { key: 'delayedCapRefillExt', label: 'Delayed cap refill' },
                ],
            },
            {
                key: 'warm',
                normal: 'Warm',
                abnormals: [
                    { key: 'coolExtremitiesExt', label: 'Cool extremities' },
                ],
            },
            {
                key: 'noClubbing',
                normal: 'No clubbing',
                abnormals: [
                    { key: 'clubbing', label: 'Clubbing' },
                ],
            },
        ],
    },
    {
        key: 'sys_gu',
        label: 'GU',
        findings: [
            {
                key: 'normalAppearance',
                normal: 'Normal appearance',
                abnormals: [
                    { key: 'lesionUlcer', label: 'Lesion/ulcer' },
                ],
            },
            {
                key: 'noDischargeGu',
                normal: 'No discharge',
                abnormals: [
                    { key: 'discharge', label: 'Discharge' },
                ],
            },
            {
                key: 'noSwellingGu',
                normal: 'No swelling',
                abnormals: [
                    { key: 'swellingGu', label: 'Swelling' },
                ],
            },
            {
                key: 'noErythemaGu',
                normal: 'No erythema',
                abnormals: [
                    { key: 'erythemaGu', label: 'Erythema' },
                ],
            },
            {
                key: 'noInguinalHernia',
                normal: 'No inguinal hernia',
                abnormals: [
                    { key: 'inguinalHernia', label: 'Inguinal hernia' },
                ],
            },
            {
                key: 'noInguinalLad',
                normal: 'No inguinal LAD',
                abnormals: [
                    { key: 'inguinalLad', label: 'Inguinal LAD' },
                ],
            },
            {
                key: 'noSuprapubicTenderness',
                normal: 'No suprapubic tenderness',
                abnormals: [
                    { key: 'suprapubicTenderness', label: 'Suprapubic tenderness' },
                ],
            },
            {
                key: 'noCvaTendernessGu',
                normal: 'No CVA tenderness',
                abnormals: [
                    { key: 'cvaTendernessRGu', label: 'CVA tenderness R' },
                    { key: 'cvaTendernessLGu', label: 'CVA tenderness L' },
                    { key: 'cvaTendernessBlGu', label: 'CVA tenderness b/l' },
                ],
            },
        ],
    },
    {
        key: 'sys_breast',
        label: 'Breast',
        findings: [
            {
                key: 'symmetric',
                normal: 'Symmetric',
                abnormals: [
                    { key: 'asymmetry', label: 'Asymmetry' },
                ],
            },
            {
                key: 'noMassesBreast',
                normal: 'No masses',
                abnormals: [
                    { key: 'mass', label: 'Mass' },
                ],
            },
            {
                key: 'nonTenderBreast',
                normal: 'Non-tender',
                abnormals: [
                    { key: 'tenderness', label: 'Tenderness' },
                ],
            },
            {
                key: 'noDischargeBreast',
                normal: 'No discharge',
                abnormals: [
                    { key: 'dischargeBreast', label: 'Discharge' },
                ],
            },
            {
                key: 'normalSkin',
                normal: 'Normal skin',
                abnormals: [
                    { key: 'skinChanges', label: 'Skin changes' },
                ],
            },
            {
                key: 'noAxillaryLad',
                normal: 'No axillary LAD',
                abnormals: [
                    { key: 'axillaryLad', label: 'Axillary LAD' },
                ],
            },
        ],
    },
    {
        key: 'sys_rectal',
        label: 'Rectal',
        findings: [
            {
                key: 'deferredNotIndicated',
                normal: 'Deferred — not indicated',
                abnormals: [
                    { key: 'hemorrhoids', label: 'Hemorrhoids' },
                    { key: 'fissure', label: 'Fissure' },
                    { key: 'massRectal', label: 'Mass' },
                    { key: 'occultBloodPositive', label: 'Occult blood positive' },
                    { key: 'tendernessRectal', label: 'Tenderness' },
                    { key: 'rectalToneAbnormal', label: 'Rectal tone abnormal' },
                ],
            },
        ],
    },
    {
        key: 'sys_lymph',
        label: 'Lymph',
        findings: [
            {
                key: 'noCervicalLad',
                normal: 'No cervical LAD',
                abnormals: [
                    { key: 'cervicalLadLymph', label: 'Cervical LAD' },
                ],
            },
            {
                key: 'noAxillaryLadLymph',
                normal: 'No axillary LAD',
                abnormals: [
                    { key: 'axillaryLadLymph', label: 'Axillary LAD' },
                ],
            },
            {
                key: 'noInguinalLadLymph',
                normal: 'No inguinal LAD',
                abnormals: [
                    { key: 'inguinalLadLymph', label: 'Inguinal LAD' },
                ],
            },
            {
                key: 'noGeneralizedLad',
                normal: 'No generalized LAD',
                abnormals: [
                    { key: 'generalizedLad', label: 'Generalized LAD' },
                    { key: 'tenderLad', label: 'Tender LAD' },
                    { key: 'mattedNodes', label: 'Matted nodes' },
                    { key: 'supraclavicularLadLymph', label: 'Supraclavicular LAD' },
                ],
            },
        ],
    },
];

// Focused Category Blocks A-F
// Each category is an array of PEBlock

// ── Category A — HEENT ────────────────────────────────────────────────────────

const FOCUSED_A: PEBlock[] = [
    {
        key: 'cat_a_ears',
        label: 'Ears',
        findings: [
            {
                key: 'tmsIntact',
                normal: 'TMs intact bilaterally',
                abnormals: [
                    { key: 'tmErythema', label: 'TM erythema' },
                    { key: 'tmBulging', label: 'TM bulging' },
                    { key: 'tmPerforation', label: 'TM perforation' },
                    { key: 'tmImmobile', label: 'TM immobile' },
                ],
            },
            {
                key: 'noTmErythema',
                normal: 'No TM erythema',
                abnormals: [
                    { key: 'tmErythemaAlt', label: 'TM erythema' },
                ],
            },
            {
                key: 'canalsClear',
                normal: 'Canals clear',
                abnormals: [
                    { key: 'canalEdema', label: 'Canal edema' },
                    { key: 'cerumenImpaction', label: 'Cerumen impaction' },
                ],
            },
            {
                key: 'noEffusion',
                normal: 'No effusion',
                abnormals: [
                    { key: 'effusion', label: 'Effusion' },
                ],
            },
            {
                key: 'pinnaNontender',
                normal: 'Pinna nontender',
                abnormals: [
                    { key: 'pinnaTenderness', label: 'Pinna tenderness' },
                    { key: 'tragalTenderness', label: 'Tragal tenderness' },
                ],
            },
        ],
    },
    {
        key: 'cat_a_nose',
        label: 'Nose',
        findings: [
            {
                key: 'naresPatent',
                normal: 'Nares patent bilaterally',
                abnormals: [],
            },
            {
                key: 'septumMidline',
                normal: 'Septum midline',
                abnormals: [
                    { key: 'septalDeviation', label: 'Septal deviation' },
                ],
            },
            {
                key: 'mucosaPinkMoist',
                normal: 'Mucosa pink and moist',
                abnormals: [
                    { key: 'mucosalErythema', label: 'Mucosal erythema' },
                ],
            },
            {
                key: 'noDischarge',
                normal: 'No discharge',
                abnormals: [
                    { key: 'purulentDischarge', label: 'Purulent discharge' },
                    { key: 'clearRhinorrhea', label: 'Clear rhinorrhea' },
                    { key: 'epistaxis', label: 'Epistaxis' },
                ],
            },
            {
                key: 'turbinatesNormal',
                normal: 'Turbinates normal',
                abnormals: [
                    { key: 'turbinateHypertrophy', label: 'Turbinate hypertrophy' },
                ],
            },
            {
                key: 'noSinusTenderness',
                normal: 'No sinus tenderness',
                abnormals: [
                    { key: 'sinusTenderness', label: 'Sinus tenderness' },
                ],
            },
        ],
    },
    {
        key: 'cat_a_throat',
        label: 'Throat',
        findings: [
            {
                key: 'pharynxNonErythematous',
                normal: 'Pharynx non-erythematous',
                abnormals: [
                    { key: 'pharyngealErythema', label: 'Pharyngeal erythema' },
                ],
            },
            {
                key: 'tonsilsNonEnlarged',
                normal: 'Tonsils non-enlarged',
                abnormals: [
                    { key: 'tonsillarHypertrophy', label: 'Tonsillar hypertrophy' },
                ],
            },
            {
                key: 'uvulaMidline',
                normal: 'Uvula midline',
                abnormals: [
                    { key: 'uvularDeviation', label: 'Uvular deviation' },
                ],
            },
            {
                key: 'noExudate',
                normal: 'No exudate',
                abnormals: [
                    { key: 'exudate', label: 'Exudate' },
                ],
            },
            {
                key: 'noPeritonsSwelling',
                normal: 'No peritonsillar swelling',
                abnormals: [
                    { key: 'peritonsillarSwelling', label: 'Peritonsillar swelling' },
                ],
            },
            {
                key: 'noCobblestoning',
                normal: 'No cobblestoning',
                abnormals: [
                    { key: 'cobblestoning', label: 'Cobblestoning' },
                ],
            },
        ],
    },
    {
        key: 'cat_a_oralCavity',
        label: 'Oral Cavity',
        findings: [
            {
                key: 'mucosaPinkMoistOral',
                normal: 'Mucosa pink and moist',
                abnormals: [
                    { key: 'dryMucousMembranes', label: 'Dry mucous membranes' },
                ],
            },
            {
                key: 'dentitionIntact',
                normal: 'Dentition intact',
                abnormals: [
                    { key: 'poorDentition', label: 'Poor dentition' },
                ],
            },
            {
                key: 'noLesions',
                normal: 'No lesions',
                abnormals: [
                    { key: 'oralLesionUlcer', label: 'Oral lesion/ulcer' },
                ],
            },
            {
                key: 'gingivaHealthy',
                normal: 'Gingiva healthy',
                abnormals: [
                    { key: 'gingivalErythema', label: 'Gingival erythema' },
                ],
            },
            {
                key: 'noThrush',
                normal: 'No thrush',
                abnormals: [
                    { key: 'thrush', label: 'Thrush' },
                ],
            },
        ],
    },
    {
        key: 'cat_a_neck',
        label: 'Neck',
        findings: [
            {
                key: 'neckSupple',
                normal: 'Neck supple',
                abnormals: [
                    { key: 'meningismus', label: 'Meningismus' },
                ],
            },
            {
                key: 'tracheaMidline',
                normal: 'Trachea midline',
                abnormals: [
                    { key: 'trachealDeviation', label: 'Tracheal deviation' },
                ],
            },
            {
                key: 'noLad',
                normal: 'No LAD',
                abnormals: [
                    { key: 'ladSpecify', label: 'LAD (specify)' },
                ],
            },
            {
                key: 'thyroidNonEnlarged',
                normal: 'Thyroid non-enlarged',
                abnormals: [
                    { key: 'thyromegaly', label: 'Thyromegaly' },
                ],
            },
            {
                key: 'fullRom',
                normal: 'Full ROM',
                abnormals: [
                    { key: 'limitedRom', label: 'Limited ROM' },
                ],
            },
            {
                key: 'noJvd',
                normal: 'No JVD',
                abnormals: [
                    { key: 'jvd', label: 'JVD' },
                ],
            },
        ],
    },
    {
        key: 'cat_a_cv',
        label: 'CV',
        findings: [
            {
                key: 'regularRateRhythm',
                normal: 'Regular rate and rhythm',
                abnormals: [
                    { key: 'irregularRhythm', label: 'Irregular rhythm' },
                    { key: 'tachycardia', label: 'Tachycardia' },
                    { key: 'bradycardia', label: 'Bradycardia' },
                ],
            },
            {
                key: 'noMurmurs',
                normal: 'No murmurs',
                abnormals: [
                    { key: 'murmur', label: 'Murmur' },
                ],
            },
            {
                key: 'noGallops',
                normal: 'No gallops',
                abnormals: [
                    { key: 'gallop', label: 'Gallop' },
                ],
            },
            {
                key: 'noRubs',
                normal: 'No rubs',
                abnormals: [],
            },
            {
                key: 'pulses2Plus',
                normal: 'Pulses 2+ bilaterally',
                abnormals: [
                    { key: 'diminishedPulses', label: 'Diminished pulses' },
                ],
            },
        ],
    },
    {
        key: 'cat_a_pulm',
        label: 'Pulm',
        findings: [
            {
                key: 'ctaBilat',
                normal: 'CTA bilaterally',
                abnormals: [
                    { key: 'diminishedBs', label: 'Diminished BS' },
                ],
            },
            {
                key: 'noWheezes',
                normal: 'No wheezes',
                abnormals: [
                    { key: 'wheezing', label: 'Wheezing' },
                ],
            },
            {
                key: 'noRales',
                normal: 'No rales',
                abnormals: [
                    { key: 'ralesCrackles', label: 'Rales/crackles' },
                ],
            },
            {
                key: 'noRhonchi',
                normal: 'No rhonchi',
                abnormals: [
                    { key: 'rhonchi', label: 'Rhonchi' },
                ],
            },
            {
                key: 'unlaboredRespirations',
                normal: 'Unlabored respirations',
                abnormals: [
                    { key: 'stridor', label: 'Stridor' },
                ],
            },
        ],
    },
];

// ── Category B — Musculoskeletal ──────────────────────────────────────────────

const FOCUSED_B: PEBlock[] = [
    {
        key: 'cat_b_inspection',
        label: 'Inspection',
        findings: [
            {
                key: 'noDeformity',
                normal: 'No deformity',
                abnormals: [
                    { key: 'deformity', label: 'Deformity' },
                    { key: 'stepOffDeformity', label: 'Step-off deformity' },
                ],
            },
            {
                key: 'noSwelling',
                normal: 'No swelling',
                abnormals: [
                    { key: 'swelling', label: 'Swelling' },
                    { key: 'edema', label: 'Edema' },
                ],
            },
            {
                key: 'noErythema',
                normal: 'No erythema',
                abnormals: [
                    { key: 'erythema', label: 'Erythema' },
                ],
            },
            {
                key: 'noEcchymosis',
                normal: 'No ecchymosis',
                abnormals: [
                    { key: 'ecchymosis', label: 'Ecchymosis' },
                ],
            },
            {
                key: 'normalPosture',
                normal: 'Normal posture',
                abnormals: [
                    { key: 'poorSlumpedPosture', label: 'Poor/slumped posture' },
                ],
            },
            {
                key: 'normalGait',
                normal: 'Normal gait',
                abnormals: [
                    { key: 'antalgicGait', label: 'Antalgic gait' },
                    { key: 'limbAtaxia', label: 'Limb ataxia' },
                ],
            },
            {
                key: 'symmetric',
                normal: 'Symmetric',
                abnormals: [
                    { key: 'asymmetry', label: 'Asymmetry' },
                    { key: 'atrophy', label: 'Atrophy' },
                ],
            },
        ],
    },
    {
        key: 'cat_b_palpation',
        label: 'Palpation',
        findings: [
            {
                key: 'nonTender',
                normal: 'Non-tender',
                abnormals: [
                    { key: 'pointTenderness', label: 'Point tenderness' },
                ],
            },
            {
                key: 'noCrepitus',
                normal: 'No crepitus',
                abnormals: [
                    { key: 'crepitus', label: 'Crepitus' },
                ],
            },
            {
                key: 'noMasses',
                normal: 'No masses',
                abnormals: [
                    { key: 'massSwelling', label: 'Mass/swelling' },
                ],
            },
            {
                key: 'noWarmth',
                normal: 'No warmth',
                abnormals: [
                    { key: 'warmth', label: 'Warmth' },
                ],
            },
            {
                key: 'noMuscleSpasm',
                normal: 'No muscle spasm',
                abnormals: [
                    { key: 'muscleSpasm', label: 'Muscle spasm' },
                ],
            },
            {
                key: 'noStepOff',
                normal: 'No step-off',
                abnormals: [
                    { key: 'stepOffDeformityPalp', label: 'Step-off deformity' },
                ],
            },
            {
                key: 'noEffusionPalp',
                normal: 'No effusion',
                abnormals: [
                    { key: 'effusionPalp', label: 'Effusion' },
                ],
            },
        ],
    },
    {
        key: 'cat_b_rom',
        label: 'ROM',
        findings: [
            {
                key: 'fullActiveRom',
                normal: 'Full active ROM',
                abnormals: [
                    { key: 'decreasedActiveRom', label: 'Decreased active ROM' },
                ],
            },
            {
                key: 'fullPassiveRom',
                normal: 'Full passive ROM',
                abnormals: [
                    { key: 'decreasedPassiveRom', label: 'Decreased passive ROM' },
                ],
            },
            {
                key: 'noPainWithMovement',
                normal: 'No pain with movement',
                abnormals: [
                    { key: 'painWithRom', label: 'Pain with ROM' },
                ],
            },
            {
                key: 'noMechanicalBlock',
                normal: 'No mechanical block',
                abnormals: [
                    { key: 'mechanicalBlock', label: 'Mechanical block' },
                ],
            },
            {
                key: 'hamstringsSupple',
                normal: 'Hamstrings supple',
                abnormals: [
                    { key: 'tightHamstrings', label: 'Tight hamstrings b/l' },
                ],
            },
        ],
    },
    {
        key: 'cat_b_strength',
        label: 'Strength',
        findings: [
            {
                key: 'strength55',
                normal: '5/5 strength',
                abnormals: [
                    { key: 'decreasedStrength', label: 'Decreased strength (specify grade)' },
                ],
            },
            {
                key: 'equalBilaterally',
                normal: 'Equal bilaterally',
                abnormals: [
                    { key: 'unequal', label: 'Unequal' },
                ],
            },
            {
                key: 'gripIntact',
                normal: 'Grip intact',
                abnormals: [
                    { key: 'gripWeakness', label: 'Grip weakness' },
                ],
            },
        ],
    },
    {
        key: 'cat_b_specialTests',
        label: 'Special Tests',
        findings: [
            // Neck (B-2)
            { key: 'spurlings',         normal: "(-) Spurling's",         abnormals: [{ key: 'spurlingsPos',         label: "(+) Spurling's" }] },
            { key: 'distractionTest',   normal: '(-) Distraction test',   abnormals: [{ key: 'distractionTestPos',   label: '(+) Distraction test' }] },
            { key: 'lhermittes',        normal: "(-) Lhermitte's",        abnormals: [{ key: 'lhermittesPos',        label: "(+) Lhermitte's" }] },
            { key: 'hoffmans',          normal: "(-) Hoffman's",          abnormals: [{ key: 'hoffmansPos',          label: "(+) Hoffman's" }] },
            // Back (B-1)
            { key: 'straightLegRaise',  normal: '(-) Straight leg raise', abnormals: [{ key: 'straightLegRaisePos', label: '(+) Straight leg raise' }] },
            { key: 'faber',             normal: '(-) FABER',              abnormals: [{ key: 'faberPos',             label: '(+) FABER' }] },
            { key: 'fadir',             normal: '(-) FADIR',              abnormals: [{ key: 'fadirPos',             label: '(+) FADIR' }] },
            { key: 'ober',              normal: '(-) Ober',               abnormals: [{ key: 'oberPos',              label: '(+) Ober' }] },
            { key: 'piriformisTest',    normal: '(-) Piriformis test',    abnormals: [{ key: 'piriformisTestPos',    label: '(+) Piriformis test' }] },
            { key: 'slumpTest',         normal: '(-) Slump test',         abnormals: [{ key: 'slumpTestPos',         label: '(+) Slump test' }] },
            { key: 'storkTest',         normal: '(-) Stork test',         abnormals: [{ key: 'storkTestPos',         label: '(+) Stork test' }] },
            // Shoulder (B-3)
            { key: 'neer',              normal: '(-) Neer',               abnormals: [{ key: 'neerPos',              label: '(+) Neer' }] },
            { key: 'hawkins',           normal: '(-) Hawkins',            abnormals: [{ key: 'hawkinsPos',           label: '(+) Hawkins' }] },
            { key: 'emptyCan',          normal: '(-) Empty can',          abnormals: [{ key: 'emptyCanPos',          label: '(+) Empty can' }] },
            { key: 'speed',             normal: '(-) Speed',              abnormals: [{ key: 'speedPos',             label: '(+) Speed' }] },
            { key: 'apprehension',      normal: '(-) Apprehension',       abnormals: [{ key: 'apprehensionPos',      label: '(+) Apprehension' }] },
            { key: 'relocation',        normal: '(-) Relocation',         abnormals: [{ key: 'relocationPos',        label: '(+) Relocation' }] },
            { key: 'obriens',           normal: "(-) O'Brien's",          abnormals: [{ key: 'obriensPos',           label: "(+) O'Brien's" }] },
            { key: 'crossBodyAdduction',normal: '(-) Cross-body adduction',abnormals: [{ key: 'crossBodyAdductionPos',label: '(+) Cross-body adduction' }] },
            { key: 'dropArm',           normal: '(-) Drop arm',           abnormals: [{ key: 'dropArmPos',           label: '(+) Drop arm' }] },
            { key: 'liftOff',           normal: '(-) Lift-off',           abnormals: [{ key: 'liftOffPos',           label: '(+) Lift-off' }] },
            // Elbow (B-4)
            { key: 'tinelCubital',      normal: '(-) Tinel (cubital tunnel)',  abnormals: [{ key: 'tinelCubitalPos',  label: '(+) Tinel (cubital tunnel)' }] },
            { key: 'valgusStress',      normal: '(-) Valgus stress',      abnormals: [{ key: 'valgusStressPos',      label: '(+) Valgus stress' }] },
            { key: 'varusStress',       normal: '(-) Varus stress',       abnormals: [{ key: 'varusStressPos',       label: '(+) Varus stress' }] },
            { key: 'milkingManeuver',   normal: '(-) Milking maneuver',   abnormals: [{ key: 'milkingManeuverPos',   label: '(+) Milking maneuver' }] },
            { key: 'cozensTest',        normal: "(-) Cozen's test",       abnormals: [{ key: 'cozensTestPos',        label: "(+) Cozen's test" }] },
            { key: 'reverseCozens',     normal: "(-) Reverse Cozen's",    abnormals: [{ key: 'reverseCozensPos',     label: "(+) Reverse Cozen's" }] },
            // Wrist (B-5)
            { key: 'tinelCarpal',       normal: '(-) Tinel (carpal tunnel)',   abnormals: [{ key: 'tinelCarpalPos',   label: '(+) Tinel (carpal tunnel)' }] },
            { key: 'phalen',            normal: '(-) Phalen',             abnormals: [{ key: 'phalenPos',            label: '(+) Phalen' }] },
            { key: 'finkelstein',       normal: '(-) Finkelstein',        abnormals: [{ key: 'finkelsteinPos',       label: '(+) Finkelstein' }] },
            { key: 'watsonsScaphoid',   normal: "(-) Watson's (scaphoid shift)", abnormals: [{ key: 'watsonsScaphoidPos', label: "(+) Watson's (scaphoid shift)" }] },
            { key: 'grindTestWrist',    normal: '(-) Grind test',         abnormals: [{ key: 'grindTestWristPos',    label: '(+) Grind test' }] },
            // Hand (B-6) — Tinel (carpal tunnel), Phalen, Finkelstein deduplicated above
            { key: 'grindTest1stCmc',   normal: '(-) Grind test (1st CMC)', abnormals: [{ key: 'grindTest1stCmcPos', label: '(+) Grind test (1st CMC)' }] },
            { key: 'bunnelLittler',     normal: '(-) Bunnel-Littler',     abnormals: [{ key: 'bunnelLittlerPos',     label: '(+) Bunnel-Littler' }] },
            // Hip (B-7) — FABER, FADIR, Ober, Piriformis deduplicated above
            { key: 'trendelenburg',     normal: '(-) Trendelenburg',      abnormals: [{ key: 'trendelenburgPos',     label: '(+) Trendelenburg' }] },
            { key: 'thomasTest',        normal: '(-) Thomas test',        abnormals: [{ key: 'thomasTestPos',        label: '(+) Thomas test' }] },
            { key: 'logRoll',           normal: '(-) Log roll',           abnormals: [{ key: 'logRollPos',           label: '(+) Log roll' }] },
            // Knee (B-8)
            { key: 'lachman',           normal: '(-) Lachman',            abnormals: [{ key: 'lachmanPos',           label: '(+) Lachman' }] },
            { key: 'anteriorDrawer',    normal: '(-) Anterior drawer',    abnormals: [{ key: 'anteriorDrawerPos',    label: '(+) Anterior drawer' }] },
            { key: 'posteriorDrawer',   normal: '(-) Posterior drawer',   abnormals: [{ key: 'posteriorDrawerPos',   label: '(+) Posterior drawer' }] },
            { key: 'mcmurray',          normal: '(-) McMurray',           abnormals: [{ key: 'mcmurrayPos',          label: '(+) McMurray' }] },
            { key: 'valgusStressKnee',  normal: '(-) Valgus stress',      abnormals: [{ key: 'valgusStressKneePos',  label: '(+) Valgus stress' }] },
            { key: 'varusStressKnee',   normal: '(-) Varus stress',       abnormals: [{ key: 'varusStressKneePos',   label: '(+) Varus stress' }] },
            { key: 'patellarApprehension', normal: '(-) Patellar apprehension', abnormals: [{ key: 'patellarApprehensionPos', label: '(+) Patellar apprehension' }] },
            { key: 'patellarGrind',     normal: '(-) Patellar grind',     abnormals: [{ key: 'patellarGrindPos',     label: '(+) Patellar grind' }] },
            { key: 'thessaly',          normal: '(-) Thessaly',           abnormals: [{ key: 'thessalyPos',          label: '(+) Thessaly' }] },
            // Ankle (B-9) — Anterior drawer, Valgus stress, Varus stress deduplicated above
            { key: 'talarTilt',         normal: '(-) Talar tilt',         abnormals: [{ key: 'talarTiltPos',         label: '(+) Talar tilt' }] },
            { key: 'thompson',          normal: '(-) Thompson',           abnormals: [{ key: 'thompsonPos',          label: '(+) Thompson' }] },
            { key: 'squeezeTest',       normal: '(-) Squeeze test',       abnormals: [{ key: 'squeezeTestPos',       label: '(+) Squeeze test' }] },
            { key: 'externalRotationStress', normal: '(-) External rotation stress', abnormals: [{ key: 'externalRotationStressPos', label: '(+) External rotation stress' }] },
            // Foot (B-10)
            { key: 'muldersClick',      normal: "(-) Mulder's click",     abnormals: [{ key: 'muldersClickPos',      label: "(+) Mulder's click" }] },
            { key: 'windlassTest',      normal: '(-) Windlass test',      abnormals: [{ key: 'windlassTestPos',      label: '(+) Windlass test' }] },
            { key: 'tinelTarsal',       normal: '(-) Tinel (tarsal tunnel)', abnormals: [{ key: 'tinelTarsalPos',    label: '(+) Tinel (tarsal tunnel)' }] },
            { key: 'squeezeTestMtp',    normal: '(-) Squeeze test (MTP)', abnormals: [{ key: 'squeezeTestMtpPos',    label: '(+) Squeeze test (MTP)' }] },
            // Toe
            { key: 'grindTestToe',      normal: '(-) Grind test',         abnormals: [{ key: 'grindTestToePos',      label: '(+) Grind test' }] },
            { key: 'drawerTestMtp',     normal: '(-) Drawer test (MTP)',  abnormals: [{ key: 'drawerTestMtpPos',     label: '(+) Drawer test (MTP)' }] },
        ],
    },
    {
        key: 'cat_b_neurovascular',
        label: 'Neurovascular',
        findings: [
            {
                key: 'dtrNormal',
                normal: 'DTR normal bilaterally',
                abnormals: [
                    { key: 'hyperreflexia', label: 'Hyperreflexia' },
                    { key: 'hyporeflexia', label: 'Hyporeflexia' },
                    { key: 'areflexia', label: 'Areflexia' },
                    { key: 'asymmetricReflexes', label: 'Asymmetric reflexes' },
                ],
            },
            {
                key: 'sensoryIntact',
                normal: 'Sensory intact to light touch',
                abnormals: [
                    { key: 'decreasedSensation', label: 'Decreased sensation' },
                    { key: 'numbness', label: 'Numbness' },
                    { key: 'paresthesias', label: 'Paresthesias' },
                    { key: 'dermatomalLoss', label: 'Dermatomal loss' },
                ],
            },
            {
                key: 'pulses2PlusDpPt',
                normal: '2+ DP/PT pulses b/l',
                abnormals: [
                    { key: 'diminishedPulsesNv', label: 'Diminished pulses' },
                    { key: 'absentPulsesNv', label: 'Absent pulses' },
                    { key: 'delayedCapRefillNv', label: 'Delayed cap refill' },
                ],
            },
        ],
    },
];

/** @deprecated Use MSK child blocks instead — kept for backward compatibility with old codec */
export const SPECIAL_TESTS_BY_BODY_PART: Record<string, string[]> = {
    'B-1': ['straightLegRaise', 'faber', 'fadir', 'ober', 'piriformisTest', 'slumpTest'],
    'B-2': ['spurlings', 'hoffmans'],
    'B-3': ['neer', 'hawkins', 'emptyCan', 'speed', 'apprehension', 'relocation', 'obriens', 'crossBodyAdduction', 'dropArm', 'liftOff'],
    'B-4': ['tinelCubital', 'valgusStress', 'varusStress'],
    'B-5': ['tinelCarpal', 'phalen', 'finkelstein', 'watsonsScaphoid'],
    'B-6': ['tinelCarpal', 'phalen', 'finkelstein', 'grindTest1stCmc'],
    'B-7': ['faber', 'fadir', 'ober', 'trendelenburg', 'thomasTest', 'logRoll', 'piriformisTest'],
    'B-8': ['lachman', 'anteriorDrawer', 'posteriorDrawer', 'mcmurray', 'valgusStressKnee', 'varusStressKnee', 'patellarApprehension', 'patellarGrind'],
    'B-9': ['anteriorDrawer', 'talarTilt', 'thompson', 'squeezeTest', 'externalRotationStress'],
    'B-10': ['tinelTarsal', 'squeezeTestMtp'],
    'B-11': [],
    'B-TOE': ['grindTestToe', 'drawerTestMtp'],
};

// ── Category C — Gastrointestinal ─────────────────────────────────────────────

const FOCUSED_C: PEBlock[] = [
    {
        key: 'cat_c_inspection',
        label: 'Inspection',
        findings: [
            {
                key: 'abdomenFlat',
                normal: 'Abdomen flat',
                abnormals: [
                    { key: 'distension', label: 'Distension' },
                ],
            },
            {
                key: 'noVisibleMasses',
                normal: 'No visible masses',
                abnormals: [
                    { key: 'visibleMass', label: 'Visible mass' },
                ],
            },
            {
                key: 'noScars',
                normal: 'No scars',
                abnormals: [
                    { key: 'surgicalScars', label: 'Surgical scars' },
                ],
            },
            {
                key: 'noHernias',
                normal: 'No hernias',
                abnormals: [
                    { key: 'hernia', label: 'Hernia' },
                ],
            },
            {
                key: 'noEcchymosisAbd',
                normal: 'No ecchymosis',
                abnormals: [
                    { key: 'ecchymosisAbd', label: 'Ecchymosis' },
                ],
            },
        ],
    },
    {
        key: 'cat_c_auscultation',
        label: 'Auscultation',
        findings: [
            {
                key: 'bsPresentAllQuadrants',
                normal: 'BS present all quadrants',
                abnormals: [
                    { key: 'hyperactiveBs', label: 'Hyperactive BS' },
                    { key: 'hypoactiveBs', label: 'Hypoactive BS' },
                    { key: 'absentBs', label: 'Absent BS' },
                ],
            },
            {
                key: 'noBruits',
                normal: 'No bruits',
                abnormals: [
                    { key: 'bruit', label: 'Bruit' },
                ],
            },
        ],
    },
    {
        key: 'cat_c_palpation',
        label: 'Palpation',
        findings: [
            {
                key: 'soft',
                normal: 'Soft',
                abnormals: [
                    { key: 'rigidity', label: 'Rigidity' },
                ],
            },
            {
                key: 'nonTenderAbd',
                normal: 'Non-tender',
                abnormals: [
                    { key: 'tendernessSpecifyQuadrant', label: 'Tenderness (specify quadrant)' },
                ],
            },
            {
                key: 'noMassesAbd',
                normal: 'No masses',
                abnormals: [
                    { key: 'massAbd', label: 'Mass' },
                ],
            },
            {
                key: 'noGuarding',
                normal: 'No guarding',
                abnormals: [
                    { key: 'guarding', label: 'Guarding' },
                    { key: 'rebound', label: 'Rebound' },
                ],
            },
            {
                key: 'noOrganomegaly',
                normal: 'No organomegaly',
                abnormals: [
                    { key: 'hepatomegaly', label: 'Hepatomegaly' },
                    { key: 'splenomegaly', label: 'Splenomegaly' },
                ],
            },
        ],
    },
    {
        key: 'cat_c_percussion',
        label: 'Percussion',
        findings: [
            {
                key: 'tympanicThroughout',
                normal: 'Tympanic throughout',
                abnormals: [
                    { key: 'dullness', label: 'Dullness' },
                    { key: 'shiftingDullness', label: 'Shifting dullness' },
                    { key: 'tympanyOverMass', label: 'Tympany over mass' },
                ],
            },
            {
                key: 'noCvaTenderness',
                normal: 'No CVA tenderness',
                abnormals: [
                    { key: 'cvaTenderness', label: 'CVA tenderness' },
                ],
            },
        ],
    },
    {
        key: 'cat_c_rectal',
        label: 'Rectal',
        findings: [
            {
                key: 'rectalDeferred',
                normal: 'Deferred — not indicated',
                abnormals: [
                    { key: 'hemorrhoids', label: 'Hemorrhoids' },
                    { key: 'fissure', label: 'Fissure' },
                    { key: 'massRectal', label: 'Mass' },
                    { key: 'tendernessRectal', label: 'Tenderness' },
                    { key: 'rectalToneAbnormal', label: 'Rectal tone abnormal' },
                ],
            },
        ],
    },
];

// ── Category D — Cardiorespiratory ────────────────────────────────────────────

const FOCUSED_D: PEBlock[] = [
    {
        key: 'cat_d_heartSounds',
        label: 'Heart Sounds',
        findings: [
            {
                key: 'regularRateRhythmD',
                normal: 'Regular rate and rhythm',
                abnormals: [
                    { key: 'irregularRhythmD', label: 'Irregular rhythm' },
                    { key: 'tachycardiaD', label: 'Tachycardia' },
                    { key: 'bradycardiaD', label: 'Bradycardia' },
                ],
            },
            {
                key: 's1S2Normal',
                normal: 'S1/S2 normal',
                abnormals: [],
            },
            {
                key: 'noMurmursD',
                normal: 'No murmurs',
                abnormals: [
                    { key: 'murmurSpecify', label: 'Murmur (specify)' },
                ],
            },
            {
                key: 'noGallopD',
                normal: 'No gallops',
                abnormals: [
                    { key: 'gallopS3S4', label: 'Gallop (S3/S4)' },
                ],
            },
            {
                key: 'noRubD',
                normal: 'No rubs',
                abnormals: [
                    { key: 'rubD', label: 'Rub' },
                ],
            },
        ],
    },
    {
        key: 'cat_d_lungSounds',
        label: 'Lung Sounds',
        findings: [
            {
                key: 'ctaBilatD',
                normal: 'CTA bilaterally',
                abnormals: [
                    { key: 'diminishedBsD', label: 'Diminished BS' },
                ],
            },
            {
                key: 'noWheezesD',
                normal: 'No wheezes',
                abnormals: [
                    { key: 'wheezingD', label: 'Wheezing' },
                ],
            },
            {
                key: 'noRalesD',
                normal: 'No rales',
                abnormals: [
                    { key: 'ralesCracklesD', label: 'Rales/crackles' },
                ],
            },
            {
                key: 'noRhonchiD',
                normal: 'No rhonchi',
                abnormals: [
                    { key: 'rhonchiD', label: 'Rhonchi' },
                ],
            },
            {
                key: 'noStridorD',
                normal: 'No stridor',
                abnormals: [
                    { key: 'stridorD', label: 'Stridor' },
                ],
            },
            {
                key: 'noPleuralRub',
                normal: 'No pleural rub',
                abnormals: [
                    { key: 'pleuralRub', label: 'Pleural rub' },
                ],
            },
        ],
    },
    {
        key: 'cat_d_respiratoryEffort',
        label: 'Respiratory Effort',
        findings: [
            {
                key: 'unlabored',
                normal: 'Unlabored',
                abnormals: [
                    { key: 'tachypnea', label: 'Tachypnea' },
                ],
            },
            {
                key: 'noAccessoryMuscleUse',
                normal: 'No accessory muscle use',
                abnormals: [
                    { key: 'accessoryMuscleUse', label: 'Accessory muscle use' },
                    { key: 'retractions', label: 'Retractions' },
                    { key: 'nasalFlaring', label: 'Nasal flaring' },
                ],
            },
            {
                key: 'speakingFullSentences',
                normal: 'Speaking full sentences',
                abnormals: [
                    { key: 'speaksInFragments', label: 'Speaks in fragments' },
                ],
            },
            {
                key: 'noTripoding',
                normal: 'No tripoding',
                abnormals: [
                    { key: 'tripoding', label: 'Tripoding' },
                ],
            },
        ],
    },
    {
        key: 'cat_d_chestWall',
        label: 'Chest Wall',
        findings: [
            {
                key: 'symmetricRiseFall',
                normal: 'Symmetric rise and fall',
                abnormals: [
                    { key: 'asymmetricExpansion', label: 'Asymmetric expansion' },
                    { key: 'chestWallDeformity', label: 'Chest wall deformity' },
                ],
            },
            {
                key: 'nonTenderChest',
                normal: 'Non-tender',
                abnormals: [
                    { key: 'tendernessChest', label: 'Tenderness' },
                ],
            },
            {
                key: 'noCrepitusChest',
                normal: 'No crepitus',
                abnormals: [
                    { key: 'crepitusChest', label: 'Crepitus' },
                    { key: 'surgicalEmphysema', label: 'Surgical emphysema' },
                ],
            },
        ],
    },
    {
        key: 'cat_d_peripheralPulses',
        label: 'Peripheral Pulses',
        findings: [
            {
                key: 'pulses2PlusEqual',
                normal: 'Pulses 2+ equal bilaterally',
                abnormals: [
                    { key: 'diminishedPulsesD', label: 'Diminished pulses' },
                    { key: 'absentPulsesD', label: 'Absent pulses' },
                ],
            },
            {
                key: 'capRefillUnder3',
                normal: 'Cap refill < 3 sec',
                abnormals: [
                    { key: 'delayedCapRefill', label: 'Delayed cap refill' },
                ],
            },
            {
                key: 'noEdema',
                normal: 'No edema',
                abnormals: [
                    { key: 'peripheralEdema', label: 'Peripheral edema' },
                ],
            },
            {
                key: 'warmExtremities',
                normal: 'Warm extremities',
                abnormals: [
                    { key: 'coolExtremities', label: 'Cool extremities' },
                    { key: 'cyanosis', label: 'Cyanosis' },
                ],
            },
        ],
    },
];

// ── Category E — Genitourinary ────────────────────────────────────────────────

const FOCUSED_E: PEBlock[] = [
    {
        key: 'cat_e_abdomen',
        label: 'Abdomen',
        findings: [
            {
                key: 'softE',
                normal: 'Soft',
                abnormals: [],
            },
            {
                key: 'nonTenderE',
                normal: 'Non-tender',
                abnormals: [
                    { key: 'suprapubicTenderness', label: 'Suprapubic tenderness' },
                ],
            },
            {
                key: 'noDistensionE',
                normal: 'No distension',
                abnormals: [
                    { key: 'distensionE', label: 'Distension' },
                ],
            },
            {
                key: 'noMassesE',
                normal: 'No masses',
                abnormals: [
                    { key: 'massE', label: 'Mass' },
                ],
            },
            {
                key: 'noGuardingE',
                normal: 'No guarding',
                abnormals: [
                    { key: 'guardingE', label: 'Guarding' },
                ],
            },
        ],
    },
    {
        key: 'cat_e_cva',
        label: 'CVA',
        findings: [
            {
                key: 'noCvaTendernessE',
                normal: 'No CVA tenderness bilaterally',
                abnormals: [
                    { key: 'cvaTendernessL', label: 'CVA tenderness (L)' },
                    { key: 'cvaTendernessR', label: 'CVA tenderness (R)' },
                    { key: 'cvaTendernessBl', label: 'CVA tenderness (BL)' },
                ],
            },
        ],
    },
    {
        key: 'cat_e_externalGenitalia',
        label: 'External Genitalia',
        findings: [
            {
                key: 'circumcised',
                normal: 'Circumcised',
                abnormals: [
                    { key: 'uncircumcised', label: 'Uncircumcised' },
                ],
            },
            {
                key: 'noLesionsGen',
                normal: 'No lesions',
                abnormals: [
                    { key: 'lesionUlcerGen', label: 'Lesion/ulcer' },
                ],
            },
            {
                key: 'noDischargeGen',
                normal: 'No discharge',
                abnormals: [
                    { key: 'dischargeGen', label: 'Discharge' },
                ],
            },
            {
                key: 'noSwellingGen',
                normal: 'No swelling',
                abnormals: [
                    { key: 'swellingGen', label: 'Swelling' },
                ],
            },
            {
                key: 'nontenderGen',
                normal: 'Nontender',
                abnormals: [
                    { key: 'erythemaGen', label: 'Erythema' },
                ],
            },
            {
                key: 'noUrethralMalformation',
                normal: 'No urethral malformation',
                abnormals: [
                    { key: 'urethralMalformation', label: 'Urethral malformation' },
                ],
            },
            {
                key: 'twoTestesPalpated',
                normal: 'Two testes palpated in scrotum',
                abnormals: [],
            },
            {
                key: 'scrotumNontender',
                normal: 'Scrotum nontender',
                abnormals: [],
            },
            {
                key: 'normalPrehns',
                normal: "Normal Prehn's",
                abnormals: [],
            },
            {
                key: 'normalCremasteric',
                normal: 'Normal cremasteric',
                abnormals: [],
            },
        ],
    },
    {
        key: 'cat_e_inguinal',
        label: 'Inguinal',
        findings: [
            {
                key: 'noInguinalLad',
                normal: 'No inguinal LAD',
                abnormals: [
                    { key: 'ladInguinal', label: 'LAD' },
                ],
            },
            {
                key: 'noHernia',
                normal: 'No hernia',
                abnormals: [
                    { key: 'inguinalHernia', label: 'Inguinal hernia' },
                ],
            },
            {
                key: 'nontenderInguinal',
                normal: 'Nontender',
                abnormals: [
                    { key: 'tendernessInguinal', label: 'Tenderness' },
                ],
            },
        ],
    },
];

// ── Category F — Neuropsychiatric ─────────────────────────────────────────────

const FOCUSED_F: PEBlock[] = [
    {
        key: 'cat_f_mentalStatus',
        label: 'Mental Status',
        findings: [
            {
                key: 'alertOrientedX4',
                normal: 'Alert and oriented x4',
                abnormals: [
                    { key: 'disorientedSpecify', label: 'Disoriented (specify)' },
                ],
            },
            {
                key: 'appropriateMood',
                normal: 'Appropriate mood',
                abnormals: [
                    { key: 'depressedMood', label: 'Depressed mood' },
                    { key: 'anxious', label: 'Anxious' },
                ],
            },
            {
                key: 'appropriateAffect',
                normal: 'Appropriate affect',
                abnormals: [
                    { key: 'flatAffect', label: 'Flat affect' },
                    { key: 'labileAffect', label: 'Labile affect' },
                ],
            },
            {
                key: 'intactJudgment',
                normal: 'Intact judgment',
                abnormals: [
                    { key: 'poorJudgment', label: 'Poor judgment' },
                ],
            },
            {
                key: 'intactInsight',
                normal: 'Intact insight',
                abnormals: [
                    { key: 'poorInsight', label: 'Poor insight' },
                ],
            },
            {
                key: 'noSiHi',
                normal: 'No SI/HI',
                abnormals: [
                    { key: 'siHiSpecify', label: 'SI/HI (specify)' },
                ],
            },
        ],
    },
    {
        key: 'cat_f_cranialNerves',
        label: 'Cranial Nerves',
        findings: [
            {
                key: 'cn2To12Intact',
                normal: 'CN II-XII grossly intact',
                abnormals: [
                    { key: 'cnDeficitSpecify', label: 'CN deficit (specify)' },
                ],
            },
            {
                key: 'noFacialAsymmetry',
                normal: 'No facial asymmetry',
                abnormals: [
                    { key: 'facialAsymmetry', label: 'Facial asymmetry' },
                ],
            },
            {
                key: 'visualFieldsIntact',
                normal: 'Visual fields intact',
                abnormals: [
                    { key: 'visualFieldDeficit', label: 'Visual field deficit' },
                ],
            },
            {
                key: 'hearingIntact',
                normal: 'Hearing intact',
                abnormals: [
                    { key: 'hearingDeficit', label: 'Hearing deficit' },
                ],
            },
            {
                key: 'tongueMidline',
                normal: 'Tongue midline',
                abnormals: [
                    { key: 'tongueDeviation', label: 'Tongue deviation' },
                ],
            },
        ],
    },
    {
        key: 'cat_f_motor',
        label: 'Motor',
        findings: [
            {
                key: 'strength55AllExt',
                normal: '5/5 strength all extremities',
                abnormals: [
                    { key: 'focalWeaknessSpecify', label: 'Focal weakness (specify)' },
                ],
            },
            {
                key: 'normalTone',
                normal: 'Normal tone',
                abnormals: [
                    { key: 'increasedTone', label: 'Increased tone' },
                    { key: 'decreasedTone', label: 'Decreased tone' },
                ],
            },
            {
                key: 'normalBulk',
                normal: 'Normal bulk',
                abnormals: [
                    { key: 'atrophyMotor', label: 'Atrophy' },
                ],
            },
            {
                key: 'noFasciculations',
                normal: 'No fasciculations',
                abnormals: [
                    { key: 'fasciculations', label: 'Fasciculations' },
                ],
            },
            {
                key: 'noTremor',
                normal: 'No tremor',
                abnormals: [
                    { key: 'tremor', label: 'Tremor' },
                ],
            },
        ],
    },
    {
        key: 'cat_f_sensory',
        label: 'Sensory',
        findings: [
            {
                key: 'intactToLightTouch',
                normal: 'Intact to light touch',
                abnormals: [
                    { key: 'decreasedSensationSpecify', label: 'Decreased sensation (specify)' },
                    { key: 'numbnessSensory', label: 'Numbness' },
                    { key: 'paresthesiasSensory', label: 'Paresthesias' },
                    { key: 'dermatomalLossSensory', label: 'Dermatomal loss' },
                ],
            },
        ],
    },
    {
        key: 'cat_f_reflexes',
        label: 'Reflexes',
        findings: [
            {
                key: 'twoPlusSymmetric',
                normal: '2+ symmetric throughout',
                abnormals: [
                    { key: 'hyperreflexiaF', label: 'Hyperreflexia' },
                    { key: 'hyporeflexiaF', label: 'Hyporeflexia' },
                    { key: 'areflexiaF', label: 'Areflexia' },
                    { key: 'asymmetricReflexesF', label: 'Asymmetric reflexes' },
                ],
            },
            {
                key: 'babinskiDowngoing',
                normal: 'Babinski downgoing b/l',
                abnormals: [
                    { key: 'babinskiUpgoing', label: 'Babinski upgoing' },
                    { key: 'clonus', label: 'Clonus' },
                ],
            },
        ],
    },
    {
        key: 'cat_f_coordination',
        label: 'Coordination',
        findings: [
            {
                key: 'fingerToNoseIntact',
                normal: 'Finger-to-nose intact',
                abnormals: [
                    { key: 'dysmetria', label: 'Dysmetria' },
                    { key: 'dysdiadochokinesia', label: 'Dysdiadochokinesia' },
                ],
            },
            {
                key: 'gaitSteady',
                normal: 'Gait steady',
                abnormals: [
                    { key: 'ataxicGait', label: 'Ataxic gait' },
                    { key: 'unsteadyGait', label: 'Unsteady gait' },
                ],
            },
            {
                key: 'rombergNegative',
                normal: 'Romberg negative',
                abnormals: [
                    { key: 'rombergPositive', label: 'Romberg positive' },
                ],
            },
            {
                key: 'noIntentionTremor',
                normal: 'No intention tremor',
                abnormals: [
                    { key: 'intentionTremor', label: 'Intention tremor' },
                ],
            },
        ],
    },
];

// ── Category G — Constitutional (4 blocks, 20 findings) ──────────────────────

const FOCUSED_G: PEBlock[] = [
    {
        key: 'cat_g_generalAppearance',
        label: 'General Appearance',
        findings: [
            { key: 'alert',           normal: 'Alert',           abnormals: [{ key: 'lethargic', label: 'Lethargic' }, { key: 'ams', label: 'AMS' }] },
            { key: 'oriented',        normal: 'Oriented',        abnormals: [] },
            { key: 'noAcuteDistress', normal: 'No acute distress', abnormals: [{ key: 'acuteDistress', label: 'Acute distress' }] },
            { key: 'wellDeveloped',   normal: 'Well-developed',  abnormals: [{ key: 'cachexia', label: 'Cachexia' }] },
            { key: 'wellNourished',   normal: 'Well-nourished',  abnormals: [{ key: 'appearsIll', label: 'Appears ill' }] },
            { key: 'noDiaphoresis',   normal: 'No diaphoresis',  abnormals: [{ key: 'diaphoretic', label: 'Diaphoretic' }] },
            { key: 'goodColor',       normal: 'Good color',      abnormals: [{ key: 'pallor', label: 'Pallor' }] },
        ],
    },
    {
        key: 'cat_g_skinColorTemp',
        label: 'Skin Color/Temp',
        findings: [
            { key: 'warm',             normal: 'Warm',             abnormals: [{ key: 'coolClammy', label: 'Cool/clammy' }] },
            { key: 'dry',              normal: 'Dry',              abnormals: [{ key: 'diaphoretic', label: 'Diaphoretic' }] },
            { key: 'appropriateColor', normal: 'Appropriate color', abnormals: [
                { key: 'cyanosis', label: 'Cyanosis' },
                { key: 'pallor',   label: 'Pallor' },
                { key: 'jaundice', label: 'Jaundice' },
                { key: 'flushed',  label: 'Flushed' },
                { key: 'mottled',  label: 'Mottled' },
            ] },
        ],
    },
    {
        key: 'cat_g_cv',
        label: 'CV',
        findings: [
            { key: 'rrr',                normal: 'RRR',                   abnormals: [{ key: 'irregularRhythm', label: 'Irregular rhythm' }, { key: 'tachycardia', label: 'Tachycardia' }] },
            { key: 'noMurmurs',          normal: 'No murmurs',            abnormals: [{ key: 'murmur', label: 'Murmur' }] },
            { key: 'pulses2Bilaterally', normal: 'Pulses 2+ bilaterally', abnormals: [{ key: 'diminishedPulses', label: 'Diminished pulses' }] },
            { key: 'noEdema',            normal: 'No edema',              abnormals: [{ key: 'peripheralEdema', label: 'Peripheral edema' }] },
        ],
    },
    {
        key: 'cat_g_respiratory',
        label: 'Respiratory',
        findings: [
            { key: 'unlabored',           normal: 'Unlabored',            abnormals: [{ key: 'tachypnea', label: 'Tachypnea' }] },
            { key: 'ctaBilaterally',      normal: 'CTA bilaterally',      abnormals: [{ key: 'diminishedBs', label: 'Diminished BS' }] },
            { key: 'noWheezes',           normal: 'No wheezes',           abnormals: [{ key: 'wheezing', label: 'Wheezing' }] },
            { key: 'noRales',             normal: 'No rales',             abnormals: [{ key: 'ralesCrackles', label: 'Rales/crackles' }] },
            { key: 'noRhonchi',           normal: 'No rhonchi',           abnormals: [] },
            { key: 'noAccessoryMuscleUse', normal: 'No accessory muscle use', abnormals: [{ key: 'accessoryMuscleUse', label: 'Accessory muscle use' }] },
        ],
    },
];

// ── Category H — Eye (6 blocks, 18 findings) ─────────────────────────────────

const FOCUSED_H: PEBlock[] = [
    {
        key: 'cat_h_visualAcuity',
        label: 'Visual Acuity',
        findings: [
            { key: 'visualAcuityIntactBilaterally', normal: 'Visual acuity intact bilaterally', abnormals: [
                { key: 'decreasedAcuityL',  label: 'Decreased acuity (L)' },
                { key: 'decreasedAcuityR',  label: 'Decreased acuity (R)' },
                { key: 'decreasedAcuityBl', label: 'Decreased acuity (BL)' },
                { key: 'unableToAssess',    label: 'Unable to assess' },
            ] },
        ],
    },
    {
        key: 'cat_h_pupils',
        label: 'Pupils',
        findings: [
            { key: 'perrla', normal: 'PERRLA', abnormals: [
                { key: 'anisocoria',       label: 'Anisocoria' },
                { key: 'fixedPupil',       label: 'Fixed pupil' },
                { key: 'dilatedPupil',     label: 'Dilated pupil' },
                { key: 'constrictedPupil', label: 'Constricted pupil' },
            ] },
            { key: 'noApd', normal: 'No APD', abnormals: [{ key: 'apdPresent', label: 'APD present' }] },
        ],
    },
    {
        key: 'cat_h_eom',
        label: 'Extraocular Movements',
        findings: [
            { key: 'eomi',       normal: 'EOMI',       abnormals: [{ key: 'restrictedEom', label: 'Restricted EOM (specify)' }, { key: 'strabismus', label: 'Strabismus' }] },
            { key: 'noNystagmus', normal: 'No nystagmus', abnormals: [{ key: 'nystagmus', label: 'Nystagmus' }] },
            { key: 'noDiplopia',  normal: 'No diplopia',  abnormals: [{ key: 'diplopia', label: 'Diplopia' }] },
        ],
    },
    {
        key: 'cat_h_conjunctivaSclera',
        label: 'Conjunctiva/Sclera',
        findings: [
            { key: 'conjunctivaelear',  normal: 'Conjunctivae clear', abnormals: [{ key: 'conjunctivalInjection', label: 'Conjunctival injection' }, { key: 'chemosis', label: 'Chemosis' }] },
            { key: 'scleraeWhite',      normal: 'Sclerae white',      abnormals: [{ key: 'icterus', label: 'Icterus' }] },
            { key: 'noInjection',       normal: 'No injection',       abnormals: [{ key: 'subconjunctivalHemorrhage', label: 'Subconjunctival hemorrhage' }] },
            { key: 'noDischarge',       normal: 'No discharge',       abnormals: [{ key: 'discharge', label: 'Discharge' }] },
            { key: 'noPterygium',       normal: 'No pterygium',       abnormals: [{ key: 'pterygium', label: 'Pterygium' }] },
        ],
    },
    {
        key: 'cat_h_fundoscopy',
        label: 'Fundoscopy',
        findings: [
            { key: 'discsSharp',          normal: 'Discs sharp',          abnormals: [{ key: 'discEdema', label: 'Disc edema' }] },
            { key: 'noHemorrhages',       normal: 'No hemorrhages',       abnormals: [{ key: 'hemorrhage', label: 'Hemorrhage' }] },
            { key: 'noExudates',          normal: 'No exudates',          abnormals: [{ key: 'exudate', label: 'Exudate' }] },
            { key: 'noAvNicking',         normal: 'No AV nicking',        abnormals: [{ key: 'avNicking', label: 'AV nicking' }] },
            { key: 'adequateVisualization', normal: 'Adequate visualization', abnormals: [{ key: 'unableToVisualize', label: 'Unable to visualize' }] },
        ],
    },
    {
        key: 'cat_h_eyelids',
        label: 'Eyelids',
        findings: [
            { key: 'lidsNormal', normal: 'Lids normal', abnormals: [
                { key: 'chalazion',  label: 'Chalazion' },
                { key: 'hordeolum', label: 'Hordeolum' },
                { key: 'entropion', label: 'Entropion' },
                { key: 'ectropion', label: 'Ectropion' },
            ] },
            { key: 'noLidEdema',    normal: 'No edema',     abnormals: [{ key: 'lidEdema', label: 'Lid edema' }] },
            { key: 'noPtosis',      normal: 'No ptosis',    abnormals: [{ key: 'ptosis', label: 'Ptosis' }] },
            { key: 'noLaceration',  normal: 'No laceration', abnormals: [{ key: 'laceration', label: 'Laceration' }] },
        ],
    },
];

// ── Category I — Gynecological (4 blocks, 16 findings) ───────────────────────

const FOCUSED_I: PEBlock[] = [
    {
        key: 'cat_i_breast',
        label: 'Breast',
        findings: [
            { key: 'symmetric',     normal: 'Symmetric',     abnormals: [{ key: 'asymmetry', label: 'Asymmetry' }] },
            { key: 'noMasses',      normal: 'No masses',     abnormals: [{ key: 'mass', label: 'Mass' }] },
            { key: 'nonTender',     normal: 'Non-tender',    abnormals: [{ key: 'tenderness', label: 'Tenderness' }] },
            { key: 'noDischarge',   normal: 'No discharge',  abnormals: [{ key: 'discharge', label: 'Discharge' }] },
            { key: 'normalSkin',    normal: 'Normal skin',   abnormals: [{ key: 'skinChanges', label: 'Skin changes' }] },
            { key: 'noAxillaryLad', normal: 'No axillary LAD', abnormals: [{ key: 'axillaryLad', label: 'Axillary LAD' }] },
        ],
    },
    {
        key: 'cat_i_externalGenitalia',
        label: 'External Genitalia',
        findings: [
            { key: 'normalAppearance', normal: 'Normal appearance', abnormals: [{ key: 'mass', label: 'Mass' }] },
            { key: 'noLesions',        normal: 'No lesions',        abnormals: [{ key: 'lesionUlcer', label: 'Lesion/ulcer' }] },
            { key: 'noErythema',       normal: 'No erythema',       abnormals: [{ key: 'erythema', label: 'Erythema' }] },
            { key: 'noEdema',          normal: 'No edema',          abnormals: [{ key: 'edema', label: 'Edema' }] },
            { key: 'noDischarge',      normal: 'No discharge',      abnormals: [{ key: 'discharge', label: 'Discharge' }] },
        ],
    },
    {
        key: 'cat_i_vaginalCervical',
        label: 'Vaginal/Cervical',
        findings: [
            { key: 'cervixAppearsNormal',          normal: 'Cervix appears normal',          abnormals: [{ key: 'cervicalLesion', label: 'Cervical lesion' }, { key: 'friableCervix', label: 'Friable cervix' }] },
            { key: 'noCervicalMotionTenderness',   normal: 'No cervical motion tenderness',  abnormals: [{ key: 'cervicalMotionTenderness', label: 'Cervical motion tenderness' }] },
            { key: 'noAbnormalDischarge',          normal: 'No abnormal discharge',          abnormals: [{ key: 'abnormalDischarge', label: 'Abnormal discharge' }, { key: 'bleeding', label: 'Bleeding' }] },
        ],
    },
    {
        key: 'cat_i_uterusAdnexa',
        label: 'Uterus/Adnexa',
        findings: [
            { key: 'nonTender',       normal: 'Non-tender',     abnormals: [{ key: 'uterineTenderness', label: 'Uterine tenderness' }, { key: 'adnexalTenderness', label: 'Adnexal tenderness' }] },
            { key: 'normalSize',      normal: 'Normal size',    abnormals: [{ key: 'enlargedUterus', label: 'Enlarged uterus' }] },
            { key: 'noAdnexalMasses', normal: 'No adnexal masses', abnormals: [{ key: 'adnexalMass', label: 'Adnexal mass' }] },
        ],
    },
];

// ── Category J — Dermatological (6 blocks, 14 findings) ──────────────────────

const FOCUSED_J: PEBlock[] = [
    {
        key: 'cat_j_locationDistribution',
        label: 'Location/Distribution',
        findings: [
            { key: 'localized',     normal: 'Localized',     abnormals: [
                { key: 'diffuseWidespread', label: 'Diffuse/widespread' },
                { key: 'bilateral',         label: 'Bilateral' },
                { key: 'dermatomal',        label: 'Dermatomal' },
                { key: 'sunExposedAreas',   label: 'Sun-exposed areas' },
                { key: 'intertriginous',    label: 'Intertriginous' },
            ] },
            { key: 'wellDemarcated', normal: 'Well-demarcated', abnormals: [] },
        ],
    },
    {
        key: 'cat_j_morphology',
        label: 'Morphology',
        findings: [
            { key: '', normal: '', abnormals: [
                { key: 'macule',     label: 'Macule' },
                { key: 'papule',     label: 'Papule' },
                { key: 'vesicle',    label: 'Vesicle' },
                { key: 'pustule',    label: 'Pustule' },
                { key: 'plaque',     label: 'Plaque' },
                { key: 'nodule',     label: 'Nodule' },
                { key: 'wheal',      label: 'Wheal' },
                { key: 'erosion',    label: 'Erosion' },
                { key: 'ulcer',      label: 'Ulcer' },
                { key: 'bulla',      label: 'Bulla' },
                { key: 'patch',      label: 'Patch' },
                { key: 'petechiae',  label: 'Petechiae' },
                { key: 'purpura',    label: 'Purpura' },
            ] },
        ],
    },
    {
        key: 'cat_j_color',
        label: 'Color',
        findings: [
            { key: '', normal: '', abnormals: [
                { key: 'erythematous',   label: 'Erythematous' },
                { key: 'hyperpigmented', label: 'Hyperpigmented' },
                { key: 'hypopigmented',  label: 'Hypopigmented' },
                { key: 'violaceous',     label: 'Violaceous' },
                { key: 'blanching',      label: 'Blanching' },
                { key: 'nonBlanching',   label: 'Non-blanching' },
            ] },
        ],
    },
    {
        key: 'cat_j_sizeShape',
        label: 'Size/Shape',
        findings: [
            { key: '', normal: '', abnormals: [
                { key: 'lessThan1cm',  label: '< 1 cm' },
                { key: 'one5cm',       label: '1-5 cm' },
                { key: 'greaterThan5cm', label: '> 5 cm' },
                { key: 'roundOval',    label: 'Round/oval' },
                { key: 'irregular',    label: 'Irregular' },
                { key: 'linear',       label: 'Linear' },
                { key: 'annular',      label: 'Annular' },
                { key: 'serpiginous',  label: 'Serpiginous' },
            ] },
        ],
    },
    {
        key: 'cat_j_textureSurface',
        label: 'Texture/Surface',
        findings: [
            { key: 'smoothSurface', normal: 'Smooth surface', abnormals: [
                { key: 'scaling',       label: 'Scaling' },
                { key: 'crusting',      label: 'Crusting' },
                { key: 'weeping',       label: 'Weeping' },
                { key: 'lichenified',   label: 'Lichenified' },
                { key: 'verrucous',     label: 'Verrucous' },
                { key: 'indurated',     label: 'Indurated' },
                { key: 'umbilicated',   label: 'Umbilicated' },
            ] },
            { key: 'noScaling',    normal: 'No scaling',    abnormals: [] },
            { key: 'nonFluctuant', normal: 'Non-fluctuant', abnormals: [{ key: 'fluctuant', label: 'Fluctuant' }] },
        ],
    },
    {
        key: 'cat_j_surroundingSkin',
        label: 'Surrounding Skin',
        findings: [
            { key: 'noSurroundingErythema',      normal: 'No surrounding erythema',   abnormals: [{ key: 'surroundingErythema', label: 'Surrounding erythema' }] },
            { key: 'noInduration',               normal: 'No induration',             abnormals: [{ key: 'induration', label: 'Induration' }] },
            { key: 'noWarmth',                   normal: 'No warmth',                 abnormals: [{ key: 'warmth', label: 'Warmth' }] },
            { key: 'noSatelliteLesions',         normal: 'No satellite lesions',      abnormals: [{ key: 'satelliteLesions', label: 'Satellite lesions' }] },
            { key: 'noLymphangiaticStreaking',    normal: 'No lymphangitic streaking', abnormals: [{ key: 'lymphangiticStreaking', label: 'Lymphangitic streaking' }] },
        ],
    },
];

// ── Category K — Environmental (5 blocks, 14 findings) ───────────────────────

const FOCUSED_K: PEBlock[] = [
    {
        key: 'cat_k_skinAssessment',
        label: 'Skin Assessment',
        findings: [
            { key: 'skinIntact',  normal: 'Skin intact',  abnormals: [{ key: 'maceration', label: 'Maceration' }] },
            { key: 'noFrostbite', normal: 'No frostbite', abnormals: [{ key: 'frostnip', label: 'Frostnip' }, { key: 'frostbite', label: 'Frostbite (specify degree)' }] },
            { key: 'noBurns',     normal: 'No burns',     abnormals: [{ key: 'burn', label: 'Burn (specify degree)' }, { key: 'eschar', label: 'Eschar' }] },
            { key: 'noErythema',  normal: 'No erythema',  abnormals: [{ key: 'erythema', label: 'Erythema' }, { key: 'blistering', label: 'Blistering' }] },
        ],
    },
    {
        key: 'cat_k_circulation',
        label: 'Circulation',
        findings: [
            { key: 'pulsesPalpable',    normal: 'Pulses palpable',    abnormals: [{ key: 'diminishedPulses', label: 'Diminished pulses' }] },
            { key: 'capRefillLt3Sec',   normal: 'Cap refill < 3 sec', abnormals: [{ key: 'delayedCapRefill', label: 'Delayed cap refill' }] },
            { key: 'noEdema',           normal: 'No edema',           abnormals: [{ key: 'edema', label: 'Edema' }] },
            { key: 'warmExtremities',   normal: 'Warm extremities',   abnormals: [{ key: 'coolExtremities', label: 'Cool extremities' }, { key: 'cyanosis', label: 'Cyanosis' }] },
        ],
    },
    {
        key: 'cat_k_sensation',
        label: 'Sensation',
        findings: [
            { key: 'intactToLightTouch', normal: 'Intact to light touch', abnormals: [{ key: 'decreasedSensation', label: 'Decreased sensation' }] },
            { key: 'noNumbness',         normal: 'No numbness',           abnormals: [{ key: 'numbness', label: 'Numbness' }] },
            { key: 'noTingling',         normal: 'No tingling',           abnormals: [{ key: 'tingling', label: 'Tingling' }, { key: 'hyperesthesia', label: 'Hyperesthesia' }] },
        ],
    },
    {
        key: 'cat_k_temperature',
        label: 'Temperature',
        findings: [
            { key: 'afebrile',        normal: 'Afebrile',           abnormals: [{ key: 'hypothermic', label: 'Hypothermic' }, { key: 'hyperthermic', label: 'Hyperthermic' }] },
            { key: 'skinWarmToTouch', normal: 'Skin warm to touch', abnormals: [{ key: 'coolSkin', label: 'Cool skin' }, { key: 'hotFlushedSkin', label: 'Hot/flushed skin' }] },
        ],
    },
    {
        key: 'cat_k_mentalStatus',
        label: 'Mental Status',
        findings: [
            { key: 'alertAndOrientedX4', normal: 'Alert and oriented x4', abnormals: [{ key: 'confused', label: 'Confused' }, { key: 'ams', label: 'AMS' }] },
            { key: 'gcs15',              normal: 'GCS 15',               abnormals: [{ key: 'gcsLt15', label: 'GCS < 15 (specify)' }] },
            { key: 'cooperative',        normal: 'Cooperative',           abnormals: [{ key: 'lethargic', label: 'Lethargic' }, { key: 'combative', label: 'Combative' }] },
        ],
    },
];

// ── Category L — Miscellaneous (3 blocks, 12 findings) ───────────────────────

const FOCUSED_L: PEBlock[] = [
    {
        key: 'cat_l_generalAppearance',
        label: 'General Appearance',
        findings: [
            { key: 'alert',           normal: 'Alert',             abnormals: [{ key: 'lethargic', label: 'Lethargic' }] },
            { key: 'oriented',        normal: 'Oriented',          abnormals: [] },
            { key: 'noAcuteDistress', normal: 'No acute distress', abnormals: [{ key: 'acuteDistress', label: 'Acute distress' }] },
            { key: 'noDiaphoresis',   normal: 'No diaphoresis',    abnormals: [{ key: 'diaphoretic', label: 'Diaphoretic' }] },
            { key: 'noApparentIllness', normal: 'No apparent illness', abnormals: [{ key: 'appearsIll', label: 'Appears ill' }] },
        ],
    },
    {
        key: 'cat_l_oralDental',
        label: 'Oral/Dental',
        findings: [
            { key: 'oralMucosaIntact',       normal: 'Oral mucosa intact',       abnormals: [{ key: 'oralLesion', label: 'Oral lesion' }] },
            { key: 'dentitionInFairCondition', normal: 'Dentition in fair condition', abnormals: [{ key: 'dentalCaries', label: 'Dental caries' }, { key: 'looseFracturedTooth', label: 'Loose/fractured tooth' }] },
            { key: 'gingivaHealthy',         normal: 'Gingiva healthy',         abnormals: [{ key: 'gingivalBleeding', label: 'Gingival bleeding' }, { key: 'abscess', label: 'Abscess' }] },
            { key: 'noTrismus',              normal: 'No trismus',              abnormals: [{ key: 'trismus', label: 'Trismus' }] },
        ],
    },
    {
        key: 'cat_l_lymphNodes',
        label: 'Lymph Nodes',
        findings: [
            { key: 'noCervicalLad',    normal: 'No cervical LAD',    abnormals: [{ key: 'cervicalLad', label: 'Cervical LAD' }] },
            { key: 'noAxillaryLad',    normal: 'No axillary LAD',    abnormals: [{ key: 'axillaryLad', label: 'Axillary LAD' }] },
            { key: 'noInguinalLad',    normal: 'No inguinal LAD',    abnormals: [{ key: 'inguinalLad', label: 'Inguinal LAD' }] },
            { key: 'noGeneralizedLad', normal: 'No generalized LAD', abnormals: [
                { key: 'generalizedLad', label: 'Generalized LAD' },
                { key: 'tenderLad',      label: 'Tender LAD' },
                { key: 'mattedNodes',    label: 'Matted nodes' },
            ] },
        ],
    },
];

// ── Category M — Return Visit (3 blocks, 8 findings) ─────────────────────────

const FOCUSED_M: PEBlock[] = [
    {
        key: 'cat_m_generalAppearance',
        label: 'General Appearance',
        findings: [
            { key: 'alert',           normal: 'Alert',             abnormals: [] },
            { key: 'oriented',        normal: 'Oriented',          abnormals: [] },
            { key: 'noAcuteDistress', normal: 'No acute distress', abnormals: [{ key: 'appearsIll', label: 'Appears ill' }] },
            { key: 'improvedFromPrior', normal: 'Improved from prior', abnormals: [
                { key: 'worsenedFromPrior', label: 'Worsened from prior' },
                { key: 'noChangeFromPrior', label: 'No change from prior' },
            ] },
        ],
    },
    {
        key: 'cat_m_relevantSystem',
        label: 'Relevant System',
        findings: [
            { key: 'seeSystemSpecificFindings', normal: 'See system-specific findings', abnormals: [
                { key: 'worsened',           label: 'Worsened' },
                { key: 'unchanged',          label: 'Unchanged' },
                { key: 'partiallyImproved',  label: 'Partially improved' },
                { key: 'newFindingSpecify',  label: 'New finding (specify)' },
            ] },
        ],
    },
    {
        key: 'cat_m_comparisonToPrevious',
        label: 'Comparison to Previous',
        findings: [
            { key: 'improvedFromPriorVisit', normal: 'Improved from prior visit', abnormals: [
                { key: 'worsened',          label: 'Worsened' },
                { key: 'unchanged',         label: 'Unchanged' },
                { key: 'partiallyImproved', label: 'Partially improved' },
                { key: 'newComplaint',      label: 'New complaint' },
            ] },
        ],
    },
];

/** @deprecated Use MASTER_BLOCKS + FOCUSED_EXPANSION */
export const FOCUSED_CATEGORIES: Record<CategoryLetter, PEBlock[]> = {
    A: FOCUSED_A,
    B: FOCUSED_B,
    C: FOCUSED_C,
    D: FOCUSED_D,
    E: FOCUSED_E,
    F: FOCUSED_F,
    G: FOCUSED_G,
    H: FOCUSED_H,
    I: FOCUSED_I,
    J: FOCUSED_J,
    K: FOCUSED_K,
    L: FOCUSED_L,
    M: FOCUSED_M,
};

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

/** @deprecated */
export function getCategoryFromSymptomCode(code: string): CategoryLetter | null {
    const match = code.match(/^([A-M])-/);
    return match ? (match[1] as CategoryLetter) : null;
}

/** @deprecated */
export function getMSKBodyPart(code: string): { code: string; label: string } | null {
    const label = MSK_BODY_PARTS[code];
    return label ? { code, label } : null;
}

/** @deprecated */
export function getPECategory(letter: CategoryLetter): { category: CategoryLetter; label: string; items: PEBlock[] } {
    const labels: Record<CategoryLetter, string> = {
        A: 'HEENT', B: 'Musculoskeletal', C: 'Gastrointestinal',
        D: 'Cardiorespiratory', E: 'Genitourinary', F: 'Neuropsychiatric',
        G: 'Constitutional', H: 'Eye', I: 'Gynecological',
        J: 'Dermatological', K: 'Environmental', L: 'Miscellaneous', M: 'Return Visit',
    };
    return { category: letter, label: labels[letter], items: FOCUSED_CATEGORIES[letter] };
}

/** @deprecated Use MASTER_BLOCKS */
export const COMPREHENSIVE_DEFAULT_BLOCK_IDS: string[] = [
    'bl_gen', 'bl_eyes', 'sys_ears', 'sys_nose', 'sys_oral', 'sys_pharynx',
    'bl_hent', 'sys_neck', 'sys_cv', 'sys_pulm', 'sys_abd', 'sys_msk',
    'sys_derm', 'sys_extremities', 'bl_neuro', 'bl_psych',
];

function buildBlockLibrary(): Record<string, PEBlock> {
    const lib: Record<string, PEBlock> = {};
    for (const block of BASELINE_WRAPPERS) lib[block.key] = block;
    for (const block of SYSTEM_BLOCKS) lib[block.key] = block;
    for (const blocks of Object.values(FOCUSED_CATEGORIES)) {
        for (const block of blocks) lib[block.key] = block;
    }
    return lib;
}

/** @deprecated Use MASTER_BLOCK_LIBRARY */
export const BLOCK_LIBRARY: Record<string, PEBlock> = buildBlockLibrary();

/** @deprecated Use getMasterBlocks() */
export function getBaselineWrappers(): PEBlock[] { return BASELINE_WRAPPERS; }
/** @deprecated Use getBlocksForFocusedExam() */
export function getFocusedBlocks(letter: CategoryLetter): PEBlock[] { return FOCUSED_CATEGORIES[letter] || []; }
/** @deprecated Use getMasterBlocks() */
export function getSystemBlocks(): PEBlock[] { return SYSTEM_BLOCKS; }
/** @deprecated Use getMasterBlockByKey() */
export function getBlockByKey(key: string): PEBlock | undefined { return BLOCK_LIBRARY[key]; }
