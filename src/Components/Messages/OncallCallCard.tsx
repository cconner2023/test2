import { useCallback, useRef, useState } from 'react'
import { Phone, PhoneMissed, PhoneOff, Voicemail, Play, Pause, RefreshCw } from 'lucide-react'
import type { OncallCallContent } from '../../lib/signal/messageContent'
import { downloadDecryptedAttachment } from '../../lib/signal/attachmentService'

interface Props {
  content: OncallCallContent
  createdAt: string
  messageId: string
  onLongPress?: (x: number, y: number) => void
}

const OUTCOME_META: Record<OncallCallContent['outcome'], { label: string; Icon: typeof Phone; tone: string }> = {
  connected_ended: { label: 'Call ended', Icon: Phone, tone: 'text-themegreen' },
  missed: { label: 'Missed call', Icon: PhoneMissed, tone: 'text-themeredred' },
  declined: { label: 'Declined', Icon: PhoneOff, tone: 'text-tertiary' },
  voicemail: { label: 'Voicemail', Icon: Voicemail, tone: 'text-themeblue3' },
}

/**
 * Resolved on-call call card — the durable record. For a voicemail it plays the
 * E2E-encrypted audio: download the ciphertext blob from the message-attachments
 * bucket and decrypt with the AES key carried inside the envelope (same path as an
 * internal voice message). Delete/Copy ride the existing long-press context menu.
 */
export function OncallCallCard({ content, createdAt, messageId, onLongPress }: Props) {
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const meta = OUTCOME_META[content.outcome] ?? OUTCOME_META.missed
  const Icon = meta.Icon
  const when = createdAt ? new Date(createdAt).toLocaleString() : ''
  const durLabel = content.voicemail
    ? `${Math.floor(content.voicemail.duration / 60)}:${String(Math.round(content.voicemail.duration % 60)).padStart(2, '0')}`
    : ''

  const prepare = useCallback(async (): Promise<string | null> => {
    if (audioUrl) return audioUrl
    const vm = content.voicemail
    if (!vm) return null
    setBusy(true)
    try {
      const res = await downloadDecryptedAttachment(vm.path, vm.key)
      if (!res.ok) { setError(true); return null }
      // Tag the decrypted bytes with the recorded mime so <audio> can play them.
      const blob = new Blob([await res.data.arrayBuffer() as BlobPart], { type: vm.mime || 'audio/webm' })
      const url = URL.createObjectURL(blob)
      setAudioUrl(url)
      return url
    } catch {
      setError(true)
      return null
    } finally {
      setBusy(false)
    }
  }, [audioUrl, content])

  const togglePlay = useCallback(async () => {
    const el = audioRef.current
    if (el && !el.paused) { el.pause(); setPlaying(false); return }
    const url = await prepare()
    if (!url) return
    // wait a tick for the <audio> src to bind
    requestAnimationFrame(() => {
      const a = audioRef.current
      if (a) { a.play().then(() => setPlaying(true)).catch(() => setError(true)) }
    })
  }, [prepare])

  return (
    <div className="w-full flex justify-center px-4 my-2" data-message-id={messageId}>
      <div
        className="max-w-[85%] w-full px-3 py-2.5 rounded-2xl bg-primary/5 border border-primary/10"
        onContextMenu={(e) => { e.preventDefault(); onLongPress?.(e.clientX, e.clientY) }}
      >
        <div className="flex items-center gap-2.5">
          <Icon size={18} className={meta.tone} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-primary truncate">{content.requester_name || 'Outside caller'}</p>
            <p className="text-[10pt] text-tertiary">{meta.label}{durLabel ? ` · ${durLabel}` : ''}{when ? ` · ${when}` : ''}</p>
          </div>
          {content.voicemail && (
            <button
              type="button"
              onClick={() => void togglePlay()}
              className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-themeblue3 text-white active:scale-95 transition-all"
              aria-label={playing ? 'Pause voicemail' : 'Play voicemail'}
            >
              {busy ? <RefreshCw size={16} className="animate-spin" /> : playing ? <Pause size={16} /> : <Play size={16} />}
            </button>
          )}
        </div>
        {error && <p className="mt-1.5 text-[9pt] text-themeredred">Voicemail couldn’t be decrypted on this device.</p>}
        {audioUrl && (
          <audio
            ref={audioRef}
            src={audioUrl}
            onEnded={() => setPlaying(false)}
            onPause={() => setPlaying(false)}
            className="hidden"
          />
        )}
      </div>
    </div>
  )
}
