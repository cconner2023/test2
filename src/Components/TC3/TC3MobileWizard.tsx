import { memo, useState, useRef, useEffect, useCallback } from 'react'
import { ChevronRight, FileText, RotateCcw } from 'lucide-react'
import { useTC3Store } from '../../stores/useTC3Store'
import { TC3_WIZARD_PAGES } from '../../Types/TC3Types'
import { ContentWrapper } from '../ContentWrapper'
import { ConfirmDialog } from '../ConfirmDialog'
import { CasualtyInfoForm } from './CasualtyInfoForm'
import { MechanismForm } from './MechanismForm'
import { BodyDiagram, INJURY_TYPE_COLOR } from './BodyDiagram'
import { VitalsForm } from './VitalsForm'
import { MARCHForm } from './MARCHForm'
import { NotesPanel } from './NotesPanel'
import { getRegionLabel } from '../../Utilities/bodyRegionMap'

const PAGES = TC3_WIZARD_PAGES

/**
 * Full-screen mobile wizard for the TC3 card.
 * 2 pages: front-of-card (all casualty/injury sections) and back-of-card (interventions/notes/export).
 */
export const TC3MobileWizard = memo(function TC3MobileWizard() {
  const wizardStep = useTC3Store((s) => s.wizardStep)
  const setWizardStep = useTC3Store((s) => s.setWizardStep)
  const card = useTC3Store((s) => s.card)
  const resetCard = useTC3Store((s) => s.resetCard)
  const openExport = useTC3Store((s) => s.openExport)

  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | ''>('')
  const [showConfirmReset, setShowConfirmReset] = useState(false)
  const [editingMarker, setEditingMarker] = useState<string | null>(null)
  const prevStepRef = useRef(wizardStep)

  const isLastStep = wizardStep === PAGES.length - 1

  // Drive slide direction from external or internal step changes
  useEffect(() => {
    if (wizardStep > prevStepRef.current) setSlideDirection('left')
    else if (wizardStep < prevStepRef.current) setSlideDirection('right')
    prevStepRef.current = wizardStep
  }, [wizardStep])

  const handleNext = useCallback(() => {
    if (wizardStep < PAGES.length - 1) {
      setWizardStep(wizardStep + 1)
    }
  }, [wizardStep, setWizardStep])

  const handleReset = () => {
    resetCard()
    setShowConfirmReset(false)
  }

  const markerCount = card.markers.length

  return (
    <div
      className="h-full flex flex-col bg-themewhite"
      style={{ paddingTop: 'calc(var(--sat, 0px) + 3.75rem)' }}
    >
      {/* Page content */}
      <div className="flex-1 overflow-y-auto">
        <ContentWrapper slideDirection={slideDirection}>
          <div className="px-4 py-4 min-h-full space-y-6">

            {/* ── Page 0: Front of card ── */}
            {wizardStep === 0 && (
              <>
                <CasualtyInfoForm />
                <MechanismForm />
                <BodyDiagram
                  editingMarkerId={editingMarker}
                  onEditMarker={setEditingMarker}
                />

                {/* Marker list summary */}
                {markerCount > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">
                      Markers ({markerCount})
                    </p>
                    <div className="rounded-2xl border border-tertiary/10 bg-themewhite2 overflow-hidden divide-y divide-tertiary/8">
                      {card.markers.map((m) => {
                        const primaryInjury = m.injuries[0]
                        const dotColor = primaryInjury
                          ? (INJURY_TYPE_COLOR[primaryInjury] ?? '#6b7280')
                          : m.procedures.length > 0 ? '#22c55e' : '#f59e0b'
                        const typeLabel = m.injuries.length > 0
                          ? m.injuries.join(', ')
                          : m.procedures.length > 0
                            ? m.procedures.join(', ')
                            : 'Treatment'
                        const regionLabel = m.bodyRegion ? getRegionLabel(m.bodyRegion) : null
                        const txCount = m.treatments.length

                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setEditingMarker(m.id)}
                            className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-tertiary/3 transition-colors"
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: dotColor }}
                            />
                            <span className="text-xs font-medium text-primary">{typeLabel}</span>
                            {regionLabel && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-themeredred/10 text-themeredred shrink-0">
                                {regionLabel}
                              </span>
                            )}
                            {m.description && (
                              <span className="text-[10px] text-tertiary/60 truncate min-w-0">{m.description}</span>
                            )}
                            <span className="flex-1" />
                            {txCount > 0 && (
                              <span className="text-[9px] text-themegreen font-medium shrink-0">{txCount} tx</span>
                            )}
                            <ChevronRight className="w-3.5 h-3.5 text-tertiary/30 shrink-0" />
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                <VitalsForm />
              </>
            )}

            {/* ── Page 1: Back of card ── */}
            {wizardStep === 1 && (
              <>
                <MARCHForm />
                <NotesPanel />

                {/* Export card */}
                <div
                  onClick={() => openExport()}
                  className="flex flex-col rounded-md w-full overflow-hidden shadow-sm bg-themewhite2 border border-themeredred/30 cursor-pointer active:scale-95 transition-all"
                >
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="px-3 py-2 shrink-0 rounded-md flex items-center justify-center bg-themeredred font-bold text-sm text-white">
                          TC3
                        </div>
                        <div className="min-w-0 flex-1 flex flex-col">
                          <p className="text-sm text-primary">Export Note & Barcode</p>
                          <p className="text-xs text-secondary mt-0.5">Generate encoded card for transfer</p>
                        </div>
                      </div>
                      <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-themeredred/60 hover:bg-themeredred/30 text-white">
                        <ChevronRight className="w-5 h-5" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Reset card */}
                <div className="pt-2 border-t border-tertiary/10">
                  <button
                    onClick={() => setShowConfirmReset(true)}
                    className="flex items-center gap-1.5 text-[11px] text-tertiary hover:text-themeredred transition-colors px-1 py-1"
                  >
                    <RotateCcw size={14} /> <span>New Card</span>
                  </button>
                </div>
              </>
            )}

          </div>
        </ContentWrapper>
      </div>

      {/* Footer — Next / Export button */}
      <div
        className="flex items-center justify-end px-6 pt-3 pb-4 shrink-0"
        style={{ paddingBottom: 'max(1.5rem, calc(var(--sab, 0px) + 1.5rem))' }}
      >
        {isLastStep ? (
          <button
            onClick={() => openExport()}
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

      {/* Dialogs */}
      <ConfirmDialog
        visible={showConfirmReset}
        title="Clear card? Current entries will be lost."
        confirmLabel="Clear"
        variant="danger"
        onConfirm={handleReset}
        onCancel={() => setShowConfirmReset(false)}
      />
    </div>
  )
})
