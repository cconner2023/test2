import { ChevronRight, Building2 } from 'lucide-react'

interface LocationBreadcrumbProps {
  clinicName: string
  selectedZoneName?: string | null
  onTapRoot: () => void
}

export function LocationBreadcrumb({ clinicName, selectedZoneName, onTapRoot }: LocationBreadcrumbProps) {
  return (
    <div className="flex items-center md:border-b md:border-primary/10 md:px-6 md:py-3">
      <div className="flex items-center gap-1 px-4 py-2 md:px-0 md:py-0 overflow-x-auto scrollbar-hide flex-1 min-w-0">
        <button
          className="flex items-center gap-1 text-xs md:text-[10pt] text-themeblue3 hover:text-themeblue3/80 shrink-0"
          onClick={onTapRoot}
        >
          <Building2 size={12} />
          <span>{clinicName}</span>
        </button>

        {selectedZoneName && (
          <div className="flex items-center gap-1 shrink-0">
            <ChevronRight size={12} className="text-tertiary" />
            <span className="text-xs md:text-[10pt] text-primary font-medium">
              {selectedZoneName}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
