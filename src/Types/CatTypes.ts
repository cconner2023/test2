import { type medListTypes } from "../Data/MedData"

export type GuidelineType = 'gen' | 'medcom' | 'stp' | 'stp-task' | 'DDX';

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
    id: number,
    icon: string,
    text: string,
    isParent: boolean
    options: subjectAreaArrayOptions[]
}
export interface subjectAreaArrayOptions {
    id: number,
    icon: string,
    text: string,
    isParent: boolean
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
    type: 'category' | 'CC' | 'training' | 'DDX' | 'medication' | 'screener' | 'calculator';
    id: number;
    icon: string;
    text: string;
    // Unified data fields
    data?: {
        categoryId?: number;
        symptomId?: number;
        medicationData?: medListTypes;
        guidelineType?: GuidelineType;
        guidelineId?: number;
        taskId?: string;
        skillLevel?: string;
        subjectArea?: string;
        categoryRef?: catDataTypes;
        symptomRef?: subCatDataTypes;
        kbCategoryId?: string;
    };
}

export type MenuGroup = 'core' | 'field' | 'management' | 'system'

export interface sideMenuDataType {
    text: string,
    icon: string,
    action: string,
    group: MenuGroup,
    gateKey?: 'authenticated' | 'property' | 'supervisor' | 'admin' | 'lora' | 'mapOverlay' | 'calendar' | 'provider',
    badge?: boolean
}