import { type medListTypes } from "../Data/MedData"

export interface AlgorithmType {
    id: string,
    options?: AlgorithmOptions[]
}
export interface AlgorithmOptions {
    text: string,
    type: "choice" | "count" | "action" | "initial" | 'rf',
    questionOptions: questionOptions[],
    answerOptions: answerOptions[],
    initialVisible?: boolean
}

export interface questionOptions {
    text: string
}
export interface answerOptions {
    text: string,
    disposition: dispositionType[],
    decisionMaking?: decisionMakingType[] | null,
    next: number | number[] | null,
    selectAll: boolean
}

export interface dispositionType {
    type: "CAT I" | "CAT II" | "CAT III" | "OTHER",
    text: string,
    modifier?: string | null,
}

export interface decisionMakingType {
    type?: 'lim' | 'mcp' | 'dmp';
    text?: string;
    assocMcp?: decisionMakingType;  // Self-referential for MCP association
    ancillaryFind?: ancillaryFindType[];
    medFind?: medListTypes[];
    specLim?: string[];  // Changed to string array
    ddx?: string[];
}

// Other types remain the same
export interface ancillaryFindType {
    type?: 'lab' | 'med' | 'rad' | 'refer' | 'protocol';
    modifier?: string;
}