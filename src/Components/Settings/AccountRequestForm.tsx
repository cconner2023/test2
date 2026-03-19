import { useState } from 'react'
import type { Component } from '../../Data/User'
import { credentials, components, ranksByComponent } from '../../Data/User'
import { submitAccountRequest, checkRequestStatus, checkEmailAvailability, type AccountRequest } from '../../lib/accountRequestService'
import { TextInput, PickerInput } from '../FormInputs'
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

interface AccountRequestFormProps {
  onBack?: () => void
}

export const AccountRequestForm = ({ onBack }: AccountRequestFormProps) => {
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
  const [isDuplicateError, setIsDuplicateError] = useState(false)
  const [emailWarning, setEmailWarning] = useState<string | null>(null)
  const [checkingEmail, setCheckingEmail] = useState(false)
  const [requestStatus, setRequestStatus] = useState<AccountRequest | null>(null)

  const componentRanks = component ? ranksByComponent[component as Component] : []

  const handleComponentChange = (val: string) => {
    setComponent(val)
    if (val && rank && !ranksByComponent[val as Component]?.includes(rank)) {
      setRank('')
    }
  }

  const handleEmailBlur = async () => {
    const trimmed = email.trim()
    if (!trimmed || !trimmed.includes('@')) {
      setEmailWarning(null)
      return
    }
    setCheckingEmail(true)
    setEmailWarning(null)
    const result = await checkEmailAvailability(trimmed)
    setCheckingEmail(false)
    if (!result.available) {
      if (result.reason === 'account_exists') {
        setEmailWarning('An account with this email already exists. Please sign in instead.')
      } else if (result.reason === 'pending_request') {
        setEmailWarning('A pending request for this email already exists.')
        setIsDuplicateError(true)
      }
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

    if (emailWarning) { setError(emailWarning); return }

    const pwError = validatePasswordComplexity(password)
    if (pwError) { setError(pwError); return }
    if (password !== confirmPassword) { setError('Passwords do not match'); return }

    setIsDuplicateError(false)
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
      const errorMsg = result.error || 'Failed to submit request'
      setError(errorMsg)
      if (errorMsg.includes('pending request for this email already exists')) {
        setIsDuplicateError(true)
      }
    }
  }


  if (requestStatus) {
    return (
      <div>
          <div className="rounded-xl border border-tertiary/15 p-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-primary">
                  {requestStatus.first_name} {requestStatus.middle_initial}{' '}{requestStatus.last_name}
                </span>
                <span className="text-xs text-tertiary/40">
                  {new Date(requestStatus.requested_at).toLocaleDateString()}
                </span>
              </div>
              <p className="text-xs text-tertiary/50">{requestStatus.email}</p>
              {(requestStatus.rank || requestStatus.component) && (
                <p className="text-xs text-tertiary/50">
                  {[requestStatus.rank, requestStatus.component, requestStatus.uic].filter(Boolean).join(' · ')}
                </p>
              )}
              <div className="pt-2 border-t border-tertiary/10">
                <p className="text-xs text-tertiary/60">
                  {requestStatus.status === 'pending' && 'Your request is pending review. You will be notified once approved.'}
                  {requestStatus.status === 'approved' && 'Your account has been approved. Sign in with your email and the password you created.'}
                  {requestStatus.status === 'rejected' && (requestStatus.rejection_reason
                    ? `Request declined — ${requestStatus.rejection_reason}`
                    : 'Your request was not approved.')}
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => onBack?.()}
            className="w-full text-xs text-themeblue2 hover:underline mt-3 active:scale-95 transition-all"
          >
            Back to sign in
          </button>
      </div>
    )
  }

  if (submitted) {
    return (
      <div>
        <div className="rounded-xl border border-tertiary/15 p-5">
          <div className="space-y-3">
            <p className="text-sm font-medium text-primary">Request Submitted</p>
            <p className="text-xs text-tertiary/50">
              An administrator will review your request shortly.
            </p>

            {statusCheckToken && (
              <div className="pt-2 border-t border-tertiary/10 space-y-1.5">
                <p className="text-xs text-tertiary/50">Status check token</p>
                <code className="block p-2 rounded-lg border border-tertiary/10 text-xs font-mono text-primary break-all select-all">
                  {statusCheckToken}
                </code>
                <p className="text-[10px] text-tertiary/40">
                  Save this token — you'll need it with your email to check status.
                </p>
              </div>
            )}
          </div>

          <button
            onClick={() => handleCheckStatus()}
            className="mt-4 w-full px-4 py-2 rounded-lg bg-themeblue3 text-white font-medium
                     active:scale-95 transition-all"
          >
            Check Request Status
          </button>
        </div>

        <button
          onClick={() => onBack?.()}
          className="w-full text-xs text-themeblue2 hover:underline mt-3 active:scale-95 transition-all"
        >
          Back to sign in
        </button>
      </div>
    )
  }

  return (
    <div>
      <p className="text-xs text-tertiary/60 mb-4">
        An account lets you log training completion and store your preferences. No patient data is collected.
      </p>

      {error && (
        <div>
          <ErrorDisplay message={error} />
          {isDuplicateError && (
            <button
              type="button"
              onClick={handleCheckStatus}
              className="mt-2 w-full px-4 py-2 rounded-lg bg-themeblue3 text-white text-sm font-medium
                       active:scale-95 transition-transform"
            >
              Check Request Status
            </button>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <TextInput
          value={email}
          onChange={(val) => { setEmail(val); setEmailWarning(null); setIsDuplicateError(false) }}
          onBlur={handleEmailBlur}
          placeholder="Email *"
          type="email"
          required
          hint={checkingEmail ? 'Checking...' : emailWarning}
        />
        {isDuplicateError && emailWarning && (
          <button
            type="button"
            onClick={handleCheckStatus}
            className="-mt-1 w-full px-3 py-2 rounded-lg bg-themeblue3 text-white text-sm font-medium
                     active:scale-95 transition-transform"
          >
            Check Request Status
          </button>
        )}

        <div className="grid grid-cols-2 gap-3">
          <TextInput value={firstName} onChange={setFirstName} placeholder="First Name *" required />
          <TextInput value={lastName} onChange={setLastName} placeholder="Last Name *" required />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="w-20">
            <TextInput value={middleInitial} onChange={setMiddleInitial} placeholder="MI" maxLength={1} />
          </div>
          <TextInput value={uic} onChange={setUic} placeholder="UIC *" required />
        </div>

        <PickerInput value={credential} onChange={setCredential} options={credentials} placeholder="Medical Credential *" required />
        <PickerInput value={component} onChange={handleComponentChange} options={components} placeholder="Component *" required />

        {component && (
          <PickerInput value={rank} onChange={setRank} options={componentRanks} placeholder="Rank *" required />
        )}

        <TextInput value={notes} onChange={setNotes} placeholder="Notes (optional)" />

        <TextInput value={password} onChange={setPassword} type="password" placeholder="Password *" required />
        <TextInput value={confirmPassword} onChange={setConfirmPassword} type="password" placeholder="Confirm Password *" required />

        <button
          type="submit"
          disabled={submitting}
          className="w-full px-4 py-3 rounded-lg bg-themeblue3 text-white font-medium
                   transition-colors disabled:opacity-50"
        >
          {submitting ? 'Submitting...' : 'Submit Request'}
        </button>
      </form>

      {onBack && (
        <button onClick={onBack} className="w-full text-xs text-themeblue2 hover:underline mt-3">
          Back to sign in
        </button>
      )}
    </div>
  )
}
