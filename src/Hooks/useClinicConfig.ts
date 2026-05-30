// Hooks/useClinicConfig.ts — single consolidated read of the per-clinic config row.
//
// The clinic's config columns (appointment types, huddle tasks, category colors,
// rooms, pre-combat checks, name) all live on ONE `clinics` row that changes
// rarely. Previously each lived behind its own hook firing its own
// `select(<column>).eq('id', clinicId)` round-trip — so a surface mounting five
// of them issued five GET /clinics for the same row, on every mount and every
// `clinics` invalidation bump. That fan-out was a top PostgREST egress source.
//
// This module collapses them into a single fetch, keyed by (clinicId,
// invalidation generation), with in-flight de-duplication so concurrent hook
// mounts in the same render pass share ONE network request. The per-column
// hooks below are thin selectors over the result and keep their old signatures.

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useInvalidation } from '../stores/useInvalidationStore'
import { useAuth } from './useAuth'
import type {
  ClinicAppointmentType,
  ClinicHuddleTask,
  ClinicPreCombatCheck,
} from '../lib/supervisorService'
import type { ClinicRoom } from '../lib/adminService'
import type { CategoryColorMap } from '../Types/CalendarTypes'

export interface ClinicConfig {
  name: string | null
  appointmentTypes: ClinicAppointmentType[]
  huddleTasks: ClinicHuddleTask[]
  categoryColors: CategoryColorMap
  rooms: ClinicRoom[]
  preCombatChecks: ClinicPreCombatCheck[]
}

// Stable empty snapshot — shared reference so "no clinic" renders never churn
// downstream effects/selectors that depend on the returned arrays.
const EMPTY: ClinicConfig = {
  name: null,
  appointmentTypes: [],
  huddleTasks: [],
  categoryColors: {},
  rooms: [],
  preCombatChecks: [],
}

const CLINIC_CONFIG_COLUMNS =
  'name, appointment_types, huddle_tasks, calendar_category_colors, rooms, pre_combat_checks'

// Resolved snapshots + in-flight promises, both keyed `${clinicId}::${gen}`.
// One round-trip per (clinic, invalidation generation), shared across hooks.
const snapshots = new Map<string, ClinicConfig>()
const inflight = new Map<string, Promise<ClinicConfig>>()

function fetchClinicConfig(clinicId: string, key: string): Promise<ClinicConfig> {
  const existing = inflight.get(key)
  if (existing) return existing

  const p = supabase
    .from('clinics')
    .select(CLINIC_CONFIG_COLUMNS)
    .eq('id', clinicId)
    .single()
    .then(({ data, error }) => {
      inflight.delete(key)
      if (error || !data) {
        // Don't cache failures — let the next mount retry instead of pinning EMPTY.
        return EMPTY
      }
      const cfg: ClinicConfig = {
        name: (data.name as string) ?? null,
        appointmentTypes: (data.appointment_types as ClinicAppointmentType[]) ?? [],
        huddleTasks: (data.huddle_tasks as ClinicHuddleTask[]) ?? [],
        categoryColors: (data.calendar_category_colors as CategoryColorMap) ?? {},
        rooms: (data.rooms as ClinicRoom[]) ?? [],
        preCombatChecks: (data.pre_combat_checks as ClinicPreCombatCheck[]) ?? [],
      }
      snapshots.set(key, cfg)
      // Bound the map: drop older generations for this clinic.
      const prefix = `${clinicId}::`
      for (const k of snapshots.keys()) {
        if (k !== key && k.startsWith(prefix)) snapshots.delete(k)
      }
      return cfg
    })
    .catch(() => {
      inflight.delete(key)
      return EMPTY
    })

  inflight.set(key, p)
  return p
}

/**
 * Consolidated per-clinic config. `targetClinicId` defaults to the caller's
 * assigned clinic; supervisor surfaces pass an explicit id to honor the
 * clinic-context toggle. Re-fetches on `clinics` invalidation bump.
 */
export function useClinicConfig(targetClinicId?: string | null): ClinicConfig {
  const { clinicId: assignedClinicId } = useAuth()
  const clinicId = targetClinicId ?? assignedClinicId
  const clinicsGen = useInvalidation('clinics')
  const key = clinicId ? `${clinicId}::${clinicsGen}` : ''

  const [cfg, setCfg] = useState<ClinicConfig>(() => (key && snapshots.get(key)) || EMPTY)

  useEffect(() => {
    if (!clinicId) {
      setCfg(EMPTY)
      return
    }
    const cached = snapshots.get(key)
    if (cached) {
      setCfg(cached)
      return
    }
    let cancelled = false
    fetchClinicConfig(clinicId, key).then((next) => {
      if (!cancelled) setCfg(next)
    })
    return () => {
      cancelled = true
    }
  }, [clinicId, key])

  return cfg
}
