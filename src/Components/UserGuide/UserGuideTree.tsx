import { ChevronRight } from 'lucide-react';
import type { GuideChapter } from '../../Data/UserGuide';

interface UserGuideTreeProps {
    /** Already role-gated + search-filtered chapters. */
    chapters: GuideChapter[];
    /** Currently scrolled-to anchor id — highlighted in the tree. */
    activeId: string | null;
    /** Chapter ids that are expanded. Ignored when `expandAll` is set. */
    expandedChapters: Set<string>;
    /** Section ids that are expanded (reveals their subsections). Ignored when `expandAll`. */
    expandedSections: Set<string>;
    onToggleChapter: (id: string) => void;
    onToggleSection: (id: string) => void;
    /** Scroll the body to this anchor (and, on mobile, dismiss the sheet). */
    onJump: (anchorId: string) => void;
    /** Force every branch open — used while a search query is active. */
    expandAll?: boolean;
}

/**
 * Three-level collapsible table of contents: Chapter → Section → Subsection.
 * Rows split responsibilities — the chevron toggles a branch, the label jumps
 * the body to that anchor. Sections with no subsections are leaves (no chevron).
 */
export function UserGuideTree({
    chapters,
    activeId,
    expandedChapters,
    expandedSections,
    onToggleChapter,
    onToggleSection,
    onJump,
    expandAll = false,
}: UserGuideTreeProps) {
    return (
        <nav className="py-2">
            {chapters.map((chapter) => {
                const chapterOpen = expandAll || expandedChapters.has(chapter.id);
                return (
                    <div key={chapter.id} className="mb-0.5">
                        {/* L1 — chapter */}
                        <button
                            onClick={() => onToggleChapter(chapter.id)}
                            className="w-full flex items-center gap-1.5 px-3 py-2 text-left active:scale-[0.99] transition-transform"
                        >
                            <ChevronRight
                                size={14}
                                className={`shrink-0 text-tertiary transition-transform duration-200 ${chapterOpen ? 'rotate-90' : ''}`}
                            />
                            <span className="text-[10pt] font-semibold text-primary uppercase tracking-wide">
                                {chapter.label}
                            </span>
                        </button>

                        {/* L2 — sections */}
                        <div
                            className="grid transition-[grid-template-rows] duration-200 ease-out"
                            style={{ gridTemplateRows: chapterOpen ? '1fr' : '0fr' }}
                        >
                            <div className="overflow-hidden min-h-0">
                                {chapter.sections.map((section) => {
                                    const hasSubs = !!section.subsections?.length;
                                    const sectionOpen = expandAll || expandedSections.has(section.id);
                                    const active = activeId === section.id;
                                    return (
                                        <div key={section.id}>
                                            <div className="flex items-stretch pl-3">
                                                {hasSubs ? (
                                                    <button
                                                        onClick={() => onToggleSection(section.id)}
                                                        className="shrink-0 flex items-center justify-center w-6 active:scale-90 transition-transform"
                                                        aria-label={sectionOpen ? 'Collapse' : 'Expand'}
                                                    >
                                                        <ChevronRight
                                                            size={13}
                                                            className={`text-tertiary transition-transform duration-200 ${sectionOpen ? 'rotate-90' : ''}`}
                                                        />
                                                    </button>
                                                ) : (
                                                    <span className="shrink-0 w-6" />
                                                )}
                                                <button
                                                    onClick={() => onJump(section.id)}
                                                    className={`flex-1 min-w-0 text-left pr-3 py-1.5 rounded-lg transition-colors ${
                                                        active ? 'text-themeblue2 font-medium' : 'text-secondary hover:text-primary'
                                                    }`}
                                                >
                                                    <span className="block truncate text-[10pt]">{section.title}</span>
                                                </button>
                                            </div>

                                            {/* L3 — subsections */}
                                            {hasSubs && (
                                                <div
                                                    className="grid transition-[grid-template-rows] duration-200 ease-out"
                                                    style={{ gridTemplateRows: sectionOpen ? '1fr' : '0fr' }}
                                                >
                                                    <div className="overflow-hidden min-h-0">
                                                        {section.subsections!.map((sub) => {
                                                            const subActive = activeId === sub.id;
                                                            return (
                                                                <button
                                                                    key={sub.id}
                                                                    onClick={() => onJump(sub.id)}
                                                                    className={`w-full text-left pl-12 pr-3 py-1.5 rounded-lg transition-colors ${
                                                                        subActive ? 'text-themeblue2 font-medium' : 'text-tertiary hover:text-primary'
                                                                    }`}
                                                                >
                                                                    <span className="block truncate text-[9.5pt]">{sub.title}</span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                );
            })}
        </nav>
    );
}
