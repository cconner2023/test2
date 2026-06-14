/**
 * Ingest a note-blocks bundle (text templates / order sets / plan tags) into the
 * receiver's OWN blocks, with content-level duplicate checking. Used by both the
 * chat SharedBundleCard (cross/same-cluster share) and the settings file import.
 *
 * Dedup keys: text expander by `abbr` (case-insensitive), order set by `name`
 * (case-insensitive — and ids are reminted so a copy never collides on id), tags
 * by exact string. Colliding items are SKIPPED, never overwritten — the caller
 * surfaces the counts ("Added 4, skipped 1"). NO PHI: these blocks are
 * operational text only, which is why they travel as a plain frozen value.
 *
 * Two scopes: 'personal' writes the profile (every user); 'clinic' writes the
 * receiver's HOME clinic content (supervisor-gated by the caller).
 */

import { useCallback } from 'react'
import { useAuthStore } from '../stores/useAuthStore'
import { useUserProfile } from './useUserProfile'
import { useEditableClinicContent } from './useEditableClinicContent'
import type { NoteBlocksBundle } from '../lib/objectBundle'
import type { TextExpander, PlanOrderSet, PlanOrderTags } from '../Data/User'
import { PLAN_ORDER_CATEGORIES } from '../Data/User'

export type IngestScope = 'personal' | 'clinic'

export interface IngestCounts {
  templates: number
  orderSets: number
  tags: number
}

export interface IngestResult {
  added: IngestCounts
  skipped: IngestCounts
}

const EMPTY_TAGS: PlanOrderTags = { referral: [], meds: [], radiology: [], lab: [], followUp: [] }

function mergeExpanders(existing: TextExpander[], incoming: TextExpander[]): { next: TextExpander[]; added: number; skipped: number } {
  const seen = new Set(existing.map(e => e.abbr.trim().toLowerCase()))
  const additions: TextExpander[] = []
  let skipped = 0
  for (const e of incoming) {
    const key = e.abbr.trim().toLowerCase()
    if (!key) { skipped++; continue }
    if (seen.has(key)) { skipped++; continue }
    seen.add(key)
    additions.push(e)
  }
  return { next: [...existing, ...additions], added: additions.length, skipped }
}

function mergeOrderSets(existing: PlanOrderSet[], incoming: PlanOrderSet[]): { next: PlanOrderSet[]; added: number; skipped: number } {
  const seen = new Set(existing.map(s => s.name.trim().toLowerCase()))
  const additions: PlanOrderSet[] = []
  let skipped = 0
  for (const s of incoming) {
    const key = s.name.trim().toLowerCase()
    if (!key) { skipped++; continue }
    if (seen.has(key)) { skipped++; continue }
    seen.add(key)
    // Remint id — the incoming id is from the sender's namespace and could
    // collide with a local set; name is the identity that matters here.
    additions.push({ ...s, id: crypto.randomUUID() })
  }
  return { next: [...existing, ...additions], added: additions.length, skipped }
}

function mergeStringList(existing: string[], incoming: string[]): { next: string[]; added: number; skipped: number } {
  const seen = new Set(existing.map(t => t.trim().toLowerCase()))
  const additions: string[] = []
  let skipped = 0
  for (const t of incoming) {
    const key = t.trim().toLowerCase()
    if (!key) { skipped++; continue }
    if (seen.has(key)) { skipped++; continue }
    seen.add(key)
    additions.push(t)
  }
  return { next: [...existing, ...additions], added: additions.length, skipped }
}

function mergeOrderTags(existing: PlanOrderTags, incoming: PlanOrderTags): { next: PlanOrderTags; added: number; skipped: number } {
  const next: PlanOrderTags = { ...EMPTY_TAGS }
  let added = 0
  let skipped = 0
  for (const cat of PLAN_ORDER_CATEGORIES) {
    const m = mergeStringList(existing[cat] ?? [], incoming[cat] ?? [])
    next[cat] = m.next
    added += m.added
    skipped += m.skipped
  }
  return { next, added, skipped }
}

export function useNoteBlocksIngest() {
  const { profile, updateProfile, syncProfileField } = useUserProfile()
  const homeClinicId = useAuthStore(s => s.clinicId)
  const isSupervisorRole = useAuthStore(s => s.isSupervisorRole)

  // Home-clinic cached blocks live in the auth store; the editable hook patches
  // both Supabase and that cache on write.
  const clinicTextExpanders = useAuthStore(s => s.clinicTextExpanders)
  const clinicPlanOrderSets = useAuthStore(s => s.clinicPlanOrderSets)
  const clinicPlanOrderTags = useAuthStore(s => s.clinicPlanOrderTags)
  const clinicPlanInstructionTags = useAuthStore(s => s.clinicPlanInstructionTags)
  const { update: updateClinic } = useEditableClinicContent(homeClinicId)

  /** Whether the clinic scope is even offered to this receiver. */
  const canIngestToClinic = !!homeClinicId && !!isSupervisorRole

  const ingest = useCallback((bundle: NoteBlocksBundle, scope: IngestScope): IngestResult => {
    const zero: IngestResult = { added: { templates: 0, orderSets: 0, tags: 0 }, skipped: { templates: 0, orderSets: 0, tags: 0 } }

    if (scope === 'clinic') {
      if (!canIngestToClinic) return zero
      const exp = mergeExpanders(clinicTextExpanders ?? [], bundle.textExpanders ?? [])
      const sets = mergeOrderSets(clinicPlanOrderSets ?? [], bundle.planOrderSets ?? [])
      const tags = mergeOrderTags(clinicPlanOrderTags ?? EMPTY_TAGS, bundle.planOrderTags ?? EMPTY_TAGS)
      const instr = mergeStringList(clinicPlanInstructionTags ?? [], bundle.planInstructionTags ?? [])

      const patch: Parameters<typeof updateClinic>[0] = {}
      if (exp.added) patch.textExpanders = exp.next
      if (sets.added) patch.planOrderSets = sets.next
      if (tags.added) patch.planOrderTags = tags.next
      if (instr.added) patch.planInstructionTags = instr.next
      if (Object.keys(patch).length) updateClinic(patch)

      return {
        added: { templates: exp.added, orderSets: sets.added, tags: tags.added + instr.added },
        skipped: { templates: exp.skipped, orderSets: sets.skipped, tags: tags.skipped + instr.skipped },
      }
    }

    // Personal
    const exp = mergeExpanders(profile.textExpanders ?? [], bundle.textExpanders ?? [])
    const sets = mergeOrderSets(profile.planOrderSets ?? [], bundle.planOrderSets ?? [])
    const tags = mergeOrderTags(profile.planOrderTags ?? EMPTY_TAGS, bundle.planOrderTags ?? EMPTY_TAGS)
    const instr = mergeStringList(profile.planInstructionTags ?? [], bundle.planInstructionTags ?? [])

    const fields: Record<string, unknown> = {}
    const local: Parameters<typeof updateProfile>[0] = {}
    if (exp.added) { local.textExpanders = exp.next; fields.text_expanders = exp.next }
    if (sets.added) { local.planOrderSets = sets.next; fields.plan_order_sets = sets.next }
    if (tags.added) { local.planOrderTags = tags.next; fields.plan_order_tags = tags.next }
    if (instr.added) { local.planInstructionTags = instr.next; fields.plan_instruction_tags = instr.next }
    if (Object.keys(local).length) {
      updateProfile(local)
      syncProfileField(fields)
    }

    return {
      added: { templates: exp.added, orderSets: sets.added, tags: tags.added + instr.added },
      skipped: { templates: exp.skipped, orderSets: sets.skipped, tags: tags.skipped + instr.skipped },
    }
  }, [
    canIngestToClinic, clinicTextExpanders, clinicPlanOrderSets, clinicPlanOrderTags, clinicPlanInstructionTags, updateClinic,
    profile.textExpanders, profile.planOrderSets, profile.planOrderTags, profile.planInstructionTags, updateProfile, syncProfileField,
  ])

  return { ingest, canIngestToClinic }
}

/** Human one-liner for an ingest result — e.g. "Added 4 · skipped 1 duplicate". */
export function summarizeIngest(r: IngestResult): string {
  const a = r.added.templates + r.added.orderSets + r.added.tags
  const s = r.skipped.templates + r.skipped.orderSets + r.skipped.tags
  if (a === 0 && s === 0) return 'Nothing to add'
  const addedPart = a === 0 ? 'Added nothing new' : `Added ${a}`
  return s > 0 ? `${addedPart} · skipped ${s} duplicate${s === 1 ? '' : 's'}` : addedPart
}
