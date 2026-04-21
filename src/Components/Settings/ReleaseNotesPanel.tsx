import { Bug, PlusCircle, RefreshCw, CalendarClock, Loader } from 'lucide-react';
import { type ReleaseNoteTypes, ReleaseNotes } from '../../Data/Release';

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

export const ReleaseNotesPanel = () => {
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
