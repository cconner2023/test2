/**
 * CallOverlay — Full-screen call UI (audio & video).
 *
 * Renders above all drawers at z-[100].
 * Audio mode: avatar initial, peer name, timer, controls.
 * Video mode: remote video full-area, local PiP overlay, controls overlaid.
 */

import { useState, useEffect, useRef } from 'react'
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react'
import { useCallStore, selectShowCallUI } from '../../stores/useCallStore'
import { useCallActions } from '../../Hooks/CallContext'

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function statusText(status: string, direction: string | null, endReason: string | null, callMode: string): string {
  if (status === 'ended') return endReason ?? 'Call ended'
  if (status === 'connected') return 'Connected'
  if (status === 'connecting') return 'Connecting...'
  if (status === 'ringing' && direction === 'incoming') {
    return callMode === 'video' ? 'Incoming video call...' : 'Incoming call...'
  }
  if (status === 'ringing' && direction === 'outgoing') return 'Ringing...'
  return ''
}

function VideoElement({ stream, muted, className }: { stream: MediaStream | null; muted?: boolean; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (ref.current) {
      ref.current.srcObject = stream
    }
  }, [stream])

  if (!stream) return null

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      className={className}
    />
  )
}

export function CallOverlay() {
  const showUI = useCallStore(selectShowCallUI)
  const status = useCallStore((s) => s.status)
  const direction = useCallStore((s) => s.direction)
  const peer = useCallStore((s) => s.peer)
  const connectedAt = useCallStore((s) => s.connectedAt)
  const endReason = useCallStore((s) => s.endReason)
  const isMuted = useCallStore((s) => s.isMuted)
  const callMode = useCallStore((s) => s.callMode)
  const isVideoOff = useCallStore((s) => s.isVideoOff)
  const actions = useCallActions()

  // Elapsed timer
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (status !== 'connected' || !connectedAt) {
      setElapsed(0)
      return
    }
    const tick = () => setElapsed(Date.now() - connectedAt)
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [status, connectedAt])

  if (!showUI || !peer) return null

  const isIncoming = direction === 'incoming'
  const isRinging = status === 'ringing'
  const isEnded = status === 'ended'
  const isActive = status === 'connected' || status === 'connecting'
  const isVideo = callMode === 'video'

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-between py-20 px-6">
      {/* Video: remote stream full-area background */}
      {isVideo && isActive && (
        <div className="absolute inset-0 z-0">
          <VideoElement
            stream={actions?.remoteStream ?? null}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Video: local PiP overlay (bottom-right, above controls) */}
      {isVideo && isActive && (
        <div className="absolute top-4 right-4 z-10 w-28 h-40 rounded-xl overflow-hidden bg-tertiary/80 shadow-lg border border-white/10">
          {isVideoOff ? (
            <div className="w-full h-full flex items-center justify-center">
              <VideoOff size={24} className="text-tertiary" />
            </div>
          ) : (
            <VideoElement
              stream={actions?.localStream ?? null}
              muted
              className="w-full h-full object-cover mirror"
            />
          )}
        </div>
      )}

      {/* Peer info — overlaid at top for video, normal for audio */}
      <div className={`flex flex-col items-center gap-3 ${isVideo && isActive ? 'z-10' : ''}`}>
        {/* Avatar — hidden during active video call */}
        {!(isVideo && isActive) && (
          <div className="w-20 h-20 rounded-full bg-tertiary/80 flex items-center justify-center">
            <span className="text-2xl font-semibold text-white">
              {peer.displayName.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <h2 className={`text-xl font-semibold text-white ${isVideo && isActive ? 'drop-shadow-lg' : ''}`}>
          {peer.displayName}
        </h2>
        <p className={`text-sm ${isVideo && isActive ? 'text-white/80 drop-shadow-lg' : 'text-tertiary'}`}>
          {status === 'connected' ? formatElapsed(elapsed) : statusText(status, direction, endReason, callMode)}
        </p>
      </div>

      {/* Controls */}
      <div className={`flex items-center gap-6 ${isVideo && isActive ? 'z-10' : ''}`}>
        {/* Mute toggle — visible during active call */}
        {isActive && (
          <button
            onClick={() => actions?.toggleMute()}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors
                       ${isMuted ? 'bg-themeredred/20' : 'bg-tertiary/80'}`}
          >
            {isMuted ? (
              <MicOff size={24} className="text-themeredred" />
            ) : (
              <Mic size={24} className="text-white" />
            )}
          </button>
        )}

        {/* Camera toggle — visible during active video call */}
        {isActive && isVideo && (
          <button
            onClick={() => actions?.toggleVideo()}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors
                       ${isVideoOff ? 'bg-themeredred/20' : 'bg-tertiary/80'}`}
          >
            {isVideoOff ? (
              <VideoOff size={24} className="text-themeredred" />
            ) : (
              <Video size={24} className="text-white" />
            )}
          </button>
        )}

        {/* Accept — incoming ringing only */}
        {isIncoming && isRinging && (
          <button
            onClick={() => actions?.acceptCall()}
            className="w-16 h-16 rounded-full bg-themegreen flex items-center justify-center
                       active:scale-95 transition-transform"
          >
            {isVideo ? (
              <Video size={28} className="text-white" />
            ) : (
              <Phone size={28} className="text-white" />
            )}
          </button>
        )}

        {/* Decline / Hangup — always available when not ended */}
        {!isEnded && (
          <button
            onClick={() => {
              if (isRinging && isIncoming) {
                actions?.declineCall()
              } else {
                actions?.hangUp()
              }
            }}
            className="w-16 h-16 rounded-full bg-themeredred flex items-center justify-center
                       active:scale-95 transition-transform"
          >
            <PhoneOff size={28} className="text-white" />
          </button>
        )}
      </div>
    </div>
  )
}
