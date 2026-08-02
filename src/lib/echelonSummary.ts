/**
 * Echelon readiness summary — the percentages-only rollup a CHILD cluster
 * publishes UP to its direct parent so a parent-echelon supervisor gets
 * visibility of subordinate training WITHOUT decrypting child data.
 *
 * WHY it looks like this (2026-07-02 design):
 *  - Readiness/coverage derive from audit_log training events that are ENCRYPTED
 *    with the CHILD clinic's vault key. A parent is not in that vault and cannot
 *    decrypt them (nor can the server). So the child — which CAN decrypt its own
 *    data — computes the numbers locally and fans ONLY these percentages to the
 *    parent vault (sealed to the parent's public bundle, same clinicVault Signal
 *    pathway as the cross-cluster calendar fan-out). No task detail, no PHI ever
 *    leaves the child.
 *  - Onus is on child activity: if no child user has published (cluster inactive),
 *    the parent has no summary and the card renders "No active users…".
 *
 * ⚠️ ATTRIBUTION (USR-authorised 2026-07-31, supersedes the original
 * de-identified-aggregate rule): `soldiers` carries per-person percentages keyed
 * by user_id. The parent already knows those users by name — the subtree-scoped
 * supervisor_* RPCs list a child roster — so the identity was never the secret;
 * the readiness was. The trade was made deliberately so a subordinate cluster
 * expands in the supervisor rail and reads like any other cluster instead of an
 * anonymous bar.
 *
 * ⚠️ TRAINING DETAIL (USR-directed 2026-08-01, supersedes this file's own
 * "percentages only, no task detail" line): `categories`, `activity` and
 * `soldiers[].areas` publish the ICTL roster standing behind readiness_pct —
 * per subject area, and per soldier within it. A subordinate cluster now renders
 * the SAME Training pane as any other subject on the parent, which is the point;
 * a percentage a supervisor cannot account for is a number they cannot act on.
 *
 * WHAT STILL HOLDS, and these are the actual invariants rather than the
 * paraphrase that got superseded twice: the unit is the ICTL subject area, never
 * a patient encounter; counts and percentages only, no free text, no notes, no
 * step results; NO PHI (the ICTL roster is published Army task content); it
 * rides the same clinicVault Signal path sealed per parent-clinic device; it is
 * DOWNWARD-only; and the parent still cannot WRITE child training — the fan is a
 * readout, and the child remains the only holder of the records behind it.
 *
 * The line NOT to cross is unchanged and predates all of this: encounter detail
 * (which algorithm on which patient) stays parked until a BAA. Category standing
 * is what a unit is measured on; an encounter is what happened to a person.
 *
 * This module is types + a pure change-detection key ONLY (no IDB / no crypto),
 * so both offlineDb (parent cache) and the compute/publish path can import it
 * without a dependency cycle.
 */

/**
 * One ICTL subject area's standing across the child's roster.
 *
 * `tasks` is PUBLISHED rather than looked up from the parent's own ICTL roster.
 * Both ends compile the roster into the bundle, so they agree only while they
 * are on the same build — and a child running an older one must report its own
 * denominators, not have the parent's substituted underneath its numerator.
 */
export interface EchelonCategoryRow {
  /** Subject-area name, verbatim from the child's roster. */
  area: string
  /** ICTLs in the area — the PER-SOLDIER denominator. */
  tasks: number
  /** ICTLs held, summed across the child's roster. */
  passed: number
}

/**
 * One week of the child's training activity. Aggregate counts, no identity —
 * the same two series the supervisor's own timeline draws, and the same reason
 * they stay separate: a self-logged rep is not a supervised evaluation.
 */
export interface EchelonActivityWeek {
  /** Epoch ms of the week's first day, in the CHILD's local timezone. Published
   *  as an instant so a parent in another zone plots it without reinterpreting
   *  a date string against its own midnight. */
  start: number
  evaluated: number
  ran: number
}

/** One child soldier's numbers. The two percentages the parent's own rail rows
 *  show, so the subordinate roster renders through the same code — plus, since
 *  2026-08-01, where those percentages came from by category. */
export interface EchelonSoldierReadiness {
  user_id: string
  readiness_pct: number
  cert_pct: number
  overdue_count: number
  /** ICTLs held per subject area. The denominator is the matching
   *  EchelonCategoryRow.tasks — it is identical for every soldier, so repeating
   *  it on each row would be headcount-many copies of one number. Optional for
   *  back-compat: an older row drills to no category detail. */
  areas?: { area: string; passed: number }[]
}

export interface EchelonReadinessSummary {
  /** The child clinic these numbers describe (IDB key on the parent). */
  source_clinic_id: string
  /** The clinic this summary was fanned to (the direct parent). */
  parent_clinic_id: string
  /** Team training readiness — computeTeamMetrics.teamReadinessPercent. */
  readiness_pct: number
  /** Cert compliance — computeTeamMetrics.certCompliancePercent. */
  cert_pct: number
  /** Count of subject areas below full coverage (subjectAreaGaps < 100%). */
  coverage_gap_count: number
  /** Assigned personnel count at compute time. */
  medic_count: number
  /** Algorithm encounters logged across the child clinic on the CHILD's local
   *  current day, at compute time. Aggregate count only — no soldier identity, no
   *  patient data — so it stays inside the de-identified-aggregate echelon shape.
   *  Optional for back-compat with summaries fanned before this field existed. */
  encounters_today?: number
  /** Per-soldier rows behind readiness_pct / cert_pct. Optional for back-compat
   *  with summaries fanned before attribution landed — an older summary expands
   *  to nothing and the cluster still shows its rollup. */
  soldiers?: EchelonSoldierReadiness[]
  /** The ICTL categories behind readiness_pct — the child's Training pane, fanned
   *  up so a subordinate cluster reads like any other subject on the parent
   *  instead of a percentage with no account of itself. Optional for back-compat. */
  categories?: EchelonCategoryRow[]
  /** Weekly training activity, oldest first. Optional for back-compat. */
  activity?: EchelonActivityWeek[]
  /** ISO — when the CHILD computed the numbers (drives staleness display). */
  computed_at: string
  /** ISO — when the PARENT stored it on consume. Set by the cache, not the wire. */
  received_at?: string
}

/**
 * Stable key over the VALUE fields (excludes timestamps) for change-detection.
 * The heartbeat publisher compares this to the last-fanned key and SKIPS the
 * fan when unchanged — bounding egress ("if no change then skip").
 *
 * The per-soldier rows are folded in DELIBERATELY, and sorted so row order can
 * never forge a change. Attribution made the payload bigger, which makes the
 * skip matter more, not less: one soldier's percentage moving is exactly the
 * delta worth spending a fan on, and nothing else is.
 *
 * ⚠️ ACTIVITY CARRIES ITS WEEK BOUNDARIES, so the key MOVES when the week rolls
 * even in a cluster that did nothing. That is one extra fan per clinic per week
 * and it is the correct trade: the alternative is keying on the counts alone,
 * which leaves the parent plotting a graph whose x axis silently ages.
 */
export function summaryValueKey(s: EchelonReadinessSummary): string {
  const soldiers = (s.soldiers ?? [])
    .map((r) => {
      const areas = (r.areas ?? []).map((a) => `${a.area}=${a.passed}`).sort().join('+')
      return `${r.user_id}:${r.readiness_pct}:${r.cert_pct}:${r.overdue_count}:${areas}`
    })
    .sort()
    .join(',')
  const categories = (s.categories ?? [])
    .map((c) => `${c.area}=${c.passed}/${c.tasks}`)
    .sort()
    .join(',')
  const activity = (s.activity ?? [])
    .map((w) => `${w.start}=${w.evaluated}/${w.ran}`)
    .join(',')
  return [
    s.source_clinic_id,
    s.readiness_pct,
    s.cert_pct,
    s.coverage_gap_count,
    s.medic_count,
    s.encounters_today ?? 0,
    soldiers,
    categories,
    activity,
  ].join('|')
}
