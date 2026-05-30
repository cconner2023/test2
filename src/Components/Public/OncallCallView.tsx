import { useCallback, useEffect, useRef, useState } from 'react'
import { Phone, PhoneOff, Mic, MicOff, X } from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createOncallPeer, type OncallPeer } from '../../lib/webrtc/oncallPeer'
import { requestOncall, pollOncallSignal, markOncallMissedAnon, type OncallGreetingWire } from '../../lib/oncallAnonService'
import { OncallVoicemailRecorder } from './OncallVoicemailRecorder'

const RING_TIMEOUT_MS = 30_000
const POLL_INTERVAL_MS = 1300

interface Props {
  supabase: SupabaseClient
  passcode: string
  passphrase: string
  clinicName: string
  /** bad passphrase / on-call disabled → clear credentials back to stage 1 */
  onReject: () => void
  onClose: () => void
}

type State = 'name' | 'placing' | 'ringing' | 'connecting' | 'connected' | 'voicemail'

/**
 * Outside-bundle live-call surface. Captures a name, places the call
 * (request_oncall is the passphrase-bearing action — mirrors submit), rings via
 * polled non-trickle signaling, connects P2P audio, and falls through to
 * voicemail on no-answer/decline/fail. Imports the WebRTC + seal stacks only —
 * NO `src/lib/signal/*` (bundle firewall intact).
 */
export function OncallCallView({ supabase, passcode, passphrase, clinicName, onReject, onClose }: Props) {
  const [state, setState] = useState<State>('name')
  const [name, setName] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [muted, setMuted] = useState(false)

  const peerRef = useRef<OncallPeer | null>(null)
  const callIdRef = useRef<string | null>(null)
  const recipientPubRef = useRef<string | null>(null)
  const greetingRef = useRef<OncallGreetingWire | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const deadlineRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioElRef = useRef<HTMLAudioElement | null>(null)
  // Web-Audio ringback (no real telephony ring-back exists for WebRTC).
  const ringbackRef = useRef<{ ctx: AudioContext; stop: () => void } | null>(null)

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    if (deadlineRef.current) { clearTimeout(deadlineRef.current); deadlineRef.current = null }
  }, [])

  const stopRingback = useCallback(() => {
    ringbackRef.current?.stop()
    ringbackRef.current = null
  }, [])

  const startRingback = useCallback(() => {
    try {
      const ctx = new AudioContext()
      const gain = ctx.createGain()
      gain.gain.value = 0
      gain.connect(ctx.destination)
      const o1 = ctx.createOscillator(); o1.frequency.value = 440
      const o2 = ctx.createOscillator(); o2.frequency.value = 480
      o1.connect(gain); o2.connect(gain); o1.start(); o2.start()
      // US ring cadence: 2s on, 4s off.
      let on = false
      const cycle = () => {
        on = !on
        gain.gain.setTargetAtTime(on ? 0.08 : 0, ctx.currentTime, 0.05)
      }
      cycle()
      const iv = setInterval(cycle, 2000)
      ringbackRef.current = {
        ctx,
        stop: () => { clearInterval(iv); o1.stop(); o2.stop(); void ctx.close() },
      }
    } catch { /* ringback is cosmetic */ }
  }, [])

  const teardown = useCallback(() => {
    stopPolling()
    stopRingback()
    if (elapsedRef.current) { clearInterval(elapsedRef.current); elapsedRef.current = null }
    peerRef.current?.cleanup()
    peerRef.current = null
  }, [stopPolling, stopRingback])

  useEffect(() => () => teardown(), [teardown])

  const goVoicemail = useCallback(() => {
    stopPolling()
    stopRingback()
    peerRef.current?.cleanup()
    peerRef.current = null
    setState('voicemail')
  }, [stopPolling, stopRingback])

  const onConnected = useCallback(() => {
    stopRingback()
    setState('connected')
    setElapsed(0)
    elapsedRef.current = setInterval(() => setElapsed((s) => s + 1), 1000)
  }, [stopRingback])

  const beginPolling = useCallback(() => {
    const callId = callIdRef.current
    if (!callId) return
    pollRef.current = setInterval(async () => {
      const res = await pollOncallSignal(supabase, passcode, callId)
      if (!res) return
      if (res.answered && res.answer_sdp && peerRef.current) {
        stopPolling()
        try {
          await peerRef.current.acceptAnswer(res.answer_sdp)
          setState('connecting')
        } catch {
          goVoicemail()
        }
      } else if (res.ended) {
        goVoicemail()
      }
    }, POLL_INTERVAL_MS)
    deadlineRef.current = setTimeout(goVoicemail, RING_TIMEOUT_MS)
  }, [supabase, passcode, stopPolling, goVoicemail])

  const placeCall = useCallback(async () => {
    if (name.trim().length === 0) return
    setState('placing')
    const peer = createOncallPeer()
    peerRef.current = peer
    try {
      await peer.init({
        onTrack: (stream) => { if (audioElRef.current) audioElRef.current.srcObject = stream },
        onConnectionStateChange: (st) => {
          if (st === 'connected') onConnected()
          else if (st === 'failed' || st === 'disconnected' || st === 'closed') {
            setState((cur) => {
              if (cur === 'connected') { teardown(); onClose(); return cur }
              return cur
            })
          }
        },
      })
      const offer = await peer.createOffer()
      const res = await requestOncall(supabase, passcode, passphrase, name.trim(), offer)
      if (!res.ok) {
        teardown()
        onReject()
        return
      }
      callIdRef.current = res.data.call_id
      recipientPubRef.current = res.data.recipient_pub
      greetingRef.current = res.data.voicemail_greeting
      // No exact on-call headcount any more (staffing recon) — just ring vs
      // straight-to-voicemail when nobody is on-call.
      if (!res.data.will_ring) {
        goVoicemail()
        return
      }
      setState('ringing')
      startRingback()
      beginPolling()
    } catch {
      // mic denied or network error — offer voicemail if a key exists, else bail
      if (recipientPubRef.current && callIdRef.current) goVoicemail()
      else { teardown(); onClose() }
    }
  }, [name, supabase, passcode, passphrase, onReject, onClose, teardown, goVoicemail, startRingback, beginPolling, onConnected])

  const hangUp = useCallback(() => { teardown(); onClose() }, [teardown, onClose])

  const toggleMute = useCallback(() => {
    setMuted((m) => { peerRef.current?.setMuted(!m); return !m })
  }, [])

  const closeFromVoicemail = useCallback(() => {
    const callId = callIdRef.current
    if (callId) void markOncallMissedAnon(supabase, passcode, callId)
    onClose()
  }, [supabase, passcode, onClose])

  return (
    <>
      <audio ref={audioElRef} autoPlay playsInline className="hidden" />

      {state === 'name' && (
        <>
          <div className="pb-2">
            <p className="text-[9pt] font-semibold text-secondary tracking-widest uppercase">Request a call</p>
          </div>
          <div className="rounded-2xl bg-themewhite2 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-primary/6 bg-themewhite/30">
              <p className="text-[9pt] text-tertiary uppercase tracking-widest">Calling</p>
              <p className="text-sm font-medium text-primary">{clinicName}</p>
            </div>
            <label className="block border-b border-primary/6 last:border-b-0">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name *"
                autoFocus
                className="w-full bg-transparent px-4 py-3 text-base md:text-sm text-primary placeholder:text-tertiary focus:outline-none"
              />
            </label>
            <div className="flex items-center justify-end gap-2 px-3 py-2">
              <button type="button" onClick={onClose} className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all">
                <X size={16} />
              </button>
              <button
                type="button"
                onClick={() => void placeCall()}
                disabled={name.trim().length === 0}
                className={`shrink-0 h-9 rounded-full flex items-center justify-center bg-themeblue3 text-white overflow-hidden transition-all duration-300 ease-out active:scale-95 ${name.trim().length > 0 ? 'w-9 opacity-100' : 'w-0 opacity-0 pointer-events-none'}`}
                aria-label="Call now"
              >
                <Phone size={16} />
              </button>
            </div>
          </div>
        </>
      )}

      {(state === 'placing' || state === 'ringing' || state === 'connecting') && (
        <div className="rounded-2xl bg-themewhite2 overflow-hidden px-4 py-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-themeblue3/10 flex items-center justify-center">
            <Phone size={26} className="text-themeblue3 animate-pulse" />
          </div>
          <p className="text-sm font-medium text-primary mb-1">
            {state === 'placing' ? 'Connecting…' : state === 'connecting' ? 'Answering…' : 'Ringing on-call…'}
          </p>
          <p className="text-[10pt] text-secondary">{state === 'ringing' ? 'This can take up to 30 seconds.' : 'Please wait.'}</p>
          <div className="flex justify-center mt-5">
            <button type="button" onClick={hangUp} className="w-14 h-14 rounded-full flex items-center justify-center bg-themeredred text-white active:scale-95 transition-all" aria-label="Cancel">
              <PhoneOff size={22} />
            </button>
          </div>
        </div>
      )}

      {state === 'connected' && (
        <div className="rounded-2xl bg-themewhite2 overflow-hidden px-4 py-8 text-center">
          <p className="text-[9pt] text-tertiary uppercase tracking-widest mb-1">Connected</p>
          <p className="text-sm font-medium text-primary mb-1">{clinicName}</p>
          <p className="font-mono text-lg text-primary mb-5">
            {String(Math.floor(elapsed / 60)).padStart(1, '0')}:{String(elapsed % 60).padStart(2, '0')}
          </p>
          <div className="flex justify-center gap-4">
            <button type="button" onClick={toggleMute} className={`w-14 h-14 rounded-full flex items-center justify-center active:scale-95 transition-all ${muted ? 'bg-primary/10 text-primary' : 'bg-themewhite text-secondary'}`} aria-label={muted ? 'Unmute' : 'Mute'}>
              {muted ? <MicOff size={22} /> : <Mic size={22} />}
            </button>
            <button type="button" onClick={hangUp} className="w-14 h-14 rounded-full flex items-center justify-center bg-themeredred text-white active:scale-95 transition-all" aria-label="Hang up">
              <PhoneOff size={22} />
            </button>
          </div>
        </div>
      )}

      {state === 'voicemail' && callIdRef.current && (
        <OncallVoicemailRecorder
          supabase={supabase}
          passcode={passcode}
          passphrase={passphrase}
          callId={callIdRef.current}
          recipientPub={recipientPubRef.current}
          greeting={greetingRef.current}
          onClose={closeFromVoicemail}
        />
      )}
    </>
  )
}
