import { useState, useCallback, useRef, useEffect } from 'react'
import { useImagePaste } from './useImagePaste'
import { useBarcodeScanner } from './useBarcodeScanner'
import { decodeImageBarcode } from '../Utilities/barcodeImageDecode'
import { decryptBarcodePayload, isEncryptedBarcode } from '../Utilities/barcodeCodec'

export interface BarcodeImportResult {
  /** Decrypted plaintext payload (pipe-delimited or plain) */
  payload: string
  /** Display-friendly encoded representation (for barcode rendering) */
  encodedText: string
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
  // Already enc:-prefixed text → use as-is
  if (isEncryptedBarcode(text)) return text
  // Fallback: return original text
  return text
}

/**
 * Shared hook for the full barcode import lifecycle:
 * text input, image paste/staging, camera scanning, ZXing decode, decrypt.
 *
 * Consumer provides `onDecoded` to handle the decrypted payload.
 * Returns all state and handlers needed to render ImportInputBar,
 * staged image preview, and camera scan UI.
 */
export function useBarcodeImport({ onDecoded, enabled = true }: UseBarcodeImportOptions) {
  const [importText, setImportText] = useState('')
  const [stagedImage, setStagedImage] = useState<{ file: File; url: string } | null>(null)
  const [isDecodingImage, setIsDecodingImage] = useState(false)
  const [error, setError] = useState('')
  const [scanRequested, setScanRequested] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const {
    isScanning,
    error: scannerError,
    result: scanResult,
    resultBytes: scanResultBytes,
    startScanning,
    stopScanning,
    clearResult,
  } = useBarcodeScanner()

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

  // ── Image decode: ZXing → decrypt → onDecoded ──────────────────────────────

  const decodeImage = useCallback(async (file: File) => {
    setIsDecodingImage(true)
    setError('')
    try {
      const { text, byteSegments } = await decodeImageBarcode(file)
      setImportText(text)
      await decode(text, byteSegments)
    } catch {
      setError('No barcode found in image. Try a clearer photo or paste the string directly.')
    } finally {
      setIsDecodingImage(false)
    }
  }, [decode])

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
  }, [stopScanning])

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
      setImportText(scanResult)
      const bytes = scanResultBytes
      clearResult()
      decode(scanResult, bytes)
    }
  }, [scanResult, scanResultBytes, clearResult, decode])

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
    if (isScanning || scanRequested) { stopScanning(); setScanRequested(false) }
  }, [isScanning, scanRequested, stopScanning, stagedImage])

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
    handleScan,
    handleStopScan,
    handleSubmit,
    decodeText,
    reset,
  }
}
