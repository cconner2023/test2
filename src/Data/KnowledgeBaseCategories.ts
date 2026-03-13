import type { LucideIcon } from 'lucide-react'
import { Pill, BookOpen, Brain, ClipboardList, Calculator } from 'lucide-react'

export type KBGroup = 'medications' | 'training' | 'screening' | 'calculators'

export interface KBCategory {
    id: string
    label: string
    description: string
    icon: LucideIcon
    group: KBGroup
    comingSoon?: boolean
}

export const kbCategories: KBCategory[] = [
    // ── Medications ───────────────────────────────────────────
    {
        id: 'medications',
        label: 'Medications',
        description: 'Drug reference & dosing',
        icon: Pill,
        group: 'medications',
    },

    // ── Training ──────────────────────────────────────────────
    {
        id: 'stp',
        label: 'STP 68W',
        description: 'Soldier Training Publication',
        icon: BookOpen,
        group: 'training',
    },
    {
        id: 'efmb',
        label: 'EFMB',
        description: 'Expert Field Medical Badge',
        icon: BookOpen,
        group: 'training',
        comingSoon: true,
    },
    {
        id: 'medcom',
        label: 'MEDCOM REF',
        description: 'Coming Soon',
        icon: BookOpen,
        group: 'training',
        comingSoon: true,
    },

    // ── Screening Tools ───────────────────────────────────────
    {
        id: 'gad7',
        label: 'GAD-7',
        description: 'Anxiety screening',
        icon: Brain,
        group: 'screening',
    },
    {
        id: 'phq2',
        label: 'PHQ-2 / PHQ-9',
        description: 'Depression screening',
        icon: ClipboardList,
        group: 'screening',
    },
    {
        id: 'mace2',
        label: 'MACE 2',
        description: 'Concussion evaluation',
        icon: Brain,
        group: 'screening',
    },
    {
        id: 'auditc',
        label: 'AUDIT-C',
        description: 'Alcohol use screening',
        icon: ClipboardList,
        group: 'screening',
    },

    // ── Calculators ───────────────────────────────────────────
    {
        id: 'vital-signs',
        label: 'Vital Signs',
        description: 'Height, weight, BMI & temperature',
        icon: Calculator,
        group: 'calculators',
    },
    {
        id: 'burn',
        label: 'Burn Assessment',
        description: 'Coming soon',
        icon: Calculator,
        group: 'calculators',
        comingSoon: true,
    },
]

export const kbGroupLabels: Record<KBGroup, string> = {
    medications: 'MEDICATIONS',
    training: 'TRAINING',
    screening: 'SCREENING TOOLS',
    calculators: 'CALCULATORS',
}

export const kbGroupOrder: KBGroup[] = ['medications', 'training', 'screening', 'calculators']
