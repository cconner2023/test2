import { useState, useEffect, useCallback } from 'react'
import { Check, X, UserPlus, Clock, Ban, Search, ChevronLeft, KeyRound, Pencil, Trash2, AlertTriangle } from 'lucide-react'
import type { Component } from '../../Data/User'
import { credentials, components, ranksByComponent } from '../../Data/User'
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
  listClinics,
  setUserClinic,
} from '../../lib/adminService'
import type { AdminUser, AdminClinic } from '../../lib/adminService'
import type { AccountRequest } from '../../lib/accountRequestService'
import { supabase } from '../../lib/supabase'

// ─── Shared input components ──────────────────────────────────────────

const TextInput = ({
  label, value, onChange, placeholder, maxLength, required = false, type = 'text',
}: {
  label: string; value: string; onChange: (val: string) => void
  placeholder?: string; maxLength?: number; required?: boolean; type?: string
}) => (
  <label className="block">
    <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">
      {label} {required && <span className="text-red-500">*</span>}
    </span>
    <input
      type={type} value={value} onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder} maxLength={maxLength} required={required}
      className="mt-1 w-full px-3 py-2.5 rounded-lg bg-themewhite2 text-primary text-base
                 border border-tertiary/10 focus:border-themeblue2 focus:outline-none
                 transition-colors placeholder:text-tertiary/30"
    />
  </label>
)

const SelectInput = ({
  label, value, onChange, options, placeholder, required = false,
}: {
  label: string; value: string; onChange: (val: string) => void
  options: readonly string[]; placeholder?: string; required?: boolean
}) => (
  <label className="block">
    <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">
      {label} {required && <span className="text-red-500">*</span>}
    </span>
    <select
      value={value} onChange={(e) => onChange(e.target.value)} required={required}
      className="mt-1 w-full px-3 py-2.5 rounded-lg bg-themewhite2 text-primary text-base
                 border border-tertiary/10 focus:border-themeblue2 focus:outline-none
                 transition-colors appearance-none"
    >
      <option value="">{placeholder ?? 'Select...'}</option>
      {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
    </select>
  </label>
)

const RoleBadge = ({ role }: { role: string }) => {
  const colors: Record<string, string> = {
    medic: 'bg-blue-100 text-blue-700 border-blue-300',
    supervisor: 'bg-amber-100 text-amber-700 border-amber-300',
    dev: 'bg-purple-100 text-purple-700 border-purple-300',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${colors[role] || 'bg-gray-100 text-gray-700 border-gray-300'}`}>
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
  const [tempPassword, setTempPassword] = useState('')

  const loadRequests = useCallback(async () => {
    setLoading(true)
    const data = await getAllAccountRequests(filter === 'all' ? undefined : filter)
    setRequests(data)
    setLoading(false)
  }, [filter])

  useEffect(() => { loadRequests() }, [loadRequests])

  const handleApprove = async (requestId: string) => {
    if (!tempPassword || tempPassword.length < 12) {
      alert('Please set a temporary password (at least 12 characters)')
      return
    }
    setProcessingId(requestId)
    const result = await approveAccountRequest(requestId, tempPassword)
    if (result.success) {
      setApprovingId(null)
      setTempPassword('')
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
      case 'pending': return 'bg-yellow-100 text-yellow-700 border-yellow-300'
      case 'approved': return 'bg-green-100 text-green-700 border-green-300'
      case 'rejected': return 'bg-red-100 text-red-700 border-red-300'
      default: return 'bg-gray-100 text-gray-700 border-gray-300'
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="text-tertiary/60">Loading...</div></div>
  }

  return (
    <>
      <p className="text-sm text-tertiary/60 mb-4">Review and approve account requests</p>

      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {(['pending', 'approved', 'rejected', 'all'] as const).map((tab) => (
          <button
            key={tab} onClick={() => setFilter(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap
              ${filter === tab ? 'bg-themeblue2 text-white' : 'bg-themewhite2 text-tertiary/70 hover:bg-themewhite2/80'}`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {requests.length === 0 ? (
        <div className="text-center py-12">
          <Clock size={48} className="mx-auto mb-4 text-tertiary/40" />
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
                      ? 'bg-blue-100 text-blue-700 border-blue-300'
                      : 'bg-purple-100 text-purple-700 border-purple-300'
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
                    <div className="p-3 bg-green-50 rounded-lg">
                      <p className="text-sm text-green-800 font-medium mb-2">Set a temporary password for this user:</p>
                      <div className="flex gap-2">
                        <input type="text" value={tempPassword} onChange={(e) => setTempPassword(e.target.value)}
                          placeholder="Temp password (min 12 chars)..."
                          className="flex-1 px-3 py-2 rounded-lg bg-white border border-green-300 text-sm" />
                        <button onClick={() => handleApprove(request.id)}
                          disabled={processingId === request.id || tempPassword.length < 12}
                          className="px-3 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                          {processingId === request.id ? 'Creating...' : 'Create Account'}
                        </button>
                        <button onClick={() => { setApprovingId(null); setTempPassword('') }}
                          className="px-3 py-2 rounded-lg bg-tertiary/10 text-primary text-sm">Cancel</button>
                      </div>
                      {tempPassword.length > 0 && tempPassword.length < 12 && (
                        <p className="text-xs text-red-500 mt-1">Password must be at least 12 characters</p>
                      )}
                    </div>
                  ) : rejectingId === request.id ? (
                    <div className="flex gap-2">
                      <input type="text" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Rejection reason..."
                        className="flex-1 px-3 py-2 rounded-lg bg-themewhite border border-tertiary/10 text-sm" />
                      <button onClick={() => handleReject(request.id)} disabled={processingId === request.id}
                        className="px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50">Confirm</button>
                      <button onClick={() => { setRejectingId(null); setRejectReason('') }}
                        className="px-3 py-2 rounded-lg bg-tertiary/10 text-primary text-sm">Cancel</button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={() => { setApprovingId(request.id); setRejectingId(null) }}
                        disabled={processingId === request.id}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 disabled:opacity-50 transition-colors">
                        <Check size={16} /> Approve
                      </button>
                      <button onClick={() => { setRejectingId(request.id); setApprovingId(null) }}
                        disabled={processingId === request.id}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50 transition-colors">
                        <X size={16} /> Reject
                      </button>
                    </div>
                  )}
                </div>
              )}

              {request.status === 'approved' && (
                <div className="p-3 bg-green-50 rounded-lg text-sm">
                  <div className="flex items-center gap-2 text-green-700">
                    <UserPlus size={16} /><span className="font-medium">Account created</span>
                  </div>
                  <p className="text-green-600 text-xs mt-1">User can log in with their temporary password.</p>
                </div>
              )}

              {request.status === 'rejected' && request.rejection_reason && (
                <div className="p-3 bg-red-50 rounded-lg text-sm">
                  <span className="text-red-700 font-medium">Reason:</span>
                  <p className="text-red-600 text-xs mt-1">{request.rejection_reason}</p>
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

type UsersView = 'list' | 'create' | 'edit'

const UsersTab = () => {
  const [view, setView] = useState<UsersView>('list')
  const [users, setUsers] = useState<AdminUser[]>([])
  const [clinics, setClinics] = useState<AdminClinic[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)

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

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    const [userData, clinicData] = await Promise.all([listAllUsers(), listClinics()])
    setUsers(userData)
    setClinics(clinicData)
    setLoading(false)
  }, [])

  useEffect(() => { loadUsers() }, [loadUsers])

  // Fetch current user ID once
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id)
    })
  }, [])

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
      setTimeout(() => setResetPwSuccess(null), 3000)
    } else {
      setFeedback({ type: 'error', message: result.error || 'Failed to reset password' })
    }
  }

  const clinicMap = new Map(clinics.map((c) => [c.id, c]))

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
        onBack={() => { setView('list'); setEditingUser(null) }}
        onSaved={() => { setView('list'); setEditingUser(null); loadUsers(); setFeedback({ type: 'success', message: 'Profile updated successfully' }) }}
      />
    )
  }

  // ─── User List View ──────────────────────

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-tertiary/60">Manage user accounts</p>
        <button
          onClick={() => setView('create')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors"
        >
          <UserPlus size={14} /> Create User
        </button>
      </div>

      {feedback && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${
          feedback.type === 'success'
            ? 'bg-green-50 border border-green-200 text-green-700'
            : 'bg-red-50 border border-red-200 text-red-700'
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
        <div className="space-y-3">
          {filteredUsers.map((user) => (
            <div key={user.id} className="p-4 rounded-lg border border-tertiary/10 bg-themewhite2">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-semibold text-primary">
                    {user.first_name || ''} {user.middle_initial || ''} {user.last_name || ''}
                  </h4>
                  <p className="text-sm text-tertiary/70">{user.email}</p>
                </div>
                <div className="flex gap-1 flex-wrap justify-end">
                  {user.roles?.map((role) => <RoleBadge key={role} role={role} />)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                {user.rank && (
                  <div><span className="text-tertiary/60">Rank:</span> <span className="text-primary font-medium">{user.rank}</span></div>
                )}
                {user.credential && (
                  <div><span className="text-tertiary/60">Credential:</span> <span className="text-primary font-medium">{user.credential}</span></div>
                )}
                {user.component && (
                  <div><span className="text-tertiary/60">Component:</span> <span className="text-primary font-medium">{user.component}</span></div>
                )}
                {user.uic && (
                  <div><span className="text-tertiary/60">UIC:</span> <span className="text-primary font-medium">{user.uic}</span></div>
                )}
                {user.clinic_id && clinicMap.has(user.clinic_id) && (
                  <div><span className="text-tertiary/60">Clinic:</span> <span className="text-primary font-medium">{clinicMap.get(user.clinic_id)!.name}</span></div>
                )}
              </div>

              {/* Reset password inline */}
              {resetPwUserId === user.id ? (
                <div className="p-3 bg-amber-50 rounded-lg mb-3">
                  <p className="text-sm text-amber-800 font-medium mb-2">Set new password:</p>
                  <div className="flex gap-2">
                    <input type="text" value={resetPwValue} onChange={(e) => setResetPwValue(e.target.value)}
                      placeholder="New password (min 12 chars)..."
                      className="flex-1 px-3 py-2 rounded-lg bg-white border border-amber-300 text-sm" />
                    <button onClick={() => handleResetPassword(user.id)}
                      disabled={resetPwProcessing || resetPwValue.length < 12}
                      className="px-3 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50">
                      {resetPwProcessing ? 'Resetting...' : 'Reset'}
                    </button>
                    <button onClick={() => { setResetPwUserId(null); setResetPwValue('') }}
                      className="px-3 py-2 rounded-lg bg-tertiary/10 text-primary text-sm">Cancel</button>
                  </div>
                  {resetPwValue.length > 0 && resetPwValue.length < 12 && (
                    <p className="text-xs text-red-500 mt-1">Password must be at least 12 characters</p>
                  )}
                </div>
              ) : resetPwSuccess === user.id ? (
                <div className="p-2 bg-green-50 rounded-lg mb-3 text-sm text-green-700 font-medium">
                  Password reset successfully
                </div>
              ) : null}

              {/* Delete user inline confirmation */}
              {deleteUserId === user.id && (
                <div className="p-3 bg-red-50 rounded-lg mb-3 border border-red-200">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={16} className="text-red-600 shrink-0" />
                    <p className="text-sm text-red-800 font-semibold">Permanently delete this user?</p>
                  </div>
                  <p className="text-xs text-red-700 mb-3">
                    This will delete <span className="font-semibold">{user.first_name} {user.last_name}</span> and all
                    associated data (notes, training, sync queue). This action cannot be undone.
                  </p>
                  <p className="text-xs text-red-700 mb-2">
                    Type <span className="font-mono font-semibold bg-red-100 px-1 py-0.5 rounded">{user.email}</span> to confirm:
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={deleteConfirmEmail}
                      onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                      placeholder="Type email to confirm..."
                      className="flex-1 px-3 py-2 rounded-lg bg-white border border-red-300 text-sm
                                 focus:border-red-500 focus:outline-none transition-colors placeholder:text-tertiary/30"
                      autoComplete="off"
                    />
                    <button
                      onClick={() => handleDeleteUser(user.id, user.email)}
                      disabled={deleteProcessing || deleteConfirmEmail !== user.email}
                      className="px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-medium
                                 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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

              <div className="flex gap-2">
                <button
                  onClick={() => { setEditingUser(user); setView('edit') }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-themeblue2 text-white text-sm font-medium hover:bg-themeblue2/90 transition-colors"
                >
                  <Pencil size={14} /> Edit
                </button>
                <button
                  onClick={() => { setResetPwUserId(user.id); setResetPwValue(''); setResetPwSuccess(null) }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-tertiary/10 text-primary text-sm font-medium hover:bg-tertiary/20 transition-colors"
                >
                  <KeyRound size={14} /> Reset Password
                </button>
                {currentUserId !== user.id && (
                  <button
                    onClick={() => { setDeleteUserId(user.id); setDeleteConfirmEmail(''); setResetPwUserId(null) }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-sm font-medium
                               hover:bg-red-100 border border-red-200 transition-colors"
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                )}
              </div>
            </div>
          ))}
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
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
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
          className="w-full px-4 py-3 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
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
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
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

        <button onClick={handleSave} disabled={saving}
          className="w-full px-4 py-3 rounded-lg bg-themeblue2 text-white font-medium hover:bg-themeblue2/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </>
  )
}

// ─── Main AdminPanel ──────────────────────────────────────────────────

export const AdminPanel = () => {
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'requests' | 'users'>('requests')

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
          <Ban size={48} className="mx-auto mb-4 text-tertiary/40" />
          <h3 className="text-lg font-semibold text-primary mb-2">Access Denied</h3>
          <p className="text-sm text-tertiary/60">You need dev role to access this panel.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-4 py-3 md:p-5">
        {/* Top-level tab bar */}
        <div className="flex gap-2 mb-5">
          {(['requests', 'users'] as const).map((tab) => (
            <button
              key={tab} onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors
                ${activeTab === tab ? 'bg-themeblue2 text-white' : 'bg-themewhite2 text-tertiary/70 hover:bg-themewhite2/80'}`}
            >
              {tab === 'requests' ? 'Requests' : 'Users'}
            </button>
          ))}
        </div>

        {activeTab === 'requests' ? <RequestsTab /> : <UsersTab />}
      </div>
    </div>
  )
}
