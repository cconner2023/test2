import { useEffect, useState, useCallback } from 'react'
import { Check, Pencil, Trash2, Loader2 } from 'lucide-react'
import { PreviewOverlay } from '../PreviewOverlay'
import { ActionButton } from '../ActionButton'
import { ConfirmDialog } from '../ConfirmDialog'
import { ErrorPill } from '../ErrorPill'
import { PickerInput } from '../FormInputs'
import {
  getMemberProfile,
  updateMemberProfile,
  setMemberRoles,
  removeClinicMember,
  type MemberProfileData,
} from '../../lib/supervisorService'
import { invalidate } from '../../stores/useInvalidationStore'

type Role = 'medic' | 'supervisor' | 'provider'

interface MemberEditPopoverProps {
  isOpen: boolean
  anchorRect: DOMRect | null
  memberId: string | null
  clinicId: string | null
  /** Used if the live profile fetch fails — typically built from the roster row */
  fallbackProfile?: MemberProfileData
  onClose: () => void
  /** Called after rank/roles save succeeds OR after delete succeeds */
  onChanged: () => void
}

export function MemberEditPopover({
  isOpen,
  anchorRect,
  memberId,
  clinicId,
  fallbackProfile,
  onClose,
  onChanged,
}: MemberEditPopoverProps) {
  const [profile, setProfile] = useState<MemberProfileData | null>(null)
  const [loading, setLoading] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [rank, setRank] = useState('')
  const [roles, setRoles] = useState<Role[]>(['medic'])
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ranksByComponent, setRanksByComponent] = useState<Record<string, string[]> | null>(null)

  // Lazy-load rank tables on first open
  useEffect(() => {
    if (isOpen && !ranksByComponent) {
      import('../../Data/User').then((mod) => setRanksByComponent(mod.ranksByComponent))
    }
  }, [isOpen, ranksByComponent])

  // Fetch profile when popover opens
  useEffect(() => {
    if (!isOpen || !memberId) return
    setLoading(true)
    setEditMode(false)
    setError(null)
    getMemberProfile(memberId).then((result) => {
      const next: MemberProfileData = result.success
        ? {
            firstName: result.firstName,
            lastName: result.lastName,
            middleInitial: result.middleInitial,
            credential: result.credential,
            component: result.component,
            rank: result.rank,
            uic: result.uic,
            roles: result.roles,
          }
        : (fallbackProfile ?? {
            firstName: null,
            lastName: null,
            middleInitial: null,
            credential: null,
            component: null,
            rank: null,
            uic: null,
            roles: ['medic'],
          })
      setProfile(next)
      setRank(next.rank ?? '')
      setRoles((next.roles ?? ['medic']) as Role[])
      setLoading(false)
    })
  }, [isOpen, memberId, fallbackProfile])

  const handleClose = useCallback(() => {
    setEditMode(false)
    setSaving(false)
    setError(null)
    onClose()
  }, [onClose])

  const handleSave = useCallback(async () => {
    if (!memberId || !profile) return
    setSaving(true)
    setError(null)

    const rankChanged = (rank || null) !== (profile.rank ?? null)
    const origRoles = (profile.roles ?? ['medic']).slice().sort().join(',')
    const currRoles = roles.slice().sort().join(',')
    const rolesChanged = origRoles !== currRoles

    if (rankChanged) {
      const r = await updateMemberProfile(memberId, { rank: rank || undefined })
      if (!r.success) {
        setSaving(false)
        setError(r.error)
        return
      }
    }
    if (rolesChanged) {
      const r = await setMemberRoles(memberId, roles)
      if (!r.success) {
        setSaving(false)
        setError(r.error)
        return
      }
    }

    invalidate('users', 'clinics')
    setSaving(false)
    onChanged()
    handleClose()
  }, [memberId, profile, rank, roles, onChanged, handleClose])

  const handleConfirmDelete = useCallback(async () => {
    if (!memberId || !clinicId) return
    setSaving(true)
    setError(null)
    const r = await removeClinicMember(clinicId, memberId)
    setSaving(false)
    setConfirmDelete(false)
    if (!r.success) {
      setError(r.error)
      return
    }
    invalidate('users', 'clinics')
    onChanged()
    handleClose()
  }, [memberId, clinicId, onChanged, handleClose])

  const title = (() => {
    if (!profile) return ''
    const last = profile.lastName ?? ''
    const first = profile.firstName ?? ''
    const mi = profile.middleInitial ? ` ${profile.middleInitial}.` : ''
    return `${profile.rank ? profile.rank + ' ' : ''}${last}, ${first}${mi}`
  })()

  return (
    <>
      <PreviewOverlay
        isOpen={isOpen}
        onClose={handleClose}
        anchorRect={anchorRect}
        title={title}
        maxWidth={360}
        previewMaxHeight="55dvh"
        footer={
          isOpen && profile ? (
            <div className="flex gap-1 bg-themewhite rounded-2xl shadow-lg px-1.5 py-1.5">
              <ActionButton
                icon={editMode ? Check : Pencil}
                label={editMode ? (saving ? 'Saving…' : 'Save') : 'Edit'}
                variant={editMode ? (saving ? 'disabled' : 'success') : 'default'}
                onClick={() => {
                  if (editMode) handleSave()
                  else setEditMode(true)
                }}
              />
              <ActionButton
                icon={Trash2}
                label="Delete"
                variant="danger"
                onClick={() => setConfirmDelete(true)}
              />
            </div>
          ) : undefined
        }
      >
        {isOpen && (
          loading || !profile ? (
            <div className="flex items-center justify-center py-4 text-tertiary">
              <Loader2 size={14} className="animate-spin mr-2" />
              <span className="text-[10pt]">Loading…</span>
            </div>
          ) : (
            <div>
              {[
                { label: 'Credential', value: profile.credential || '—' },
                { label: 'Component', value: profile.component || '—' },
                { label: 'UIC', value: profile.uic || '—' },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between border-b border-primary/6 px-4 py-3">
                  <span className="text-[9pt] font-semibold text-tertiary uppercase tracking-widest w-20 shrink-0">{row.label}</span>
                  <span className="text-sm text-primary truncate ml-3">{row.value}</span>
                </div>
              ))}

              {/* Rank — editable in edit mode */}
              <div className="flex items-center justify-between gap-3 border-b border-primary/6 px-4 py-3">
                <span className="text-[9pt] font-semibold text-tertiary uppercase tracking-widest w-20 shrink-0">Rank</span>
                {editMode ? (
                  profile.component && ranksByComponent ? (
                    <div className="flex-1 min-w-0 max-w-[200px]">
                      <PickerInput
                        value={rank}
                        onChange={setRank}
                        options={ranksByComponent[profile.component] ?? []}
                        placeholder="Rank"
                      />
                    </div>
                  ) : (
                    <span className="text-[9pt] text-tertiary italic">component required</span>
                  )
                ) : (
                  <span className="text-sm text-primary truncate">{profile.rank || '—'}</span>
                )}
              </div>

              {/* Roles — editable in edit mode */}
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-[9pt] font-semibold text-tertiary uppercase tracking-widest w-20 shrink-0">Roles</span>
                {editMode ? (
                  <div className="flex items-center gap-3">
                    {(['supervisor', 'provider'] as const).map((role) => {
                      const has = roles.includes(role)
                      return (
                        <label key={role} className="flex items-center gap-1.5 cursor-pointer">
                          <span className="text-[10pt] text-primary capitalize">{role}</span>
                          <div
                            onClick={() => {
                              setRoles(has ? roles.filter((r) => r !== role) : [...roles, role])
                            }}
                            className={`relative w-9 h-5 shrink-0 rounded-full transition-colors duration-200 ${
                              has ? 'bg-themeblue3' : 'bg-tertiary/20'
                            }`}
                          >
                            <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                              has ? 'translate-x-4' : 'translate-x-0'
                            }`} />
                          </div>
                        </label>
                      )
                    })}
                  </div>
                ) : (
                  <span className="text-sm text-primary truncate capitalize">
                    {(profile.roles ?? ['medic']).join(', ')}
                  </span>
                )}
              </div>

              {error && (
                <div className="px-4 py-2">
                  <ErrorPill>{error}</ErrorPill>
                </div>
              )}
            </div>
          )
        )}
      </PreviewOverlay>

      <ConfirmDialog
        visible={confirmDelete}
        title="Remove this member?"
        subtitle="They will no longer be associated with this clinic."
        confirmLabel="Remove"
        variant="danger"
        processing={saving}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  )
}
