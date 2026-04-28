import { useEffect, useRef, useState, useCallback } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { PreviewOverlay } from '../PreviewOverlay'
import { ActionButton } from '../ActionButton'
import { ErrorPill } from '../ErrorPill'
import { PickerInput, UicPinInput } from '../FormInputs'
import {
  findUserByEmail,
  addClinicMember,
  createClinicUser,
} from '../../lib/supervisorService'
import { invalidate } from '../../stores/useInvalidationStore'
import { useAuthStore } from '../../stores/useAuthStore'

type Role = 'medic' | 'supervisor' | 'provider'
type Mode = 'lookup' | 'create'

interface AddMemberPopoverProps {
  isOpen: boolean
  anchorRect: DOMRect | null
  clinicId: string | null
  onClose: () => void
  /** Called after a member is added (existing user or freshly created) */
  onAdded: () => void
}

export function AddMemberPopover({
  isOpen,
  anchorRect,
  clinicId,
  onClose,
  onAdded,
}: AddMemberPopoverProps) {
  const profile = useAuthStore((s) => s.profile)

  const [mode, setMode] = useState<Mode>('lookup')
  const [email, setEmail] = useState('')
  const [lookupLoading, setLookupLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Create-mode fields
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [middleInitial, setMiddleInitial] = useState('')
  const [credential, setCredential] = useState('')
  const [component, setComponent] = useState('')
  const [rank, setRank] = useState('')
  const [uic, setUic] = useState('')
  const [tempPassword, setTempPassword] = useState('')
  const [roles, setRoles] = useState<Role[]>(['medic'])

  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null)
  const feedbackTimer = useRef<ReturnType<typeof setTimeout>>(null)
  const emailRef = useRef<HTMLInputElement>(null)

  const showFeedback = useCallback((type: 'error' | 'success', message: string) => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current)
    setFeedback({ type, message })
    feedbackTimer.current = setTimeout(() => setFeedback(null), 4_000)
  }, [])

  const reset = useCallback(() => {
    setMode('lookup')
    setEmail('')
    setFirstName('')
    setLastName('')
    setMiddleInitial('')
    setCredential('')
    setComponent('')
    setRank('')
    setUic('')
    setTempPassword('')
    setRoles(['medic'])
    setFeedback(null)
  }, [])

  // Reset on open
  useEffect(() => {
    if (isOpen) reset()
  }, [isOpen, reset])

  // Focus email input when entering lookup mode
  useEffect(() => {
    if (isOpen && mode === 'lookup') {
      requestAnimationFrame(() => emailRef.current?.focus())
    }
  }, [isOpen, mode])

  const handleClose = useCallback(() => {
    reset()
    onClose()
  }, [reset, onClose])

  const handleLookup = useCallback(async () => {
    if (!email.trim() || !clinicId) return
    setFeedback(null)
    setLookupLoading(true)
    const result = await findUserByEmail(email.trim())
    if (!result.success) {
      setLookupLoading(false)
      showFeedback('error', result.error)
      return
    }
    if (result.found) {
      const r = await addClinicMember(clinicId, result.user_id!)
      setLookupLoading(false)
      if (!r.success) {
        showFeedback('error', r.error)
        return
      }
      invalidate('users', 'clinics')
      onAdded()
      handleClose()
    } else {
      setLookupLoading(false)
      if (profile?.component) setComponent(profile.component)
      setMode('create')
    }
  }, [email, clinicId, profile?.component, showFeedback, onAdded, handleClose])

  const handleComponentChange = useCallback((val: string) => {
    setComponent(val)
    if (val && rank) {
      import('../../Data/User').then(({ ranksByComponent }) => {
        if (!ranksByComponent[val as import('../../Data/User').Component]?.includes(rank)) {
          setRank('')
        }
      })
    }
  }, [rank])

  const handleCreate = useCallback(async () => {
    if (!firstName.trim() || !lastName.trim()) {
      showFeedback('error', 'First and last name required')
      return
    }
    if (tempPassword.length < 12) {
      showFeedback('error', 'Password must be at least 12 characters')
      return
    }
    if (!clinicId) return
    setSubmitting(true)
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
      uic: uic || undefined,
      roles,
    })
    setSubmitting(false)
    if (result.success) {
      invalidate('users', 'clinics')
      onAdded()
      handleClose()
    } else {
      showFeedback('error', result.error)
    }
  }, [
    clinicId, email, tempPassword, firstName, lastName, middleInitial,
    credential, component, rank, uic, roles, showFeedback, onAdded, handleClose,
  ])

  return (
    <PreviewOverlay
      isOpen={isOpen}
      onClose={handleClose}
      anchorRect={anchorRect}
      title={mode === 'create' ? 'New user' : 'Add member'}
      maxWidth={360}
      previewMaxHeight="70dvh"
      footer={
        isOpen && mode === 'lookup' ? (
          <div className="flex gap-1 bg-themewhite rounded-2xl shadow-lg px-1.5 py-1.5">
            <ActionButton
              icon={lookupLoading ? Loader2 : Check}
              label={lookupLoading ? 'Checking…' : 'Add'}
              variant={lookupLoading || !email.trim() ? 'disabled' : 'success'}
              onClick={handleLookup}
            />
          </div>
        ) : isOpen && mode === 'create' ? (
          <div className="flex gap-1 bg-themewhite rounded-2xl shadow-lg px-1.5 py-1.5">
            <ActionButton
              icon={submitting ? Loader2 : Check}
              label={submitting ? 'Creating…' : 'Create & add'}
              variant={
                submitting || !firstName.trim() || !lastName.trim() || tempPassword.length < 12
                  ? 'disabled'
                  : 'success'
              }
              onClick={handleCreate}
            />
          </div>
        ) : undefined
      }
    >
      {isOpen && mode === 'lookup' && (
        <div>
          <div className="flex items-center border-b border-primary/6 px-4 py-3">
            <span className="text-[9pt] font-semibold text-tertiary uppercase tracking-widest w-20 shrink-0">Email</span>
            <input
              ref={emailRef}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && email.trim() && !lookupLoading) handleLookup()
              }}
              placeholder="member@example.com"
              className="flex-1 bg-transparent text-primary placeholder:text-tertiary focus:outline-none text-base md:text-sm min-w-0"
            />
          </div>
          {feedback?.type === 'error' && (
            <div className="px-4 py-2">
              <ErrorPill>{feedback.message}</ErrorPill>
            </div>
          )}
          <p className="text-[9pt] text-tertiary text-center px-4 py-2">
            If no account exists for this email, you'll be prompted to create one.
          </p>
        </div>
      )}
      {isOpen && mode === 'create' && (
        <div>
          <div className="flex items-center border-b border-primary/6 px-4 py-3">
            <span className="text-[9pt] font-semibold text-tertiary uppercase tracking-widest w-20 shrink-0">Email</span>
            <input
              type="email"
              value={email}
              disabled
              className="flex-1 bg-transparent text-primary placeholder:text-tertiary focus:outline-none text-sm min-w-0 disabled:opacity-70"
            />
          </div>
          {feedback?.type === 'error' && (
            <div className="px-4 py-2">
              <ErrorPill>{feedback.message}</ErrorPill>
            </div>
          )}
          <CreateForm
            firstName={firstName} onFirstName={setFirstName}
            lastName={lastName} onLastName={setLastName}
            middleInitial={middleInitial} onMiddleInitial={(v) => setMiddleInitial(v.toUpperCase().slice(0, 1))}
            credential={credential} onCredential={setCredential}
            component={component} onComponent={handleComponentChange}
            rank={rank} onRank={setRank}
            uic={uic} onUic={(v) => setUic(v.toUpperCase())}
            tempPassword={tempPassword} onTempPassword={setTempPassword}
            roles={roles} onRoles={setRoles}
          />
        </div>
      )}
    </PreviewOverlay>
  )
}

// ─── Create New User Form ──────────────────────────────────────────────────

interface CreateFormProps {
  firstName: string; onFirstName: (v: string) => void
  lastName: string; onLastName: (v: string) => void
  middleInitial: string; onMiddleInitial: (v: string) => void
  credential: string; onCredential: (v: string) => void
  component: string; onComponent: (v: string) => void
  rank: string; onRank: (v: string) => void
  uic: string; onUic: (v: string) => void
  tempPassword: string; onTempPassword: (v: string) => void
  roles: Role[]; onRoles: (v: Role[]) => void
}

function CreateForm(props: CreateFormProps) {
  const [userData, setUserData] = useState<{
    credentials: string[]
    components: string[]
    ranksByComponent: Record<string, string[]>
  } | null>(null)

  useEffect(() => {
    import('../../Data/User').then((mod) => {
      setUserData({
        credentials: mod.credentials,
        components: mod.components,
        ranksByComponent: mod.ranksByComponent,
      })
    })
  }, [])

  const componentRanks = props.component && userData
    ? userData.ranksByComponent[props.component] ?? []
    : []

  if (!userData) return null

  const labelCx = 'text-[9pt] font-semibold text-tertiary uppercase tracking-widest w-20 shrink-0'
  const inputCx = 'flex-1 bg-transparent text-primary placeholder:text-tertiary focus:outline-none text-base md:text-sm min-w-0'

  return (
    <div>
      <p className="text-[9pt] text-tertiary text-center px-4 py-2 border-b border-primary/6">
        No account found — fill out the form to create one
      </p>

      <div className="flex items-center border-b border-primary/6 px-4 py-3">
        <span className={labelCx}>Password</span>
        <input
          type="password"
          value={props.tempPassword}
          onChange={(e) => props.onTempPassword(e.target.value)}
          placeholder="min 12 chars"
          className={inputCx}
        />
      </div>

      <div className="flex items-center border-b border-primary/6 px-4 py-3">
        <span className={labelCx}>First *</span>
        <input
          type="text"
          value={props.firstName}
          onChange={(e) => props.onFirstName(e.target.value)}
          placeholder="First name"
          className={inputCx}
        />
      </div>

      <div className="flex items-center border-b border-primary/6 px-4 py-3">
        <span className={labelCx}>Last *</span>
        <input
          type="text"
          value={props.lastName}
          onChange={(e) => props.onLastName(e.target.value)}
          placeholder="Last name"
          className={inputCx}
        />
      </div>

      <div className="flex items-center border-b border-primary/6 px-4 py-3">
        <span className={labelCx}>MI</span>
        <input
          type="text"
          value={props.middleInitial}
          onChange={(e) => props.onMiddleInitial(e.target.value)}
          placeholder="—"
          maxLength={1}
          className={inputCx}
        />
      </div>

      <div className="flex items-center gap-2 border-b border-primary/6 px-4 py-3">
        <span className={labelCx}>Credential</span>
        <div className="flex-1 min-w-0">
          <PickerInput
            value={props.credential}
            onChange={props.onCredential}
            options={userData.credentials}
            placeholder="Credential"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-primary/6 px-4 py-3">
        <span className={labelCx}>Rank</span>
        <div className="flex-1 min-w-0">
          <PickerInput
            value={props.rank}
            onChange={props.onRank}
            options={componentRanks}
            placeholder="Rank"
          />
        </div>
      </div>

      <div className="flex items-center border-b border-primary/6 px-4 py-3">
        <span className={labelCx}>UIC</span>
        <div className="flex-1 min-w-0">
          <UicPinInput value={props.uic} onChange={props.onUic} spread />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <span className={labelCx}>Roles</span>
        <div className="flex items-center gap-3">
          {(['supervisor', 'provider'] as const).map((role) => {
            const has = props.roles.includes(role)
            return (
              <label key={role} className="flex items-center gap-1.5 cursor-pointer">
                <span className="text-[10pt] text-primary capitalize">{role}</span>
                <div
                  onClick={() => {
                    props.onRoles(has ? props.roles.filter((r) => r !== role) : [...props.roles, role])
                  }}
                  className={`relative w-9 h-5 shrink-0 rounded-full transition-colors duration-200 ${
                    has ? 'bg-themeblue3' : 'bg-tertiary/20'
                  }`}
                >
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                    has ? 'translate-x-4' : 'translate-x-0'
                  }`} />
                </div>
              </label>
            )
          })}
        </div>
      </div>
    </div>
  )
}
