import { useState, useCallback, useRef } from 'react';
import type { TemplateNode, StepNode, ChoiceNode, BranchNode } from '../Data/TemplateTypes';
import { processTextNodes } from '../Utilities/templateEngine';

/** An inline BranchNode that has its own options and pauses for user input */
type InlineBranch = BranchNode & { label: string; options: string[] };

function isInlineBranch(node: TemplateNode): node is InlineBranch {
    return node.type === 'branch' && !!node.label && Array.isArray(node.options) && node.options.length > 0;
}

export type ActiveNode = StepNode | ChoiceNode | InlineBranch;

interface TemplateSessionState {
    isActive: boolean;
    nodeQueue: TemplateNode[];
    filledValues: Record<string, string>;
    activeNode: ActiveNode | null;
    insertPosition: number;
    showDropdown: boolean;
    dropdownDismissed: boolean;
    selectedChoiceIndex: number;
}

const initialState: TemplateSessionState = {
    isActive: false,
    nodeQueue: [],
    filledValues: {},
    activeNode: null,
    insertPosition: 0,
    showDropdown: false,
    dropdownDismissed: false,
    selectedChoiceIndex: -1,
};

export function useTemplateSession() {
    const [state, setState] = useState<TemplateSessionState>(initialState);
    const stepStartRef = useRef(0);

    const advanceQueue = useCallback((
        queue: TemplateNode[],
        filledValues: Record<string, string>,
        currentText: string,
        insertPos: number,
    ): { newText: string; cursorPosition: number; newState: Partial<TemplateSessionState> } => {
        let text = currentText;
        let cursor = insertPos;
        let i = 0;

        while (i < queue.length) {
            const node = queue[i];

            if (node.type === 'text') {
                const { textToInsert, nextIndex } = processTextNodes(queue, i);
                if (textToInsert) {
                    text = text.slice(0, cursor) + textToInsert + text.slice(cursor);
                    cursor += textToInsert.length;
                }
                i = nextIndex;
                continue;
            }

            if (node.type === 'branch') {
                // Inline branch — pause and show its own choice UI
                if (isInlineBranch(node)) {
                    return {
                        newText: text,
                        cursorPosition: cursor,
                        newState: {
                            isActive: true,
                            nodeQueue: queue.slice(i + 1),
                            filledValues,
                            activeNode: node,
                            insertPosition: cursor,
                            showDropdown: true,
                            dropdownDismissed: false,
                            selectedChoiceIndex: -1,
                        },
                    };
                }
                // Linked branch — resolve using filledValues
                const chosen = filledValues[node.triggerField];
                const branchChildren = (chosen && node.branches[chosen]) ? node.branches[chosen] : [];
                const newQueue = [...branchChildren, ...queue.slice(i + 1)];
                return advanceQueue(newQueue, filledValues, text, cursor);
            }

            // step or choice — pause
            if (node.type === 'step' || node.type === 'choice') {
                // Pre-select the default option for choice nodes
                let defaultIdx = -1;
                if (node.type === 'choice' && node.defaultValue) {
                    const filtered = node.options.filter(o => o.trim() !== '');
                    defaultIdx = filtered.indexOf(node.defaultValue);
                }

                return {
                    newText: text,
                    cursorPosition: cursor,
                    newState: {
                        isActive: true,
                        nodeQueue: queue.slice(i + 1),
                        filledValues,
                        activeNode: node,
                        insertPosition: cursor,
                        showDropdown: node.type === 'choice',
                        dropdownDismissed: false,
                        selectedChoiceIndex: defaultIdx,
                    },
                };
            }

            i++;
        }

        return {
            newText: text,
            cursorPosition: cursor,
            newState: { ...initialState },
        };
    }, []);

    const startSession = useCallback((
        currentText: string,
        cursorPos: number,
        template: TemplateNode[],
    ): { newText: string; cursorPosition: number } => {
        const result = advanceQueue(template, {}, currentText, cursorPos);
        setState((prev) => ({ ...prev, ...result.newState }));
        stepStartRef.current = result.cursorPosition;
        return { newText: result.newText, cursorPosition: result.cursorPosition };
    }, [advanceQueue]);

    const fillCurrentAndAdvance = useCallback((
        currentText: string,
        value: string,
    ): { newText: string; cursorPosition: number } | null => {
        const { activeNode, nodeQueue, filledValues, insertPosition } = state;
        if (!activeNode) return null;

        const newFilledValues = { ...filledValues, [activeNode.label]: value };

        let newText: string;
        let cursorAfter: number;

        if (activeNode.type === 'branch') {
            // Inline branch — do NOT insert value, splice matching branch children
            newText = currentText;
            cursorAfter = insertPosition;
            const branchChildren = activeNode.branches[value] ?? [];
            const mergedQueue = [...branchChildren, ...nodeQueue];
            const result = advanceQueue(mergedQueue, newFilledValues, newText, cursorAfter);
            setState((prev) => ({
                ...prev,
                ...result.newState,
                filledValues: result.newState.filledValues ?? newFilledValues,
            }));
            stepStartRef.current = result.cursorPosition;
            return { newText: result.newText, cursorPosition: result.cursorPosition };
        }

        // Step or Choice — insert value into text
        cursorAfter = insertPosition + value.length;
        const existingText = currentText.slice(insertPosition);
        if (existingText.startsWith(value)) {
            newText = currentText;
        } else {
            newText = currentText.slice(0, insertPosition) + value + currentText.slice(insertPosition);
        }

        const result = advanceQueue(nodeQueue, newFilledValues, newText, cursorAfter);
        setState((prev) => ({
            ...prev,
            ...result.newState,
            filledValues: result.newState.filledValues ?? newFilledValues,
        }));
        stepStartRef.current = result.cursorPosition;
        return { newText: result.newText, cursorPosition: result.cursorPosition };
    }, [state, advanceQueue]);

    const dismissDropdown = useCallback(() => {
        setState((prev) => ({
            ...prev,
            showDropdown: false,
            dropdownDismissed: true,
            selectedChoiceIndex: -1,
        }));
    }, []);

    /** Total selectable items: options + "Other" for choice, just options for inline branch */
    const getChoiceCount = useCallback(() => {
        const { activeNode } = state;
        if (!activeNode || !state.showDropdown) return 0;
        if (activeNode.type === 'choice') {
            return activeNode.options.filter((o) => o.trim() !== '').length + 1; // +1 for "Other"
        }
        if (activeNode.type === 'branch' && activeNode.options) {
            return activeNode.options.filter((o) => o.trim() !== '').length; // no "Other"
        }
        return 0;
    }, [state]);

    const selectNextChoice = useCallback(() => {
        const count = getChoiceCount();
        if (count === 0) return;
        setState((prev) => ({
            ...prev,
            selectedChoiceIndex: (prev.selectedChoiceIndex + 1) % count,
        }));
    }, [getChoiceCount]);

    const selectPrevChoice = useCallback(() => {
        const count = getChoiceCount();
        if (count === 0) return;
        setState((prev) => ({
            ...prev,
            selectedChoiceIndex: (prev.selectedChoiceIndex - 1 + count) % count,
        }));
    }, [getChoiceCount]);

    const endSession = useCallback(() => {
        setState(initialState);
    }, []);

    return {
        session: state,
        stepStartRef,
        startSession,
        fillCurrentAndAdvance,
        dismissDropdown,
        selectNextChoice,
        selectPrevChoice,
        endSession,
    };
}
