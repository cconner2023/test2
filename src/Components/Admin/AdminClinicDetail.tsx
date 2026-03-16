/**
 * AdminClinicDetail.tsx
 *
 * Displays the full detail view for a single clinic as a styled card,
 * followed by a responsive grid of user cards for all assigned and
 * additional users. Edit and delete are handled by AdminDrawer header.
 */

import { useEffect, useCallback, useMemo, useState } from 'react'
import { MapPin, Building2 } from 'lucide-react'
import { UserAvatar } from '../Settings/UserAvatar'
import { listClinics, listAllUsers } from '../../lib/adminService'
import type { AdminUser, AdminClinic } from '../../lib/adminService'
import { fetchAllCertifications } from '../../lib/certificationService'
import type { Certification } from '../../Data/User'
import {
  formatLastActive,
  lastActiveColor,
  RoleBadge,
} from './adminUtils'

interface AdminClinicDetailProps {
  clinic: AdminClinic
  onClinicUpdated: (clinic: AdminClinic) => void
  onSelectUser?: (user: AdminUser) => void
}

const AdminClinicDetail = ({ clinic, onClinicUpdated, onSelectUser }: AdminClinicDetailProps) => {
  const [clinics, setClinics] = useState<AdminClinic[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [allCerts, setAllCerts] = useState<Certification[]>([])

  /** Load clinics, users, and certifications. */
  const loadData = useCallback(async () => {
    const [fetchedClinics, fetchedUsers, certData] = await Promise.all([
      listClinics(),
      listAllUsers(),
      fetchAllCertifications(),
    ])
    setClinics(fetchedClinics)
    setUsers(fetchedUsers)
    setAllCerts(certData)

    // Keep parent in sync with latest clinic data
    const refreshed = fetchedClinics.find((c) => c.id === clinic.id)
    if (refreshed) onClinicUpdated(refreshed)
  }, [clinic.id, onClinicUpdated])

  useEffect(() => {
    loadData()
  }, [loadData])

  /** Users whose clinic_id matches this clinic. */
  const assignedUsers = useMemo(
    () => users.filter((u) => u.clinic_id === clinic.id),
    [users, clinic.id],
  )

  /** Users referenced by additional_user_ids (resolved from full user list). */
  const additionalUsers = useMemo(
    () => users.filter((u) => clinic.additional_user_ids.includes(u.id)),
    [users, clinic.additional_user_ids],
  )

  /** All users to show in the grid (assigned + additional, deduplicated). */
  const allClinicUsers = useMemo(() => {
    const seen = new Set<string>()
    const result: AdminUser[] = []
    for (const u of [...assignedUsers, ...additionalUsers]) {
      if (!seen.has(u.id)) {
        seen.add(u.id)
        result.push(u)
      }
    }
    return result
  }, [assignedUsers, additionalUsers])

  /** Certifications grouped by user_id for O(1) lookup */
  const certsByUser = useMemo(() => {
    const map = new Map<string, Certification[]>()
    for (const cert of allCerts) {
      const arr = map.get(cert.user_id) || []
      arr.push(cert)
      map.set(cert.user_id, arr)
    }
    return map
  }, [allCerts])

  return (
    <>
      {/* ── Clinic card ─────────────────────────────────────────── */}
      <div className="rounded-xl border border-tertiary/15 bg-themewhite2 px-4 py-3.5 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-tertiary/10">
            <Building2 size={18} className="text-tertiary/50" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-primary truncate">{clinic.name}</p>
            {clinic.location && (
              <p className="text-[9pt] text-tertiary/50 flex items-center gap-1">
                <MapPin size={10} /> {clinic.location}
              </p>
            )}
          </div>

          <span className="shrink-0 px-2 py-0.5 rounded text-[9px] font-medium border bg-themeblue2/10 text-themeblue2 border-themeblue2/30">
            {assignedUsers.length} user{assignedUsers.length !== 1 ? 's' : ''}
          </span>
        </div>

        {clinic.uics.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 mt-2">
            {clinic.uics.map((uic) => (
              <span
                key={uic}
                className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium border bg-themeyellow/10 text-themeyellow border-themeyellow/30"
              >
                {uic}
              </span>
            ))}
          </div>
        )}

        {clinic.child_clinic_ids.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 mt-2">
            {clinic.child_clinic_ids.map((cid) => {
              const child = clinics.find((c) => c.id === cid)
              return (
                <span key={cid} className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium border bg-themeblue2/10 text-themeblue2 border-themeblue2/30">
                  {child ? child.name : cid.slice(0, 8)}
                </span>
              )
            })}
          </div>
        )}
      </div>

      {/* ── User cards grid ─────────────────────────────────────── */}
      {allClinicUsers.length > 0 && (
        <>
          <p className="text-xs text-tertiary/50 mb-2">
            {allClinicUsers.length} member{allClinicUsers.length !== 1 ? 's' : ''}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {allClinicUsers.map((user) => {
              const userCerts = certsByUser.get(user.id) || []
              const isAdditional = clinic.additional_user_ids.includes(user.id) && user.clinic_id !== clinic.id

              return (
                <div
                  key={user.id}
                  className="rounded-xl border border-tertiary/15 bg-themewhite2 px-4 py-3.5 space-y-2 cursor-pointer active:scale-95 transition-transform"
                  onClick={() => onSelectUser?.(user)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') onSelectUser?.(user) }}
                >
                  {/* Row 1: Avatar + name + credential (inline) + last active + roles (condensed) */}
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      avatarId={user.avatar_id}
                      firstName={user.first_name}
                      lastName={user.last_name}
                      className="w-9 h-9"
                    />

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-primary truncate">
                        {user.first_name || ''} {user.middle_initial || ''}{' '}
                        {user.last_name || ''}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Primary + extra certs inline as text */}
                        {(user.credential || userCerts.filter(c => !c.is_primary).length > 0) && (
                          <p className="text-[9pt] text-tertiary/50 truncate">
                            {[
                              user.credential,
                              ...userCerts.filter(c => !c.is_primary).map(c => c.title),
                            ].filter(Boolean).join(' · ')}
                          </p>
                        )}
                        <span className="flex items-center gap-1 text-[9pt] text-tertiary/50 shrink-0">
                          <span
                            className={`inline-block w-1.5 h-1.5 rounded-full ${lastActiveColor(user.last_active_at)}`}
                          />
                          {formatLastActive(user.last_active_at)}
                        </span>
                      </div>
                    </div>

                    {/* Condensed 1-letter role badges, flex-wrap */}
                    <div className="flex flex-wrap gap-0.5 shrink-0 max-w-[48px] justify-end">
                      {user.roles?.map((role) => (
                        <RoleBadge key={role} role={role} />
                      ))}
                    </div>
                  </div>

                  {/* UIC badge — themeblue2 matching initials avatar */}
                  {(user.uic || isAdditional) && (
                    <div className="flex items-center gap-1">
                      {user.uic && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium border bg-themeblue2/10 text-themeblue2 border-themeblue2/30">
                          {user.uic}
                        </span>
                      )}
                      {isAdditional && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium border bg-tertiary/10 text-tertiary border-tertiary/30">
                          additional
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {allClinicUsers.length === 0 && (
        <div className="text-center py-8">
          <p className="text-tertiary/60 text-sm">No users assigned to this clinic</p>
        </div>
      )}
    </>
  )
}

export default AdminClinicDetail
