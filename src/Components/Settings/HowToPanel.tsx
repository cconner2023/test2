import { useState, useCallback } from 'react'
import { motion, AnimatePresence, LayoutGroup } from 'motion/react'
import { X, GitBranch, FileText, Import, Settings, BookOpen, Pill } from 'lucide-react'

interface HowToClip {
    id: string
    title: string
    icon: React.ReactNode
    /** Path relative to public/, e.g. "howTo/algorithm.mp4" */
    src: string | null
}

const HOW_TO_CLIPS: HowToClip[] = [
    {
        id: 'note-actions',
        title: 'Note Actions',
        icon: <FileText size={20} />,
        src: 'howTo/Note Actions.mp4',
    },
    {
        id: 'note-import',
        title: 'Importing Notes',
        icon: <Import size={20} />,
        src: 'howTo/Note Import.mp4',
    },
    {
        id: 'settings',
        title: 'Settings Overview',
        icon: <Settings size={20} />,
        src: 'howTo/settings.mp4',
    },
    {
        id: 'training',
        title: 'Training',
        icon: <BookOpen size={20} />,
        src: 'howTo/training.mp4',
    },
    {
        id: 'medications',
        title: 'Medications',
        icon: <Pill size={20} />,
        src: null,
    },
    {
        id: 'algorithm',
        title: 'Using the Algorithm',
        icon: <GitBranch size={20} />,
        src: null,
    },

]

const springTransition = { type: 'spring' as const, stiffness: 400, damping: 30 }

export const HowToPanel = () => {
    const [activeClip, setActiveClip] = useState<string | null>(null)

    const handleTileClick = useCallback((clip: HowToClip) => {
        if (!clip.src) return
        setActiveClip(prev => prev === clip.id ? null : clip.id)
    }, [])

    return (
        <div className="h-full overflow-y-auto">
            <div className="px-4 py-3 md:p-5">
                <p className="text-sm text-tertiary/60 mb-4 md:text-base">
                    Some short walkthroughs are available to help you navigate the application. We're always expanding our help section. Leave feedback if you think there's an item missing.
                </p>

                <LayoutGroup>
                    <div className="grid grid-cols-3 gap-2">
                        {HOW_TO_CLIPS.map((clip) => {
                            const isActive = activeClip === clip.id
                            const isDisabled = !clip.src

                            return (
                                <motion.div
                                    key={clip.id}
                                    layout
                                    transition={springTransition}
                                    className={isActive ? 'col-span-3' : ''}
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

                                        {/* Video — only when expanded */}
                                        <AnimatePresence>
                                            {isActive && clip.src && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="p-2" onClick={e => e.stopPropagation()}>
                                                        <video
                                                            key={clip.id}
                                                            src={`${import.meta.env.BASE_URL}${clip.src}`}
                                                            controls
                                                            playsInline
                                                            className="w-full rounded-lg"
                                                        />
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </button>
                                </motion.div>
                            )
                        })}
                    </div>
                </LayoutGroup>
            </div>
        </div>
    )
}
