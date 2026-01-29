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

export type SearchResultType = {
    type: 'category' | 'CC' | 'training' | 'DDX' | 'medication';
    id?: number;
    categoryId?: number;
    categoryText?: string;
    contentId?: number;
    contentText?: string;
    guidelineType?: 'gen' | 'medcom' | 'stp' | 'DDX';
    guidelineId?: number;
    icon?: string;
    text?: string;
    medData?: medListTypes
}

export interface sideMenuDataType {
    text: string,
    icon: string,
    action: string
}

export interface SearchBarProps {
    searchInput: string
    onSearchChange: (value: string) => void
}

export interface NavTopProps {
    onMenuClick: () => void
    searchInput: string
    onSearchChange: (value: string) => void
    isMobileSearchOpen: boolean
    onMobileSearchToggle: () => void
}

export interface SearchResultsProps {
    results: SearchResultType[]
    searchTerm: string
    onResultClick: (result: SearchResultType) => void
    isSearching?: boolean
}