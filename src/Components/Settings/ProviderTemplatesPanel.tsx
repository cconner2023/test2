import { useState, useCallback, useRef } from 'react';
import { Plus } from 'lucide-react';
import { useUserProfile } from '../../Hooks/useUserProfile';
import { useAuthStore } from '../../stores/useAuthStore';
import type { UserTypes, ProviderNoteTemplate } from '../../Data/User';
import { PROVIDER_TOUR_TEMPLATE_PREFIX } from '../../Data/GuidedTourData';
import { ActionPill } from '../ActionPill';
import { ActionButton } from '../ActionButton';
import { CsvActionsMenu } from './CsvActionsMenu';
import { exportProviderTemplatesCSV } from '../../Utilities/noteBlocksCSV';
import { ProviderTemplateEditPopover, type EditState } from '../Provider/ProviderTemplateEditPopover';

function fieldPreview(t: ProviderNoteTemplate): string {
    const parts: string[] = [];
    if (t.hpiExpanderAbbrs?.length || t.hpiExpanderAbbr || t.hpiText) parts.push('HPI');
    if (t.peBlockKeys?.length) parts.push(`PE (${t.peBlockKeys.length})`);
    else if (t.peExpanderAbbrs?.length || t.peExpanderAbbr || t.peText) parts.push('PE');
    if (t.assessmentExpanderAbbrs?.length || t.assessmentExpanderAbbr || t.assessmentText) parts.push('Assess');
    if (t.planExpanderAbbrs?.length || t.planExpanderAbbr || t.planOrderSetId || t.planText) parts.push('Plan');
    return parts.join(' · ') || 'Empty';
}

// ── Main panel ──────────────────────────────────────────────────────────────

export const ProviderTemplatesPanel = () => {
    const { profile, updateProfile, syncProfileField } = useUserProfile();
    const clinicPlanOrderSets = useAuthStore(s => s.clinicPlanOrderSets);

    const templates = profile.providerNoteTemplates ?? [];
    const orderSets = [...(clinicPlanOrderSets ?? []), ...(profile.planOrderSets ?? [])];

    const [editState, setEditState] = useState<EditState | null>(null);
    const fabRef = useRef<HTMLDivElement>(null);

    const handleUpdate = useCallback((next: ProviderNoteTemplate[]) => {
        updateProfile({ providerNoteTemplates: next });
        syncProfileField({ provider_note_templates: next as unknown as UserTypes['providerNoteTemplates'] });
    }, [updateProfile, syncProfileField]);

    const handleSave = useCallback((entry: ProviderNoteTemplate, isNew: boolean) => {
        const next = isNew
            ? [...templates, entry]
            : templates.map(t => t.id === entry.id ? entry : t);
        handleUpdate(next);
        setEditState(null);
    }, [templates, handleUpdate]);

    const handleDelete = useCallback((id: string) => {
        handleUpdate(templates.filter(t => t.id !== id));
        setEditState(null);
    }, [templates, handleUpdate]);

    return (
        <div className="h-full overflow-y-auto" data-tour="settings-provider-templates">
            <div className="px-5 pb-4 space-y-5 pt-[calc(var(--drawer-header-h,3.5rem)+0.75rem)]">
                <p className="text-[10pt] text-tertiary leading-relaxed">
                    Compose note skeletons with HPI, exam, assessment, and plan presets. Apply them to pre-fill fields.
                </p>

                <section className="space-y-3">
                    <div className="pb-2">
                        <p className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">Templates</p>
                    </div>

                    <div className="relative"><div className="rounded-xl bg-themewhite2 overflow-hidden">
                        <div className="px-4 py-3">
                            {templates.length > 0 ? (
                                <div className="space-y-0.5">
                                    {templates.map(t => {
                                        const isTourTemplate = t.id.startsWith(PROVIDER_TOUR_TEMPLATE_PREFIX);
                                        return (
                                            <button
                                                key={t.id}
                                                type="button"
                                                data-tour={isTourTemplate ? 'provider-demo-template' : undefined}
                                                onClick={(e) => setEditState({
                                                    mode: 'edit',
                                                    anchor: e.currentTarget.getBoundingClientRect(),
                                                    template: t,
                                                })}
                                                className="w-full text-left py-2 px-2 rounded-lg cursor-pointer active:scale-[0.98] hover:bg-tertiary/5 transition-all"
                                            >
                                                <p className="text-sm font-medium text-primary truncate">{t.name}</p>
                                                <p className="text-[9pt] text-tertiary mt-0.5 pl-0.5 break-words">
                                                    {fieldPreview(t)}
                                                </p>
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="text-sm text-tertiary py-4 text-center">
                                    No templates configured
                                </p>
                            )}
                        </div>
                        </div>
                        <ActionPill ref={fabRef} shadow="sm" placement="overlay">
                            <CsvActionsMenu
                                kind="providerTemplates"
                                hasData={templates.length > 0}
                                onExportCsv={() => exportProviderTemplatesCSV(templates, orderSets)}
                            />
                            <ActionButton
                                icon={Plus}
                                label="New template"
                                onClick={() => fabRef.current && setEditState({
                                    mode: 'new',
                                    anchor: fabRef.current.getBoundingClientRect(),
                                })}
                            />
                        </ActionPill>
                    </div>
                </section>
            </div>

            <ProviderTemplateEditPopover
                state={editState}
                onClose={() => setEditState(null)}
                onSave={handleSave}
                onDelete={handleDelete}
            />
        </div>
    );
};

