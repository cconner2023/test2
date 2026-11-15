import { ClipboardList, TextCursorInput, ChevronRight, LayoutTemplate, Home, Building2, Sparkles } from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { useTemplateSubscription } from '../../Hooks/useTemplateSubscription';
import { useUserProfile } from '../../Hooks/useUserProfile';
import { useBetaFlag } from '../../lib/betaFeatures';
import { SettingsRow, SettingsToggleRow } from './SettingsToggleRow';
import { SettingsPage, TileGrid } from './SettingsPage';

interface NoteContentPanelProps {
    onNavigate?: (panel: string) => void;
    /** Desktop: the subpage currently open in the PaneCard — highlights its row.
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

    const tile = 'rounded-xl bg-themewhite2';
    const rows = [
        ...sections,
        ...(isProviderRole ? [{
            icon: LayoutTemplate,
            label: 'Provider Templates',
            subtitle: 'Note skeletons from your shortcuts',
            navigateTo: 'provider-templates',
        }] : []),
    ];

    // Tiles rather than one divided card so the rows can wrap into columns when
    // the page is wide. One column on a phone, same order as before.
    return (
        <SettingsPage className="h-full" split={false}>
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

            <TileGrid spacing="cards">
                {rows.map((row) => (
                    <SettingsRow
                        key={row.label}
                        icon={row.icon}
                        label={row.label}
                        subtitle={row.subtitle}
                        onClick={() => onNavigate?.(row.navigateTo)}
                        className={`${tile} ${activeSubpage === row.navigateTo ? 'ring-1 ring-themeblue3/40 bg-themeblue3/8' : ''}`}
                        trailing={<ChevronRight size={16} className="text-tertiary shrink-0" />}
                    />
                ))}
            </TileGrid>

            {isLoaned && (
                <section>
                    <div className="px-1 mb-2">
                        <p className="text-sm font-medium text-primary">Template sources</p>
                        <p className="text-[9pt] text-tertiary mt-0.5">
                            Which clinics' text templates and order sets to mix into your notes. Your personal blocks are always included.
                        </p>
                    </div>
                    <TileGrid spacing="cards">
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
                    </TileGrid>
                </section>
            )}
        </SettingsPage>
    );
};
