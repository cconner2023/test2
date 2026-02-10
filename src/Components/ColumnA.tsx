import { useRef, useEffect } from 'react'
import { animated } from '@react-spring/web'
import { CategoryList } from './CategoryList'
import { useColumnCarousel } from '../Hooks/useColumnCarousel'
import type { catDataTypes, subCatDataTypes, SearchResultType } from '../Types/CatTypes'

interface ColumnAProps {
  selectedCategory: catDataTypes | null
  selectedSymptom: subCatDataTypes | null
  selectedGuideline: {
    type: 'gen' | 'medcom' | 'stp' | 'DDX'
    id: number
    symptomId: number
  } | null
  onNavigate: (result: SearchResultType) => void
  isMobile: boolean
  panelIndex: number
  onSwipeBack?: () => void
  onSwipeForward?: () => void
  /** Callback to report carousel swiping state — used by cross-column swipe to avoid conflicts */
  onSwipingChange?: (isSwiping: boolean) => void
  /** Whether Column A is the active (visible) column on mobile.
   *  When false, Column A is hidden (grid 0fr) and the carousel spring may drift. */
  isActiveColumn?: boolean
}

export function ColumnA({
  selectedCategory,
  selectedSymptom,
  selectedGuideline,
  onNavigate,
  isMobile,
  panelIndex,
  onSwipeBack,
  onSwipeForward,
  onSwipingChange,
  isActiveColumn = true,
}: ColumnAProps) {
  // Mobile: 2 panels (main, subcategory). Desktop: 3 panels (+ symptom info)
  const panelCount = isMobile ? 2 : 3

  const carousel = useColumnCarousel({
    enabled: isMobile,
    panelIndex: Math.min(panelIndex, panelCount - 1),
    panelCount,
    isVisible: isActiveColumn,
    onSwipeBack,
    onSwipeForward,
  })

  // Report carousel swiping state to parent so cross-column swipe can avoid conflicts
  const prevSwipingRef = useRef(false)
  useEffect(() => {
    if (carousel.isSwiping !== prevSwipingRef.current) {
      prevSwipingRef.current = carousel.isSwiping
      onSwipingChange?.(carousel.isSwiping)
    }
  }, [carousel.isSwiping, onSwipingChange])

  // Scroll-to-top ref for subcategory panel when category changes
  const subcategoryScrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (subcategoryScrollRef.current) {
      subcategoryScrollRef.current.scrollTop = 0
    }
  }, [selectedCategory])

  // Panel width as percentage of the flex container
  const panelWidth = `${100 / panelCount}%`

  return (
    <div
      className="h-full overflow-hidden"
      style={{ touchAction: 'pan-y' }}
      {...carousel.dragHandlers}
    >
      <animated.div
        className="flex h-full"
        style={{
          width: `${panelCount * 100}%`,
          transform: carousel.style.x.to((x: number) => `translateX(${x}%)`),
        }}
      >
        {/* Panel 0: Main categories */}
        <div className="h-full overflow-y-auto bg-themewhite" style={{ flex: `0 0 ${panelWidth}` }}>
          <div
            className="px-2 min-h-full"
            style={isMobile ? { paddingTop: 'calc(env(safe-area-inset-top, 0px) + 4rem)' } : undefined}
          >
            <CategoryList
              mobilePanel="main"
              selectedCategory={selectedCategory}
              selectedSymptom={selectedSymptom}
              selectedGuideline={selectedGuideline}
              onNavigate={onNavigate}
            />
          </div>
        </div>

        {/* Panel 1: Subcategories */}
        <div
          ref={subcategoryScrollRef}
          className="h-full overflow-y-auto bg-themewhite"
          style={{ flex: `0 0 ${panelWidth}` }}
        >
          <div
            className="px-2 min-h-full"
            style={isMobile ? { paddingTop: 'calc(env(safe-area-inset-top, 0px) + 4rem)' } : undefined}
          >
            <CategoryList
              mobilePanel="subcategory"
              selectedCategory={selectedCategory}
              selectedSymptom={selectedSymptom}
              selectedGuideline={selectedGuideline}
              onNavigate={onNavigate}
            />
          </div>
        </div>

        {/* Panel 2: Symptom info (desktop only) */}
        {!isMobile && (
          <div className="h-full overflow-y-auto bg-themewhite" style={{ flex: `0 0 ${panelWidth}` }}>
            <div className="px-2 min-h-full">
              <CategoryList
                mobilePanel="guidelines"
                selectedCategory={selectedCategory}
                selectedSymptom={selectedSymptom}
                selectedGuideline={selectedGuideline}
                onNavigate={onNavigate}
              />
            </div>
          </div>
        )}
      </animated.div>
    </div>
  )
}
