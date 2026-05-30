import type { ClinicRoom } from '../lib/adminService'
import { useClinicConfig } from './useClinicConfig'

/**
 * Rooms for a specific clinic (clinics.rooms jsonb). `targetClinicId` defaults
 * to the user's assigned clinic; supervisor surfaces pass an explicit id to
 * honor the clinic-context toggle. Thin selector over the consolidated
 * useClinicConfig read — shares one GET /clinics with the other clinic-config
 * hooks. Re-runs on `clinics` invalidation bump.
 */
export function useClinicRooms(targetClinicId?: string | null): ClinicRoom[] {
  return useClinicConfig(targetClinicId).rooms
}
