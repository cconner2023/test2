import { useState, useEffect, useCallback, useRef } from 'react'
import { Building2, MapPin, Trash2, UserPlus } from 'lucide-react'
import bwipjs from 'bwip-js'
import { TextInput } from '../../FormInputs'
import { ErrorDisplay } from '../../ErrorDisplay'
import { ConfirmDialog } from '../../ConfirmDialog'
import { UserAvatar } from '../UserAvatar'
import { ActionIconButton } from '../../WriteNoteHelpers'
import {
  updateSupervisorClinic,
  listClinicMembers,
  removeClinicMember,
  getClinicEncryptionKey,
  type ClinicMember,
} from '../../../lib/supervisorService'
import type { ClinicMedic } from '../../../Types/SupervisorTestTypes'

interface ClinicDetailProps {
  clinicId: string
  clinicName: string
  clinicUics: string[]
  clinicLocation: string | null
  activeCode: string | null
  medics: ClinicMedic[]
  editing: boolean
  onEditingChange: (editing: boolean) => void
  onAddMember: () => void
  onClinicUpdated: () => void
  saveRequested: boolean
  onSaveComplete: () => void
}

export function ClinicDetail({
  clinicId,
  clinicName,
  clinicUics,
  clinicLocation,
  activeCode,
  medics,
  editing,
  onEditingChange,
  onAddMember,
  onClinicUpdated,
  saveRequested,
  onSaveComplete,
}: ClinicDetailProps) {
  const [editName, setEditName] = useState(clinicName)
  const [editLocation, setEditLocation] = useState('')
  const [editUics, setEditUics] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [members, setMembers] = useState<ClinicMember[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [copied, setCopied] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // ─── QR Rendering ──────────────────────────────────────────────────

  useEffect(() => {
    if (!activeCode || !canvasRef.current) return
    try {
      bwipjs.toCanvas(canvasRef.current, {
        bcid: 'qrcode',
        text: activeCode,
        scale: 3,
        padding: 2,
      })
    } catch {
      // QR render failure is non-critical
    }
  }, [activeCode])

  // ─── Edit state initialization ─────────────────────────────────────

  useEffect(() => {
    if (editing) {
      setEditName(clinicName)
      setEditLocation(clinicLocation ?? '')
      setEditUics(clinicUics.join(', '))
      setError(null)
      setSuccess(null)
    }
  }, [editing, clinicName, clinicLocation, clinicUics])

  // ─── Load members ──────────────────────────────────────────────────

  const loadMembers = useCallback(async () => {
    setMembersLoading(true)
    const result = await listClinicMembers(clinicId)
    if (result.success) {
      setMembers(result.members)
    }
    setMembersLoading(false)
  }, [clinicId])

  useEffect(() => { loadMembers() }, [loadMembers])

  // ─── Save clinic changes ──────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!editName.trim()) {
      setError('Clinic name is required')
      return
    }
    setSaving(true)
    setError(null)

    const encKey = await getClinicEncryptionKey(clinicId)
    const uicsArray = editUics
      .split(',')
      .map(u => u.trim().toUpperCase())
      .filter(Boolean)

    const result = await updateSupervisorClinic(
      clinicId,
      {
        name: editName.trim(),
        location: editLocation.trim() || null,
        uics: uicsArray.length > 0 ? uicsArray : undefined,
      },
      encKey
    )

    setSaving(false)
    if (result.success) {
      onEditingChange(false)
      setSuccess('Clinic updated')
      setTimeout(() => setSuccess(null), 3000)
      onClinicUpdated()
    } else {
      setError(result.error)
    }
  }, [clinicId, editName, editLocation, editUics, onEditingChange, onClinicUpdated])

  useEffect(() => {
    if (saveRequested) {
      handleSave()
      onSaveComplete()
    }
  }, [saveRequested, handleSave, onSaveComplete])

  // ─── Delete member ────────────────────────────────────────────────

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return
    setDeleting(true)
    setError(null)

    const result = await removeClinicMember(clinicId, deleteTarget)
    setDeleting(false)

    if (result.success) {
      setMembers(prev => prev.filter(m => m.id !== deleteTarget))
      setSuccess('Member removed')
      setTimeout(() => setSuccess(null), 3000)
    } else {
      setError(result.error)
    }
    setDeleteTarget(null)
  }, [deleteTarget, clinicId])

  // ─── Copy invite code ─────────────────────────────────────────────

  const handleCopy = useCallback(async () => {
    if (!activeCode) return
    await navigator.clipboard.writeText(activeCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [activeCode])

  const displayMembers = members.length > 0 ? members : null
  const memberCount = displayMembers ? displayMembers.length : medics.length

  return (
    <div className="space-y-4">
      {error && <ErrorDisplay message={error} />}
      {success && <ErrorDisplay message={success} variant="success" />}

      {/* ── Clinic Identity Card ──────────────────────────────────── */}
      <div className="rounded-xl bg-themewhite2 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-tertiary/10">
            <Building2 size={18} className="text-tertiary/50" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-primary truncate">{clinicName}</p>
            <p className="text-[9pt] text-tertiary/50">{memberCount} personnel</p>
          </div>
        </div>

        {/* Read-mode: UICs + Location */}
        {!editing && (clinicUics.length > 0 || clinicLocation) && (
          <div className="mt-3 pt-3 border-t border-tertiary/10 space-y-2">
            {clinicUics.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {clinicUics.map(uic => (
                  <span
                    key={uic}
                    className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium border bg-themeyellow/10 text-themeyellow border-themeyellow/30"
                  >
                    {uic}
                  </span>
                ))}
              </div>
            )}
            {clinicLocation && (
              <div className="flex items-center gap-1.5 text-[10pt] text-tertiary/60">
                <MapPin size={12} />
                <span>{clinicLocation}</span>
              </div>
            )}
          </div>
        )}

        {/* Read-mode: QR invite code */}
        {!editing && activeCode && (
          <div className="mt-3 pt-3 border-t border-tertiary/10">
            <div className="flex items-center gap-3">
              <div className="bg-white rounded-lg p-1.5 shrink-0">
                <canvas ref={canvasRef} className="w-20 h-20" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-mono tracking-[0.3em] text-tertiary/70 select-all">
                  {activeCode}
                </span>
                <ActionIconButton
                  onClick={handleCopy}
                  status={copied ? 'done' : 'idle'}
                  variant="copy"
                  title="Copy invite code"
                />
              </div>
            </div>
          </div>
        )}

        {/* Edit mode: inline form */}
        {editing && (
          <div className="mt-4 pt-3 border-t border-tertiary/10 space-y-3">
            <TextInput label="Clinic Name" value={editName} onChange={setEditName} required />
            <TextInput label="Location" value={editLocation} onChange={setEditLocation} placeholder="Building / Room" />
            <TextInput
              label="UICs (comma-separated)"
              value={editUics}
              onChange={(v) => setEditUics(v.toUpperCase())}
              placeholder="W0ABCD, W0EFGH"
            />
          </div>
        )}
      </div>

      {/* ── Personnel Section ─────────────────────────────────────── */}
      <div className="rounded-xl bg-themewhite2 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-primary">Personnel</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-tertiary/10 text-tertiary/70 font-medium">
              {memberCount}
            </span>
          </div>
          <button
            type="button"
            onClick={onAddMember}
            className="p-1.5 rounded-lg hover:bg-tertiary/10 text-tertiary/40 hover:text-themeblue3 transition-colors active:scale-95"
          >
            <UserPlus size={14} />
          </button>
        </div>

        <div className="px-4 pb-3">
          {membersLoading ? (
            <div className="flex items-center justify-center py-6">
              <div className="w-4 h-4 border-2 border-themeblue3 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : displayMembers ? (
            <div className="space-y-1">
              {displayMembers.map(member => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 py-2 px-2 rounded-lg transition-colors hover:bg-secondary/5"
                >
                  <UserAvatar
                    avatarId={member.avatar_id}
                    firstName={member.first_name}
                    lastName={member.last_name}
                    className="w-8 h-8"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-primary truncate">
                      {member.rank && <span className="text-tertiary/50">{member.rank} </span>}
                      {member.last_name}, {member.first_name}
                      {member.middle_initial ? ` ${member.middle_initial}.` : ''}
                    </p>
                    <p className="text-[10px] text-tertiary/50 truncate">
                      {[member.credential, member.uic].filter(Boolean).join(' \u00B7 ') || member.email}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(member.id)}
                    className="p-1 shrink-0 text-tertiary/30 hover:text-themeredred transition-colors active:scale-95"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-1">
              {medics.map(m => (
                <div
                  key={m.id}
                  className="flex items-center gap-3 py-2 px-2 rounded-lg transition-colors hover:bg-secondary/5"
                >
                  <UserAvatar avatarId={m.avatarId} firstName={m.firstName} lastName={m.lastName} className="w-8 h-8" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-primary truncate">
                      {m.rank && <span className="text-tertiary/50">{m.rank} </span>}
                      {m.lastName}, {m.firstName}
                    </p>
                    {m.credential && <p className="text-[10px] text-tertiary/50 truncate">{m.credential}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(m.id)}
                    className="p-1 shrink-0 text-tertiary/30 hover:text-themeredred transition-colors active:scale-95"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {medics.length === 0 && (
                <p className="text-sm text-tertiary/50 py-4 text-center">No members assigned</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Delete Confirmation ───────────────────────────────────── */}
      <ConfirmDialog
        visible={deleteTarget !== null}
        title="Remove this member from the clinic?"
        confirmLabel="Remove"
        variant="danger"
        processing={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
