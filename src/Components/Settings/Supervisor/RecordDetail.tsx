import { useState } from 'react'
import { ConfirmDialog } from '@/Components/primitives/ConfirmDialog'
import { SectionCard, SectionHeader } from '@/Components/primitives/Section'
import { DatePickerInput, TextArea } from '@/Components/primitives/FormInputs'
import { AddFab } from '@/Components/primitives/AddFab'
import { Check, Trash2 } from 'lucide-react'
import { getEvaluableTaskData } from '../../../Utilities/algorithmCompetency'
import { formatMedicName, recordItemLabel, type TaskRecord } from './supervisorHelpers'

/**
 * One record's terminal — what is on file, who put it there, and the two ways to
 * change it.
 *
 * EDITING IS RE-RECORDING, and that is not a workaround for a missing UPDATE.
 * The fold keeps one row per (soldier, item, type) and takes the latest, so a
 * fresh grade or a fresh assignment REPLACES this row while both events stay on
 * the append-only spine. The supervisor gets in-place semantics; the log keeps
 * the correction as a correction. Nothing here rewrites an event, which is also
 * the only thing audit_log's update policy would allow (it is scoped to PMCS and
 * fault rows — a training row cannot be rewritten server-side at all).
 *
 * SO RE-EVALUATE IS A HAND-OFF, NOT A FORM. Correcting a grade means walking the
 * measures again, and the evaluator is the surface that does that — this offers
 * the verb and hands the pane over rather than growing a second grading UI whose
 * output would have to agree with the first one forever.
 *
 * DELETE IS NOT DEMOTED FOR BEING DESTRUCTIVE. It sits with the other actions
 * because a wrongly-attributed grade is the ordinary reason a supervisor opens
 * this; the ConfirmDialog is the guard, and nothing is announced after it — the
 * record leaving the list is the confirmation.
 *
 * Plain flow, no scroller: the host pane owns the scroll on desktop and the
 * sheet owns it on mobile, and a nested one gets clipped by the sheet's card.
 */

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 px-4 py-2.5 border-t border-tertiary/8 first:border-t-0">
      <span className="text-[9pt] text-tertiary shrink-0 w-24">{label}</span>
      <span className="text-[10pt] text-primary min-w-0 flex-1 break-words">{value}</span>
    </div>
  )
}

interface RecordDetailProps {
  record: TaskRecord
  resolveName: (id: string | null) => string
  /** Open the evaluator on this record's (soldier, task). Absent for records
   *  there is nothing to re-walk — a read, or an item with no graded measures. */
  onReEvaluate?: () => void
  /** Save an edited assignment. Only passed for pending assignments. */
  onSaveAssignment?: (dueDate: string, notes: string) => void
  onDelete: () => void
}

export function RecordDetail({
  record,
  resolveName,
  onReEvaluate,
  onSaveAssignment,
  onDelete,
}: RecordDetailProps) {
  const { completion: c, soldier } = record
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [dueDate, setDueDate] = useState(c.dueDate ?? '')
  const [notes, setNotes] = useState(c.supervisorNotes ?? '')

  const isAssignment = c.completionType === 'assignment'
  const editable = isAssignment && !!onSaveAssignment
  // No disabled Save. An untouched form has nothing to save, and a dimmed button
  // that becomes live on a keystroke is the same information said twice.
  const dirty = editable && !!dueDate && (dueDate !== (c.dueDate ?? '') || notes !== (c.supervisorNotes ?? ''))

  const taskData = getEvaluableTaskData(c.trainingItemId)
  const gradedSet = taskData?.gradedSteps ? new Set(taskData.gradedSteps) : null
  const measures = c.completionType === 'test' && c.stepResults
    ? (gradedSet ? c.stepResults.filter(sr => gradedSet.has(sr.stepNumber)) : c.stepResults)
    : []

  const typeLabel = isAssignment ? 'Assignment' : c.completionType === 'test' ? 'Evaluation' : 'Read'

  return (
    <div className="px-4 pt-4">
      <div>
        <SectionHeader>{typeLabel}</SectionHeader>
        <SectionCard>
          <Fact label="Soldier" value={formatMedicName(soldier)} />
          <Fact label="Item" value={recordItemLabel(c.trainingItemId)} />
          <Fact label="Item ID" value={c.trainingItemId} />
          {c.completionType === 'test' && (
            <Fact label="Result" value={c.result === 'NO_GO' ? 'NO GO' : 'GO'} />
          )}
          {/* A read is self-reported, so naming a supervisor on one would credit
              the grade to whoever happened to be the actor on the event. */}
          {c.completionType !== 'read' && (
            <Fact label="Recorded by" value={resolveName(c.supervisorId)} />
          )}
          <Fact
            label={isAssignment ? 'Assigned' : 'Recorded'}
            value={fmtDateTime(c.updatedAt)}
          />
          {isAssignment && c.completedAt && (
            <Fact label="Completed" value={fmtDateTime(c.completedAt)} />
          )}
        </SectionCard>
      </div>

      {measures.length > 0 && (
        <div className="mt-4">
          <SectionHeader>Measures</SectionHeader>
          <SectionCard className="px-4 py-2">
            {measures.map(sr => (
              <div key={sr.stepNumber} className="flex items-center gap-2 py-1">
                <span className="text-[9pt] text-tertiary font-mono w-6 text-right shrink-0">
                  {sr.stepNumber}
                </span>
                {sr.result === 'GO' ? (
                  <span className="px-2 py-0.5 rounded text-[9pt] font-bold bg-themegreen/15 text-themegreen">GO</span>
                ) : sr.result === 'NO_GO' ? (
                  <span className="px-2 py-0.5 rounded text-[9pt] font-bold bg-themeredred/15 text-themeredred">NO GO</span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[9pt] bg-tertiary/10 text-tertiary">--</span>
                )}
              </div>
            ))}
          </SectionCard>
        </div>
      )}

      {/* An assignment is the one record that is still ahead of the soldier, so
          it is the one worth changing rather than replacing: the due date moves
          and the notes get read. A graded walk is corrected by walking it again. */}
      {editable ? (
        <div className="mt-4">
          <SectionHeader>Edit</SectionHeader>
          <SectionCard>
            <DatePickerInput value={dueDate} onChange={setDueDate} placeholder="Due date" />
            <TextArea label="Notes" value={notes} onChange={setNotes} rows={3} />
          </SectionCard>
        </div>
      ) : c.supervisorNotes ? (
        <div className="mt-4">
          <SectionHeader>Notes</SectionHeader>
          <SectionCard className="px-4 py-3">
            <p className="text-[10pt] text-primary whitespace-pre-wrap">{c.supervisorNotes}</p>
          </SectionCard>
        </div>
      ) : null}

      <div className="mt-5 flex flex-col gap-2 pb-4">
        {onReEvaluate && (
          <button
            type="button"
            onClick={onReEvaluate}
            className="w-full py-2.5 rounded-lg bg-themeblue3/10 text-themeblue2 text-[10pt] font-medium
                       transition-all hover:bg-themeblue3/15 active:scale-95"
          >
            Re-evaluate
          </button>
        )}
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="w-full py-2.5 rounded-lg bg-themeredred/10 text-themeredred text-[10pt] font-medium
                     flex items-center justify-center gap-2 transition-all hover:bg-themeredred/15 active:scale-95"
        >
          <Trash2 size={14} />
          Delete record
        </button>
      </div>

      {/* Sticky rather than in the button stack: the edit fields are above it and
          the notes box can push them past the fold, and a Save you have to scroll
          to find on a form you are still typing in is a Save you miss. */}
      {dirty && (
        <div className="sticky bottom-4 z-10 flex justify-end pb-2 pointer-events-none">
          <AddFab
            icon={Check}
            label="Save assignment"
            onClick={() => onSaveAssignment?.(dueDate, notes)}
          />
        </div>
      )}

      <ConfirmDialog
        visible={confirmOpen}
        title="Delete this record?"
        subtitle={
          c.completionType === 'test'
            ? "The grade is voided and its events are purged. The soldier's coverage falls back to whatever else is on file."
            : 'The record is voided and its events are purged.'
        }
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => { setConfirmOpen(false); onDelete() }}
        onCancel={() => setConfirmOpen(false)}
        zIndex={1300}
      />
    </div>
  )
}
