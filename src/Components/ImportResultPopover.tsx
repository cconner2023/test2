import { useState, useEffect } from 'react'
import { ScanLine, User, Check, X } from 'lucide-react'
import { PreviewOverlay } from './PreviewOverlay'
import type { ContextMenuAction } from './PreviewOverlay'
import { BarcodeDisplay } from './Barcode'
import type { ImportPreview } from '../Hooks/useNoteImport'
import { profileAvatars } from '../Data/ProfileAvatars'
import { supabase } from '../lib/supabase'
import { getColorClasses } from '../Utilities/ColorUtilities'
import type { ReactNode } from 'react'

/** Scan / staged-image / decoding stages only — a decoded note opens in ImportedNoteDrawer. */
interface ImportResultPopoverProps {
  /** Staged image waiting for user confirmation */
  stagedImage: { file: File; url: string } | null
  /** Camera scan in progress */
  isScanning: boolean
  scanRequested: boolean
  videoRef: React.RefObject<HTMLVideoElement | null>
  /** Image is being decoded by ZXing */
  isDecodingImage: boolean
  /** Anchor rect for popover transform origin */
  anchorRect: DOMRect | null
  /** Callbacks */
  onConfirmImage: () => void
  onDismissImage: () => void
  onStopScan: () => void
  onClose: () => void
}

// ── Preview card content for a decoded note ─────────────────────────────────

export function NotePreviewContent({ preview }: { preview: ImportPreview }) {
  const [authorAvatarSvg, setAuthorAvatarSvg] = useState<ReactNode>(null)
  const colors = getColorClasses(preview.dispositionType as any)

  useEffect(() => {
    const userId = preview.userId
    if (!userId) { setAuthorAvatarSvg(null); return }
    supabase
      .from('profiles')
      .select('avatar_id')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        const match = data?.avatar_id
          ? profileAvatars.find(a => a.id === data.avatar_id)
          : null
        setAuthorAvatarSvg(match?.svg ?? null)
      })
  }, [preview.userId])

  return (
    <div className="px-4 py-3 space-y-3">
      {/* Symptom + disposition badge */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-primary">{preview.symptomText}</span>
        {preview.dispositionType && colors && (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9pt] font-medium ${colors.badgeBg} ${colors.badgeText}`}>
            {preview.dispositionType}
            {preview.dispositionText ? ` — ${preview.dispositionText}` : ''}
          </span>
        )}
      </div>
      {/* Author */}
      <div className="flex items-center gap-1.5 text-[10pt] text-tertiary">
        {authorAvatarSvg
          ? <span className="w-4 h-4 rounded-full overflow-hidden shrink-0">{authorAvatarSvg}</span>
          : <User size={12} className="shrink-0" />
        }
        {preview.authorLabel}
      </div>
      {/* Note text */}
      <div className="rounded-xl bg-themewhite2 overflow-hidden">
        <div className="px-3 py-2 text-tertiary text-[10pt] whitespace-pre-wrap max-h-36 overflow-y-auto">
          {preview.fullNote
            ? preview.fullNote.split('\n').filter(l => !l.startsWith('Signed:')).join('\n').trim()
            : 'No content'}
        </div>
      </div>
      {/* Barcode */}
      <div className="rounded-xl bg-themewhite2 overflow-hidden">
        <div className="px-3 py-2">
          <BarcodeDisplay encodedText={preview.encodedText} />
        </div>
      </div>
    </div>
  )
}

// ── Main popover ────────────────────────────────────────────────────────────

export function ImportResultPopover({
  stagedImage,
  isScanning,
  scanRequested,
  videoRef,
  isDecodingImage,
  anchorRect,
  onConfirmImage,
  onDismissImage,
  onStopScan,
  onClose,
}: ImportResultPopoverProps) {
  // Determine visibility + content
  const showScan = scanRequested || isScanning
  const isVisible = !!(stagedImage || showScan || isDecodingImage)

  // Build actions based on state
  let actions: ContextMenuAction[] = []
  let popoverPreview: ReactNode = null

  if (stagedImage) {
    popoverPreview = (
      <div className="flex items-center justify-center p-4">
        <img
          src={stagedImage.url}
          alt="Pasted image"
          className="max-w-full max-h-52 object-contain rounded-xl"
        />
      </div>
    )
    actions = [
      { key: 'decode', label: 'Decode', icon: Check, onAction: onConfirmImage, closesOnAction: false },
      { key: 'dismiss', label: 'Dismiss', icon: X, onAction: onDismissImage, variant: 'danger' },
    ]
  } else if (showScan) {
    popoverPreview = (
      <div className="relative aspect-video bg-black rounded-xl overflow-hidden">
        <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-4 border-2 border-white/30 rounded-lg" />
          <div className="absolute inset-x-4 top-1/2 h-0.5 bg-themeblue2 animate-pulse" />
          <ScanLine className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 text-white/50" />
        </div>
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white text-[10pt] px-3 py-1.5 rounded-full">
          Looking for barcode...
        </div>
      </div>
    )
    actions = [
      { key: 'cancel', label: 'Cancel', icon: X, onAction: onStopScan },
    ]
  } else if (isDecodingImage) {
    popoverPreview = (
      <div className="flex items-center justify-center gap-2 p-8 text-sm text-tertiary animate-pulse">
        <ScanLine size={16} className="text-themeblue2" />
        Reading image...
      </div>
    )
    actions = []
  }

  return (
    <PreviewOverlay
      isOpen={isVisible}
      onClose={onClose}
      anchorRect={anchorRect}
      preview={popoverPreview}
      actions={actions}
      maxWidth={360}
    />
  )
}
