import { Layers, Trash2 } from 'lucide-react';

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
  /** When provided, the active non-base floor gets a trash chip that deletes
   *  that floor (and everything on it). Base (0) is never deletable. */
  onDeleteFloor?: (level: number) => void;
}

const CHIP =
  'w-9 h-8 rounded-lg flex items-center justify-center text-[10pt] font-semibold shadow-sm active:scale-95 transition-all backdrop-blur-sm';
const INACTIVE = 'bg-themewhite2/90 dark:bg-themewhite3/90 text-primary';
const ACTIVE = 'bg-themeblue3 text-white';

/**
 * Genshin-style vertical floor rail on the map's right edge. Shown only once an
 * overlay actually has depth (≥2 floors) — flat overlays stay clean. Tap a
 * floor to target that depth (others hide); tap the layers chip for "All".
 * Higher floors render above lower ones, mirroring a building elevation. New
 * floors are NOT minted here — they're added as real depth on the overlay (tree
 * "Add floor" / moving a feature to a new floor). When a specific non-base
 * floor is active, a trash chip deletes that floor and its features.
 */
export function FloorSelector({ floors, activeFloor, onSelect, onDeleteFloor }: FloorSelectorProps) {
  const descending = [...floors].sort((a, b) => b - a);
  const canDelete = onDeleteFloor && activeFloor != null && activeFloor !== 0;
  return (
    <div
      data-tour="map-floor-selector"
      className="absolute right-3 top-1/2 -translate-y-1/2 z-[1000] flex flex-col gap-1.5 items-center pointer-events-auto"
    >
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={`${CHIP} ${activeFloor === null ? ACTIVE : INACTIVE}`}
        aria-label="Show all floors"
        title="All floors"
      >
        <Layers size={16} />
      </button>
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
      {canDelete && (
        <button
          type="button"
          onClick={() => onDeleteFloor(activeFloor)}
          className={`${CHIP} bg-themewhite2/90 dark:bg-themewhite3/90 text-themered`}
          aria-label={`Delete floor ${floorLabel(activeFloor)}`}
          title={`Delete floor ${floorLabel(activeFloor)}`}
        >
          <Trash2 size={15} />
        </button>
      )}
    </div>
  );
}

export default FloorSelector;
