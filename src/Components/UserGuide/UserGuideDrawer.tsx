import { useCallback, useMemo, useState } from 'react';
import { X, List } from 'lucide-react';
import { HeaderPill, PillButton } from '@/Components/primitives/HeaderPill';
import { SearchInput } from '@/Components/primitives/SearchInput';
import { BaseDrawer } from '@/Components/primitives/BaseDrawer';
import { Sheet } from '@/Components/primitives/Sheet';
import { useIsMobile } from '@/Hooks/useIsMobile';
import { USER_GUIDE_VERSION } from '@/Data/UserGuide';
import { UserGuideTree } from './UserGuideTree';
import { UserGuideBody } from './UserGuideBody';
import { useUserGuideNav } from './useUserGuideNav';

interface UserGuideDrawerProps {
    isVisible: boolean;
    onClose: () => void;
}

export function UserGuideDrawer({ isVisible, onClose }: UserGuideDrawerProps) {
    const isMobile = useIsMobile();
    const [tocOpen, setTocOpen] = useState(false);

    const {
        query, setQuery, searching, visibleChapters, activeId,
        expandedChapters, expandedSections, toggleChapter, toggleSection,
        jumpTo, bodyScrollRef,
    } = useUserGuideNav(isVisible);

    // Jumping from the mobile Contents sheet also dismisses it.
    const handleJump = useCallback((anchorId: string) => {
        jumpTo(anchorId);
        setTocOpen(false);
    }, [jumpTo]);

    const handleClose = useCallback(() => {
        setQuery('');
        setTocOpen(false);
        onClose();
    }, [onClose, setQuery]);

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
    }, [isMobile, query, setQuery, handleClose]);

    const emptyState = visibleChapters.length === 0 && (
        <p className="text-[10pt] text-tertiary text-center py-16">No sections match “{query}”.</p>
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
                        <aside className="w-[260px] shrink-0 border-r border-tertiary/12 flex flex-col">
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
                                    onJump={handleJump}
                                    expandAll={searching}
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
                            onJump={handleJump}
                            expandAll={searching}
                        />
                    </div>
                </Sheet>
            )}
        </>
    );
}
