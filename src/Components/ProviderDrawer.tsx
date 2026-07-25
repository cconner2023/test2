import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { ScanLine, X, LayoutTemplate, Pencil, Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { ImportInputBar } from './ImportInputBar'
import { ImportResultPopover } from './ImportResultPopover'
import { BaseDrawer } from '@/Components/primitives/BaseDrawer'
import { FooterPill } from '@/Components/primitives/FooterPill'
import { Sheet } from '@/Components/primitives/Sheet'
import { ContentWrapper } from '@/Components/primitives/ContentWrapper'
import { HeaderPill, PillButton } from '@/Components/primitives/HeaderPill'
import { SearchInput } from '@/Components/primitives/SearchInput'
import { ActionButton } from '@/Components/primitives/ActionButton'
import { AddFab } from '@/Components/primitives/AddFab'
import { SlideRevealPane } from '@/Components/primitives/SlideRevealPane'
import { useStack } from '@/Components/primitives/useStack'
import { type StackNav, type StackScreen } from './stackNav'
import { useSwipeBack } from '../Hooks/useSwipeBack'
import { useIsMobile } from '../Hooks/useIsMobile'
import { useEscBackout } from '../Hooks/useEscBackout'
import { useBarcodeImport } from '../Hooks/useBarcodeImport'
import { UI_TIMING } from '../Utilities/constants'
import { ProviderNote, type ProviderSection } from './Provider/ProviderNote'
import { ProviderNoteOutput } from './Provider/ProviderNoteOutput'
import { ProviderTemplateTree } from './Provider/ProviderTemplateTree'
import { TemplateDetailBody } from './Provider/ProviderTemplateDetail'
import { TextSectionEditor } from './Provider/ProviderPaneSections'
import { usePEPaneScreens, PECenter } from './Provider/ProviderPESections'
import { usePlanPaneScreens } from './Provider/ProviderPlanSections'
import { generatePEText } from './PhysicalExam'
import { parsePlanState } from './Plan'
import { useMergedNoteContent } from '../Hooks/useMergedNoteContent'
import type { PlanState } from '../Types/PlanTypes'
import { ProviderTemplateMenu } from './Provider/ProviderTemplateMenu'
import {
  ProviderTemplateEditPopover,
  useProviderTemplateEditorScreens,
  type EditState as TemplateEditState,
} from './Provider/ProviderTemplateEditPopover'
import type { PEState, PEItemState } from '../Types/PETypes'
import type { UserTypes, ProviderNoteTemplate, TextExpander, PlanOrderSet, PlanBlockKey } from '../Data/User'
import { PLAN_ORDER_LABELS } from '../Data/User'
import { useUserProfile } from '../Hooks/useUserProfile'
import { getMasterBlockByKey } from '../Data/PhysicalExamData'
import { parseNoteEncoding, findAlgorithmByCode, findSymptomByCode, reconstructCardStates } from '../Utilities/noteParser'
import { decodePEState } from '../Utilities/peCodec'
import { assembleNote, formatSignature } from '../Utilities/NoteFormatter'

// ─── Types ────────────────────────────────────────────────────────────────────

type ProviderView = 'note' | 'output'

/** Which screen the desktop right pane shows (null = closed, rail expanded). The
 *  key indexes the pane's useStack `screens` map; `detail` reads selectedTemplateId
 *  live, `editor` reads templateEditState. */
type PaneScreen = { key: string; params?: unknown }

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
  const [view, setView] = useState<ProviderView>('note') // mobile output view-swap only
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | ''>('')

  const [hpiNote, setHpiNote] = useState('')
  const [peNote, setPeNote] = useState('')
  const [peState, setPeState] = useState<PEState | null>(null)
  const [planState, setPlanState] = useState<PlanState | null>(null)
  const [peResetKey, setPeResetKey] = useState(0)
  const [planResetKey, setPlanResetKey] = useState(0)
  const [selectedBlockKeys, setSelectedBlockKeys] = useState<string[]>([])
  const [assessmentNote, setAssessmentNote] = useState('')
  const [planNote, setPlanNote] = useState('')
  const [importedMedicNote, setImportedMedicNote] = useState<ImportedMedicNote | null>(null)
  const [medicBarcode, setMedicBarcode] = useState('')

  // ── Import bar state ──────────────────────────────────────────────────────
  const [importExpanded, setImportExpanded] = useState(false)
  const importInputRef = useRef<HTMLInputElement>(null)

  const isMobile = useIsMobile()
  const { profile, updateProfile, syncProfileField } = useUserProfile()
  // Merged (personal + subscribed clinic) plan tags/order sets — the same source the
  // mobile Plan reads, so the desktop center + pane flow stay consistent with it.
  const { orderTags: planOrderTags, instructionTags: planInstructionTags, orderSets: planOrderSets } = useMergedNoteContent()
  const templates = profile.providerNoteTemplates ?? []
  const orderSetsForExport = profile.planOrderSets ?? []

  // ── Mobile template drawer ─────────────────────────────────────────────────
  const [templateDrawerOpen, setTemplateDrawerOpen] = useState(false)

  // ── Template rail search + selection (desktop three-zone) ──────────────────
  const [templateSearch, setTemplateSearch] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const selectedTemplate = selectedTemplateId
    ? templates.find(t => t.id === selectedTemplateId) ?? null
    : null

  // ── Desktop right pane (Case A/B/C) ────────────────────────────────────────
  const [paneScreen, setPaneScreen] = useState<PaneScreen | null>(null)
  const paneOpen = paneScreen !== null

  // ── Template edit state (mobile popover + desktop pane editor share this) ──
  const [templateEditState, setTemplateEditState] = useState<TemplateEditState | null>(null)

  const persistTemplates = useCallback((next: ProviderNoteTemplate[]) => {
    updateProfile({ providerNoteTemplates: next })
    syncProfileField({ provider_note_templates: next as unknown as UserTypes['providerNoteTemplates'] })
  }, [updateProfile, syncProfileField])

  const closePane = useCallback(() => {
    setPaneScreen(null)
    setTemplateEditState(null)
  }, [])
  // Desktop Esc: close the right editor pane first; a second Esc closes the drawer.
  useEscBackout(!isMobile && paneOpen, closePane)

  const handleTemplateSave = useCallback((entry: ProviderNoteTemplate, isNew: boolean) => {
    const current = profile.providerNoteTemplates ?? []
    const next = isNew ? [...current, entry] : current.map(t => t.id === entry.id ? entry : t)
    persistTemplates(next)
    setTemplateEditState(null)
    setPaneScreen(null) // desktop: leave the editor; no-op on mobile
  }, [profile.providerNoteTemplates, persistTemplates])

  const handleTemplateDelete = useCallback((id: string) => {
    const current = profile.providerNoteTemplates ?? []
    persistTemplates(current.filter(t => t.id !== id))
    setTemplateEditState(null)
    setPaneScreen(null)
    if (selectedTemplateId === id) setSelectedTemplateId(null)
  }, [profile.providerNoteTemplates, persistTemplates, selectedTemplateId])

  const handleTemplateEdit = useCallback((template: ProviderNoteTemplate, anchor: DOMRect) => {
    setTemplateEditState({ mode: 'edit', anchor, template })
  }, [])

  // ── Template apply (overwrites all sections with template content) ─────────

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

  // Overwrites all sections with template content (empty fields cleared too).
  const handleApplyTemplate = useCallback((template: ProviderNoteTemplate) => {
    const expanders = profile.textExpanders ?? []

    setHpiNote(expandTemplateText(template.hpiText, template.hpiExpanderAbbrs, template.hpiExpanderAbbr, expanders))

    if (template.peBlockKeys?.length) {
      // Use the template's saved per-system findings when present; legacy templates
      // (no peItems for a block) fall back to all-normal defaults.
      const items: Record<string, PEItemState> = {}
      for (const key of template.peBlockKeys) {
        const saved = template.peItems?.[key]
        if (saved) { items[key] = saved; continue }
        const block = getMasterBlockByKey(key)
        if (!block) continue
        items[key] = {
          status: 'normal',
          selectedNormals: block.findings.filter(f => f.normal).map(f => f.key),
          selectedAbnormals: [],
          specifyDetails: {},
          findings: '',
        }
      }
      const nextPeState: PEState = {
        categoryLetter: 'A',
        laterality: 'right',
        spineRegion: 'lumbar',
        items,
        vitals: {},
        additional: '',
        mode: 'template',
        blockKeys: template.peBlockKeys,
      }
      setSelectedBlockKeys(template.peBlockKeys)
      setPeState(nextPeState)
      // Desktop center no longer mounts PhysicalExam, so derive peNote here (mobile
      // still emits via its mounted PE — same generatePEText, so outputs match).
      setPeNote(generatePEText(nextPeState))
    } else {
      setSelectedBlockKeys([])
      setPeState(null)
      setPeNote(expandTemplateText(template.peText, template.peExpanderAbbrs, template.peExpanderAbbr, expanders))
    }
    setPeResetKey(k => k + 1)

    setAssessmentNote(expandTemplateText(template.assessmentText, template.assessmentExpanderAbbrs, template.assessmentExpanderAbbr, expanders))

    let planText = expandTemplateText(template.planText, template.planExpanderAbbrs, template.planExpanderAbbr, expanders)
    if (!planText && template.planOrderSetId) {
      const orderSet = (profile.planOrderSets ?? []).find(os => os.id === template.planOrderSetId)
      if (orderSet) planText = generatePlanFromOrderSet(orderSet)
    }
    setPlanNote(planText)
    // Seed the lifted plan state so the desktop center reflects the applied text
    // (mobile still re-parses planNote on its own mount — same parser).
    setPlanState(planText ? parsePlanState(planText, planOrderTags, planInstructionTags) : null)
    setPlanResetKey(k => k + 1)
  }, [profile.textExpanders, profile.planOrderSets, expandTemplateText, generatePlanFromOrderSet, planOrderTags, planInstructionTags])

  // ── Import decode logic ────────────────────────────────────────────────────

  const handleProviderDecoded = useCallback(({ payload }: { payload: string; encodedText: string }) => {
    try {
      const parsed = parseNoteEncoding(payload)
      if (!parsed) return

      if (parsed.symptomCode === 'PRV') {
        if (parsed.providerHpi) setHpiNote(parsed.providerHpi)
        if (parsed.providerPe) setPeNote(parsed.providerPe)
        if (parsed.providerPeRaw) {
          const restored = decodePEState(parsed.providerPeRaw, 'PRV')
          if (restored) setPeState(restored)
        }
        setPeResetKey(k => k + 1)
        if (parsed.providerAssessment) setAssessmentNote(parsed.providerAssessment)
        if (parsed.providerPlan) {
          setPlanNote(parsed.providerPlan)
          setPlanState(parsePlanState(parsed.providerPlan, planOrderTags, planInstructionTags))
        }
        setImportedMedicNote(null)
        setMedicBarcode('')
        setImportExpanded(false)
        return
      }

      if (parsed.providerHpi || parsed.providerPe || parsed.providerAssessment || parsed.providerPlan) {
        if (parsed.providerHpi) setHpiNote(parsed.providerHpi)
        if (parsed.providerPe) setPeNote(parsed.providerPe)
        if (parsed.providerPeRaw) {
          const restored = decodePEState(parsed.providerPeRaw, parsed.symptomCode)
          if (restored) setPeState(restored)
        }
        setPeResetKey(k => k + 1)
        if (parsed.providerAssessment) setAssessmentNote(parsed.providerAssessment)
        if (parsed.providerPlan) {
          setPlanNote(parsed.providerPlan)
          setPlanState(parsePlanState(parsed.providerPlan, planOrderTags, planInstructionTags))
        }
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
            { includeAlgorithm: parsed.flags.includeAlgorithm, customNote: '', physicalExamNote: '', planNote: '' },
            algorithmOptions, cardStates, disposition?.type ?? '', disposition?.text ?? '', selectedSymptom,
          )
          const parts: string[] = []
          if (assembled.sections.algorithm) parts.push(assembled.sections.algorithm)
          if (assembled.sections.differentials) parts.push(assembled.sections.differentials)
          assessmentText = parts.join('\n\n')
        }
      }
      setImportedMedicNote({
        medicHpi: parsed.hpiText || '', medicPe: parsed.peText || '',
        medicAssessment: assessmentText, medicPlan: parsed.planText || '',
        medicName: authorLabel, medicSignature: authorLabel,
      })
      setMedicBarcode(payload)
      setImportExpanded(false)
    } catch { /* error surfaced by hook */ }
  }, [planOrderTags, planInstructionTags])

  const barcodeImport = useBarcodeImport({ onDecoded: handleProviderDecoded })

  // Collapse import bar when popover takes over (scan/staged image)
  useEffect(() => {
    if (barcodeImport.stagedImage || barcodeImport.scanRequested) {
      setImportExpanded(false)
    }
  }, [barcodeImport.stagedImage, barcodeImport.scanRequested])

  const handleExpandImport = useCallback(() => {
    setImportExpanded(true)
  }, [])

  const handleCollapseImport = useCallback(() => {
    setImportExpanded(false)
    barcodeImport.reset()
  }, [barcodeImport.reset])

  // ── Slide Animation (mobile output view-swap) ──────────────────────────────

  const handleSlideAnimation = useCallback((direction: 'left' | 'right') => {
    setSlideDirection(direction)
    setTimeout(() => setSlideDirection(''), UI_TIMING.SLIDE_ANIMATION)
  }, [])

  // ── Navigation ──────────────────────────────────────────────────────────────

  // Output: desktop → right pane (Case C); mobile → center view-swap.
  const goToOutput = useCallback(() => {
    if (isMobile) {
      handleSlideAnimation('left')
      setView('output')
    } else {
      setPaneScreen({ key: 'output' })
    }
  }, [isMobile, handleSlideAnimation])

  const handleBack = useCallback(() => {
    if (view === 'output') {
      handleSlideAnimation('right')
      setView('note')
    }
  }, [view, handleSlideAnimation])

  // Desktop: open a section editor in the pane (Case B).
  const openSection = useCallback((s: ProviderSection) => {
    setPaneScreen({ key: `s-${s}` })
  }, [])

  // Desktop: New template → pane editor (Case A). Mobile: New → lifted popover.
  const handleNewTemplate = useCallback((anchor: DOMRect) => {
    setTemplateEditState({ mode: 'new', anchor })
    if (!isMobile) setPaneScreen({ key: 'editor' })
  }, [isMobile])

  const handleClose = useCallback(() => {
    setView('note')
    setSlideDirection('')
    setSelectedTemplateId(null)
    setTemplateSearch('')
    setPaneScreen(null)
    setTemplateEditState(null)
    setHpiNote('')
    setPeNote('')
    setPeState(null)
    setSelectedBlockKeys([])
    setPeResetKey(k => k + 1)
    setPlanResetKey(k => k + 1)
    setAssessmentNote('')
    setPlanNote('')
    setPlanState(null)
    setImportedMedicNote(null)
    setMedicBarcode('')
    setImportExpanded(false)
    barcodeImport.reset()
    onClose()
  }, [onClose, barcodeImport.reset])

  // ── Swipe Back (mobile output) ──────────────────────────────────────────────

  const canSwipeBack = view === 'output'
  const swipeHandlers = useSwipeBack(
    useMemo(() => {
      if (canSwipeBack) return handleBack
      return undefined
    }, [canSwipeBack, handleBack]),
    canSwipeBack,
  )

  // No auto-focus on expand — iOS keyboard open shifts the viewport

  // ── Right-pane stack (desktop): detail · template editor · sections · output ─
  // No onDelete → the editor hides its footer Delete; deletion lives on the template
  // tree's ellipsis (desktop rail + mobile Sheet) via handleTemplateDelete.
  const { screens: templateEditorScreens } = useProviderTemplateEditorScreens({
    state: templateEditState,
    onSave: handleTemplateSave,
  })

  // PE pane screens (desktop): s-pe (select systems + drill rows) → s-pe-block
  // (per-system findings). Drives the lifted peState + keeps peNote synced.
  const { screens: pePaneScreens, reorder: reorderPe } = usePEPaneScreens({
    peState,
    selectedBlockKeys,
    onPeStateChange: setPeState,
    onBlockKeysChange: setSelectedBlockKeys,
    onPeNoteChange: setPeNote,
    onClose: closePane,
  })

  // PE section for the desktop center (MAIN pane) — movable cards once systems are
  // selected; tap a card → findings in the right pane; dashed + → the selector.
  const peCenter = (
    <PECenter
      selectedBlockKeys={selectedBlockKeys}
      items={peState?.items ?? {}}
      onOpenSelector={() => setPaneScreen({ key: 's-pe' })}
      onOpenBlock={(blockKey) => setPaneScreen({ key: 's-pe-block', params: { blockKey } })}
      onReorder={reorderPe}
    />
  )

  // Plan pane screen (desktop): a single s-plan editor modeled on order-set creation
  // (order-set chips + Selected list + search + all-category picker). Drives the
  // lifted planState + keeps planNote synced. The center is a plain summary (below).
  const { screens: planPaneScreens } = usePlanPaneScreens({
    planState,
    orderTags: planOrderTags,
    instructionTags: planInstructionTags,
    orderSets: planOrderSets,
    onPlanStateChange: setPlanState,
    onPlanNoteChange: setPlanNote,
    onClose: closePane,
  })

  // Section-editor submit — a Check that rides the pane header beside Close (the
  // calendar edit-event pattern). Edits bind live, so "Done" just closes the pane.
  const doneHeaderAction = (
    <PillButton icon={Check} iconSize={18} accent="success" onClick={closePane} label="Done" />
  )

  const paneScreens: Record<string, StackScreen> = {
    ...templateEditorScreens,
    ...pePaneScreens,
    ...planPaneScreens,
    detail: {
      title: selectedTemplate?.name ?? 'Template',
      // Bare PillButton — the pane chrome supplies the shared HeaderPill (Edit + Close).
      headerActions: (_p: unknown, nav: StackNav) => selectedTemplate ? (
        <PillButton
          icon={Pencil}
          iconSize={16}
          label="Edit"
          onClick={() => { handleTemplateEdit(selectedTemplate, new DOMRect()); nav.push('editor') }}
        />
      ) : null,
      rightFooter: selectedTemplate ? (
        <FooterPill side="right">
          <ActionButton
            icon={Check}
            label="Apply"
            variant="confirm"
            onClick={() => { handleApplyTemplate(selectedTemplate); setSelectedTemplateId(null); closePane() }}
          />
        </FooterPill>
      ) : undefined,
      render: () => selectedTemplate
        ? <TemplateDetailBody template={selectedTemplate} expanders={profile.textExpanders ?? []} orderSets={profile.planOrderSets} />
        : null,
    },
    's-hpi': {
      title: 'History of Present Illness',
      headerActions: doneHeaderAction,
      render: () => <TextSectionEditor value={hpiNote} onChange={setHpiNote} placeholder="Chief complaint, onset, duration, character, associated symptoms..." />,
    },
    's-assessment': {
      title: 'Assessment',
      headerActions: doneHeaderAction,
      render: () => <TextSectionEditor value={assessmentNote} onChange={setAssessmentNote} placeholder="Clinical assessment, diagnosis, differential..." />,
    },
    output: {
      title: 'Note Output',
      render: () => (
        <ProviderNoteOutput
          hpiNote={hpiNote}
          peNote={peNote}
          peState={peState}
          assessmentNote={assessmentNote}
          planNote={planNote}
          importedMedicNote={importedMedicNote}
          medicBarcode={medicBarcode}
        />
      ),
    },
  }

  const paneStack = useStack({
    isOpen: paneOpen,
    initial: paneScreen ?? { key: 'detail' },
    screens: paneScreens,
  })

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
          value={barcodeImport.importText}
          onChange={barcodeImport.setImportText}
          onSubmit={barcodeImport.handleSubmit}
          onClose={handleCollapseImport}
          onScan={barcodeImport.handleScan}
          onImage={barcodeImport.stageImage}
          inputRef={importInputRef}
          isDecodingImage={barcodeImport.isDecodingImage}
          hasStaged={!!barcodeImport.stagedImage}
        />
      </div>
    </div>
  )

  // ── Header config ─────────────────────────────────────────────────────────

  const headerConfig = useMemo(() => {
    if (isMobile && view === 'output') {
      return { title: 'Note Output', showBack: true, onBack: handleBack }
    }
    if (isMobile) {
      if (importExpanded) {
        return {
          title: '',
          rightContentFill: true,
          hideDefaultClose: true,
          rightContent: (
            <ImportInputBar
              value={barcodeImport.importText}
              onChange={barcodeImport.setImportText}
              onSubmit={barcodeImport.handleSubmit}
              onClose={handleCollapseImport}
              onScan={barcodeImport.handleScan}
              onSerialScan={barcodeImport.handleSerialScan}
              isSerialSupported={barcodeImport.isSerialSupported}
              onImage={barcodeImport.stageImage}
              inputRef={importInputRef}
              isDecodingImage={barcodeImport.isDecodingImage}
              hasStaged={!!barcodeImport.stagedImage}
              className="w-full animate-expandSearch"
            />
          ),
        }
      }
      return {
        title: 'Provider',
        leftContent: (
          <HeaderPill>
            <PillButton icon={LayoutTemplate} iconSize={20} onClick={() => setTemplateDrawerOpen(true)} label="Templates" />
          </HeaderPill>
        ),
        rightContent: (
          <HeaderPill>
            <PillButton icon={ScanLine} iconSize={20} onClick={handleExpandImport} label="Import Medic Note" />
            <PillButton icon={X} onClick={handleClose} label="Close" />
          </HeaderPill>
        ),
        hideDefaultClose: true,
      }
    }
    return {
      title: 'Provider',
      rightContent: desktopHeaderRight,
      hideDefaultClose: true,
      rightContentFill: importExpanded,
    }
  }, [view, handleBack, isMobile, importExpanded, desktopHeaderRight, handleClose,
      handleExpandImport, handleCollapseImport, barcodeImport.importText,
      barcodeImport.setImportText, barcodeImport.handleSubmit, barcodeImport.handleScan,
      barcodeImport.handleSerialScan, barcodeImport.isSerialSupported,
      barcodeImport.stageImage, barcodeImport.isDecodingImage, barcodeImport.stagedImage])

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <BaseDrawer
      isVisible={isVisible}
      onClose={handleClose}
      fullHeight="90dvh"
      desktopPosition="left"
      desktopWidth="w-[90%]"
      header={headerConfig}
      scrollDisabled
      glassHeader={isMobile}
    >
      <div className="relative h-full">
        {!isMobile ? (
          <div className="flex h-full">
            {/* Left rail — template search + tree. Collapses (slides out left) when
                the right pane opens (rail-collapse 3-pane primitive). */}
            <SlideRevealPane
              open={!paneOpen}
              side="left"
              width={260}
              keepMounted
              className="border-r border-tertiary/10 bg-themewhite"
            >
              <div className="shrink-0 px-3 pt-2 pb-1 flex items-center gap-2">
                <SearchInput
                  value={templateSearch}
                  onChange={setTemplateSearch}
                  placeholder="Search templates"
                  className="flex-1 min-w-0"
                />
                <ProviderTemplateMenu
                  templates={templates}
                  orderSets={orderSetsForExport}
                  onNew={handleNewTemplate}
                  variant="gear"
                />
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto">
                <ProviderTemplateTree
                  templates={templates}
                  searchQuery={templateSearch}
                  activeTemplateId={selectedTemplateId}
                  onSelect={handleApplyTemplate}
                  onView={(t) => { setSelectedTemplateId(t.id); setPaneScreen({ key: 'detail' }) }}
                  onEdit={(t) => { handleTemplateEdit(t, new DOMRect()); setPaneScreen({ key: 'editor' }) }}
                  onDelete={(t) => handleTemplateDelete(t.id)}
                  hoverActions
                />
              </div>
            </SlideRevealPane>

            {/* Center — note summary (editing routes into the right pane) */}
            <div className="relative flex-1 min-w-0 flex flex-col min-h-0">
              <div className="flex-1 min-h-0 overflow-y-auto">
                <ContentWrapper slideDirection="" swipeHandlers={undefined}>
                  {barcodeImport.error && (
                    <div className="px-4 pt-2">
                      <div className="text-[10pt] text-themeredred">{barcodeImport.error}</div>
                    </div>
                  )}
                  <div className="p-5 pb-24">
                    <ProviderNote
                      summaryMode
                      onOpenSection={openSection}
                      peCenter={peCenter}
                      hpiNote={hpiNote}
                      setHpiNote={setHpiNote}
                      peNote={peNote}
                      setPeNote={setPeNote}
                      peState={peState}
                      onPeStateChange={setPeState}
                      peResetKey={peResetKey}
                      planResetKey={planResetKey}
                      selectedBlockKeys={selectedBlockKeys}
                      onBlockKeysChange={setSelectedBlockKeys}
                      assessmentNote={assessmentNote}
                      setAssessmentNote={setAssessmentNote}
                      planNote={planNote}
                      setPlanNote={setPlanNote}
                      importedMedicNote={importedMedicNote}
                    />
                  </div>
                </ContentWrapper>
              </div>
              {/* Next → note output (right pane). The canonical bottom-right add FAB
                  (Property/Calendar), with the glyph swapped to a forward chevron. */}
              <div className="absolute bottom-4 right-4 z-30 pb-[max(0rem,var(--sab,0px))] pointer-events-none">
                <AddFab icon={ChevronRight} label="Next" onClick={goToOutput} />
              </div>
            </div>

            {/* Right pane — detail / template editor / section editor / output;
                slides in from the right as the rail collapses. */}
            <SlideRevealPane
              open={paneOpen}
              side="right"
              width={380}
              className="border-l border-primary/10 bg-themewhite"
            >
              {paneOpen && paneStack.hasScreen && (
                <>
                  <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-tertiary/10">
                    {paneStack.canBack && (
                      <button
                        onClick={paneStack.onBack}
                        aria-label="Back"
                        className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all"
                      >
                        <ChevronLeft size={18} />
                      </button>
                    )}
                    {paneStack.headerLeft}
                    <p className="flex-1 min-w-0 text-sm font-semibold text-primary truncate">{paneStack.title}</p>
                    {/* Edit-overlay header (calendar edit-event pattern): a screen's
                        submit/action pill joins Close in one HeaderPill. */}
                    <HeaderPill>
                      {paneStack.headerActions}
                      <PillButton icon={X} iconSize={18} onClick={closePane} label="Close" />
                    </HeaderPill>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 py-4">
                    {paneStack.body('')}
                  </div>
                  {(paneStack.footer || paneStack.rightFooter) && (
                    <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-3 border-t border-tertiary/10">
                      <div className="flex items-center gap-2">{paneStack.footer}</div>
                      <div className="flex items-center gap-2">{paneStack.rightFooter}</div>
                    </div>
                  )}
                </>
              )}
            </SlideRevealPane>
          </div>
        ) : (
            <ContentWrapper
              slideDirection={slideDirection}
              swipeHandlers={canSwipeBack ? swipeHandlers : undefined}
              scrollable
              scrollResetKey={view}
            >
              <div className="pt-[calc(var(--drawer-header-h,3.5rem)+0.75rem)]">
              {barcodeImport.error && (
                <div className="px-4 pt-2">
                  <div className="text-[10pt] text-themeredred">{barcodeImport.error}</div>
                </div>
              )}
              <div className="px-5 pb-24">
                {view === 'note' ? (
                <ProviderNote
                  hpiNote={hpiNote}
                  setHpiNote={setHpiNote}
                  peNote={peNote}
                  setPeNote={setPeNote}
                  peState={peState}
                  onPeStateChange={setPeState}
                  peResetKey={peResetKey}
                  planResetKey={planResetKey}
                  selectedBlockKeys={selectedBlockKeys}
                  onBlockKeysChange={setSelectedBlockKeys}
                  assessmentNote={assessmentNote}
                  setAssessmentNote={setAssessmentNote}
                  planNote={planNote}
                  setPlanNote={setPlanNote}
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
        )}

        {/* Mobile Next → note output. Same canonical add FAB (forward chevron),
            floating bottom-right over the note view only. */}
        {isMobile && view === 'note' && (
          <div className="absolute bottom-4 right-4 z-30 pb-[max(0rem,var(--sab,0px))] pointer-events-none">
            <AddFab icon={ChevronRight} label="Next" onClick={goToOutput} />
          </div>
        )}

        {/* Import popover for scan + staged image preview */}
        <ImportResultPopover
          preview={null}
          stagedImage={barcodeImport.stagedImage}
          isScanning={barcodeImport.isScanning}
          scanRequested={barcodeImport.scanRequested}
          videoRef={barcodeImport.videoRef}
          isDecodingImage={barcodeImport.isDecodingImage}
          anchorRect={null}
          onConfirmImage={barcodeImport.confirmStagedImage}
          onDismissImage={barcodeImport.clearStagedImage}
          onStopScan={barcodeImport.handleStopScan}
          onClose={barcodeImport.reset}
          isMobile={isMobile}
        />

        {/* Mobile template picker — Sheet (not a nested BaseDrawer, which
            would be trapped under this drawer's glass header) */}
        {isMobile && (
          <Sheet
            isOpen={templateDrawerOpen}
            onClose={() => setTemplateDrawerOpen(false)}
            title="Templates"
            height="fit"
            maxHeight={60}
            // Opens nested over this BaseDrawer (~z-1010); fit's default
            // Z.SHEET(50) would trap it underneath.
            zIndex={1200}
            leftContent={
              <ProviderTemplateMenu
                templates={templates}
                orderSets={orderSetsForExport}
                onNew={handleNewTemplate}
                variant="ellipsis"
              />
            }
          >
            <div className="px-3 pt-1 pb-2">
              <SearchInput
                value={templateSearch}
                onChange={setTemplateSearch}
                placeholder="Search templates"
                className="w-full"
              />
            </div>
            <ProviderTemplateTree
              templates={templates}
              searchQuery={templateSearch}
              onSelect={(t) => { handleApplyTemplate(t); setTemplateDrawerOpen(false) }}
              onEdit={handleTemplateEdit}
              onDelete={(t) => handleTemplateDelete(t.id)}
              hoverActions={false}
            />
          </Sheet>
        )}

        {/* Mobile only: the lifted editor popover. On desktop the same editor
            (useProviderTemplateEditorScreens) mounts in the right pane instead. */}
        {isMobile && (
          <ProviderTemplateEditPopover
            state={templateEditState}
            onClose={() => setTemplateEditState(null)}
            onSave={handleTemplateSave}
            // No onDelete → no footer Delete; the template Sheet's tree ellipsis deletes.
            // The editor opens while the Templates Sheet (z-[1200]) is still
            // mounted, so it must sit above the sheet.
            zIndex={1300}
          />
        )}
      </div>
    </BaseDrawer>
  )
}
