import { useState, useEffect, useRef, useCallback } from 'react'
import { Voicemail, Mic, Play, Pause, Trash2, X, Check } from 'lucide-react'
import { useVoiceRecorder } from '../../Hooks/useVoiceRecorder'
import { ConfirmDialog } from '../ConfirmDialog'
import {
  getOwnGreeting,
  saveOwnGreeting,
  deleteOwnGreeting,
  decryptGreetingToUrl,
} from '../../lib/voicemailService'
import type { VoicemailGreeting } from '../../Types/SupervisorTestTypes'

function formatDur(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
}

/** Record / play / delete the signed-in user's voicemail greeting.
 *  Self-contained section — rendered in Settings → Security and the
 *  messaging settings popover. */
export function VoicemailGreetingSection() {
  const [greeting, setGreeting] = useState<VoicemailGreeting | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const urlRef = useRef<string | null>(null)

  const {
    isRecording, duration, amplitude,
    startRecording, stopRecording, cancelRecording,
  } = useVoiceRecorder()

  useEffect(() => {
    let cancelled = false
    getOwnGreeting().then(g => { if (!cancelled) { setGreeting(g); setLoaded(true) } })
    return () => { cancelled = true }
  }, [])

  // Revoke any object URL on unmount
  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    audioRef.current?.pause()
  }, [])

  const handleStop = useCallback(async () => {
    const result = await stopRecording()
    if (!result) return
    setSaving(true)
    const ok = await saveOwnGreeting(result)
    if (ok) {
      setGreeting({ enc: '', mime: result.mime, dur: Math.round(result.duration * 10) / 10 })
    }
    setSaving(false)
  }, [stopRecording])

  const handlePlay = useCallback(async () => {
    if (playing) {
      audioRef.current?.pause()
      setPlaying(false)
      return
    }
    if (!greeting) return
    const url = await decryptGreetingToUrl(greeting)
    if (!url) return
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = url
    const audio = new Audio(url)
    audioRef.current = audio
    audio.onended = () => setPlaying(false)
    audio.onpause = () => setPlaying(false)
    setPlaying(true)
    audio.play().catch(() => setPlaying(false))
  }, [greeting, playing])

  const handleDelete = useCallback(async () => {
    setConfirmDelete(false)
    audioRef.current?.pause()
    setPlaying(false)
    const ok = await deleteOwnGreeting()
    if (ok) setGreeting(null)
  }, [])

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider">Voicemail</p>
      </div>
      <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">

        {isRecording ? (
          <div className="flex items-center gap-2 px-4 py-3.5">
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
              onClick={handleStop}
              className="w-9 h-9 rounded-full bg-themegreen flex items-center justify-center active:scale-95 transition-all shrink-0"
              aria-label="Save greeting"
            >
              <Check size={16} className="text-white" />
            </button>
          </div>
        ) : greeting ? (
          <div className="flex items-center gap-3 px-4 py-3.5">
            <button
              onClick={handlePlay}
              className="w-9 h-9 rounded-full bg-themeblue2/15 flex items-center justify-center shrink-0 active:scale-95 transition-all"
              aria-label={playing ? 'Pause greeting' : 'Play greeting'}
            >
              {playing ? <Pause size={16} className="text-themeblue2" /> : <Play size={16} className="text-themeblue2" />}
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-primary">Your greeting</p>
              <p className="text-[9pt] text-tertiary mt-0.5">{formatDur(greeting.dur)} · plays when a call goes unanswered</p>
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
            className="flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-all active:scale-95 hover:bg-themeblue2/5"
            onClick={saving ? undefined : startRecording}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (!saving && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); startRecording() } }}
          >
            <div className="w-9 h-9 rounded-full bg-tertiary/10 flex items-center justify-center shrink-0">
              <Voicemail size={18} className="text-tertiary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-primary">{saving ? 'Saving…' : 'Record greeting'}</p>
              <p className="text-[9pt] text-tertiary mt-0.5">Operational greeting only — no patient information</p>
            </div>
            <Mic size={16} className="text-themeblue2 shrink-0" />
          </div>
        )}

      </div>

      <ConfirmDialog
        visible={confirmDelete}
        title="Delete voicemail greeting?"
        subtitle="Callers will hear the default prompt instead."
        variant="danger"
        confirmLabel="Delete"
        cancelLabel="Keep"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}
