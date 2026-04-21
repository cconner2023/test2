import { memo } from 'react'
import { useTC3Store } from '../../stores/useTC3Store'
import { ExpandableInput } from '../ExpandableInput'
import { useMergedNoteContent } from '../../Hooks/useMergedNoteContent'

export const NotesPanel = memo(function NotesPanel() {
  const notes = useTC3Store((s) => s.card.notes)
  const setNotes = useTC3Store((s) => s.setNotes)
  const { expanders } = useMergedNoteContent()

  return (
    <div className="space-y-2" data-tour="tc3-notes">
      <div>
        <h3 className="text-sm font-semibold text-primary mb-1">Notes</h3>
        <p className="text-[9pt] text-tertiary">Additional documentation and handoff notes</p>
      </div>
      <ExpandableInput
        value={notes}
        onChange={setNotes}
        expanders={expanders}
        multiline
        placeholder="Any additional documentation, handoff notes, mechanism details..."
        className="w-full rounded-2xl border border-themeblue3/10 bg-themewhite2 px-4 py-3 text-sm text-primary placeholder:text-tertiary focus:border-themeblue1/30 focus:outline-none resize-none transition-colors leading-6"
      />
    </div>
  )
})
