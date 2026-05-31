import { useCallback, useRef, useState } from 'react'
import { Play, Pause, RefreshCw, MoreHorizontal } from 'lucide-react'
import type { OncallCallContent } from '../../lib/signal/messageContent'
import { downloadDecryptedAttachment } from '../../lib/signal/attachmentService'
import { useLongPress } from '../../Hooks/useLongPress'

interface Props {
  content: OncallCallContent
  createdAt: string
  messageId: string
  onLongPress?: (x: number, y: number) => void
}

const OUTCOME_LABEL: Record<OncallCallContent['outcome'], string> = {
  connected_ended: 'Call ended',
  missed: 'Missed call',
  declined: 'Declined',
  voicemail: 'Voicemail',
}

/**
 * Resolved on-call call record — rendered as a normal inbound chat bubble:
 * requester name as the header, the outcome (+ duration) as the message body.
 * No decorative outcome icon, no timestamp — it reads like any other message.
 * For a voicemail it plays the E2E-encrypted audio: download the ciphertext blob
 * from the message-attachments bucket and decrypt with the AES key carried inside
 * the envelope (same path as an internal voice message). Delete/Copy ride the
 * existing long-press context menu.
 */
export function OncallCallCard({ content, messageId, onLongPress }: Props) {
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const label = OUTCOME_LABEL[content.outcome] ?? OUTCOME_LABEL.missed
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

  // Touch long-press opens the context menu (Delete/Copy) on mobile — desktop
  // gets it via onContextMenu. iOS Safari can't rely on onContextMenu alone.
  const longPress = useLongPress((x, y) => onLongPress?.(x, y))

  // Desktop hover ellipsis — anchors the context menu to its own rect, matching
  // the affordance on every other peer bubble (MessageBubble).
  const onEllipsis = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    onLongPress?.(r.left + r.width / 2, r.top + r.height / 2)
  }, [onLongPress])

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
    <div className="group flex justify-start items-center px-1 mb-1.5" data-message-id={messageId}>
      <div
        className="max-w-[65%] px-3.5 py-2 rounded-2xl rounded-bl-md bg-themewhite2 text-primary select-none"
        style={{ touchAction: 'pan-y' }}
        onContextMenu={(e) => { e.preventDefault(); onLongPress?.(e.clientX, e.clientY) }}
        onTouchStart={longPress.onTouchStart}
        onTouchMove={longPress.onTouchMove}
        onTouchEnd={longPress.onTouchEnd}
        onTouchCancel={longPress.onTouchCancel}
      >
        {/* In-bubble sender header — name + separator, like a group chat bubble. */}
        <div className="pb-1.5 mb-1.5 border-b border-current/10">
          <span className="text-[9pt] font-semibold text-themeblue2 truncate">
            {content.requester_name || 'Outside caller'}
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <p className="text-sm flex-1 min-w-0">
            {label}{durLabel ? ` · ${durLabel}` : ''}
          </p>
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
      {onLongPress && (
        <button
          onClick={onEllipsis}
          aria-label="Message actions"
          className="hidden md:flex shrink-0 ml-1.5 w-7 h-7 rounded-full hover:bg-primary/10
                     items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <MoreHorizontal size={14} className="text-tertiary" />
        </button>
      )}
    </div>
  )
}
