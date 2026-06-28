import type { TemplateNode } from './TemplateTypes';
import type { AvatarBlob } from '../Types/SupervisorTestTypes';
import type { SwipeActions } from '../Utilities/swipeActions';

export type Credential =
    | 'EMT-B' | 'EMT-A' | 'EMT-P'
    | 'PA-C' | 'NP' | 'MD' | 'DO'
    | 'RN' | 'LPN' | 'CNA' | 'APRN' | 'CRNA' | 'CNM'
    | 'RRT' | 'PharmD' | 'RPh' | 'MA' | 'CMA'
    | 'LCSW' | 'LPC' | 'PsyD' | 'PhD' | 'BHT';
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

/** @deprecated Use MASTER_BLOCKS from PhysicalExamData instead. Kept for backward compat. */
export interface CustomPEBlock {
    id: string;
    name: string;
    normalText: string;
    abnormalTags: string[];
}

export interface CustomExamTemplate {
    id: string;
    name: string;
    /** Stores master block keys from MASTER_BLOCKS */
    blockIds: string[];
    /** @deprecated Was used for user-defined custom blocks */
    customBlocks?: CustomPEBlock[];
}

/** @deprecated Use CustomExamTemplate with MASTER_BLOCKS instead. Kept for backward compat. */
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
    /** @deprecated Use peExpanderAbbrs */
    peExpanderAbbr?: string;
    peExpanderAbbrs?: string[];
    peText?: string;
    /** Stores master block keys from MASTER_BLOCKS */
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
    /** Clinics the user is currently loaned to (up to 4). Empty when home-only. */
    surrogateClinics?: { id: string; name: string }[];
    /**
     * Intra-clinic sub-cluster (platoon/squad) this user sits in. null = HQ /
     * parent bucket (unassigned). Render-only grouping within the SAME clinicVault
     * — drives the default squad-vs-all lens for calendar/property/training.
     * Never an access boundary (see v2/supervisor sub-cluster drawer).
     */
    subClusterId?: string | null;
    /**
     * Clinics whose note content (text templates / order sets / plan tags) this
     * user merges into note-writing, chosen from {home} ∪ surrogateClinics.
     * null = never configured → defaults to home only (loans are opt-in). The
     * merge always intersects this with current valid memberships, so a stale id
     * for an ended loan is harmless. Personal blocks are always merged regardless.
     */
    noteTemplateClinicIds?: string[] | null;
    /**
     * Highest UserAcknowledgment version this user has accepted. Server-persisted
     * (profiles.ack_version_accepted) so the one-time PHI disclosure survives
     * browser-storage eviction and never re-fires for authenticated users.
     * Compared against ACK_VERSION; a bump re-prompts once. Guests are not gated
     * on this (they see the disclosure every open).
     */
    ackVersionAccepted?: number | null;
    /** Dev-only: login alerts, account requests, feedback */
    notifyDevAlerts?: boolean;
    /** Opt-in: push when assigned to a calendar event */
    notifyCalendarAssignments?: boolean;
    /** @deprecated Use MASTER_BLOCKS from PhysicalExamData. Kept for backward compat. */
    customPEBlocks?: CustomPEBlock[];
    /** User-defined named exam templates (custom mode) */
    customExamTemplates?: CustomExamTemplate[];
    /** @deprecated Use CustomExamTemplate with MASTER_BLOCKS instead. Kept for backward compat. */
    comprehensivePETemplate?: ComprehensivePETemplate;
    /** User-defined text expander abbreviations */
    textExpanders?: TextExpander[];
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
    /** Mission overview widget selection — null hides the panel entirely */
    overviewWidgets?: OverviewWidgetId[] | null
    /** Appearance theme ID, e.g. "default-dark". Synced to Supabase for cross-device persistence. */
    theme?: string
    /** Chat-message swipe bindings (per direction). Synced to Supabase (profiles.swipe_actions) for cross-device persistence — same train as `theme`. */
    swipeActions?: SwipeActions | null
    /**
     * Whether to receive incoming medic↔medic calls. false = silenced (soft
     * block): callers are auto-declined and fall into the voicemail path.
     * Clinic on-call presence (clinics.oncall) is a hard runtime override — while
     * on-call you always ring regardless of this flag. Synced to profiles.allow_calls
     * (same train as `theme`/`swipeActions`). undefined → treated as true (allow).
     */
    allowCalls?: boolean
    /**
     * Avatar selector: a preset avatar id, 'initials', or 'custom'. Lives on the
     * profiles row; the single profiles-row realtime sub (useProfileRealtime)
     * applies cross-device changes as a delta. undefined = profile not loaded
     * yet; null = nothing set remotely. Consumed by useProfileAvatar.
     */
    avatarId?: string | null
    /** Encrypted custom photo blob, present when avatarId === 'custom'. */
    avatarBlob?: AvatarBlob | null
}

export type OverviewWidgetId = 'task-list' | 'map-overlay' | 'kanban' | 'week-view' | 'messages' | 'weather' | 'huddle'

export const OVERVIEW_WIDGET_META: Record<OverviewWidgetId, { label: string; subtitle: string; disabled?: boolean }> = {
  'task-list':   { label: 'Task List',    subtitle: 'Your assigned tasks for the day' },
  'map-overlay': { label: 'Map',          subtitle: 'Mission area map thumbnail' },
  'kanban':      { label: 'Kanban',       subtitle: 'Events grouped by status' },
  'week-view':   { label: 'Week View',    subtitle: '7-day event summary strip' },
  'messages':    { label: 'Messages',     subtitle: 'Recent encrypted messages' },
  'weather':     { label: 'Weather',      subtitle: 'Current temp, humidity & heat category' },
  'huddle':      { label: 'Daily Huddle', subtitle: "Today's huddle by station" },
}

// NOTE: order matters — noteParser.ts encodes credential by array index.
// Append new entries to the END only; never reorder or remove existing entries.
export const credentials: Credential[] = [
    // Prehospital (legacy indices 0-2)
    'EMT-B', 'EMT-A', 'EMT-P',
    // Provider (legacy indices 3-6)
    'PA-C', 'NP', 'MD', 'DO',
    // Nursing
    'RN', 'LPN', 'CNA', 'APRN', 'CRNA', 'CNM',
    // Allied / Tech
    'RRT', 'PharmD', 'RPh', 'MA', 'CMA',
    // Behavioral Health
    'LCSW', 'LPC', 'PsyD', 'PhD', 'BHT',
];
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
