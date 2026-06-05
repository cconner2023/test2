import { memo } from 'react'
import { useTC3Store } from '../../stores/useTC3Store'
import { ExpandableInput } from '../ExpandableInput'
import { useMergedNoteContent } from '../../Hooks/useMergedNoteContent'
import { Section, SectionCard } from '../Section'

export const NotesPanel = memo(function NotesPanel() {
  const notes = useTC3Store((s) => s.card.notes)
  const setNotes = useTC3Store((s) => s.setNotes)
  const { expanders } = useMergedNoteContent()

  return (
    <div data-tour="tc3-notes">
      <Section title="Notes">
        <SectionCard>
          <ExpandableInput
            value={notes}
            onChange={setNotes}
            expanders={expanders}
            multiline
            hideClear
            placeholder="e.g. handoff at 1430, mechanism details…"
            className="w-full bg-transparent px-4 py-3 text-base md:text-sm text-primary placeholder:text-tertiary focus:outline-none resize-none leading-6"
          />
        </SectionCard>
      </Section>
    </div>
  )
})
