import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { useNavigationStore } from '@/stores/useNavigationStore';
import {
    UserGuide,
    type GuideBlock,
    type GuideChapter,
    type GuideInline,
    type GuideSection,
} from '@/Data/UserGuide';

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

/**
 * Everything the guide needs except where it is drawn: the role gate, the search
 * filter, the expand/collapse sets, active-anchor tracking and the release-note
 * deep link.
 *
 * WHY A HOOK: the guide has two hosts. UserGuideDrawer is its own top-level drawer
 * (the mobile surface, and the desktop entry from outside Settings), and Settings
 * hosts it nested in its own rail + center. Nesting exists because opening the guide
 * from the Settings rail used to unmount Settings outright — you did not drill into
 * the guide, you got teleported out of the surface you were in, with no way back.
 *
 * `isVisible` gates the effects, so the host that is not currently showing the guide
 * does not fight the other one for the scroll position or eat the deep-link target.
 */
export function useUserGuideNav(isVisible: boolean) {
    const isSupervisor = useAuthStore((s) => s.isSupervisorRole);
    const isProvider = useAuthStore((s) => s.isProviderRole);

    // Deep-link target (a release note tapped "Read more" → this section/subsection).
    const targetSectionId = useNavigationStore((s) => s.userGuideDrawerSectionId);
    const clearTarget = useNavigationStore((s) => s.clearUserGuideSection);

    const [query, setQuery] = useState('');
    const [activeId, setActiveId] = useState<string | null>(null);
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

    /** Jump the body to an anchor. Hosts that float their tree (the mobile Contents
     *  sheet) dismiss it in their own onJump wrapper. */
    const jumpTo = useCallback((anchorId: string) => {
        document.getElementById(`guide-${anchorId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setActiveId(anchorId);
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

    // A stale query would leave the tree pre-filtered the next time the host opens
    // the guide, with the search box off-screen in the rail explaining why.
    useEffect(() => {
        if (!isVisible) setQuery('');
    }, [isVisible]);

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

    // ── Deep-link: expand ancestors + scroll once the host has painted ───────
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

    return {
        query,
        setQuery,
        /** Truthy while a search is active — the tree force-expands on it. */
        searching: !!q,
        visibleChapters,
        activeId,
        expandedChapters,
        expandedSections,
        toggleChapter,
        toggleSection,
        jumpTo,
        bodyScrollRef,
    };
}
