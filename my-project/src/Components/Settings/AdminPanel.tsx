import { useState, useEffect } from 'react'
import { Check, X, UserPlus, Clock, Ban } from 'lucide-react'
import {
  getAllAccountRequests,
  approveAccountRequest,
  rejectAccountRequest,
  isDevUser,
} from '../../lib/adminService'
import type { AccountRequest } from '../../lib/accountRequestService'

export const AdminPanel = () => {
  const [requests, setRequests] = useState<AccountRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')
  const [isAdmin, setIsAdmin] = useState(false)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  useEffect(() => {
    const checkAdminAndLoadRequests = async () => {
      const isDev = await isDevUser()
      setIsAdmin(isDev)

      if (isDev) {
        await loadRequests()
      }
      setLoading(false)
    }

    checkAdminAndLoadRequests()
  }, [filter])

  const loadRequests = async () => {
    setLoading(true)
    const data = await getAllAccountRequests(
      filter === 'all' ? undefined : filter
    )
    setRequests(data)
    setLoading(false)
  }

  const handleApprove = async (requestId: string) => {
    setProcessingId(requestId)
    const result = await approveAccountRequest(requestId)

    if (result.success) {
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
          <p className="text-sm text-tertiary/60">
            You need dev role to access this panel.
          </p>
        </div>
      </div>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-700 border-yellow-300'
      case 'approved':
        return 'bg-green-100 text-green-700 border-green-300'
      case 'rejected':
        return 'bg-red-100 text-red-700 border-red-300'
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300'
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-4 py-3 md:p-5">
        <p className="text-sm text-tertiary/60 mb-4">
          Review and approve account requests
        </p>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          {(['pending', 'approved', 'rejected', 'all'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap
                ${
                  filter === tab
                    ? 'bg-themeblue2 text-white'
                    : 'bg-themewhite2 text-tertiary/70 hover:bg-themewhite2/80'
                }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Requests List */}
        {requests.length === 0 ? (
          <div className="text-center py-12">
            <Clock size={48} className="mx-auto mb-4 text-tertiary/40" />
            <p className="text-tertiary/60">
              No {filter !== 'all' ? filter : ''} requests found
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((request) => (
              <div
                key={request.id}
                className="p-4 rounded-lg border border-tertiary/10 bg-themewhite2"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-primary">
                        {request.first_name} {request.middle_initial}{' '}
                        {request.last_name}
                      </h4>
                    </div>
                    <p className="text-sm text-tertiary/70">{request.email}</p>
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium border ${
                        request.request_type === 'profile_change'
                          ? 'bg-blue-100 text-blue-700 border-blue-300'
                          : 'bg-purple-100 text-purple-700 border-purple-300'
                      }`}
                    >
                      {request.request_type === 'profile_change' ? 'CHANGE' : 'NEW'}
                    </span>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(
                        request.status
                      )}`}
                    >
                      {request.status.toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Details */}
                <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                  {request.credential && (
                    <div>
                      <span className="text-tertiary/60">Credential:</span>{' '}
                      <span className="text-primary font-medium">
                        {request.credential}
                      </span>
                    </div>
                  )}
                  {request.rank && (
                    <div>
                      <span className="text-tertiary/60">Rank:</span>{' '}
                      <span className="text-primary font-medium">{request.rank}</span>
                    </div>
                  )}
                  {request.component && (
                    <div>
                      <span className="text-tertiary/60">Component:</span>{' '}
                      <span className="text-primary font-medium">
                        {request.component}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="text-tertiary/60">UIC:</span>{' '}
                    <span className="text-primary font-medium">{request.uic}</span>
                  </div>
                </div>

                {request.notes && (
                  <div className="mb-3 p-2 bg-themewhite rounded text-sm">
                    <span className="text-tertiary/60">Notes:</span>{' '}
                    <span className="text-primary">{request.notes}</span>
                  </div>
                )}

                <div className="text-xs text-tertiary/50 mb-3">
                  Requested: {new Date(request.requested_at).toLocaleString()}
                </div>

                {/* Actions */}
                {request.status === 'pending' && (
                  <div className="flex gap-2">
                    {rejectingId === request.id ? (
                      <div className="flex-1 flex gap-2">
                        <input
                          type="text"
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="Rejection reason..."
                          className="flex-1 px-3 py-2 rounded-lg bg-themewhite border border-tertiary/10 text-sm"
                        />
                        <button
                          onClick={() => handleReject(request.id)}
                          disabled={processingId === request.id}
                          className="px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-medium
                                   hover:bg-red-700 disabled:opacity-50"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => {
                            setRejectingId(null)
                            setRejectReason('')
                          }}
                          className="px-3 py-2 rounded-lg bg-tertiary/10 text-primary text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => handleApprove(request.id)}
                          disabled={processingId === request.id}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg
                                   bg-green-600 text-white font-medium hover:bg-green-700
                                   disabled:opacity-50 transition-colors"
                        >
                          <Check size={16} />
                          Approve
                        </button>
                        <button
                          onClick={() => setRejectingId(request.id)}
                          disabled={processingId === request.id}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg
                                   bg-red-600 text-white font-medium hover:bg-red-700
                                   disabled:opacity-50 transition-colors"
                        >
                          <X size={16} />
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                )}

                {request.status === 'approved' && (
                  <div className="p-3 bg-green-50 rounded-lg text-sm">
                    <div className="flex items-center gap-2 text-green-700 mb-2">
                      <UserPlus size={16} />
                      <span className="font-medium">Next Step:</span>
                    </div>
                    <p className="text-green-600 text-xs">
                      Create account in Supabase Dashboard → Authentication → Invite User
                      <br />
                      Email: <span className="font-mono">{request.email}</span>
                    </p>
                  </div>
                )}

                {request.status === 'rejected' && request.rejection_reason && (
                  <div className="p-3 bg-red-50 rounded-lg text-sm">
                    <span className="text-red-700 font-medium">Reason:</span>
                    <p className="text-red-600 text-xs mt-1">
                      {request.rejection_reason}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
