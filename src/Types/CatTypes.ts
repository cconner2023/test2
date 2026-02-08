import { type medListTypes } from "../Data/MedData"

export interface catDataTypes {
    id: number,
    icon: string,
    text: string,
    isParent: boolean,
    contents: subCatDataTypes[]
}
export interface subCatDataTypes {
    id: number,
    icon: string,
    text: string,
    description?: string, // Add this if you need descriptions
    gen: subCatGen[],
    medcom: medcom[],
    stp: subjectAreaArray[] | subjectAreaArrayOptions[],
    redFlags?: redflags[],
    DDX?: differential[],
}


export interface subCatGen {
    pg?: {
        start?: number,
        end?: number
    }
    text?: string
}
export interface medcom {
    id?: number,
    icon?: string,
    text?: string
}
export interface stp {
    id?: number,
    icon?: string,
    subjectArea?: number
    text?: string,
}

export interface subjectAreaArray {
    id?: number,
    icon?: string,
    text?: string,
    isParent?: boolean
    options: subjectAreaArrayOptions[]
}
export interface subjectAreaArrayOptions {
    id?: number,
    icon?: string,
    text?: string,
    isParent?: boolean
    parentId: number
}

export interface redflags {
    text?: string
}

export interface differential {
    text?: string
}

// Types/CatTypes.ts - Update SearchResultType
export type SearchResultType = {
    type: 'category' | 'CC' | 'training' | 'DDX' | 'medication';
    id: number;
    icon: string;
    text: string;
    // Unified data fields
    data?: {
        categoryId?: number;
        symptomId?: number;
        medicationData?: medListTypes;
        guidelineType?: 'gen' | 'medcom' | 'stp' | 'DDX';
        guidelineId?: number;
        categoryRef?: catDataTypes;
        symptomRef?: subCatDataTypes;
    };
}

export interface sideMenuDataType {
    text: string,
    icon: string,
    action: string
}