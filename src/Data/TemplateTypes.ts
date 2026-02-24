export interface TextNode {
    type: 'text';
    content: string;
}

export interface StepNode {
    type: 'step';
    label: string;
}

export interface ChoiceNode {
    type: 'choice';
    label: string;
    options: string[];
}

export interface BranchNode {
    type: 'branch';
    /** Linked mode: references a previous ChoiceNode's label */
    triggerField: string;
    branches: Record<string, TemplateNode[]>;
    /** Inline mode: when set, branch shows its own choice UI at runtime (value is NOT inserted into text) */
    label?: string;
    options?: string[];
}

export type TemplateNode = TextNode | StepNode | ChoiceNode | BranchNode;
