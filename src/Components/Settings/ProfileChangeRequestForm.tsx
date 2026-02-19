import { useState, useEffect } from 'react'
import type { Component } from '../../Data/User'
import { credentials, components, ranksByComponent } from '../../Data/User'
import { supabase } from '../../lib/supabase'
import { submitProfileChangeRequest } from '../../lib/accountRequestService'
import { createLogger } from '../../Utilities/Logger'

const logger = createLogger('ProfileChangeRequest')

const TextInput = ({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  currentValue,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (val: string) => void
  placeholder?: string
  maxLength?: number
  currentValue?: string | null
  type?: string
}) => (
  <label className="block">
    <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">{label}</span>
    {currentValue && (
      <div className="text-xs text-tertiary/50 mb-1">
        Current: <span className="font-medium">{currentValue}</span>
      </div>
    )}
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
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
  currentValue,
}: {
  label: string
  value: string
  onChange: (val: string) => void
  options: readonly string[]
  placeholder?: string
  currentValue?: string | null
}) => (
  <label className="block">
    <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">{label}</span>
    {currentValue && (
      <div className="text-xs text-tertiary/50 mb-1">
        Current: <span className="font-medium">{currentValue}</span>
      </div>
    )}
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
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

export const ProfileChangeRequestForm = () => {
  const [currentProfile, setCurrentProfile] = useState({
    email: '',
    firstName: '',
    lastName: '',
    middleInitial: '',
    credential: '',
    component: '',
    rank: '',
    uic: '',
  })

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

  const componentRanks = component ? ranksByComponent[component as Component] : []

  useEffect(() => {
    const loadCurrentProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data } = await supabase
          .from('profiles')
          .select('first_name, last_name, middle_initial, credential, component, rank, uic')
          .eq('id', user.id)
          .single()

        if (data) {
          setCurrentProfile({
            email: user.email || '',
            firstName: data.first_name || '',
            lastName: data.last_name || '',
            middleInitial: data.middle_initial || '',
            credential: data.credential || '',
            component: data.component || '',
            rank: data.rank || '',
            uic: data.uic || '',
          })

          // Pre-fill form with current values
          setFirstName(data.first_name || '')
          setLastName(data.last_name || '')
          setMiddleInitial(data.middle_initial || '')
          setCredential(data.credential || '')
          setComponent(data.component || '')
          setRank(data.rank || '')
          setUic(data.uic || '')
        }
      } catch (error) {
        logger.error('Error loading profile:', error)
      }
    }

    loadCurrentProfile()
  }, [])

  const handleComponentChange = (val: string) => {
    setComponent(val)
    if (val && rank && !ranksByComponent[val as Component]?.includes(rank)) {
      setRank('')
    }
  }

  const hasChanges =
    firstName !== currentProfile.firstName ||
    lastName !== currentProfile.lastName ||
    middleInitial !== currentProfile.middleInitial ||
    credential !== currentProfile.credential ||
    component !== currentProfile.component ||
    rank !== currentProfile.rank ||
    uic !== currentProfile.uic

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!hasChanges) {
      setError('No changes detected. Please modify at least one field.')
      return
    }

    setSubmitting(true)
    setError(null)

    const result = await submitProfileChangeRequest({
      email: currentProfile.email,
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
    } else {
      setError(result.error || 'Failed to submit request')
    }
  }

  if (submitted) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="px-4 py-3 md:p-5">
          <div className="text-center py-8">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-xl font-semibold text-primary mb-2">Change Request Submitted!</h2>
            <p className="text-tertiary/70 mb-6">
              Your profile change request has been submitted for review.
              <br />
              An administrator will review your changes and update your profile accordingly.
            </p>
            <button
              onClick={() => setSubmitted(false)}
              className="px-4 py-2 rounded-lg bg-themeblue2 text-white font-medium
                       hover:bg-themeblue2/90 transition-colors"
            >
              Submit Another Request
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-4 py-3 md:p-5">
        <h2 className="text-lg font-semibold text-primary mb-2">Request Profile Changes</h2>
        <p className="text-sm text-tertiary/60 mb-5 md:text-base">
          Update the fields you want to change. An administrator will review your request.
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        {!hasChanges && (
          <div className="mb-4 p-3 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-700 text-sm">
            Make changes to the fields below to submit a request
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <TextInput
              label="First Name"
              value={firstName}
              onChange={setFirstName}
              placeholder="Christopher"
              currentValue={currentProfile.firstName}
            />
            <TextInput
              label="Last Name"
              value={lastName}
              onChange={setLastName}
              placeholder="Conner"
              currentValue={currentProfile.lastName}
            />
          </div>

          <TextInput
            label="Middle Initial"
            value={middleInitial}
            onChange={(val) => setMiddleInitial(val.toUpperCase().slice(0, 1))}
            placeholder="D"
            maxLength={1}
            currentValue={currentProfile.middleInitial}
          />

          <SelectInput
            label="Credential"
            value={credential}
            onChange={setCredential}
            options={credentials}
            currentValue={currentProfile.credential}
          />

          <SelectInput
            label="Component"
            value={component}
            onChange={handleComponentChange}
            options={components}
            currentValue={currentProfile.component}
          />

          {component && (
            <SelectInput
              label="Rank"
              value={rank}
              onChange={setRank}
              options={componentRanks}
              currentValue={currentProfile.rank}
            />
          )}

          <TextInput
            label="UIC"
            value={uic}
            onChange={(val) => setUic(val.toUpperCase())}
            placeholder="W12ABC"
            maxLength={6}
            currentValue={currentProfile.uic}
          />

          <label className="block">
            <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">
              Reason for Changes
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Please explain why you're requesting these changes..."
              rows={3}
              className="mt-1 w-full px-3 py-2.5 rounded-lg bg-themewhite2 text-primary text-base
                       border border-tertiary/10 focus:border-themeblue2 focus:outline-none
                       transition-colors placeholder:text-tertiary/30 resize-none"
            />
          </label>

          <button
            type="submit"
            disabled={submitting || !hasChanges}
            className="w-full px-4 py-3 rounded-lg bg-themeblue2 text-white font-medium
                     hover:bg-themeblue2/90 transition-colors disabled:opacity-50
                     disabled:cursor-not-allowed"
          >
            {submitting ? 'Submitting...' : 'Submit Change Request'}
          </button>
        </form>
      </div>
    </div>
  )
}
