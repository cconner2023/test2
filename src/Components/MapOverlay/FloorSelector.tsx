import { Layers, Plus } from 'lucide-react';

/** Human label for a floor level. 0 = ground, negatives = basements. */
export function floorLabel(level: number): string {
  if (level === 0) return 'G';
  if (level < 0) return `B${-level}`;
  return String(level);
}

interface FloorSelectorProps {
  /** Distinct floor levels present, ascending. */
  floors: number[];
  /** Active floor; `null` = show all floors (no depth filter). */
  activeFloor: number | null;
  onSelect: (floor: number | null) => void;
  /** When provided, renders a "+" chip that appends a new floor. */
  onAddFloor?: () => void;
}

const CHIP =
  'w-9 h-8 rounded-lg flex items-center justify-center text-[10pt] font-semibold shadow-sm active:scale-95 transition-all backdrop-blur-sm';
const INACTIVE = 'bg-themewhite2/90 dark:bg-themewhite3/90 text-primary';
const ACTIVE = 'bg-themeblue3 text-white';

/**
 * Genshin-style vertical floor rail on the map's right edge. Tap a floor to
 * target that depth (others hide); tap the layers chip for "All". The "+"
 * chip appends a new floor — new features drawn while it's active get stamped
 * with that level. Higher floors render above lower ones, mirroring a building
 * elevation.
 */
export function FloorSelector({ floors, activeFloor, onSelect, onAddFloor }: FloorSelectorProps) {
  const descending = [...floors].sort((a, b) => b - a);
  return (
    <div
      data-tour="map-floor-selector"
      className="absolute right-3 top-1/2 -translate-y-1/2 z-[1000] flex flex-col gap-1.5 items-center pointer-events-auto"
    >
      {floors.length > 1 && (
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={`${CHIP} ${activeFloor === null ? ACTIVE : INACTIVE}`}
          aria-label="Show all floors"
          title="All floors"
        >
          <Layers size={16} />
        </button>
      )}
      {descending.map((level) => (
        <button
          key={level}
          type="button"
          onClick={() => onSelect(level)}
          className={`${CHIP} ${activeFloor === level ? ACTIVE : INACTIVE}`}
          aria-label={`Floor ${floorLabel(level)}`}
          title={`Floor ${floorLabel(level)}`}
        >
          {floorLabel(level)}
        </button>
      ))}
      {onAddFloor && (
        <button
          type="button"
          onClick={onAddFloor}
          className={`${CHIP} ${INACTIVE} text-tertiary`}
          aria-label="Add floor"
          title="Add floor"
        >
          <Plus size={16} />
        </button>
      )}
    </div>
  );
}

export default FloorSelector;
