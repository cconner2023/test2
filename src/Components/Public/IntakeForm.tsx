import { useState, useEffect, useCallback } from 'react'
import { Check, X, RefreshCw } from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { DateTimeRow, combineDateTime } from './IntakePickers'
import { IntakeRejectDialog } from './IntakeRejectDialog'
import { OncallCallView } from './OncallCallView'
import { OutsideSessionView } from './OutsideSessionView'
import { submitClusterMessage, submitEventIntake } from '../../lib/oncallAnonService'

interface IntakeFormProps {
  supabase: SupabaseClient
  /** Initial passcode parsed from window.location.hash (`#p=<passcode>`). */
  initialPasscode: string
}

type Stage1State =
  | { kind: 'idle' }
  | { kind: 'resolving' }
  | {
      kind: 'resolved'
      clinicName: string
      oncallEnabled: boolean
      messageEnabled: boolean
      intakeEnabled: boolean
    }
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
 * Stage 1 collects the passcode + passphrase, then Continue advances to the
 * chosen channel (event form / call / message). There is NO separate verify
 * round-trip: the terminal action (submit_event_intake / request_oncall /
 * submit_cluster_message) is the single bcrypt check, and each is per-credential
 * rate-limited server-side. A dedicated verify RPC was removed because it was a
 * pure passphrase oracle — unlimited yes/no guessing with no side effect. The
 * cost is that a wrong passphrase is caught at submit, not at Continue; the
 * existing reject-and-reset recovery handles that.
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
  const [callActive, setCallActive] = useState(false)
  // After the passphrase is accepted, outside callers pick a channel: submit an
  // event request or place a live call. Only offered when the section allows
  // calls; otherwise event request is the only path and no chooser is shown.
  const [channel, setChannel] = useState<'event' | 'call' | 'message'>('event')
  // One-way text message to the cluster (when the section allows it). Composed
  // after the passphrase is accepted; sealed to the clinic inbound key before send.
  const [messageActive, setMessageActive] = useState(false)
  const [messageBody, setMessageBody] = useState('')
  const [submittedVia, setSubmittedVia] = useState<'event' | 'message'>('event')
  // After a successful one-way message, keep a tab-bound reply session live so the
  // cluster can reply / call back while this page stays open. Registered only here
  // (passphrase already validated by the submit above → register's bcrypt never
  // becomes a pre-submit oracle). See OutsideSessionView.
  const [replySession, setReplySession] = useState(false)

  // Bad passphrase / on-call disabled during request_oncall — same recovery as a
  // rejected event submission: clear both credential fields, show the reject card.
  const handleCallReject = useCallback(() => {
    setCallActive(false)
    setShowStage2(false)
    setPasscode('')
    setPassphrase('')
    setStage1({ kind: 'idle' })
    setSubmit({ kind: 'rejected' })
  }, [])

  const resolveCode = useCallback(async (code: string) => {
    if (!code) { setStage1({ kind: 'idle' }); return }
    setStage1({ kind: 'resolving' })
    try {
      const { data, error } = await supabase.rpc('resolve_event_intake_code', { p_passcode: code })
      if (error || !data) {
        setStage1({ kind: 'unknown' })
        return
      }
      const resolved = data as {
        clinic_name?: string
        oncall_enabled?: boolean
        outside_message_enabled?: boolean
        intake_enabled?: boolean
      }
      // Default true: a credential resolved by an older server (or minted before the
      // column) keeps the event-request channel open.
      const intakeEnabled = resolved.intake_enabled !== false
      const oncallEnabled = resolved.oncall_enabled === true
      const messageEnabled = resolved.outside_message_enabled === true
      // Seed the channel to the first one that's actually open, so Continue never
      // lands on a disabled channel (the picker only renders when >1 is open).
      setChannel(intakeEnabled ? 'event' : oncallEnabled ? 'call' : messageEnabled ? 'message' : 'event')
      setStage1({
        kind: 'resolved',
        clinicName: resolved.clinic_name ?? '',
        oncallEnabled,
        messageEnabled,
        intakeEnabled,
      })
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
    // No verify round-trip (the oracle is gone) — just advance to the chosen
    // channel. The terminal action does the single bcrypt check + rate-limit.
    if (channel === 'call' && stage1.oncallEnabled) {
      setCallActive(true)
      return
    }
    if (channel === 'message' && stage1.messageEnabled) {
      setMessageActive(true)
      return
    }
    // Event request — only when that channel is open (the seed + picker keep `channel`
    // in sync, this guards the edge where everything is disabled).
    if (stage1.intakeEnabled) setShowStage2(true)
  }, [stage1, passphrase, channel])

  const onSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (stage1.kind !== 'resolved') return
    const startDt = combineDateTime(startDate, startTime)
    const endDt = combineDateTime(endDate, endTime)
    if (!startDt || !endDt) return
    setSubmit({ kind: 'submitting' })
    // Hand the detail (cleartext, over TLS) to the intake-submit edge function,
    // which authors it as a SYSTEM group message to the clinic's supervisors. The
    // edge returns a uniform {ok:false} on any failure (no passphrase oracle); we
    // surface the standard reject + reset on false.
    const ok = await submitEventIntake(supabase, {
      passcode,
      passphrase: passphrase.trim(),
      detail: {
        requester_name: name.trim(),
        requester_org: org.trim() || null,
        requester_email: email.trim(),
        requested_start: startDt.toISOString(),
        requested_end: endDt.toISOString(),
        title: title.trim(),
      },
    })
    if (!ok) {
      setSubmit({ kind: 'rejected' })
      // Drop back to stage 1 with both credential fields cleared so the
      // requester re-enters from scratch.
      setShowStage2(false)
      setPasscode('')
      setPassphrase('')
      setStage1({ kind: 'idle' })
      return
    }
    setSubmittedVia('event')
    setSubmit({ kind: 'submitted' })
  }, [supabase, stage1, name, org, email, startDate, startTime, endDate, endTime, title, passcode, passphrase])

  // One-way cluster message: hand the body to the outside-message-submit edge fn,
  // which authors it as a real SYSTEM group message E2E to the cluster (no client-side
  // seal). Same reject recovery as event.
  const onSubmitMessage = useCallback(async () => {
    if (stage1.kind !== 'resolved') return
    if (name.trim().length === 0 || messageBody.trim().length === 0) return
    setSubmit({ kind: 'submitting' })
    const ok = await submitClusterMessage(supabase, {
      passcode,
      passphrase: passphrase.trim(),
      requesterName: name.trim(),
      body: messageBody.trim(),
    })
    if (!ok) {
      setMessageActive(false)
      setPasscode('')
      setPassphrase('')
      setStage1({ kind: 'idle' })
      setSubmit({ kind: 'rejected' })
      return
    }
    setSubmittedVia('message')
    setMessageActive(false)
    setSubmit({ kind: 'idle' })
    // Message delivered. Open the tab-bound reply lane (cluster can reply / call
    // back) instead of the static success card — the passphrase is now known-good.
    setReplySession(true)
  }, [supabase, stage1, name, messageBody, passcode, passphrase])

  // A dead QR / shared link: arrived with a passcode baked into the URL that
  // didn't resolve. Show a neutral dead-end instead of the inviting form — the
  // 200 static shell stays live for everyone (no HTTP enumeration oracle), but a
  // human who scanned a stale poster gets a clear "this link is dead" instead of
  // an open form. Manual mistyped entry (no initialPasscode) keeps the inline
  // hint so the requester can correct the code in place.
  const deadLink = Boolean(initialPasscode) && stage1.kind === 'unknown'

  const stage1Ready = stage1.kind === 'resolved' && passphrase.trim().length > 0

  if (deadLink) {
    return (
      <Shell>
        <Glitch404 />
      </Shell>
    )
  }
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
          <div className="text-[10pt] text-secondary">
            Medical Knowledge Repository and Operational Network
          </div>
        )}
      </div>

      <IntakeRejectDialog
        visible={submit.kind === 'rejected'}
        title="Submission rejected"
        subtitle="Verify the unit code and passphrase with your medical section POC."
        onDismiss={() => setSubmit({ kind: 'idle' })}
      />

      {replySession ? (
        <OutsideSessionView
          supabase={supabase}
          passcode={passcode}
          passphrase={passphrase.trim()}
          requesterName={name.trim()}
          clinicName={stage1.kind === 'resolved' ? stage1.clinicName : ''}
          onEnd={() => { setReplySession(false); setSubmit({ kind: 'submitted' }) }}
        />
      ) : submit.kind === 'submitted' ? (
        <>
          <div className="pb-2">
            <p className="text-[9pt] font-semibold text-secondary tracking-widest uppercase">Submitted</p>
          </div>
          <div className="rounded-2xl bg-themewhite2 overflow-hidden px-4 py-4">
            <p className="text-sm font-medium text-primary mb-1.5">
              {submittedVia === 'message' ? 'Message sent' : 'Request sent'}
            </p>
            <p className="text-[10pt] text-secondary leading-relaxed">
              {submittedVia === 'message'
                ? 'Your message has been delivered to the medical section.'
                : <>Your event request has been delivered to the medical section. <span className="font-medium text-primary">{email}</span>.</>}
            </p>
          </div>
        </>
      ) : callActive ? (
        <OncallCallView
          supabase={supabase}
          passcode={passcode}
          passphrase={passphrase.trim()}
          clinicName={stage1.kind === 'resolved' ? stage1.clinicName : ''}
          onReject={handleCallReject}
          onClose={(callerName) => {
            setCallActive(false)
            // A call actually happened → keep a reply lane open so the cluster
            // can ring back or text. (undefined = pre-call cancel, just close.)
            if (callerName !== undefined) { setName(callerName); setReplySession(true) }
          }}
        />
      ) : messageActive ? (
        <>
          <div className="pb-2">
            <p className="text-[9pt] font-semibold text-secondary tracking-widest uppercase">Message</p>
          </div>
          <div className="rounded-2xl bg-themewhite2 overflow-hidden">
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
                className="w-full bg-transparent px-4 py-3 text-base md:text-sm text-primary placeholder:text-tertiary focus:outline-none"
              />
            </Row>
            <Row>
              <textarea
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                placeholder="Message *"
                rows={4}
                maxLength={2000}
                className="w-full bg-transparent px-4 py-3 text-base md:text-sm text-primary placeholder:text-tertiary focus:outline-none resize-none"
              />
            </Row>
            <div className="flex items-center justify-end gap-2 px-3 py-2">
              <button
                type="button"
                onClick={() => setMessageActive(false)}
                className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all"
              >
                <X size={16} />
              </button>
              {(() => {
                const messageReady = name.trim().length > 0 && messageBody.trim().length > 0 && stage1.kind === 'resolved'
                return (
                  <button
                    type="button"
                    onClick={() => void onSubmitMessage()}
                    disabled={submit.kind === 'submitting' || !messageReady}
                    className={`shrink-0 h-9 rounded-full flex items-center justify-center bg-themeblue3 text-white overflow-hidden transition-all duration-300 ease-out active:scale-95 ${messageReady ? 'w-9 opacity-100' : 'w-0 opacity-0 pointer-events-none'}`}
                  >
                    {submit.kind === 'submitting' ? <RefreshCw size={14} className="animate-spin" /> : <Check size={16} />}
                  </button>
                )
              })()}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="pb-2">
            <p className="text-[9pt] font-semibold text-secondary tracking-widest uppercase">
              {showStage2 ? 'Event Details' : stage1.kind === 'resolved' ? stage1.clinicName : 'Verify Unit'}
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
                {stage1.kind === 'unknown' && (
                  <HintRow tone="err">
                    No medical section is associated with this code. Confirm the code with your medical section POC.
                  </HintRow>
                )}

                {stage1.kind === 'resolved' && (() => {
                  // Open channels, in display order. Event request only when intake is on.
                  const channels = [
                    ...(stage1.intakeEnabled ? [{ key: 'event' as const, label: 'Event request' }] : []),
                    ...(stage1.oncallEnabled ? [{ key: 'call' as const, label: 'Call' }] : []),
                    ...(stage1.messageEnabled ? [{ key: 'message' as const, label: 'Message' }] : []),
                  ]

                  // Credential is live but every channel is closed — neutral dead-end,
                  // no passphrase prompt (nothing to submit to).
                  if (channels.length === 0) {
                    return (
                      <HintRow tone="muted">
                        This medical section isn’t accepting outside submissions right now.
                      </HintRow>
                    )
                  }

                  return (
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

                      {/* Channel pick — event request vs. live call vs. one-way message,
                          using the calendar filter-row primitive. Only when more than one
                          channel is open; a lone channel needs no chooser. */}
                      {channels.length > 1 && channels.map(({ key, label }) => {
                        const selected = channel === key
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setChannel(key)}
                            className={`w-full flex items-center gap-3 py-2.5 px-4 text-left transition-colors active:scale-95 ${
                              selected
                                ? 'bg-themeblue3/8 border-l-2 border-l-themeblue3'
                                : 'hover:bg-secondary/5'
                            }`}
                          >
                            <span className="text-[10pt] font-medium text-primary truncate flex-1">{label}</span>
                            {selected && <Check size={14} className="text-themeblue2 shrink-0" />}
                          </button>
                        )
                      })}
                    </>
                  )
                })()}

                <div className={`flex items-center justify-end gap-2 px-3 overflow-hidden transition-all duration-300 ease-out ${stage1Ready ? 'max-h-14 py-2 opacity-100' : 'max-h-0 py-0 opacity-0'}`}>
                  <button
                    type="button"
                    onClick={() => setPassphrase('')}
                    className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all"
                  >
                    <X size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={onContinue}
                    className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-themeblue3 text-white active:scale-95 transition-all"
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

/**
 * Static glitch dead-link graphic shown when a baked-in URL passcode fails to
 * resolve. Mirrors a classic 404 art piece — circular outline frozen mid-tear:
 * horizontal slice bands of the ring are displaced sideways with a chromatic
 * fringe (themeblue3 / themered), the "404" is torn into offset CSS slices, and
 * solid data-blocks are scattered around. Pure cosmetic client-side surface
 * (the HTTP shell is always 200); no app branding, no animation.
 */
export function Glitch404() {
  const BLUE = 'var(--color-themeblue3)'
  const RED = 'var(--color-themered)'
  const INK = 'var(--color-primary)'
  const BG = 'var(--color-themewhite)'
  const CX = 120, CY = 110, R = 96, SW = 10

  // Horizontal strips of the ring torn out and kicked sideways. `c` is the solid
  // color the displaced arc is repainted in — the slice reads as a chunk of the
  // shape physically offset, not a translucent colour sliding over it.
  const ringBands = [
    { y: 42, h: 11, dx: -14, c: BLUE },
    { y: 84, h: 7, dx: 16, c: RED },
    { y: 114, h: 12, dx: -18, c: BLUE },
    { y: 152, h: 8, dx: 13, c: RED },
    { y: 180, h: 12, dx: -10, c: BLUE },
  ]
  // Hard cuts: background-coloured rects punched through the ring so the circle
  // looks broken/fragmented rather than intact.
  const ringCuts = [
    { y: 138, h: 4 },
  ]

  return (
    <div className="flex flex-col items-center justify-center select-none">
      <div className="relative w-96 h-80">
        <svg viewBox="0 0 240 220" className="w-full h-full" fill="none">
          <defs>
            {ringBands.map((b, i) => (
              <clipPath key={i} id={`ringBand${i}`}>
                <rect x="0" y={b.y} width="240" height={b.h} />
              </clipPath>
            ))}
            {/* soft blur on the chromatic colouring — bleeds the blue/red so it
                reads as light leaking off the torn edges, not a crisp outline */}
            <filter id="ringColorBlur" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.2" />
            </filter>
          </defs>

          {/* scattered solid data-blocks + static marks */}
          <g strokeWidth="3" strokeLinecap="round">
            <rect x="194" y="32" width="20" height="6" fill={BLUE} stroke="none" />
            <rect x="200" y="42" width="11" height="5" fill={RED} stroke="none" />
            <rect x="24" y="58" width="22" height="7" fill={RED} stroke="none" />
            <rect x="214" y="128" width="18" height="6" fill={RED} stroke="none" />
            <rect x="8" y="142" width="15" height="5" fill={BLUE} stroke="none" />
            <rect x="170" y="188" width="10" height="10" fill={BLUE} stroke="none" />
            <rect x="52" y="20" width="7" height="7" fill={RED} stroke="none" />
            <rect x="30" y="196" width="13" height="5" fill={BLUE} stroke="none" />
            <line x1="198" y1="178" x2="212" y2="178" stroke={RED} />
            <line x1="32" y1="168" x2="46" y2="168" stroke={BLUE} />
            <line x1="36" y1="174" x2="44" y2="174" stroke={BLUE} />
          </g>

          {/* base ring — solid ink with a soft, blurred chromatic fringe */}
          <g filter="url(#ringColorBlur)">
            <circle cx={CX} cy={CY} r={R} stroke={BLUE} strokeWidth={SW} opacity="0.55" transform="translate(-4,0)" />
            <circle cx={CX} cy={CY} r={R} stroke={RED} strokeWidth={SW} opacity="0.55" transform="translate(4,0)" />
          </g>
          <circle cx={CX} cy={CY} r={R} stroke={INK} strokeWidth={SW} />

          {/* torn slices — each strip erased in place, then repainted offset in a
              soft-blurred solid colour so it reads as a displaced chunk of ring */}
          {ringBands.map((b, i) => (
            <g key={i} clipPath={`url(#ringBand${i})`}>
              <rect x="0" y={b.y} width="240" height={b.h} fill={BG} />
              <circle cx={CX} cy={CY} r={R} stroke={b.c} strokeWidth={SW} filter="url(#ringColorBlur)" transform={`translate(${b.dx},0)`} />
            </g>
          ))}

          {/* hard cuts — break the circle */}
          {ringCuts.map((c, i) => (
            <rect key={i} x="0" y={c.y} width="240" height={c.h} fill={BG} />
          ))}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {/* semibold 404 with a crisp chromatic fringe (no blur, no slices) */}
          <span
            className="text-[56pt] font-semibold leading-none tracking-tight"
            style={{ color: INK, textShadow: `4px 0 ${BLUE}, -4px 0 ${RED}` }}
          >
            404
          </span>
          <div
            className="mt-2 text-[10pt] font-semibold tracking-[0.18em] lowercase"
            style={{ color: INK, textShadow: `1px 0 ${BLUE}, -1px 0 ${RED}` }}
          >
            page no longer exists
          </div>
        </div>
      </div>
    </div>
  )
}

export function Shell({ children }: { children: React.ReactNode }) {
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

function HintRow({ tone, children }: { tone: 'ok' | 'err' | 'muted'; children: React.ReactNode }) {
  const color =
    tone === 'ok' ? 'text-themegreen'
    : tone === 'err' ? 'text-themeredred'
    : 'text-tertiary'
  return (
    <div className={`px-4 py-2 text-[10pt] leading-relaxed border-b border-primary/6 ${color}`}>
      {children}
    </div>
  )
}

