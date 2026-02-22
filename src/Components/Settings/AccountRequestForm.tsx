import { useState } from 'react'
import type { Component } from '../../Data/User'
import { credentials, components, ranksByComponent } from '../../Data/User'
import { submitAccountRequest, checkRequestStatus, type AccountRequest } from '../../lib/accountRequestService'

const LOCAL_STORAGE_TOKEN_KEY = 'adtmc_request_token'
const LOCAL_STORAGE_EMAIL_KEY = 'adtmc_request_email'

const TextInput = ({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  required = false,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (val: string) => void
  placeholder?: string
  maxLength?: number
  required?: boolean
  type?: string
}) => (
  <label className="block">
    <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">
      {label} {required && <span className="text-red-500">*</span>}
    </span>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      required={required}
      className="mt-1 w-full px-3 py-2.5 rounded-lg bg-themewhite2 text-primary text-base
                 border border-tertiary/10 focus:border-themeblue2 focus:outline-none
                 transition-colors placeholder:text-tertiary/30"
    />
  </label>
)

const SelectInput = ({
  label,
  value,
  onChange,
  options,
  placeholder,
  required = false,
}: {
  label: string
  value: string
  onChange: (val: string) => void
  options: readonly string[]
  placeholder?: string
  required?: boolean
}) => (
  <label className="block">
    <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">
      {label} {required && <span className="text-red-500">*</span>}
    </span>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      className="mt-1 w-full px-3 py-2.5 rounded-lg bg-themewhite2 text-primary text-base
                 border border-tertiary/10 focus:border-themeblue2 focus:outline-none
                 transition-colors appearance-none"
    >
      <option value="">{placeholder ?? 'Select...'}</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  </label>
)

/**
 * Saves the status check token to localStorage so the user can check
 * their request status later (even after closing the browser).
 */
function saveTokenLocally(email: string, token: string) {
  try {
    localStorage.setItem(LOCAL_STORAGE_TOKEN_KEY, token)
    localStorage.setItem(LOCAL_STORAGE_EMAIL_KEY, email)
  } catch {
    // localStorage may be unavailable in some contexts
  }
}

function getSavedToken(): { email: string; token: string } | null {
  try {
    const token = localStorage.getItem(LOCAL_STORAGE_TOKEN_KEY)
    const email = localStorage.getItem(LOCAL_STORAGE_EMAIL_KEY)
    if (token && email) return { email, token }
  } catch {
    // localStorage may be unavailable
  }
  return null
}

export const AccountRequestForm = () => {
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [middleInitial, setMiddleInitial] = useState('')
  const [credential, setCredential] = useState('')
  const [component, setComponent] = useState('')
  const [rank, setRank] = useState('')
  const [uic, setUic] = useState('')
  const [notes, setNotes] = useState('')

  // Token for status checks (returned after submission)
  const [statusCheckToken, setStatusCheckToken] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [requestStatus, setRequestStatus] = useState<AccountRequest | null>(null)

  const componentRanks = component ? ranksByComponent[component as Component] : []

  const handleComponentChange = (val: string) => {
    setComponent(val)
    if (val && rank && !ranksByComponent[val as Component]?.includes(rank)) {
      setRank('')
    }
  }

  const handleCheckStatus = async () => {
    // Try using the token from state first, then fall back to localStorage
    let checkEmail = email
    let checkToken = statusCheckToken

    if (!checkToken) {
      const saved = getSavedToken()
      if (saved) {
        checkEmail = saved.email
        checkToken = saved.token
        setEmail(saved.email)
        setStatusCheckToken(saved.token)
      }
    }

    if (!checkEmail || !checkToken) {
      setError('Both email and status check token are required. Enter the token you received when you submitted your request.')
      return
    }

    setError(null)
    const status = await checkRequestStatus(checkEmail, checkToken)
    setRequestStatus(status)

    if (!status) {
      setError('No matching request found. Verify your email and token are correct.')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const result = await submitAccountRequest({
      email,
      firstName,
      lastName,
      middleInitial: middleInitial || undefined,
      credential: credential || undefined,
      component: component || undefined,
      rank: rank || undefined,
      uic,
      notes: notes || undefined,
    })

    setSubmitting(false)

    if (result.success && result.statusCheckToken) {
      setSubmitted(true)
      setStatusCheckToken(result.statusCheckToken)
      saveTokenLocally(email, result.statusCheckToken)
      setRequestStatus({
        id: result.requestId || '',
        email,
        first_name: firstName,
        last_name: lastName,
        middle_initial: middleInitial || null,
        credential: credential || null,
        rank: rank || null,
        component: component || null,
        uic,
        status: 'pending',
        request_type: 'new_account',
        status_check_token: result.statusCheckToken,
        user_id: null,
        requested_at: new Date().toISOString(),
        reviewed_at: null,
        rejection_reason: null,
        notes: notes || null,
      })
    } else {
      setError(result.error || 'Failed to submit request')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'approved':
        return 'text-green-600 bg-green-50 border-green-200'
      case 'rejected':
        return 'text-red-600 bg-red-50 border-red-200'
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  if (requestStatus) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="px-4 py-3 md:p-5">
          <h2 className="text-lg font-semibold text-primary mb-4">Account Request Status</h2>

          <div className={`p-4 rounded-lg border ${getStatusColor(requestStatus.status)}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium uppercase tracking-wide">
                {requestStatus.status}
              </span>
              <span className="text-xs opacity-75">
                {new Date(requestStatus.requested_at).toLocaleDateString()}
              </span>
            </div>

            <p className="text-sm mb-2">
              <strong>Email:</strong> {requestStatus.email}
            </p>
            <p className="text-sm mb-2">
              <strong>Name:</strong> {requestStatus.first_name} {requestStatus.middle_initial}{' '}
              {requestStatus.last_name}
            </p>
            {requestStatus.rank && (
              <p className="text-sm mb-2">
                <strong>Rank:</strong> {requestStatus.rank}
              </p>
            )}
            {requestStatus.component && (
              <p className="text-sm mb-2">
                <strong>Component:</strong> {requestStatus.component}
              </p>
            )}
            {requestStatus.uic && (
              <p className="text-sm mb-2">
                <strong>UIC:</strong> {requestStatus.uic}
              </p>
            )}

            {requestStatus.status === 'pending' && (
              <p className="text-sm mt-3 italic">
                Your request is pending review. You will be notified once it's approved.
              </p>
            )}

            {requestStatus.status === 'approved' && (
              <p className="text-sm mt-3 italic">
                Your request has been approved! Check your email for login instructions.
              </p>
            )}

            {requestStatus.status === 'rejected' && requestStatus.rejection_reason && (
              <div className="mt-3">
                <p className="text-sm font-medium">Reason:</p>
                <p className="text-sm italic">{requestStatus.rejection_reason}</p>
              </div>
            )}
          </div>

          <button
            onClick={() => {
              setRequestStatus(null)
              setSubmitted(false)
            }}
            className="mt-4 px-4 py-2 rounded-lg bg-themeblue2 text-white font-medium
                     hover:bg-themeblue2/90 transition-colors"
          >
            Back
          </button>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="px-4 py-3 md:p-5">
          <div className="text-center py-8">
            <h2 className="text-xl font-semibold text-primary mb-2">Request Submitted!</h2>
            <p className="text-tertiary/70 mb-4">
              Your account request has been submitted. An administrator will review it shortly.
            </p>

            {statusCheckToken && (
              <div className="mb-6 p-4 rounded-lg bg-blue-50 border border-blue-200 text-left">
                <p className="text-sm font-medium text-blue-800 mb-2">
                  Save your status check token:
                </p>
                <code className="block p-2 bg-white rounded border border-blue-200 text-xs font-mono text-blue-900 break-all select-all">
                  {statusCheckToken}
                </code>
                <p className="text-xs text-blue-600 mt-2">
                  You will need this token along with your email to check your request status.
                  It has been saved to your browser, but you should copy it somewhere safe in case
                  you clear your browser data.
                </p>
              </div>
            )}

            <button
              onClick={() => handleCheckStatus()}
              className="px-4 py-2 rounded-lg bg-themeblue2 text-white font-medium
                       hover:bg-themeblue2/90 transition-colors"
            >
              Check Request Status
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-4 py-3 md:p-5">
        <h2 className="text-lg font-semibold text-primary mb-2">Account Requests</h2>

        <div className="mb-6 p-4 rounded-lg bg-yellow-50 border border-yellow-200">
          <p className="text-sm font-medium text-yellow-800 mb-1">
            New account creation currently disabled for beta testing
          </p>
          <p className="text-xs text-yellow-700">
            We are not accepting new account requests at this time. Existing users are unaffected.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="pt-2 border-t border-tertiary/10">
          <p className="text-sm text-tertiary/60 mb-3">Already submitted a request?</p>
          <div className="space-y-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your.email@mail.mil"
              className="w-full px-3 py-2 rounded-lg bg-themewhite2 text-primary text-sm
                       border border-tertiary/10 focus:border-themeblue2 focus:outline-none"
            />
            <input
              type="text"
              value={statusCheckToken}
              onChange={(e) => setStatusCheckToken(e.target.value)}
              placeholder="Status check token (from submission)"
              className="w-full px-3 py-2 rounded-lg bg-themewhite2 text-primary text-sm font-mono
                       border border-tertiary/10 focus:border-themeblue2 focus:outline-none"
            />
            <button
              onClick={handleCheckStatus}
              className="w-full px-4 py-2 rounded-lg bg-tertiary/10 text-primary font-medium
                       hover:bg-tertiary/20 transition-colors text-sm"
            >
              Check Status
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
