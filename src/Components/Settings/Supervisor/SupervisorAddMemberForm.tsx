import { useState, useCallback } from 'react'
import { UserPlus, Search, UserCheck } from 'lucide-react'
import { TextInput, PickerInput, PasswordInput } from '../../FormInputs'
import { ErrorDisplay } from '../../ErrorDisplay'
import { credentials, components, ranksByComponent } from '../../../Data/User'
import type { Component } from '../../../Data/User'
import {
  findUserByEmail,
  addClinicMember,
  createClinicUser,
  type UserLookupResult,
} from '../../../lib/supervisorService'

interface SupervisorAddMemberFormProps {
  clinicId: string
  onBack: () => void
  onSaved: () => void
}

export function SupervisorAddMemberForm({ clinicId, onBack, onSaved }: SupervisorAddMemberFormProps) {
  // ── Email lookup ──────────────────────────────────────────────────────
  const [email, setEmail] = useState('')
  const [lookupResult, setLookupResult] = useState<UserLookupResult | null>(null)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [mode, setMode] = useState<'lookup' | 'existing' | 'create'>('lookup')

  // ── Create form fields ────────────────────────────────────────────────
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [middleInitial, setMiddleInitial] = useState('')
  const [credential, setCredential] = useState('')
  const [component, setComponent] = useState('')
  const [rank, setRank] = useState('')
  const [tempPassword, setTempPassword] = useState('')
  const [isSupervisor, setIsSupervisor] = useState(false)
  const [isProvider, setIsProvider] = useState(false)

  // ── UI state ──────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const componentRanks = component ? ranksByComponent[component as Component] : []

  // ─── Email Lookup ───────────────────────────────────────────────────

  const handleLookup = useCallback(async () => {
    if (!email.trim()) {
      setError('Enter an email address')
      return
    }
    setError(null)
    setLookupLoading(true)

    const result = await findUserByEmail(email.trim())
    setLookupLoading(false)

    if (!result.success) {
      setError(result.error)
      return
    }

    setLookupResult(result)
    if (result.found) {
      setMode('existing')
    } else {
      setMode('create')
    }
  }, [email])

  // ─── Add Existing User ──────────────────────────────────────────────

  const handleAddExisting = useCallback(async () => {
    if (!lookupResult?.user_id) return
    setSubmitting(true)
    setError(null)

    const result = await addClinicMember(clinicId, lookupResult.user_id)
    setSubmitting(false)

    if (result.success) {
      onSaved()
    } else {
      setError(result.error)
    }
  }, [clinicId, lookupResult, onSaved])

  // ─── Create New User ────────────────────────────────────────────────

  const handleCreate = useCallback(async () => {
    if (!firstName.trim() || !lastName.trim()) {
      setError('First and last name are required')
      return
    }
    if (tempPassword.length < 12) {
      setError('Temporary password must be at least 12 characters')
      return
    }

    setSubmitting(true)
    setError(null)

    const roles: ('medic' | 'supervisor' | 'provider')[] = ['medic']
    if (isSupervisor) roles.push('supervisor')
    if (isProvider) roles.push('provider')

    const result = await createClinicUser({
      clinicId,
      email: email.trim(),
      tempPassword,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      middleInitial: middleInitial || undefined,
      credential: credential || undefined,
      component: component || undefined,
      rank: rank || undefined,
      roles,
    })

    setSubmitting(false)

    if (result.success) {
      onSaved()
    } else {
      setError(result.error)
    }
  }, [clinicId, email, tempPassword, firstName, lastName, middleInitial, credential, component, rank, isSupervisor, isProvider, onSaved])

  const handleComponentChange = useCallback((val: string) => {
    setComponent(val)
    if (val && rank && !ranksByComponent[val as Component]?.includes(rank)) {
      setRank('')
    }
  }, [rank])

  // ─── Render ─────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-primary">Add Personnel</h3>

      {error && <ErrorDisplay message={error} />}

      {/* ── Step 1: Email Lookup ─────────────────────────────────── */}
      <div className="space-y-3">
        <TextInput
          label="Email"
          value={email}
          onChange={(v) => { setEmail(v); if (mode !== 'lookup') { setMode('lookup'); setLookupResult(null) } }}
          placeholder="user@mail.mil"
          type="email"
          required
        />

        {mode === 'lookup' && (
          <button
            onClick={handleLookup}
            disabled={lookupLoading || !email.trim()}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-themeblue3 text-white font-medium text-sm active:scale-95 disabled:opacity-50"
          >
            <Search size={14} />
            {lookupLoading ? 'Searching...' : 'Look Up Email'}
          </button>
        )}
      </div>

      {/* ── Existing User Found ──────────────────────────────────── */}
      {mode === 'existing' && lookupResult?.found && (
        <div className="rounded-xl bg-themewhite2 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-themegreen/15 flex items-center justify-center">
              <UserCheck size={18} className="text-themegreen" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-primary">User Found</p>
              <p className="text-xs text-tertiary truncate">
                {lookupResult.rank && `${lookupResult.rank} `}
                {lookupResult.last_name}, {lookupResult.first_name}
                {lookupResult.credential && ` · ${lookupResult.credential}`}
              </p>
            </div>
          </div>

          {lookupResult.clinic_id && (
            <p className="text-xs text-themeyellow font-medium">
              This user is currently assigned to another clinic. Adding them will reassign them to yours.
            </p>
          )}

          <button
            onClick={handleAddExisting}
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-themeblue3 text-white font-medium text-sm active:scale-95 disabled:opacity-50"
          >
            <UserPlus size={14} />
            {submitting ? 'Adding...' : 'Add to Clinic'}
          </button>
        </div>
      )}

      {/* ── Create New User Form ─────────────────────────────────── */}
      {mode === 'create' && (
        <div className="space-y-4">
          <div className="rounded-xl bg-themewhite2 p-4">
            <p className="text-sm font-medium text-primary mb-1">No account found</p>
            <p className="text-xs text-tertiary">Create a new user and assign them to your clinic.</p>
          </div>

          <PasswordInput
            label="Temporary Password"
            value={tempPassword}
            onChange={setTempPassword}
            placeholder="Min 12 characters"
            hint={
              <p className="mt-1 text-[9pt] text-tertiary">
                Must contain uppercase, lowercase, and a digit.
              </p>
            }
          />

          <div className="grid grid-cols-2 gap-3">
            <TextInput label="First Name" value={firstName} onChange={setFirstName} required />
            <TextInput label="Last Name" value={lastName} onChange={setLastName} required />
          </div>

          <TextInput
            label="Middle Initial"
            value={middleInitial}
            onChange={(v) => setMiddleInitial(v.toUpperCase().slice(0, 1))}
            maxLength={1}
          />

          <div className="grid grid-cols-2 gap-3">
            <PickerInput label="Credential" value={credential} onChange={setCredential} options={credentials} />
            <PickerInput label="Component" value={component} onChange={handleComponentChange} options={components} />
          </div>
          {component && <PickerInput label="Rank" value={rank} onChange={setRank} options={componentRanks} />}

          {/* ── Role Toggles ──────────────────────────────────────── */}
          <div className="space-y-2">
            <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider">Roles</p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setIsSupervisor(v => !v)}
                className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-medium transition-all active:scale-95 ${
                  isSupervisor
                    ? 'bg-themeblue3 text-white'
                    : 'bg-tertiary/10 text-tertiary'
                }`}
              >
                Supervisor
              </button>
              <button
                type="button"
                onClick={() => setIsProvider(v => !v)}
                className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-medium transition-all active:scale-95 ${
                  isProvider
                    ? 'bg-themeblue3 text-white'
                    : 'bg-tertiary/10 text-tertiary'
                }`}
              >
                Provider
              </button>
            </div>
            <p className="text-[9pt] text-tertiary">All users receive the Medic role by default.</p>
          </div>

          <button
            onClick={handleCreate}
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-themegreen text-white font-medium text-sm active:scale-95 disabled:opacity-50"
          >
            <UserPlus size={14} />
            {submitting ? 'Creating...' : 'Create & Add to Clinic'}
          </button>
        </div>
      )}

      {/* ── Back ─────────────────────────────────────────────────── */}
      <button
        onClick={onBack}
        className="w-full px-3 py-2.5 rounded-lg bg-tertiary/10 text-tertiary font-medium text-sm active:scale-95"
      >
        Back
      </button>
    </div>
  )
}
