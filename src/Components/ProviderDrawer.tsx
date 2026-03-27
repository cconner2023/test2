import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { ScanLine, X, LayoutTemplate, ChevronLeft } from 'lucide-react'
import { ImportInputBar } from './ImportInputBar'
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
import { ProviderTemplateList } from './Provider/ProviderTemplateList'
import type { PEState } from '../Types/PETypes'
import type { ProviderNoteTemplate, TextExpander, PlanOrderSet, PlanBlockKey } from '../Data/User'
import { PLAN_ORDER_LABELS } from '../Data/User'
import { useUserProfile } from '../Hooks/useUserProfile'
import { getBlockByKey } from '../Data/PhysicalExamData'
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
  const { profile } = useUserProfile()
  const templates = profile.providerNoteTemplates ?? []

  // ── Mobile template drawer ─────────────────────────────────────────────────
  const [templateDrawerOpen, setTemplateDrawerOpen] = useState(false)

  // ── Template apply (merge — only fills empty provider fields) ──────────────

  const expandTemplateText = useCallback((text: string | undefined, abbrs: string[] | undefined, legacyAbbr: string | undefined, expanders: TextExpander[]): string => {
    // Unified model: abbreviations are embedded in text, expand tokens in-place
    if (text?.trim()) {
      const abbrMap = new Map(expanders.map(e => [e.abbr, e.expansion]));
      return text.split(/(\s+)/).map(token => abbrMap.get(token) ?? token).join('');
    }
    // Legacy model: separate abbreviation fields
    const list = abbrs?.length ? abbrs : legacyAbbr ? [legacyAbbr] : [];
    if (!list.length) return '';
    return list
      .map(abbr => expanders.find(e => e.abbr === abbr)?.expansion ?? '')
      .filter(Boolean)
      .join('\n\n');
  }, [])

  const generatePlanFromOrderSet = useCallback((orderSet: PlanOrderSet): string => {
    const labels: Record<string, string> = { ...PLAN_ORDER_LABELS, instructions: 'Instructions' }
    const blockOrder: PlanBlockKey[] = ['meds', 'lab', 'radiology', 'referral', 'instructions', 'followUp']
    const lines: string[] = []
    for (const key of blockOrder) {
      const tags = orderSet.presets[key]
      if (tags?.length) lines.push(`${labels[key]}: ${tags.join('; ')}`)
    }
    return lines.join('\n')
  }, [])

  const handleApplyTemplate = useCallback((template: ProviderNoteTemplate) => {
    const expanders = profile.textExpanders ?? []
    if (!hpiNote) {
      const text = expandTemplateText(template.hpiText, template.hpiExpanderAbbrs, template.hpiExpanderAbbr, expanders)
      if (text) setHpiNote(text)
    }
    if (!peNote && !template.peBlockKeys?.length) {
      const text = expandTemplateText(template.peText, template.peExpanderAbbrs, template.peExpanderAbbr, expanders)
      if (text) setPeNote(text)
    }
    // PE structured blocks — build PEState with all-normal for each selected block
    if (template.peBlockKeys?.length && !peState) {
      const items: Record<string, { status: 'normal'; selectedNormals: string[]; selectedAbnormals: string[]; findings: string }> = {}
      const textLines: string[] = []
      for (const key of template.peBlockKeys) {
        const block = getBlockByKey(key)
        if (block) {
          const normals = block.findings.filter(f => f.normal).map(f => f.key)
          items[key] = {
            status: 'normal',
            selectedNormals: normals,
            selectedAbnormals: [],
            findings: '',
          }
          const normalLabels = block.findings.filter(f => f.normal && normals.includes(f.key)).map(f => f.normal!)
          textLines.push(`${block.label.toUpperCase()}: ${normalLabels.join(', ') || 'Normal'}`)
        }
      }
      setPeNote(textLines.join('\n'))
      setPeState({
        categoryLetter: 'A',
        laterality: 'right',
        spineRegion: 'lumbar',
        items,
        vitals: {},
        additional: '',
        depth: 'comprehensive',
        blockOrder: template.peBlockKeys,
      })
      setPeResetKey(k => k + 1)
    }
    if (!assessmentNote) {
      const text = expandTemplateText(template.assessmentText, template.assessmentExpanderAbbrs, template.assessmentExpanderAbbr, expanders)
      if (text) setAssessmentNote(text)
    }
    if (!planNote) {
      let text = expandTemplateText(template.planText, template.planExpanderAbbrs, template.planExpanderAbbr, expanders)
      if (!text && template.planOrderSetId) {
        const orderSet = (profile.planOrderSets ?? []).find(os => os.id === template.planOrderSetId)
        if (orderSet) text = generatePlanFromOrderSet(orderSet)
      }
      if (text) setPlanNote(text)
    }
  }, [profile.textExpanders, profile.planOrderSets, hpiNote, peNote, peState, assessmentNote, planNote, expandTemplateText, generatePlanFromOrderSet])

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

  // ── Tour events ──────────────────────────────────────────────────────────
  useEffect(() => {
    const handleTourImport = (e: Event) => {
      const barcode = (e as CustomEvent).detail as string
      if (barcode) handleDecode(barcode)
    }
    const handleTourApplyTemplate = () => {
      const demoTemplate = templates.find(t => t.id.startsWith('tour_provider_'))
      if (demoTemplate) handleApplyTemplate(demoTemplate)
    }
    const handleTourGoToOutput = () => {
      handleGoToOutput()
    }
    window.addEventListener('tour:provider-import', handleTourImport)
    window.addEventListener('tour:provider-apply-template', handleTourApplyTemplate)
    window.addEventListener('tour:provider-go-to-output', handleTourGoToOutput)
    return () => {
      window.removeEventListener('tour:provider-import', handleTourImport)
      window.removeEventListener('tour:provider-apply-template', handleTourApplyTemplate)
      window.removeEventListener('tour:provider-go-to-output', handleTourGoToOutput)
    }
  }, [handleDecode, templates, handleApplyTemplate, handleGoToOutput])

  // No auto-focus on expand — iOS keyboard open shifts the viewport

  // ── Desktop header (import bar in right content) ─────────────────────────

  const desktopHeaderRight = (
    <div className="flex items-center flex-1 min-w-0 justify-end relative">
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
      <div className={`flex-1 min-w-0 transition-all duration-300 origin-right ${
        importExpanded
          ? 'opacity-100 scale-100'
          : 'opacity-0 scale-95 pointer-events-none absolute right-0 left-0'
      }`}>
        <ImportInputBar
          value={importText}
          onChange={setImportText}
          onSubmit={() => handleDecode()}
          onClose={handleCollapseImport}
          onScan={handleStartScan}
          onImage={handleImageDecode}
          inputRef={importInputRef}
          fileRef={fileInputRef}
          isDecodingImage={isDecodingImage}
        />
      </div>
    </div>
  )

  // ── Header config (desktop only — mobile uses custom floating header) ────

  const headerConfig = useMemo(() => {
    if (isMobile) return undefined
    if (view === 'output') {
      return {
        title: 'Note Output',
        showBack: true,
        onBack: handleBack,
      }
    }
    return {
      title: 'Provider',
      rightContent: desktopHeaderRight,
      hideDefaultClose: true,
      rightContentFill: importExpanded,
    }
  }, [view, handleBack, desktopHeaderRight, importExpanded, isMobile])

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <BaseDrawer
      isVisible={isVisible}
      onClose={handleClose}
      mobileFullScreen
      fullHeight="90dvh"
      desktopPosition="left"
      desktopWidth="w-[90%]"
      header={headerConfig}
      blurHeader
    >
      <div className="relative h-full">
        {/* Mobile floating header — matches CalendarDrawer pattern */}
        {isMobile && (
          <div className="md:hidden absolute top-0 inset-x-0 z-10 backdrop-blur-sm bg-transparent">
            <div className="px-3 py-3 pt-[max(0.75rem,var(--sat,0px))] flex items-center justify-between">
              {view === 'note' ? (
                <>
                  <HeaderPill>
                    {templates.length > 0 && (
                      <PillButton icon={LayoutTemplate} iconSize={20} onClick={() => setTemplateDrawerOpen(true)} label="Templates" />
                    )}
                  </HeaderPill>
                  <span className="text-sm font-semibold text-primary">Provider</span>
                  <div className="relative">
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
                    <div className={`min-w-0 transition-all duration-300 origin-right ${
                      importExpanded
                        ? 'opacity-100 scale-100'
                        : 'opacity-0 scale-95 pointer-events-none absolute right-0 left-0'
                    }`}>
                      <ImportInputBar
                        value={importText}
                        onChange={setImportText}
                        onSubmit={() => handleDecode()}
                        onClose={handleCollapseImport}
                        onScan={handleStartScan}
                        onImage={handleImageDecode}
                        inputRef={importInputRef}
                        fileRef={fileInputRef}
                        isDecodingImage={isDecodingImage}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <HeaderPill>
                    <PillButton icon={ChevronLeft} onClick={handleBack} label="Back" />
                  </HeaderPill>
                  <span className="text-sm font-semibold text-primary">Note Output</span>
                  <HeaderPill>
                    <PillButton icon={X} onClick={handleClose} label="Close" />
                  </HeaderPill>
                </>
              )}
            </div>
          </div>
        )}

        {!isMobile ? (
          <div className="flex h-full">
            {/* Left pane — templates */}
            <div className="w-[260px] shrink-0 border-r border-tertiary/10 flex flex-col bg-themewhite3/50 pt-14">
              <ProviderTemplateList
                templates={templates}
                onSelect={handleApplyTemplate}
              />
            </div>
            {/* Right pane — note content */}
            <div className="flex-1 min-w-0 overflow-y-auto">
              <ContentWrapper slideDirection="" swipeHandlers={undefined}>
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
                {decodeError && (
                  <div className="px-4 pt-2">
                    <div className="text-xs text-themeredred">{decodeError}</div>
                  </div>
                )}
                <div className="p-5 pt-14 pb-8">
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
              </ContentWrapper>
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 overflow-y-auto">
            <ContentWrapper
              slideDirection={slideDirection}
              swipeHandlers={canSwipeBack ? swipeHandlers : undefined}
            >
              {(scanRequested || isScanning) && (
                <div className="px-4 pt-20 pb-2">
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
              {decodeError && (
                <div className="px-4 pt-2">
                  <div className="text-xs text-themeredred">{decodeError}</div>
                </div>
              )}
              <div className="px-5 pt-20 py-3 pb-[max(2rem,var(--sab,0px))]">
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
            </ContentWrapper>
          </div>
        )}

        {/* Mobile template picker drawer */}
        {isMobile && (
          <BaseDrawer
            isVisible={templateDrawerOpen}
            onClose={() => setTemplateDrawerOpen(false)}
            mobileOnly
            fullHeight="90dvh"
            zIndex="z-50"
            header={{ title: 'Templates' }}
          >
            <ProviderTemplateList
              templates={templates}
              hideHeader
              onSelect={(t) => { handleApplyTemplate(t); setTemplateDrawerOpen(false) }}
            />
          </BaseDrawer>
        )}
      </div>
    </BaseDrawer>
  )
}
