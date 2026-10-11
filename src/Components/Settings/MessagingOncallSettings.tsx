import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../Hooks/useAuth'
import { listLineOncallRosters, type LineOncallSummary } from '../../lib/oncallService'
import { getWarmLineRosters, setWarmLineRosters } from '../../lib/messagingSettingsWarm'
import { IntakeMintSection } from './IntakeMintSection'
import { LineOncallRow } from './LineOncallRow'
import { PageSectionHeader, SectionCard } from '@/Components/primitives/Section'

/**
 * Messaging-settings on-call surface.
 *
 *   Supervisor: the full IntakeMintSection (Outside contact) card —
 *     mint / QR / rotate / kill plus the per-line channel masters.
 *   Everyone else: the duty list — one row per line that has a live outside
 *     channel, each opening that line's roster. Supervisors skip it; each line
 *     card already carries the same On-call row.
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
  const { clinicId: assignedClinicId, supervisingClinicId, isSupervisorRole } = useAuth()
  const clinicId = supervisingClinicId ?? assignedClinicId

  const [lineRosters, setLineRosters] = useState<LineOncallSummary[]>(() => getWarmLineRosters(clinicId) ?? [])

  const loadLines = useCallback(async () => {
    if (!clinicId) { setLineRosters([]); return }
    const res = await listLineOncallRosters(clinicId)
    if (!res.ok) return
    setLineRosters(res.data)
    setWarmLineRosters(clinicId, res.data)
  }, [clinicId])

  const refresh = useCallback(() => { void loadLines() }, [loadLines])

  useEffect(() => { refresh() }, [refresh])

  // Both channels ping clinics.oncall, so a line matters for duty if either is on.
  const dutyLines = lineRosters.filter((l) => l.oncallEnabled || l.messageEnabled)
  // Each line card already carries its own On-call row, so whoever sees the cards
  // gets no separate duty list.
  const showLineCards = !!(isSupervisorRole && clinicId)

  return (
    <>
      {/* ── Outside contact (supervisor) ──────────────────── */}
      {showLineCards && clinicId && (
        <IntakeMintSection clinicId={clinicId} onLinesChanged={refresh} />
      )}

      {/* ── Duty, per line (members without the line cards) ──────────── */}
      {!showLineCards && dutyLines.length > 0 && (
        <section>
          <PageSectionHeader>On-call</PageSectionHeader>

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
