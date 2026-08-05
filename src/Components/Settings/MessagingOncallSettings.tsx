import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../Hooks/useAuth'
import { useBetaBypass } from '../../lib/betaFeatures'
import { listLineOncallRosters, type LineOncallSummary } from '../../lib/oncallService'
import {
  getWarmRoster, setWarmRoster,
  getWarmLineRosters, setWarmLineRosters,
} from '../../lib/messagingSettingsWarm'
import { IntakeMintSection } from './IntakeMintSection'
import { LineOncallRow } from './LineOncallRow'
import { PageSectionHeader, SectionCard } from '@/Components/primitives/Section'

/**
 * Messaging-settings on-call surface.
 *
 *   Supervisor (or dev): the full IntakeMintSection (Outside contact) card —
 *     mint / QR / rotate / kill plus the per-line channel masters.
 *   Everyone: the duty list — one row per line that has a live outside channel,
 *     each opening that line's roster.
 *
 * The roster used to be flat: every cluster member with an on-call toggle, under
 * one "On-call" header. That shape predates lines, and it could not be right once
 * a cluster ran several — the push fan narrows clinics.oncall to the line the
 * contact arrived on, so "on-call" has no cluster-wide meaning to toggle. Presence
 * is still stored once per cluster and still mutually editable by any member
 * (GATE 3); only the lens is per line. The rows are membership-gated, not
 * supervisor-gated, which is why they read through list_line_oncall_rosters rather
 * than the passcode-bearing supervisor list.
 */
export function MessagingOncallSettings() {
  const { user, clinicId: assignedClinicId, supervisingClinicId, isSupervisorRole } = useAuth()
  const outsideCallBeta = useBetaBypass('outsideCall')
  const clinicId = supervisingClinicId ?? assignedClinicId
  const userId = user?.id ?? null

  const [lineRosters, setLineRosters] = useState<LineOncallSummary[]>(() => getWarmLineRosters(clinicId) ?? [])
  // clinics.oncall (public SELECT) — only for the "you are on duty" banner. The
  // per-line rows read their own scoped slice.
  const [oncall, setOncall] = useState<string[]>(() => getWarmRoster(clinicId) ?? [])

  const loadLines = useCallback(async () => {
    if (!clinicId) { setLineRosters([]); return }
    const res = await listLineOncallRosters(clinicId)
    if (!res.ok) return
    setLineRosters(res.data)
    setWarmLineRosters(clinicId, res.data)
  }, [clinicId])

  const loadSelf = useCallback(async () => {
    if (!clinicId) { setOncall([]); return }
    const { data } = await supabase.from('clinics').select('oncall').eq('id', clinicId).maybeSingle()
    const roster = ((data as { oncall?: string[] } | null)?.oncall) ?? []
    setOncall(roster)
    setWarmRoster(clinicId, roster)
  }, [clinicId])

  const refresh = useCallback(() => { void loadLines(); void loadSelf() }, [loadLines, loadSelf])

  useEffect(() => { refresh() }, [refresh])

  // Both channels ping clinics.oncall, so a line matters for duty if either is on.
  const dutyLines = lineRosters.filter((l) => l.oncallEnabled || l.messageEnabled)
  const selfOnCall = !!(userId && oncall.includes(userId))

  return (
    <>
      {/* ── Outside contact (supervisor + dev-beta) ──────────────────── */}
      {(isSupervisorRole || outsideCallBeta) && clinicId && (
        <IntakeMintSection clinicId={clinicId} onLinesChanged={refresh} />
      )}

      {/* ── Duty, per line (everyone) ────────────────────────────────── */}
      {dutyLines.length > 0 && (
        <section>
          <PageSectionHeader>On-call</PageSectionHeader>

          {selfOnCall && (
            <div className="mb-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-themegreen/10 border border-themegreen/20">
              <span className="w-2 h-2 rounded-full bg-themegreen animate-pulse shrink-0" />
              <p className="text-[10pt] font-medium text-themegreen">You are ON-CALL for outside callers.</p>
            </div>
          )}

          <SectionCard>
            {dutyLines.map((line, i) => (
              <LineOncallRow
                key={line.id}
                credentialId={line.id}
                label={line.name}
                memberCount={line.memberCount}
                oncallCount={line.oncallCount}
                divided={i > 0}
                onChanged={refresh}
              />
            ))}
          </SectionCard>
        </section>
      )}
    </>
  )
}
