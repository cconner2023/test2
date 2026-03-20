import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { ScanLine, X, Camera, ImagePlus, Check, ChevronLeft } from 'lucide-react'
import { BaseDrawer } from './BaseDrawer'
import { ContentWrapper } from './Settings/ContentWrapper'
import { HeaderPill, PillButton } from './HeaderPill'
import { useSwipeBack } from '../Hooks/useSwipeBack'
import { useIsMobile } from '../Hooks/useIsMobile'
import { useBarcodeScanner } from '../Hooks/useBarcodeScanner'
import { useImagePaste } from '../Hooks/useImagePaste'
import { UI_TIMING } from '../Utilities/constants'
import { ProviderNote } from './Provider/ProviderNote'
import { ProviderNoteOutput } from './Provider/ProviderNoteOutput'
import type { PEState } from '../Types/PETypes'
import { parseNoteEncoding, findAlgorithmByCode, findSymptomByCode, reconstructCardStates } from '../Utilities/noteParser'
import { decodePEState } from '../Utilities/peCodec'
import { isEncryptedBarcode, decryptBarcode } from '../Utilities/NoteCodec'
import { assembleNote, formatSignature } from '../Utilities/NoteFormatter'
import {
  MultiFormatReader, BinaryBitmap, HybridBinarizer,
  HTMLCanvasElementLuminanceSource, DecodeHintType, BarcodeFormat,
} from '@zxing/library'

// ─── Types ────────────────────────────────────────────────────────────────────

type ProviderView = 'note' | 'output'

export interface ImportedMedicNote {
  medicHpi: string
  medicPe: string
  medicAssessment: string
  medicPlan: string
  medicName: string
  medicSignature: string
}

interface ProviderDrawerProps {
  isVisible: boolean
  onClose: () => void
}

// ─── ProviderDrawer ───────────────────────────────────────────────────────────

export function ProviderDrawer({ isVisible, onClose }: ProviderDrawerProps) {
  const [view, setView] = useState<ProviderView>('note')
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | ''>('')

  const [hpiNote, setHpiNote] = useState('')
  const [peNote, setPeNote] = useState('')
  const [peState, setPeState] = useState<PEState | null>(null)
  const [peResetKey, setPeResetKey] = useState(0)
  const [assessmentNote, setAssessmentNote] = useState('')
  const [planNote, setPlanNote] = useState('')
  const [importedMedicNote, setImportedMedicNote] = useState<ImportedMedicNote | null>(null)
  const [medicBarcode, setMedicBarcode] = useState('')

  // ── Import bar state ──────────────────────────────────────────────────────
  const [importExpanded, setImportExpanded] = useState(false)
  const [importText, setImportText] = useState('')
  const [decodeError, setDecodeError] = useState('')
  const [isDecodingImage, setIsDecodingImage] = useState(false)
  const [scanRequested, setScanRequested] = useState(false)
  const importInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    isScanning, result: scanResult, startScanning, stopScanning, clearResult,
  } = useBarcodeScanner()
  const videoRef = useRef<HTMLVideoElement>(null)

  const isMobile = useIsMobile()

  // ── Import decode logic ────────────────────────────────────────────────────

  const handleDecode = useCallback(async (text?: string) => {
    const raw = (text ?? importText).trim()
    if (!raw) return
    setDecodeError('')
    try {
      let payload = raw
      if (isEncryptedBarcode(payload)) {
        const decrypted = await decryptBarcode(payload)
        if (!decrypted) { setDecodeError('Unable to decrypt. Sign in and sync encryption key.'); return }
        payload = decrypted
      }
      const parsed = parseNoteEncoding(payload)
      if (!parsed) { setDecodeError('Could not decode note.'); return }

      if (parsed.symptomCode === 'PRV') {
        // Provider solo note — pre-fill provider fields for re-editing
        if (parsed.providerHpi) setHpiNote(parsed.providerHpi)
        if (parsed.providerPe) setPeNote(parsed.providerPe)
        if (parsed.providerPeRaw) {
          const restored = decodePEState(parsed.providerPeRaw, 'PRV')
          if (restored) setPeState(restored)
        }
        setPeResetKey(k => k + 1)
        if (parsed.providerAssessment) setAssessmentNote(parsed.providerAssessment)
        if (parsed.providerPlan) setPlanNote(parsed.providerPlan)
        setImportedMedicNote(null)
        setMedicBarcode('')
        setImportText('')
        setImportExpanded(false)
        return
      }

      // Check if this is a combined bundle (has provider fields)
      if (parsed.providerHpi || parsed.providerPe || parsed.providerAssessment || parsed.providerPlan) {
        if (parsed.providerHpi) setHpiNote(parsed.providerHpi)
        if (parsed.providerPe) setPeNote(parsed.providerPe)
        if (parsed.providerPeRaw) {
          const restored = decodePEState(parsed.providerPeRaw, parsed.symptomCode)
          if (restored) setPeState(restored)
        }
        setPeResetKey(k => k + 1)
        if (parsed.providerAssessment) setAssessmentNote(parsed.providerAssessment)
        if (parsed.providerPlan) setPlanNote(parsed.providerPlan)
      }

      const authorLabel = parsed.user ? formatSignature(parsed.user) || 'Unknown Medic' : 'Unknown Medic'
      let assessmentText = ''
      if (parsed.symptomCode) {
        const algorithmOptions = findAlgorithmByCode(parsed.symptomCode)
        if (algorithmOptions?.length) {
          const { cardStates, disposition } = reconstructCardStates(algorithmOptions, parsed)
          const symptomInfo = findSymptomByCode(parsed.symptomCode)
          const selectedSymptom = symptomInfo ? { icon: symptomInfo.symptom.icon || '', text: symptomInfo.symptom.text || '' } : undefined
          const assembled = assembleNote(
            { includeAlgorithm: parsed.flags.includeAlgorithm, includeDecisionMaking: parsed.flags.includeDecisionMaking, customNote: '', physicalExamNote: '', planNote: '' },
            algorithmOptions, cardStates, disposition?.type ?? '', disposition?.text ?? '', selectedSymptom,
          )
          const parts: string[] = []
          if (assembled.sections.algorithm) parts.push(assembled.sections.algorithm)
          if (assembled.sections.decisionMaking) parts.push(assembled.sections.decisionMaking)
          assessmentText = parts.join('\n\n')
        }
      }
      setImportedMedicNote({
        medicHpi: parsed.hpiText || '', medicPe: parsed.peText || '',
        medicAssessment: assessmentText, medicPlan: parsed.planText || '',
        medicName: authorLabel, medicSignature: authorLabel,
      })
      setMedicBarcode(payload)
      setImportText('')
      setImportExpanded(false)
    } catch { setDecodeError('Failed to decode note.') }
  }, [importText])

  // Image barcode decode
  const handleImageDecode = useCallback(async (file: File) => {
    setIsDecodingImage(true)
    setDecodeError('')
    const objectUrl = URL.createObjectURL(file)
    try {
      const img = document.createElement('img')
      img.src = objectUrl
      await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error('Failed to load image')) })
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      const luminanceSource = new HTMLCanvasElementLuminanceSource(canvas)
      const bitmap = new BinaryBitmap(new HybridBinarizer(luminanceSource))
      const hints = new Map<DecodeHintType, any>()
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.DATA_MATRIX])
      hints.set(DecodeHintType.TRY_HARDER, true)
      const reader = new MultiFormatReader()
      reader.setHints(hints)
      const result = reader.decode(bitmap)
      const decoded = result.getText()
      setImportText(decoded)
      handleDecode(decoded)
    } catch { setDecodeError('No barcode found in image. Try a clearer photo or paste the string directly.') }
    finally { URL.revokeObjectURL(objectUrl); setIsDecodingImage(false) }
  }, [handleDecode])

  // Camera scan result — wire to decode
  useEffect(() => {
    if (scanResult) {
      setScanRequested(false)
      setImportText(scanResult)
      clearResult()
      handleDecode(scanResult)
    }
  }, [scanResult, clearResult, handleDecode])

  // Start camera scanning — render video first, then start scanner after mount
  const handleStartScan = useCallback(() => {
    setDecodeError('')
    setScanRequested(true)
  }, [])

  // Once video element mounts (scanRequested renders it), start the scanner
  useEffect(() => {
    if (scanRequested && !isScanning) {
      const timer = setTimeout(() => {
        if (videoRef.current) startScanning(videoRef.current)
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [scanRequested, isScanning, startScanning])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleImageDecode(file)
    e.target.value = ''
  }, [handleImageDecode])

  // Image paste detection when expanded
  useImagePaste(importExpanded, handleImageDecode)

  const handleExpandImport = useCallback(() => {
    setImportExpanded(true)
    setDecodeError('')
  }, [])

  const handleCollapseImport = useCallback(() => {
    setImportExpanded(false)
    setImportText('')
    setDecodeError('')
    if (isScanning || scanRequested) { stopScanning(); setScanRequested(false) }
  }, [isScanning, scanRequested, stopScanning])

  // ── Slide Animation ─────────────────────────────────────────────────────────

  const handleSlideAnimation = useCallback((direction: 'left' | 'right') => {
    setSlideDirection(direction)
    setTimeout(() => setSlideDirection(''), UI_TIMING.SLIDE_ANIMATION)
  }, [])

  // ── Navigation ──────────────────────────────────────────────────────────────

  const handleGoToOutput = useCallback(() => {
    handleSlideAnimation('left')
    setView('output')
  }, [handleSlideAnimation])

  const handleBack = useCallback(() => {
    if (view === 'output') {
      handleSlideAnimation('right')
      setView('note')
    }
  }, [view, handleSlideAnimation])

  const handleClose = useCallback(() => {
    setView('note')
    setSlideDirection('')
    setHpiNote('')
    setPeNote('')
    setPeState(null)
    setAssessmentNote('')
    setPlanNote('')
    setImportedMedicNote(null)
    setMedicBarcode('')
    setImportExpanded(false)
    setImportText('')
    setDecodeError('')
    if (isScanning || scanRequested) { stopScanning(); setScanRequested(false) }
    onClose()
  }, [onClose, isScanning, scanRequested, stopScanning])

  // ── Swipe Back ──────────────────────────────────────────────────────────────

  const canSwipeBack = view === 'output'
  const swipeHandlers = useSwipeBack(
    useMemo(() => {
      if (canSwipeBack) return handleBack
      return undefined
    }, [canSwipeBack, handleBack]),
    canSwipeBack,
  )

  // Focus import input when expanded
  useEffect(() => {
    if (importExpanded && importInputRef.current) {
      const timer = setTimeout(() => importInputRef.current?.focus(), 120)
      return () => clearTimeout(timer)
    }
  }, [importExpanded])

  // ── Floating Header ────────────────────────────────────────────────────────

  const noteHeaderRight = (
    <div className="flex items-center flex-1 min-w-0 justify-end relative">
      {/* Collapsed pill */}
      <div className={`transition-all duration-300 ${
        importExpanded
          ? 'opacity-0 scale-90 pointer-events-none absolute right-0'
          : 'opacity-100 scale-100'
      }`}>
        <HeaderPill>
          <PillButton icon={ScanLine} iconSize={20} onClick={handleExpandImport} label="Import Medic Note" />
          <PillButton icon={X} onClick={handleClose} label="Close" />
        </HeaderPill>
      </div>
      {/* Expanded input bar */}
      <div className={`flex items-center flex-1 min-w-0 gap-2 transition-all duration-300 origin-right ${
        importExpanded
          ? 'opacity-100 scale-100'
          : 'opacity-0 scale-95 pointer-events-none absolute right-0 left-0'
      }`}>
        <form
          onSubmit={(e) => { e.preventDefault(); handleDecode() }}
          className="flex-1 min-w-0"
        >
          <div className="relative flex items-center">
            <div className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
              <button
                type="button"
                onClick={handleStartScan}
                className="w-8 h-8 rounded-full flex items-center justify-center text-tertiary/50 hover:text-themeblue3 hover:bg-themeblue3/5 active:scale-95 transition-colors"
                title="Scan barcode"
              >
                <Camera size={16} />
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isDecodingImage}
                className="w-8 h-8 rounded-full flex items-center justify-center text-tertiary/50 hover:text-themeblue3 hover:bg-themeblue3/5 active:scale-95 transition-colors disabled:opacity-40"
                title={isDecodingImage ? 'Reading image...' : 'Upload image'}
              >
                <ImagePlus size={16} />
              </button>
            </div>
            <input
              ref={importInputRef}
              type="text"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              className="w-full rounded-full py-2.5 pl-[4.5rem] pr-3 border border-themeblue3/10 shadow-xs bg-themewhite focus:border-themeblue1/30 focus:bg-themewhite2 focus:outline-none text-sm text-primary placeholder:text-tertiary/30 transition-all duration-300"
              placeholder="Paste code or scan"
            />
          </div>
        </form>
        {importText.trim() && (
          <button
            type="button"
            onClick={() => handleDecode()}
            className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center active:scale-95 transition-all duration-300 bg-themeblue3 text-white"
            aria-label="Import"
            title="Import"
          >
            <Check style={{ width: 20, height: 20 }} />
          </button>
        )}
        <button
          type="button"
          onClick={handleCollapseImport}
          className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center active:scale-95 transition-all duration-300 bg-themewhite2 border border-themeblue3/10 text-tertiary hover:text-primary"
          aria-label="Close import"
          title="Close import"
        >
          <X style={{ width: 24, height: 24 }} />
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
      </div>
    </div>
  )

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <BaseDrawer
      isVisible={isVisible}
      onClose={handleClose}
      fullHeight="90dvh"
      desktopPosition="left"
      desktopWidth="w-[90%]"
    >
      <ContentWrapper
        slideDirection={isMobile ? slideDirection : ''}
        swipeHandlers={isMobile && canSwipeBack ? swipeHandlers : undefined}
      >
        <div className="h-full overflow-y-auto">
          {/* Floating header — scroll-behind blur */}
          <div
            className="sticky top-0 z-10 backdrop-blur-sm bg-transparent"
            data-drag-zone
            style={{ touchAction: 'none' }}
          >
            {isMobile && (
              <div className="flex justify-center pt-1.5 pb-1">
                <div className="w-9 h-1 rounded-full bg-tertiary/25" />
              </div>
            )}
            <div className={`px-5 ${isMobile ? 'pb-2.5' : 'py-4'}`}>
              <div className="flex items-center justify-between">
                {/* Left: back or title */}
                <div className={`flex items-center gap-2 min-w-0 transition-all duration-200${view === 'note' && importExpanded ? ' w-0 overflow-hidden' : ''}`}>
                  {view === 'output' && (
                    isMobile ? (
                      <HeaderPill>
                        <PillButton icon={ChevronLeft} onClick={handleBack} label="Go back" />
                      </HeaderPill>
                    ) : (
                      <button
                        onClick={handleBack}
                        className="p-2 rounded-full hover:bg-themewhite2 active:scale-95 transition-all"
                        aria-label="Go back"
                      >
                        <ChevronLeft size={24} className="text-tertiary" />
                      </button>
                    )
                  )}
                  <h2 className={`truncate ${isMobile ? 'text-[17px] font-semibold text-primary' : 'text-2xl text-primary'}`}>
                    {view === 'note' ? 'Provider' : 'Note Output'}
                  </h2>
                  <span className="text-[11px] font-semibold text-themeyellow bg-themeyellow/15 px-2 py-0.5 rounded-full shrink-0 tracking-wide">
                    BETA
                  </span>
                </div>
                {/* Right: controls */}
                <div className={`flex items-center gap-2${view === 'note' && importExpanded ? ' flex-1 min-w-0' : ' flex-1 min-w-0 justify-end'}`}>
                  {view === 'note' ? noteHeaderRight : (
                    isMobile ? (
                      <div className="flex items-center justify-end flex-1">
                        <HeaderPill>
                          <PillButton icon={X} onClick={handleClose} label="Close" />
                        </HeaderPill>
                      </div>
                    ) : (
                      <HeaderPill>
                        <PillButton icon={X} onClick={handleClose} label="Close" />
                      </HeaderPill>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Camera scanning overlay */}
          {(scanRequested || isScanning) && (
            <div className="px-4 pt-3 pb-2">
              <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute inset-4 border-2 border-white/30 rounded-lg" />
                  <div className="absolute inset-x-4 top-1/2 h-0.5 bg-themeblue2 animate-pulse" />
                  <ScanLine className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 text-white/50" />
                </div>
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full">
                  Looking for barcode...
                </div>
              </div>
              <div className="flex justify-center pt-2">
                <button onClick={() => { stopScanning(); setScanRequested(false) }} className="text-xs text-tertiary/60 hover:text-tertiary active:scale-95 transition-colors">Cancel scan</button>
              </div>
            </div>
          )}
          {/* Decode error */}
          {decodeError && (
            <div className="px-4 pt-2">
              <div className="text-xs text-themeredred">{decodeError}</div>
            </div>
          )}

          {/* Content */}
          <div className="px-5 py-3 md:p-5 pb-8">
            {view === 'note' ? (
              <ProviderNote
                hpiNote={hpiNote}
                setHpiNote={setHpiNote}
                peNote={peNote}
                setPeNote={setPeNote}
                peState={peState}
                onPeStateChange={setPeState}
                peResetKey={peResetKey}
                assessmentNote={assessmentNote}
                setAssessmentNote={setAssessmentNote}
                planNote={planNote}
                setPlanNote={setPlanNote}
                onNext={handleGoToOutput}
                importedMedicNote={importedMedicNote}
              />
            ) : (
              <ProviderNoteOutput
                hpiNote={hpiNote}
                peNote={peNote}
                peState={peState}
                assessmentNote={assessmentNote}
                planNote={planNote}
                importedMedicNote={importedMedicNote}
                medicBarcode={medicBarcode}
              />
            )}
          </div>
        </div>
      </ContentWrapper>
    </BaseDrawer>
  )
}
