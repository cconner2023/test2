import type { TemplateNode, TextNode, StepNode, ChoiceNode } from '../Data/TemplateTypes';

export interface FieldInfo {
    type: 'variable' | 'dropdown';
    options?: string[];
    defaultValue?: string;
}

/**
 * Check if a TemplateNode[] is "flat" (no branches) — can be shown in the
 * simple text editor with [field] markers.
 */
export function isFlatTemplate(nodes: TemplateNode[]): boolean {
    return nodes.every(n => n.type === 'text' || n.type === 'step' || n.type === 'choice');
}

/**
 * Parse expansion text containing [field] markers into TemplateNode[].
 * Only markers whose label exists in `fields` are treated as nodes —
 * any other bracketed text stays as literal TextNode content.
 */
export function parseFieldText(
    text: string,
    fields: Record<string, FieldInfo>,
): TemplateNode[] {
    // Trim leading/trailing whitespace to avoid stray newlines from contentEditable
    const trimmed = text.trim();
    if (!trimmed) return [];

    const nodes: TemplateNode[] = [];
    const parts = trimmed.split(/(\[[^\]]+\])/);

    for (const part of parts) {
        if (!part) continue;

        const match = part.match(/^\[([^\]]+)\]$/);
        if (match && fields[match[1]]) {
            const label = match[1];
            const field = fields[label];
            if (field.type === 'dropdown' && field.options?.length) {
                const node: ChoiceNode = { type: 'choice', label, options: field.options };
                if (field.defaultValue) node.defaultValue = field.defaultValue;
                nodes.push(node);
            } else {
                nodes.push({ type: 'step', label } satisfies StepNode);
            }
        } else {
            nodes.push({ type: 'text', content: part } satisfies TextNode);
        }
    }

    return nodes;
}

/**
 * Convert a flat TemplateNode[] back to expansion text + field metadata.
 * Returns null if nodes contain branches (not representable in simple mode).
 */
export function templateNodesToFieldText(
    nodes: TemplateNode[],
): { text: string; fields: Record<string, FieldInfo> } | null {
    if (!isFlatTemplate(nodes)) return null;

    let text = '';
    const fields: Record<string, FieldInfo> = {};

    for (const node of nodes) {
        switch (node.type) {
            case 'text':
                text += node.content;
                break;
            case 'step':
                text += `[${node.label}]`;
                fields[node.label] = { type: 'variable' };
                break;
            case 'choice':
                text += `[${node.label}]`;
                fields[node.label] = {
                    type: 'dropdown',
                    options: [...node.options],
                    defaultValue: node.defaultValue,
                };
                break;
        }
    }

    return { text, fields };
}
