/**
 * CallVoicemailControls — shown in CallOverlay when an outgoing call never
 * connected (no answer / declined / failed). Auto-plays the peer's custom
 * greeting, then lets the caller record and send a voice note through the
 * existing Signal voice-note pipeline (useMessages.sendVoice).
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { Mic, X, ArrowUp, Loader2 } from 'lucide-react'
import { useVoiceRecorder } from '../../Hooks/useVoiceRecorder'
import { useMessagesContext } from '../../Hooks/MessagesContext'
import { fetchPeerGreeting, decryptGreetingToUrl } from '../../lib/voicemailService'
import { formatAudioDuration } from '../../Utilities/voiceUtils'

export function CallVoicemailControls({ peerId, onClose }: { peerId: string; onClose: () => void }) {
  const messages = useMessagesContext()
  const [greetingPlaying, setGreetingPlaying] = useState(false)
  const [sending, setSending] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const urlRef = useRef<string | null>(null)

  const {
    isRecording, duration, amplitude,
    startRecording, stopRecording, cancelRecording,
  } = useVoiceRecorder()

  // Auto-play the peer's greeting once on mount.
  useEffect(() => {
    let cancelled = false
    fetchPeerGreeting(peerId).then(async (g) => {
      if (cancelled || !g) return
      const url = await decryptGreetingToUrl(g)
      if (cancelled || !url) return
      urlRef.current = url
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => setGreetingPlaying(false)
      setGreetingPlaying(true)
      audio.play().catch(() => setGreetingPlaying(false))
    })
    return () => {
      cancelled = true
      audioRef.current?.pause()
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    }
  }, [peerId])

  const stopGreeting = useCallback(() => {
    audioRef.current?.pause()
    setGreetingPlaying(false)
  }, [])

  const handleStartRecording = useCallback(() => {
    stopGreeting()
    startRecording()
  }, [stopGreeting, startRecording])

  const handleSend = useCallback(async () => {
    const result = await stopRecording()
    if (!result || !messages) { onClose(); return }
    setSending(true)
    await messages.sendVoice(peerId, result)
    setSending(false)
    onClose()
  }, [stopRecording, messages, peerId, onClose])

  if (sending) {
    return (
      <div className="flex items-center gap-2 text-white/80">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm">Sending voicemail…</span>
      </div>
    )
  }

  if (isRecording) {
    return (
      <div className="flex items-center gap-3">
        <button
          onClick={cancelRecording}
          className="w-14 h-14 rounded-full bg-tertiary/80 flex items-center justify-center active:scale-95 transition-transform"
          aria-label="Cancel"
        >
          <X size={22} className="text-white" />
        </button>
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-full border border-themeredred/40 bg-themeredred/10">
          <div className="w-2 h-2 rounded-full bg-themeredred animate-pulse shrink-0" />
          <span className="text-sm font-medium text-white tabular-nums">{formatAudioDuration(duration)}</span>
          <div className="flex items-center gap-px h-4 w-24">
            {Array.from({ length: 20 }, (_, i) => (
              <div
                key={i}
                className="flex-1 rounded-full bg-themeredred/60 transition-all duration-75"
                style={{ height: `${Math.max(8, (i < 10 ? amplitude : amplitude * 0.6) * 100)}%` }}
              />
            ))}
          </div>
        </div>
        <button
          onClick={handleSend}
          className="w-16 h-16 rounded-full bg-themegreen flex items-center justify-center active:scale-95 transition-transform"
          aria-label="Send voicemail"
        >
          <ArrowUp size={26} className="text-white" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {greetingPlaying && (
        <p className="text-sm text-white/70 drop-shadow-lg">Playing greeting…</p>
      )}
      <div className="flex items-center gap-6">
        <button
          onClick={handleStartRecording}
          className="w-16 h-16 rounded-full bg-themeblue3 flex items-center justify-center active:scale-95 transition-transform"
          aria-label="Leave a voicemail"
        >
          <Mic size={26} className="text-white" />
        </button>
        <button
          onClick={onClose}
          className="w-16 h-16 rounded-full bg-tertiary/80 flex items-center justify-center active:scale-95 transition-transform"
          aria-label="Dismiss"
        >
          <X size={26} className="text-white" />
        </button>
      </div>
      <p className="text-[10pt] text-white/50">Leave a voicemail</p>
    </div>
  )
}
