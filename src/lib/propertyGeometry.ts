/**
 * Root-canvas tile geometry for the two AUTO-PLACED reserved zone families —
 * personnel zones (property_locations.holder_user_id set) and the turn-in staging
 * zone (is_turn_in_zone). Single source of truth shared by the placers in
 * propertyService (which WRITE band tiles) and the map component (which keeps
 * user-drawn zones OUT of the band).
 *
 * These families used to be gridded from the top-left by a hard-coded 4-col grid
 * that was blind to user-drawn zones, so they overlapped them. Instead they live
 * in a hidden BAND reserved at the bottom of the root canvas: tiles here sit below
 * the overview fold and are only framed when their own zone is selected, so a tile
 * whose bottom grows past y=1.0 is fine.
 *
 * No imports on purpose — a leaf module so React components can import the band
 * helpers with zero circular-dependency risk (propertyService pulls in the store,
 * sync, vault, etc.).
 */

/** Top edge (0..1 canvas-relative) of the reserved bottom band. */
export const RESERVED_BAND_Y_START = 0.78

export interface CanvasRect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Tile for the `bandIndex`-th reserved-family zone. Reuses the top grid's column
 * math (4 cols, x = 0.05 + col*0.23, 0.2 wide × 0.14 tall) but anchors rows to the
 * band and grows DOWNWARD (row pitch 0.18). Growing past y=1.0 is intentional —
 * band tiles are hidden at overview and only framed on select.
 */
export function computeReservedBandTile(bandIndex: number): CanvasRect {
  const col = bandIndex % 4
  const row = Math.floor(bandIndex / 4)
  return {
    x: 0.05 + col * 0.23,
    y: RESERVED_BAND_Y_START + row * 0.18,
    width: 0.2,
    height: 0.14,
  }
}

/** True when a rect's bottom edge enters the reserved band. */
export function rectIntersectsReservedBand(rect: { y: number; height: number }): boolean {
  return rect.y + rect.height > RESERVED_BAND_Y_START
}

/**
 * Clamp a rect so its bottom sits just above the reserved band, preserving
 * width/height (shifts y UP only). Returns the rect unchanged when it already
 * clears the band. The shifted y is floored at 0 so a tall zone (height near 1)
 * is not shoved off the top of the canvas.
 */
export function bumpRectAboveReservedBand<T extends CanvasRect>(rect: T): T {
  if (!rectIntersectsReservedBand(rect)) return rect
  return { ...rect, y: Math.max(0, RESERVED_BAND_Y_START - rect.height) }
}
