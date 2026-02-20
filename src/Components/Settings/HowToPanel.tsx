import { useState, useCallback } from 'react'
import { X, GitBranch, FileText, Import, Settings, BookOpen, Pill } from 'lucide-react'
import { useNavigationStore } from '../../stores/useNavigationStore'

type Platform = 'desktop' | 'mobile'

interface HowToClip {
    id: string
    title: string
    icon: React.ReactNode
    /** Path relative to public/, e.g. "howTo/algorithm.mp4" */
    src: string | null
    mobileSrc: string | null
    tags: Platform[]
}

const HOW_TO_CLIPS: HowToClip[] = [
    {
        id: 'note-actions',
        title: 'Note Actions',
        icon: <FileText size={20} />,
        src: 'howTo/desktopNoteActions.mp4',
        mobileSrc: 'howTo/mobile/Note Actions.mp4',
        tags: ['desktop', 'mobile'],
    },
    {
        id: 'note-import',
        title: 'Importing Notes',
        icon: <Import size={20} />,
        src: 'howTo/Note Import.mp4',
        mobileSrc: 'howTo/mobile/Note Import.mp4',
        tags: ['desktop', 'mobile'],
    },
    {
        id: 'settings',
        title: 'Settings Overview',
        icon: <Settings size={20} />,
        src: 'howTo/settings.mp4',
        mobileSrc: 'howTo/mobile/settings.mp4',
        tags: ['desktop', 'mobile'],
    },
    {
        id: 'training',
        title: 'Training',
        icon: <BookOpen size={20} />,
        src: 'howTo/training.mp4',
        mobileSrc: 'howTo/mobile/training.mp4',
        tags: ['desktop', 'mobile'],
    },
    {
        id: 'medications',
        title: 'Medications',
        icon: <Pill size={20} />,
        src: null,
        mobileSrc: null,
        tags: ['desktop', 'mobile'],
    },
    {
        id: 'algorithm',
        title: 'Using the Algorithm',
        icon: <GitBranch size={20} />,
        src: 'howTo/desktopAlgorithm.mp4',
        mobileSrc: 'howTo/mobile/mobileAlgorithm.mp4',
        tags: ['desktop', 'mobile'],
    },
]

export const HowToPanel = () => {
    const [activeClip, setActiveClip] = useState<string | null>(null)
    const isMobile = useNavigationStore(s => s.isMobile)
    const platform: Platform = isMobile ? 'mobile' : 'desktop'
    const visibleClips = HOW_TO_CLIPS.filter(clip => clip.tags.includes(platform))

    const handleTileClick = useCallback((clip: HowToClip) => {
        const src = isMobile ? clip.mobileSrc : clip.src
        if (!src) return
        setActiveClip(prev => prev === clip.id ? null : clip.id)
    }, [isMobile])

    return (
        <div className="h-full overflow-y-auto">
            <div className="px-4 py-3 md:p-5">
                <p className="text-sm text-tertiary/60 mb-4 md:text-base">
                    Some short walkthroughs are available to help you navigate the application. We're always expanding our help section. Leave feedback if you think there's an item missing.
                </p>

                    <div className="grid grid-cols-3 gap-2">
                        {visibleClips.map((clip) => {
                            const videoSrc = isMobile ? clip.mobileSrc : clip.src
                            const isActive = activeClip === clip.id
                            const isDisabled = !videoSrc

                            return (
                                <div
                                    key={clip.id}
                                    className={`transition-all duration-200 ease-out ${isActive ? 'col-span-3' : ''}`}
                                >
                                    <button
                                        onClick={() => handleTileClick(clip)}
                                        disabled={isDisabled}
                                        className={`w-full border overflow-hidden transition-colors duration-200
                                            ${isActive
                                                ? 'rounded-xl border-themeblue2/40 bg-themeblue2/10'
                                                : isDisabled
                                                    ? 'rounded-lg border-tertiary/10 bg-themewhite2/50 opacity-50 cursor-not-allowed'
                                                    : 'rounded-lg border-tertiary/15 bg-themewhite2 hover:bg-themeblue2/10 hover:border-themeblue2/25 active:scale-[0.97] group'
                                            }`}
                                    >
                                        {/* Header — always rendered, adapts layout */}
                                        <div className={
                                            isActive
                                                ? 'flex items-center gap-2 px-3 py-2.5 border-b border-themeblue2/15'
                                                : 'flex flex-col items-center justify-center gap-1 px-2 h-16'
                                        }>
                                            <div className={`relative ${isDisabled ? 'text-tertiary/40' : 'text-themeblue2'} ${!isDisabled && !isActive ? 'group-hover:scale-110' : ''} transition-transform`}>
                                                {clip.icon}
                                                {!isActive && isDisabled && (
                                                    <span className="absolute -top-1.5 -right-3 text-[7px] text-tertiary/40 font-medium uppercase tracking-wide">Soon</span>
                                                )}
                                            </div>
                                            <span className={
                                                isActive
                                                    ? 'text-sm font-semibold text-primary flex-1 text-left'
                                                    : `text-[11px] font-medium text-center leading-tight ${isDisabled ? 'text-tertiary/40' : 'text-primary'}`
                                            }>
                                                {clip.title}
                                            </span>
                                            {isActive && <X size={16} className="text-tertiary/40" />}
                                        </div>

                                        {/* Video — CSS animated expand/collapse */}
                                        <div className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
                                            isActive && videoSrc ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                                        }`}>
                                            <div className="overflow-hidden">
                                                <div className="p-2" onClick={e => e.stopPropagation()}>
                                                    <div className="w-full aspect-video rounded-lg bg-black/5">
                                                        {isActive && videoSrc && (
                                                            <video
                                                                key={`${clip.id}-${platform}`}
                                                                src={`${import.meta.env.BASE_URL}${videoSrc}`}
                                                                controls
                                                                playsInline
                                                                className="w-full h-full rounded-lg"
                                                            />
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                </div>
                            )
                        })}
                    </div>
            </div>
        </div>
    )
}
