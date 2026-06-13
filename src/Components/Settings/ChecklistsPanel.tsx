import { PreCombatChecksSection } from '../Calendar/PreCombatChecksSection';

/**
 * Supervisor-visible Checklists editor, surfaced under Note Content.
 * Wraps the shared PreCombatChecksSection (clinic-scoped checklist templates).
 * Lives here rather than cluster management because checklists are note
 * content, not cluster administration.
 */
export const ChecklistsPanel = () => {
    return (
        <div className="h-full overflow-y-auto">
            <div className="px-5 pb-4 space-y-5 pt-[calc(var(--drawer-header-h,3.5rem)+0.75rem)]">
                <p className="text-[10pt] text-tertiary leading-relaxed">
                    Reusable checklists supervisors can attach to calendar events.
                </p>
                <PreCombatChecksSection />
            </div>
        </div>
    );
};
