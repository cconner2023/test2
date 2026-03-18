import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { ScanLine, X, Camera, ImagePlus, Check } from 'lucide-react'
import { useSpring, animated } from '@react-spring/web'
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
import { parseNoteEncoding, findAlgorithmByCode, findSymptomByCode, reconstructCardStates } from '../Utilities/noteParser'
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
  const [assessmentNote, setAssessmentNote] = useState('')
  const [planNote, setPlanNote] = useState('')
  const [importedMedicNote, setImportedMedicNote] = useState<ImportedMedicNote | null>(null)

  // ── Import bar state ──────────────────────────────────────────────────────
  const [importExpanded, setImportExpanded] = useState(false)
  const [importText, setImportText] = useState('')
  const [decodeError, setDecodeError] = useState('')
  const [isDecodingImage, setIsDecodingImage] = useState(false)
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

  // Camera scan result
  const handleScanResult = useCallback(() => {
    if (scanResult) {
      setImportText(scanResult)
      clearResult()
      handleDecode(scanResult)
    }
  }, [scanResult, clearResult, handleDecode])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useMemo(() => { handleScanResult() }, [scanResult])

  const handleStartScan = useCallback(() => {
    setDecodeError('')
    setTimeout(() => { if (videoRef.current) startScanning(videoRef.current) }, 100)
  }, [startScanning])

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
    if (isScanning) stopScanning()
  }, [isScanning, stopScanning])

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
    setAssessmentNote('')
    setPlanNote('')
    setImportedMedicNote(null)
    setImportExpanded(false)
    setImportText('')
    setDecodeError('')
    if (isScanning) stopScanning()
    onClose()
  }, [onClose, isScanning, stopScanning])

  // ── Swipe Back ──────────────────────────────────────────────────────────────

  const canSwipeBack = view === 'output'
  const swipeHandlers = useSwipeBack(
    useMemo(() => {
      if (canSwipeBack) return handleBack
      return undefined
    }, [canSwipeBack, handleBack]),
    canSwipeBack,
  )

  // ── Header Config ───────────────────────────────────────────────────────────

  // ── Import bar spring (no bounce — high friction, mirrors map toolbar pattern) ─
  const importBarExpanded = view === 'note' && importExpanded

  const importSpring = useSpring({
    progress: importBarExpanded ? 1 : 0,
    config: { tension: 260, friction: 28 },
  })

  // Focus import input after spring opens
  useEffect(() => {
    if (importExpanded && importInputRef.current) {
      const timer = setTimeout(() => importInputRef.current?.focus(), 120)
      return () => clearTimeout(timer)
    }
  }, [importExpanded])

  const headerConfig = useMemo(() => {
    switch (view) {
      case 'note':
        return {
          title: 'Provider',
          badge: 'BETA',
          hideDefaultClose: true,
          rightContentFill: importExpanded,
          rightContent: (
            <div className="flex items-center flex-1 min-w-0 justify-end">
              <HeaderPill>
                {/* Import controls — expand from zero width */}
                <animated.div
                  className="flex items-center min-w-0 overflow-hidden"
                  style={{
                    width: importSpring.progress.to((p: number) => p === 0 ? '0px' : 'auto'),
                    flex: importSpring.progress.to((p: number) => `${p} 0 0px`),
                    opacity: importSpring.progress,
                    pointerEvents: importBarExpanded ? 'auto' : 'none',
                  }}
                >
                  <form
                    onSubmit={(e) => { e.preventDefault(); handleDecode() }}
                    className="flex items-center flex-1 min-w-0"
                  >
                    <div className="flex items-center gap-0.5 shrink-0 pl-1">
                      <button
                        type="button"
                        onClick={handleStartScan}
                        className="p-1 text-tertiary/50 hover:text-themeblue3 active:scale-95 transition-colors"
                        title="Scan barcode"
                      >
                        <Camera size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isDecodingImage}
                        className="p-1 text-tertiary/50 hover:text-themeblue3 active:scale-95 transition-colors disabled:opacity-40"
                        title={isDecodingImage ? 'Reading image...' : 'Upload image'}
                      >
                        <ImagePlus size={15} />
                      </button>
                    </div>
                    <input
                      ref={importInputRef}
                      type="text"
                      value={importText}
                      onChange={(e) => setImportText(e.target.value)}
                      className="flex-1 min-w-0 bg-transparent outline-none text-sm text-primary px-2 py-1.5 placeholder:text-tertiary/30"
                      placeholder="Paste code or scan"
                    />
                  </form>
                </animated.div>
                {/* ScanLine button — collapses when import expands */}
                <animated.div
                  className="overflow-hidden shrink-0"
                  style={{
                    width: importSpring.progress.to((p: number) => p === 1 ? '0px' : 'auto'),
                    opacity: importSpring.progress.to((p: number) => 1 - p),
                    pointerEvents: importBarExpanded ? 'none' : 'auto',
                  }}
                >
                  <PillButton icon={ScanLine} iconSize={20} onClick={handleExpandImport} label="Import Medic Note" />
                </animated.div>
                {/* X — always visible, contextual action */}
                <PillButton
                  icon={X}
                  onClick={importExpanded ? handleCollapseImport : handleClose}
                  label={importExpanded ? 'Close import' : 'Close'}
                />
              </HeaderPill>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
              {importText.trim() && (
                <button
                  type="button"
                  onClick={() => handleDecode()}
                  className="shrink-0 w-10 h-10 ml-1.5 rounded-full flex items-center justify-center bg-themeblue3 text-white active:scale-95 transition-all"
                  title="Import"
                >
                  <Check size={18} />
                </button>
              )}
            </div>
          ),
        }
      case 'output':
        return {
          title: 'Note Output',
          badge: 'BETA',
          showBack: true,
          onBack: handleBack,
        }
    }
  }, [view, handleBack, importBarExpanded, importText, isDecodingImage, handleDecode, handleStartScan, handleFileSelect, handleExpandImport, handleClose, importSpring])

  // ── Content ─────────────────────────────────────────────────────────────────

  const subViewWrapper = (children: React.ReactNode) => (
    <div className="h-full overflow-y-auto">
      <div className="px-4 py-3 md:p-5 pb-8 min-h-full">
        {children}
      </div>
    </div>
  )

  const renderContent = () => {
    switch (view) {
      case 'note':
        return subViewWrapper(
          <ProviderNote
            hpiNote={hpiNote}
            setHpiNote={setHpiNote}
            peNote={peNote}
            setPeNote={setPeNote}
            assessmentNote={assessmentNote}
            setAssessmentNote={setAssessmentNote}
            planNote={planNote}
            setPlanNote={setPlanNote}
            onNext={handleGoToOutput}
            importedMedicNote={importedMedicNote}
          />
        )
      case 'output':
        return subViewWrapper(
          <ProviderNoteOutput
            hpiNote={hpiNote}
            peNote={peNote}
            assessmentNote={assessmentNote}
            planNote={planNote}
            importedMedicNote={importedMedicNote}
          />
        )
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <BaseDrawer
      isVisible={isVisible}
      onClose={handleClose}
      fullHeight="90dvh"
      desktopPosition="left"
      desktopWidth="w-[90%]"
      header={headerConfig}
    >
      <ContentWrapper
        slideDirection={isMobile ? slideDirection : ''}
        swipeHandlers={isMobile && canSwipeBack ? swipeHandlers : undefined}
      >
        <div className="h-full relative">
          {/* Camera scanning overlay */}
          {isScanning && (
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
                <button onClick={() => { stopScanning() }} className="text-xs text-tertiary/60 hover:text-tertiary active:scale-95 transition-colors">Cancel scan</button>
              </div>
            </div>
          )}
          {/* Decode error */}
          {decodeError && (
            <div className="px-4 pt-2">
              <div className="text-xs text-themeredred">{decodeError}</div>
            </div>
          )}
          {renderContent()}
        </div>
      </ContentWrapper>
    </BaseDrawer>
  )
}
