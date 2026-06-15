import { useCallback, useEffect, useRef, useState } from 'react'
import { PhoneOff, Mic, MicOff } from 'lucide-react'
import { createOncallPeer, type OncallPeer } from '../../lib/webrtc/oncallPeer'
import { ringOutsideSession, sendOutsideSessionCallSignal } from '../../lib/outsideSessionService'
import { onOutsideCallSignal, type OutsideRingbackRequest } from '../../lib/webrtc/outsideSessionCallBus'

interface Props {
  req: OutsideRingbackRequest
  onClose: () => void
}

type State = 'connecting' | 'ringing' | 'live' | 'ended'

const RING_TIMEOUT_MS = 30_000

function fmt(s: number): string {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/**
 * Cluster-side ring-back overlay (medic → open outside tab). The medic is the
 * OFFERER: oncallPeer.createOffer → ring_outside_session; the tab's answer
 * arrives via decryptRow → outsideSessionCallBus. Non-trickle, so the offer/
 * answer SDPs bundle all ICE — no per-candidate exchange. Self-contained (its
 * own peer + minimal UI), so it doesn't touch the medic↔medic useCall stack.
 */
export function OutsideSessionRingbackOverlay({ req, onClose }: Props) {
  const [state, setState] = useState<State>('connecting')
  const [endReason, setEndReason] = useState<string>('')
  const [elapsed, setElapsed] = useState(0)
  const [muted, setMuted] = useState(false)

  const peerRef = useRef<OncallPeer | null>(null)
  const callIdRef = useRef<string>('')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const stateRef = useRef<State>('connecting')
  const doneRef = useRef(false)
  stateRef.current = state

  const teardown = useCallback(() => {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null }
    if (elapsedRef.current) { clearInterval(elapsedRef.current); elapsedRef.current = null }
    peerRef.current?.cleanup()
    peerRef.current = null
  }, [])

  // End the call: signal the tab (cancel while ringing, hangup once live) then close.
  const end = useCallback((reason: string, signal: boolean) => {
    if (doneRef.current) return
    doneRef.current = true
    if (signal && callIdRef.current) {
      void sendOutsideSessionCallSignal(callIdRef.current, stateRef.current === 'live' ? 'hangup' : 'cancel').catch(() => {})
    }
    teardown()
    setEndReason(reason)
    setState('ended')
    setTimeout(onClose, 1500)
  }, [teardown, onClose])

  const onConnected = useCallback(() => {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null }
    setState('live')
    setElapsed(0)
    elapsedRef.current = setInterval(() => setElapsed((s) => s + 1), 1000)
  }, [])

  // Place the ring-back on mount.
  useEffect(() => {
    let cancelled = false
    const callId = crypto.randomUUID()
    callIdRef.current = callId
    void (async () => {
      const peer = createOncallPeer()
      peerRef.current = peer
      try {
        await peer.init({
          onTrack: (stream) => { if (audioRef.current) audioRef.current.srcObject = stream },
          onConnectionStateChange: (st) => {
            if (st === 'connected') onConnected()
            else if (st === 'failed' || st === 'disconnected' || st === 'closed') {
              if (stateRef.current === 'live') end('Call ended', false)
            }
          },
        })
        const offer = await peer.createOffer()
        if (cancelled) return
        const res = await ringOutsideSession(req.sessionId, callId, offer)
        if (cancelled) return
        if (!res.ok) { end(res.error ?? 'Could not reach the outside party', false); return }
        setState('ringing')
        timeoutRef.current = setTimeout(() => end('No answer', true), RING_TIMEOUT_MS)
      } catch {
        if (!cancelled) end('Microphone unavailable', false)
      }
    })()
    return () => { cancelled = true; teardown() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Inbound answer / decline / hangup from the tab.
  useEffect(() => {
    const unsub = onOutsideCallSignal((sig) => {
      if (sig.callId !== callIdRef.current) return
      if (sig.kind === 'answer') {
        const peer = peerRef.current
        if (peer) peer.acceptAnswer(sig.sdp).then(() => setState('connecting')).catch(() => end('Failed to connect', false))
      } else if (sig.kind === 'decline') {
        end('Declined', false)
      } else if (sig.kind === 'hangup') {
        end('Call ended', false)
      }
    })
    return unsub
  }, [end])

  const toggleMute = useCallback(() => {
    setMuted((m) => { peerRef.current?.setMuted(!m); return !m })
  }, [])

  const statusText =
    state === 'connecting' ? 'Connecting…'
    : state === 'ringing' ? 'Ringing outside party…'
    : state === 'live' ? fmt(elapsed)
    : endReason || 'Call ended'

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-between py-20 px-6">
      <audio ref={audioRef} autoPlay playsInline className="hidden" />

      <div className="flex flex-col items-center gap-3">
        <div className="w-20 h-20 rounded-full bg-tertiary/80 flex items-center justify-center">
          <span className="text-2xl font-semibold text-white">
            {(req.requesterName || 'O').charAt(0).toUpperCase()}
          </span>
        </div>
        <h2 className="text-xl font-semibold text-white">{req.requesterName || 'Outside contact'}</h2>
        <p className="text-sm text-tertiary">{statusText}</p>
      </div>

      <div className="flex items-center gap-6">
        {state === 'live' && (
          <button
            onClick={toggleMute}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${muted ? 'bg-themeredred/20' : 'bg-tertiary/80'}`}
            aria-label={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? <MicOff size={24} className="text-themeredred" /> : <Mic size={24} className="text-white" />}
          </button>
        )}
        {state !== 'ended' && (
          <button
            onClick={() => end(state === 'live' ? 'Call ended' : 'Cancelled', true)}
            className="w-16 h-16 rounded-full bg-themeredred flex items-center justify-center active:scale-95 transition-transform"
            aria-label="Hang up"
          >
            <PhoneOff size={28} className="text-white" />
          </button>
        )}
      </div>
    </div>
  )
}
