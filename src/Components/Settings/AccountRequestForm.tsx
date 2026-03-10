import { useState } from 'react'
import type { Component } from '../../Data/User'
import { credentials, components, ranksByComponent } from '../../Data/User'
import { submitAccountRequest, checkRequestStatus, type AccountRequest } from '../../lib/accountRequestService'
import { TextInput, SelectInput } from '../FormInputs'
import { ErrorDisplay } from '../ErrorDisplay'
import { validatePasswordComplexity } from '../../lib/constants'

const LOCAL_STORAGE_TOKEN_KEY = 'account_request_token'
const LOCAL_STORAGE_EMAIL_KEY = 'account_request_email'

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
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

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
    setError(null)

    const pwError = validatePasswordComplexity(password)
    if (pwError) { setError(pwError); return }
    if (password !== confirmPassword) { setError('Passwords do not match'); return }

    setSubmitting(true)

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
      password,
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
        return 'text-themeyellow bg-themeyellow/10 border-themeyellow/20'
      case 'approved':
        return 'text-themegreen bg-themegreen/10 border-themegreen/20'
      case 'rejected':
        return 'text-themeredred bg-themeredred/10 border-themeredred/20'
      default:
        return 'text-tertiary bg-tertiary/10 border-tertiary/20'
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
                Your account has been approved! You can now sign in with your email and the password you set when you submitted your request.
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
            className="mt-4 px-4 py-2 rounded-lg bg-themeblue3 text-white font-medium
                     hover:bg-themeblue3/90 transition-colors"
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
              <div className="mb-6 p-4 rounded-lg bg-themeblue2/10 border border-themeblue2/20 text-left">
                <p className="text-sm font-medium text-themeblue3 mb-2">
                  Save your status check token:
                </p>
                <code className="block p-2 bg-themewhite rounded border border-themeblue2/20 text-xs font-mono text-themeblue3 break-all select-all">
                  {statusCheckToken}
                </code>
                <p className="text-xs text-themeblue2 mt-2">
                  You will need this token along with your email to check your request status.
                  It has been saved to your browser, but you should copy it somewhere safe in case
                  you clear your browser data.
                </p>
              </div>
            )}

            <button
              onClick={() => handleCheckStatus()}
              className="px-4 py-2 rounded-lg bg-themeblue3 text-white font-medium
                       hover:bg-themeblue3/90 transition-colors"
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
        <h2 className="text-lg font-semibold text-primary mb-2">Request an Account</h2>
        <p className="text-xs text-tertiary/60 mb-4">
          An account lets you log training completion and store your preferences. No patient data is collected.
        </p>

        {error && <ErrorDisplay message={error} />}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <TextInput label="Email" value={email} onChange={setEmail} placeholder="your.email@mail.mil" type="email" required />
          </div>

          <TextInput label="First Name" value={firstName} onChange={setFirstName} required />
          <TextInput label="Last Name" value={lastName} onChange={setLastName} required />

          <div className="w-20">
            <TextInput label="MI" value={middleInitial} onChange={setMiddleInitial} maxLength={1} />
          </div>
          <TextInput label="UIC" value={uic} onChange={setUic} placeholder="Unit Identification Code" required />

          <SelectInput label="Medical Credential" value={credential} onChange={setCredential} options={credentials} placeholder="Select credential" required />
          <SelectInput label="Component" value={component} onChange={handleComponentChange} options={components} placeholder="Select component" required />

          {component && (
            <SelectInput label="Rank" value={rank} onChange={setRank} options={componentRanks} placeholder="Select rank" required />
          )}

          <div className={component ? '' : 'md:col-span-2'}>
            <TextInput label="Notes (optional)" value={notes} onChange={setNotes} placeholder="Anything else we should know?" />
          </div>

          <div className="md:col-span-2">
            <TextInput label="Password" value={password} onChange={setPassword} type="password" placeholder="Min 12 chars, upper, lower, digit, special" required />
          </div>
          <div className="md:col-span-2">
            <TextInput label="Confirm Password" value={confirmPassword} onChange={setConfirmPassword} type="password" placeholder="Re-enter password" required />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="md:col-span-2 w-full px-4 py-3 rounded-lg bg-themeblue3 text-white font-medium
                     hover:bg-themeblue3/90 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit Request'}
          </button>
        </form>
      </div>
    </div>
  )
}
