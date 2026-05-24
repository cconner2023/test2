import { useState, useEffect, useCallback } from 'react'
import { Check, X, RefreshCw } from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { DateTimeRow, combineDateTime } from './IntakePickers'
import { IntakeRejectDialog } from './IntakeRejectDialog'

interface IntakeFormProps {
  supabase: SupabaseClient
  /** Initial passcode parsed from window.location.hash (`#p=<passcode>`). */
  initialPasscode: string
}

type Stage1State =
  | { kind: 'idle' }
  | { kind: 'resolving' }
  | { kind: 'resolved'; clinicName: string }
  | { kind: 'unknown' }

type SubmitState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'submitted' }
  | { kind: 'rejected' }

/**
 * Public outside-event-intake form. Two-stage UX matching the main app's
 * LoginScreen visual language (logo, card surface, circular reveal action).
 *
 * Server validates passphrase ONLY at submit time. We do NOT pre-verify the
 * passphrase via any anon RPC — that would hand callers a network-speed
 * enumeration oracle that bypasses the bcrypt cost.
 */
export function IntakeForm({ supabase, initialPasscode }: IntakeFormProps) {
  const [passcode, setPasscode] = useState(initialPasscode)
  const [passphrase, setPassphrase] = useState('')
  const [stage1, setStage1] = useState<Stage1State>({ kind: 'idle' })
  const [showStage2, setShowStage2] = useState(false)
  const [name, setName] = useState('')
  const [org, setOrg] = useState('')
  const [email, setEmail] = useState('')
  const [startDate, setStartDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endDate, setEndDate] = useState('')
  const [endTime, setEndTime] = useState('')
  const [title, setTitle] = useState('')
  const [submit, setSubmit] = useState<SubmitState>({ kind: 'idle' })

  const resolveCode = useCallback(async (code: string) => {
    if (!code) { setStage1({ kind: 'idle' }); return }
    setStage1({ kind: 'resolving' })
    try {
      const { data, error } = await supabase.rpc('resolve_event_intake_code', { p_passcode: code })
      if (error || !data) {
        setStage1({ kind: 'unknown' })
        return
      }
      const clinicName = (data as { clinic_name?: string }).clinic_name ?? ''
      setStage1({ kind: 'resolved', clinicName })
    } catch {
      setStage1({ kind: 'unknown' })
    }
  }, [supabase])

  useEffect(() => {
    if (initialPasscode) resolveCode(initialPasscode)
  }, [initialPasscode, resolveCode])

  const onContinue = useCallback(() => {
    if (stage1.kind !== 'resolved') return
    if (passphrase.trim().length === 0) return
    setShowStage2(true)
  }, [stage1, passphrase])

  const onSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    const startDt = combineDateTime(startDate, startTime)
    const endDt = combineDateTime(endDate, endTime)
    if (!startDt || !endDt) return
    setSubmit({ kind: 'submitting' })
    try {
      const payload = {
        requester_name: name.trim(),
        requester_org: org.trim() || null,
        requester_email: email.trim(),
        requested_start: startDt.toISOString(),
        requested_end: endDt.toISOString(),
        title: title.trim(),
      }
      const { error } = await supabase.rpc('submit_event_intake', {
        p_passcode: passcode,
        p_passphrase: passphrase.trim(),
        p_payload: payload,
      })
      if (error) {
        setSubmit({ kind: 'rejected' })
        // Drop back to stage 1 with both credential fields cleared so the
        // requester re-enters from scratch.
        setShowStage2(false)
        setPasscode('')
        setPassphrase('')
        setStage1({ kind: 'idle' })
        return
      }
      setSubmit({ kind: 'submitted' })
    } catch {
      setSubmit({ kind: 'rejected' })
    }
  }, [supabase, name, org, email, startDate, startTime, endDate, endTime, title, passcode, passphrase])

  const stage1Ready = stage1.kind === 'resolved' && passphrase.trim().length > 0
  const stage2Ready =
    name.trim().length > 0 &&
    email.trim().length > 0 &&
    startDate.length > 0 &&
    startTime.length === 4 &&
    endDate.length > 0 &&
    endTime.length === 4 &&
    title.trim().length > 0

  return (
    <Shell>
      {/* Branding */}
      <div className={`text-center ${submit.kind === 'submitted' ? 'mb-6' : 'mb-8'}`}>
        <div className={`relative mx-auto mb-2 ${submit.kind === 'submitted' ? 'w-10 h-10' : 'w-17 h-17'}`}>
          <svg className="relative w-full h-full" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g transform="translate(20,20)">
              <rect x="-3" y="-11" width="6" height="22" rx="1.5" className="fill-themeblue3" />
              <rect x="-3" y="-11" width="6" height="22" rx="1.5" className="fill-themeblue3" transform="rotate(60)" />
              <rect x="-3" y="-11" width="6" height="22" rx="1.5" className="fill-themeblue3" transform="rotate(120)" />
            </g>
          </svg>
        </div>
        {submit.kind !== 'submitted' && (
          <div className="text-[10pt] text-secondary tracking-[2px]">
            Outside Event Request
          </div>
        )}
      </div>

      <IntakeRejectDialog
        visible={submit.kind === 'rejected'}
        title="Submission rejected"
        subtitle="Verify the unit code and passphrase with your medical section POC."
        onDismiss={() => setSubmit({ kind: 'idle' })}
      />

      {submit.kind === 'submitted' ? (
        <>
          <div className="pb-2">
            <p className="text-[9pt] font-semibold text-secondary tracking-widest uppercase">Submitted</p>
          </div>
          <div className="rounded-2xl bg-themewhite2 overflow-hidden px-4 py-4">
            <p className="text-sm font-medium text-primary mb-1.5">Request sent</p>
            <p className="text-[10pt] text-secondary leading-relaxed">
              Your event request has been delivered to the medical section. <span className="font-medium text-primary">{email}</span>.
            </p>
          </div>
        </>
      ) : (
        <>
          <div className="pb-2">
            <p className="text-[9pt] font-semibold text-secondary tracking-widest uppercase">
              {showStage2 ? 'Event Details' : 'Verify Unit'}
            </p>
          </div>

          <form onSubmit={onSubmit}>
            <div className="rounded-2xl bg-themewhite2 overflow-hidden">

              {/* Stage 1 — credentials */}
              <div className={`transition-all duration-300 ease-out ${showStage2
                ? 'absolute opacity-0 -translate-y-2 pointer-events-none h-0 overflow-hidden'
                : 'relative opacity-100 translate-y-0'
              }`}>
                <Row>
                  <input
                    type="text"
                    value={passcode}
                    onChange={(e) => { setPasscode(e.target.value); setStage1({ kind: 'idle' }) }}
                    onBlur={() => resolveCode(passcode)}
                    placeholder="Unit code *"
                    autoComplete="off"
                    spellCheck={false}
                    className="w-full bg-transparent px-4 py-3 text-base md:text-sm text-primary placeholder:text-tertiary focus:outline-none font-mono tracking-widest"
                  />
                </Row>

                {stage1.kind === 'resolving' && (
                  <HintRow tone="muted">Checking…</HintRow>
                )}
                {stage1.kind === 'resolved' && (
                  <HintRow tone="ok">
                    Submitting to <span className="font-semibold text-primary">{stage1.clinicName}</span>
                  </HintRow>
                )}
                {stage1.kind === 'unknown' && (
                  <HintRow tone="err">
                    No medical section is associated with this code. Confirm the code with your medical section POC.
                  </HintRow>
                )}

                {stage1.kind === 'resolved' && (
                  <>
                    <Row>
                      <input
                        type="text"
                        value={passphrase}
                        onChange={(e) => setPassphrase(e.target.value)}
                        placeholder="Passphrase *"
                        autoFocus
                        autoComplete="off"
                        spellCheck={false}
                        className="w-full bg-transparent px-4 py-3 text-base md:text-sm text-primary placeholder:text-tertiary focus:outline-none font-mono"
                      />
                    </Row>
                  </>
                )}

                <div className="flex items-center justify-end gap-2 px-3 py-2">
                  <button
                    type="button"
                    onClick={onContinue}
                    disabled={!stage1Ready}
                    className={`shrink-0 h-9 rounded-full flex items-center justify-center bg-themeblue3 text-white overflow-hidden transition-all duration-300 ease-out active:scale-95 ${stage1Ready ? 'w-9 opacity-100' : 'w-0 opacity-0 pointer-events-none'}`}
                  >
                    <Check size={16} />
                  </button>
                </div>
              </div>

              {/* Stage 2 — event details */}
              <div className={`transition-all duration-300 ease-out ${showStage2
                ? 'relative opacity-100 translate-y-0'
                : 'absolute opacity-0 translate-y-2 pointer-events-none h-0 overflow-hidden'
              }`}>
                {stage1.kind === 'resolved' && (
                  <div className="px-4 py-2.5 border-b border-primary/6 bg-themewhite/30">
                    <p className="text-[9pt] text-tertiary uppercase tracking-widest">For</p>
                    <p className="text-sm font-medium text-primary">{stage1.clinicName}</p>
                  </div>
                )}

                <Row>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name *"
                    required
                    className="w-full bg-transparent px-4 py-3 text-base md:text-sm text-primary placeholder:text-tertiary focus:outline-none"
                  />
                </Row>
                <Row>
                  <input
                    type="text"
                    value={org}
                    onChange={(e) => setOrg(e.target.value)}
                    placeholder="Organization"
                    className="w-full bg-transparent px-4 py-3 text-base md:text-sm text-primary placeholder:text-tertiary focus:outline-none"
                  />
                </Row>
                <Row>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email *"
                    required
                    className="w-full bg-transparent px-4 py-3 text-base md:text-sm text-primary placeholder:text-tertiary focus:outline-none"
                  />
                </Row>
                <DateTimeRow
                  label="Start"
                  date={startDate}
                  time={startTime}
                  onDateChange={setStartDate}
                  onTimeChange={setStartTime}
                />
                <DateTimeRow
                  label="End"
                  date={endDate}
                  time={endTime}
                  onDateChange={setEndDate}
                  onTimeChange={setEndTime}
                  minDate={startDate}
                />
                <Row>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Event title *"
                    maxLength={120}
                    required
                    className="w-full bg-transparent px-4 py-3 text-base md:text-sm text-primary placeholder:text-tertiary focus:outline-none"
                  />
                </Row>
                <div className="flex items-center justify-end gap-2 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setShowStage2(false)}
                    className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all"
                  >
                    <X size={16} />
                  </button>
                  <button
                    type="submit"
                    disabled={submit.kind === 'submitting' || !stage2Ready}
                    className={`shrink-0 h-9 rounded-full flex items-center justify-center bg-themeblue3 text-white overflow-hidden transition-all duration-300 ease-out active:scale-95 ${stage2Ready ? 'w-9 opacity-100' : 'w-0 opacity-0 pointer-events-none'}`}
                  >
                    {submit.kind === 'submitting' ? <RefreshCw size={14} className="animate-spin" /> : <Check size={16} />}
                  </button>
                </div>
              </div>

            </div>
          </form>
        </>
      )}

      <p className="mt-6 text-[10pt] text-center text-secondary leading-relaxed max-w-xs mx-auto">
        Not affiliated with or endorsed by the Department of Defense.
      </p>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-30 bg-themewhite overflow-y-auto"
      style={{ paddingTop: 'var(--sat)', paddingBottom: 'var(--sab)' }}
    >
      <div className="min-h-full flex flex-col items-center justify-center py-8 px-4">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <label className="block border-b border-primary/6 last:border-b-0">{children}</label>
}

function HintRow({ tone, children }: { tone: 'ok' | 'err' | 'muted' | 'warn'; children: React.ReactNode }) {
  const color =
    tone === 'ok' ? 'text-themegreen'
    : tone === 'err' ? 'text-themeredred'
    : tone === 'warn' ? 'text-themeyellow'
    : 'text-tertiary'
  return (
    <div className={`px-4 py-2 text-[10pt] leading-relaxed border-b border-primary/6 ${color}`}>
      {children}
    </div>
  )
}

