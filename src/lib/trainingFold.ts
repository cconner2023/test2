/**
 * trainingFold — project audit_log domain=training events into the legacy
 * TrainingCompletionUI shape, so the supervisor surface (getLatestTestByTask,
 * buildCompetencyMatrix, and the views over them) consumes the fold UNCHANGED.
 * Only the source flips (events → fold → rows), not the consumers.
 *
 * Current state = the projection of the immutable event stream: at most one
 * completion per (user, training_item, completion_type), latest-wins by seq.
 * Event semantics mirror the old training_completions mutations exactly:
 *   read.recorded        → a 'read' completion (GO)
 *   test.graded          → a 'test' completion (re-grade = new event, latest seq wins)
 *   assignment.created   → a pending 'assignment'
 *   assignment.completed → assignment transitions to read/test (completeAssignment)
 *   completion.voided    → removes the completion (deleteCompletion)
 *
 * Fold row id is deterministic + stable: `${userId}:${trainingItemId}:${type}`.
 * The delete path re-parses it to (user, item, type) to emit completion.voided —
 * folds carry no server row id, so deletes are expressed as void events.
 */

import type { AuditEvent } from './auditTypes'
import type { TrainingCompletionUI } from './trainingService'
import type { CompletionType, CompletionResult } from '../Types/database.types'
import type { StepResult } from '../Types/SupervisorTestTypes'
import { aliasTrainingItemId } from '../Data/trainingItemAlias'

type CType = 'read' | 'test' | 'assignment'

/** Stable, parseable id for a folded completion (no server row exists). */
export function foldRowId(userId: string, trainingItemId: string, type: CType): string {
  return `fold:${userId}:${trainingItemId}:${type}`
}

/** Inverse of foldRowId — used by the delete path to emit completion.voided. */
export function parseFoldRowId(
  id: string,
): { userId: string; trainingItemId: string; completionType: CType } | null {
  if (!id.startsWith('fold:')) return null
  // training_item_id may contain ':'? It does not (algorithm/STP codes), but be safe:
  const rest = id.slice('fold:'.length)
  const firstColon = rest.indexOf(':')
  const lastColon = rest.lastIndexOf(':')
  if (firstColon < 0 || lastColon <= firstColon) return null
  return {
    userId: rest.slice(0, firstColon),
    trainingItemId: rest.slice(firstColon + 1, lastColon),
    completionType: rest.slice(lastColon + 1) as CType,
  }
}

function makeRow(e: AuditEvent, item: string, type: CType, completed: boolean): TrainingCompletionUI {
  const p = e.payload ?? {}
  return {
    id: foldRowId(e.subjectId, item, type),
    userId: e.subjectId,
    trainingItemId: item,
    completionType: type as CompletionType,
    result: (p.result as CompletionResult) ?? 'GO',
    supervisorId: (p.supervisor_id as string | null) ?? e.actorId,
    stepResults: (p.step_results as StepResult[] | null) ?? null,
    supervisorNotes: (p.supervisor_notes as string | null) ?? null,
    dueDate: (p.due_date as string | null) ?? null,
    calendarOriginId: null, // calendar link lives in the mutable projection, not events
    completedAt: completed ? e.occurredAt : null,
    createdAt: e.occurredAt,
    updatedAt: e.occurredAt,
    syncStatus: 'synced',
  }
}

/**
 * Fold a set of training events into current-state completions.
 * Pass the events for one user (per-soldier) or a whole clinic (competency matrix);
 * grouping is by (subject, training_item) so mixing users is safe.
 */
export function foldTrainingState(events: AuditEvent[]): TrainingCompletionUI[] {
  // Oldest-first: synced events by seq, then local (seq null) by occurredAt.
  const ordered = [...events].sort((a, b) => {
    if (a.seq != null && b.seq != null) return a.seq - b.seq
    if (a.seq != null) return -1
    if (b.seq != null) return 1
    return new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
  })

  // `${userId}:${trainingItemId}` → Map<completionType, row>
  const groups = new Map<string, Map<CType, TrainingCompletionUI>>()
  const groupFor = (userId: string, item: string): Map<CType, TrainingCompletionUI> => {
    const k = `${userId}:${item}`
    let g = groups.get(k)
    if (!g) { g = new Map(); groups.set(k, g) }
    return g
  }

  for (const e of ordered) {
    // Alias BEFORE grouping: 17 task numbers are shared between the ICTL and
    // the STP roster, and every event predating the rename carries the bare
    // number. Group on the raw id and a soldier's historical STP credit lands
    // on the ICTL task instead. See Data/trainingItemAlias.
    const raw = (e.payload?.training_item_id as string) || ''
    if (!raw) continue
    const item = aliasTrainingItemId(raw, e.occurredAt)
    const g = groupFor(e.subjectId, item)

    switch (e.eventType) {
      case 'read.recorded':
        g.set('read', makeRow(e, item, 'read', true))
        break
      case 'test.graded':
        g.set('test', makeRow(e, item, 'test', true))
        break
      case 'assignment.created':
        g.set('assignment', makeRow(e, item, 'assignment', false))
        break
      case 'assignment.completed': {
        g.delete('assignment')
        const t: CType = (e.payload?.completion_type as CType) === 'test' ? 'test' : 'read'
        g.set(t, makeRow(e, item, t, true))
        break
      }
      case 'completion.voided': {
        const t = e.payload?.completion_type as CType | undefined
        if (t) g.delete(t)
        else { g.delete('read'); g.delete('test'); g.delete('assignment') }
        break
      }
      default:
        break
    }
  }

  const out: TrainingCompletionUI[] = []
  for (const g of groups.values()) for (const row of g.values()) out.push(row)
  return out
}

// ── Verify-first cutover support ─────────────────────────────────────────────

export interface FoldDiff {
  liveCount: number
  foldCount: number
  /** Logical keys present in the live (training_completions) set but not the fold. */
  onlyLive: string[]
  /** Logical keys present in the fold but not live. */
  onlyFold: string[]
  /** Same logical key, differing field. */
  mismatched: { key: string; field: string; live: unknown; fold: unknown }[]
}

/** Logical identity of a completion, independent of its (synthetic vs real) id. */
function logicalKey(c: { userId: string; trainingItemId: string; completionType: string }): string {
  return `${c.userId}:${c.trainingItemId}:${c.completionType}`
}

/**
 * Union two completion lists by logical identity, preferring `primary`. Used by
 * the supervisor flip so the clinic fold (scoped by audit_log.clinic_id) is
 * authoritative where present, while live training_completions entries for
 * loaned-in soldiers (events live under their HOME clinic, not this one) — or any
 * fold gap — are still surfaced rather than dropped.
 */
export function unionByLogicalKey(
  primary: TrainingCompletionUI[],
  secondary: TrainingCompletionUI[],
): TrainingCompletionUI[] {
  const out = new Map<string, TrainingCompletionUI>()
  for (const c of primary) out.set(logicalKey(c), c)
  for (const c of secondary) {
    const k = logicalKey(c)
    if (!out.has(k)) out.set(k, c)
  }
  return [...out.values()]
}

/**
 * Compare the live training_completions projection against the event fold by
 * logical identity (not id — fold ids are synthetic). Used during the
 * verify-first cutover to prove the fold reproduces current state before the UI
 * is switched over. A clean diff = empty onlyLive/onlyFold/mismatched.
 *
 * DORMANT since training_completions was retired, and it now has a known false
 * positive: the fold applies the ICTL/STP collision alias while a live row is
 * pre-alias by definition, so each of the 17 shared numbers reads as one
 * onlyLive + one onlyFold. Not a fold defect. Alias the live side before
 * diffing if this is ever revived — rows carry no occurredAt, so that means
 * deciding a timestamp for them, not reusing aliasTrainingItemId as-is.
 */
export function diffTrainingFold(
  live: TrainingCompletionUI[],
  fold: TrainingCompletionUI[],
): FoldDiff {
  const lm = new Map(live.map((c) => [logicalKey(c), c]))
  const fm = new Map(fold.map((c) => [logicalKey(c), c]))
  const onlyLive = [...lm.keys()].filter((k) => !fm.has(k))
  const onlyFold = [...fm.keys()].filter((k) => !lm.has(k))
  const mismatched: FoldDiff['mismatched'] = []
  for (const [k, lc] of lm) {
    const fc = fm.get(k)
    if (!fc) continue
    for (const field of ['result', 'completionType', 'supervisorId'] as const) {
      if ((lc[field] ?? null) !== (fc[field] ?? null)) {
        mismatched.push({ key: k, field, live: lc[field], fold: fc[field] })
      }
    }
  }
  return { liveCount: live.length, foldCount: fold.length, onlyLive, onlyFold, mismatched }
}
