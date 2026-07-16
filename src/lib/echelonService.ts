/**
 * echelonService — the app-level (non-signal) half of echelon child-cluster
 * visibility.
 *
 *  - fetchChildClinics: direct children of a clinic (one echelon level down) +
 *    live medic_count, via the supervisor_list_child_clinics RPC. Plaintext.
 *  - computeReadinessSummary: the CHILD-side rollup of its OWN clinic into a
 *    de-identified EchelonReadinessSummary, reusing the exact supervisor
 *    computeTeamMetrics math (zero definition drift). This is what the deferred
 *    heartbeat publisher will fan to the parent vault — see the _ideas note
 *    `echelon-readiness-vault-transport.md`. It is NOT yet wired to a trigger.
 */

import { supabase } from './supabase'
import { fetchClinicCertifications } from './certificationService'
import { fetchAuditByClinicDomain } from './auditService'
import { foldTrainingState } from './trainingFold'
import { createLogger } from '../Utilities/Logger'
import {
  buildTestableTaskMap,
  computeTeamMetrics,
  rollupEncounterReads,
} from '../Components/Settings/Supervisor/supervisorHelpers'
import { getExpirationStatus } from '../Components/Certifications/certHelpers'
import type { ClinicMedic } from '../Types/SupervisorTestTypes'
import type { EchelonReadinessSummary } from './echelonSummary'

const logger = createLogger('echelonService')

export interface ChildClinicRow {
  id: string
  name: string
  medic_count: number
}

/** Direct child clinics of `clinicId` (+ live medic_count). Supervisor-gated RPC. */
export async function fetchChildClinics(clinicId: string): Promise<ChildClinicRow[]> {
  try {
    const { data, error } = await supabase.rpc('supervisor_list_child_clinics', {
      p_clinic_id: clinicId,
    })
    if (error) {
      logger.warn('supervisor_list_child_clinics failed:', error.message)
      return []
    }
    return (data as ChildClinicRow[] | null) ?? []
  } catch (err) {
    logger.warn('fetchChildClinics threw:', err instanceof Error ? err.message : err)
    return []
  }
}

/** Map a get_location_medics row to the ClinicMedic shape computeTeamMetrics needs. */
function mapMedicRow(p: {
  id: string; first_name: string; last_name: string; middle_initial: string;
  rank: string; credential: string; avatar_id: string | null;
  clinic_id: string; clinic_name: string; roles?: string[];
  surrogate_clinic_id?: string | null; is_loaned_in?: boolean; sub_cluster_id?: string | null
}): ClinicMedic {
  return {
    id: p.id,
    firstName: p.first_name,
    lastName: p.last_name,
    middleInitial: p.middle_initial,
    rank: p.rank,
    credential: p.credential,
    avatarId: p.avatar_id ?? null,
    avatarBlob: null,
    roles: p.roles ?? [],
    clinicId: p.clinic_id,
    clinicName: p.clinic_name,
    surrogateClinicId: p.surrogate_clinic_id ?? null,
    isLoanedIn: p.is_loaned_in ?? false,
    subClusterId: p.sub_cluster_id ?? null,
  }
}

/**
 * Compute this clinic's de-identified readiness summary from its OWN decrypted
 * data (roster + audit_log training fold + certs), mirroring useSupervisorData →
 * computeTeamMetrics. Returns null when the clinic has no assigned medics (the
 * "no active users, cannot compute" case) or the roster read fails.
 *
 * Runs outside React (intended caller: the activity-heartbeat publisher), so it
 * fetches directly rather than through the hooks.
 */
export async function computeReadinessSummary(
  clinicId: string,
  parentClinicId: string,
): Promise<EchelonReadinessSummary | null> {
  try {
    const { data: rpcData, error } = await supabase.rpc('get_location_medics')
    if (error) {
      logger.warn('computeReadinessSummary roster fetch failed:', error.message)
      return null
    }
    // The child computes ONLY its own clinic — filter the union roster down.
    const medics: ClinicMedic[] = ((rpcData as Parameters<typeof mapMedicRow>[0][] | null) ?? [])
      .filter((p) => p.clinic_id === clinicId || p.surrogate_clinic_id === clinicId)
      .map(mapMedicRow)
    if (medics.length === 0) return null

    const userIds = medics.map((m) => m.id)
    const [certs, trainingEvents] = await Promise.all([
      fetchClinicCertifications(userIds),
      fetchAuditByClinicDomain(clinicId, 'training'),
    ])
    // Fold once for readiness; count encounters from the SAME raw events (the
    // fold collapses repeat reads, so it can't give occurrence totals).
    const folded = foldTrainingState(trainingEvents)
    const encounters_today = rollupEncounterReads(trainingEvents).totalToday

    const testableTaskMap = buildTestableTaskMap()
    const overdueItems = (userId: string) => {
      const userCerts = certs.filter((c) => c.user_id === userId)
      const expiredCerts = userCerts.filter((c) => {
        const s = getExpirationStatus(c.exp_date)
        return s === 'expired' || s === 'expiring'
      })
      const failedTests = folded.filter((t) => t.userId === userId && t.result === 'NO_GO')
      return { expiredCerts, failedTests }
    }

    const m = computeTeamMetrics(medics, folded, certs, testableTaskMap, overdueItems)
    const coverage_gap_count = m.subjectAreaGaps.filter((g) => g.coveragePercent < 100).length

    return {
      source_clinic_id: clinicId,
      parent_clinic_id: parentClinicId,
      readiness_pct: m.teamReadinessPercent,
      cert_pct: m.certCompliancePercent,
      coverage_gap_count,
      medic_count: m.totalMedics,
      encounters_today,
      computed_at: new Date().toISOString(),
    }
  } catch (err) {
    logger.warn('computeReadinessSummary threw:', err instanceof Error ? err.message : err)
    return null
  }
}
