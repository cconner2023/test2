import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../Hooks/useAuth'
import { useBetaBypass } from '../../lib/betaFeatures'
import { useClinicMedics } from '../../Hooks/useClinicMedics'
import { useClinicGroupedMedics } from '../../Hooks/useClinicGroupedMedics'
import { toggleOncallPresence, getOutsideContactStatus } from '../../lib/oncallService'
import { IntakeMintSection } from './IntakeMintSection'
import { ToggleSwitch } from './ToggleSwitch'
import { UserAvatar } from './UserAvatar'

/**
 * Messaging-settings on-call surface — the clinic-management Outside-contact +
 * roster pair, lifted into the messaging settings popover.
 *
 *   Supervisor (or dev): the full IntakeMintSection (Outside contact) card —
 *     mint / QR / rotate / kill plus the GATE-2 "Allow calls" / "Allow text
 *     messaging" masters.
 *   Everyone: the On-call roster — every active-cluster member with a per-member
 *     on-call toggle. toggle_oncall_presence is a mutual toggle (any member may
 *     flip any member), so the whole roster is editable by anyone.
 *
 * Section headers use the calendar-settings style (text-tertiary, tracking-widest)
 * so the panel reads the same as Calendar Settings.
 */
export function MessagingOncallSettings() {
  const { user, clinicId: assignedClinicId, supervisingClinicId, isSupervisorRole } = useAuth()
  const outsideCallBeta = useBetaBypass('outsideCall')
  const clinicId = supervisingClinicId ?? assignedClinicId
  const userId = user?.id ?? null

  const { medics } = useClinicMedics()
  const { ownClinicMedics } = useClinicGroupedMedics(medics)

  // Live roster (clinics.oncall — public SELECT). Writes go through the
  // SECURITY DEFINER toggle_oncall_presence RPC (validates cluster membership).
  const [oncall, setOncall] = useState<string[]>([])
  const [pending, setPending] = useState<string | null>(null)

  // The roster only makes sense once an outside channel (calls OR text) is on
  // for the cluster — otherwise being "on-call" pings nothing. Members read this
  // via the membership-gated status RPC; the supervisor's live master toggles
  // (IntakeMintSection → onOncallEnabledChange) override it without a refetch.
  const [outsideContactOn, setOutsideContactOn] = useState(false)

  useEffect(() => {
    if (!clinicId) { setOutsideContactOn(false); return }
    let cancelled = false
    getOutsideContactStatus(clinicId).then((res) => {
      if (cancelled || !res.ok) return
      setOutsideContactOn(res.data.oncall_enabled || res.data.outside_message_enabled)
    })
    return () => { cancelled = true }
  }, [clinicId])

  const loadRoster = useCallback(async () => {
    if (!clinicId) { setOncall([]); return }
    const { data } = await supabase.from('clinics').select('oncall').eq('id', clinicId).maybeSingle()
    setOncall(((data as { oncall?: string[] } | null)?.oncall) ?? [])
  }, [clinicId])

  useEffect(() => { void loadRoster() }, [loadRoster])

  const toggleMember = useCallback(async (memberId: string) => {
    if (!clinicId || pending) return
    const isOn = oncall.includes(memberId)
    setPending(memberId)
    setOncall((prev) => (isOn ? prev.filter((id) => id !== memberId) : [...prev, memberId])) // optimistic
    const res = await toggleOncallPresence(clinicId, memberId, !isOn)
    if (!res.ok) await loadRoster() // revert to server truth on failure
    setPending(null)
  }, [clinicId, pending, oncall, loadRoster])

  const selfOnCall = !!(userId && oncall.includes(userId))

  return (
    <>
      {/* ── Outside contact (supervisor + dev-beta) ──────────────────── */}
      {(isSupervisorRole || outsideCallBeta) && clinicId && (
        <IntakeMintSection
          clinicId={clinicId}
          oncallCount={oncall.length}
          onOncallEnabledChange={setOutsideContactOn}
        />
      )}

      {/* ── On-call roster (everyone) — only once an outside channel is on ── */}
      {outsideContactOn && (
      <section>
        <div className="pb-2 flex items-center gap-2">
          <p className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">On-call</p>
        </div>

        {selfOnCall && (
          <div className="mb-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-themegreen/10 border border-themegreen/20">
            <span className="w-2 h-2 rounded-full bg-themegreen animate-pulse shrink-0" />
            <p className="text-[10pt] font-medium text-themegreen">You are ON-CALL for outside callers.</p>
          </div>
        )}

        <div className="rounded-xl bg-themewhite2 overflow-hidden">
          <div className="px-4 py-3">
            {ownClinicMedics.length === 0 ? (
              <p className="text-[10pt] text-tertiary py-4 text-center">No cluster members</p>
            ) : (
              <div className="space-y-1">
                {ownClinicMedics.map((member) => {
                  const isOn = oncall.includes(member.id)
                  return (
                    <div
                      key={member.id}
                      className="w-full flex items-center gap-3 py-2 px-2 rounded-lg transition-all"
                    >
                      <UserAvatar
                        avatarId={member.avatarId}
                        firstName={member.firstName}
                        lastName={member.lastName}
                        className="w-8 h-8"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate text-primary">
                          {member.rank && <span>{member.rank} </span>}
                          {member.lastName}, {member.firstName}
                          {member.middleInitial ? ` ${member.middleInitial}.` : ''}
                        </p>
                        {member.credential && (
                          <p className="text-[9pt] text-tertiary truncate">{member.credential}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => void toggleMember(member.id)}
                        disabled={pending === member.id}
                        aria-label={isOn ? 'On-call' : 'Off-call'}
                        className={`shrink-0 active:scale-95 transition-all ${pending === member.id ? 'opacity-50' : ''}`}
                      >
                        <ToggleSwitch checked={isOn} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </section>
      )}
    </>
  )
}
