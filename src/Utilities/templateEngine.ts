import type { TemplateNode, ChoiceNode } from '../Data/TemplateTypes';

/**
 * Consumes consecutive text nodes from queue starting at startIndex.
 * Returns the combined text and the index of the next non-text node.
 */
export function processTextNodes(
    queue: TemplateNode[],
    startIndex: number,
): { textToInsert: string; nextIndex: number } {
    let text = '';
    let i = startIndex;
    while (i < queue.length && queue[i].type === 'text') {
        text += (queue[i] as { type: 'text'; content: string }).content;
        i++;
    }
    return { textToInsert: text, nextIndex: i };
}

/**
 * Returns all Choice labels in a template (for Branch trigger field selection in builder).
 */
export function getChoiceLabels(nodes: TemplateNode[]): string[] {
    const labels: string[] = [];
    for (const node of nodes) {
        if (node.type === 'choice') {
            labels.push(node.label);
        } else if (node.type === 'branch') {
            for (const branchNodes of Object.values(node.branches)) {
                labels.push(...getChoiceLabels(branchNodes));
            }
        }
    }
    return labels;
}

/**
 * Finds a ChoiceNode by label, searching recursively through branches.
 */
export function findChoiceByLabel(nodes: TemplateNode[], label: string): ChoiceNode | null {
    for (const n of nodes) {
        if (n.type === 'choice' && n.label === label) return n;
        if (n.type === 'branch') {
            for (const branchNodes of Object.values(n.branches)) {
                const found = findChoiceByLabel(branchNodes, label);
                if (found) return found;
            }
        }
    }
    return null;
}
