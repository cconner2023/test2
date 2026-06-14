/**
 * Write side of the app-content CSV import. parseNoteBlocksCSV (noteBlocksCSV.ts)
 * turns a file into a NoteBlocksCsvParse; this hook turns that into actual saves,
 * routing each kind to its destination + dedup, and returns a human summary line.
 *
 *   templates / orderSets → frozen note-blocks bundle → useNoteBlocksIngest
 *                           (personal OR clinic scope, clinic supervisor-gated)
 *   providerTemplates     → profile.providerNoteTemplates (personal only)
 *   checklists            → clinic preCombatChecks (supervisor only)
 *
 * It also exposes the name→id resolution context the PARSER needs (order set name
 * for provider templates; property item/location names for checklists), built from
 * the importer's own world so portable references re-bind locally.
 */

import { useCallback, useMemo } from 'react'
import { useAuth } from './useAuth'
import { useAuthStore } from '../stores/useAuthStore'
import { useUserProfile } from './useUserProfile'
import { useNoteBlocksIngest, summarizeIngest, type IngestScope } from './useNoteBlocksIngest'
import { useClinicPreCombatChecks } from './useClinicPreCombatChecks'
import { useClinicPropertyPickers } from './useClinicPropertyPickers'
import { patchClinicConfig } from './useClinicConfig'
import { updateSupervisorClinicPreCombatChecks, type ClinicPreCombatCheck } from '../lib/supervisorService'
import { noteBlocksToBundle } from '../lib/objectBundle'
import type { UserTypes, ProviderNoteTemplate } from '../Data/User'
import type { NoteBlocksCsvParse, NoteBlocksCSVKind, CsvParseCtx } from '../Utilities/noteBlocksCSV'

function summarize(added: number, skipped: number, noun: string): string {
  if (added === 0 && skipped === 0) return 'Nothing to add'
  const a = added === 0 ? 'Added nothing new' : `Added ${added} ${noun}${added === 1 ? '' : 's'}`
  return skipped > 0 ? `${a} · skipped ${skipped} duplicate${skipped === 1 ? '' : 's'}` : a
}

export function useNoteBlocksCsvImport() {
  const { clinicId: assignedClinicId, supervisingClinicId, isSupervisorRole } = useAuth()
  const clinicName = useAuthStore(s => s.user?.clinicName ?? null)
  const clinicPlanOrderSets = useAuthStore(s => s.clinicPlanOrderSets)

  const { profile, updateProfile, syncProfileField } = useUserProfile()
  const { ingest, canIngestToClinic } = useNoteBlocksIngest()

  const checklistClinicId = supervisingClinicId ?? assignedClinicId
  const existingChecklists = useClinicPreCombatChecks(checklistClinicId)
  const { items: propertyItems, locations: propertyLocations } = useClinicPropertyPickers(checklistClinicId)

  // Resolution maps for the parser — built from THIS device's world.
  const ctx = useMemo<CsvParseCtx>(() => {
    const orderSetIdByName = new Map<string, string>()
    for (const s of [...(clinicPlanOrderSets ?? []), ...(profile.planOrderSets ?? [])]) {
      orderSetIdByName.set(s.name.trim().toLowerCase(), s.id)
    }
    const propertyItemIdByName = new Map(propertyItems.map(p => [p.name.trim().toLowerCase(), p.id]))
    const propertyLocationIdByName = new Map(propertyLocations.map(p => [p.name.trim().toLowerCase(), p.id]))
    return { orderSetIdByName, propertyItemIdByName, propertyLocationIdByName }
  }, [clinicPlanOrderSets, profile.planOrderSets, propertyItems, propertyLocations])

  /** Whether this user can import the given kind at all. */
  const canImport = useCallback((kind: NoteBlocksCSVKind): boolean => {
    if (kind === 'checklists') return !!checklistClinicId && isSupervisorRole
    return true
  }, [checklistClinicId, isSupervisorRole])

  /** Whether a personal/clinic scope toggle is meaningful for this kind. */
  const scopeSelectable = useCallback((kind: NoteBlocksCSVKind): boolean => {
    return (kind === 'templates' || kind === 'orderSets') && canIngestToClinic
  }, [canIngestToClinic])

  const importParsed = useCallback(async (parsed: NoteBlocksCsvParse, scope: IngestScope): Promise<string> => {
    if (parsed.kind === 'templates' || parsed.kind === 'orderSets') {
      const bundle = noteBlocksToBundle(parsed.data ?? {}, clinicName ?? 'cluster', new Date().toISOString())
      return summarizeIngest(ingest(bundle, scopeSelectable(parsed.kind) ? scope : 'personal'))
    }

    if (parsed.kind === 'providerTemplates') {
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
    }

    // checklists
    if (!checklistClinicId || !isSupervisorRole) return 'You don’t have permission to import clinic checklists.'
    const incoming = parsed.checklists ?? []
    const seen = new Set(existingChecklists.map(c => c.name.trim().toLowerCase()))
    let sortOrder = existingChecklists.reduce((m, c) => Math.max(m, c.sort_order), -1)
    const additions: ClinicPreCombatCheck[] = []
    let skipped = 0
    for (const c of incoming) {
      const key = c.name.trim().toLowerCase()
      if (seen.has(key)) { skipped++; continue }
      seen.add(key)
      additions.push({ id: crypto.randomUUID(), name: c.name, sort_order: ++sortOrder, items: c.items })
    }
    if (additions.length) {
      const next = [...existingChecklists, ...additions]
      const result = await updateSupervisorClinicPreCombatChecks(checklistClinicId, next)
      if (!result.success) return result.error || 'Failed to save checklists'
      patchClinicConfig(checklistClinicId, { preCombatChecks: next })
    }
    return summarize(additions.length, skipped, 'checklist')
  }, [
    clinicName, ingest, scopeSelectable,
    profile.providerNoteTemplates, updateProfile, syncProfileField,
    checklistClinicId, isSupervisorRole, existingChecklists,
  ])

  return { ctx, canImport, scopeSelectable, importParsed }
}
