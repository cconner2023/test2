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
import { useInvalidation, useInvalidationStore } from '../stores/useInvalidationStore'
import { useAuth } from './useAuth'
import type {
  ClinicAppointmentType,
  ClinicHuddleTask,
  ClinicPreCombatCheck,
} from '../lib/supervisorService'
import type { CategoryColorMap } from '../Types/CalendarTypes'

export interface ClinicConfig {
  name: string | null
  appointmentTypes: ClinicAppointmentType[]
  huddleTasks: ClinicHuddleTask[]
  categoryColors: CategoryColorMap
  preCombatChecks: ClinicPreCombatCheck[]
}

// Stable empty snapshot — shared reference so "no clinic" renders never churn
// downstream effects/selectors that depend on the returned arrays.
const EMPTY: ClinicConfig = {
  name: null,
  appointmentTypes: [],
  huddleTasks: [],
  categoryColors: {},
  preCombatChecks: [],
}

const CLINIC_CONFIG_COLUMNS =
  'name, appointment_types, huddle_tasks, calendar_category_colors, pre_combat_checks'

// Resolved snapshots + in-flight promises, both keyed `${clinicId}::${gen}`.
// One round-trip per (clinic, invalidation generation), shared across hooks.
const snapshots = new Map<string, ClinicConfig>()
const inflight = new Map<string, Promise<ClinicConfig>>()

// Per-clinic listeners for fetch-free optimistic patches (see patchClinicConfig).
const patchListeners = new Map<string, Set<(cfg: ClinicConfig) => void>>()

function subscribePatch(clinicId: string, fn: (cfg: ClinicConfig) => void): () => void {
  let set = patchListeners.get(clinicId)
  if (!set) { set = new Set(); patchListeners.set(clinicId, set) }
  set.add(fn)
  return () => {
    set!.delete(fn)
    if (set!.size === 0) patchListeners.delete(clinicId)
  }
}

/**
 * Optimistically apply a known-good clinic-config change WITHOUT a refetch.
 *
 * The clinic-config write RPCs (rooms / huddle tasks / appointment types /
 * pre-combat checks) are blind column replaces, so after a successful write the
 * server value === exactly what we sent. Calling `invalidate('clinics')` would
 * bump the global generation and force EVERY clinic reader (ClinicPanel,
 * category colors, useClinicConfig) to GET /clinics again — wasted egress for a
 * value we already hold. Instead we merge the new value into the cached snapshot
 * for the live generation and notify only useClinicConfig consumers.
 *
 * Use this in place of `invalidate('clinics')` at mutation sites that own the
 * resulting value. Fall back to `invalidate('clinics')` when the post-write
 * shape is server-derived or unknown.
 */
export function patchClinicConfig(clinicId: string, patch: Partial<ClinicConfig>): void {
  const gen = useInvalidationStore.getState().generations.clinics
  const key = `${clinicId}::${gen}`
  const next: ClinicConfig = { ...(snapshots.get(key) ?? EMPTY), ...patch }
  snapshots.set(key, next)
  patchListeners.get(clinicId)?.forEach((fn) => fn(next))
}

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

  // Receive fetch-free optimistic patches from mutation sites (patchClinicConfig).
  useEffect(() => {
    if (!clinicId) return
    return subscribePatch(clinicId, setCfg)
  }, [clinicId])

  return cfg
}
