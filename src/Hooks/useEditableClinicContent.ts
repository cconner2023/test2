/**
 * Per-cluster editor for clinic-scoped note content (text expanders, plan tags,
 * order sets). Supervisors with surrogate clinics can edit content for any
 * cluster they're attached to — this hook abstracts whether the target is the
 * home clinic (cached in useAuthStore) or a surrogate (fetched on demand).
 *
 * Home writes also patch useAuthStore so the rest of the app picks them up.
 * Surrogate writes stay local — the editing user's runtime caches remain
 * pinned to their home clinic.
 */

import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '../stores/useAuthStore'
import {
  updateClinicNoteContent,
  getClinicNoteContent,
  type ClinicNoteContent,
} from '../lib/supervisorService'

const EMPTY: ClinicNoteContent = {
  textExpanders: [],
  planOrderTags: null,
  planInstructionTags: [],
  planOrderSets: [],
}

export function useEditableClinicContent(clinicId: string | null) {
  const homeClinicId = useAuthStore(s => s.clinicId)
  const homeTextExpanders = useAuthStore(s => s.clinicTextExpanders)
  const homePlanOrderTags = useAuthStore(s => s.clinicPlanOrderTags)
  const homePlanInstructionTags = useAuthStore(s => s.clinicPlanInstructionTags)
  const homePlanOrderSets = useAuthStore(s => s.clinicPlanOrderSets)

  const isHome = !!clinicId && clinicId === homeClinicId

  const [remote, setRemote] = useState<ClinicNoteContent>(EMPTY)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!clinicId || isHome) return
    let cancelled = false
    setLoading(true)
    getClinicNoteContent(clinicId).then(res => {
      if (cancelled) return
      if (res.ok) setRemote(res.data)
      else setRemote(EMPTY)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [clinicId, isHome])

  const content: ClinicNoteContent = isHome
    ? {
        textExpanders: homeTextExpanders,
        planOrderTags: homePlanOrderTags,
        planInstructionTags: homePlanInstructionTags ?? [],
        planOrderSets: homePlanOrderSets ?? [],
      }
    : remote

  const update = useCallback((partial: Partial<ClinicNoteContent>) => {
    if (!clinicId) return
    updateClinicNoteContent(clinicId, partial)
    if (isHome) {
      const next: Record<string, unknown> = {}
      if (partial.textExpanders !== undefined) next.clinicTextExpanders = partial.textExpanders
      if (partial.planOrderTags !== undefined) next.clinicPlanOrderTags = partial.planOrderTags
      if (partial.planInstructionTags !== undefined) next.clinicPlanInstructionTags = partial.planInstructionTags
      if (partial.planOrderSets !== undefined) next.clinicPlanOrderSets = partial.planOrderSets
      useAuthStore.setState(next)
    } else {
      setRemote(prev => ({
        textExpanders: partial.textExpanders ?? prev.textExpanders,
        planOrderTags: partial.planOrderTags !== undefined ? partial.planOrderTags : prev.planOrderTags,
        planInstructionTags: partial.planInstructionTags ?? prev.planInstructionTags,
        planOrderSets: partial.planOrderSets ?? prev.planOrderSets,
      }))
    }
  }, [clinicId, isHome])

  return { content, update, loading, isHome }
}
