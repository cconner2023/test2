import { Bug, PlusCircle, RefreshCw, CalendarClock, Loader } from 'lucide-react';
import { type ReleaseNoteTypes, ReleaseNotes } from '../../Data/Release';

// Extract the note type safely
type NoteType = Exclude<ReleaseNoteTypes['type'], undefined> | 'default';

const NOTE_ICONS: Record<NoteType, {
    icon: React.ComponentType<{ size: number; className: string }>;
    className: string
}> = {
    bug: { icon: Bug, className: "text-red-500" },
    added: { icon: PlusCircle, className: "text-green-500" },
    changed: { icon: RefreshCw, className: "text-blue-500" },
    planned: { icon: CalendarClock, className: "text-yellow-500" },
    started: { icon: Loader, className: "text-orange-500" },
    default: { icon: PlusCircle, className: "text-tertiary" }
};

const ReleaseNoteItem = ({ note }: { note: ReleaseNoteTypes }) => {
    const noteType: NoteType = note.type || 'default';
    const { icon: Icon, className } = NOTE_ICONS[noteType];

    return (
        <div className="flex items-start mb-2 last:mb-0">
            <div className="mt-1.5 mr-3">
                <Icon size={14} className={className} />
            </div>
            <p className="text-sm text-tertiary/80 flex-1">{note.text}</p>
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
        <div className="h-full overflow-y-auto px-4 py-3 md:p-5">
            {versions.map((version, versionIndex) => {
                const notes = groupedNotes[version];
                const isLatest = versionIndex === 0;

                return (
                    <div
                        key={version}
                        className={`${versionIndex > 0 ? 'pt-6 border-t border-tertiary/10' : 'mb-6'}`}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-primary">Version {version}</h3>
                            {isLatest && (
                                <span className="text-xs text-tertiary/60 bg-tertiary/10 px-2 py-1 rounded-full">
                                    Latest
                                </span>
                            )}
                        </div>
                        <div className="space-y-1">
                            {notes.map((note, noteIndex) => (
                                <ReleaseNoteItem
                                    key={`${version}-${noteIndex}`}
                                    note={note}
                                />
                            ))}
                        </div>
                        {notes[0]?.date && (
                            <p className="text-xs text-tertiary/60 mt-3">Released: {notes[0].date}</p>
                        )}
                    </div>
                );
            })}
        </div>
    );
};
