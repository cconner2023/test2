import { useState } from 'react'
import { ImageOff } from 'lucide-react'
import type { ImageAid } from '../Data/TrainingData'

const BASE = import.meta.env.BASE_URL

function StateChip({ state }: { state: ImageAid['state'] }) {
    const isNormal = state === 'normal'
    return (
        <span className={`px-1.5 py-0.5 rounded text-[9pt] font-semibold uppercase tracking-wider
            ${isNormal ? 'bg-themegreen/15 text-themegreen' : 'bg-themeredred/10 text-themeredred'}`}>
            {isNormal ? 'Normal' : 'Abnormal'}
        </span>
    )
}

function ImageAidItem({ aid }: { aid: ImageAid }) {
    const [failed, setFailed] = useState(false)

    return (
        <div className="rounded-xl bg-themewhite2 overflow-hidden">
            {failed ? (
                <div className="flex flex-col items-center justify-center gap-1.5 h-36 bg-tertiary/5 border-b border-dashed border-tertiary/20">
                    <ImageOff size={18} className="text-tertiary/50" />
                    <p className="text-[9pt] text-tertiary">Image pending · {aid.file}</p>
                </div>
            ) : (
                <img
                    src={`${BASE}trainingAids/${aid.file}`}
                    alt={aid.label}
                    loading="lazy"
                    onError={() => setFailed(true)}
                    className="w-full h-44 object-cover bg-black/5"
                />
            )}
            <div className="px-3 py-2.5">
                <div className="flex items-center gap-2">
                    <StateChip state={aid.state} />
                    <p className="text-sm font-medium text-primary">{aid.label}</p>
                </div>
                {aid.caption && (
                    <p className="text-[10pt] text-tertiary leading-snug mt-1">{aid.caption}</p>
                )}
                {aid.attribution && (
                    <p className="text-[9pt] text-tertiary/70 leading-snug mt-1 italic">{aid.attribution}</p>
                )}
            </div>
        </div>
    )
}

export function ImageAidGallery({ imageAids }: { imageAids: ImageAid[] }) {
    return (
        <div className="mb-5">
            <p className="text-[9pt] font-semibold text-tertiary uppercase tracking-wider mb-1.5">
                Visual Exam Reference
            </p>
            <div className="space-y-2">
                {imageAids.map((aid, i) => (
                    <ImageAidItem key={i} aid={aid} />
                ))}
            </div>
        </div>
    )
}
