/**
 * Cluster labelling — unit name vs nickname.
 *
 *   clinics.name      Unit name. Admin-owned, canonical. Used for admin views,
 *                     outside contacts, UIC matching, and every official output
 *                     (SF600 / DD689 / hand receipts / exports). Never nickname there.
 *   clinics.nickname  Supervisor-editable working name. Shown ONLY to viewers
 *                     who know the cluster (own, loans, parent, children,
 *                     associated peers, supervisor scope — the cluster directory).
 *
 * Rule: if the cluster is in the viewer's directory and has a nickname, the
 * nickname is primary and the unit name is secondary; otherwise the unit name.
 * Pass the unit name you already have as `unitName` — it's the fallback for
 * clusters outside the directory (and before the directory hydrates).
 */

import { useClusterDirectoryStore } from '../stores/useClusterDirectoryStore'
import type { ClusterDirectoryEntry } from '../lib/clusterDirectoryService'

export interface ClusterLabelParts {
  /** What to show. */
  primary: string
  /** Unit name, set only when `primary` is a nickname. */
  secondary: string | null
}

function partsFor(
  entry: ClusterDirectoryEntry | undefined,
  unitName: string | null | undefined,
): ClusterLabelParts {
  const unit = entry?.name || unitName || ''
  if (entry?.nickname && entry.nickname !== unit) return { primary: entry.nickname, secondary: unit || null }
  return { primary: unit, secondary: null }
}

/** Non-reactive — for callbacks, sorting, and non-React code. */
export function clusterLabelParts(clinicId: string | null | undefined, unitName?: string | null): ClusterLabelParts {
  const entry = clinicId ? useClusterDirectoryStore.getState().entries[clinicId] : undefined
  return partsFor(entry, unitName)
}

/** Non-reactive display label (nickname for known clusters, else unit name). */
export function clusterLabel(clinicId: string | null | undefined, unitName?: string | null): string {
  return clusterLabelParts(clinicId, unitName).primary
}

/** One-line form: "Nickname (Unit Name)" when nicknamed, else the unit name. */
export function clusterLabelInline(clinicId: string | null | undefined, unitName?: string | null): string {
  const p = clusterLabelParts(clinicId, unitName)
  return p.secondary ? `${p.primary} (${p.secondary})` : p.primary
}

/** Reactive parts — re-renders when the directory hydrates or a nickname changes. */
export function useClusterLabelParts(clinicId: string | null | undefined, unitName?: string | null): ClusterLabelParts {
  const entry = useClusterDirectoryStore((s) => (clinicId ? s.entries[clinicId] : undefined))
  return partsFor(entry, unitName)
}

/** Reactive display label. */
export function useClusterLabel(clinicId: string | null | undefined, unitName?: string | null): string {
  return useClusterLabelParts(clinicId, unitName).primary
}

/**
 * Subscribe a component to directory changes when it labels many clusters via
 * the non-reactive helpers (lists, sorts). Returns a value usable as a memo dep.
 */
export function useClusterDirectoryVersion(): Record<string, ClusterDirectoryEntry> {
  return useClusterDirectoryStore((s) => s.entries)
}
