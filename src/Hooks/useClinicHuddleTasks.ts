import type { ClinicHuddleTask } from '../lib/supervisorService'
import { useClinicConfig } from './useClinicConfig'

/**
 * Current clinic's huddle tasks (clinics.huddle_tasks jsonb). Thin selector over
 * the consolidated useClinicConfig read — shares one GET /clinics with the other
 * clinic-config hooks. Re-runs on `clinics` invalidation bump.
 */
export function useClinicHuddleTasks(targetClinicId?: string | null): ClinicHuddleTask[] {
  return useClinicConfig(targetClinicId).huddleTasks
}
