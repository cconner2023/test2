import { memo, useState, useRef, useEffect, useCallback } from 'react'
import { ChevronRight, FileText, Crosshair, Trash2 } from 'lucide-react'
import { useTC3Store } from '../../stores/useTC3Store'
import { TC3_WIZARD_PAGES } from '../../Types/TC3Types'
import { ContentWrapper } from '../ContentWrapper'
import { PreviewOverlay } from '../PreviewOverlay'
import { TC3CardToolbar } from './TC3CardModePicker'
import { SectionHeader } from '../Section'
import { CasualtyInfoForm } from './CasualtyInfoForm'
import { MechanismForm } from './MechanismForm'
import { BodyDiagram } from './BodyDiagram'
import { VitalsForm } from './VitalsForm'
import { MARCHForm } from './MARCHForm'
import { NotesPanel } from './NotesPanel'
import { CasualtyQueue } from './CasualtyQueue'
import { getRegionLabel } from '../../Utilities/bodyRegionMap'
import { TQAlertBanner } from './TQAlertBanner'

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
  const casualtyQueue = useTC3Store((s) => s.casualtyQueue)

  const hasData =
    card.markers.length > 0 ||
    card.medications.length > 0 ||
    card.vitals.length > 0 ||
    card.mechanism.types.length > 0 ||
    !!card.casualty.lastName ||
    !!card.casualty.firstName ||
    !!card.notes

  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | ''>('')
  const [queueOpen, setQueueOpen] = useState(false)
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
      <TQAlertBanner />

      {/* Stable toolbar — outside sliding content to prevent duplication on swipe */}
      <div className="flex justify-end px-4 py-2 shrink-0">
        <TC3CardToolbar
          totalCount={casualtyQueue.length + 1}
          onOpenQueue={() => setQueueOpen(true)}
          onClearCard={() => setShowConfirmReset(true)}
        />
      </div>

      {/* Page content */}
      <div className="flex-1 overflow-y-auto">
        <ContentWrapper slideDirection={slideDirection}>
          <div className="px-4 py-4 min-h-full space-y-6">

            {/* ── Page 0: Front of card ── */}
            {wizardStep === 0 && (
              <>
                <CasualtyInfoForm />
                <MechanismForm />
                <div data-tour="tc3-body-diagram">
                  <BodyDiagram
                    editingMarkerId={editingMarker}
                    onEditMarker={setEditingMarker}
                  />
                </div>

                {/* Marker list summary */}
                {markerCount > 0 && (
                  <div className="space-y-1.5">
                    <SectionHeader>Markers</SectionHeader>
                    <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden divide-y divide-tertiary/8">
                      {card.markers.map((m) => {
                        const typeLabel = m.injuries.length > 0
                          ? m.injuries.join(', ')
                          : m.procedures.length > 0
                            ? m.procedures.join(', ')
                            : 'Treatment'
                        const regionLabel = m.bodyRegion ? getRegionLabel(m.bodyRegion) : null

                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setEditingMarker(m.id)}
                            className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-themeblue2/5 active:scale-95 transition-all"
                          >
                            <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-tertiary/10">
                              <Crosshair size={18} className="text-tertiary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-primary">{typeLabel}</p>
                              {regionLabel && (
                                <p className="text-[9pt] text-secondary mt-0.5">{regionLabel}</p>
                              )}
                              {m.description && (
                                <p className="text-[9pt] text-tertiary mt-0.5 truncate">{m.description}</p>
                              )}
                            </div>
                            <ChevronRight size={16} className="text-tertiary shrink-0" />
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
              </>
            )}

          </div>
        </ContentWrapper>
      </div>

      {/* Footer */}
      <div
        className="shrink-0 px-4 pt-3 border-t border-tertiary/10"
        style={{ paddingBottom: 'max(1rem, calc(var(--sab, 0px) + 1rem))' }}
      >
        {isLastStep ? (
          hasData && (
            <button
              data-tour="tc3-export"
              type="button"
              onClick={() => openExport()}
              className="w-full rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden text-left active:scale-95 transition-all hover:bg-themeblue2/5"
            >
              <div className="flex items-center gap-3 px-4 py-3.5">
                <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-tertiary/10">
                  <FileText size={18} className="text-tertiary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-primary">Export Note & Barcode</p>
                  <p className="text-[9pt] text-secondary mt-0.5">Generate encoded card for transfer</p>
                </div>
                <ChevronRight size={16} className="text-tertiary shrink-0" />
              </div>
            </button>
          )
        ) : (
          <div className="flex items-center justify-end py-1">
            <button
              onClick={handleNext}
              className="w-11 h-11 rounded-full flex items-center justify-center bg-themeredred text-white active:scale-95 transition-all shadow-sm"
              aria-label="Next"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        )}
      </div>

      {/* MASCAL queue drawer */}
      <CasualtyQueue isOpen={queueOpen} onClose={() => setQueueOpen(false)} />

      {/* Clear card confirm */}
      <PreviewOverlay
        isOpen={showConfirmReset}
        onClose={() => setShowConfirmReset(false)}
        anchorRect={null}
        maxWidth={280}
        title="Clear card?"
        actions={[
          { key: 'clear', label: 'Clear card', icon: Trash2, onAction: handleReset, variant: 'danger' },
        ]}
      >
        <p className="px-4 pb-4 text-[10pt] text-secondary">Current entries will be lost.</p>
      </PreviewOverlay>
    </div>
  )
})
