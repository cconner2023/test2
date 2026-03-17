import { useRef, useEffect, memo, useState } from 'react'
import { X } from 'lucide-react'
import { animated, useSpring } from '@react-spring/web'
import { CategoryList } from './CategoryList'
import { SearchResults } from './SearchResults'
import { useColumnCarousel } from '../Hooks/useColumnCarousel'
import { SPRING_CONFIGS } from '../Utilities/GestureUtils'
import type { SearchResultType } from '../Types/CatTypes'
import {
  useNavigationStore,
  selectColumnAPanel,
  selectIsMobileColumnB,
} from '../stores/useNavigationStore'

interface ColumnAProps {
  onNavigate: (result: SearchResultType) => void
  onEdgeDrag?: (offset: number) => void
  onEdgeDragEnd?: (offset: number, velocity: number) => void
  searchInput?: string
  onSearchChange?: (value: string) => void
  searchResults?: SearchResultType[]
  isSearching?: boolean
}

export const ColumnA = memo(function ColumnA({ onNavigate, onEdgeDrag, onEdgeDragEnd, searchInput = '', onSearchChange, searchResults, isSearching }: ColumnAProps) {
  const selectedCategory = useNavigationStore((s) => s.selectedCategory)
  const selectedSymptom = useNavigationStore((s) => s.selectedSymptom)
  const isMobile = useNavigationStore((s) => s.isMobile)
  const panelIndex = useNavigationStore(selectColumnAPanel)
  const isMobileColumnB = useNavigationStore(selectIsMobileColumnB)
  const handleBackClick = useNavigationStore((s) => s.handleBackClick)

  const isVisible = !isMobileColumnB
  const panelCount = isMobile ? 2 : 3
  const carouselSyncKey = `${selectedCategory?.id}-${selectedSymptom?.id}`
  const hasSearch = isMobile && searchInput.trim().length > 0
  const hasMobileSearch = isMobile && !!onSearchChange

  const carousel = useColumnCarousel({
    enabled: isMobile,
    panelIndex: Math.min(panelIndex, panelCount - 1),
    panelCount,
    isVisible,
    syncKey: carouselSyncKey,
    onSwipeBack: handleBackClick,
    onEdgeDrag,
    onEdgeDragEnd,
  })

  // Panel scroll refs
  const panel0ScrollRef = useRef<HTMLDivElement>(null)
  const subcategoryScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (subcategoryScrollRef.current) subcategoryScrollRef.current.scrollTop = 0
  }, [selectedCategory])

  // ── Search bar: translates up with scroll (slides behind NavTop) ──
  const [barHeight, setBarHeight] = useState(52)
  const searchBarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (searchBarRef.current) {
      const h = searchBarRef.current.offsetHeight
      if (h > 0) setBarHeight(h)
    }
  }, [hasMobileSearch])

  const [searchSpring, searchApi] = useSpring(() => ({
    collapse: 0,
    config: SPRING_CONFIGS.page,
  }))

  useEffect(() => {
    if (!hasMobileSearch) return
    const ref = panelIndex === 0 ? panel0ScrollRef : subcategoryScrollRef
    const el = ref.current
    if (!el) return

    const onScroll = () => {
      if (searchInput.trim()) {
        searchApi.start({ collapse: 0 })
        return
      }
      const collapse = Math.min(el.scrollTop, barHeight)
      searchApi.start({ collapse })
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [panelIndex, hasMobileSearch, searchApi, barHeight, searchInput])

  useEffect(() => {
    if (searchInput.trim()) searchApi.start({ collapse: 0 })
  }, [searchInput, searchApi])

  const mobilePaddingTop = isMobile
    ? 'calc(var(--sat, 0px) + 4rem)'
    : undefined

  const panelWidth = `${100 / panelCount}%`

  return (
    <div
      className="h-full overflow-hidden relative flex flex-col"
      style={{
        touchAction: 'pan-y',
        paddingTop: mobilePaddingTop,
      }}
      {...carousel.dragHandlers}
    >
      {/* Mobile search bar — in-flow height collapse matching ScrollRevealSearch */}
      {hasMobileSearch && (
        <animated.div
          className="overflow-hidden shrink-0"
          style={{
            height: searchSpring.collapse.to(c => Math.max(0, barHeight - c)),
            opacity: searchSpring.collapse.to(c => 1 - (c / barHeight) * 0.6),
          }}
        >
          <div ref={searchBarRef} className="px-3 py-2">
            <div className="flex items-center transition-colors duration-200 bg-themewhite text-tertiary rounded-full border border-themeblue3/10 shadow-xs focus-within:border-themeblue1/30 focus-within:bg-themewhite2">
              <input
                type="search"
                placeholder="Search..."
                value={searchInput}
                onChange={(e) => onSearchChange!(e.target.value)}
                className="text-tertiary bg-transparent outline-none text-[16px] w-full px-4 py-2 rounded-l-full min-w-0 [&::-webkit-search-cancel-button]:hidden"
              />
              {hasSearch && (
                <div
                  className="flex items-center justify-center px-2 py-2 bg-themewhite2 stroke-themeblue3 rounded-r-full cursor-pointer transition-colors duration-200 hover:bg-themewhite shrink-0 active:scale-95"
                  onClick={() => onSearchChange!('')}
                >
                  <X className="w-5 h-5 stroke-themeblue1" />
                </div>
              )}
            </div>
          </div>
        </animated.div>
      )}

      {/* Carousel */}
      <animated.div
        className="flex flex-1 min-h-0"
        style={{
          width: `${panelCount * 100}%`,
          transform: carousel.style.x.to((x: number) => `translateX(${x}%)`),
        }}
      >
        {/* Panel 0: Main categories */}
        <div ref={panel0ScrollRef} className="h-full overflow-y-auto bg-themewhite" style={{ flex: `0 0 ${panelWidth}` }}>
          <div className="px-2 md:px-0 min-h-full">
            <CategoryList mobilePanel="main" onNavigate={onNavigate} />
          </div>
        </div>

        {/* Panel 1: Subcategories */}
        <div ref={subcategoryScrollRef} className="h-full overflow-y-auto bg-themewhite" style={{ flex: `0 0 ${panelWidth}` }}>
          <div className="px-2 md:px-0 min-h-full">
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
      </animated.div>

      {/* Mobile: Search results overlay */}
      {hasSearch && (
        <div className="absolute inset-0 z-5 bg-themewhite overflow-y-auto" style={{ paddingTop: 'calc(var(--sat, 0px) + 4rem)' }}>
          <div className="px-2 min-h-full">
            <SearchResults
              results={searchResults ?? []}
              searchTerm={searchInput}
              onResultClick={onNavigate}
              isSearching={isSearching}
            />
          </div>
        </div>
      )}
    </div>
  )
})
