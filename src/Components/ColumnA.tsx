import { useRef, useEffect, memo } from 'react'
import { animated } from '@react-spring/web'
import { CategoryList } from './CategoryList'
import { useColumnCarousel } from '../Hooks/useColumnCarousel'
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
}

export const ColumnA = memo(function ColumnA({ onNavigate, onEdgeDrag, onEdgeDragEnd }: ColumnAProps) {
  const selectedCategory = useNavigationStore((s) => s.selectedCategory)
  const selectedSymptom = useNavigationStore((s) => s.selectedSymptom)
  const isMobile = useNavigationStore((s) => s.isMobile)
  const panelIndex = useNavigationStore(selectColumnAPanel)
  const isMobileColumnB = useNavigationStore(selectIsMobileColumnB)
  const handleBackClick = useNavigationStore((s) => s.handleBackClick)

  const isVisible = !isMobileColumnB

  // Mobile: 2 panels (main, subcategory). Desktop: 3 panels (+ symptom info)
  const panelCount = isMobile ? 2 : 3

  // syncKey changes when the underlying navigation changes (different category/symptom),
  // forcing the carousel to re-verify its spring position even if panelIndex stays the same.
  const carouselSyncKey = `${selectedCategory?.id}-${selectedSymptom?.id}`

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
            className="px-2 md:px-0 min-h-full"
            style={isMobile ? { paddingTop: 'calc(var(--sat, 0px) + 4rem)' } : undefined}
          >
            <CategoryList
              mobilePanel="main"
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
            className="px-2 md:px-0 min-h-full"
            style={isMobile ? { paddingTop: 'calc(var(--sat, 0px) + 4rem)' } : undefined}
          >
            <CategoryList
              mobilePanel="subcategory"
              onNavigate={onNavigate}
            />
          </div>
        </div>

        {/* Panel 2: Symptom info (desktop only) */}
        {!isMobile && (
          <div className="h-full overflow-y-auto bg-themewhite" style={{ flex: `0 0 ${panelWidth}` }}>
            <div className="px-2 md:px-0 min-h-full">
              <CategoryList
                mobilePanel="guidelines"
                onNavigate={onNavigate}
              />
            </div>
          </div>
        )}
      </animated.div>
    </div>
  )
})
