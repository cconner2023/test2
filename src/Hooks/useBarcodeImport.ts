import { useState, useCallback, useRef, useEffect } from 'react'
import { useImagePaste } from './useImagePaste'
import { useBarcodeScanner } from './useBarcodeScanner'
import { decodeImageBarcodes } from '../Utilities/barcodeImageDecode'
import { decryptBarcodePayload, decryptBarcodeBytes, envelopeToEncryptedText, toEncryptedText } from '../Utilities/barcodeCodec'
import { BarcodePartCollector, parseBarcodePart, scannedSymbolBytes, type BarcodePart } from '../Utilities/barcodeParts'

export interface BarcodeImportResult {
  /** Decrypted plaintext payload (pipe-delimited or plain) */
  payload: string
  /** Display-friendly encoded representation (for barcode rendering) */
  encodedText: string
}

/** Progress through a multi-symbol series (null when none is in flight). */
export interface BarcodePartProgress {
  /** Received part indexes, ascending */
  received: number[]
  total: number
  /** The camera is seeing a symbol from a different note than the one in progress */
  otherSet: boolean
}

interface UseBarcodeImportOptions {
  /** Called with the decrypted result after successful decode */
  onDecoded: (result: BarcodeImportResult) => void
  /** Enable/disable the clipboard paste listener (default true) */
  enabled?: boolean
}

/** Compute the display-friendly encoded text for a decoded barcode. */
function computeEncodedText(
  text: string,
  payload: string,
): string {
  // If no decryption happened, the original text is the display text
  if (payload === text) return text
  // enc: text as-is; binary-mode scans (raw ciphertext bytes) → their enc: form
  return toEncryptedText(text)
}

/**
 * Shared hook for the full barcode import lifecycle:
 * text input, image paste/staging, camera scanning, ZXing decode, decrypt.
 *
 * Consumer provides `onDecoded` to handle the decrypted payload.
 * Returns all state and handlers needed to render the ImportResultPopover pane,
 * staged image preview, and camera scan UI.
 */
export function useBarcodeImport({ onDecoded, enabled = true }: UseBarcodeImportOptions) {
  const [importText, setImportText] = useState('')
  const [stagedImage, setStagedImage] = useState<{ file: File; url: string } | null>(null)
  const [isDecodingImage, setIsDecodingImage] = useState(false)
  const [error, setError] = useState('')
  const [scanRequested, setScanRequested] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const collectorRef = useRef(new BarcodePartCollector())
  const [partProgress, setPartProgress] = useState<BarcodePartProgress | null>(null)
  const stopScanningRef = useRef<() => void>(() => {})
  const onFrameRef = useRef<(text: string, bytes: Uint8Array | null) => boolean>(() => false)

  const {
    isScanning,
    error: scannerError,
    result: scanResult,
    resultBytes: scanResultBytes,
    startScanning,
    stopScanning,
    clearResult,
  } = useBarcodeScanner({ onFrame: (text, bytes) => onFrameRef.current(text, bytes) })
  stopScanningRef.current = stopScanning

  // Revoke staged image URL on cleanup
  useEffect(() => {
    return () => { if (stagedImage) URL.revokeObjectURL(stagedImage.url) }
  }, [stagedImage])

  // ── Core decode: decrypt → onDecoded ────────────────────────────────────────

  const decode = useCallback(async (text: string, rawBytes?: Uint8Array | null) => {
    setError('')
    try {
      const payload = await decryptBarcodePayload(text, rawBytes)
      if (!payload) {
        setError('Sign in and connect to sync encryption key')
        return
      }
      const encodedText = computeEncodedText(text, payload)
      onDecoded({ payload, encodedText })
    } catch (err: any) {
      setError(err.message || 'Failed to decode barcode')
    }
  }, [onDecoded])

  // ── Multi-symbol series: collect parts → reassemble → decode ───────────────

  const clearParts = useCallback(() => {
    collectorRef.current.reset()
    setPartProgress(null)
  }, [])

  const syncProgress = useCallback(() => {
    const c = collectorRef.current
    setPartProgress(c.isEmpty ? null : { received: c.received, total: c.total, otherSet: false })
  }, [])

  /** Reassemble a complete set ("enc:" envelope or plaintext) and decode it. */
  const finishParts = useCallback(() => {
    const c = collectorRef.current
    const bytes = c.assemble()
    const plain = c.plain
    clearParts()
    const text = plain ? new TextDecoder().decode(bytes) : envelopeToEncryptedText(bytes)
    setImportText(text)
    decode(text)
  }, [clearParts, decode])

  /**
   * A legacy single symbol starts with random IV, so ~1 in 100k parses as a part.
   * Probe a direct decrypt of the whole symbol; if it authenticates, it was a
   * single-symbol note all along. Returns true when it handled the scan.
   */
  const probeLegacy = useCallback(async (bytes: Uint8Array): Promise<boolean> => {
    const payload = await decryptBarcodeBytes(bytes, true)
    if (!payload) return false
    clearParts()
    stopScanningRef.current()
    setScanRequested(false)
    const encodedText = envelopeToEncryptedText(bytes)
    setImportText(encodedText)
    onDecoded({ payload, encodedText })
    return true
  }, [clearParts, onDecoded])

  /** Add one part; returns true when the set is now complete. */
  const ingestPart = useCallback((part: BarcodePart, bytes: Uint8Array, probe: boolean): boolean => {
    const c = collectorRef.current
    const status = c.add(part)
    if (status === 'other-set') {
      setPartProgress(p => (p && !p.otherSet ? { ...p, otherSet: true } : p))
      return false
    }
    if (status === 'duplicate') {
      setPartProgress(p => (p?.otherSet ? { ...p, otherSet: false } : p))
      return false
    }
    // Plaintext parts can't be legacy symbols (those are printable ASCII → never parse).
    if (probe && !part.plain && c.count === 1) void probeLegacy(bytes)
    if (c.isComplete) return true
    syncProgress()
    return false
  }, [probeLegacy, syncProgress])

  // Camera frames: consume series parts and keep the camera running.
  onFrameRef.current = (text, rawBytes) => {
    const bytes = scannedSymbolBytes(text, rawBytes)
    const part = parseBarcodePart(bytes)
    if (!part || !bytes) return false
    if (ingestPart(part, bytes, true)) {
      stopScanningRef.current()
      setScanRequested(false)
      finishParts()
    }
    return true
  }

  // ── Image decode: ZXing → decrypt → onDecoded ──────────────────────────────

  const decodeImage = useCallback(async (file: File) => {
    setIsDecodingImage(true)
    setError('')
    try {
      const c0 = collectorRef.current
      const known = c0.isEmpty || c0.setId === null ? null : { setId: c0.setId, indices: c0.received }
      const results = await decodeImageBarcodes(file, known)
      const first = results[0]
      const firstBytes = scannedSymbolBytes(first.text, first.byteSegments)
      const firstPart = parseBarcodePart(firstBytes)
      if (!firstPart || !firstBytes) {
        setImportText(toEncryptedText(first.text))
        await decode(first.text, first.byteSegments)
        return
      }
      if (!firstPart.plain && await probeLegacy(firstBytes)) return

      // A photo of a different note than the one in progress starts a new set.
      const c = collectorRef.current
      if (!c.isEmpty && c.add(firstPart) === 'other-set') c.reset()
      for (const r of results) {
        const bytes = scannedSymbolBytes(r.text, r.byteSegments)
        const part = parseBarcodePart(bytes)
        if (part && bytes) ingestPart(part, bytes, false)
      }
      if (c.isComplete) {
        finishParts()
      } else {
        // Partial set: the import popover stays open on the progress strip
        // (Scan rest / Add image) — parts persist across images and the camera.
        syncProgress()
        setImportText('')
      }
    } catch {
      setError('No barcode found in image. Try a clearer photo or paste the string directly.')
    } finally {
      setIsDecodingImage(false)
    }
  }, [decode, probeLegacy, ingestPart, finishParts, syncProgress])

  // ── Image staging (Signal-style preview) ────────────────────────────────────

  const stageImage = useCallback((file: File) => {
    if (stagedImage) URL.revokeObjectURL(stagedImage.url)
    setStagedImage({ file, url: URL.createObjectURL(file) })
  }, [stagedImage])

  const clearStagedImage = useCallback(() => {
    if (stagedImage) URL.revokeObjectURL(stagedImage.url)
    setStagedImage(null)
  }, [stagedImage])

  const confirmStagedImage = useCallback(() => {
    if (!stagedImage) return
    const file = stagedImage.file
    setStagedImage(null)
    decodeImage(file)
  }, [stagedImage, decodeImage])

  // Clipboard paste → stage for preview
  useImagePaste(enabled, stageImage)

  // ── Text submit ─────────────────────────────────────────────────────────────

  /** Decode an arbitrary text string (for NavTop submit or tour demo). */
  const decodeText = useCallback((text: string) => {
    const trimmed = text.trim()
    if (!trimmed) { setError('Please enter or scan a barcode'); return }
    decode(trimmed)
  }, [decode])

  const handleSubmit = useCallback(() => {
    if (stagedImage) { confirmStagedImage(); return }
    decodeText(importText)
  }, [importText, stagedImage, confirmStagedImage, decodeText])

  // ── Camera scanning ─────────────────────────────────────────────────────────

  const handleScan = useCallback(() => {
    setError('')
    setScanRequested(true)
  }, [])

  const handleStopScan = useCallback(() => {
    stopScanning()
    setScanRequested(false)
    clearParts()
  }, [stopScanning, clearParts])

  // Once video element mounts, start the scanner
  useEffect(() => {
    if (scanRequested && !isScanning) {
      const timer = setTimeout(() => {
        if (videoRef.current) startScanning(videoRef.current)
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [scanRequested, isScanning, startScanning])

  // Scan result → decode
  useEffect(() => {
    if (scanResult) {
      setScanRequested(false)
      clearParts()
      setImportText(toEncryptedText(scanResult))
      const bytes = scanResultBytes
      clearResult()
      decode(scanResult, bytes)
    }
  }, [scanResult, scanResultBytes, clearResult, decode, clearParts])

  // Scanner error → surface
  useEffect(() => {
    if (scannerError) setError(scannerError)
  }, [scannerError])

  // Clear error when user types
  useEffect(() => {
    if (error && importText) setError('')
  }, [importText, error])

  // ── Reset all state ─────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    setImportText('')
    setError('')
    if (stagedImage) URL.revokeObjectURL(stagedImage.url)
    setStagedImage(null)
    clearParts()
    if (isScanning || scanRequested) { stopScanning(); setScanRequested(false) }
  }, [isScanning, scanRequested, stopScanning, stagedImage, clearParts])

  return {
    importText,
    setImportText,
    stagedImage,
    clearStagedImage,
    confirmStagedImage,
    stageImage,
    isDecodingImage,
    error,
    scanRequested,
    isScanning,
    videoRef,
    partProgress,
    /** Drop the series in progress (e.g. to switch to a different note's symbols). */
    resetParts: clearParts,
    handleScan,
    handleStopScan,
    handleSubmit,
    decodeText,
    reset,
  }
}
