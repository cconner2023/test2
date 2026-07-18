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
  const { ingest, canIngestToClinic } = useNoteBlocksIngest()

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

  return { ctx, canImport, scopeSelectable, importParsed }
}
