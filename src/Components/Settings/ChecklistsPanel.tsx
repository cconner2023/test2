import { useMemo } from 'react';
import { useAuth } from '../../Hooks/useAuth';
import { useClinicPreCombatChecks } from '../../Hooks/useClinicPreCombatChecks';
import { useClinicPropertyPickers } from '../../Hooks/useClinicPropertyPickers';
import { ActionPill } from '../ActionPill';
import { CsvActionsMenu } from './CsvActionsMenu';
import { exportChecklistsCSV } from '../../Utilities/noteBlocksCSV';
import { PreCombatChecksSection } from '../Calendar/PreCombatChecksSection';

/**
 * Supervisor-visible Checklists editor, surfaced under App Content.
 * Wraps the shared PreCombatChecksSection (clinic-scoped checklist templates) and
 * adds CSV import/export. Lives here rather than cluster management because
 * checklists are app content, not cluster administration.
 */
export const ChecklistsPanel = () => {
    const { clinicId: assignedClinicId, supervisingClinicId } = useAuth();
    const clinicId = supervisingClinicId ?? assignedClinicId;
    const checklists = useClinicPreCombatChecks(clinicId);
    const { items, locations } = useClinicPropertyPickers(clinicId);

    const itemNameById = useMemo(() => new Map(items.map(p => [p.id, p.name])), [items]);
    const locationNameById = useMemo(() => new Map(locations.map(p => [p.id, p.name])), [locations]);

    return (
        <div className="h-full overflow-y-auto">
            <div className="px-5 pb-4 space-y-5 pt-[calc(var(--drawer-header-h,3.5rem)+0.75rem)]">
                <div className="flex items-start gap-3">
                    <p className="flex-1 text-[10pt] text-tertiary leading-relaxed">
                        Reusable checklists supervisors can attach to calendar events.
                    </p>
                    <ActionPill shadow="sm">
                        <CsvActionsMenu
                            kind="checklists"
                            hasData={checklists.length > 0}
                            onExportCsv={() => exportChecklistsCSV(checklists, itemNameById, locationNameById)}
                        />
                    </ActionPill>
                </div>
                <PreCombatChecksSection />
            </div>
        </div>
    );
};
