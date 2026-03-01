import { ChevronRight, Home } from 'lucide-react'
import type { PropertyLocation } from '../../Types/PropertyTypes'

interface LocationBreadcrumbProps {
  path: PropertyLocation[]
  onTapSegment: (index: number) => void
  onTapRoot: () => void
}

export function LocationBreadcrumb({ path, onTapSegment, onTapRoot }: LocationBreadcrumbProps) {
  return (
    <div className="flex items-center gap-1 px-4 py-2 overflow-x-auto scrollbar-hide">
      <button
        className="flex items-center gap-1 text-xs text-themeblue3 hover:text-themeblue3/80 shrink-0"
        onClick={onTapRoot}
      >
        <Home size={12} />
        <span>Root</span>
      </button>

      {path.map((loc, i) => (
        <div key={loc.id} className="flex items-center gap-1 shrink-0">
          <ChevronRight size={12} className="text-tertiary" />
          <button
            className={`text-xs ${i === path.length - 1 ? 'text-primary font-medium' : 'text-themeblue3 hover:text-themeblue3/80'}`}
            onClick={() => onTapSegment(i)}
          >
            {loc.name}
          </button>
        </div>
      ))}
    </div>
  )
}
