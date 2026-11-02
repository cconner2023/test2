import { useRef, useEffect, memo, useState, useCallback } from 'react'
import { CategoryList } from './CategoryList'
import { SearchResults } from './SearchResults'
import { SearchInput } from '@/Components/primitives/SearchInput'
import { SearchCancelButton } from '@/Components/primitives/SearchDropdown'
import { MissionBoardPanel } from './MissionBoard/MissionBoardPanel'
import { useColumnCarousel } from '../Hooks/useColumnCarousel'
import type { SearchResultType } from '../Types/CatTypes'
import {
  useNavigationStore,
  selectIsMobileColumnB,
} from '../stores/useNavigationStore'

interface ColumnAProps {
  onNavigate: (result: SearchResultType) => void
  onEdgeDrag?: (offset: number) => void
  onEdgeDragEnd?: (offset: number, velocity: number) => void
  onRightEdgeDrag?: (offset: number) => void
  onRightEdgeDragEnd?: (offset: number, velocity: number) => void
  searchInput?: string
  onSearchChange?: (value: string) => void
  searchResults?: SearchResultType[]
  isSearching?: boolean
}

export const ColumnA = memo(function ColumnA({ onNavigate, onEdgeDrag, onEdgeDragEnd, onRightEdgeDrag, onRightEdgeDragEnd, searchInput = '', onSearchChange, searchResults, isSearching }: ColumnAProps) {
  const selectedCategory = useNavigationStore((s) => s.selectedCategory)
  const selectedSymptom = useNavigationStore((s) => s.selectedSymptom)
  const isMobile = useNavigationStore((s) => s.isMobile)
  const panelIndex = useNavigationStore((s) => s.columnAPanel)
  const isMobileColumnB = useNavigationStore(selectIsMobileColumnB)
  const handleBackClick = useNavigationStore((s) => s.handleBackClick)

  const isVisible = !isMobileColumnB
  const panelCount = isMobile ? 2 : 3
  const hasSearch = isMobile && searchInput.trim().length > 0
  const hasMobileSearch = isMobile && !!onSearchChange

  const carousel = useColumnCarousel({
    enabled: isMobile,
    panelIndex: Math.min(panelIndex, panelCount - 1),
    panelCount,
    isVisible,
    onSwipeBack: handleBackClick,
    onEdgeDrag,
    onEdgeDragEnd,
    onRightEdgeDrag,
    onRightEdgeDragEnd,
  })

  // Panel scroll refs
  const panel0ScrollRef = useRef<HTMLDivElement>(null)
  const subcategoryScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (subcategoryScrollRef.current) subcategoryScrollRef.current.scrollTop = 0
  }, [selectedCategory])

  // ── Search bar + Mission board: 1:1 scroll-driven height collapse (no spring) ──
  const [barHeight, setBarHeight] = useState(52)
  const searchBarRef = useRef<HTMLDivElement>(null)
  const missionBoardSectionRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [searchFocused, setSearchFocused] = useState(false)
  const searchFocusedRef = useRef(false)
  searchFocusedRef.current = searchFocused
  const hasSearchRef = useRef(hasSearch)
  hasSearchRef.current = hasSearch

  useEffect(() => {
    if (searchBarRef.current) {
      const h = searchBarRef.current.offsetHeight
      if (h > 0) setBarHeight(h)
    }
  }, [hasMobileSearch])

  useEffect(() => {
    if (!hasMobileSearch) return
    const ref = panelIndex === 0 ? panel0ScrollRef : subcategoryScrollRef
    const el = ref.current
    const wrapper = wrapperRef.current
    if (!el || !wrapper) return

    let rafId: number | null = null

    const onScroll = () => {
      if (rafId !== null) return
      rafId = requestAnimationFrame(() => {
        rafId = null
        // During search or focus: show only the search bar
        if (searchFocusedRef.current || hasSearchRef.current) {
          wrapper.style.height = `${barHeight}px`
          wrapper.style.opacity = '1'
          if (innerRef.current) innerRef.current.style.transform = 'translateY(0px)'
          return
        }
        const scrollTop = el.scrollTop
        if (scrollTop < 0) {
          wrapper.style.height = `${barHeight}px`
          wrapper.style.opacity = '1'
          if (innerRef.current) innerRef.current.style.transform = `translateY(${scrollTop * 0.3}px)`
        } else {
          const collapsed = Math.min(scrollTop, barHeight)
          wrapper.style.height = `${barHeight - collapsed}px`
          wrapper.style.opacity = barHeight > 0
            ? String(1 - (collapsed / barHeight) * 0.6)
            : '1'
          if (innerRef.current) innerRef.current.style.transform = 'translateY(0px)'
        }
      })
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      if (rafId !== null) cancelAnimationFrame(rafId)
    }
  }, [panelIndex, hasMobileSearch, barHeight])

  // Keep bar expanded when value is present or focused (mission board hidden during search)
  useEffect(() => {
    if (!wrapperRef.current) return
    if (hasSearch || searchFocused) {
      wrapperRef.current.style.height = `${barHeight}px`
      wrapperRef.current.style.opacity = '1'
    }
  }, [hasSearch, searchFocused, barHeight])

  const handleColumnSearchFocus = useCallback(() => {
    setSearchFocused(true)
    // Scroll active panel to top so search bar is fully visible
    const ref = panelIndex === 0 ? panel0ScrollRef : subcategoryScrollRef
    ref.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [panelIndex])

  // Unfocus when searchInput is cleared externally (e.g., search result navigation)
  useEffect(() => {
    if (searchFocused && !hasSearch && searchInputRef.current && document.activeElement !== searchInputRef.current) {
      setSearchFocused(false)
      const ref = panelIndex === 0 ? panel0ScrollRef : subcategoryScrollRef
      const el = ref.current
      const wrapper = wrapperRef.current
      if (el && wrapper) {
        const collapsed = Math.max(0, Math.min(el.scrollTop, barHeight))
        wrapper.style.height = `${barHeight - collapsed}px`
        wrapper.style.opacity = barHeight > 0
          ? String(1 - (collapsed / barHeight) * 0.6)
          : '1'
      }
    }
  }, [searchFocused, hasSearch, panelIndex, barHeight])

  const handleColumnSearchClose = useCallback(() => {
    onSearchChange?.('')
    setSearchFocused(false)
    searchInputRef.current?.blur()
    // Recompute collapse to current scroll position
    const ref = panelIndex === 0 ? panel0ScrollRef : subcategoryScrollRef
    const el = ref.current
    const wrapper = wrapperRef.current
    if (!el || !wrapper) return
    const collapsed = Math.max(0, Math.min(el.scrollTop, barHeight))
    wrapper.style.height = `${barHeight - collapsed}px`
    wrapper.style.opacity = barHeight > 0
      ? String(1 - (collapsed / barHeight) * 0.6)
      : '1'
  }, [onSearchChange, panelIndex, barHeight])

  const handleColumnSearchBlur = useCallback(() => {
    if (!hasSearchRef.current) {
      setSearchFocused(false)
      const ref = panelIndex === 0 ? panel0ScrollRef : subcategoryScrollRef
      const el = ref.current
      const wrapper = wrapperRef.current
      if (!el || !wrapper) return
      const collapsed = Math.max(0, Math.min(el.scrollTop, barHeight))
      wrapper.style.height = `${barHeight - collapsed}px`
      wrapper.style.opacity = barHeight > 0
        ? String(1 - (collapsed / barHeight) * 0.6)
        : '1'
    }
  }, [panelIndex, barHeight])

  const handleColumnSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (hasSearch) {
        onSearchChange?.('')
        searchInputRef.current?.focus()
      } else {
        handleColumnSearchClose()
      }
    }
  }, [hasSearch, onSearchChange, handleColumnSearchClose])

  const mobilePaddingTop = isMobile ? 'calc(var(--sat, 0px) + 4rem)' : undefined

  // Content offset — header + search bar
  const barExtra = hasMobileSearch ? ` + ${barHeight}px` : ''
  const mobilePanelPadding = isMobile ? `calc(var(--sat, 0px) + 4rem${barExtra})` : undefined

  const panelWidth = `${100 / panelCount}%`

  return (
    <div
      className="h-full overflow-hidden relative flex flex-col"
      style={{
        touchAction: 'pan-y',
      }}
      {...carousel.dragHandlers}
    >
      {/* Mobile header zone — search bar only, 1:1 scroll-driven collapse */}
      {hasMobileSearch && (
        <div
          ref={wrapperRef}
          className={`overflow-hidden ${isMobile ? 'absolute left-0 right-0 z-10 bg-themewhite' : 'shrink-0'}`}
          style={{
            height: barHeight,
            opacity: 1,
            ...(isMobile ? { top: mobilePaddingTop } : {}),
          }}
        >
          <div ref={innerRef}>
            {/* Search bar */}
            <div ref={searchBarRef} className="px-3 py-2">
              <div className="flex items-center gap-2">
                <SearchInput
                  ref={searchInputRef}
                  value={searchInput}
                  onChange={onSearchChange!}
                  placeholder="Search..."
                  onFocus={handleColumnSearchFocus}
                  onBlur={handleColumnSearchBlur}
                  onKeyDown={handleColumnSearchKeyDown}
                  hideClear
                  className="flex-1 min-w-0"
                />
                {/* Close button — appears when focused */}
                <div className={`transition-all duration-200 overflow-hidden ${
                  searchFocused ? 'w-10 opacity-100' : 'w-0 opacity-0'
                }`}>
                  <SearchCancelButton onClick={handleColumnSearchClose} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search dropdown — lifted card anchored under the search row; the
          carousel stays mounted and visible beneath it. */}
      {hasSearch && (
        <div
          className="absolute left-0 right-0 z-20 px-3 pt-1 pointer-events-none"
          style={{ top: mobilePanelPadding }}
        >
          <SearchResults
            results={searchResults ?? []}
            searchTerm={searchInput}
            onResultClick={onNavigate}
            isSearching={isSearching}
            className="pointer-events-auto"
          />
        </div>
      )}

      {/* Carousel — always mounted to preserve scroll positions and refs */}
      <div
        ref={carousel.containerRef}
        className="flex flex-1 min-h-0"
        style={{ width: `${panelCount * 100}%` }}
      >
        {/* Panel 0: Mission board (scrolls naturally) + main categories */}
        <div ref={panel0ScrollRef} className="h-full overflow-y-auto bg-themewhite" style={{ flex: `0 0 ${panelWidth}` }}>
          <div className="px-2 md:px-0 min-h-full" style={{ paddingTop: mobilePanelPadding }}>
            {isMobile && (
              <div ref={missionBoardSectionRef} className="pb-2">
                <MissionBoardPanel />
              </div>
            )}
            <CategoryList mobilePanel="main" onNavigate={onNavigate} />
          </div>
        </div>

        {/* Panel 1: Subcategories */}
        <div ref={subcategoryScrollRef} className="h-full overflow-y-auto bg-themewhite" style={{ flex: `0 0 ${panelWidth}` }}>
          <div className="px-2 md:px-0 min-h-full" style={{ paddingTop: mobilePanelPadding }}>
            <CategoryList mobilePanel="subcategory" onNavigate={onNavigate} />
          </div>
        </div>

        {/* Panel 2: Symptom info (desktop only) */}
        {!isMobile && (
          <div className="h-full overflow-y-auto bg-themewhite" style={{ flex: `0 0 ${panelWidth}` }}>
            <div className="px-2 md:px-0 min-h-full">
              <CategoryList mobilePanel="guidelines" onNavigate={onNavigate} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
})
