import { X, Map, Save } from 'lucide-react'
import type { CalendarEvent } from '../../Types/CalendarTypes'
import type { ResourceAllocation } from '../../Types/MissionTypes'
import { useMissionBoard } from '../../Hooks/useMissionBoard'
import { AllocationPanel } from './AllocationPanel'
import { usePropertyStore } from '../../stores/usePropertyStore'
import { useIsMobile } from '../../Hooks/useIsMobile'

interface MissionBoardProps {
  event: CalendarEvent
  medics: { id: string; name: string }[]
  onClose: () => void
  onSave: (allocations: ResourceAllocation[]) => void
}

export function MissionBoard({ event, medics, onClose, onSave }: MissionBoardProps) {
  const isMobile = useIsMobile()

  const {
    overlay,
    loading,
    error,
    allocations,
    waypointSummaries,
    unpositioned,
    allocate,
    deallocate,
    updateAllocation,
  } = useMissionBoard(event)

  const rawItems = usePropertyStore(s => s.items)
  const propertyItems = rawItems
    .filter(item => !item.parent_item_id)
    .map(item => ({ id: item.id, name: item.name, nsn: item.nsn }))

  const textSize = isMobile ? 'text-sm' : 'text-xs'

  return (
    <div className="flex flex-col h-full min-h-0 bg-themewhite2 rounded-2xl overflow-hidden border border-themeblue3/10">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-primary/10 shrink-0">
        <div className="flex flex-col min-w-0">
          <span className={`font-semibold text-primary leading-tight ${textSize}`}>
            Mission Board
          </span>
          <span className="text-[9pt] font-semibold tracking-widest uppercase text-tertiary truncate">
            {overlay?.name ?? 'No overlay linked'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          <button
            onClick={() => onSave(allocations)}
            className={`flex items-center gap-1 rounded-full bg-themegreen/10 text-themegreen px-2.5 py-1 font-semibold transition-all duration-150 active:scale-95 hover:bg-themegreen/20 ${textSize}`}
          >
            <Save className="w-3.5 h-3.5" />
            Save
          </button>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full text-tertiary hover:text-primary hover:bg-primary/5 transition-colors duration-150 active:scale-95"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center h-32">
            <div className="w-5 h-5 rounded-full border-2 border-themeblue3/30 border-t-themeblue3 animate-spin" />
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center justify-center gap-2 h-32 px-4 text-center">
            <span className={`text-themeredred font-medium ${textSize}`}>
              Failed to load overlay
            </span>
            <span className={`text-tertiary ${textSize}`}>{error}</span>
          </div>
        )}

        {!loading && !error && overlay === null && (
          <div className="flex flex-col items-center justify-center gap-3 h-40 px-6 text-center">
            <div className="w-10 h-10 rounded-full bg-themeblue3/10 flex items-center justify-center">
              <Map className="w-5 h-5 text-themeblue3/50" />
            </div>
            <p className={`text-tertiary leading-snug ${textSize}`}>
              No map overlay linked. Edit the event to link an overlay.
            </p>
          </div>
        )}

        {!loading && !error && overlay !== null && (
          <AllocationPanel
            overlay={overlay}
            waypointSummaries={waypointSummaries}
            unpositioned={unpositioned}
            propertyItems={propertyItems}
            medics={medics}
            onAllocate={allocate}
            onDeallocate={deallocate}
            onUpdateAllocation={updateAllocation}
          />
        )}
      </div>
    </div>
  )
}
