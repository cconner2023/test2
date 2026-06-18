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
    /** Pre-selected value when expanded inline (first option used if unset) */
    defaultValue?: string;
    /**
     * When true, the chosen value is NOT typed into the note — it is only stored
     * to drive a linked BranchNode (matched on triggerField). Use for a
     * branch-only selector (e.g. pick "ENT | MSK" to swap in a path without
     * inserting the word itself). A no-insert choice is meaningless without a
     * branch, so it is treated as non-flat (always edited in template mode).
     */
    noInsert?: boolean;
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
