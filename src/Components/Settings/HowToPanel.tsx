import { useState } from 'react'
import { Play, ChevronDown, GitBranch, FileText, Copy, Save, UserPlus, LogIn, Settings, BookOpen } from 'lucide-react'

interface HowToClip {
    id: string
    title: string
    description: string
    icon: React.ReactNode
    /** Path relative to public/, e.g. "howTo/algorithm.mp4" */
    src: string | null
}

const HOW_TO_CLIPS: HowToClip[] = [
    {
        id: 'algorithm',
        title: 'Using the Algorithm',
        description: 'Navigate through the clinical decision algorithm, follow branches, and reach treatment recommendations.',
        icon: <GitBranch size={20} />,
        src: null, // placeholder — replace with "howTo/algorithm.mp4"
    },
    {
        id: 'select-note',
        title: 'Selecting Your Note',
        description: 'How to select, view, and manage your saved clinical notes.',
        icon: <FileText size={20} />,
        src: null, // placeholder — replace with "howTo/select-note.mp4"
    },
    {
        id: 'copy-share',
        title: 'Copy or Share a Note',
        description: 'Copy note contents to your clipboard or share via your device\'s share sheet.',
        icon: <Copy size={20} />,
        src: null, // placeholder — replace with "howTo/copy-share.mp4"
    },
    {
        id: 'save-note',
        title: 'Saving a Note',
        description: 'Save your clinical note for later reference from any point in the algorithm.',
        icon: <Save size={20} />,
        src: null, // placeholder — replace with "howTo/save-note.mp4"
    },
    {
        id: 'create-account',
        title: 'Creating an Account',
        description: 'Request an account and get set up with your clinic and credentials.',
        icon: <UserPlus size={20} />,
        src: null, // placeholder — replace with "howTo/create-account.mp4"
    },
    {
        id: 'login',
        title: 'Logging In',
        description: 'Sign in to your account to access clinic features and synced notes.',
        icon: <LogIn size={20} />,
        src: null, // placeholder — replace with "howTo/login.mp4"
    },
    {
        id: 'settings',
        title: 'Settings Overview',
        description: 'Tour of the settings panel — profile, preferences, theme, and security options.',
        icon: <Settings size={20} />,
        src: null, // placeholder — replace with "howTo/settings.mp4"
    },
    {
        id: 'training',
        title: 'Log & Test Training',
        description: 'How to log completed training tasks, test your knowledge, and track progress.',
        icon: <BookOpen size={20} />,
        src: null, // placeholder — replace with "howTo/training.mp4"
    },
]

const ClipCard = ({ clip }: { clip: HowToClip }) => {
    const [expanded, setExpanded] = useState(false)

    return (
        <div className="rounded-xl border border-tertiary/15 bg-themewhite2/50 overflow-hidden transition-all">
            <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center w-full px-4 py-3.5 hover:bg-themewhite2 active:scale-[0.99] transition-all"
            >
                <div className="mr-3 text-themeblue2 shrink-0">
                    {clip.icon}
                </div>
                <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-semibold text-primary leading-tight">{clip.title}</p>
                    <p className="text-xs text-tertiary/60 mt-0.5 leading-snug">{clip.description}</p>
                </div>
                <ChevronDown
                    size={16}
                    className={`text-tertiary/40 shrink-0 ml-2 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
                />
            </button>

            {expanded && (
                <div className="px-4 pb-4 animate-fadeInScale">
                    {clip.src ? (
                        <div className="rounded-lg overflow-hidden bg-black/5">
                            <video
                                src={`${import.meta.env.BASE_URL}${clip.src}`}
                                autoPlay
                                loop
                                muted
                                playsInline
                                className="w-full rounded-lg"
                            />
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-10 rounded-lg bg-tertiary/5 border border-dashed border-tertiary/20">
                            <Play size={28} className="text-tertiary/30 mb-2" />
                            <p className="text-xs text-tertiary/40 font-medium">Clip coming soon</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

export const HowToPanel = () => {
    return (
        <div className="h-full overflow-y-auto">
            <div className="px-4 py-3 md:p-5">
                <p className="text-sm text-tertiary/60 mb-4 md:text-base">
                    Short walkthroughs for getting the most out of the app.
                </p>
                <div className="space-y-2">
                    {HOW_TO_CLIPS.map((clip) => (
                        <ClipCard key={clip.id} clip={clip} />
                    ))}
                </div>
            </div>
        </div>
    )
}
