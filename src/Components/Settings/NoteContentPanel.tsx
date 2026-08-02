import { ClipboardList, TextCursorInput, ChevronRight, LayoutTemplate, Home, Building2, Sparkles } from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { useTemplateSubscription } from '../../Hooks/useTemplateSubscription';
import { useUserProfile } from '../../Hooks/useUserProfile';
import { useBetaFlag } from '../../lib/betaFeatures';
import { SettingsRow, SettingsToggleRow } from './SettingsToggleRow';
import { SectionCard } from '@/Components/primitives/Section';

interface NoteContentPanelProps {
    onNavigate?: (panel: string) => void;
    /** Desktop: the subpage currently open in the right pane — highlights its row.
     *  Undefined on mobile (subpages slide-push, no persistent selection). */
    activeSubpage?: string;
}

export const NoteContentPanel = ({ onNavigate, activeSubpage }: NoteContentPanelProps) => {
    const isProviderRole = useAuthStore((s) => s.isProviderRole);
    const { isLoaned, memberships, toggle } = useTemplateSubscription();

    // Algorithm → note seeding: opt-in switch. Beta-gated (dev-only) while
    // per-algorithm tagging rolls out; opens to all when the flag is promoted.
    const seedBetaVisible = useBetaFlag('algorithmNoteRouting');
    const { profile, updateProfile, syncProfileField } = useUserProfile();
    const seedOn = profile?.seedAlgorithmNote === true; // default off
    const toggleSeed = () => {
        const next = !seedOn;
        updateProfile({ seedAlgorithmNote: next });        // instant local (memory + localStorage)
        syncProfileField({ seed_algorithm_note: next });   // cross-device push
    };

    const sections: Array<{
        icon: typeof ClipboardList;
        label: string;
        subtitle: string;
        navigateTo: string;
    }> = [
        {
            icon: ClipboardList,
            label: 'Plan',
            subtitle: 'Order tags and order sets',
            navigateTo: 'plan-settings',
        },
        {
            icon: TextCursorInput,
            label: 'Text Templates',
            subtitle: 'Autotext shortcuts for your notes',
            navigateTo: 'text-templates',
        },
    ];

    return (
        <div className="h-full overflow-y-auto">
            <div className="px-5 pb-4 space-y-5 pt-[calc(var(--drawer-header-h,3.5rem)+0.75rem)]">
                <p className="text-[10pt] text-tertiary leading-relaxed">
                    Configure your note sections.
                </p>

                {seedBetaVisible && (
                    <SettingsToggleRow
                        icon={Sparkles}
                        label="Seed note from algorithm"
                        subtitle="Auto-fill HPI, exam, and plan from your triage answers"
                        checked={seedOn}
                        onChange={toggleSeed}
                        card
                    />
                )}

                <SectionCard>
                    {sections.map((section, idx) => (
                        <SettingsRow
                            key={section.label}
                            icon={section.icon}
                            label={section.label}
                            subtitle={section.subtitle}
                            onClick={() => onNavigate?.(section.navigateTo)}
                            divided={idx > 0}
                            className={activeSubpage === section.navigateTo ? 'bg-themeblue3/8' : ''}
                            trailing={<ChevronRight size={16} className="text-tertiary shrink-0" />}
                        />
                    ))}

                    {isProviderRole && (
                        <SettingsRow
                            icon={LayoutTemplate}
                            label="Provider Templates"
                            subtitle="Note skeletons from your shortcuts"
                            onClick={() => onNavigate?.('provider-templates')}
                            divided
                            className={activeSubpage === 'provider-templates' ? 'bg-themeblue3/8' : ''}
                            trailing={<ChevronRight size={16} className="text-tertiary shrink-0" />}
                        />
                    )}
                </SectionCard>

                {isLoaned && (
                    <div className="space-y-2">
                        <div className="px-1">
                            <p className="text-sm font-medium text-primary">Template sources</p>
                            <p className="text-[9pt] text-tertiary mt-0.5">
                                Which clinics' text templates and order sets to mix into your notes. Your personal blocks are always included.
                            </p>
                        </div>
                        <div className="space-y-2">
                            {memberships.map((m) => (
                                <SettingsToggleRow
                                    key={m.id}
                                    icon={m.isHome ? Home : Building2}
                                    label={m.name}
                                    subtitle={m.isHome ? 'Home clinic' : 'Loaned clinic'}
                                    checked={m.subscribed}
                                    onChange={() => toggle(m.id)}
                                    card
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
