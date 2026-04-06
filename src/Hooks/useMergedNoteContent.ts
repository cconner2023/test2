import { useMemo } from 'react';
import type { TextExpander, PlanOrderTags, PlanOrderSet, PlanOrderCategory } from '../Data/User';
import { useUserProfile } from './useUserProfile';
import { useAuthStore } from '../stores/useAuthStore';

export function useMergedNoteContent() {
    const { profile } = useUserProfile();
    const clinicTextExpanders = useAuthStore(s => s.clinicTextExpanders);
    const clinicPlanOrderTags = useAuthStore(s => s.clinicPlanOrderTags);
    const clinicPlanInstructionTags = useAuthStore(s => s.clinicPlanInstructionTags);
    const clinicPlanOrderSets = useAuthStore(s => s.clinicPlanOrderSets);

    const expanders = useMemo<TextExpander[]>(() => {
        const personal = profile?.textExpanders ?? [];
        return [...clinicTextExpanders, ...personal];
    }, [profile?.textExpanders, clinicTextExpanders]);

    const orderTags = useMemo<PlanOrderTags>(() => {
        const personal = profile?.planOrderTags;
        const clinic = clinicPlanOrderTags;
        const categories: PlanOrderCategory[] = ['meds', 'lab', 'radiology', 'referral', 'followUp'];
        const merged = {} as PlanOrderTags;
        for (const cat of categories) {
            merged[cat] = [...new Set([...(clinic?.[cat] ?? []), ...(personal?.[cat] ?? [])])];
        }
        return merged;
    }, [profile?.planOrderTags, clinicPlanOrderTags]);

    const instructionTags = useMemo<string[]>(() => {
        const personal = profile?.planInstructionTags ?? [];
        const clinic = clinicPlanInstructionTags ?? [];
        return [...new Set([...clinic, ...personal])];
    }, [profile?.planInstructionTags, clinicPlanInstructionTags]);

    const orderSets = useMemo<PlanOrderSet[]>(() => {
        const personal = profile?.planOrderSets ?? [];
        const clinic = clinicPlanOrderSets ?? [];
        return [...clinic, ...personal];
    }, [profile?.planOrderSets, clinicPlanOrderSets]);

    return { expanders, orderTags, instructionTags, orderSets };
}
