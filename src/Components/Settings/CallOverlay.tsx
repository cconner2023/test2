/**
 * CallOverlay — Full-screen voice call UI.
 *
 * Renders above all drawers at z-[100].
 * Shows peer name, call status, elapsed timer, and control buttons.
 */

import { useState, useEffect } from 'react'
import { Phone, PhoneOff, Mic, MicOff } from 'lucide-react'
import { useCallStore, selectShowCallUI } from '../../stores/useCallStore'
import { useCallActions } from '../../Hooks/CallContext'

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function statusText(status: string, direction: string | null, endReason: string | null): string {
  if (status === 'ended') return endReason ?? 'Call ended'
  if (status === 'connected') return 'Connected'
  if (status === 'connecting') return 'Connecting...'
  if (status === 'ringing' && direction === 'incoming') return 'Incoming call...'
  if (status === 'ringing' && direction === 'outgoing') return 'Ringing...'
  return ''
}

export function CallOverlay() {
  const showUI = useCallStore(selectShowCallUI)
  const status = useCallStore((s) => s.status)
  const direction = useCallStore((s) => s.direction)
  const peer = useCallStore((s) => s.peer)
  const connectedAt = useCallStore((s) => s.connectedAt)
  const endReason = useCallStore((s) => s.endReason)
  const isMuted = useCallStore((s) => s.isMuted)
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

  return (
    <div className="fixed inset-0 z-[100] bg-gray-900/95 flex flex-col items-center justify-between py-20 px-6">
      {/* Peer info */}
      <div className="flex flex-col items-center gap-3">
        <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center">
          <span className="text-2xl font-semibold text-white">
            {peer.displayName.charAt(0).toUpperCase()}
          </span>
        </div>
        <h2 className="text-xl font-semibold text-white">{peer.displayName}</h2>
        <p className="text-sm text-gray-400">
          {status === 'connected' ? formatElapsed(elapsed) : statusText(status, direction, endReason)}
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-6">
        {/* Mute toggle — visible during active call */}
        {isActive && (
          <button
            onClick={() => actions?.toggleMute()}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors
                       ${isMuted ? 'bg-red-500/20' : 'bg-gray-700'}`}
          >
            {isMuted ? (
              <MicOff size={24} className="text-red-400" />
            ) : (
              <Mic size={24} className="text-white" />
            )}
          </button>
        )}

        {/* Accept — incoming ringing only */}
        {isIncoming && isRinging && (
          <button
            onClick={() => actions?.acceptCall()}
            className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center
                       active:scale-95 transition-transform"
          >
            <Phone size={28} className="text-white" />
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
            className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center
                       active:scale-95 transition-transform"
          >
            <PhoneOff size={28} className="text-white" />
          </button>
        )}
      </div>
    </div>
  )
}
