import { useState, useEffect, useRef, useCallback } from 'react'
import { Voicemail, Mic, Play, Pause, Trash2, X, Check } from 'lucide-react'
import { useVoiceRecorder } from '../../Hooks/useVoiceRecorder'
import { ConfirmDialog } from '../ConfirmDialog'
import { bytesToBase64, base64ToBytes } from '../../lib/base64Utils'
import {
  setOncallGreeting,
  getOncallGreeting,
  type OncallGreeting,
} from '../../lib/eventIntakeService'

// Announcements are short — auto-stop keeps the plaintext blob (carried inline on
// every request_oncall) modest, well under the server's length cap.
const MAX_GREETING_S = 45

function formatDur(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
}

interface Props {
  clinicId: string
  /** Duration of the existing greeting (s), or null if none — seeds the row display. */
  initialDur: number | null
  /** Notify the parent to refresh credential metadata after a save/delete. */
  onChanged?: () => void
}

/**
 * Cluster voicemail greeting row — the operational announcement an OUTSIDE caller
 * hears when their on-call call goes unanswered (mirror of the per-user
 * VoicemailGreetingSection, at clinic scope). Stored PLAINTEXT via setOncallGreeting:
 * the anon caller holds no key so it can't be sealed; it's a deliberately-public
 * announcement (no PHI — UI-gated). Rendered as a border-t row inside the credential
 * card, under "Allow calls".
 */
export function OncallGreetingRow({ clinicId, initialDur, onChanged }: Props) {
  const [dur, setDur] = useState<number | null>(initialDur)
  const [saving, setSaving] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const urlRef = useRef<string | null>(null)

  const {
    isRecording, duration, amplitude,
    startRecording, stopRecording, cancelRecording,
  } = useVoiceRecorder()

  useEffect(() => { setDur(initialDur) }, [initialDur])

  // Revoke any object URL on unmount.
  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    audioRef.current?.pause()
  }, [])

  const handleStop = useCallback(async () => {
    const result = await stopRecording()
    if (!result) return
    setSaving(true)
    try {
      const audio = bytesToBase64(new Uint8Array(await result.blob.arrayBuffer()))
      const greeting: OncallGreeting = {
        audio,
        mime: result.mime,
        dur: Math.round(result.duration * 10) / 10,
      }
      const res = await setOncallGreeting(clinicId, greeting)
      if (res.ok) { setDur(greeting.dur); onChanged?.() }
    } finally {
      setSaving(false)
    }
  }, [stopRecording, clinicId, onChanged])

  // Auto-stop a long recording so the inline plaintext blob stays modest.
  useEffect(() => {
    if (isRecording && duration >= MAX_GREETING_S) void handleStop()
  }, [isRecording, duration, handleStop])

  const handlePlay = useCallback(async () => {
    if (playing) {
      audioRef.current?.pause()
      setPlaying(false)
      return
    }
    const res = await getOncallGreeting(clinicId)
    if (!res.ok || !res.data) return
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    const blob = new Blob([base64ToBytes(res.data.audio) as BlobPart], { type: res.data.mime || 'audio/webm' })
    const url = URL.createObjectURL(blob)
    urlRef.current = url
    const audio = new Audio(url)
    audioRef.current = audio
    audio.onended = () => setPlaying(false)
    audio.onpause = () => setPlaying(false)
    setPlaying(true)
    audio.play().catch(() => setPlaying(false))
  }, [playing, clinicId])

  const handleDelete = useCallback(async () => {
    setConfirmDelete(false)
    audioRef.current?.pause()
    setPlaying(false)
    const res = await setOncallGreeting(clinicId, null)
    if (res.ok) { setDur(null); onChanged?.() }
  }, [clinicId, onChanged])

  return (
    <>
      {isRecording ? (
        <div className="flex items-center gap-2 px-4 py-3.5 border-t border-primary/6">
          <button
            onClick={cancelRecording}
            className="w-9 h-9 rounded-full bg-primary/5 flex items-center justify-center active:scale-95 transition-all shrink-0"
            aria-label="Cancel recording"
          >
            <X size={16} className="text-tertiary" />
          </button>
          <div className="flex-1 flex items-center gap-2.5 px-3.5 py-2 rounded-full border border-themeredred/20 bg-themeredred/5">
            <div className="w-2 h-2 rounded-full bg-themeredred animate-pulse shrink-0" />
            <span className="text-sm font-medium text-themeredred tabular-nums">{formatDur(duration)}</span>
            <div className="flex-1 flex items-center gap-px h-4">
              {Array.from({ length: 24 }, (_, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-full bg-themeredred/40 transition-all duration-75"
                  style={{ height: `${Math.max(8, (i < 12 ? amplitude : amplitude * 0.6) * 100)}%` }}
                />
              ))}
            </div>
          </div>
          <button
            onClick={() => void handleStop()}
            className="w-9 h-9 rounded-full bg-themegreen flex items-center justify-center active:scale-95 transition-all shrink-0"
            aria-label="Save greeting"
          >
            <Check size={16} className="text-white" />
          </button>
        </div>
      ) : dur != null ? (
        <div className="flex items-center gap-3 px-4 py-3.5 border-t border-primary/6">
          <button
            onClick={() => void handlePlay()}
            className="w-9 h-9 rounded-full bg-themeblue2/15 flex items-center justify-center shrink-0 active:scale-95 transition-all"
            aria-label={playing ? 'Pause greeting' : 'Play greeting'}
          >
            {playing ? <Pause size={16} className="text-themeblue2" /> : <Play size={16} className="text-themeblue2" />}
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-primary">Call greeting</p>
            <p className="text-[9pt] text-tertiary mt-0.5">{formatDur(dur)} · plays when no one answers</p>
          </div>
          <button
            onClick={startRecording}
            className="w-9 h-9 rounded-full bg-tertiary/10 flex items-center justify-center shrink-0 active:scale-95 transition-all"
            aria-label="Re-record greeting"
          >
            <Mic size={16} className="text-tertiary" />
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            className="w-9 h-9 rounded-full bg-tertiary/10 flex items-center justify-center shrink-0 active:scale-95 transition-all"
            aria-label="Delete greeting"
          >
            <Trash2 size={16} className="text-themered" />
          </button>
        </div>
      ) : (
        <div
          className="flex items-center gap-3 px-4 py-3.5 border-t border-primary/6 cursor-pointer transition-all active:scale-95 hover:bg-themeblue2/5"
          onClick={saving ? undefined : startRecording}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (!saving && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); startRecording() } }}
        >
          <div className="w-9 h-9 rounded-full bg-tertiary/10 flex items-center justify-center shrink-0">
            <Voicemail size={18} className="text-tertiary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-primary">{saving ? 'Saving…' : 'Record call greeting'}</p>
            <p className="text-[9pt] text-tertiary mt-0.5">Operational greeting only — no patient information</p>
          </div>
          <Mic size={16} className="text-themeblue2 shrink-0" />
        </div>
      )}

      <ConfirmDialog
        visible={confirmDelete}
        title="Delete call greeting?"
        subtitle="Callers will go straight to the recording prompt instead."
        variant="danger"
        confirmLabel="Delete"
        cancelLabel="Keep"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  )
}
