import type { ClinicAppointmentType } from '../lib/supervisorService'
import { useClinicConfig } from './useClinicConfig'

/**
 * Current clinic's provider appointment types (clinics.appointment_types jsonb).
 * Thin selector over the consolidated useClinicConfig read — shares one
 * GET /clinics with the other clinic-config hooks. Re-runs on `clinics`
 * invalidation bump so settings edits propagate.
 */
export function useClinicAppointmentTypes(targetClinicId?: string | null): ClinicAppointmentType[] {
  return useClinicConfig(targetClinicId).appointmentTypes
}
