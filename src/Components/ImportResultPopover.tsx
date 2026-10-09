import { ScanLine, Check, X } from 'lucide-react'
import { PreviewOverlay } from './PreviewOverlay'
import type { ContextMenuAction } from './PreviewOverlay'
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
