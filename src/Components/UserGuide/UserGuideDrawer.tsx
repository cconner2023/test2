import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, List } from 'lucide-react';
import { HeaderPill, PillButton } from '@/Components/primitives/HeaderPill';
import { SearchInput } from '@/Components/primitives/SearchInput';
import { BaseDrawer } from '@/Components/primitives/BaseDrawer';
import { Sheet } from '@/Components/primitives/Sheet';
import { useIsMobile } from '@/Hooks/useIsMobile';
import { useAuthStore } from '@/stores/useAuthStore';
import { useNavigationStore } from '@/stores/useNavigationStore';
import {
    UserGuide,
    USER_GUIDE_VERSION,
    type GuideBlock,
    type GuideChapter,
    type GuideInline,
    type GuideSection,
} from '@/Data/UserGuide';
import { UserGuideTree } from './UserGuideTree';
import { UserGuideBody } from './UserGuideBody';

interface UserGuideDrawerProps {
    isVisible: boolean;
    onClose: () => void;
}

/** Flatten inline content to searchable plain text — string spans verbatim, button
 *  segments contributing their label (or icon key) so "delete button" still matches. */
const inlineText = (content: GuideInline): string =>
    typeof content === 'string'
        ? content
        : content
            .map((seg) =>
                typeof seg === 'string' ? seg
                    : typeof seg.btn === 'string' ? seg.btn
                        : seg.btn.label ?? seg.btn.icon,
            )
            .join(' ');

/** True if any p/sub/note text or list/steps item contains the query. */
const blocksMatch = (blocks: GuideBlock[] | undefined, q: string): boolean =>
    (blocks ?? []).some((b) =>
        'text' in b ? inlineText(b.text).toLowerCase().includes(q)
            : 'items' in b ? b.items.some((i) => inlineText(i).toLowerCase().includes(q))
                : false,
    );

export function UserGuideDrawer({ isVisible, onClose }: UserGuideDrawerProps) {
    const isMobile = useIsMobile();
    const isSupervisor = useAuthStore((s) => s.isSupervisorRole);
    const isProvider = useAuthStore((s) => s.isProviderRole);

    // Deep-link target (a release note tapped "Read more" → this section/subsection).
    const targetSectionId = useNavigationStore((s) => s.userGuideDrawerSectionId);
    const clearTarget = useNavigationStore((s) => s.clearUserGuideSection);

    const [query, setQuery] = useState('');
    const [activeId, setActiveId] = useState<string | null>(null);
    const [tocOpen, setTocOpen] = useState(false);
    const [expandedChapters, setExpandedChapters] = useState<Set<string>>(
        () => new Set(UserGuide.map((c) => c.id)),
    );
    const [expandedSections, setExpandedSections] = useState<Set<string>>(() => new Set());

    const bodyScrollRef = useRef<HTMLDivElement>(null);

    // ── Role gate + search filter → the chapters actually shown ──────────────
    const q = query.trim().toLowerCase();
    const visibleChapters = useMemo<GuideChapter[]>(() => {
        const gate = (s: GuideSection) => {
            if (s.tier === 'supervisor') return isSupervisor;
            if (s.tier === 'provider') return isProvider;
            return true;
        };
        return UserGuide
            .map((chapter) => {
                const sections = chapter.sections.filter(gate).map((section) => {
                    if (!q) return section;
                    const selfMatch =
                        section.title.toLowerCase().includes(q) ||
                        section.summary.toLowerCase().includes(q) ||
                        blocksMatch(section.blocks, q);
                    if (selfMatch) return section;
                    const subs = (section.subsections ?? []).filter(
                        (sub) => sub.title.toLowerCase().includes(q) || blocksMatch(sub.blocks, q),
                    );
                    return subs.length ? { ...section, subsections: subs } : null;
                }).filter(Boolean) as GuideSection[];
                return { ...chapter, sections };
            })
            .filter((chapter) => chapter.sections.length > 0);
    }, [q, isSupervisor, isProvider]);

    // ── Jump the body to an anchor (and dismiss the mobile TOC sheet) ────────
    const jumpTo = useCallback((anchorId: string) => {
        document.getElementById(`guide-${anchorId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setActiveId(anchorId);
        setTocOpen(false);
    }, []);

    const toggleChapter = useCallback((id: string) => {
        setExpandedChapters((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }, []);
    const toggleSection = useCallback((id: string) => {
        setExpandedSections((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }, []);

    // ── Active-anchor tracking: highlight the section nearest the top ────────
    useEffect(() => {
        const root = bodyScrollRef.current;
        if (!root || !isVisible) return;
        const anchors = root.querySelectorAll('[data-guide-anchor]');
        if (!anchors.length) return;
        const observer = new IntersectionObserver(
            (entries) => {
                const hit = entries.find((e) => e.isIntersecting);
                if (hit) setActiveId(hit.target.getAttribute('data-guide-anchor'));
            },
            // "Active" once an anchor crosses into the top ~20% of the viewport.
            { root, rootMargin: '0px 0px -80% 0px', threshold: 0 },
        );
        anchors.forEach((a) => observer.observe(a));
        return () => observer.disconnect();
    }, [visibleChapters, isVisible]);

    // ── Deep-link: expand ancestors + scroll once the drawer has painted ─────
    useEffect(() => {
        if (!isVisible || !targetSectionId) return;
        // Expand the chapter (and parent section, if the target is a subsection).
        for (const chapter of UserGuide) {
            for (const section of chapter.sections) {
                const isSection = section.id === targetSectionId;
                const parentOfSub = section.subsections?.some((s) => s.id === targetSectionId);
                if (isSection || parentOfSub) {
                    setExpandedChapters((prev) => new Set(prev).add(chapter.id));
                    if (parentOfSub) setExpandedSections((prev) => new Set(prev).add(section.id));
                }
            }
        }
        // Wait past the open animation (~250ms) before measuring for the scroll.
        const t = setTimeout(() => {
            document.getElementById(`guide-${targetSectionId}`)
                ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setActiveId(targetSectionId);
            clearTarget();
        }, 320);
        return () => clearTimeout(t);
    }, [isVisible, targetSectionId, clearTarget]);

    const handleClose = useCallback(() => {
        setQuery('');
        setTocOpen(false);
        onClose();
    }, [onClose]);

    // ── Header ───────────────────────────────────────────────────────────────
    // Desktop: plain title + close — the search lives at the top of the left pane
    // (matches the Property primitive). Mobile: [TOC pill] · search · close.
    const headerConfig = useMemo(() => {
        if (!isMobile) {
            return {
                title: 'User Guide',
                hideDefaultClose: true,
                rightContent: (
                    <HeaderPill>
                        <PillButton icon={X} onClick={handleClose} label="Close" />
                    </HeaderPill>
                ),
            };
        }
        return {
            title: '',
            rightContentFill: true,
            hideDefaultClose: true,
            rightContent: (
                <div className="flex items-center w-full gap-2">
                    <HeaderPill>
                        <PillButton icon={List} onClick={() => setTocOpen(true)} label="Contents" />
                    </HeaderPill>
                    <div className="flex-1 min-w-0">
                        <SearchInput value={query} onChange={setQuery} placeholder="Search the guide" />
                    </div>
                    <HeaderPill>
                        <PillButton icon={X} onClick={handleClose} label="Close" />
                    </HeaderPill>
                </div>
            ),
        };
    }, [isMobile, query, handleClose]);

    const emptyState = visibleChapters.length === 0 && (
        <p className="text-[10.5pt] text-tertiary text-center py-16">No sections match “{query}”.</p>
    );

    return (
        <>
            <BaseDrawer
                isVisible={isVisible}
                onClose={handleClose}
                mobileFullScreen
                fullHeight="95dvh"
                desktopPosition="left"
                desktopWidth="w-[90%]"
                header={headerConfig}
                glassHeader={isMobile}
                scrollDisabled
            >
                {isMobile ? (
                    // Mobile — single scrolling body; TOC lives in the sheet.
                    <div
                        ref={bodyScrollRef}
                        className="h-full overflow-y-auto"
                        style={{ paddingTop: 'var(--drawer-header-h, 3.5rem)' }}
                    >
                        {emptyState || <UserGuideBody chapters={visibleChapters} isMobile />}
                        <p className="text-[9pt] text-tertiary text-center pb-10">User Guide · v{USER_GUIDE_VERSION}</p>
                    </div>
                ) : (
                    // Desktop — two panes: tree (left) + body (right).
                    <div className="h-full flex">
                        <aside className="w-72 shrink-0 border-r border-tertiary/12 flex flex-col">
                            <div className="p-2.5 border-b border-tertiary/10">
                                <SearchInput value={query} onChange={setQuery} placeholder="Search the guide" />
                            </div>
                            <div className="flex-1 min-h-0 overflow-y-auto">
                                <UserGuideTree
                                    chapters={visibleChapters}
                                    activeId={activeId}
                                    expandedChapters={expandedChapters}
                                    expandedSections={expandedSections}
                                    onToggleChapter={toggleChapter}
                                    onToggleSection={toggleSection}
                                    onJump={jumpTo}
                                    expandAll={!!q}
                                />
                            </div>
                        </aside>
                        <div ref={bodyScrollRef} className="flex-1 min-w-0 overflow-y-auto">
                            {emptyState || <UserGuideBody chapters={visibleChapters} isMobile={false} />}
                            <p className="text-[9pt] text-tertiary text-center pb-10">User Guide · v{USER_GUIDE_VERSION}</p>
                        </div>
                    </div>
                )}
            </BaseDrawer>

            {/* Mobile TOC — content-hugging sheet capped at 70dvh, opened by the
                header Contents pill. Portals to body so it escapes the drawer's
                transformed / glass-isolated stacking context. */}
            {isMobile && (
                <Sheet
                    isOpen={tocOpen}
                    onClose={() => setTocOpen(false)}
                    title="Contents"
                    maxHeight={60}
                    // Fit sheets default to Z.SHEET (50), but this nests over the
                    // full-screen guide drawer (z-60) — lift it so the TOC isn't
                    // trapped behind the drawer (matches the snap-sheet default).
                    zIndex={1200}
                >
                    <div className="pb-2">
                        <UserGuideTree
                            chapters={visibleChapters}
                            activeId={activeId}
                            expandedChapters={expandedChapters}
                            expandedSections={expandedSections}
                            onToggleChapter={toggleChapter}
                            onToggleSection={toggleSection}
                            onJump={jumpTo}
                            expandAll={!!q}
                        />
                    </div>
                </Sheet>
            )}
        </>
    );
}
