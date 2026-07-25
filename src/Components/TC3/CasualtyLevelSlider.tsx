import { SliderRail } from '@/Components/primitives/SliderRail'
import type { CasualtyStop } from './casualtyOrder'

/** Cap the visible track height at this many notches; overflow scrolls. */
const MAX_VISIBLE = 5

/**
 * Vertical "triage ladder" casualty picker — the shared {@link SliderRail} with
 * triage semantics: most-urgent on top, each notch labelled arrival+band+ordinal
 * (1U1, 3R2…) and the thumb taking the active casualty's band colour.
 *
 * The window cap is the reason the rail primitive carries windowing at all: a
 * MASCAL roster runs long, so the track holds five notches and scrolls the rest.
 */
export function CasualtyLevelSlider({
  entries,
  activeId,
  onSelect,
}: {
  entries: CasualtyStop[]
  activeId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <SliderRail
      stops={entries}
      activeId={activeId}
      onSelect={onSelect}
      orientation="vertical"
      maxVisible={MAX_VISIBLE}
      label="Casualty"
      stopNoun="Casualty"
    />
  )
}
