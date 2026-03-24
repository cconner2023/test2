import type { TemplateNode } from './TemplateTypes';

export type Credential = 'EMT-B' | 'EMT-A' | 'EMT-P' | 'PA-C' | 'NP' | 'MD' | 'DO';
export type Component = 'USA' | 'USN' | 'USMC' | 'USAF';
export type Rank = string;

export interface TextExpander {
    abbr: string;
    expansion: string;
    template?: TemplateNode[];
}

export interface Certification {
    id: string;
    user_id: string;
    title: string;
    cert_number: string | null;
    issue_date: string | null;
    exp_date: string | null;
    is_primary: boolean;
    verified: boolean;
    verified_by: string | null;
    verified_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface CustomPEBlock {
    id: string;
    name: string;
    normalText: string;
    abnormalTags: string[];
}

export interface CustomExamTemplate {
    id: string;
    name: string;
    blockIds: string[];
    customBlocks?: CustomPEBlock[];
}

export interface ComprehensivePETemplate {
    blockIds: string[];
    hiddenOptions?: Record<string, string[]>; // blockKey -> hidden abnormal option keys
}

export interface PlanOrderTags {
    referral: string[];
    meds: string[];
    radiology: string[];
    lab: string[];
    followUp: string[];
}

export const PLAN_ORDER_CATEGORIES = ['meds', 'lab', 'radiology', 'referral', 'followUp'] as const;
export type PlanOrderCategory = typeof PLAN_ORDER_CATEGORIES[number];

export const PLAN_ORDER_LABELS: Record<PlanOrderCategory, string> = {
    referral: 'Referral',
    meds: 'Medications',
    radiology: 'Radiology',
    lab: 'Lab',
    followUp: 'Follow-Up',
};

/** A block key used by Plan: one of the 4 order categories or 'instructions' */
export type PlanBlockKey = PlanOrderCategory | 'instructions';

export interface PlanOrderSet {
    id: string;
    name: string;
    /** Which tags to activate per block when this order set is applied */
    presets: Partial<Record<PlanBlockKey, string[]>>;
}

export interface ProviderNoteTemplate {
    id: string;
    name: string;
    /** @deprecated Use hpiExpanderAbbrs */
    hpiExpanderAbbr?: string;
    hpiExpanderAbbrs?: string[];
    hpiText?: string;
    peDepth?: 'focused' | 'comprehensive' | 'custom';
    /** @deprecated Use peExpanderAbbrs */
    peExpanderAbbr?: string;
    peExpanderAbbrs?: string[];
    peText?: string;
    peBlockKeys?: string[];
    /** @deprecated Use assessmentExpanderAbbrs */
    assessmentExpanderAbbr?: string;
    assessmentExpanderAbbrs?: string[];
    assessmentText?: string;
    planOrderSetId?: string;
    /** @deprecated Use planExpanderAbbrs */
    planExpanderAbbr?: string;
    planExpanderAbbrs?: string[];
    planText?: string;
}

export interface UserTypes {
    firstName?: string;
    lastName?: string;
    middleInitial?: string;
    credential?: Credential;
    rank?: Rank;
    component?: Component;
    /** Unit Identification Code */
    uic?: string;
    /** Clinic name resolved from the user's clinic_id association */
    clinicName?: string;
    /** Dev-only: login alerts, account requests, feedback */
    notifyDevAlerts?: boolean;
    /** Default: include HPI section when writing notes */
    noteIncludeHPI?: boolean;
    /** Default: include Physical Exam section when writing notes */
    noteIncludePE?: boolean;
    /** PE depth: 'focused', 'comprehensive', or 'custom' */
    peDepth?: 'focused' | 'comprehensive' | 'custom';
    /** User-defined custom PE blocks (kept for backward-compat migration) */
    customPEBlocks?: CustomPEBlock[];
    /** User-defined named exam templates (custom mode) */
    customExamTemplates?: CustomExamTemplate[];
    /** Provider comprehensive exam template (customized block list + hidden options) */
    comprehensivePETemplate?: ComprehensivePETemplate;
    /** User-defined text expander abbreviations */
    textExpanders?: TextExpander[];
    /** Whether text expander is active in the HPI field */
    textExpanderEnabled?: boolean;
    /** Default: include Plan section when writing notes */
    noteIncludePlan?: boolean;
    /** User-defined order tags per category */
    planOrderTags?: PlanOrderTags;
    /** User-defined instruction tags */
    planInstructionTags?: string[];
    /** User-defined order sets (preset tag combinations) */
    planOrderSets?: PlanOrderSet[];
    /** TC3 (Battle Injury) mode — switches main content to DD 1380 card */
    tc3Mode?: boolean;
    /** Favorite medication trade names (icon field) pinned to the top of the list */
    favoriteMedications?: string[];
    /** Provider note templates — composable skeletons from expanders + plan blocks */
    providerNoteTemplates?: ProviderNoteTemplate[];
}

export const credentials: Credential[] = ['EMT-B', 'EMT-A', 'EMT-P', 'PA-C', 'NP', 'MD', 'DO'];
export const components: Component[] = ['USA', 'USN', 'USMC', 'USAF'];

/** Ranks organized by DoD component, in ascending grade order */
export const ranksByComponent: Record<Component, readonly string[]> = {
    USA: ['PV1', 'PV2', 'PFC', 'SPC', 'CPL', 'SGT', 'SSG', 'SFC', 'MSG', '1SG', 'SGM', 'CSM', '2LT', '1LT', 'CPT', 'MAJ', 'LTC', 'COL'],
    USN: ['SR', 'SA', 'SN', 'PO3', 'PO2', 'PO1', 'CPO', 'SCPO', 'MCPO', 'ENS', 'LTJG', 'LT', 'LCDR', 'CDR', 'CAPT'],
    USMC: ['Pvt', 'PFC', 'LCpl', 'Cpl', 'Sgt', 'SSgt', 'GySgt', 'MSgt', '1stSgt', 'MGySgt', 'SgtMaj', '2ndLt', '1stLt', 'Capt', 'Maj', 'LtCol', 'Col'],
    USAF: ['AB', 'Amn', 'A1C', 'SrA', 'SSgt', 'TSgt', 'MSgt', 'SMSgt', 'CMSgt', '2d Lt', '1st Lt', 'Capt', 'Maj', 'Lt Col', 'Col'],
};

/** Flat ranks array — first 12 entries preserve legacy encoding indices */
export const ranks: string[] = (() => {
    const legacy = ['PV1', 'PV2', 'PFC', 'SPC', 'SGT', 'SSG', 'SFC', 'MSG', '1LT', 'CPT', 'MAJ', 'LTC'];
    const seen = new Set(legacy);
    const additional: string[] = [];
    for (const list of Object.values(ranksByComponent)) {
        for (const r of list) {
            if (!seen.has(r)) {
                seen.add(r);
                additional.push(r);
            }
        }
    }
    return [...legacy, ...additional];
})();

// signature example: Signed: Conner Christopher D PA-C, CPT, USA
