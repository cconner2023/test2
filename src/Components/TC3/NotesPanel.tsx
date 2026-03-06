import { memo } from 'react'
import { useTC3Store } from '../../stores/useTC3Store'

export const NotesPanel = memo(function NotesPanel() {
  const notes = useTC3Store((s) => s.card.notes)
  const setNotes = useTC3Store((s) => s.setNotes)

  return (
    <div className="space-y-2">
      <div>
        <h3 className="text-sm font-semibold text-primary mb-1">Notes</h3>
        <p className="text-[11px] text-tertiary/70">Additional documentation and handoff notes</p>
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Any additional documentation, handoff notes, mechanism details..."
        rows={4}
        className="w-full text-base px-3 py-2 rounded-lg border border-tertiary/20 bg-themewhite outline-none focus:border-themeredred/40 text-tertiary resize-none leading-5"
      />
    </div>
  )
})
