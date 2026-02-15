import { useState } from 'react'
import type { Component, Credential } from '../../Data/User'
import { credentials, components, ranksByComponent } from '../../Data/User'
import { submitAccountRequest, checkRequestStatus, type AccountRequest } from '../../lib/accountRequestService'

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

  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [requestStatus, setRequestStatus] = useState<AccountRequest | null>(null)

  const componentRanks = component ? ranksByComponent[component as Component] : []

  const handleComponentChange = (val: string) => {
    setComponent(val)
    // Clear rank if it's not valid for the new component
    if (val && rank && !ranksByComponent[val as Component]?.includes(rank)) {
      setRank('')
    }
  }

  const handleCheckStatus = async () => {
    if (!email) return

    setError(null)
    const status = await checkRequestStatus(email)
    setRequestStatus(status)

    if (!status) {
      setError('No account request found for this email.')
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

    if (result.success) {
      setSubmitted(true)
      setRequestStatus({
        id: '',
        email,
        first_name: firstName,
        last_name: lastName,
        middle_initial: middleInitial || null,
        credential: credential || null,
        rank: rank || null,
        component: component || null,
        uic,
        status: 'pending',
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
            <p className="text-sm mb-2">
              <strong>UIC:</strong> {requestStatus.uic}
            </p>

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
            Check Another Request
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
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-xl font-semibold text-primary mb-2">Request Submitted!</h2>
            <p className="text-tertiary/70 mb-6">
              Your account request has been submitted. An administrator will review it shortly.
              <br />
              You'll receive an email once your request is approved.
            </p>
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
        <h2 className="text-lg font-semibold text-primary mb-2">Request an Account</h2>
        <p className="text-sm text-tertiary/60 mb-5 md:text-base">
          Fill out the form below to request access. An administrator will review your request.
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <TextInput
            label="Email"
            value={email}
            onChange={setEmail}
            placeholder="your.email@mail.mil"
            type="email"
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <TextInput
              label="First Name"
              value={firstName}
              onChange={setFirstName}
              placeholder="Christopher"
              required
            />
            <TextInput
              label="Last Name"
              value={lastName}
              onChange={setLastName}
              placeholder="Conner"
              required
            />
          </div>

          <TextInput
            label="Middle Initial"
            value={middleInitial}
            onChange={(val) => setMiddleInitial(val.toUpperCase().slice(0, 1))}
            placeholder="D"
            maxLength={1}
          />

          <SelectInput
            label="Credential"
            value={credential}
            onChange={setCredential}
            options={credentials}
          />

          <SelectInput
            label="Component"
            value={component}
            onChange={handleComponentChange}
            options={components}
          />

          {component && (
            <SelectInput
              label="Rank"
              value={rank}
              onChange={setRank}
              options={componentRanks}
            />
          )}

          <TextInput
            label="UIC"
            value={uic}
            onChange={(val) => setUic(val.toUpperCase())}
            placeholder="W12ABC"
            maxLength={6}
            required
          />

          <label className="block">
            <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">
              Additional Notes
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional information for the administrator..."
              rows={3}
              className="mt-1 w-full px-3 py-2.5 rounded-lg bg-themewhite2 text-primary text-base
                       border border-tertiary/10 focus:border-themeblue2 focus:outline-none
                       transition-colors placeholder:text-tertiary/30 resize-none"
            />
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="w-full px-4 py-3 rounded-lg bg-themeblue2 text-white font-medium
                     hover:bg-themeblue2/90 transition-colors disabled:opacity-50
                     disabled:cursor-not-allowed"
          >
            {submitting ? 'Submitting...' : 'Submit Request'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-tertiary/10">
          <p className="text-sm text-tertiary/60 mb-3">Already submitted a request?</p>
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your.email@mail.mil"
              className="flex-1 px-3 py-2 rounded-lg bg-themewhite2 text-primary text-sm
                       border border-tertiary/10 focus:border-themeblue2 focus:outline-none"
            />
            <button
              onClick={handleCheckStatus}
              className="px-4 py-2 rounded-lg bg-tertiary/10 text-primary font-medium
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
