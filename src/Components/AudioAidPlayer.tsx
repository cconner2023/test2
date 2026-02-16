import { useState, useRef, useCallback, useEffect } from 'react'
import { Play, Square } from 'lucide-react'
import type { AudioAid } from '../Data/TrainingData'

const BASE = import.meta.env.BASE_URL

function AudioAidItem({ aid, isPlaying, onPlay, onStop }: {
    aid: AudioAid
    isPlaying: boolean
    onPlay: () => void
    onStop: () => void
}) {
    return (
        <button
            onClick={isPlaying ? onStop : onPlay}
            className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left transition-all active:scale-[0.98]
                ${isPlaying
                    ? 'bg-themeblue2/15 ring-1 ring-themeblue2/30'
                    : 'bg-themewhite2 hover:bg-themewhite2/80'
                }`}
        >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors
                ${isPlaying ? 'bg-themeblue2/20' : 'bg-themeblue2/10'}`}>
                {isPlaying
                    ? <Square size={12} className="text-themeblue2" fill="currentColor" />
                    : <Play size={13} className="text-themeblue2 ml-0.5" fill="currentColor" />
                }
            </div>
            <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${isPlaying ? 'text-themeblue2' : 'text-primary'}`}>
                    {aid.label}
                </p>
                {aid.description && (
                    <p className="text-[9pt] text-tertiary/60 leading-snug mt-0.5">{aid.description}</p>
                )}
            </div>
        </button>
    )
}

export function AudioAidPlayer({ audioAids }: { audioAids: AudioAid[] }) {
    const [playingIndex, setPlayingIndex] = useState<number | null>(null)
    const audioRef = useRef<HTMLAudioElement | null>(null)

    const stop = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause()
            audioRef.current.currentTime = 0
            audioRef.current = null
        }
        setPlayingIndex(null)
    }, [])

    const play = useCallback((index: number) => {
        stop()
        const audio = new Audio(`${BASE}trainingAids/${audioAids[index].file}`)
        audio.addEventListener('ended', () => setPlayingIndex(null))
        audio.play()
        audioRef.current = audio
        setPlayingIndex(index)
    }, [audioAids, stop])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause()
                audioRef.current = null
            }
        }
    }, [])

    return (
        <div className="mb-4">
            <p className="text-[9pt] font-semibold text-tertiary/60 uppercase tracking-wider mb-1.5">Audio Training Aids</p>
            <div className="space-y-1.5">
                {audioAids.map((aid, i) => (
                    <AudioAidItem
                        key={i}
                        aid={aid}
                        isPlaying={playingIndex === i}
                        onPlay={() => play(i)}
                        onStop={stop}
                    />
                ))}
            </div>
        </div>
    )
}
