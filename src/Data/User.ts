export type Credential = 'EMT-B' | 'EMT-A' | 'EMT-P' | 'PA-C' | 'NP' | 'MD' | 'DO';
export type Component = 'USA' | 'USN' | 'USMC' | 'USAF';
export type Rank = string;

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
    /** Whether the user wants push notifications (synced to cloud) */
    notificationsEnabled?: boolean;
    /** Notify when a clinic member contributes a note */
    notifyClinicNotes?: boolean;
    /** Dev-only: login alerts, account requests, feedback */
    notifyDevAlerts?: boolean;
    /** Default: include HPI section when writing notes */
    noteIncludeHPI?: boolean;
    /** Default: include Physical Exam section when writing notes */
    noteIncludePE?: boolean;
    /** PE depth: 'minimal' (vitals + free-text), 'expanded' (vitals + category items, all default normal) */
    peDepth?: 'minimal' | 'expanded';
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
