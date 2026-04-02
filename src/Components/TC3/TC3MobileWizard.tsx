import { memo, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, FileText } from 'lucide-react'
import { useTC3Store } from '../../stores/useTC3Store'
import { TC3_WIZARD_PAGES } from '../../Types/TC3Types'
import { SlideWrapper, ProgressDots } from '../WriteNoteHelpers'
import { CasualtyInfoForm } from './CasualtyInfoForm'
import { MechanismForm } from './MechanismForm'
import { BodyDiagram } from './BodyDiagram'
import { VitalsForm } from './VitalsForm'
import { MARCHForm } from './MARCHForm'
import { NotesPanel } from './NotesPanel'
import { TC3WriteNote } from './TC3WriteNote'
import { OtherSectionMobile, FirstResponderMobile } from './TC3OtherMobile'

const PAGES = TC3_WIZARD_PAGES

/**
 * Full-screen mobile wizard for the TC3 card.
 * Mirrors the NoteWizard pattern: header with progress dots, slide transitions,
 * next/back navigation footer.
 */
export const TC3MobileWizard = memo(function TC3MobileWizard() {
  const wizardStep = useTC3Store((s) => s.wizardStep)
  const setWizardStep = useTC3Store((s) => s.setWizardStep)

  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | ''>('')
  const [showWriteNote, setShowWriteNote] = useState(false)

  const isLastStep = wizardStep === PAGES.length - 1

  const handleNext = useCallback(() => {
    if (wizardStep < PAGES.length - 1) {
      setSlideDirection('left')
      setWizardStep(wizardStep + 1)
    }
  }, [wizardStep, setWizardStep])

  const handleBack = useCallback(() => {
    if (wizardStep > 0) {
      setSlideDirection('right')
      setWizardStep(wizardStep - 1)
    }
  }, [wizardStep, setWizardStep])

  const currentPage = PAGES[wizardStep]

  return (
    <div
      className="h-full flex flex-col bg-themewhite"
      style={{ paddingTop: 'calc(var(--sat, 0px) + 3.75rem)' }}
    >
      {/* Header — TC3 red theme */}
      <div className="px-4 border-b border-themeredred/10 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {wizardStep > 0 && (
              <button
                onClick={handleBack}
                className="p-2 rounded-full hover:bg-themeredred/5 active:scale-95 transition-all"
                aria-label="Go back"
              >
                <ChevronLeft className="w-5 h-5 text-themeredred" />
              </button>
            )}
            <h2 className="text-sm font-semibold text-primary truncate">
              {currentPage?.label}
            </h2>
          </div>
        </div>
        <ProgressDots pages={PAGES} currentPage={wizardStep} colorClass="bg-themeredred" />
      </div>

      {/* Page content */}
      <div className="flex-1 overflow-y-auto">
        <SlideWrapper slideDirection={slideDirection}>
          <div className="px-4 py-4 min-h-full">
            {wizardStep === 0 && <CasualtyInfoForm />}
            {wizardStep === 1 && <MechanismForm />}
            {wizardStep === 2 && (
              <div className="space-y-4">
                <BodyDiagram />
              </div>
            )}
            {wizardStep === 3 && <VitalsForm />}
            {wizardStep === 4 && <MARCHForm />}
            {wizardStep === 5 && (
              <div className="space-y-6">
                <OtherSectionMobile />
                <NotesPanel />
                <FirstResponderMobile />
              </div>
            )}
          </div>
        </SlideWrapper>
      </div>

      {/* Footer — Next / Export button */}
      <div
        className="flex items-center justify-end px-6 pt-3 pb-4 shrink-0"
        style={{ paddingBottom: 'max(1.5rem, calc(var(--sab, 0px) + 1.5rem))' }}
      >
        {isLastStep ? (
          <button
            onClick={() => setShowWriteNote(true)}
            className="flex items-center gap-2 px-5 h-11 rounded-full bg-themeredred text-white active:scale-95 transition-all shadow-sm text-sm font-medium"
            aria-label="Export"
          >
            <FileText className="w-4 h-4" />
            Export
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="w-11 h-11 rounded-full flex items-center justify-center bg-themeredred text-white active:scale-95 transition-all shadow-sm"
            aria-label="Next"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Export drawer */}
      <TC3WriteNote
        isVisible={showWriteNote}
        onClose={() => setShowWriteNote(false)}
      />
    </div>
  )
})
