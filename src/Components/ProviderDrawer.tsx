import { useState, useCallback, useMemo } from 'react'
import { X, ScanLine, FileText } from 'lucide-react'
import { BaseDrawer } from './BaseDrawer'
import { ContentWrapper } from './Settings/ContentWrapper'
import { HeaderPill, PillButton } from './HeaderPill'
import { useSwipeBack } from '../Hooks/useSwipeBack'
import { useIsMobile } from '../Hooks/useIsMobile'
import { UI_TIMING } from '../Utilities/constants'
import { ProviderNote } from './Provider/ProviderNote'
import { ProviderNoteOutput } from './Provider/ProviderNoteOutput'
import { ProviderImport } from './Provider/ProviderImport'

// ─── Types ────────────────────────────────────────────────────────────────────

type ProviderView =
  | { screen: 'note' }
  | { screen: 'import' }
  | { screen: 'output'; from: 'note' | 'import' }

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
  const [view, setView] = useState<ProviderView>({ screen: 'note' })
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | ''>('')

  const [hpiNote, setHpiNote] = useState('')
  const [peNote, setPeNote] = useState('')
  const [assessmentNote, setAssessmentNote] = useState('')
  const [planNote, setPlanNote] = useState('')
  const [importedMedicNote, setImportedMedicNote] = useState<ImportedMedicNote | null>(null)

  const isMobile = useIsMobile()

  // ── Slide Animation ─────────────────────────────────────────────────────────

  const handleSlideAnimation = useCallback((direction: 'left' | 'right') => {
    setSlideDirection(direction)
    setTimeout(() => setSlideDirection(''), UI_TIMING.SLIDE_ANIMATION)
  }, [])

  // ── Navigation ──────────────────────────────────────────────────────────────

  const handleGoToImport = useCallback(() => {
    handleSlideAnimation('left')
    setView({ screen: 'import' })
  }, [handleSlideAnimation])

  const handleGoToNote = useCallback(() => {
    handleSlideAnimation('right')
    setView({ screen: 'note' })
  }, [handleSlideAnimation])

  const handleGoToOutput = useCallback((from: 'note' | 'import') => {
    handleSlideAnimation('left')
    setView({ screen: 'output', from })
  }, [handleSlideAnimation])

  const handleBack = useCallback(() => {
    if (view.screen === 'output') {
      handleSlideAnimation('right')
      setView({ screen: view.from })
    } else if (view.screen === 'import') {
      handleGoToNote()
    }
  }, [view, handleSlideAnimation, handleGoToNote])

  const handleClose = useCallback(() => {
    setView({ screen: 'note' })
    setSlideDirection('')
    setHpiNote('')
    setPeNote('')
    setAssessmentNote('')
    setPlanNote('')
    setImportedMedicNote(null)
    onClose()
  }, [onClose])

  // ── Swipe Back ──────────────────────────────────────────────────────────────

  const canSwipeBack = view.screen !== 'note'
  const swipeHandlers = useSwipeBack(
    useMemo(() => {
      if (canSwipeBack) return handleBack
      return undefined
    }, [canSwipeBack, handleBack]),
    canSwipeBack,
  )

  // ── Header Config ───────────────────────────────────────────────────────────

  const headerConfig = useMemo(() => {
    switch (view.screen) {
      case 'note':
        return {
          title: 'Provider',
          badge: 'BETA',
          rightContent: (
            <HeaderPill>
              <PillButton icon={ScanLine} iconSize={20} onClick={handleGoToImport} label="Import Medic Note" />
              <PillButton icon={X} onClick={handleClose} label="Close" />
            </HeaderPill>
          ),
          hideDefaultClose: true,
        }
      case 'import':
        return {
          title: 'Import Note',
          badge: 'BETA',
          showBack: true,
          onBack: handleGoToNote,
          rightContent: (
            <HeaderPill>
              <PillButton icon={FileText} iconSize={20} onClick={handleGoToNote} label="New Note" />
              <PillButton icon={X} onClick={handleClose} label="Close" />
            </HeaderPill>
          ),
          hideDefaultClose: true,
        }
      case 'output':
        return {
          title: 'Note Output',
          badge: 'BETA',
          showBack: true,
          onBack: handleBack,
        }
    }
  }, [view, handleGoToImport, handleGoToNote, handleBack, handleClose])

  // ── Content ─────────────────────────────────────────────────────────────────

  const subViewWrapper = (children: React.ReactNode) => (
    <div className="h-full overflow-y-auto">
      <div className="px-4 py-3 md:p-5 pb-8 min-h-full">
        {children}
      </div>
    </div>
  )

  const renderContent = () => {
    switch (view.screen) {
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
            onNext={() => handleGoToOutput('note')}
          />
        )
      case 'import':
        return subViewWrapper(
          <ProviderImport
            hpiNote={hpiNote}
            setHpiNote={setHpiNote}
            peNote={peNote}
            setPeNote={setPeNote}
            assessmentNote={assessmentNote}
            setAssessmentNote={setAssessmentNote}
            planNote={planNote}
            setPlanNote={setPlanNote}
            onNext={() => handleGoToOutput('import')}
            onMedicNoteImported={setImportedMedicNote}
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
          {renderContent()}
        </div>
      </ContentWrapper>
    </BaseDrawer>
  )
}
