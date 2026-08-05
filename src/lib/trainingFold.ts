/**
 * trainingFold — project audit_log domain=training events into the legacy
 * TrainingCompletionUI shape, so the supervisor surface (getLatestTestByTask,
 * buildCompetencyMatrix, and the views over them) consumes the fold UNCHANGED.
 * Only the source flips (events → fold → rows), not the consumers.
 *
 * Current state = the projection of the immutable event stream. Latest-wins by
 * seq for the graded types, and READS ARE THE EXCEPTION — see below.
 * Event semantics mirror the old training_completions mutations exactly:
 *   read.recorded        → a 'read' completion (GO), ONE ROW PER EVENT
 *   test.graded          → a 'test' completion (re-grade = new event, latest seq wins)
 *   assignment.created   → a pending 'assignment'
 *   assignment.completed → assignment transitions to read/test (completeAssignment)
 *   completion.voided    → removes the completion (deleteCompletion)
 *
 * READS STACK; TESTS AND ASSIGNMENTS REPLACE (2026-08-04). A task carries a
 * doctrine refresh interval — annual, semi-annual — so "when was this last read"
 * is not a status, it is a series, and currency is computed from the newest read
 * against that interval. Collapsing repeats to one row threw away every date but
 * the last and made a re-read indistinguishable from never re-reading. A grade
 * is the opposite: re-grading CORRECTS a verdict rather than adding a second one
 * (see v2/supervisor), so it still replaces.
 *
 * Fold row id is deterministic + stable. `fold:${userId}:${item}:${type}` for
 * the replacing types; reads append `#${auditEventId}`, which is stable across
 * refolds because it IS the event's id. The delete path re-parses the id to
 * (user, item, type) and, for a read, the one event to retire — folds carry no
 * server row id, so deletes are expressed as void events.
 */

import type { AuditEvent } from './auditTypes'
import type { TrainingCompletionUI } from './trainingService'
import type { CompletionType, CompletionResult } from '../Types/database.types'
import type { StepResult } from '../Types/SupervisorTestTypes'
import { aliasTrainingItemId } from '../Data/trainingItemAlias'

type CType = 'read' | 'test' | 'assignment'

/**
 * Stable, parseable id for a folded completion (no server row exists).
 *
 * `eventId` is what makes a read addressable one rep at a time. It is only ever
 * passed for reads: giving a test one would make every re-grade look like a new
 * record, which is the distinction the two halves of this fold exist to keep.
 */
export function foldRowId(
  userId: string,
  trainingItemId: string,
  type: CType,
  eventId?: string,
): string {
  const base = `fold:${userId}:${trainingItemId}:${type}`
  return eventId ? `${base}#${eventId}` : base
}

/** Inverse of foldRowId — used by the delete path to emit completion.voided.
 *  `eventId` is null for the replacing types and for any id written before reads
 *  stacked, which is what makes an old id still resolve to a whole-type void. */
export function parseFoldRowId(
  id: string,
): { userId: string; trainingItemId: string; completionType: CType; eventId: string | null } | null {
  if (!id.startsWith('fold:')) return null
  // training_item_id may contain ':'? It does not (algorithm/STP codes), but be safe:
  const rest = id.slice('fold:'.length)
  const firstColon = rest.indexOf(':')
  const lastColon = rest.lastIndexOf(':')
  if (firstColon < 0 || lastColon <= firstColon) return null
  // The event id rides on the type segment, so it cannot be confused with the
  // training item id — which is the only other free-form field in here.
  const tail = rest.slice(lastColon + 1)
  const hash = tail.indexOf('#')
  return {
    userId: rest.slice(0, firstColon),
    trainingItemId: rest.slice(firstColon + 1, lastColon),
    completionType: (hash < 0 ? tail : tail.slice(0, hash)) as CType,
    eventId: hash < 0 ? null : tail.slice(hash + 1),
  }
}

/** Replay order: synced events by seq, then local (seq null) by occurredAt.
 *  Shared by the fold and the void replay so both read the stream identically —
 *  a void only retires what precedes it, so the order IS the semantics. */
function orderOldestFirst(events: AuditEvent[]): AuditEvent[] {
  return [...events].sort((a, b) => {
    if (a.seq != null && b.seq != null) return a.seq - b.seq
    if (a.seq != null) return -1
    if (b.seq != null) return 1
    return new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
  })
}

/** Group key for a folded row. Reads get one slot per event so they accumulate;
 *  everything else gets one slot per type so it is replaced in place. */
function slotFor(type: CType, eventId: string): string {
  return type === 'read' ? `read#${eventId}` : type
}

function makeRow(
  e: AuditEvent,
  item: string,
  type: CType,
  completed: boolean,
): TrainingCompletionUI {
  const p = e.payload ?? {}
  return {
    id: foldRowId(e.subjectId, item, type, type === 'read' ? e.id : undefined),
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
  const ordered = orderOldestFirst(events)

  // `${userId}:${trainingItemId}` → Map<slot, row>, where a slot is the type for
  // the replacing kinds and `read#<eventId>` for each individual read.
  const groups = new Map<string, Map<string, TrainingCompletionUI>>()
  const groupFor = (userId: string, item: string): Map<string, TrainingCompletionUI> => {
    const k = `${userId}:${item}`
    let g = groups.get(k)
    if (!g) { g = new Map(); groups.set(k, g) }
    return g
  }

  /** Retire every read of an item. What a void with no event id means, and what
   *  a delete written before reads stacked still has to do. */
  const dropAllReads = (g: Map<string, TrainingCompletionUI>) => {
    for (const slot of [...g.keys()]) if (slot.startsWith('read#')) g.delete(slot)
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
        // No g.delete first: this is the stacking half. Every deliberate rep is
        // its own row, carrying its own occurredAt, which is the series the
        // doctrine refresh interval is measured against.
        g.set(slotFor('read', e.id), makeRow(e, item, 'read', true))
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
        g.set(slotFor(t, e.id), makeRow(e, item, t, true))
        break
      }
      case 'completion.voided': {
        const t = e.payload?.completion_type as CType | undefined
        // event_id names ONE read. Without it a read void is a whole-type void,
        // which is what the calendar cascade emits and what every void written
        // before reads stacked meant.
        const target = e.payload?.event_id as string | undefined
        if (t === 'read' && target) g.delete(slotFor('read', target))
        else if (t === 'read') dropAllReads(g)
        else if (t) g.delete(t)
        else { dropAllReads(g); g.delete('test'); g.delete('assignment') }
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

// ── Void suppression for the RAW surfaces ────────────────────────────────────

/**
 * The raw events a `completion.voided` tombstone retires.
 *
 * WHY THIS EXISTS. Half the training surfaces read the fold and half read the
 * raw stream — the weekly activity graph, the encounter roll-ups and the
 * per-algorithm run counts all count OCCURRENCES, which the fold cannot express.
 * Until now only the fold applied voids, and the raw half was cleaned by
 * deleteCompletion's hard purge instead. That purge is best-effort BY DESIGN: it
 * reaches only rows this device can pull, and its server delete rides the sync
 * queue. Every gap it leaves — a delete written offline, a row an RLS refusal
 * kept, a peer device's cache, a copy pulled back before the queue drained —
 * left a deleted record still standing in the graph with no record behind it to
 * delete again. The tombstone is the durable suppressor (it is deliberately
 * undeletable, see the audit_log_delete allow-list); this makes the raw half
 * honour it, so the purge is belt-and-braces rather than load-bearing.
 *
 * Semantics mirror the purge exactly, so the two halves cannot disagree: a void
 * naming an `event_id` retires that ONE event, a typed void retires every event
 * of that type live at the time (a re-grade appends, so a superseded grade goes
 * with the record it was superseded into), and an untyped void retires the item.
 * Retires what PRECEDES it only — a grade written after a void is new work.
 */
export function voidedTrainingEventIds(events: AuditEvent[]): Set<string> {
  const voided = new Set<string>()
  // `${userId}:${item}` → type → the raw event ids still live for that type.
  const live = new Map<string, Map<CType, Set<string>>>()
  const setFor = (key: string, type: CType): Set<string> => {
    let byType = live.get(key)
    if (!byType) { byType = new Map(); live.set(key, byType) }
    let ids = byType.get(type)
    if (!ids) { ids = new Set(); byType.set(type, ids) }
    return ids
  }
  const retire = (key: string, type: CType) => {
    const ids = live.get(key)?.get(type)
    if (!ids) return
    for (const id of ids) voided.add(id)
    ids.clear()
  }

  for (const e of orderOldestFirst(events)) {
    const raw = (e.payload?.training_item_id as string) || ''
    if (!raw) continue
    const key = `${e.subjectId}:${aliasTrainingItemId(raw, e.occurredAt)}`

    switch (e.eventType) {
      case 'read.recorded':
        setFor(key, 'read').add(e.id)
        break
      case 'test.graded':
        setFor(key, 'test').add(e.id)
        break
      case 'assignment.created':
        setFor(key, 'assignment').add(e.id)
        break
      case 'assignment.completed':
        // Filed under what it BECAME, which is the type a void will name — the
        // assignment.created it worked off stays under 'assignment', the same
        // split trainingService's contributesTo makes for the purge.
        setFor(key, (e.payload?.completion_type as CType) === 'test' ? 'test' : 'read').add(e.id)
        break
      case 'completion.voided': {
        const t = e.payload?.completion_type as CType | undefined
        const target = e.payload?.event_id as string | undefined
        if (t && target) {
          voided.add(target)
          live.get(key)?.get(t)?.delete(target)
        } else if (t) {
          retire(key, t)
        } else {
          retire(key, 'read'); retire(key, 'test'); retire(key, 'assignment')
        }
        break
      }
      default:
        break
    }
  }

  return voided
}

/**
 * The raw stream with every voided event removed — what an occurrence count is
 * a count OF. The tombstones themselves survive the filter: they carry no
 * training event type, so nothing counting reps sees them, and a history surface
 * still has "Training record removed" to show for the gap.
 *
 * Apply this where the raw stream is FETCHED, not inside each roll-up: the
 * consumers are spread across the supervisor drawer, the self surface and the
 * echelon publisher, and one of them forgetting is exactly the bug this fixes.
 * Never apply it before foldTrainingState — the fold needs the voids to apply.
 */
export function liveTrainingEvents(events: AuditEvent[]): AuditEvent[] {
  const voided = voidedTrainingEventIds(events)
  return voided.size === 0 ? events : events.filter((e) => !voided.has(e.id))
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

/** Logical identity of a completion, independent of its (synthetic vs real) id.
 *
 *  CAUTION IF EITHER CUTOVER HELPER IS EVER REVIVED (both are currently unused —
 *  training_completions is gone): this key predates stacked reads and collapses
 *  every rep of a task to one entry. Union or diff a fold through it and the
 *  read series silently flattens back to latest-wins. */
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
