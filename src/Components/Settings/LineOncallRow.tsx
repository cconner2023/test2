import { useState, useCallback, useRef, useEffect } from 'react'
import { Radio, ChevronRight } from 'lucide-react'
import { PreviewOverlay } from '../PreviewOverlay'
import { SettingsRow } from './SettingsToggleRow'
import { ToggleSwitch } from './ToggleSwitch'
import { UserAvatar } from './UserAvatar'
import { useClinicMedics } from '../../Hooks/useClinicMedics'
import {
  getLineOncallRoster,
  toggleOncallPresence,
  type LineOncallRoster,
} from '../../lib/oncallService'

interface Props {
  /** The line whose scope the roster is read through. */
  credentialId: string
  /** Row label — "On-call" inside a line card, the line's name in the member list. */
  label: string
  /** Server counts for the closed row. The sheet keeps its own once opened. */
  memberCount: number
  oncallCount: number
  divided?: boolean
  indent?: boolean
  /** Refetch the parent's counts after a presence change. */
  onChanged?: () => void
}

/**
 * Duty roster FOR ONE LINE.
 *
 * Presence itself is cluster-wide and shared (clinics.oncall, mutual toggle, sticky
 * — GATE 3), but it only ever fires through a line: the push fan intersects the
 * roster with the line's routing scope before ringing anyone. So the roster is
 * never shown flat. The row reports "N of M", and the sheet lists only the members
 * this line addresses.
 *
 * Membership-gated on purpose. The surrounding line card is supervisor-only because
 * it carries the passcode; duty is not a supervisor decision, so the sheet reads and
 * writes through RPCs that ask for cluster membership and nothing more.
 */
export function LineOncallRow({
  credentialId, label, memberCount, oncallCount, divided, indent, onChanged,
}: Props) {
  const { medics } = useClinicMedics()

  const [anchor, setAnchor] = useState<DOMRect | null>(null)
  const [roster, setRoster] = useState<LineOncallRoster | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const rowRef = useRef<HTMLButtonElement | null>(null)

  // Server counts lead until the sheet has been opened; after that the sheet's own
  // roster is the fresher truth (the parent refetch may not have landed yet).
  const shownOn = roster ? roster.oncallIds.length : oncallCount
  const shownTotal = roster ? roster.memberIds.length : memberCount

  const load = useCallback(async () => {
    const res = await getLineOncallRoster(credentialId)
    if (res.ok) { setRoster(res.data); setError(null) }
    else setError(res.error)
  }, [credentialId])

  // Drop a stale roster when the row is pointed at a different line.
  useEffect(() => { setRoster(null) }, [credentialId])

  const open = useCallback(() => {
    setError(null)
    if (rowRef.current) setAnchor(rowRef.current.getBoundingClientRect())
    void load()
  }, [load])

  const toggleMember = useCallback(async (memberId: string) => {
    if (!roster || pending) return
    const isOn = roster.oncallIds.includes(memberId)
    setPending(memberId)
    setRoster((prev) => prev && ({
      ...prev,
      oncallIds: isOn
        ? prev.oncallIds.filter((id) => id !== memberId)
        : [...prev.oncallIds, memberId],
    }))
    const res = await toggleOncallPresence(roster.clinicId, memberId, !isOn)
    if (!res.ok) await load()   // revert to server truth
    else onChanged?.()
    setPending(null)
  }, [roster, pending, load, onChanged])

  return (
    <>
      <SettingsRow
        ref={rowRef}
        icon={Radio}
        label={label}
        subtitle={shownTotal === 0
          ? 'No one in scope'
          : `${shownOn} of ${shownTotal} on duty`}
        on={shownOn > 0}
        onColor="text-themegreen"
        onBg="bg-themegreen/15"
        onClick={open}
        divided={divided}
        indent={indent}
        trailing={<ChevronRight size={16} className="text-tertiary shrink-0" />}
      />

      <PreviewOverlay
        isOpen={!!anchor}
        onClose={() => setAnchor(null)}
        anchorRect={anchor}
        title={label}
        maxWidth={360}
      >
        <div className="px-3 py-2">
          {error && <p className="text-[10pt] text-themeredred px-1 pb-2">{error}</p>}

          {roster == null && !error && (
            <p className="text-[10pt] text-tertiary py-4 text-center">Loading…</p>
          )}

          {roster != null && roster.memberIds.length === 0 && (
            <p className="text-[10pt] text-tertiary py-4 text-center">
              This line addresses no one — edit its routing first.
            </p>
          )}

          {roster?.memberIds.map((id) => {
            const member = medics.find((m) => m.id === id)
            const isOn = roster.oncallIds.includes(id)
            return (
              <div key={id} className="flex items-center gap-3 py-2 px-2">
                <UserAvatar
                  avatarId={member?.avatarId ?? null}
                  firstName={member?.firstName ?? ''}
                  lastName={member?.lastName ?? ''}
                  className="w-8 h-8"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[10pt] font-medium truncate text-primary">
                    {member
                      ? `${member.rank ? `${member.rank} ` : ''}${member.lastName}, ${member.firstName}${member.middleInitial ? ` ${member.middleInitial}.` : ''}`
                      : 'Cluster member'}
                  </p>
                  {member?.credential && (
                    <p className="text-[9pt] text-tertiary truncate">{member.credential}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void toggleMember(id)}
                  disabled={pending === id}
                  aria-label={isOn ? 'On duty' : 'Off duty'}
                  className={`shrink-0 active:scale-95 transition-all ${pending === id ? 'opacity-50' : ''}`}
                >
                  <ToggleSwitch checked={isOn} />
                </button>
              </div>
            )
          })}
        </div>
      </PreviewOverlay>
    </>
  )
}
