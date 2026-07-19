import { memo, useState } from 'react'
import { Plus, Check, RotateCcw, FileText, ChevronRight } from 'lucide-react'
import { useTC3Store } from '../../stores/useTC3Store'
import { TC3EditorSurface } from './TC3EditorSurface'
import { ExpandableInput } from '@/Components/primitives/ExpandableInput'
import { EmptyState } from '@/Components/primitives/EmptyState'
import { useMergedNoteContent } from '../../Hooks/useMergedNoteContent'

/**
 * Notes — the DD1380 free-text field, folded into the same section shape as the
 * other card blocks: header · borderless preview card / empty-state add-row · a
 * TC3EditorSurface overlay for editing (rather than the old always-on inline
 * textarea). The overlay hosts the ExpandableInput so text-expander / template
 * behaviour is unchanged; notes autosave live, matching Vitals / MARCH.
 */
export const NotesPanel = memo(function NotesPanel() {
  const notes = useTC3Store((s) => s.card.notes)
  const setNotes = useTC3Store((s) => s.setNotes)
  const { expanders } = useMergedNoteContent()

  const [editing, setEditing] = useState(false)

  const populated = notes.trim().length > 0

  return (
    <div>
      {/* Section header */}
      <div className="mb-2">
        <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider">
          Notes
        </p>
      </div>

      {/* Section card — tap to open the editor; empty-state add-row otherwise */}
      {populated ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="w-full rounded-2xl bg-themewhite2 overflow-hidden text-left active:scale-95 transition-all hover:bg-themeblue2/5"
        >
          <div className="flex items-center gap-3 px-4 py-3.5 pr-4">
            <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-tertiary/10">
              <FileText size={18} className="text-tertiary" />
            </div>
            <p className="flex-1 min-w-0 text-sm text-primary whitespace-pre-wrap line-clamp-3">
              {notes}
            </p>
            <ChevronRight size={16} className="text-tertiary shrink-0" />
          </div>
        </button>
      ) : (
        <EmptyState
          title="No notes"
          action={{
            icon: Plus,
            label: 'Add notes',
            onClick: () => setEditing(true),
          }}
        />
      )}

      {/* Edit overlay */}
      <TC3EditorSurface
        isOpen={editing}
        onClose={() => setEditing(false)}
        title="Notes"
        preview={
          <div className="px-2 py-2">
            <ExpandableInput
              value={notes}
              onChange={setNotes}
              expanders={expanders}
              multiline
              hideClear
              placeholder="e.g. handoff at 1430, mechanism details…"
              className="w-full min-h-[10rem] bg-transparent px-2 py-2 text-base md:text-sm text-primary placeholder:text-tertiary focus:outline-none resize-none leading-6"
            />
          </div>
        }
        actions={
          populated
            ? [{ key: 'clear', label: 'Clear', icon: RotateCcw, onAction: () => setNotes(''), variant: 'danger' }]
            : []
        }
        saveAction={{ icon: Check, label: 'Done', onAction: () => setEditing(false) }}
      />
    </div>
  )
})
