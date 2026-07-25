import { SliderRail } from '@/Components/primitives/SliderRail'

/** One selectable floor stop on the slider (top = highest floor, bottom = ground). */
export interface FloorStop {
  id: string
  label: string
}

/**
 * Vertical "elevator" floor picker — the shared {@link SliderRail} with floor
 * semantics. Up = higher floor; `entries` arrive pre-sorted highest-first.
 *
 * The track, thumb, drag/snap engine and a11y all live in the primitive; this
 * wrapper only supplies the noun. It used to carry its own copy of that engine,
 * which the TC3 casualty ladder then duplicated.
 */
export function FloorSlider({
  entries,
  activeId,
  onSelect,
}: {
  entries: FloorStop[]
  activeId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <SliderRail
      stops={entries}
      activeId={activeId}
      onSelect={onSelect}
      orientation="vertical"
      label="Floor"
      stopNoun="Floor"
    />
  )
}
