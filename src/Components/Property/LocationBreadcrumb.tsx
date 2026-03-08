import type { ReactNode } from 'react'
import { ChevronRight, Home } from 'lucide-react'
import type { PropertyLocation } from '../../Types/PropertyTypes'

interface LocationBreadcrumbProps {
  path: PropertyLocation[]
  onTapSegment: (index: number) => void
  onTapRoot: () => void
  rightContent?: ReactNode
}

export function LocationBreadcrumb({ path, onTapSegment, onTapRoot, rightContent }: LocationBreadcrumbProps) {
  return (
    <div className="flex items-center md:border-b md:border-primary/10 md:px-6 md:py-3">
      <div className="flex items-center gap-1 px-4 py-2 md:px-0 md:py-0 overflow-x-auto scrollbar-hide flex-1 min-w-0">
        <button
          className="flex items-center gap-1 text-xs md:text-[10pt] text-themeblue3 hover:text-themeblue3/80 shrink-0"
          onClick={onTapRoot}
        >
          <Home size={12} />
          <span>Root</span>
        </button>

        {path.map((loc, i) => (
          <div key={loc.id} className="flex items-center gap-1 shrink-0">
            <ChevronRight size={12} className="text-tertiary" />
            <button
              className={`text-xs md:text-[10pt] ${i === path.length - 1 ? 'text-primary font-medium' : 'text-themeblue3 hover:text-themeblue3/80'}`}
              onClick={() => onTapSegment(i)}
            >
              {loc.name}
            </button>
          </div>
        ))}
      </div>
      {rightContent && (
        <div className="shrink-0 ml-2">
          {rightContent}
        </div>
      )}
    </div>
  )
}
