import { useRef, useEffect, memo, useState, useCallback } from 'react'
import { Search, X } from 'lucide-react'
import { animated, type SpringValue } from '@react-spring/web'
import { CategoryList } from './CategoryList'
import { SearchResults } from './SearchResults'
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
  onSearchFocusChange?: (focused: boolean) => void
  headerCollapse?: SpringValue<number>
}

export const ColumnA = memo(function ColumnA({ onNavigate, onEdgeDrag, onEdgeDragEnd, onRightEdgeDrag, onRightEdgeDragEnd, searchInput = '', onSearchChange, searchResults, isSearching, onSearchFocusChange, headerCollapse }: ColumnAProps) {
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
    onSearchFocusChange?.(true)
    // Scroll active panel to top so search bar is fully visible
    const ref = panelIndex === 0 ? panel0ScrollRef : subcategoryScrollRef
    ref.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [onSearchFocusChange, panelIndex])

  // Unfocus when searchInput is cleared externally (e.g., search result navigation)
  useEffect(() => {
    if (searchFocused && !hasSearch && searchInputRef.current && document.activeElement !== searchInputRef.current) {
      setSearchFocused(false)
      onSearchFocusChange?.(false)
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
  }, [searchFocused, hasSearch, onSearchFocusChange, panelIndex, barHeight])

  const handleColumnSearchClose = useCallback(() => {
    onSearchChange?.('')
    setSearchFocused(false)
    onSearchFocusChange?.(false)
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
  }, [onSearchChange, onSearchFocusChange, panelIndex, barHeight])

  const handleColumnSearchBlur = useCallback(() => {
    if (!hasSearchRef.current) {
      setSearchFocused(false)
      onSearchFocusChange?.(false)
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
  }, [onSearchFocusChange, panelIndex, barHeight])

  const handleColumnSearchClear = useCallback(() => {
    onSearchChange?.('')
    searchInputRef.current?.focus()
  }, [onSearchChange])

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

  const mobilePaddingTop = isMobile && headerCollapse
    ? headerCollapse.to((c: number) => `calc(var(--sat, 0px) + 4rem * ${1 - c})`)
    : isMobile ? 'calc(var(--sat, 0px) + 4rem)' : undefined

  // Panel 0 content offset — header + search bar (mission board is in-flow at top of panel 0)
  const barExtra = hasMobileSearch ? ` + ${barHeight}px` : ''
  const panel0Padding = isMobile && headerCollapse
    ? headerCollapse.to((c: number) => `calc(var(--sat, 0px) + 4rem * ${1 - c}${barExtra})`)
    : isMobile ? `calc(var(--sat, 0px) + 4rem${barExtra})` : undefined

  // Other panels + search results — header + search bar only
  const mobilePanelPadding = isMobile && headerCollapse
    ? headerCollapse.to((c: number) => `calc(var(--sat, 0px) + 4rem * ${1 - c}${barExtra})`)
    : isMobile ? `calc(var(--sat, 0px) + 4rem${barExtra})` : undefined

  const panelWidth = `${100 / panelCount}%`

  return (
    <animated.div
      className="h-full overflow-hidden relative flex flex-col"
      style={{
        touchAction: 'pan-y',
      }}
      {...carousel.dragHandlers}
    >
      {/* Mobile header zone — search bar only, 1:1 scroll-driven collapse */}
      {hasMobileSearch && (
        <animated.div
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
                <div className={`flex-1 min-w-0 flex items-center transition-colors duration-200 bg-themewhite text-tertiary rounded-full border shadow-xs ${
                  searchFocused
                    ? 'border-themeblue1/30 bg-themewhite2'
                    : 'border-themeblue3/10'
                }`}>
                  <Search size={16} className="ml-3 shrink-0 text-tertiary/50" />
                  <input
                    ref={searchInputRef}
                    data-tour="column-search"
                    type="search"
                    placeholder="Search..."
                    value={searchInput}
                    onChange={(e) => onSearchChange!(e.target.value)}
                    onFocus={handleColumnSearchFocus}
                    onBlur={handleColumnSearchBlur}
                    onKeyDown={handleColumnSearchKeyDown}
                    className="text-tertiary bg-transparent outline-none text-[16px] w-full px-3 py-2 min-w-0 placeholder:text-tertiary/30 [&::-webkit-search-cancel-button]:hidden"
                  />
                  {hasSearch && (
                    <div
                      className="flex items-center justify-center px-2 py-2 bg-themewhite2 rounded-r-full cursor-pointer active:scale-95 shrink-0"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={handleColumnSearchClear}
                    >
                      <X className="w-5 h-5 stroke-themeblue1" />
                    </div>
                  )}
                </div>
                {/* Close button — appears when focused */}
                <div className={`transition-all duration-200 overflow-hidden ${
                  searchFocused ? 'w-10 opacity-100' : 'w-0 opacity-0'
                }`}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleColumnSearchClose}
                    className="w-10 h-10 rounded-full flex items-center justify-center bg-tertiary/10 active:scale-95 shrink-0"
                    aria-label="Cancel search"
                  >
                    <X size={18} className="text-tertiary" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </animated.div>
      )}

      {/* Search results overlay — shown during active search on mobile */}
      {hasSearch && (
        <animated.div className="flex-1 min-h-0 overflow-y-auto bg-themewhite" style={{ paddingTop: mobilePanelPadding }}>
          <div className="px-2 min-h-full">
            <SearchResults
              results={searchResults ?? []}
              searchTerm={searchInput}
              onResultClick={onNavigate}
              isSearching={isSearching}
            />
          </div>
        </animated.div>
      )}

      {/* Carousel — always mounted to preserve scroll positions and refs */}
      <div
        ref={carousel.containerRef}
        className={`flex flex-1 min-h-0 ${hasSearch ? 'hidden' : ''}`}
        style={{ width: `${panelCount * 100}%` }}
      >
        {/* Panel 0: Mission board (scrolls naturally) + main categories */}
        <div ref={panel0ScrollRef} data-tour="category-list" className="overflow-y-auto bg-themewhite self-stretch" style={{ flex: `0 0 ${panelWidth}` }}>
          <animated.div className="px-2 md:px-0 min-h-full" style={{ paddingTop: panel0Padding }}>
            {isMobile && (
              <div ref={missionBoardSectionRef} className="pb-2">
                <MissionBoardPanel />
              </div>
            )}
            <CategoryList mobilePanel="main" onNavigate={onNavigate} />
          </animated.div>
        </div>

        {/* Panel 1: Subcategories */}
        <div ref={subcategoryScrollRef} className="overflow-y-auto bg-themewhite self-stretch" style={{ flex: `0 0 ${panelWidth}` }}>
          <animated.div className="px-2 md:px-0 min-h-full" style={{ paddingTop: mobilePanelPadding }}>
            <CategoryList mobilePanel="subcategory" onNavigate={onNavigate} />
          </animated.div>
        </div>

        {/* Panel 2: Symptom info (desktop only) */}
        {!isMobile && (
          <div data-tour="guidelines-panel" className="overflow-y-auto bg-themewhite self-stretch" style={{ flex: `0 0 ${panelWidth}` }}>
            <div className="px-2 md:px-0 min-h-full">
              <CategoryList mobilePanel="guidelines" onNavigate={onNavigate} />
            </div>
          </div>
        )}
      </div>
    </animated.div>
  )
})
