export type Credential = 'EMT-B' | 'EMT-A' | 'EMT-P' | 'PA-C' | 'NP' | 'MD' | 'DO';
export type Rank = 'PV1' | 'PV2' | 'PFC' | 'SPC' | 'SGT' | 'SSG' | 'SFC' | 'MSG' | '1LT' | 'CPT' | 'MAJ' | 'LTC';
export type Component = 'USA' | 'USN' | 'USMC' | 'USAF';

export interface UserTypes {
    firstName?: string;
    lastName?: string;
    middleInitial?: string;
    credential?: Credential;
    rank?: Rank;
    component?: Component;
}

export const credentials: Credential[] = ['EMT-B', 'EMT-A', 'EMT-P', 'PA-C', 'NP', 'MD', 'DO'];
export const ranks: Rank[] = ['PV1', 'PV2', 'PFC', 'SPC', 'SGT', 'SSG', 'SFC', 'MSG', '1LT', 'CPT', 'MAJ', 'LTC'];
export const components: Component[] = ['USA', 'USN', 'USMC', 'USAF'];

// signature example: Signed: Conner Christopher D PA-C, CPT, USA
