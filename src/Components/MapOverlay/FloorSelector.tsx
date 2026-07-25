import { Layers, Trash2 } from 'lucide-react';
import { PAD, SliderRail, THUMB, type SliderStop } from '@/Components/primitives/SliderRail';

/** Human label for a floor level. 0 = ground, negatives = basements. */
export function floorLabel(level: number): string {
  if (level === 0) return 'G';
  if (level < 0) return `B${-level}`;
  return String(level);
}

/** Cap the visible track height; deeper overlays scroll the window. */
const MAX_VISIBLE = 5;

/** Sentinel stop id for "no depth filter". */
const ALL = 'all';

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

/**
 * Vertical floor rail on the map's right edge — the shared {@link SliderRail} with
 * depth semantics. Shown only once an overlay actually has depth (≥2 floors); flat
 * overlays stay clean. Higher floors sit higher on the rail, mirroring a building
 * elevation; the top stop is "All", which drops the depth filter. New floors are NOT
 * minted here — they're added as real depth on the overlay (tree "Add floor", or
 * moving a feature to a new floor).
 *
 * This used to be a stack of rounded-lg chips — the same pill-rail shape the
 * property floor picker had already replaced with a slider. It is now literally the
 * same control as that picker and the TC3 casualty ladder.
 *
 * The delete affordance stays OUTSIDE the rail: it is destructive, so it must not be
 * reachable by a drag that happens to release on it. It borrows the thumb's geometry
 * and the track's glass so it still reads as part of the same control.
 */
export function FloorSelector({ floors, activeFloor, onSelect, onDeleteFloor }: FloorSelectorProps) {
  const descending = [...floors].sort((a, b) => b - a);
  const canDelete = onDeleteFloor && activeFloor != null && activeFloor !== 0;

  const stops: SliderStop[] = [
    { id: ALL, title: 'All floors', icon: <Layers size={16} /> },
    ...descending.map((level) => ({
      id: String(level),
      label: floorLabel(level),
      title: `Floor ${floorLabel(level)}`,
      dividerBefore: level === descending[0],
    })),
  ];

  return (
    <div className="absolute right-3 top-1/2 -translate-y-1/2 z-[1000] flex flex-col gap-1.5 items-center pointer-events-auto">
      <SliderRail
        stops={stops}
        activeId={activeFloor === null ? ALL : String(activeFloor)}
        onSelect={(id) => onSelect(id === ALL ? null : Number(id))}
        orientation="vertical"
        maxVisible={MAX_VISIBLE}
        label="Floor"
      />
      {canDelete && (
        <div
          style={{ padding: PAD }}
          className="rounded-full border border-white/40 bg-themewhite2/60 shadow-lg backdrop-blur-md dark:border-white/10 dark:bg-themewhite3/50"
        >
          <button
            type="button"
            onClick={() => onDeleteFloor(activeFloor)}
            style={{ width: THUMB, height: THUMB }}
            className="rounded-full flex items-center justify-center text-themered active:scale-95 transition-all"
            aria-label={`Delete floor ${floorLabel(activeFloor)}`}
            title={`Delete floor ${floorLabel(activeFloor)}`}
          >
            <Trash2 size={15} />
          </button>
        </div>
      )}
    </div>
  );
}

export default FloorSelector;
