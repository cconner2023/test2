import { Wind, Droplets, ShieldPlus, Stethoscope, Pill, Bone, Ambulance } from 'lucide-react';

/** Icon map for subject area headers in training lists. */
export const subjectAreaIcons: Record<string, React.ReactNode> = {
    'Airway Management': <Wind size={14} />,
    'Fluid Management': <Droplets size={14} />,
    'Force Health Protection': <ShieldPlus size={14} />,
    'Medical Management': <Stethoscope size={14} />,
    'Medication Management': <Pill size={14} />,
    'Trauma Management': <Bone size={14} />,
    'Triage and Evacuation': <Ambulance size={14} />,
};

/** Short badge labels for each skill level. */
export const skillLevelLabels: Record<string, string> = {
    'Readiness Requirements': 'RR',
    'Skill Level 1': 'SL1',
    'Skill Level 2': 'SL2',
    'Skill Level 3': 'SL3',
};

/** Canonical ordering of subject area categories. */
export const categoryOrder = [
    'Airway Management',
    'Fluid Management',
    'Force Health Protection',
    'Medical Management',
    'Medication Management',
    'Trauma Management',
    'Triage and Evacuation',
];
