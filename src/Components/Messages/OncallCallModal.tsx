import { useCallback, useEffect, useRef, useState } from 'react'
import { Phone, PhoneOff, Mic, MicOff } from 'lucide-react'
import { onOncallRing, type OncallRingEvent } from '../../lib/webrtc/oncallSignalBus'
import { createOncallPeer, type OncallPeer } from '../../lib/webrtc/oncallPeer'
import { acceptOncall, markOncallEnded } from '../../lib/oncallService'
import { useCallStore } from '../../stores/useCallStore'

const RING_TIMEOUT_MS = 30_000

type State =
  | { kind: 'idle' }
  | { kind: 'incoming'; callId: string; clinicId: string; name: string; offer: RTCSessionDescriptionInit }
  | { kind: 'connecting'; callId: string; name: string }
  | { kind: 'connected'; callId: string; name: string }

/**
 * Global incoming on-call ring + live-call surface for medics. Mounted once
 * (alongside CallOverlay). Subscribes to the oncall ring bus, runs the
 * first-answer CAS (accept_oncall) on Answer, and holds the P2P audio call.
 *
 * The live ring is transient — it is NEVER a stored card (the resolved
 * oncall-call card is). A dev who isn't on-call receives no ring row, so this
 * never shows for the observe-only surface; capability is enforced by the
 * server-resolved ring set + the accept_oncall RLS/CAS.
 */
export function OncallCallModal() {
  const [state, setState] = useState<State>({ kind: 'idle' })
  const [elapsed, setElapsed] = useState(0)
  const [muted, setMuted] = useState(false)

  const peerRef = useRef<OncallPeer | null>(null)
  const audioElRef = useRef<HTMLAudioElement | null>(null)
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const ringAudioRef = useRef<{ stop: () => void } | null>(null)
  const stateRef = useRef<State>(state)
  stateRef.current = state

  const stopRing = useCallback(() => {
    ringAudioRef.current?.stop()
    ringAudioRef.current = null
  }, [])

  const startRing = useCallback(() => {
    try {
      const ctx = new AudioContext()
      const gain = ctx.createGain()
      gain.gain.value = 0
      gain.connect(ctx.destination)
      const osc = ctx.createOscillator()
      osc.frequency.value = 587 // a gentle ring tone
      osc.connect(gain)
      osc.start()
      let on = false
      const cycle = () => { on = !on; gain.gain.setTargetAtTime(on ? 0.06 : 0, ctx.currentTime, 0.04) }
      cycle()
      const iv = setInterval(cycle, 1000)
      ringAudioRef.current = { stop: () => { clearInterval(iv); osc.stop(); void ctx.close() } }
    } catch { /* ring tone is cosmetic */ }
  }, [])

  const reset = useCallback(() => {
    stopRing()
    if (dismissTimerRef.current) { clearTimeout(dismissTimerRef.current); dismissTimerRef.current = null }
    if (elapsedTimerRef.current) { clearInterval(elapsedTimerRef.current); elapsedTimerRef.current = null }
    peerRef.current?.cleanup()
    peerRef.current = null
    setMuted(false)
    setElapsed(0)
    setState({ kind: 'idle' })
  }, [stopRing])

  useEffect(() => () => reset(), [reset])

  // Subscribe to the ring bus.
  useEffect(() => {
    return onOncallRing((e: OncallRingEvent) => {
      if (e.kind === 'cancel') {
        const cur = stateRef.current
        if (cur.kind === 'incoming' && cur.callId === e.callId) reset()
        return
      }
      // ring: ignore if already busy (this oncall or a medic↔medic call).
      const cur = stateRef.current
      if (cur.kind !== 'idle') return
      if (useCallStore.getState().status !== 'idle') return
      startRing()
      setState({ kind: 'incoming', callId: e.callId, clinicId: e.clinicId, name: e.requesterName, offer: e.sdpOffer })
      dismissTimerRef.current = setTimeout(reset, RING_TIMEOUT_MS)
    })
  }, [reset, startRing])

  const onConnected = useCallback((callId: string, name: string) => {
    stopRing()
    setState({ kind: 'connected', callId, name })
    setElapsed(0)
    elapsedTimerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000)
  }, [stopRing])

  const answer = useCallback(async () => {
    const cur = stateRef.current
    if (cur.kind !== 'incoming') return
    stopRing()
    if (dismissTimerRef.current) { clearTimeout(dismissTimerRef.current); dismissTimerRef.current = null }
    const { callId, name, offer } = cur
    setState({ kind: 'connecting', callId, name })
    const peer = createOncallPeer()
    peerRef.current = peer
    try {
      await peer.init({
        onTrack: (stream) => { if (audioElRef.current) audioElRef.current.srcObject = stream },
        onConnectionStateChange: (st) => {
          if (st === 'connected') onConnected(callId, name)
          else if (st === 'failed' || st === 'disconnected' || st === 'closed') {
            if (stateRef.current.kind === 'connected') { void markOncallEnded(callId); reset() }
          }
        },
      })
      const answerSdp = await peer.createAnswer(offer)
      const { won } = await acceptOncall(callId, answerSdp)
      if (!won) { reset(); return } // another medic won the CAS
    } catch {
      reset()
    }
  }, [stopRing, onConnected, reset])

  const decline = useCallback(() => {
    // Local-only: declining just dismisses my ring — other on-call medics keep
    // ringing. The call only resolves on winner-hangup / anon give-up.
    reset()
  }, [reset])

  const hangUp = useCallback(() => {
    const cur = stateRef.current
    if (cur.kind === 'connected' || cur.kind === 'connecting') void markOncallEnded(cur.callId)
    reset()
  }, [reset])

  const toggleMute = useCallback(() => {
    setMuted((m) => { peerRef.current?.setMuted(!m); return !m })
  }, [])

  if (state.kind === 'idle') return null

  const name = state.kind === 'incoming' || state.kind === 'connecting' || state.kind === 'connected' ? state.name : ''

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-between py-20 px-6">
      <audio ref={audioElRef} autoPlay playsInline className="hidden" />

      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <div className="w-24 h-24 rounded-full bg-themeblue3/20 flex items-center justify-center mb-6">
          <Phone size={40} className={state.kind === 'incoming' ? 'text-themeblue3 animate-pulse' : 'text-themeblue3'} />
        </div>
        <p className="text-white/60 text-[10pt] uppercase tracking-widest mb-1">
          {state.kind === 'incoming' ? 'Incoming on-call' : state.kind === 'connecting' ? 'Connecting…' : 'On-call'}
        </p>
        <p className="text-white text-xl font-medium">{name || 'Outside caller'}</p>
        {state.kind === 'connected' && (
          <p className="font-mono text-white/80 text-lg mt-2">
            {String(Math.floor(elapsed / 60)).padStart(1, '0')}:{String(elapsed % 60).padStart(2, '0')}
          </p>
        )}
      </div>

      <div className="flex items-center justify-center gap-6">
        {state.kind === 'incoming' && (
          <>
            <button type="button" onClick={decline} className="w-16 h-16 rounded-full flex items-center justify-center bg-themeredred text-white active:scale-95 transition-all" aria-label="Decline">
              <PhoneOff size={26} />
            </button>
            <button type="button" onClick={() => void answer()} className="w-16 h-16 rounded-full flex items-center justify-center bg-themegreen text-white active:scale-95 transition-all" aria-label="Answer">
              <Phone size={26} />
            </button>
          </>
        )}
        {(state.kind === 'connecting' || state.kind === 'connected') && (
          <>
            {state.kind === 'connected' && (
              <button type="button" onClick={toggleMute} className={`w-16 h-16 rounded-full flex items-center justify-center active:scale-95 transition-all ${muted ? 'bg-white/20 text-white' : 'bg-white/10 text-white/80'}`} aria-label={muted ? 'Unmute' : 'Mute'}>
                {muted ? <MicOff size={26} /> : <Mic size={26} />}
              </button>
            )}
            <button type="button" onClick={hangUp} className="w-16 h-16 rounded-full flex items-center justify-center bg-themeredred text-white active:scale-95 transition-all" aria-label="Hang up">
              <PhoneOff size={26} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
