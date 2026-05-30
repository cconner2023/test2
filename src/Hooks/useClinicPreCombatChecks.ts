import type { ClinicPreCombatCheck } from '../lib/supervisorService'
import { useClinicConfig } from './useClinicConfig'

/**
 * Current clinic's pre-combat check templates (clinics.pre_combat_checks jsonb).
 * Thin selector over the consolidated useClinicConfig read — shares one
 * GET /clinics with the other clinic-config hooks. Re-runs on `clinics`
 * invalidation bump.
 */
export function useClinicPreCombatChecks(targetClinicId?: string | null): ClinicPreCombatCheck[] {
  return useClinicConfig(targetClinicId).preCombatChecks
}
