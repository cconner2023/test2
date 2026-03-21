import { useState, useEffect } from 'react'
import { Check, RefreshCw, ChevronDown, CheckCircle } from 'lucide-react'
import type { Component } from '../../Data/User'
import { credentials, components, ranksByComponent } from '../../Data/User'
import { supabase } from '../../lib/supabase'
import { submitProfileChangeRequest } from '../../lib/accountRequestService'
import { createLogger } from '../../Utilities/Logger'
import { ErrorDisplay } from '../ErrorDisplay'

const logger = createLogger('ProfileChangeRequest')

const pillClass =
  'w-full rounded-full py-2.5 px-4 border border-themeblue3/10 shadow-xs focus:border-themeblue1/30 focus:bg-themewhite2 focus:outline-none text-sm bg-themewhite text-primary placeholder:text-tertiary/30 transition-all duration-300'

const selectClass = `${pillClass} appearance-none`

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

    if (!hasChanges) return

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
        <div className="px-5 py-4">
          <div className="text-center py-8">
            <CheckCircle size={32} className="text-themegreen mx-auto mb-3" />
            <h2 className="text-base font-semibold text-primary mb-1">Change Request Submitted</h2>
            <p className="text-sm text-tertiary/70">
              An administrator will review your changes and update your profile accordingly.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-4 py-3 md:p-5">
        <p className="text-xs text-tertiary leading-relaxed mb-4">
          Update the fields you want to change. An administrator will review your request.
        </p>

        {error && <ErrorDisplay message={error} className="mb-3" />}

        <form onSubmit={handleSubmit}>
          <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
            <div className="px-4 py-3 space-y-2">
              {/* First + Last name */}
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                  className={pillClass}
                />
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                  className={pillClass}
                />
              </div>

              {/* Middle initial */}
              <input
                type="text"
                value={middleInitial}
                onChange={(e) => setMiddleInitial(e.target.value.toUpperCase().slice(0, 1))}
                placeholder="Middle initial"
                maxLength={1}
                className={pillClass}
              />

              {/* Credential */}
              <div className="relative">
                <select
                  value={credential}
                  onChange={(e) => setCredential(e.target.value)}
                  className={selectClass}
                >
                  <option value="">Credential</option>
                  {credentials.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-tertiary/40 pointer-events-none" />
              </div>

              {/* Component */}
              <div className="relative">
                <select
                  value={component}
                  onChange={(e) => handleComponentChange(e.target.value)}
                  className={selectClass}
                >
                  <option value="">Component</option>
                  {components.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-tertiary/40 pointer-events-none" />
              </div>

              {/* Rank (conditional) */}
              {component && (
                <div className="relative">
                  <select
                    value={rank}
                    onChange={(e) => setRank(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">Rank</option>
                    {componentRanks.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-tertiary/40 pointer-events-none" />
                </div>
              )}

              {/* UIC */}
              <input
                type="text"
                value={uic}
                onChange={(e) => setUic(e.target.value.toUpperCase())}
                placeholder="UIC"
                maxLength={6}
                className={pillClass}
              />

              {/* Notes */}
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Reason for changes..."
                rows={3}
                className="w-full rounded-2xl py-2.5 px-4 border border-themeblue3/10 shadow-xs focus:border-themeblue1/30 focus:bg-themewhite2 focus:outline-none text-sm bg-themewhite text-primary placeholder:text-tertiary/30 transition-all duration-300 resize-none"
              />

              {/* Submit */}
              <div className="flex items-center justify-end gap-1.5 pt-1">
                <button
                  type="submit"
                  disabled={!hasChanges || submitting}
                  className="w-10 h-10 rounded-full bg-themeblue3 text-white flex items-center justify-center active:scale-95 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {submitting
                    ? <RefreshCw size={16} className="animate-spin" />
                    : <Check size={18} />}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
