import { useCallback, useEffect, useState } from 'react'
import { FileText, FileImage, FileVideo, FileAudio, FileArchive, File as FileIcon, Download, Share2, ExternalLink } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { FileContent } from '../../lib/signal/messageContent'
import { downloadDecryptedAttachment } from '../../lib/signal/attachmentService'
import { downloadBlob } from '../../Utilities/downloadUtils'

function iconFor(mime: string): LucideIcon {
  if (mime.startsWith('image/')) return FileImage
  if (mime.startsWith('video/')) return FileVideo
  if (mime.startsWith('audio/')) return FileAudio
  if (mime === 'application/pdf' || mime.startsWith('text/') || mime.includes('word') || mime.includes('sheet') || mime.includes('presentation')) return FileText
  if (mime.includes('zip') || mime.includes('compressed') || mime.includes('tar')) return FileArchive
  return FileIcon
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Types opened in a tab. The mime is sender-declared and the blob URL is
 * same-origin, so anything that renders as a document (text/html, image/svg+xml,
 * xml) would run as the app; only inert raster/media/pdf/plain text qualify.
 */
const SAFE_INLINE = /^(image\/(png|jpe?g|gif|webp|heic|heif|avif|bmp)|video\/(mp4|webm|quicktime)|audio\/[a-z0-9.+-]+|application\/pdf|text\/plain)$/i
const previewable = (mime: string) => SAFE_INLINE.test(mime)
/** Everything else is materialised as octet-stream so the browser downloads it. */
const blobType = (mime: string) => (SAFE_INLINE.test(mime) ? mime : 'application/octet-stream')

type Phase = 'idle' | 'loading' | 'ready' | 'gone' | 'error'

/**
 * Received or sent arbitrary file. Download is two taps on purpose: the first fetches
 * and decrypts, the second opens/shares. iOS Safari refuses navigator.share and
 * window.open once the user activation from the first tap has been spent on an
 * async download, so the action must hang off a fresh tap.
 */
export function FileAttachmentBubble({ content, isOwn }: { content: FileContent; isOwn: boolean }) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [file, setFile] = useState<File | null>(null)
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])

  const fetchFile = useCallback(async () => {
    if (phase === 'loading' || !content.path) return
    setPhase('loading')
    const res = await downloadDecryptedAttachment(content.path, content.key, content.store, content.mime)
    if (!res.ok) { setPhase(res.error === 'not_found' ? 'gone' : 'error'); return }
    const f = new File([res.data], content.name, { type: blobType(content.mime) })
    setFile(f)
    setUrl(URL.createObjectURL(f))
    setPhase('ready')
  }, [phase, content])

  const canShareFile = !!file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })

  const share = useCallback(() => {
    if (!file) return
    navigator.share({ files: [file], title: file.name }).catch(() => {})
  }, [file])

  const save = useCallback(() => {
    if (!file) return
    downloadBlob(file, content.name)
  }, [file, content.name])

  const open = useCallback(() => {
    if (url) window.open(url, '_blank', 'noopener')
  }, [url])

  const Icon = iconFor(content.mime)
  const sub = isOwn ? 'text-white/70' : 'text-tertiary'
  const btn = `w-8 h-8 rounded-full flex items-center justify-center active:scale-95 ${isOwn ? 'bg-white/20 text-white' : 'bg-themeblue2/10 text-themeblue2'}`

  return (
    <div className="flex items-center gap-2.5 min-w-[200px] max-w-[280px]" onClick={e => e.stopPropagation()}>
      <button
        onClick={phase === 'idle' || phase === 'error' ? fetchFile : undefined}
        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isOwn ? 'bg-white/20' : 'bg-themeblue2/10'}`}
      >
        {phase === 'loading' ? (
          <div className={`w-4 h-4 rounded-full border-2 border-t-transparent animate-spin ${isOwn ? 'border-white/60' : 'border-themeblue2/60'}`} />
        ) : (
          <Icon size={18} className={isOwn ? 'text-white' : 'text-themeblue2'} />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-[10pt] font-medium truncate">{content.name}</p>
        <p className={`text-[9pt] ${sub}`}>
          {phase === 'gone' ? 'No longer available'
            : phase === 'error' ? 'Couldn’t open. Tap to retry.'
            : phase === 'idle' ? `${humanSize(content.size)} · Tap to download`
            : humanSize(content.size)}
        </p>
      </div>
      {phase === 'ready' && previewable(content.mime) && (
        <button onClick={open} className={btn} aria-label="Open"><ExternalLink size={14} /></button>
      )}
      {phase === 'ready' && canShareFile && (
        <button onClick={share} className={btn} aria-label="Share"><Share2 size={14} /></button>
      )}
      {phase === 'ready' && !canShareFile && (
        <button onClick={save} className={btn} aria-label="Save"><Download size={14} /></button>
      )}
    </div>
  )
}
