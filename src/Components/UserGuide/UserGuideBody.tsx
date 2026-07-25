import { Fragment, useState, type ReactNode } from 'react';
import { PreviewOverlay } from '../PreviewOverlay';
import type { GuideBlock, GuideButtonRef, GuideChapter, GuideInline } from '../../Data/UserGuide';
import { GuideIconRegistry } from './guideIcons';

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
 *  placeholder so a referenced-but-not-yet-added screenshot never breaks layout.
 *  When `onOpen` is set the image is clickable and opens full-size in the preview overlay. */
function GuideFigure({ block, onOpen }: { block: Extract<GuideBlock, { kind: 'image' }>; onOpen?: () => void }) {
    const [failed, setFailed] = useState(false);
    // Always float right: list/step bars live in the left gutter, so a left-floated
    // figure would collide with them. `block.side` is intentionally ignored to keep
    // the bar ↔ figure layout consistent across every section.
    return (
        <figure className="w-2/5 max-w-[280px] mb-2 float-right ml-5">
            {failed ? (
                <div className="flex flex-col items-center justify-center gap-1 h-40 rounded-xl border border-dashed border-tertiary/25 bg-tertiary/5">
                    <p className="text-[8.5pt] text-tertiary">Image pending · {block.src}</p>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={onOpen}
                    aria-label={`Enlarge image: ${block.alt}`}
                    className="block w-full cursor-zoom-in rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-themeblue2/50"
                >
                    <img
                        src={resolveGuideSrc(block.src)}
                        alt={block.alt}
                        loading="lazy"
                        onError={() => setFailed(true)}
                        className="w-full rounded-xl border border-tertiary/15 transition-opacity hover:opacity-90"
                    />
                </button>
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
            <p className="text-[9pt] text-tertiary">Image pending · {preview.src}</p>
        </div>
    ) : (
        <img src={resolveGuideSrc(preview.src)} alt={preview.alt} onError={() => setFailed(true)} className="w-full rounded-xl" />
    );
}

/** Variant colors lifted from primitives/ActionButton so the replica reads as the real control. */
const GUIDE_BTN_STYLES: Record<NonNullable<Exclude<GuideButtonRef, string>['variant']>, string> = {
    default: 'bg-themeblue2/8 text-primary',
    danger: 'bg-themeredred/8 text-themeredred',
    success: 'bg-themeblue2 text-white',
};

/** Humanize an icon key for the fallback tooltip/label ('trash-2' → 'Trash 2'). */
const humanizeIcon = (key: string) => key.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

/**
 * Decorative, icon-only replica of a real ActionButton, sized in `em` so it rides
 * the text line. Not interactive (role="img"); `label` drives tooltip + a11y.
 */
function GuideButtonGlyph({ btn }: { btn: GuideButtonRef }) {
    const b = typeof btn === 'string' ? { icon: btn } : btn;
    const Icon = GuideIconRegistry[b.icon];
    const label = b.label ?? `${humanizeIcon(b.icon)} button`;
    return (
        <span
            role="img"
            aria-label={label}
            title={label}
            className={`inline-flex items-center justify-center align-middle w-[1.55em] h-[1.55em] mx-[0.15em] -my-[0.2em] rounded-full ${GUIDE_BTN_STYLES[b.variant ?? 'default']}`}
        >
            <Icon className="w-[0.95em] h-[0.95em]" />
        </span>
    );
}

/** A string renders verbatim; a segment array interleaves text with button replicas. */
function renderInline(content: GuideInline): ReactNode {
    if (typeof content === 'string') return content;
    return content.map((seg, i) =>
        typeof seg === 'string'
            ? <Fragment key={i}>{seg}</Fragment>
            : <GuideButtonGlyph key={i} btn={seg.btn} />,
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
                    className="inline-flex items-center gap-1.5 my-1 text-[10pt] font-medium text-themeblue2 active:scale-95 transition-transform"
                >
                    {block.caption || block.alt || 'Image'}
                </button>
            );
        }
        // Desktop: float the figure into the paragraph flow; click enlarges it in the
        // same PreviewOverlay the mobile link uses (full desktop src, centered).
        return (
            <GuideFigure
                key={key}
                block={block}
                onOpen={() => setPreview({ src: block.src, alt: block.alt, caption: block.caption, rect: null })}
            />
        );
    };

    const renderBlock = (block: GuideBlock, key: number): ReactNode => {
        switch (block.kind) {
            case 'image':
                return renderImage(block, key);
            case 'sub':
                return <p key={key} className="text-[10pt] font-semibold text-tertiary mt-4 mb-1.5">{block.text}</p>;
            case 'p':
                return <p key={key} className="text-[10pt] text-secondary leading-relaxed mb-2.5">{renderInline(block.text)}</p>;
            case 'list':
                // Per-item bar: each item carries its own left bar segment so the
                // group reads as discrete points rather than one continuous rule.
                return (
                    <ul key={key} className="mb-2.5 space-y-2">
                        {block.items.map((item, i) => (
                            <li key={i} className="pl-3 border-l-2 border-themeblue2/30 text-[10pt] text-secondary leading-relaxed">
                                {renderInline(item)}
                            </li>
                        ))}
                    </ul>
                );
            case 'steps':
                // Ordered, but rendered like lists: per-item bar segments, no numbers.
                return (
                    <ol key={key} className="mb-2.5 space-y-2">
                        {block.items.map((item, i) => (
                            <li key={i} className="pl-3 border-l-2 border-themeblue2/30 text-[10pt] text-secondary leading-relaxed">
                                {renderInline(item)}
                            </li>
                        ))}
                    </ol>
                );
            case 'note':
                // Level-2 aside: a further addition to the block above it. Indented deeper
                // than the level-1 bar and given a lighter bar so it reads as nested.
                return (
                    <p key={key} className="text-[10pt] text-secondary leading-relaxed mb-2.5 ml-5 pl-3 border-l-2 border-themeblue2/15">
                        {renderInline(block.text)}
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
                                {/* h2/h3 stay headings for the document outline; the styling is
                                    the app SectionHeader grammar, matching every other panel. */}
                                <h2 className="text-[9pt] font-semibold text-primary uppercase tracking-wider mb-2.5">{section.title}</h2>
                                <div className="overflow-hidden">
                                    {section.blocks?.map((block, i) => renderBlock(block, i))}
                                </div>
                                {section.subsections?.map((sub) => (
                                    <div key={sub.id} id={`guide-${sub.id}`} data-guide-anchor={sub.id} className="scroll-mt-24 mt-5">
                                        <h3 className="text-[10pt] font-semibold text-primary mb-1.5">{sub.title}</h3>
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

            {/* Figure preview — mobile "Image" link and desktop click-to-enlarge both open it. */}
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
                    </div>
                )}
            </PreviewOverlay>
        </>
    );
}
