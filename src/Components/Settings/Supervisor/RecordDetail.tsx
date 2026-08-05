import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ConfirmDialog } from '@/Components/primitives/ConfirmDialog'
import { SectionCard, SectionHeader } from '@/Components/primitives/Section'
import { DatePickerInput, TextArea } from '@/Components/primitives/FormInputs'
import { AddFab } from '@/Components/primitives/AddFab'
import { OverlayHeaderMenu } from '@/Components/primitives/OverlayHeaderMenu'
import type { ContextMenuItem } from '@/Components/primitives/ContextMenu'
import { Check, ClipboardCheck, Pencil, Trash2, X } from 'lucide-react'
import { getEvaluableTaskData } from '../../../Utilities/algorithmCompetency'
import { formatMedicName, type TaskRecord } from './supervisorHelpers'

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
 * THE VERBS LIVE IN THE PANE'S CHROME, NOT IN THE BODY. Edit, re-evaluate and
 * delete are what an object-level ellipsis is for; they were a stack of
 * full-width buttons under the facts, which is a fourth action idiom this app
 * does not have and which put a destructive one at the end of a scroll. They are
 * published upward and rendered beside Close — the same header contract every
 * other detail surface in the app already uses.
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
   *  there is nothing to re-walk — a read, or an item with no graded measures.
   *
   *  Every one of these three takes the record back rather than closing over it
   *  at the call site: the header menu is a MEMOIZED node published up to the
   *  drawer, so a prop rebuilt as a fresh closure each render would publish a new
   *  node each render, set state on the drawer, and loop. Handed the record, the
   *  drawer can pass its useCallback'd handlers straight through. */
  onReEvaluate?: (record: TaskRecord) => void
  /** Save an edited assignment. Only passed for pending assignments. */
  onSaveAssignment?: (record: TaskRecord, dueDate: string, notes: string) => void
  onDelete: (record: TaskRecord) => void
  /** Publish this record's header actions (the ellipsis) so the drawer renders
   *  them in the pane / sheet header. Cleared on unmount. */
  onHeaderActions?: (node: ReactNode | null) => void
}

export function RecordDetail({
  record,
  resolveName,
  onReEvaluate,
  onSaveAssignment,
  onDelete,
  onHeaderActions,
}: RecordDetailProps) {
  const { completion: c, soldier } = record
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [dueDate, setDueDate] = useState(c.dueDate ?? '')
  const [notes, setNotes] = useState(c.supervisorNotes ?? '')

  const isAssignment = c.completionType === 'assignment'
  const editable = isAssignment && !!onSaveAssignment
  // No disabled Save. An untouched form has nothing to save, and a dimmed button
  // that becomes live on a keystroke is the same information said twice.
  const dirty = editing && !!dueDate && (dueDate !== (c.dueDate ?? '') || notes !== (c.supervisorNotes ?? ''))

  const taskData = getEvaluableTaskData(c.trainingItemId)
  const gradedSet = taskData?.gradedSteps ? new Set(taskData.gradedSteps) : null
  const measures = c.completionType === 'test' && c.stepResults
    ? (gradedSet ? c.stepResults.filter(sr => gradedSet.has(sr.stepNumber)) : c.stepResults)
    : []

  /** A measure is the sentence the soldier was graded against, so the row says
   *  it. The number alone was a row that could only be read with the packet open
   *  beside it — "3: GO" names nothing a supervisor is deciding about. */
  const measureText = useMemo(() => {
    const map = new Map<string, string>()
    for (const step of taskData?.performanceSteps ?? []) map.set(step.number, step.text)
    return map
  }, [taskData])

  const typeLabel = isAssignment ? 'Assignment' : c.completionType === 'test' ? 'Evaluation' : 'Read'

  const headerActions = useMemo(() => {
    const items: ContextMenuItem[] = []
    if (editable) {
      items.push(editing
        ? { key: 'cancel-edit', label: 'Cancel edit', icon: X, onAction: () => setEditing(false) }
        : { key: 'edit', label: 'Edit', icon: Pencil, onAction: () => setEditing(true) })
    }
    if (onReEvaluate) {
      items.push({
        key: 're-evaluate',
        label: 'Re-evaluate',
        icon: ClipboardCheck,
        onAction: () => onReEvaluate(record),
      })
    }
    items.push({
      key: 'delete',
      label: 'Delete record',
      icon: Trash2,
      destructive: true,
      onAction: () => setConfirmOpen(true),
    })
    return <OverlayHeaderMenu items={items} />
  }, [editable, editing, onReEvaluate, record])

  useEffect(() => {
    onHeaderActions?.(headerActions)
    return () => onHeaderActions?.(null)
  }, [headerActions, onHeaderActions])

  return (
    <div className="px-4 py-4">
      <div>
        <SectionHeader>{typeLabel}</SectionHeader>
        <SectionCard>
          <Fact label="Soldier" value={formatMedicName(soldier)} />
          {/* The item's TITLE is the pane's title — restating it an inch below
              the chrome is the same fact twice. The id is not: it is what the
              record is keyed on, and the header no longer carries it. */}
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
            {measures.map(sr => {
              const text = measureText.get(sr.stepNumber)
              return (
                <div key={sr.stepNumber} className="flex items-start gap-2 py-1.5">
                  <span className="text-[9pt] text-tertiary font-mono w-6 text-right shrink-0 mt-0.5">
                    {sr.stepNumber}
                  </span>
                  {/* A synthetic dimension has no packet behind it, so its
                      measures carry no text — the number stays and the badge
                      slides over rather than a row of empty space. */}
                  {text
                    ? <p className="text-[10pt] text-primary flex-1 min-w-0">{text}</p>
                    : <span className="flex-1" />}
                  {sr.result === 'GO' ? (
                    <span className="px-2 py-0.5 rounded text-[9pt] font-bold bg-themegreen/15 text-themegreen shrink-0">GO</span>
                  ) : sr.result === 'NO_GO' ? (
                    <span className="px-2 py-0.5 rounded text-[9pt] font-bold bg-themeredred/15 text-themeredred shrink-0">NO GO</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[9pt] bg-tertiary/10 text-tertiary shrink-0">--</span>
                  )}
                </div>
              )
            })}
          </SectionCard>
        </div>
      )}

      {/* An assignment is the one record that is still ahead of the soldier, so
          it is the one worth changing rather than replacing: the due date moves
          and the notes get read. A graded walk is corrected by walking it again.
          The form is entered from the header's Edit rather than standing open —
          a terminal that is a form on arrival reads as a draft, not a record. */}
      {editing ? (
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

      {/* Sticky rather than in a button stack: the edit fields are above it and
          the notes box can push them past the fold, and a Save you have to scroll
          to find on a form you are still typing in is a Save you miss. */}
      {dirty && (
        <div className="sticky bottom-4 z-10 flex justify-end pb-2 pointer-events-none">
          <AddFab
            icon={Check}
            label="Save assignment"
            onClick={() => onSaveAssignment?.(record, dueDate, notes)}
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
        onConfirm={() => { setConfirmOpen(false); onDelete(record) }}
        onCancel={() => setConfirmOpen(false)}
        zIndex={1300}
      />
    </div>
  )
}
