/**
 * Echelon readiness summary — the de-identified, percentages-only rollup a CHILD
 * cluster publishes UP to its direct parent so a parent-echelon supervisor gets
 * top-level visibility of subordinate training WITHOUT decrypting child data.
 *
 * WHY it looks like this (2026-07-02 design):
 *  - Readiness/coverage derive from audit_log training events that are ENCRYPTED
 *    with the CHILD clinic's vault key. A parent is not in that vault and cannot
 *    decrypt them (nor can the server). So the child — which CAN decrypt its own
 *    data — computes the numbers locally and fans ONLY these percentages to the
 *    parent vault (sealed to the parent's public bundle, same clinicVault Signal
 *    pathway as the cross-cluster calendar fan-out). NO soldier identity, no task
 *    detail, no PHI ever leaves the child.
 *  - Onus is on child activity: if no child user has published (cluster inactive),
 *    the parent has no summary and the card renders "No active users…".
 *
 * This module is types + a pure change-detection key ONLY (no IDB / no crypto),
 * so both offlineDb (parent cache) and the compute/publish path can import it
 * without a dependency cycle.
 */

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
  /** ISO — when the CHILD computed the numbers (drives staleness display). */
  computed_at: string
  /** ISO — when the PARENT stored it on consume. Set by the cache, not the wire. */
  received_at?: string
}

/**
 * Stable key over the VALUE fields (excludes timestamps) for change-detection.
 * The heartbeat publisher compares this to the last-fanned key and SKIPS the
 * fan when unchanged — bounding egress ("if no change then skip").
 */
export function summaryValueKey(s: EchelonReadinessSummary): string {
  return [
    s.source_clinic_id,
    s.readiness_pct,
    s.cert_pct,
    s.coverage_gap_count,
    s.medic_count,
  ].join('|')
}
