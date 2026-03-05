import { useState, useEffect, useCallback, useMemo } from 'react'
import { Check, X, UserPlus, Clock, Ban, Search, ChevronLeft, KeyRound, Pencil, Trash2, AlertTriangle, Plus, MapPin, Building2, CheckCircle, Star, LogOut } from 'lucide-react'
import type { Component, Certification } from '../../Data/User'
import { credentials, components, ranksByComponent } from '../../Data/User'
import { UserAvatar } from './UserAvatar'
import {
  getAllAccountRequests,
  approveAccountRequest,
  rejectAccountRequest,
  isDevUser,
  listAllUsers,
  createUser,
  resetUserPassword,
  updateUserProfile,
  addUserRole,
  removeUserRole,
  deleteUser,
  forceLogoutUser,
  listClinics,
  setUserClinic,
  createClinic,
  updateClinic,
  deleteClinic,
} from '../../lib/adminService'
import type { AdminUser, AdminClinic } from '../../lib/adminService'
import type { AccountRequest } from '../../lib/accountRequestService'
import { supabase } from '../../lib/supabase'
import {
  fetchAllCertifications,
  verifyCertification,
  unverifyCertification,
  updateCertification,
  adminAddCertification,
  adminDeleteCertification,
  syncPrimaryToProfile,
} from '../../lib/certificationService'
import type { CertInput } from '../../lib/certificationService'
import { UI_TIMING } from '../../Utilities/constants'
import { TextInput, SelectInput } from '../FormInputs'

/** Format a timestamp as a human-readable relative time string */
const formatLastActive = (isoString: string | null): string => {
  if (!isoString) return 'Never'
  const now = Date.now()
  const then = new Date(isoString).getTime()
  const diffMs = now - then
  if (diffMs < 0) return 'Just now'
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

/** Color class for the last-active indicator dot */
const lastActiveColor = (isoString: string | null): string => {
  if (!isoString) return 'bg-tertiary/30'
  const hrs = (Date.now() - new Date(isoString).getTime()) / 3_600_000
  if (hrs < 24) return 'bg-themegreen'
  if (hrs < 168) return 'bg-themeyellow'
  return 'bg-tertiary/40'
}

const RoleBadge = ({ role }: { role: string }) => {
  const colors: Record<string, string> = {
    medic: 'bg-themeblue2/10 text-themeblue2 border-themeblue2/30',
    supervisor: 'bg-themeyellow/10 text-themeyellow border-themeyellow/30',
    dev: 'bg-themepurple/10 text-themepurple border-themepurple/30',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${colors[role] || 'bg-tertiary/10 text-tertiary border-tertiary/30'}`}>
      {role}
    </span>
  )
}

// ─── Requests Tab (existing functionality) ────────────────────────────

const RequestsTab = () => {
  const [requests, setRequests] = useState<AccountRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [approvingId, setApprovingId] = useState<string | null>(null)

  const loadRequests = useCallback(async () => {
    setLoading(true)
    const data = await getAllAccountRequests(filter === 'all' ? undefined : filter)
    setRequests(data)
    setLoading(false)
  }, [filter])

  useEffect(() => { loadRequests() }, [loadRequests])

  const handleApprove = async (requestId: string) => {
    setProcessingId(requestId)
    const result = await approveAccountRequest(requestId)
    if (result.success) {
      setApprovingId(null)
      await loadRequests()
    } else {
      alert(`Failed to approve: ${result.error}`)
    }
    setProcessingId(null)
  }

  const handleReject = async (requestId: string) => {
    if (!rejectReason.trim()) {
      alert('Please provide a rejection reason')
      return
    }
    setProcessingId(requestId)
    const result = await rejectAccountRequest(requestId, rejectReason)
    if (result.success) {
      setRejectingId(null)
      setRejectReason('')
      await loadRequests()
    } else {
      alert(`Failed to reject: ${result.error}`)
    }
    setProcessingId(null)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-themeyellow/10 text-themeyellow border-themeyellow/30'
      case 'approved': return 'bg-themegreen/10 text-themegreen border-themegreen/30'
      case 'rejected': return 'bg-themeredred/10 text-themeredred border-themeredred/30'
      default: return 'bg-tertiary/10 text-tertiary border-tertiary/30'
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="text-tertiary/60">Loading...</div></div>
  }

  return (
    <>
      <p className="text-sm text-tertiary/60 mb-4">Review and approve account requests</p>

      <div className="flex gap-1 mb-4 p-0.5 bg-themewhite2 rounded-lg overflow-x-auto">
        {(['pending', 'approved', 'rejected', 'all'] as const).map((tab) => (
          <button
            key={tab} onClick={() => setFilter(tab)}
            className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap
              ${filter === tab ? 'bg-themeblue2 text-white shadow-sm' : 'text-tertiary/70 hover:text-primary'}`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {requests.length === 0 ? (
        <div className="text-center py-12">
          <Clock size={28} className="mx-auto mb-3 text-tertiary/30" />
          <p className="text-tertiary/60">No {filter !== 'all' ? filter : ''} requests found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => (
            <div key={request.id} className="p-4 rounded-lg border border-tertiary/10 bg-themewhite2">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-primary">
                      {request.first_name} {request.middle_initial} {request.last_name}
                    </h4>
                  </div>
                  <p className="text-sm text-tertiary/70">{request.email}</p>
                </div>
                <div className="flex flex-col gap-1 items-end">
                  <span className={`px-2 py-1 rounded text-xs font-medium border ${
                    request.request_type === 'profile_change'
                      ? 'bg-themeblue2/10 text-themeblue2 border-themeblue2/30'
                      : 'bg-themepurple/10 text-themepurple border-themepurple/30'
                  }`}>
                    {request.request_type === 'profile_change' ? 'CHANGE' : 'NEW'}
                  </span>
                  <span className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(request.status)}`}>
                    {request.status.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                {request.credential && (
                  <div><span className="text-tertiary/60">Credential:</span> <span className="text-primary font-medium">{request.credential}</span></div>
                )}
                {request.rank && (
                  <div><span className="text-tertiary/60">Rank:</span> <span className="text-primary font-medium">{request.rank}</span></div>
                )}
                {request.component && (
                  <div><span className="text-tertiary/60">Component:</span> <span className="text-primary font-medium">{request.component}</span></div>
                )}
                <div><span className="text-tertiary/60">UIC:</span> <span className="text-primary font-medium">{request.uic}</span></div>
              </div>

              {request.notes && (
                <div className="mb-3 p-2 bg-themewhite rounded text-sm">
                  <span className="text-tertiary/60">Notes:</span> <span className="text-primary">{request.notes}</span>
                </div>
              )}

              <div className="text-xs text-tertiary/50 mb-3">
                Requested: {new Date(request.requested_at).toLocaleString()}
              </div>

              {request.status === 'pending' && (
                <div className="flex flex-col gap-2">
                  {approvingId === request.id ? (
                    <div className="p-3 bg-themegreen/10 rounded-lg">
                      <p className="text-sm text-themegreen font-medium mb-2">Create account and send setup email to {request.email}?</p>
                      <div className="flex gap-2">
                        <button onClick={() => handleApprove(request.id)}
                          disabled={processingId === request.id}
                          className="flex-1 px-3 py-2 rounded-lg bg-themegreen text-white text-sm font-medium hover:bg-themegreen/90 disabled:opacity-50">
                          {processingId === request.id ? 'Creating...' : 'Confirm & Send Email'}
                        </button>
                        <button onClick={() => setApprovingId(null)}
                          className="px-3 py-2 rounded-lg bg-tertiary/10 text-primary text-sm">Cancel</button>
                      </div>
                    </div>
                  ) : rejectingId === request.id ? (
                    <div className="flex gap-2">
                      <input type="text" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Rejection reason..."
                        className="flex-1 px-3 py-2 rounded-lg bg-themewhite border border-tertiary/10 text-sm" />
                      <button onClick={() => handleReject(request.id)} disabled={processingId === request.id}
                        className="px-3 py-2 rounded-lg bg-themeredred text-white text-sm font-medium hover:bg-themeredred/90 disabled:opacity-50">Confirm</button>
                      <button onClick={() => { setRejectingId(null); setRejectReason('') }}
                        className="px-3 py-2 rounded-lg bg-tertiary/10 text-primary text-sm">Cancel</button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={() => { setApprovingId(request.id); setRejectingId(null) }}
                        disabled={processingId === request.id}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-themegreen text-white font-medium hover:bg-themegreen/90 disabled:opacity-50 transition-colors">
                        <Check size={16} /> Approve
                      </button>
                      <button onClick={() => { setRejectingId(request.id); setApprovingId(null) }}
                        disabled={processingId === request.id}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-themeredred text-white font-medium hover:bg-themeredred/90 disabled:opacity-50 transition-colors">
                        <X size={16} /> Reject
                      </button>
                    </div>
                  )}
                </div>
              )}

              {request.status === 'approved' && (
                <div className="p-3 bg-themegreen/10 rounded-lg text-sm">
                  <div className="flex items-center gap-2 text-themegreen">
                    <UserPlus size={16} /><span className="font-medium">Account created — setup email sent</span>
                  </div>
                  <p className="text-themegreen text-xs mt-1">User will receive an email to set their password.</p>
                </div>
              )}

              {request.status === 'rejected' && request.rejection_reason && (
                <div className="p-3 bg-themeredred/10 rounded-lg text-sm">
                  <span className="text-themeredred font-medium">Reason:</span>
                  <p className="text-themeredred text-xs mt-1">{request.rejection_reason}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  )
}

// ─── Users Tab ────────────────────────────────────────────────────────

type UsersView = 'list' | 'detail' | 'create' | 'edit'

const UsersTab = () => {
  const [view, setView] = useState<UsersView>('list')
  const [users, setUsers] = useState<AdminUser[]>([])
  const [clinics, setClinics] = useState<AdminClinic[]>([])
  const [allCerts, setAllCerts] = useState<Certification[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)
  const [detailUser, setDetailUser] = useState<AdminUser | null>(null)

  // Current user ID (to prevent self-deletion)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Reset password inline state
  const [resetPwUserId, setResetPwUserId] = useState<string | null>(null)
  const [resetPwValue, setResetPwValue] = useState('')
  const [resetPwProcessing, setResetPwProcessing] = useState(false)
  const [resetPwSuccess, setResetPwSuccess] = useState<string | null>(null)

  // Delete user inline state
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null)
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('')
  const [deleteProcessing, setDeleteProcessing] = useState(false)

  // Force logout inline state
  const [forceLogoutProcessing, setForceLogoutProcessing] = useState<string | null>(null)

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    const [userData, clinicData, certData] = await Promise.all([listAllUsers(), listClinics(), fetchAllCertifications()])
    setUsers(userData)
    setClinics(clinicData)
    setAllCerts(certData)
    setLoading(false)
  }, [])

  useEffect(() => { loadUsers() }, [loadUsers])

  // Fetch current user ID once
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id)
    })
  }, [])

  // Sync detailUser with latest data after reload
  useEffect(() => {
    if (detailUser) {
      const updated = users.find((u) => u.id === detailUser.id)
      if (updated) setDetailUser(updated)
      else if (!loading) { setDetailUser(null); setView('list') }
    }
  }, [users]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDeleteUser = async (userId: string, expectedEmail: string) => {
    if (deleteConfirmEmail !== expectedEmail) return
    setDeleteProcessing(true)
    const result = await deleteUser(userId)
    setDeleteProcessing(false)
    if (result.success) {
      setDeleteUserId(null)
      setDeleteConfirmEmail('')
      setFeedback({ type: 'success', message: 'User deleted successfully' })
      await loadUsers()
    } else {
      setFeedback({ type: 'error', message: result.error || 'Failed to delete user' })
    }
  }

  const handleResetPassword = async (userId: string) => {
    if (resetPwValue.length < 12) return
    setResetPwProcessing(true)
    const result = await resetUserPassword(userId, resetPwValue)
    setResetPwProcessing(false)
    if (result.success) {
      setResetPwUserId(null)
      setResetPwValue('')
      setResetPwSuccess(userId)
      setTimeout(() => setResetPwSuccess(null), UI_TIMING.SAVE_ERROR_DURATION)
    } else {
      setFeedback({ type: 'error', message: result.error || 'Failed to reset password' })
    }
  }

  const handleForceLogout = async (userId: string) => {
    setForceLogoutProcessing(userId)
    const result = await forceLogoutUser(userId)
    setForceLogoutProcessing(null)
    if (result.success) {
      setFeedback({
        type: 'success',
        message: `Force logout complete: ${result.sessionsDeleted} session(s), ${result.devicesDeleted} device(s), ${result.bundlesDeleted} key bundle(s) cleared`,
      })
    } else {
      setFeedback({ type: 'error', message: result.error || 'Failed to force logout user' })
    }
  }

  const clinicMap = new Map(clinics.map((c) => [c.id, c]))

  // Group certs by user_id for quick lookup
  const certsByUser = useMemo(() => {
    const map = new Map<string, Certification[]>()
    for (const cert of allCerts) {
      const arr = map.get(cert.user_id) || []
      arr.push(cert)
      map.set(cert.user_id, arr)
    }
    return map
  }, [allCerts])

  const filteredUsers = users.filter((u) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      u.email?.toLowerCase().includes(q) ||
      u.first_name?.toLowerCase().includes(q) ||
      u.last_name?.toLowerCase().includes(q) ||
      u.uic?.toLowerCase().includes(q)
    )
  })

  // ─── Create User Form ────────────────────

  if (view === 'create') {
    return (
      <CreateUserForm
        onBack={() => setView('list')}
        onCreated={() => { setView('list'); loadUsers(); setFeedback({ type: 'success', message: 'User created successfully' }) }}
      />
    )
  }

  // ─── Edit User Form ──────────────────────

  if (view === 'edit' && editingUser) {
    return (
      <EditUserForm
        user={editingUser}
        clinics={clinics}
        onBack={() => {
          if (detailUser) { setView('detail'); setEditingUser(null) }
          else { setView('list'); setEditingUser(null) }
        }}
        onSaved={() => {
          setEditingUser(null)
          loadUsers()
          setFeedback({ type: 'success', message: 'Profile updated successfully' })
          if (detailUser) setView('detail')
          else setView('list')
        }}
      />
    )
  }

  // ─── User Detail View ────────────────────

  if (view === 'detail' && detailUser) {
    const userCerts = certsByUser.get(detailUser.id) || []
    return (
      <>
        <button onClick={() => { setView('list'); setDetailUser(null) }}
          className="flex items-center gap-1 text-sm text-themeblue2 mb-4 hover:underline">
          <ChevronLeft size={16} /> Back to user list
        </button>

        {feedback && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${
            feedback.type === 'success'
              ? 'bg-themegreen/10 border border-themegreen/20 text-themegreen'
              : 'bg-themeredred/10 border border-themeredred/20 text-themeredred'
          }`}>
            {feedback.message}
            <button onClick={() => setFeedback(null)} className="float-right text-xs opacity-60 hover:opacity-100">dismiss</button>
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <UserAvatar avatarId={detailUser.avatar_id} firstName={detailUser.first_name} lastName={detailUser.last_name} className="w-12 h-12" />
            <div>
              <h3 className="text-base font-semibold text-primary">
                {detailUser.first_name || ''} {detailUser.middle_initial || ''} {detailUser.last_name || ''}
              </h3>
              <p className="text-sm text-tertiary/70">{detailUser.email}</p>
            </div>
          </div>
          <div className="flex gap-1 flex-wrap justify-end">
            {detailUser.roles?.map((role) => <RoleBadge key={role} role={role} />)}
          </div>
        </div>

        {/* Metadata grid */}
        <div className="grid grid-cols-2 gap-2 text-sm mb-4">
          {detailUser.rank && (
            <div><span className="text-tertiary/60">Rank:</span> <span className="text-primary font-medium">{detailUser.rank}</span></div>
          )}
          {detailUser.credential && (
            <div><span className="text-tertiary/60">Credential:</span> <span className="text-primary font-medium">{detailUser.credential}</span></div>
          )}
          {detailUser.component && (
            <div><span className="text-tertiary/60">Component:</span> <span className="text-primary font-medium">{detailUser.component}</span></div>
          )}
          {detailUser.uic && (
            <div><span className="text-tertiary/60">UIC:</span> <span className="text-primary font-medium">{detailUser.uic}</span></div>
          )}
          {detailUser.clinic_id && clinicMap.has(detailUser.clinic_id) && (
            <div><span className="text-tertiary/60">Clinic:</span> <span className="text-primary font-medium">{clinicMap.get(detailUser.clinic_id)!.name}</span></div>
          )}
          <div>
            <span className="text-tertiary/60">Last Active:</span>{' '}
            <span className="inline-flex items-center gap-1 text-primary font-medium">
              <span className={`inline-block w-2 h-2 rounded-full ${lastActiveColor(detailUser.last_active_at)}`} />
              {formatLastActive(detailUser.last_active_at)}
            </span>
          </div>
        </div>

        {/* Reset password inline */}
        {resetPwUserId === detailUser.id ? (
          <div className="p-3 bg-themeyellow/10 rounded-lg mb-3">
            <p className="text-sm text-themeyellow font-medium mb-2">Set new password:</p>
            <div className="flex gap-2">
              <input type="text" value={resetPwValue} onChange={(e) => setResetPwValue(e.target.value)}
                placeholder="New password (min 12 chars)..."
                className="flex-1 px-3 py-2 rounded-lg bg-themewhite2 border border-themeyellow/30 text-sm" />
              <button onClick={() => handleResetPassword(detailUser.id)}
                disabled={resetPwProcessing || resetPwValue.length < 12}
                className="px-3 py-2 rounded-lg bg-themeyellow text-white text-sm font-medium hover:bg-themeyellow/90 disabled:opacity-50">
                {resetPwProcessing ? 'Resetting...' : 'Reset'}
              </button>
              <button onClick={() => { setResetPwUserId(null); setResetPwValue('') }}
                className="px-3 py-2 rounded-lg bg-tertiary/10 text-primary text-sm">Cancel</button>
            </div>
            {resetPwValue.length > 0 && resetPwValue.length < 12 && (
              <p className="text-xs text-themeredred mt-1">Password must be at least 12 characters</p>
            )}
          </div>
        ) : resetPwSuccess === detailUser.id ? (
          <div className="p-2 bg-themegreen/10 rounded-lg mb-3 text-sm text-themegreen font-medium">
            Password reset successfully
          </div>
        ) : null}

        {/* Delete user inline confirmation */}
        {deleteUserId === detailUser.id && (
          <div className="p-3 bg-themeredred/10 rounded-lg mb-3 border border-themeredred/20">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={16} className="text-themeredred shrink-0" />
              <p className="text-sm text-themeredred font-semibold">Permanently delete this user?</p>
            </div>
            <p className="text-xs text-themeredred mb-3">
              This will delete <span className="font-semibold">{detailUser.first_name} {detailUser.last_name}</span> and all
              associated data (notes, training, sync queue). This action cannot be undone.
            </p>
            <p className="text-xs text-themeredred mb-2">
              Type <span className="font-mono font-semibold bg-themeredred/10 px-1 py-0.5 rounded">{detailUser.email}</span> to confirm:
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={deleteConfirmEmail}
                onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                placeholder="Type email to confirm..."
                className="flex-1 px-3 py-2 rounded-lg bg-themewhite2 border border-themeredred/30 text-sm
                           focus:border-themeredred focus:outline-none transition-colors placeholder:text-tertiary/30"
                autoComplete="off"
              />
              <button
                onClick={() => handleDeleteUser(detailUser.id, detailUser.email)}
                disabled={deleteProcessing || deleteConfirmEmail !== detailUser.email}
                className="px-3 py-2 rounded-lg bg-themeredred text-white text-sm font-medium
                           hover:bg-themeredred/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {deleteProcessing ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={() => { setDeleteUserId(null); setDeleteConfirmEmail('') }}
                className="px-3 py-2 rounded-lg bg-tertiary/10 text-primary text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Certifications */}
        <UserCertsSection
          userId={detailUser.id}
          certs={userCerts}
          currentUserId={currentUserId}
          allUsers={users}
          onChanged={loadUsers}
        />

        {/* Action buttons */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => { setEditingUser(detailUser); setView('edit') }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-themeblue2 text-white text-sm font-medium hover:bg-themeblue2/90 transition-colors"
          >
            <Pencil size={14} /> Edit
          </button>
          <button
            onClick={() => { setResetPwUserId(detailUser.id); setResetPwValue(''); setResetPwSuccess(null) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-tertiary/10 text-primary text-sm font-medium hover:bg-tertiary/20 transition-colors"
          >
            <KeyRound size={14} /> Reset Password
          </button>
          {currentUserId !== detailUser.id && (
            <button
              onClick={() => handleForceLogout(detailUser.id)}
              disabled={forceLogoutProcessing === detailUser.id}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-themeyellow/10 text-themeyellow text-sm font-medium
                         hover:bg-themeyellow/20 border border-themeyellow/20 transition-colors disabled:opacity-50"
            >
              <LogOut size={14} /> {forceLogoutProcessing === detailUser.id ? 'Logging out...' : 'Force Logout'}
            </button>
          )}
          {currentUserId !== detailUser.id && (
            <button
              onClick={() => { setDeleteUserId(detailUser.id); setDeleteConfirmEmail(''); setResetPwUserId(null) }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-themeredred/10 text-themeredred text-sm font-medium
                         hover:bg-themeredred/20 border border-themeredred/20 transition-colors"
            >
              <Trash2 size={14} /> Delete
            </button>
          )}
        </div>
      </>
    )
  }

  // ─── User List View ──────────────────────

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-tertiary/60">Manage user accounts</p>
        <button
          onClick={() => setView('create')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-themegreen text-white text-sm font-medium hover:bg-themegreen/90 transition-colors"
        >
          <UserPlus size={14} /> Create User
        </button>
      </div>

      {feedback && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${
          feedback.type === 'success'
            ? 'bg-themegreen/10 border border-themegreen/20 text-themegreen'
            : 'bg-themeredred/10 border border-themeredred/20 text-themeredred'
        }`}>
          {feedback.message}
          <button onClick={() => setFeedback(null)} className="float-right text-xs opacity-60 hover:opacity-100">dismiss</button>
        </div>
      )}

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary/40" />
        <input
          type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name, email, or UIC..."
          className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-themewhite2 text-primary text-sm
                     border border-tertiary/10 focus:border-themeblue2 focus:outline-none transition-colors placeholder:text-tertiary/30"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><div className="text-tertiary/60">Loading users...</div></div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-tertiary/60">{searchQuery ? 'No users match your search' : 'No users found'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredUsers.map((user) => {
            const userCerts = certsByUser.get(user.id) || []
            return (
              <div
                key={user.id}
                onClick={() => { setDetailUser(user); setView('detail') }}
                className="rounded-xl px-4 py-3 bg-themewhite2 cursor-pointer hover:ring-1 hover:ring-themeblue2/30 transition-all space-y-2"
              >
                {/* Row 1: Avatar + Name + credential + last active + role badges */}
                <div className="flex items-center gap-3">
                  <UserAvatar avatarId={user.avatar_id} firstName={user.first_name} lastName={user.last_name} className="w-9 h-9" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-primary truncate">
                      {user.first_name || ''} {user.middle_initial || ''} {user.last_name || ''}
                    </p>
                    <div className="flex items-center gap-2">
                      {user.credential && (
                        <p className="text-[9pt] text-tertiary/50">{user.credential}</p>
                      )}
                      <span className="flex items-center gap-1 text-[9pt] text-tertiary/50">
                        <span className={`inline-block w-1.5 h-1.5 rounded-full ${lastActiveColor(user.last_active_at)}`} />
                        {formatLastActive(user.last_active_at)}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {user.roles?.map((role) => <RoleBadge key={role} role={role} />)}
                  </div>
                </div>
                {/* Row 2: Cert badges */}
                {userCerts.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1">
                    {userCerts.map((cert) => {
                      const status = getExpirationStatus(cert.exp_date)
                      const color = certBadgeColors[status]
                      return (
                        <span
                          key={cert.id}
                          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium border ${color}`}
                        >
                          {cert.title}
                          {cert.is_primary && <Star size={8} className="fill-current" />}
                          {cert.verified && <CheckCircle size={8} />}
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

// ─── Create User Form ─────────────────────────────────────────────────

const CreateUserForm = ({ onBack, onCreated }: { onBack: () => void; onCreated: () => void }) => {
  const [email, setEmail] = useState('')
  const [tempPassword, setTempPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [middleInitial, setMiddleInitial] = useState('')
  const [credential, setCredential] = useState('')
  const [component, setComponent] = useState('')
  const [rank, setRank] = useState('')
  const [uic, setUic] = useState('')
  const [roles, setRoles] = useState<Record<string, boolean>>({ medic: true, supervisor: false, dev: false })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const componentRanks = component ? ranksByComponent[component as Component] : []

  const handleComponentChange = (val: string) => {
    setComponent(val)
    if (val && rank && !ranksByComponent[val as Component]?.includes(rank)) setRank('')
  }

  const toggleRole = (role: string) => {
    setRoles((prev) => ({ ...prev, [role]: !prev[role] }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!email || !firstName || !lastName) {
      setError('Email, first name, and last name are required')
      return
    }
    if (tempPassword.length < 12) {
      setError('Temporary password must be at least 12 characters')
      return
    }

    const selectedRoles = Object.entries(roles)
      .filter(([, v]) => v)
      .map(([k]) => k) as ('medic' | 'supervisor' | 'dev')[]

    if (selectedRoles.length === 0) {
      setError('At least one role must be selected')
      return
    }

    setSubmitting(true)
    const result = await createUser({
      email,
      tempPassword,
      firstName,
      lastName,
      middleInitial: middleInitial || undefined,
      credential: credential || undefined,
      component: component || undefined,
      rank: rank || undefined,
      uic: uic || undefined,
      roles: selectedRoles,
    })
    setSubmitting(false)

    if (result.success) {
      onCreated()
    } else {
      setError(result.error || 'Failed to create user')
    }
  }

  return (
    <>
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-themeblue2 mb-4 hover:underline">
        <ChevronLeft size={16} /> Back to user list
      </button>

      <h3 className="text-base font-semibold text-primary mb-4">Create New User</h3>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-themeredred/10 border border-themeredred/20 text-themeredred text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <TextInput label="Email" value={email} onChange={setEmail} placeholder="user@mail.mil" type="email" required />
        <TextInput label="Temporary Password" value={tempPassword} onChange={setTempPassword} placeholder="Min 12 characters" required />

        <div className="grid grid-cols-2 gap-3">
          <TextInput label="First Name" value={firstName} onChange={setFirstName} required />
          <TextInput label="Last Name" value={lastName} onChange={setLastName} required />
        </div>

        <TextInput label="Middle Initial" value={middleInitial} onChange={(v) => setMiddleInitial(v.toUpperCase().slice(0, 1))} maxLength={1} />

        <SelectInput label="Credential" value={credential} onChange={setCredential} options={credentials} />
        <SelectInput label="Component" value={component} onChange={handleComponentChange} options={components} />
        {component && <SelectInput label="Rank" value={rank} onChange={setRank} options={componentRanks} />}
        <TextInput label="UIC" value={uic} onChange={(v) => setUic(v.toUpperCase())} maxLength={6} />

        <div>
          <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">Roles</span>
          <div className="flex gap-3 mt-2">
            {(['medic', 'supervisor', 'dev'] as const).map((role) => (
              <label key={role} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={roles[role]} onChange={() => toggleRole(role)}
                  className="w-4 h-4 rounded border-tertiary/30" />
                <span className="text-sm text-primary capitalize">{role}</span>
              </label>
            ))}
          </div>
        </div>

        <button type="submit" disabled={submitting}
          className="w-full px-4 py-3 rounded-lg bg-themegreen text-white font-medium hover:bg-themegreen/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          {submitting ? 'Creating User...' : 'Create User'}
        </button>
      </form>
    </>
  )
}

// ─── Edit User Form ───────────────────────────────────────────────────

const EditUserForm = ({ user, clinics, onBack, onSaved }: {
  user: AdminUser; clinics: AdminClinic[]; onBack: () => void; onSaved: () => void
}) => {
  const [firstName, setFirstName] = useState(user.first_name || '')
  const [lastName, setLastName] = useState(user.last_name || '')
  const [middleInitial, setMiddleInitial] = useState(user.middle_initial || '')
  const [credential, setCredential] = useState(user.credential || '')
  const [component, setComponent] = useState(user.component || '')
  const [rank, setRank] = useState(user.rank || '')
  const [uic, setUic] = useState(user.uic || '')
  const [selectedClinicId, setSelectedClinicId] = useState(user.clinic_id || '')
  const [roles, setRoles] = useState<Record<string, boolean>>({
    medic: user.roles?.includes('medic') ?? false,
    supervisor: user.roles?.includes('supervisor') ?? false,
    dev: user.roles?.includes('dev') ?? false,
  })
  const [noteIncludeHPI, setNoteIncludeHPI] = useState(user.note_include_hpi ?? true)
  const [noteIncludePE, setNoteIncludePE] = useState(user.note_include_pe ?? false)
  const [peDepth, setPeDepth] = useState(user.pe_depth ?? 'standard')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const componentRanks = component ? ranksByComponent[component as Component] : []

  const handleComponentChange = (val: string) => {
    setComponent(val)
    if (val && rank && !ranksByComponent[val as Component]?.includes(rank)) setRank('')
  }

  const toggleRole = (role: string) => {
    setRoles((prev) => ({ ...prev, [role]: !prev[role] }))
  }

  const handleSave = async () => {
    setError(null)

    const selectedRoles = Object.entries(roles).filter(([, v]) => v).map(([k]) => k)
    if (selectedRoles.length === 0) {
      setError('At least one role must be selected')
      return
    }

    setSaving(true)

    // Update profile fields
    const profileResult = await updateUserProfile(user.id, {
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      middleInitial,
      credential,
      component,
      rank,
      uic: uic || undefined,
      noteIncludeHPI: noteIncludeHPI,
      noteIncludePE: noteIncludePE,
      peDepth,
    })

    if (!profileResult.success) {
      setError(profileResult.error || 'Failed to update profile')
      setSaving(false)
      return
    }

    // Update roles — add new, remove old
    const oldRoles = new Set(user.roles || [])
    const newRoles = new Set(selectedRoles)

    for (const role of selectedRoles) {
      if (!oldRoles.has(role)) {
        const result = await addUserRole(user.id, role as 'medic' | 'supervisor' | 'dev')
        if (!result.success) {
          setError(`Failed to add role ${role}: ${result.error}`)
          setSaving(false)
          return
        }
      }
    }

    for (const role of user.roles || []) {
      if (!newRoles.has(role)) {
        const result = await removeUserRole(user.id, role as 'medic' | 'supervisor' | 'dev')
        if (!result.success) {
          setError(`Failed to remove role ${role}: ${result.error}`)
          setSaving(false)
          return
        }
      }
    }

    // Update clinic if changed
    const originalClinicId = user.clinic_id || ''
    if (selectedClinicId !== originalClinicId) {
      const clinicResult = await setUserClinic(user.id, selectedClinicId || null)
      if (!clinicResult.success) {
        setError(clinicResult.error || 'Failed to update clinic')
        setSaving(false)
        return
      }
    }

    setSaving(false)
    onSaved()
  }

  return (
    <>
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-themeblue2 mb-4 hover:underline">
        <ChevronLeft size={16} /> Back to user list
      </button>

      <h3 className="text-base font-semibold text-primary mb-1">Edit User</h3>
      <p className="text-sm text-tertiary/60 mb-4">{user.email}</p>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-themeredred/10 border border-themeredred/20 text-themeredred text-sm">{error}</div>
      )}

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <TextInput label="First Name" value={firstName} onChange={setFirstName} required />
          <TextInput label="Last Name" value={lastName} onChange={setLastName} required />
        </div>

        <TextInput label="Middle Initial" value={middleInitial} onChange={(v) => setMiddleInitial(v.toUpperCase().slice(0, 1))} maxLength={1} />

        <SelectInput label="Credential" value={credential} onChange={setCredential} options={credentials} />
        <SelectInput label="Component" value={component} onChange={handleComponentChange} options={components} />
        {component && <SelectInput label="Rank" value={rank} onChange={setRank} options={componentRanks} />}
        <TextInput label="UIC" value={uic} onChange={(v) => setUic(v.toUpperCase())} maxLength={6} />

        <label className="block">
          <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">Clinic</span>
          <select
            value={selectedClinicId}
            onChange={(e) => setSelectedClinicId(e.target.value)}
            className="mt-1 w-full px-3 py-2.5 rounded-lg bg-themewhite2 text-primary text-base
                       border border-tertiary/10 focus:border-themeblue2 focus:outline-none
                       transition-colors appearance-none"
          >
            <option value="">No clinic assigned</option>
            {clinics.map((clinic) => (
              <option key={clinic.id} value={clinic.id}>
                {clinic.name} ({clinic.uics.join(', ')})
              </option>
            ))}
          </select>
          {selectedClinicId && (() => {
            const selectedClinic = clinics.find((c) => c.id === selectedClinicId)
            return selectedClinic?.location ? (
              <p className="mt-1 text-xs text-tertiary/50">{selectedClinic.location}</p>
            ) : null
          })()}
        </label>

        <div>
          <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">Roles</span>
          <div className="flex gap-3 mt-2">
            {(['medic', 'supervisor', 'dev'] as const).map((role) => (
              <label key={role} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={roles[role]} onChange={() => toggleRole(role)}
                  className="w-4 h-4 rounded border-tertiary/30" />
                <span className="text-sm text-primary capitalize">{role}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">Note Content Defaults</span>
          <div className="mt-2 space-y-2">
            <label className="flex items-center justify-between cursor-pointer px-3 py-2.5 rounded-lg bg-themewhite2 border border-tertiary/10">
              <span className="text-sm text-primary">Include HPI</span>
              <input type="checkbox" checked={noteIncludeHPI} onChange={() => setNoteIncludeHPI(!noteIncludeHPI)}
                className="w-4 h-4 rounded border-tertiary/30" />
            </label>
            <label className="flex items-center justify-between cursor-pointer px-3 py-2.5 rounded-lg bg-themewhite2 border border-tertiary/10">
              <span className="text-sm text-primary">Include PE</span>
              <input type="checkbox" checked={noteIncludePE} onChange={() => setNoteIncludePE(!noteIncludePE)}
                className="w-4 h-4 rounded border-tertiary/30" />
            </label>
            <SelectInput label="PE Depth" value={peDepth} onChange={setPeDepth}
              options={['focused', 'standard', 'comprehensive'] as const} />
          </div>
        </div>

        <button onClick={handleSave} disabled={saving}
          className="w-full px-4 py-3 rounded-lg bg-themeblue2 text-white font-medium hover:bg-themeblue2/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </>
  )
}

// ─── Chip Input (reusable) ────────────────────────────────────────────

const ChipInput = ({
  label, values, onChange, placeholder, transform,
}: {
  label: string; values: string[]; onChange: (vals: string[]) => void
  placeholder?: string; transform?: (val: string) => string
}) => {
  const [inputValue, setInputValue] = useState('')

  const addChip = () => {
    const val = transform ? transform(inputValue.trim()) : inputValue.trim()
    if (val && !values.includes(val)) {
      onChange([...values, val])
    }
    setInputValue('')
  }

  const removeChip = (idx: number) => {
    onChange(values.filter((_, i) => i !== idx))
  }

  return (
    <div>
      <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">{label}</span>
      <div className="mt-1 flex flex-wrap gap-1.5 mb-2">
        {values.map((val, idx) => (
          <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-themeblue2/10 text-themeblue2 text-xs font-medium border border-themeblue2/30">
            {val}
            <button type="button" onClick={() => removeChip(idx)} className="hover:text-themeredred transition-colors">
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text" value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addChip() } }}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 rounded-lg bg-themewhite2 text-primary text-sm
                     border border-tertiary/10 focus:border-themeblue2 focus:outline-none
                     transition-colors placeholder:text-tertiary/30"
        />
        <button type="button" onClick={addChip} disabled={!inputValue.trim()}
          className="px-3 py-2 rounded-lg bg-themeblue2 text-white text-sm font-medium hover:bg-themeblue2/90 disabled:opacity-50 transition-colors">
          <Plus size={14} />
        </button>
      </div>
    </div>
  )
}

// ─── User Picker (for additional_user_ids) ───────────────────────────

const UserPicker = ({
  label, selectedIds, allUsers, onChange,
}: {
  label: string; selectedIds: string[]; allUsers: AdminUser[]; onChange: (ids: string[]) => void
}) => {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)

  const userMap = new Map(allUsers.map((u) => [u.id, u]))

  const filtered = allUsers.filter((u) => {
    if (selectedIds.includes(u.id)) return false
    if (!search) return false
    const q = search.toLowerCase()
    return (
      u.email?.toLowerCase().includes(q) ||
      u.first_name?.toLowerCase().includes(q) ||
      u.last_name?.toLowerCase().includes(q)
    )
  }).slice(0, 8)

  const removeUser = (id: string) => onChange(selectedIds.filter((uid) => uid !== id))
  const addUser = (id: string) => {
    onChange([...selectedIds, id])
    setSearch('')
    setOpen(false)
  }

  return (
    <div>
      <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">{label}</span>
      <div className="mt-1 flex flex-wrap gap-1.5 mb-2">
        {selectedIds.map((id) => {
          const u = userMap.get(id)
          const display = u ? `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email : id.slice(0, 8)
          return (
            <span key={id} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-themepurple/10 text-themepurple text-xs font-medium border border-themepurple/30">
              {display}
              <button type="button" onClick={() => removeUser(id)} className="hover:text-themeredred transition-colors">
                <X size={12} />
              </button>
            </span>
          )
        })}
      </div>
      <div className="relative">
        <input
          type="text" value={search}
          onChange={(e) => { setSearch(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Search users by name or email..."
          className="w-full px-3 py-2 rounded-lg bg-themewhite2 text-primary text-sm
                     border border-tertiary/10 focus:border-themeblue2 focus:outline-none
                     transition-colors placeholder:text-tertiary/30"
        />
        {open && filtered.length > 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-lg bg-themewhite2 border border-tertiary/10 shadow-lg max-h-48 overflow-y-auto">
            {filtered.map((u) => (
              <button key={u.id} type="button"
                onClick={() => addUser(u.id)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-themeblue2/10 transition-colors">
                <span className="text-primary font-medium">{u.first_name} {u.last_name}</span>
                <span className="text-tertiary/50 ml-2">{u.email}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const ClinicPicker = ({
  label, selectedIds, allClinics, excludeId, onChange,
}: {
  label: string; selectedIds: string[]; allClinics: AdminClinic[]; excludeId?: string; onChange: (ids: string[]) => void
}) => {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)

  const clinicMap = new Map(allClinics.map((c) => [c.id, c]))

  const filtered = allClinics.filter((c) => {
    if (selectedIds.includes(c.id)) return false
    if (c.id === excludeId) return false
    if (!search) return false
    const q = search.toLowerCase()
    return c.name.toLowerCase().includes(q) || c.uics.some((u) => u.toLowerCase().includes(q))
  }).slice(0, 8)

  const removeClinic = (id: string) => onChange(selectedIds.filter((cid) => cid !== id))
  const addClinic = (id: string) => {
    onChange([...selectedIds, id])
    setSearch('')
    setOpen(false)
  }

  return (
    <div>
      <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">{label}</span>
      <div className="mt-1 flex flex-wrap gap-1.5 mb-2">
        {selectedIds.map((id) => {
          const c = clinicMap.get(id)
          const display = c ? c.name : id.slice(0, 8)
          return (
            <span key={id} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-themeblue2/10 text-themeblue2 text-xs font-medium border border-themeblue2/30">
              {display}
              <button type="button" onClick={() => removeClinic(id)} className="hover:text-themeredred transition-colors">
                <X size={12} />
              </button>
            </span>
          )
        })}
      </div>
      <div className="relative">
        <input
          type="text" value={search}
          onChange={(e) => { setSearch(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Search clinics by name or UIC..."
          className="w-full px-3 py-2 rounded-lg bg-themewhite2 text-primary text-sm
                     border border-tertiary/10 focus:border-themeblue2 focus:outline-none
                     transition-colors placeholder:text-tertiary/30"
        />
        {open && filtered.length > 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-lg bg-themewhite2 border border-tertiary/10 shadow-lg max-h-48 overflow-y-auto">
            {filtered.map((c) => (
              <button key={c.id} type="button"
                onClick={() => addClinic(c.id)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-themeblue2/10 transition-colors">
                <span className="text-primary font-medium">{c.name}</span>
                {c.uics.length > 0 && <span className="text-tertiary/50 ml-2">{c.uics.join(', ')}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Clinics Tab ─────────────────────────────────────────────────────

type ClinicsView = 'list' | 'detail' | 'create' | 'edit'

const ClinicsTab = () => {
  const [view, setView] = useState<ClinicsView>('list')
  const [clinics, setClinics] = useState<AdminClinic[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [editingClinic, setEditingClinic] = useState<AdminClinic | null>(null)
  const [detailClinic, setDetailClinic] = useState<AdminClinic | null>(null)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Delete inline state
  const [deleteClinicId, setDeleteClinicId] = useState<string | null>(null)
  const [deleteConfirmName, setDeleteConfirmName] = useState('')
  const [deleteProcessing, setDeleteProcessing] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    const [clinicData, userData] = await Promise.all([listClinics(), listAllUsers()])
    setClinics(clinicData)
    setUsers(userData)
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Sync detailClinic with latest data after reload
  useEffect(() => {
    if (detailClinic) {
      const updated = clinics.find((c) => c.id === detailClinic.id)
      if (updated) setDetailClinic(updated)
      else if (!loading) { setDetailClinic(null); setView('list') }
    }
  }, [clinics]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDeleteClinic = async (clinicId: string, expectedName: string) => {
    if (deleteConfirmName !== expectedName) return
    setDeleteProcessing(true)
    const result = await deleteClinic(clinicId)
    setDeleteProcessing(false)
    if (result.success) {
      setDeleteClinicId(null)
      setDeleteConfirmName('')
      setFeedback({ type: 'success', message: 'Clinic deleted successfully' })
      await loadData()
    } else {
      setFeedback({ type: 'error', message: result.error || 'Failed to delete clinic' })
    }
  }

  const usersInClinic = (clinicId: string) => users.filter((u) => u.clinic_id === clinicId)

  const filteredClinics = clinics.filter((c) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      c.name.toLowerCase().includes(q) ||
      c.location?.toLowerCase().includes(q) ||
      c.uics.some((uic) => uic.toLowerCase().includes(q))
    )
  })

  if (view === 'create') {
    return (
      <CreateClinicForm
        allUsers={users}
        allClinics={clinics}
        onBack={() => setView('list')}
        onCreated={() => { setView('list'); loadData(); setFeedback({ type: 'success', message: 'Clinic created successfully' }) }}
      />
    )
  }

  if (view === 'edit' && editingClinic) {
    return (
      <EditClinicForm
        clinic={editingClinic}
        allUsers={users}
        allClinics={clinics}
        onBack={() => {
          if (detailClinic) { setView('detail'); setEditingClinic(null) }
          else { setView('list'); setEditingClinic(null) }
        }}
        onSaved={() => {
          setEditingClinic(null)
          loadData()
          setFeedback({ type: 'success', message: 'Clinic updated successfully' })
          if (detailClinic) setView('detail')
          else setView('list')
        }}
      />
    )
  }

  // ─── Clinic Detail View ─────────────────

  if (view === 'detail' && detailClinic) {
    const assignedUsers = usersInClinic(detailClinic.id)
    return (
      <>
        <button onClick={() => { setView('list'); setDetailClinic(null) }}
          className="flex items-center gap-1 text-sm text-themeblue2 mb-4 hover:underline">
          <ChevronLeft size={16} /> Back to clinic list
        </button>

        {feedback && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${
            feedback.type === 'success'
              ? 'bg-themegreen/10 border border-themegreen/20 text-themegreen'
              : 'bg-themeredred/10 border border-themeredred/20 text-themeredred'
          }`}>
            {feedback.message}
            <button onClick={() => setFeedback(null)} className="float-right text-xs opacity-60 hover:opacity-100">dismiss</button>
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-primary">{detailClinic.name}</h3>
            {detailClinic.location && (
              <p className="text-sm text-tertiary/70 flex items-center gap-1 mt-0.5">
                <MapPin size={12} /> {detailClinic.location}
              </p>
            )}
          </div>
          <span className="px-2 py-0.5 rounded text-xs font-medium border bg-themeblue2/10 text-themeblue2 border-themeblue2/30">
            {assignedUsers.length} user{assignedUsers.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* UIC badges */}
        {detailClinic.uics.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {detailClinic.uics.map((uic) => (
              <span key={uic} className="px-2 py-0.5 rounded text-xs font-medium bg-themeyellow/10 text-themeyellow border border-themeyellow/30">
                {uic}
              </span>
            ))}
          </div>
        )}

        {/* Child clinic badges */}
        {detailClinic.child_clinic_ids.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {detailClinic.child_clinic_ids.map((cid) => {
              const child = clinics.find((c) => c.id === cid)
              return (
                <span key={cid} className="px-2 py-0.5 rounded text-xs font-medium bg-themeblue2/10 text-themeblue2 border border-themeblue2/30">
                  {child ? child.name : cid.slice(0, 8)}
                </span>
              )
            })}
          </div>
        )}

        {/* Additional users */}
        {detailClinic.additional_user_ids.length > 0 && (
          <div className="mb-3">
            <span className="text-xs text-tertiary/50">Additional users: </span>
            <span className="text-xs text-primary">
              {detailClinic.additional_user_ids.map((uid) => {
                const u = users.find((usr) => usr.id === uid)
                return u ? `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email : uid.slice(0, 8)
              }).join(', ')}
            </span>
          </div>
        )}

        {/* Assigned users */}
        {assignedUsers.length > 0 && (
          <div className="mb-3 text-xs text-tertiary/50">
            Assigned: {assignedUsers.map((u) => `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email).join(', ')}
          </div>
        )}

        {/* Delete confirmation inline */}
        {deleteClinicId === detailClinic.id && (
          <div className="p-3 bg-themeredred/10 rounded-lg mb-3 border border-themeredred/20">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={16} className="text-themeredred shrink-0" />
              <p className="text-sm text-themeredred font-semibold">Delete this clinic?</p>
            </div>
            <p className="text-xs text-themeredred mb-2">
              Type <span className="font-mono font-semibold bg-themeredred/10 px-1 py-0.5 rounded">{detailClinic.name}</span> to confirm:
            </p>
            <div className="flex gap-2">
              <input
                type="text" value={deleteConfirmName}
                onChange={(e) => setDeleteConfirmName(e.target.value)}
                placeholder="Type clinic name to confirm..."
                className="flex-1 px-3 py-2 rounded-lg bg-themewhite2 border border-themeredred/30 text-sm
                           focus:border-themeredred focus:outline-none transition-colors placeholder:text-tertiary/30"
                autoComplete="off"
              />
              <button
                onClick={() => handleDeleteClinic(detailClinic.id, detailClinic.name)}
                disabled={deleteProcessing || deleteConfirmName !== detailClinic.name}
                className="px-3 py-2 rounded-lg bg-themeredred text-white text-sm font-medium
                           hover:bg-themeredred/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {deleteProcessing ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={() => { setDeleteClinicId(null); setDeleteConfirmName('') }}
                className="px-3 py-2 rounded-lg bg-tertiary/10 text-primary text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => { setEditingClinic(detailClinic); setView('edit') }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-themeblue2 text-white text-sm font-medium hover:bg-themeblue2/90 transition-colors"
          >
            <Pencil size={14} /> Edit
          </button>
          <button
            onClick={() => { setDeleteClinicId(detailClinic.id); setDeleteConfirmName('') }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-themeredred/10 text-themeredred text-sm font-medium
                       hover:bg-themeredred/20 border border-themeredred/20 transition-colors"
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-tertiary/60">Manage clinics</p>
        <button
          onClick={() => setView('create')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-themegreen text-white text-sm font-medium hover:bg-themegreen/90 transition-colors"
        >
          <Plus size={14} /> Create Clinic
        </button>
      </div>

      {feedback && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${
          feedback.type === 'success'
            ? 'bg-themegreen/10 border border-themegreen/20 text-themegreen'
            : 'bg-themeredred/10 border border-themeredred/20 text-themeredred'
        }`}>
          {feedback.message}
          <button onClick={() => setFeedback(null)} className="float-right text-xs opacity-60 hover:opacity-100">dismiss</button>
        </div>
      )}

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary/40" />
        <input
          type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name, location, or UIC..."
          className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-themewhite2 text-primary text-sm
                     border border-tertiary/10 focus:border-themeblue2 focus:outline-none transition-colors placeholder:text-tertiary/30"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><div className="text-tertiary/60">Loading clinics...</div></div>
      ) : filteredClinics.length === 0 ? (
        <div className="text-center py-12">
          <Building2 size={28} className="mx-auto mb-3 text-tertiary/30" />
          <p className="text-tertiary/60">{searchQuery ? 'No clinics match your search' : 'No clinics found'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredClinics.map((clinic) => {
            const assignedUsers = usersInClinic(clinic.id)
            return (
              <div
                key={clinic.id}
                onClick={() => { setDetailClinic(clinic); setView('detail') }}
                className="rounded-xl px-4 py-3 bg-themewhite2 cursor-pointer hover:ring-1 hover:ring-themeblue2/30 transition-all space-y-2"
              >
                {/* Row 1: Clinic name + location + user count */}
                <div className="flex items-center gap-3">
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
                {/* Row 2: UIC badges */}
                {clinic.uics.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1">
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
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

// ─── Create Clinic Form ──────────────────────────────────────────────

const CreateClinicForm = ({ allUsers, allClinics, onBack, onCreated }: {
  allUsers: AdminUser[]; allClinics: AdminClinic[]; onBack: () => void; onCreated: () => void
}) => {
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [uics, setUics] = useState<string[]>([])
  const [childClinicIds, setChildClinicIds] = useState<string[]>([])
  const [associatedClinicIds, setAssociatedClinicIds] = useState<string[]>([])
  const [additionalUserIds, setAdditionalUserIds] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Clinic name is required')
      return
    }

    setSubmitting(true)
    const result = await createClinic({
      name: name.trim(),
      location: location.trim() || undefined,
      uics,
      child_clinic_ids: childClinicIds,
      associated_clinic_ids: associatedClinicIds,
      additional_user_ids: additionalUserIds,
    })
    setSubmitting(false)

    if (result.success) {
      onCreated()
    } else {
      setError(result.error || 'Failed to create clinic')
    }
  }

  return (
    <>
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-themeblue2 mb-4 hover:underline">
        <ChevronLeft size={16} /> Back to clinic list
      </button>

      <h3 className="text-base font-semibold text-primary mb-4">Create New Clinic</h3>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-themeredred/10 border border-themeredred/20 text-themeredred text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <TextInput label="Clinic Name" value={name} onChange={setName} placeholder="e.g. TMC Alpha" required />
        <TextInput label="Location" value={location} onChange={setLocation} placeholder="e.g. Building 123, Fort Example" />
        <ChipInput
          label="UICs"
          values={uics}
          onChange={setUics}
          placeholder="Add UIC (e.g. W12345)..."
          transform={(v) => v.toUpperCase()}
        />
        <ClinicPicker
          label="Child Clinics"
          selectedIds={childClinicIds}
          allClinics={allClinics}
          onChange={setChildClinicIds}
        />
        <ClinicPicker
          label="Associated Clinics"
          selectedIds={associatedClinicIds}
          allClinics={allClinics}
          onChange={setAssociatedClinicIds}
        />
        <UserPicker
          label="Additional Users"
          selectedIds={additionalUserIds}
          allUsers={allUsers}
          onChange={setAdditionalUserIds}
        />

        <button type="submit" disabled={submitting}
          className="w-full px-4 py-3 rounded-lg bg-themegreen text-white font-medium hover:bg-themegreen/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          {submitting ? 'Creating Clinic...' : 'Create Clinic'}
        </button>
      </form>
    </>
  )
}

// ─── Edit Clinic Form ────────────────────────────────────────────────

const EditClinicForm = ({ clinic, allUsers, allClinics, onBack, onSaved }: {
  clinic: AdminClinic; allUsers: AdminUser[]; allClinics: AdminClinic[]; onBack: () => void; onSaved: () => void
}) => {
  const [name, setName] = useState(clinic.name)
  const [location, setLocation] = useState(clinic.location || '')
  const [uics, setUics] = useState<string[]>(clinic.uics)
  const [childClinicIds, setChildClinicIds] = useState<string[]>(clinic.child_clinic_ids)
  const [associatedClinicIds, setAssociatedClinicIds] = useState<string[]>(clinic.associated_clinic_ids)
  const [additionalUserIds, setAdditionalUserIds] = useState<string[]>(clinic.additional_user_ids)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    setError(null)

    if (!name.trim()) {
      setError('Clinic name is required')
      return
    }

    setSaving(true)
    const result = await updateClinic(clinic.id, {
      name: name.trim(),
      location: location.trim() || null,
      uics,
      associated_clinic_ids: associatedClinicIds,
      child_clinic_ids: childClinicIds,
      additional_user_ids: additionalUserIds,
    })
    setSaving(false)

    if (result.success) {
      onSaved()
    } else {
      setError(result.error || 'Failed to update clinic')
    }
  }

  return (
    <>
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-themeblue2 mb-4 hover:underline">
        <ChevronLeft size={16} /> Back to clinic list
      </button>

      <h3 className="text-base font-semibold text-primary mb-4">Edit Clinic</h3>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-themeredred/10 border border-themeredred/20 text-themeredred text-sm">{error}</div>
      )}

      <div className="space-y-4">
        <TextInput label="Clinic Name" value={name} onChange={setName} placeholder="e.g. TMC Alpha" required />
        <TextInput label="Location" value={location} onChange={setLocation} placeholder="e.g. Building 123, Fort Example" />
        <ChipInput
          label="UICs"
          values={uics}
          onChange={setUics}
          placeholder="Add UIC (e.g. W12345)..."
          transform={(v) => v.toUpperCase()}
        />
        <ClinicPicker
          label="Child Clinics"
          selectedIds={childClinicIds}
          allClinics={allClinics}
          excludeId={clinic.id}
          onChange={setChildClinicIds}
        />
        <ClinicPicker
          label="Associated Clinics"
          selectedIds={associatedClinicIds}
          allClinics={allClinics}
          excludeId={clinic.id}
          onChange={setAssociatedClinicIds}
        />
        <UserPicker
          label="Additional Users"
          selectedIds={additionalUserIds}
          allUsers={allUsers}
          onChange={setAdditionalUserIds}
        />

        <button onClick={handleSave} disabled={saving}
          className="w-full px-4 py-3 rounded-lg bg-themeblue2 text-white font-medium hover:bg-themeblue2/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </>
  )
}

// ─── Certs Tab (Admin) ────────────────────────────────────────────────

function getExpirationStatus(expDate: string | null): 'valid' | 'expiring' | 'expired' | 'none' {
  if (!expDate) return 'none'
  const now = new Date()
  const exp = new Date(expDate)
  const diffDays = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  if (diffDays < 0) return 'expired'
  if (diffDays <= 90) return 'expiring'
  return 'valid'
}

const certBadgeColors = {
  valid:    'bg-themegreen/10 text-themegreen border-themegreen/30',
  expiring: 'bg-themeyellow/10 text-themeyellow border-themeyellow/30',
  expired:  'bg-themeredred/10 text-themeredred border-themeredred/30',
  none:     'bg-tertiary/5 text-tertiary/50 border-tertiary/20',
} as const

/** Inline cert badges embedded in each user card */
const UserCertsSection = ({
  userId, certs, currentUserId, allUsers, onChanged,
}: {
  userId: string
  certs: Certification[]
  currentUserId: string | null
  allUsers: AdminUser[]
  onChanged: () => void
}) => {
  const [editingCertId, setEditingCertId] = useState<string | null>(null)
  const [deletingCertId, setDeletingCertId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  // Edit-form state
  const [editTitle, setEditTitle] = useState('')
  const [editCertNumber, setEditCertNumber] = useState('')
  const [editIssueDate, setEditIssueDate] = useState('')
  const [editExpDate, setEditExpDate] = useState('')
  const [editIsPrimary, setEditIsPrimary] = useState(false)
  const [saving, setSaving] = useState(false)

  // Add-form state
  const [addTitle, setAddTitle] = useState('')
  const [addCertNumber, setAddCertNumber] = useState('')
  const [addIssueDate, setAddIssueDate] = useState('')
  const [addExpDate, setAddExpDate] = useState('')
  const [addIsPrimary, setAddIsPrimary] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const userMap = new Map(allUsers.map(u => [u.id, u]))
  const resolveName = (id: string) => {
    const u = userMap.get(id)
    return u ? `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email : id.slice(0, 8)
  }

  const openEdit = (cert: Certification) => {
    setDeletingCertId(null); setAdding(false)
    setEditingCertId(cert.id)
    setEditTitle(cert.title)
    setEditCertNumber(cert.cert_number || '')
    setEditIssueDate(cert.issue_date || '')
    setEditExpDate(cert.exp_date || '')
    setEditIsPrimary(cert.is_primary)
  }

  const openAdd = () => {
    setEditingCertId(null); setDeletingCertId(null)
    setAdding(true)
    setAddTitle(''); setAddCertNumber(''); setAddIssueDate(''); setAddExpDate(''); setAddIsPrimary(false); setAddError(null)
  }

  const handleSaveEdit = async () => {
    if (!editingCertId || !editTitle.trim()) return
    setSaving(true)
    const result = await updateCertification(editingCertId, {
      title: editTitle.trim(),
      cert_number: editCertNumber.trim() || null,
      issue_date: editIssueDate || null,
      exp_date: editExpDate || null,
      is_primary: editIsPrimary,
    })
    setSaving(false)
    if (result.success) {
      const cert = certs.find(c => c.id === editingCertId)
      if (cert && editIsPrimary !== cert.is_primary) {
        await syncPrimaryToProfile(cert.user_id)
      }
      setEditingCertId(null)
      onChanged()
    }
  }

  const handleVerify = async (certId: string) => {
    if (!currentUserId) return
    const result = await verifyCertification(certId, currentUserId)
    if (result.success) onChanged()
  }

  const handleUnverify = async (certId: string) => {
    const result = await unverifyCertification(certId)
    if (result.success) onChanged()
  }

  const handleDelete = async (certId: string, wasPrimary: boolean) => {
    const result = await adminDeleteCertification(certId, userId, wasPrimary)
    if (result.success) { setDeletingCertId(null); onChanged() }
  }

  const handleAdd = async () => {
    if (!addTitle.trim()) { setAddError('Title is required'); return }
    setSubmitting(true); setAddError(null)
    const result = await adminAddCertification(userId, {
      title: addTitle.trim(),
      cert_number: addCertNumber.trim() || null,
      issue_date: addIssueDate || null,
      exp_date: addExpDate || null,
      is_primary: addIsPrimary,
    })
    setSubmitting(false)
    if (result.success) {
      setAdding(false)
      onChanged()
    } else {
      setAddError(result.error || 'Failed to add')
    }
  }

  return (
    <div className="mt-3 border-t border-tertiary/10 pt-2">
      {/* Badge row */}
      <div className="flex flex-wrap items-center gap-1.5">
        {certs.map(cert => {
          const status = getExpirationStatus(cert.exp_date)
          const color = certBadgeColors[status]

          if (deletingCertId === cert.id) {
            return (
              <span key={cert.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border bg-themeredred/10 text-themeredred border-themeredred/30">
                Delete?
                <button onClick={() => handleDelete(cert.id, cert.is_primary)} className="font-semibold hover:underline">Yes</button>
                <span className="text-themeredred/40">/</span>
                <button onClick={() => setDeletingCertId(null)} className="font-semibold hover:underline">No</button>
              </span>
            )
          }

          return (
            <span key={cert.id} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${color}`}>
              <button onClick={() => openEdit(cert)} className="hover:underline">{cert.title}</button>
              {cert.is_primary && <Star size={9} className="fill-current" />}
              {cert.verified && <CheckCircle size={9} />}
              <button onClick={() => { setEditingCertId(null); setAdding(false); setDeletingCertId(cert.id) }}
                className="ml-0.5 opacity-60 hover:opacity-100">
                <X size={10} />
              </button>
            </span>
          )
        })}

        {/* + Add badge */}
        <button onClick={openAdd}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border border-dashed border-tertiary/30 text-tertiary/50 hover:text-themeblue2 hover:border-themeblue2/40 transition-colors">
          <Plus size={10} /> Add
        </button>
      </div>

      {/* Edit form (below badges) */}
      {editingCertId && (() => {
        const cert = certs.find(c => c.id === editingCertId)
        if (!cert) return null
        const verifierName = cert.verified_by ? resolveName(cert.verified_by) : null
        return (
          <div className="mt-2 rounded-lg border border-themeblue2/30 bg-themewhite2 px-3 py-3 space-y-2.5">
            <p className="text-xs font-medium text-themeblue2 uppercase tracking-wide">Edit Certification</p>
            <label className="block">
              <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">Title</span>
              <input type="text" list={`cert-edit-sug-${userId}`} value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-themewhite text-primary text-sm border border-tertiary/10 focus:border-themeblue2 focus:outline-none transition-colors" />
              <datalist id={`cert-edit-sug-${userId}`}>
                {credentials.map(c => <option key={c} value={c} />)}
              </datalist>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">Cert Number</span>
              <input type="text" value={editCertNumber} onChange={(e) => setEditCertNumber(e.target.value)} placeholder="Optional"
                className="mt-1 w-full px-3 py-2 rounded-lg bg-themewhite text-primary text-sm border border-tertiary/10 focus:border-themeblue2 focus:outline-none transition-colors placeholder:text-tertiary/30" />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">Issue Date</span>
                <input type="date" value={editIssueDate} onChange={(e) => setEditIssueDate(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-themewhite text-primary text-sm border border-tertiary/10 focus:border-themeblue2 focus:outline-none transition-colors" />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">Exp Date</span>
                <input type="date" value={editExpDate} onChange={(e) => setEditExpDate(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-lg bg-themewhite text-primary text-sm border border-tertiary/10 focus:border-themeblue2 focus:outline-none transition-colors" />
              </label>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={editIsPrimary} onChange={(e) => setEditIsPrimary(e.target.checked)}
                className="rounded border-tertiary/20 text-themeblue2 focus:ring-themeblue2/30" />
              <span className="text-sm text-primary">Primary certification</span>
            </label>
            {/* Verification status */}
            <div className="flex items-center gap-2 text-xs">
              {cert.verified ? (
                <>
                  <span className="flex items-center gap-1 text-themegreen font-medium"><CheckCircle size={11} /> Verified</span>
                  {verifierName && <span className="text-tertiary/40">by {verifierName}</span>}
                  <button onClick={() => handleUnverify(cert.id)} className="text-tertiary/40 hover:text-themeredred transition-colors ml-auto">Unverify</button>
                </>
              ) : (
                <>
                  <span className="text-tertiary/50">Unverified</span>
                  <button onClick={() => handleVerify(cert.id)}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg font-medium bg-themeblue2 text-white hover:bg-themeblue2/90 transition-colors ml-auto">
                    <CheckCircle size={11} /> Verify
                  </button>
                </>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={handleSaveEdit} disabled={saving || !editTitle.trim()}
                className="flex-1 py-2 rounded-lg bg-themeblue2 text-white text-sm font-medium hover:bg-themeblue2/90 disabled:opacity-50 transition-colors">
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => setEditingCertId(null)}
                className="px-4 py-2 rounded-lg bg-tertiary/10 text-primary text-sm transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )
      })()}

      {/* Add form (below badges) */}
      {adding && (
        <div className="mt-2 rounded-lg border border-themeblue2/30 bg-themewhite px-3 py-3 space-y-2.5">
          <p className="text-xs font-medium text-themeblue2 uppercase tracking-wide">Add Certification</p>
          <label className="block">
            <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">Title <span className="text-themeredred">*</span></span>
            <input type="text" list={`cert-add-sug-${userId}`} value={addTitle} onChange={(e) => setAddTitle(e.target.value)}
              placeholder="e.g. EMT-B, ACLS, BSN"
              className="mt-1 w-full px-3 py-2 rounded-lg bg-themewhite2 text-primary text-sm border border-tertiary/10 focus:border-themeblue2 focus:outline-none transition-colors placeholder:text-tertiary/30" />
            <datalist id={`cert-add-sug-${userId}`}>
              {credentials.map(c => <option key={c} value={c} />)}
            </datalist>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">Cert Number</span>
            <input type="text" value={addCertNumber} onChange={(e) => setAddCertNumber(e.target.value)} placeholder="Optional"
              className="mt-1 w-full px-3 py-2 rounded-lg bg-themewhite2 text-primary text-sm border border-tertiary/10 focus:border-themeblue2 focus:outline-none transition-colors placeholder:text-tertiary/30" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">Issue Date</span>
              <input type="date" value={addIssueDate} onChange={(e) => setAddIssueDate(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-themewhite2 text-primary text-sm border border-tertiary/10 focus:border-themeblue2 focus:outline-none transition-colors" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">Exp Date</span>
              <input type="date" value={addExpDate} onChange={(e) => setAddExpDate(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-themewhite2 text-primary text-sm border border-tertiary/10 focus:border-themeblue2 focus:outline-none transition-colors" />
            </label>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={addIsPrimary} onChange={(e) => setAddIsPrimary(e.target.checked)}
              className="rounded border-tertiary/20 text-themeblue2 focus:ring-themeblue2/30" />
            <span className="text-sm text-primary">Primary</span>
          </label>
          {addError && <p className="text-xs text-themeredred">{addError}</p>}
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={submitting || !addTitle.trim()}
              className="flex-1 py-2 rounded-lg bg-themeblue2 text-white text-sm font-medium hover:bg-themeblue2/90 disabled:opacity-50 transition-colors">
              {submitting ? 'Adding...' : 'Add'}
            </button>
            <button onClick={() => setAdding(false)}
              className="px-4 py-2 rounded-lg bg-tertiary/10 text-primary text-sm transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main AdminPanel ──────────────────────────────────────────────────

export const AdminPanel = () => {
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'requests' | 'users' | 'clinics'>('requests')
  useEffect(() => {
    const check = async () => {
      const isDev = await isDevUser()
      setIsAdmin(isDev)
      setLoading(false)
    }
    check()
  }, [])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-tertiary/60">Loading...</div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="h-full flex items-center justify-center px-4">
        <div className="text-center">
          <Ban size={28} className="mx-auto mb-3 text-tertiary/30" />
          <h3 className="text-base font-semibold text-primary mb-1">Access Denied</h3>
          <p className="text-sm text-tertiary/60">You need dev role to access this panel.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-4 py-3 md:p-5">
        {/* Top-level tab bar */}
        <div className="flex gap-1 mb-5 p-0.5 bg-themewhite2 rounded-lg">
          {(['requests', 'users', 'clinics'] as const).map((tab) => (
            <button
              key={tab} onClick={() => setActiveTab(tab)}
              className={`flex-1 px-4 py-1.5 rounded-md text-sm font-medium transition-colors
                ${activeTab === tab ? 'bg-themeblue2 text-white shadow-sm' : 'text-tertiary/70 hover:text-primary'}`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {activeTab === 'requests' && <RequestsTab />}
        {activeTab === 'users' && <UsersTab />}
        {activeTab === 'clinics' && <ClinicsTab />}
      </div>
    </div>
  )
}
