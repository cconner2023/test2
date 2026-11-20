import { useRef } from 'react'
import { ScanLine, Check, RotateCcw, Camera, ImagePlus } from 'lucide-react'
import { PaneSurface } from '@/Components/primitives/PaneCard'
import { PillButton } from '@/Components/primitives/HeaderPill'
import { TextInput } from '@/Components/primitives/FormInputs'
import type { ReactNode } from 'react'
import type { BarcodePartProgress } from '../Hooks/useBarcodeImport'

/** Entry / scan / staged-image / decoding stages — a decoded note opens in ImportedNoteDrawer.
 *  Same PaneSurface as the decoded note (PaneCard desktop / fit Sheet mobile);
 *  stage actions fold into the close pill, and X backs out of the stage. */
interface ImportResultPopoverProps {
  /** Entry stage: paste an encoded note, or start a scan / pick an image. */
  entry?: {
    isOpen: boolean
    text: string
    onTextChange: (text: string) => void
    onSubmit: () => void
    onClose: () => void
    error?: string
  }
  /** Staged image waiting for user confirmation */
  stagedImage: { file: File; url: string } | null
  /** Camera scan in progress */
  isScanning: boolean
  scanRequested: boolean
  videoRef: React.RefObject<HTMLVideoElement | null>
  /** Multi-symbol series in progress (null when none) */
  partProgress?: BarcodePartProgress | null
  /** Drop the series in progress and start collecting a different note */
  onResetParts?: () => void
  /** Image is being decoded by ZXing */
  isDecodingImage: boolean
  /** Unused since the PaneSurface move; kept for call-site compatibility. */
  anchorRect?: DOMRect | null
  /** Callbacks */
  onConfirmImage: () => void
  onDismissImage: () => void
  onStopScan: () => void
  /** Open the camera (entry stage; partial series: collect the missing symbols) */
  onScanRest?: () => void
  /** Stage an image (entry stage; partial series: parts already found are kept) */
  onAddImage?: (file: File) => void
  onClose: () => void
}

/** One bar per symbol in the series; filled = received. */
function PartStrip({ progress, onDark }: { progress: BarcodePartProgress; onDark?: boolean }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: progress.total }, (_, i) => (
        <div
          key={i}
          className={`h-1.5 flex-1 rounded-full transition-colors ${progress.received.includes(i) ? 'bg-themeblue2' : onDark ? 'bg-white/30' : 'bg-tertiary/20'}`}
        />
      ))}
    </div>
  )
}

// ── Main popover ────────────────────────────────────────────────────────────

export function ImportResultPopover({
  entry,
  stagedImage,
  isScanning,
  scanRequested,
  videoRef,
  isDecodingImage,
  partProgress,
  onResetParts,
  onConfirmImage,
  onDismissImage,
  onStopScan,
  onScanRest,
  onAddImage,
  onClose,
}: ImportResultPopoverProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  // Determine visibility + content
  const showScan = scanRequested || isScanning
  // An image decode found only part of a series — stay open so the rest can be added.
  const showPartial = !!partProgress && !stagedImage && !showScan && !isDecodingImage
  const showEntry = !!entry?.isOpen && !stagedImage && !showScan && !isDecodingImage && !showPartial
  const isVisible = !!(stagedImage || showScan || isDecodingImage || showPartial || showEntry)

  // Build the stage: title, body, close-pill actions, and what X does.
  let title = 'Import note'
  let actions: ReactNode = null
  let content: ReactNode = null
  let dismiss = onClose

  if (stagedImage) {
    title = 'Decode image'
    dismiss = onDismissImage
    content = (
      <div className="flex flex-col items-center gap-3 p-4">
        {partProgress && (
          <div className="w-full">
            <PartStrip progress={partProgress} />
          </div>
        )}
        <img
          src={stagedImage.url}
          alt="Pasted image"
          className="max-w-full max-h-52 object-contain rounded-xl"
        />
      </div>
    )
    actions = <PillButton icon={Check} iconSize={18} accent="success" onClick={onConfirmImage} label="Decode" />
  } else if (showScan) {
    title = 'Scan barcode'
    dismiss = onStopScan
    content = (
      <div className="p-3">
        <div className="relative aspect-video bg-black rounded-xl overflow-hidden">
          <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-4 border-2 border-white/30 rounded-lg" />
            <div className="absolute inset-x-4 top-1/2 h-0.5 bg-themeblue2 animate-pulse" />
            <ScanLine className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 text-white/50" />
          </div>
          {partProgress && (
            <div className="absolute top-3 inset-x-4">
              <PartStrip progress={partProgress} onDark />
            </div>
          )}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white text-[10pt] px-3 py-1.5 rounded-full whitespace-nowrap">
            {!partProgress
              ? 'Looking for barcode...'
              : partProgress.otherSet
                ? 'Different note — finish this one or start over'
                : `${partProgress.received.length} of ${partProgress.total} scanned`}
          </div>
        </div>
      </div>
    )
    if (partProgress?.otherSet && onResetParts) {
      actions = <PillButton icon={RotateCcw} iconSize={18} onClick={onResetParts} label="Start over" />
    }
  } else if (isDecodingImage) {
    title = 'Decode image'
    content = (
      <div className="flex items-center justify-center gap-2 p-8 text-sm text-tertiary animate-pulse">
        <ScanLine size={16} className="text-themeblue2" />
        Reading image...
      </div>
    )
  } else if (showPartial && partProgress) {
    title = 'Partial note'
    const missing = Array.from({ length: partProgress.total }, (_, i) => i)
      .filter(i => !partProgress.received.includes(i))
      .map(i => i + 1)
    content = (
      <div className="flex flex-col gap-3 p-4">
        <PartStrip progress={partProgress} />
        <div className="text-sm text-primary">
          Found {partProgress.received.length} of {partProgress.total} barcodes
        </div>
        <div className="text-[10pt] text-tertiary">
          Missing {missing.join(', ')}. Scan or add an image with the rest. Close to start over.
        </div>
      </div>
    )
    actions = (
      <>
        {onScanRest && <PillButton icon={Camera} iconSize={18} onClick={onScanRest} label="Scan rest" />}
        {onAddImage && <PillButton icon={ImagePlus} iconSize={18} onClick={() => fileRef.current?.click()} label="Add image" />}
      </>
    )
  } else if (showEntry && entry) {
    title = 'Import note'
    dismiss = entry.onClose
    const hasText = entry.text.trim().length > 0
    content = (
      <TextInput
        value={entry.text}
        onChange={entry.onTextChange}
        placeholder="Paste encoded note"
        autoComplete="off"
        hint={entry.error || null}
        onKeyDown={(e) => { if (e.key === 'Enter' && hasText) { e.preventDefault(); entry.onSubmit() } }}
      />
    )
    actions = hasText
      ? <PillButton icon={Check} iconSize={18} accent="success" onClick={entry.onSubmit} label="Decode" />
      : (
        <>
          {onScanRest && <PillButton icon={Camera} iconSize={18} onClick={onScanRest} label="Scan barcode" />}
          {onAddImage && <PillButton icon={ImagePlus} iconSize={18} onClick={() => fileRef.current?.click()} label="Upload image" />}
        </>
      )
  }

  return (
    <>
    {onAddImage && (
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) onAddImage(file)
        }}
      />
    )}
    <PaneSurface
      isOpen={isVisible}
      onClose={dismiss}
      title={title}
      actions={actions}
      desktopZIndex={70}
    >
      {content}
    </PaneSurface>
    </>
  )
}
