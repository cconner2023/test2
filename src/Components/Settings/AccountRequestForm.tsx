import { useState, useEffect, useRef } from 'react'
import { Check, X, RefreshCw, Copy } from 'lucide-react'
import type { Component } from '../../Data/User'
import { submitAccountRequest, checkRequestStatus, checkEmailAvailability, type AccountRequest } from '../../lib/accountRequestService'
import { TextInput, PickerInput, PasswordInput } from '@/Components/primitives/FormInputs'
import { UicPinInput } from '@/Components/DomainInputs'
import { ErrorDisplay } from '@/Components/primitives/ErrorDisplay'
import { ConfirmDialog } from '@/Components/primitives/ConfirmDialog'
import { validatePasswordComplexity } from '../../lib/constants'
import { parseNameFromEmail, componentFromEmail, readRequestDraft, saveRequestDraft, clearRequestDraft } from '../../lib/loginPrefill'
import { SectionCard } from '@/Components/primitives/Section'
import { copyText } from '../../Utilities/clipboardUtils'

const LOCAL_STORAGE_TOKEN_KEY = 'account_request_token'
const LOCAL_STORAGE_EMAIL_KEY = 'account_request_email'

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
  /** Whatever the user already typed on the sign-in card, so they type it once. */
  initialEmail?: string
  /** Hand the address back to the sign-in card when it turns out to already have
   *  an account — the recovery is one tap, not a retype. */
  onSignIn?: (email: string) => void
}

/** Where the typed address stands with the server. The rest of the form is only
 *  worth filling in once this reaches `available`. */
type EmailStatus = 'idle' | 'checking' | 'available' | 'account_exists' | 'pending_request'

/** "first name", "first name and last name", "first name, last name and component" */
function joinLabels(labels: string[]): string {
  if (labels.length <= 1) return labels[0] ?? ''
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`
}

export const AccountRequestForm = ({ onBack, initialEmail = '', onSignIn }: AccountRequestFormProps) => {
  // An unfinished request from an earlier visit outranks the handed-in email —
  // it is the more specific thing the user already did.
  const [seed] = useState(() => readRequestDraft())

  const [email, setEmail] = useState(seed?.email || initialEmail)
  const [firstName, setFirstName] = useState(seed?.firstName ?? '')
  const [lastName, setLastName] = useState(seed?.lastName ?? '')
  const [middleInitial, setMiddleInitial] = useState(seed?.middleInitial ?? '')
  const [credential, setCredential] = useState(seed?.credential ?? '')
  // Army platform, Army-majority userbase — the picker starts on USA rather than
  // empty, which also lets the dependent Rank picker render from the first paint.
  const [component, setComponent] = useState(seed?.component || 'USA')
  // Once the user picks a component themselves, a .mil domain no longer overrides it.
  const componentTouched = useRef(!!seed?.component)
  const [rank, setRank] = useState(seed?.rank ?? '')
  const [uic, setUic] = useState(seed?.uic ?? '')
  const [notes, setNotes] = useState(seed?.notes ?? '')
  const [contactConsent, setContactConsent] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [draftRestored, setDraftRestored] = useState(!!seed)
  const [prefillNote, setPrefillNote] = useState<string | null>(null)

  const [statusCheckToken, setStatusCheckToken] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDuplicateError, setIsDuplicateError] = useState(false)
  const [showEmailConfirm, setShowEmailConfirm] = useState(false)
  const [emailStatus, setEmailStatus] = useState<EmailStatus>('idle')
  // Cluster the UIC resolved to when the server provisioned the account outright.
  // Null means this submission went to the review queue like always.
  const [autoApprovedClinic, setAutoApprovedClinic] = useState<string | null>(null)
  // Discards in-flight checks whose address is already stale.
  const emailCheckSeq = useRef(0)
  const emailBlocked = emailStatus === 'account_exists' || emailStatus === 'pending_request'
  const [requestStatus, setRequestStatus] = useState<AccountRequest | null>(null)

  const [userData, setUserData] = useState<{
    credentials: string[]
    components: string[]
    ranksByComponent: Record<string, string[]>
  } | null>(null)

  useEffect(() => {
    import('../../Data/User').then((mod) => {
      setUserData({
        credentials: [...mod.credentials],
        components: [...mod.components],
        ranksByComponent: Object.fromEntries(
          Object.entries(mod.ranksByComponent).map(([k, v]) => [k, [...v]])
        ),
      })
    })
  }, [])

  const componentRanks = component && userData
    ? userData.ranksByComponent[component] ?? []
    : []

  const handleComponentChange = (val: string) => {
    componentTouched.current = true
    setComponent(val)
    if (val && rank && !userData?.ranksByComponent[val]?.includes(rank)) {
      setRank('')
    }
  }

  // Persist everything but the secrets, so a backgrounded tab or an accidental
  // back-swipe costs nothing. Debounced because this runs on every keystroke.
  useEffect(() => {
    if (submitted) return
    const t = window.setTimeout(() => {
      saveRequestDraft({ email, firstName, lastName, middleInitial, credential, component, rank, uic, notes })
    }, 400)
    return () => window.clearTimeout(t)
  }, [email, firstName, lastName, middleInitial, credential, component, rank, uic, notes, submitted])

  /**
   * Fill what the address already tells us — DoD local parts carry a name and DoD
   * domains carry a component. Only ever fills fields the user left blank, and
   * every fill is announced so a bad guess is visible rather than submitted.
   */
  const applyEmailDerived = (raw: string) => {
    const derived = parseNameFromEmail(raw)
    const filled: string[] = []

    if (derived.firstName && !firstName) { setFirstName(derived.firstName); filled.push('first name') }
    if (derived.lastName && !lastName) { setLastName(derived.lastName); filled.push('last name') }
    if (derived.middleInitial && !middleInitial) { setMiddleInitial(derived.middleInitial); filled.push('middle initial') }

    // A sister-service domain corrects the USA default, but only while the user
    // hasn't set the component themselves.
    const fromDomain = componentFromEmail(raw)
    if (fromDomain && fromDomain !== component && !componentTouched.current) {
      setComponent(fromDomain)
      if (rank && !userData?.ranksByComponent[fromDomain]?.includes(rank)) setRank('')
      filled.push('component')
    }

    if (filled.length) {
      setPrefillNote(`Filled ${joinLabels(filled)} in from your email. Change anything we got wrong.`)
    }
  }

  // A carried-over email from the sign-in card is worth deriving from immediately —
  // the user never touches the field, so there is no blur to wait for.
  useEffect(() => {
    if (!seed && initialEmail.includes('@')) applyEmailDerived(initialEmail)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Drop the restored draft — this is a different person, or a fresh start. */
  const startOver = () => {
    clearRequestDraft()
    setDraftRestored(false)
    setPrefillNote(null)
    setEmail('')
    setFirstName('')
    setLastName('')
    setMiddleInitial('')
    setCredential('')
    setComponent('USA')
    componentTouched.current = false
    setRank('')
    setUic('')
    setNotes('')
    setEmailStatus('idle')
    setError(null)
  }

  /**
   * The address decides whether the rest of the form is worth filling in, so it is
   * checked the moment it looks like an address rather than at submit — finding out
   * you already have an account should not cost you ten more fields of work.
   */
  const runEmailCheck = async (raw: string) => {
    const trimmed = raw.trim()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
      emailCheckSeq.current++
      setEmailStatus('idle')
      return
    }
    const seq = ++emailCheckSeq.current
    setEmailStatus('checking')
    const result = await checkEmailAvailability(trimmed)
    if (seq !== emailCheckSeq.current) return
    if (result.available) {
      setEmailStatus('available')
    } else {
      setEmailStatus(result.reason === 'account_exists' ? 'account_exists' : 'pending_request')
    }
  }

  // Debounced so it tracks typing; also covers an address carried in from the
  // sign-in card, which the user never touches and so never blurs.
  useEffect(() => {
    const t = window.setTimeout(() => { runEmailCheck(email) }, 500)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email])

  const handleEmailBlur = () => {
    const trimmed = email.trim()
    if (!trimmed.includes('@')) return
    applyEmailDerived(trimmed)
    runEmailCheck(trimmed)
  }

  const handleCheckStatus = async () => {
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (emailBlocked) return

    const pwError = validatePasswordComplexity(password)
    if (pwError) { setError(pwError); return }
    if (password !== confirmPassword) { setError('Passwords do not match'); return }

    // Catch email typos before an account gets baked with a wrong address —
    // surface the typed email for a final visual check.
    setShowEmailConfirm(true)
  }

  const doSubmit = async () => {
    setShowEmailConfirm(false)
    setError(null)
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
      clearRequestDraft()
      if (result.autoApproved) setAutoApprovedClinic(result.clinicName || '')
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
        status: result.autoApproved ? 'approved' : 'pending',
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
                <span className="text-[10pt] text-secondary">
                  {new Date(requestStatus.requested_at).toLocaleDateString()}
                </span>
              </div>
              <p className="text-[10pt] text-secondary">{requestStatus.email}</p>
              {(requestStatus.rank || requestStatus.component) && (
                <p className="text-[10pt] text-secondary">
                  {[requestStatus.rank, requestStatus.component, requestStatus.uic].filter(Boolean).join(' · ')}
                </p>
              )}
              <div className="pt-2 border-t border-tertiary/10">
                <p className="text-[10pt] text-secondary">
                  {requestStatus.status === 'pending' && 'Your request is pending review. You will be notified once approved.'}
                  {requestStatus.status === 'approved' && 'Your account has been approved. Sign in with your email and the password you created.'}
                  {requestStatus.status === 'rejected' && (requestStatus.rejection_reason
                    ? `Request declined — ${requestStatus.rejection_reason}`
                    : 'Your request was not approved.')}
                </p>
                {autoApprovedClinic !== null && (
                  <p className="text-[9pt] text-secondary mt-1.5">
                    {autoApprovedClinic
                      ? `Your UIC is already registered to ${autoApprovedClinic}, so no review was needed.`
                      : 'Your UIC is already registered, so no review was needed.'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* An approved account is one tap from being used, so the address rides
              back to the sign-in card rather than being retyped. */}
          {requestStatus.status === 'approved' && onSignIn ? (
            <button
              onClick={() => onSignIn(requestStatus.email || email.trim())}
              className="mt-3 w-full px-4 py-2 rounded-full bg-themeblue3 text-white text-sm font-medium
                       active:scale-95 transition-transform"
            >
              Sign in
            </button>
          ) : (
            <button
              onClick={() => onBack?.()}
              className="w-full text-[10pt] text-themeblue2 hover:underline mt-3 active:scale-95 transition-all"
            >
              Back to sign in
            </button>
          )}
      </div>
    )
  }

  if (submitted) {
    return (
      <div>
        <div className="rounded-xl border border-tertiary/15 p-5">
          <div className="space-y-3">
            <p className="text-sm font-medium text-primary">Request Submitted</p>
            <p className="text-[10pt] text-secondary">
              An administrator will review your request shortly.
            </p>
            <p className="text-[9pt] text-secondary">
              Approval arrives by email — if you don't see it, check your junk or spam folder.
            </p>

            {statusCheckToken && (
              <div className="pt-2 border-t border-tertiary/10 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10pt] text-secondary">Status check token</p>
                  <button
                    type="button"
                    onClick={() => void copyText(statusCheckToken, 'Token copied')}
                    className="shrink-0 flex items-center gap-1 text-[9pt] text-themeblue2 active:scale-95 transition-transform"
                  >
                    <Copy size={12} />
                    Copy
                  </button>
                </div>
                <code className="block p-2 rounded-lg border border-tertiary/10 text-[10pt] font-mono text-primary break-all select-all">
                  {statusCheckToken}
                </code>
                <p className="text-[9pt] text-secondary">
                  Already saved on this device — Check Request Status will find it on its own. The copy is for when you switch devices.
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
          className="w-full text-[10pt] text-themeblue2 hover:underline mt-3 active:scale-95 transition-all"
        >
          Back to sign in
        </button>
      </div>
    )
  }

  if (!userData) return null

  const passwordIssue = password ? validatePasswordComplexity(password) : null
  const confirmIssue = confirmPassword && password !== confirmPassword ? 'Passwords do not match' : null
  const identityReady = firstName.trim() && lastName.trim() && email.trim() && credential && component && uic.trim().length === 6 && contactConsent && notes.trim()
  const canSubmit = !!identityReady && !!password && !passwordIssue && !!confirmPassword && !confirmIssue && emailStatus === 'available'

  return (
    <div>

      {error && (
        <div className="mb-3">
          <ErrorDisplay message={error} />
          {isDuplicateError && (
            <button
              type="button"
              onClick={handleCheckStatus}
              className="mt-2 w-full px-4 py-2 rounded-full bg-themeblue3 text-white text-sm font-medium
                       active:scale-95 transition-transform"
            >
              Check Request Status
            </button>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <SectionCard>
          {draftRestored && (
            <div className="flex items-start justify-between gap-3 px-4 pt-3 pb-2.5 border-b border-primary/6">
              <p className="text-[9pt] text-secondary leading-snug">
                Picked up where you left off — nothing you typed was lost.
              </p>
              <button
                type="button"
                onClick={startOver}
                className="shrink-0 text-[9pt] text-themeblue2 active:scale-95 transition-transform"
              >
                Start over
              </button>
            </div>
          )}

          <TextInput
            value={email}
            onChange={(val) => { setEmail(val); setIsDuplicateError(false) }}
            onBlur={handleEmailBlur}
            placeholder="Email *"
            type="email"
            inputMode="email"
            name="email"
            autoComplete="email"
            required
          />

          {emailStatus === 'checking' && (
            <p className="px-4 py-2.5 text-[9pt] text-secondary border-b border-primary/6">Checking this address…</p>
          )}

          {/* The address is already spoken for, so the rest of the form is withheld
              and replaced by the action that actually helps. */}
          {emailBlocked && (
            <div className="px-4 py-3">
              <p className="text-[10pt] text-primary leading-relaxed">
                {emailStatus === 'account_exists'
                  ? 'This address already has an account.'
                  : 'A request for this address is already waiting on review. Approval arrives by email.'}
              </p>
              {/* No button in the pending case without a token on this device — it
                  would only route to "enter your token", which they don't have. */}
              {(emailStatus === 'account_exists' || getSavedToken()) && (
                <button
                  type="button"
                  onClick={() => {
                    if (emailStatus === 'account_exists') {
                      if (onSignIn) onSignIn(email.trim())
                      else onBack?.()
                    } else {
                      handleCheckStatus()
                    }
                  }}
                  className="mt-2.5 w-full px-4 py-2 rounded-full bg-themeblue3 text-white text-sm font-medium
                           active:scale-95 transition-transform"
                >
                  {emailStatus === 'account_exists' ? 'Sign in instead' : 'Check request status'}
                </button>
              )}
            </div>
          )}

          {!emailBlocked && (<>
          {prefillNote && (
            <div className="flex items-start justify-between gap-3 px-4 py-2.5 border-b border-primary/6">
              <p className="text-[9pt] text-secondary leading-snug">{prefillNote}</p>
              <button
                type="button"
                onClick={() => setPrefillNote(null)}
                aria-label="Dismiss"
                className="shrink-0 text-tertiary active:scale-95 transition-transform"
              >
                <X size={13} />
              </button>
            </div>
          )}

          <TextInput value={firstName} onChange={setFirstName} placeholder="First Name *" name="given-name" autoComplete="given-name" required />
          <div className="flex items-stretch border-b border-primary/6">
            <div className="flex-1 min-w-0">
              <TextInput value={lastName} onChange={setLastName} placeholder="Last Name *" name="family-name" autoComplete="family-name" required />
            </div>
            <div className="w-16 shrink-0 border-l border-primary/6">
              <TextInput value={middleInitial} onChange={setMiddleInitial} placeholder="MI" maxLength={1} />
            </div>
          </div>

          <PickerInput value={credential} onChange={setCredential} options={userData.credentials} placeholder="Medical Credential *" required />
          <PickerInput value={component} onChange={handleComponentChange} options={userData.components} placeholder="Component *" required />
          {component && (
            <PickerInput value={rank} onChange={setRank} options={componentRanks} placeholder="Rank *" required />
          )}

          <UicPinInput value={uic} onChange={setUic} spread />

          <TextInput value={notes} onChange={setNotes} placeholder="Unit & justification *" required />

          <PasswordInput
            value={password}
            onChange={setPassword}
            placeholder="Password *"
            name="new-password"
            autoComplete="new-password"
          />
          <PasswordInput
            value={confirmPassword}
            onChange={setConfirmPassword}
            placeholder="Confirm Password *"
            name="confirm-password"
            autoComplete="new-password"
            hint={confirmIssue}
          />

          <label className="flex items-start gap-2.5 cursor-pointer px-4 py-3 border-b border-primary/6 active:scale-[0.98] transition-transform select-none">
            <input
              type="checkbox"
              checked={contactConsent}
              onChange={(e) => setContactConsent(e.target.checked)}
              className="sr-only peer"
            />
            <div className={`relative w-5 h-5 shrink-0 mt-0.5 rounded border transition-colors duration-200 ${
              contactConsent ? 'bg-themeblue3 border-themeblue3' : 'border-themeblue3/20 bg-themewhite'
            }`}>
              {contactConsent && <Check size={14} className="absolute inset-0 m-auto text-white" />}
            </div>
            <span className="text-[9pt] text-secondary leading-tight">
              I agree to be contacted by the developer at the email provided if my UIC cannot be verified.
            </span>
          </label>
          </>)}

          <div className="flex items-center justify-end gap-2 px-3 py-2">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all"
              >
                <X size={16} />
              </button>
            )}
            <button
              type="submit"
              disabled={submitting}
              className={`shrink-0 h-9 rounded-full flex items-center justify-center bg-themeblue3 text-white overflow-hidden transition-all duration-300 ease-out active:scale-95 ${canSubmit ? 'w-9 opacity-100' : 'w-0 opacity-0 pointer-events-none'}`}
            >
              {submitting ? <RefreshCw size={14} className="animate-spin" /> : <Check size={16} />}
            </button>
          </div>
        </SectionCard>
      </form>

      <ConfirmDialog
        visible={showEmailConfirm}
        variant="primary"
        title="Is your email correct?"
        subtitle={`Approval and sign-in use this address — check it for typos:  ${email.trim()}`}
        confirmLabel="Yes, submit request"
        cancelLabel="Edit email"
        processing={submitting}
        onConfirm={doSubmit}
        onCancel={() => setShowEmailConfirm(false)}
      />
    </div>
  )
}
