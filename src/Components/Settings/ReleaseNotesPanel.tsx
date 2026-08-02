import { useEffect, useState } from 'react';
import { Bug, PlusCircle, RefreshCw, CalendarClock, Loader, Download, CheckCircle2, MessageCircleQuestion, ChevronRight, CheckCircle, BookOpen } from 'lucide-react';
import { type ReleaseNoteTypes, ReleaseNotes } from '../../Data/Release';
import { useServiceWorker } from '../../Hooks/useServiceWorker';
import { useAuthStore } from '../../stores/useAuthStore';
import { useFeatureVotesStore } from '../../stores/useFeatureVotesStore';
import { useNavigationStore } from '../../stores/useNavigationStore';
import { UserGuideAnchorsById } from '../../Data/UserGuide';
import { SectionCard, SectionHeader } from '@/Components/primitives/Section'
import { MetaBadge } from '@/Components/primitives/MetaBadge'

type NoteType = Exclude<ReleaseNoteTypes['type'], undefined> | 'default';

const NOTE_ICONS: Record<NoteType, {
    icon: React.ComponentType<{ size: number; className: string }>;
    className: string
}> = {
    bug: { icon: Bug, className: "text-themeredred" },
    added: { icon: PlusCircle, className: "text-themegreen" },
    changed: { icon: RefreshCw, className: "text-themeblue2" },
    planned: { icon: CalendarClock, className: "text-themeyellow" },
    started: { icon: Loader, className: "text-themeyellowlow" },
    default: { icon: PlusCircle, className: "text-tertiary" }
};

const ReleaseNoteItem = ({ note, onOpenGuide }: { note: ReleaseNoteTypes; onOpenGuide?: (sectionId: string) => void }) => {
    const noteType: NoteType = note.type || 'default';
    const { icon: Icon, className } = NOTE_ICONS[noteType];

    const openUserGuideDrawer = useNavigationStore((s) => s.setShowUserGuideDrawer);
    // Default = open the standalone guide drawer. A host that can show the guide
    // without leaving itself (desktop Settings) passes onOpenGuide instead.
    const openUserGuide = onOpenGuide ?? ((sectionId: string) => openUserGuideDrawer(true, sectionId));

    // A note is tappable when it points at an existing User Guide section/subsection.
    const hasSection = !!note.sectionId && !!UserGuideAnchorsById[note.sectionId];

    if (!hasSection) {
        return (
            <div className="flex items-center gap-3 px-4 py-3 hover:bg-themeblue2/5 transition-all">
                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-tertiary/10">
                    <Icon size={14} className={className} />
                </div>
                <p className="text-sm text-primary flex-1">{note.text}</p>
            </div>
        );
    }

    return (
        <button
            onClick={() => openUserGuide(note.sectionId!)}
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-themeblue2/5 active:scale-[0.99] transition-all"
        >
            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-tertiary/10">
                <Icon size={14} className={className} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm text-primary">{note.text}</p>
                <span className="inline-flex items-center gap-1 mt-1 text-[9pt] font-semibold text-themeblue2">
                    <BookOpen size={11} /> Read more
                </span>
            </div>
            <ChevronRight size={16} className="text-tertiary shrink-0 self-center" />
        </button>
    );
};

const VersionStatusCard = () => {
    const { updateAvailable, skipWaiting, checkForUpdate, isUpdating, appVersion } = useServiceWorker();
    const [checking, setChecking] = useState(false);
    const [justChecked, setJustChecked] = useState(false);

    const handleCheck = () => {
        setChecking(true);
        setJustChecked(false);
        checkForUpdate();
        // SW update check is fire-and-forget; give it a moment then show feedback
        setTimeout(() => {
            setChecking(false);
            setJustChecked(true);
            setTimeout(() => setJustChecked(false), 3000);
        }, 1500);
    };

    return (
        <SectionCard>
            <div className="px-4 py-3.5 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${updateAvailable ? 'bg-themeblue2/15' : 'bg-themegreen/15'}`}>
                    {updateAvailable
                        ? <Download size={16} className="text-themeblue2" />
                        : <CheckCircle2 size={16} className="text-themegreen" />
                    }
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-primary">
                        {updateAvailable ? 'Update available' : 'Up to date'}
                    </p>
                    <p className="text-[9pt] text-tertiary mt-0.5">
                        Current version: {appVersion}
                    </p>
                </div>
                {updateAvailable ? (
                    <button
                        onClick={skipWaiting}
                        disabled={isUpdating}
                        className="px-3 py-1.5 rounded-xl text-[9pt] font-semibold text-white bg-themeblue3 active:scale-95 transition-all disabled:opacity-60 flex items-center gap-1.5"
                    >
                        {isUpdating
                            ? <><RefreshCw size={11} className="animate-spin" /> Installing…</>
                            : <><Download size={11} /> Install</>
                        }
                    </button>
                ) : (
                    <button
                        onClick={handleCheck}
                        disabled={checking}
                        className="w-8 h-8 rounded-full flex items-center justify-center bg-tertiary/10 active:scale-95 transition-all disabled:opacity-60"
                        aria-label="Check for updates"
                    >
                        <RefreshCw size={15} className={`${justChecked ? 'text-themegreen' : 'text-tertiary'} ${checking ? 'animate-spin' : ''}`} />
                    </button>
                )}
            </div>
        </SectionCard>
    );
};

interface ReleaseNotesPanelProps {
    onOpenFeatureVotes?: () => void;
    /** Route a note's "Read more" somewhere other than the standalone guide drawer
     *  — desktop Settings hosts the guide in its own panes. */
    onOpenGuide?: (sectionId: string) => void;
}

const FeatureVotesCard = ({ onOpen }: { onOpen: () => void }) => {
    const userId = useAuthStore((s) => s.user?.id);
    const isAuthenticated = useAuthStore((s) => !!s.user);
    const activeCycle = useFeatureVotesStore((s) => s.activeCycle);
    const userVote = useFeatureVotesStore((s) => s.userVote);
    const hydrate = useFeatureVotesStore((s) => s.hydrate);

    useEffect(() => {
        if (!isAuthenticated || !userId) return;
        hydrate(userId);
    }, [isAuthenticated, userId, hydrate]);

    if (!isAuthenticated || !activeCycle) return null;

    const hasVoted = !!userVote;

    return (
        <div>
            <SectionHeader>Up next — your vote</SectionHeader>
            <SectionCard onClick={onOpen}>
                <div className="px-4 py-3.5 flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${hasVoted ? 'bg-themegreen/15' : 'bg-themeblue2/15'}`}>
                        {hasVoted
                            ? <CheckCircle size={16} className="text-themegreen" />
                            : <MessageCircleQuestion size={16} className="text-themeblue2" />}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-primary truncate">{activeCycle.title}</p>
                        <p className="text-[9pt] text-tertiary mt-0.5">
                            {hasVoted ? 'You\'ve voted — tap to change or see standings' : 'Help decide what ships next'}
                        </p>
                    </div>
                    {!hasVoted && (
                        <span className="w-2 h-2 rounded-full bg-themeredred shrink-0" aria-label="Unvoted" />
                    )}
                    <ChevronRight size={16} className="text-tertiary shrink-0" />
                </div>
            </SectionCard>
        </div>
    );
};

export const ReleaseNotesPanel = ({ onOpenFeatureVotes, onOpenGuide }: ReleaseNotesPanelProps = {}) => {
    const isSupervisor = useAuthStore((s) => s.isSupervisorRole);
    const isProvider = useAuthStore((s) => s.isProviderRole);

    // Role-scope: hide supervisor/provider notes from users who can't access the feature.
    const visibleNotes = ReleaseNotes.filter((note) => {
        if (note.tier === 'supervisor') return isSupervisor;
        if (note.tier === 'provider') return isProvider;
        return true;
    });

    const groupedNotes = visibleNotes.reduce<Record<string, ReleaseNoteTypes[]>>((acc, note) => {
        const version = note.version;
        if (!acc[version]) acc[version] = [];
        acc[version].push(note);
        return acc;
    }, {});

    const versions = Object.keys(groupedNotes).sort((a, b) => parseFloat(b) - parseFloat(a));

    return (
        <div className="h-full overflow-y-auto">
            <div className="px-5 pb-4 space-y-5 pt-[calc(var(--drawer-header-h,3.5rem)+0.75rem)]">
                <div>
                    <SectionHeader>App Version</SectionHeader>
                    <VersionStatusCard />
                </div>
                {onOpenFeatureVotes && <FeatureVotesCard onOpen={onOpenFeatureVotes} />}
                {versions.map((version, versionIndex) => {
                    const notes = groupedNotes[version];
                    const isLatest = versionIndex === 0;

                    return (
                        <div key={version}>
                            <SectionHeader trailing={isLatest ? <MetaBadge tone="accent">Latest</MetaBadge> : undefined}>
                                Version {version}
                            </SectionHeader>
                            <SectionCard>
                                {notes.map((note, noteIndex) => (
                                    <ReleaseNoteItem
                                        key={`${version}-${noteIndex}`}
                                        note={note}
                                        onOpenGuide={onOpenGuide}
                                    />
                                ))}
                                {notes[0]?.date && (
                                    <div className="px-4 py-2 border-t border-themeblue3/10">
                                        <p className="text-[9pt] text-tertiary">{notes[0].date}</p>
                                    </div>
                                )}
                            </SectionCard>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
