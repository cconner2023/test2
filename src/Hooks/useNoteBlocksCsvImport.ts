/**
 * Write side of the app-content CSV import. parseNoteBlocksCSV (noteBlocksCSV.ts)
 * turns a file into a NoteBlocksCsvParse; this hook turns that into actual saves,
 * routing each kind to its destination + dedup, and returns a human summary line.
 *
 *   templates / orderSets → frozen note-blocks bundle → useNoteBlocksIngest
 *                           (personal OR clinic scope, clinic supervisor-gated)
 *   providerTemplates     → profile.providerNoteTemplates (personal only)
 *
 * It also exposes the name→id resolution context the PARSER needs (order set name
 * for provider templates), built from the importer's own world so portable
 * references re-bind locally.
 */

import { useCallback, useMemo } from 'react'
import { useAuthStore } from '../stores/useAuthStore'
import { useUserProfile } from './useUserProfile'
import { useAuth } from './useAuth'
import { clusterLabel, useClusterDirectoryVersion } from '../Utilities/clusterLabel'
import { useNoteBlocksIngest, summarizeIngest, type IngestScope } from './useNoteBlocksIngest'
import { noteBlocksToBundle } from '../lib/objectBundle'
import type { UserTypes, ProviderNoteTemplate } from '../Data/User'
import type { NoteBlocksCsvParse, NoteBlocksCSVKind, CsvParseCtx } from '../Utilities/noteBlocksCSV'

function summarize(added: number, skipped: number, noun: string): string {
  if (added === 0 && skipped === 0) return 'Nothing to add'
  const a = added === 0 ? 'Added nothing new' : `Added ${added} ${noun}${added === 1 ? '' : 's'}`
  return skipped > 0 ? `${a} · skipped ${skipped} duplicate${skipped === 1 ? '' : 's'}` : a
}

export function useNoteBlocksCsvImport() {
  const clinicName = useAuthStore(s => s.user?.clinicName ?? null)
  const clinicPlanOrderSets = useAuthStore(s => s.clinicPlanOrderSets)

  const { profile, updateProfile, syncProfileField } = useUserProfile()
  const { ingest, ingestToClinic, canIngestToClinic } = useNoteBlocksIngest()
  const { clinicId: homeClinicId, surrogateClinicIds, isSupervisorRole } = useAuth()
  const clusterDirectory = useClusterDirectoryVersion()

  /** Clusters this user may import into: home + every surrogate (supervisors). */
  const clusterTargets = useMemo<{ id: string; name: string }[]>(() => {
    if (!isSupervisorRole || !homeClinicId) return []
    const loans = profile.surrogateClinics ?? []
    return [
      { id: homeClinicId, name: clusterLabel(homeClinicId, clinicName ?? profile.clinicName) || 'My cluster' },
      ...surrogateClinicIds.map(id => ({ id, name: clusterLabel(id, loans.find(c => c.id === id)?.name) || 'Surrogate' })),
    ]
  }, [isSupervisorRole, homeClinicId, surrogateClinicIds, profile.surrogateClinics, profile.clinicName, clinicName, clusterDirectory])

  // Resolution maps for the parser — built from THIS device's world.
  const ctx = useMemo<CsvParseCtx>(() => {
    const orderSetIdByName = new Map<string, string>()
    for (const s of [...(clinicPlanOrderSets ?? []), ...(profile.planOrderSets ?? [])]) {
      orderSetIdByName.set(s.name.trim().toLowerCase(), s.id)
    }
    return { orderSetIdByName }
  }, [clinicPlanOrderSets, profile.planOrderSets])

  /** Whether this user can import the given kind at all. All remaining kinds
   *  (templates / orderSets / providerTemplates) are self-importable. */
  const canImport = useCallback((_kind: NoteBlocksCSVKind): boolean => true, [])

  /** Whether a personal/clinic scope toggle is meaningful for this kind. */
  const scopeSelectable = useCallback((kind: NoteBlocksCSVKind): boolean => {
    return (kind === 'templates' || kind === 'orderSets') && canIngestToClinic
  }, [canIngestToClinic])

  const importParsed = useCallback(async (parsed: NoteBlocksCsvParse, scope: IngestScope): Promise<string> => {
    if (parsed.kind === 'templates' || parsed.kind === 'orderSets') {
      const bundle = noteBlocksToBundle(parsed.data ?? {}, clinicName ?? 'cluster', new Date().toISOString())
      return summarizeIngest(ingest(bundle, scopeSelectable(parsed.kind) ? scope : 'personal'))
    }

    // providerTemplates (personal only)
    const incoming = parsed.providerTemplates ?? []
    const existing = profile.providerNoteTemplates ?? []
    const seen = new Set(existing.map(t => t.name.trim().toLowerCase()))
    const additions: ProviderNoteTemplate[] = []
    let skipped = 0
    for (const t of incoming) {
      const key = t.name.trim().toLowerCase()
      if (seen.has(key)) { skipped++; continue }
      seen.add(key)
      additions.push(t)
    }
    if (additions.length) {
      const next = [...existing, ...additions]
      updateProfile({ providerNoteTemplates: next })
      syncProfileField({ provider_note_templates: next as unknown as UserTypes['providerNoteTemplates'] })
    }
    return summarize(additions.length, skipped, 'template')
  }, [
    clinicName, ingest, scopeSelectable,
    profile.providerNoteTemplates, updateProfile, syncProfileField,
  ])

  /** Import into several destinations at once ('personal' and/or cluster ids).
   *  Returns one summary line per destination. Kinds without clusters go personal. */
  const importParsedTo = useCallback(async (parsed: NoteBlocksCsvParse, targets: string[]): Promise<string[]> => {
    if (parsed.kind === 'providerTemplates') return [await importParsed(parsed, 'personal')]
    const bundle = noteBlocksToBundle(parsed.data ?? {}, clinicName ?? 'cluster', new Date().toISOString())
    const lines: string[] = []
    for (const t of targets) {
      if (t === 'personal') { lines.push(`Personal: ${summarizeIngest(ingest(bundle, 'personal'))}`); continue }
      const name = clusterTargets.find(c => c.id === t)?.name ?? 'Cluster'
      const r = await ingestToClinic(bundle, t)
      lines.push(`${name}: ${r ? summarizeIngest(r) : 'failed'}`)
    }
    return lines
  }, [importParsed, clinicName, ingest, ingestToClinic, clusterTargets])

  return { ctx, canImport, scopeSelectable, importParsed, importParsedTo, clusterTargets }
}
