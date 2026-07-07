import { useState, type ReactNode } from 'react';
import { Image as ImageIcon, ImageOff } from 'lucide-react';
import { PreviewOverlay } from '../PreviewOverlay';
import type { GuideBlock, GuideChapter } from '../../Data/UserGuide';

interface UserGuideBodyProps {
    /** Already role-gated + search-filtered chapters. */
    chapters: GuideChapter[];
    isMobile: boolean;
}

/** State for the mobile figure preview overlay. */
interface PreviewState {
    src: string;
    alt: string;
    caption?: string;
    rect: DOMRect | null;
}

/**
 * Resolve an image block's `src` to a loadable URL. A bare filename (or path) is
 * treated as living in `public/userGuide/` and prefixed with the deploy base
 * (BASE_URL is '/test2/' on GitHub Pages — a leading-slash path would 404). An
 * absolute/data/blob URL is used verbatim. So in the data you write just the
 * filename: `{ kind: 'image', src: 'calendar-month.png', alt: '…' }`.
 */
const resolveGuideSrc = (src: string): string =>
    /^(https?:|data:|blob:|\/)/.test(src) ? src : `${import.meta.env.BASE_URL}userGuide/${src}`;

/** Desktop inline figure — floats into the paragraph; degrades to a "pending"
 *  placeholder so a referenced-but-not-yet-added screenshot never breaks layout. */
function GuideFigure({ block }: { block: Extract<GuideBlock, { kind: 'image' }> }) {
    const [failed, setFailed] = useState(false);
    const side = block.side ?? 'right';
    return (
        <figure className={`w-2/5 max-w-[280px] mb-2 ${side === 'right' ? 'float-right ml-5' : 'float-left mr-5'}`}>
            {failed ? (
                <div className="flex flex-col items-center justify-center gap-1 h-40 rounded-xl border border-dashed border-tertiary/25 bg-tertiary/5">
                    <ImageOff size={16} className="text-tertiary/50" />
                    <p className="text-[8.5pt] text-tertiary">Image pending · {block.src}</p>
                </div>
            ) : (
                <img
                    src={resolveGuideSrc(block.src)}
                    alt={block.alt}
                    loading="lazy"
                    onError={() => setFailed(true)}
                    className="w-full rounded-xl border border-tertiary/15"
                />
            )}
            {block.caption && (
                <figcaption className="mt-1 text-[9pt] text-tertiary leading-snug">{block.caption}</figcaption>
            )}
        </figure>
    );
}

/** The figure shown inside the mobile preview overlay, with the same fallback. */
function GuidePreviewImg({ preview }: { preview: PreviewState }) {
    const [failed, setFailed] = useState(false);
    return failed ? (
        <div className="flex flex-col items-center justify-center gap-1.5 h-48 rounded-xl border border-dashed border-tertiary/25 bg-tertiary/5">
            <ImageOff size={20} className="text-tertiary/50" />
            <p className="text-[9pt] text-tertiary">Image pending · {preview.src}</p>
        </div>
    ) : (
        <img src={resolveGuideSrc(preview.src)} alt={preview.alt} onError={() => setFailed(true)} className="w-full rounded-xl" />
    );
}

/** Renders the guide body like a PDF. Images float inline on desktop; on mobile they collapse to an "Image" link that opens the figure full-size in a primitive PreviewOverlay. */
export function UserGuideBody({ chapters, isMobile }: UserGuideBodyProps) {
    const [preview, setPreview] = useState<PreviewState | null>(null);

    const renderImage = (block: Extract<GuideBlock, { kind: 'image' }>, key: number): ReactNode => {
        if (isMobile) {
            // Mobile: no room to float — surface a link that opens the figure large.
            // Prefer the mobile-specific shot; fall back to the desktop src when the
            // section has only one image.
            const mobileSrc = block.srcMobile ?? block.src;
            return (
                <button
                    key={key}
                    onClick={(e) => setPreview({ src: mobileSrc, alt: block.alt, caption: block.caption, rect: e.currentTarget.getBoundingClientRect() })}
                    className="inline-flex items-center gap-1.5 my-1 text-[10.5pt] font-medium text-themeblue2 active:scale-95 transition-transform"
                >
                    <ImageIcon size={14} className="shrink-0" />
                    {block.caption || block.alt || 'Image'}
                </button>
            );
        }
        // Desktop: float the figure into the paragraph flow.
        return <GuideFigure key={key} block={block} />;
    };

    const renderBlock = (block: GuideBlock, key: number): ReactNode => {
        switch (block.kind) {
            case 'image':
                return renderImage(block, key);
            case 'sub':
                return <p key={key} className="text-[10.5pt] font-semibold text-primary mt-4 mb-1.5">{block.text}</p>;
            case 'p':
                return <p key={key} className="text-[10.5pt] text-secondary leading-relaxed mb-2.5">{block.text}</p>;
            case 'list':
                return (
                    <ul key={key} className="mb-2.5 space-y-1.5">
                        {block.items.map((item, i) => (
                            <li key={i} className="flex gap-2.5 text-[10.5pt] text-secondary leading-relaxed">
                                <span className="shrink-0 mt-[0.55em] w-1 h-1 rounded-full bg-tertiary/60" />
                                <span>{item}</span>
                            </li>
                        ))}
                    </ul>
                );
            case 'steps':
                return (
                    <ol key={key} className="mb-2.5 space-y-1.5">
                        {block.items.map((item, i) => (
                            <li key={i} className="flex gap-2.5 text-[10.5pt] text-secondary leading-relaxed">
                                <span className="shrink-0 text-tertiary tabular-nums">{i + 1}.</span>
                                <span>{item}</span>
                            </li>
                        ))}
                    </ol>
                );
            case 'note':
                // Kept plain to preserve the single-body-style PDF feel — a thin rule
                // marks it as an aside without introducing a second text color.
                return (
                    <p key={key} className="text-[10.5pt] text-secondary leading-relaxed mb-2.5 pl-3 border-l-2 border-themeblue2/30">
                        {block.text}
                    </p>
                );
        }
    };

    return (
        <>
            <article className="px-5 md:px-6 py-4 max-w-[64rem]">
                {chapters.map((chapter) => (
                    <section key={chapter.id} className="mb-7">
                        <p className="text-[9pt] font-semibold text-themeblue2 uppercase tracking-wider mb-3">
                            {chapter.label}
                        </p>
                        {chapter.sections.map((section) => (
                            // scroll-mt clears the floating header so anchored jumps land below it.
                            <div key={section.id} id={`guide-${section.id}`} data-guide-anchor={section.id} className="scroll-mt-24 mb-6">
                                <h2 className="text-[13pt] font-bold text-primary mb-2.5">{section.title}</h2>
                                <div className="overflow-hidden">
                                    {section.blocks?.map((block, i) => renderBlock(block, i))}
                                </div>
                                {section.subsections?.map((sub) => (
                                    <div key={sub.id} id={`guide-${sub.id}`} data-guide-anchor={sub.id} className="scroll-mt-24 mt-5">
                                        <h3 className="text-[11pt] font-bold text-primary mb-1.5">{sub.title}</h3>
                                        <div className="overflow-hidden">
                                            {sub.blocks.map((block, i) => renderBlock(block, i))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </section>
                ))}
            </article>

            {/* Mobile figure preview */}
            <PreviewOverlay
                isOpen={!!preview}
                onClose={() => setPreview(null)}
                anchorRect={preview?.rect ?? null}
                title={preview?.caption || preview?.alt}
                previewMaxHeight="70dvh"
            >
                {preview && (
                    <div className="p-2">
                        <GuidePreviewImg preview={preview} />
                        {preview.caption && (
                            <p className="mt-2 px-1 text-[9.5pt] text-tertiary leading-snug">{preview.caption}</p>
                        )}
                    </div>
                )}
            </PreviewOverlay>
        </>
    );
}
