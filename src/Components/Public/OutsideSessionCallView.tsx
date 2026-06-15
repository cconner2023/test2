import { useCallback, useEffect, useRef, useState } from 'react'
import { Phone, PhoneOff, Mic, MicOff } from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createOncallPeer, type OncallPeer } from '../../lib/webrtc/oncallPeer'
import { submitOutsideSessionCallSignal } from '../../lib/outsideSessionAnonService'

interface Props {
  supabase: SupabaseClient
  sessionId: string
  callId: string
  offer: RTCSessionDescriptionInit
  fromName: string
  /** Fired on decline / hangup / connection end so the parent clears the call. */
  onEnded: () => void
}

type State = 'incoming' | 'connecting' | 'live'

function fmt(s: number): string {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/**
 * Outside-party incoming ring-back surface (anon bundle). The medic is the
 * offerer; here we are the ANSWERER — accept → oncallPeer.createAnswer(offer) →
 * submit 'answer' (full gather-once SDP). Imports the WebRTC + anon service only,
 * NO src/lib/signal/*. A medic hangup arrives via the parent poll loop, which
 * unmounts this view (cleanup tears the peer down).
 */
export function OutsideSessionCallView({ supabase, sessionId, callId, offer, fromName, onEnded }: Props) {
  const [state, setState] = useState<State>('incoming')
  const [elapsed, setElapsed] = useState(0)
  const [muted, setMuted] = useState(false)

  const peerRef = useRef<OncallPeer | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const doneRef = useRef(false)

  const teardown = useCallback(() => {
    if (elapsedRef.current) { clearInterval(elapsedRef.current); elapsedRef.current = null }
    peerRef.current?.cleanup()
    peerRef.current = null
  }, [])

  useEffect(() => () => teardown(), [teardown])

  const onLive = useCallback(() => {
    setState('live')
    setElapsed(0)
    elapsedRef.current = setInterval(() => setElapsed((s) => s + 1), 1000)
  }, [])

  const accept = useCallback(async () => {
    setState('connecting')
    const peer = createOncallPeer()
    peerRef.current = peer
    try {
      await peer.init({
        onTrack: (stream) => { if (audioRef.current) audioRef.current.srcObject = stream },
        onConnectionStateChange: (st) => {
          if (st === 'connected') onLive()
          else if (st === 'failed' || st === 'disconnected' || st === 'closed') {
            if (!doneRef.current) { doneRef.current = true; teardown(); onEnded() }
          }
        },
      })
      const answer = await peer.createAnswer(offer)
      await submitOutsideSessionCallSignal(supabase, sessionId, 'answer', callId, answer)
    } catch {
      if (!doneRef.current) { doneRef.current = true; teardown(); onEnded() }
    }
  }, [supabase, sessionId, callId, offer, onLive, teardown, onEnded])

  const decline = useCallback(() => {
    if (doneRef.current) return
    doneRef.current = true
    void submitOutsideSessionCallSignal(supabase, sessionId, 'decline', callId).catch(() => {})
    teardown()
    onEnded()
  }, [supabase, sessionId, callId, teardown, onEnded])

  const hangUp = useCallback(() => {
    if (doneRef.current) return
    doneRef.current = true
    void submitOutsideSessionCallSignal(supabase, sessionId, 'hangup', callId).catch(() => {})
    teardown()
    onEnded()
  }, [supabase, sessionId, callId, teardown, onEnded])

  const toggleMute = useCallback(() => {
    setMuted((m) => { peerRef.current?.setMuted(!m); return !m })
  }, [])

  return (
    <div className="rounded-2xl bg-themeblue3/8 border border-themeblue3/20 overflow-hidden px-4 py-4 mb-3">
      <audio ref={audioRef} autoPlay playsInline className="hidden" />
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full bg-themeblue3/15 flex items-center justify-center shrink-0">
          <Phone size={18} className={`text-themeblue3 ${state === 'incoming' ? 'animate-pulse' : ''}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-primary truncate">{fromName || 'Medical section'}</p>
          <p className="text-[10pt] text-secondary">
            {state === 'incoming' ? 'Incoming call' : state === 'connecting' ? 'Connecting…' : fmt(elapsed)}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center gap-4 mt-4">
        {state === 'incoming' ? (
          <>
            <button type="button" onClick={decline} className="w-12 h-12 rounded-full bg-themeredred text-white flex items-center justify-center active:scale-95 transition-all" aria-label="Decline">
              <PhoneOff size={20} />
            </button>
            <button type="button" onClick={() => void accept()} className="w-12 h-12 rounded-full bg-themegreen text-white flex items-center justify-center active:scale-95 transition-all" aria-label="Accept">
              <Phone size={20} />
            </button>
          </>
        ) : (
          <>
            {state === 'live' && (
              <button type="button" onClick={toggleMute} className={`w-12 h-12 rounded-full flex items-center justify-center active:scale-95 transition-all ${muted ? 'bg-primary/10 text-primary' : 'bg-themewhite text-secondary'}`} aria-label={muted ? 'Unmute' : 'Mute'}>
                {muted ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
            )}
            <button type="button" onClick={hangUp} className="w-12 h-12 rounded-full bg-themeredred text-white flex items-center justify-center active:scale-95 transition-all" aria-label="Hang up">
              <PhoneOff size={20} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
