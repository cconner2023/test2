/**
 * FloorSwitcher — Genshin-style vertical level selector floated over the property
 * canvas. Shows a building-local stack of floors (highest ordinal on top); tapping
 * one makes it the active level so only that floor's subtree renders. Building-local:
 * it reflects the nearest level-container of the current selection. Adding a floor
 * lives in the top-right edit cluster (and the zone/tree menus), not here — this rail
 * is a pure selector and only renders once a building actually has floors.
 */
import type { LocalPropertyLocation } from '../../Types/PropertyTypes'
import { levelShortLabel } from './levelUtils'

interface FloorSwitcherProps {
  /** Levels of the active container, sorted ascending by ordinal (non-empty). */
  levels: LocalPropertyLocation[]
  activeLevelId: string | null
  onSelect: (levelId: string) => void
}

export function FloorSwitcher({ levels, activeLevelId, onSelect }: FloorSwitcherProps) {
  // Render top floor first (descending) so the stack reads like a building elevation.
  const stacked = [...levels].reverse()

  return (
    <div
      data-zoom-controls
      className="absolute right-3 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-1 rounded-full border border-tertiary/15 bg-themewhite/90 backdrop-blur-sm shadow-md p-1"
    >
      {stacked.map((lvl) => {
        const active = lvl.id === activeLevelId
        return (
          <button
            key={lvl.id}
            onClick={() => onSelect(lvl.id)}
            title={lvl.name}
            aria-label={lvl.name}
            aria-pressed={active}
            className={[
              'w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-[10pt] font-semibold active:scale-95 transition-all',
              active
                ? 'bg-themeblue3 text-white shadow-sm'
                : 'text-tertiary hover:text-primary hover:bg-themeblue3/10',
            ].join(' ')}
          >
            {levelShortLabel(lvl)}
          </button>
        )
      })}
    </div>
  )
}
