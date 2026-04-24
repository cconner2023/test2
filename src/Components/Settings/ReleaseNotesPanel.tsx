import { useEffect, useState } from 'react';
import { Bug, PlusCircle, RefreshCw, CalendarClock, Loader, Download, CheckCircle2, MessageCircleQuestion, ChevronRight, CheckCircle } from 'lucide-react';
import { type ReleaseNoteTypes, ReleaseNotes } from '../../Data/Release';
import { useServiceWorker } from '../../Hooks/useServiceWorker';
import { useAuthStore } from '../../stores/useAuthStore';
import { useFeatureVotesStore } from '../../stores/useFeatureVotesStore';

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

const ReleaseNoteItem = ({ note }: { note: ReleaseNoteTypes }) => {
    const noteType: NoteType = note.type || 'default';
    const { icon: Icon, className } = NOTE_ICONS[noteType];

    return (
        <div className="flex items-center gap-3 px-4 py-3 hover:bg-themeblue2/5 transition-all">
            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-tertiary/10">
                <Icon size={14} className={className} />
            </div>
            <p className="text-sm text-primary flex-1">{note.text}</p>
        </div>
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
        <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
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
        </div>
    );
};

interface ReleaseNotesPanelProps {
    onOpenFeatureVotes?: () => void;
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
            <div className="flex items-center gap-2 mb-2">
                <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider">Up next — your vote</p>
            </div>
            <button
                onClick={onOpen}
                className="w-full rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden active:scale-[0.99] hover:bg-themeblue2/5 transition-all text-left"
            >
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
            </button>
        </div>
    );
};

export const ReleaseNotesPanel = ({ onOpenFeatureVotes }: ReleaseNotesPanelProps = {}) => {
    const groupedNotes = ReleaseNotes.reduce<Record<string, ReleaseNoteTypes[]>>((acc, note) => {
        const version = note.version;
        if (!acc[version]) acc[version] = [];
        acc[version].push(note);
        return acc;
    }, {});

    const versions = Object.keys(groupedNotes).sort((a, b) => parseFloat(b) - parseFloat(a));

    return (
        <div className="h-full overflow-y-auto">
            <div className="px-5 py-4 space-y-5">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider">App Version</p>
                    </div>
                    <VersionStatusCard />
                </div>
                {onOpenFeatureVotes && <FeatureVotesCard onOpen={onOpenFeatureVotes} />}
                {versions.map((version, versionIndex) => {
                    const notes = groupedNotes[version];
                    const isLatest = versionIndex === 0;

                    return (
                        <div key={version}>
                            <div className="flex items-center gap-2 mb-2">
                                <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider">
                                    Version {version}
                                </p>
                                {isLatest && (
                                    <span className="text-[9pt] md:text-[9pt] font-semibold text-themeblue2 uppercase tracking-wide">
                                        Latest
                                    </span>
                                )}
                            </div>
                            <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
                                {notes.map((note, noteIndex) => (
                                    <ReleaseNoteItem
                                        key={`${version}-${noteIndex}`}
                                        note={note}
                                    />
                                ))}
                                {notes[0]?.date && (
                                    <div className="px-4 py-2 border-t border-themeblue3/10">
                                        <p className="text-[9pt] text-tertiary">{notes[0].date}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
