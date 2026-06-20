import { memo, useState, useCallback } from 'react'
import { ChevronRight, FileText, Crosshair } from 'lucide-react'
import { animated } from '@react-spring/web'
import { useTC3Store } from '../../stores/useTC3Store'
import { TC3_WIZARD_PAGES } from '../../Types/TC3Types'
import { useColumnCarousel } from '../../Hooks/useColumnCarousel'
import { SectionHeader } from '../Section'
import { CasualtyInfoForm } from './CasualtyInfoForm'
import { MechanismForm } from './MechanismForm'
import { BodyDiagram } from './BodyDiagram'
import { VitalsForm } from './VitalsForm'
import { MARCHForm } from './MARCHForm'
import { NotesPanel } from './NotesPanel'
import { getRegionLabel, summarizeMarker } from '../../Utilities/bodyRegionMap'
import { TQAlertBanner } from './TQAlertBanner'

const PAGES = TC3_WIZARD_PAGES

interface TC3MobileWizardProps {
  /** Drive left-Pane (menu) slide during a right drag from page 0. */
  onEdgeDrag?: (offset: number) => void
  onEdgeDragEnd?: (offset: number, velocity: number) => void
  /** Drive messages slide during a leftward drag from the right edge. */
  onRightEdgeDrag?: (offset: number) => void
  onRightEdgeDragEnd?: (offset: number, velocity: number) => void
}

/**
 * Full-screen mobile wizard for the TC3 card.
 * 2 pages: front-of-card (all casualty/injury sections) and back-of-card (interventions/notes/export).
 *
 * Uses the same useColumnCarousel hook as ColumnA so TC3 mobile gets parity gestures:
 * swipe between pages, left-edge swipe → left Pane (menu), right-edge swipe → messages.
 */
export const TC3MobileWizard = memo(function TC3MobileWizard({
  onEdgeDrag,
  onEdgeDragEnd,
  onRightEdgeDrag,
  onRightEdgeDragEnd,
}: TC3MobileWizardProps) {
  const wizardStep = useTC3Store((s) => s.wizardStep)
  const setWizardStep = useTC3Store((s) => s.setWizardStep)
  const card = useTC3Store((s) => s.card)
  const openExport = useTC3Store((s) => s.openExport)

  const hasData =
    card.markers.length > 0 ||
    card.medications.length > 0 ||
    card.vitals.length > 0 ||
    card.mechanism.types.length > 0 ||
    !!card.casualty.lastName ||
    !!card.casualty.firstName ||
    !!card.notes

  const [editingMarker, setEditingMarker] = useState<string | null>(null)

  const panelCount = PAGES.length
  const isLastStep = wizardStep === panelCount - 1

  const handleSwipeBack = useCallback(() => {
    setWizardStep(Math.max(0, wizardStep - 1))
  }, [wizardStep, setWizardStep])

  const handleSwipeForward = useCallback(() => {
    setWizardStep(Math.min(panelCount - 1, wizardStep + 1))
  }, [wizardStep, panelCount, setWizardStep])

  const carousel = useColumnCarousel({
    enabled: true,
    panelIndex: Math.min(wizardStep, panelCount - 1),
    panelCount,
    isVisible: true,
    onSwipeBack: handleSwipeBack,
    onSwipeForward: handleSwipeForward,
    onEdgeDrag,
    onEdgeDragEnd,
    onRightEdgeDrag,
    onRightEdgeDragEnd,
  })

  const handleNext = useCallback(() => {
    if (wizardStep < panelCount - 1) {
      setWizardStep(wizardStep + 1)
    }
  }, [wizardStep, panelCount, setWizardStep])

  const markerCount = card.markers.length
  const panelWidth = `${100 / panelCount}%`

  return (
    <div
      className="h-full flex flex-col bg-themewhite"
      style={{ paddingTop: 'calc(var(--sat, 0px) + 3.75rem)' }}
    >
      <TQAlertBanner />

      {/* Page carousel — both pages mounted side by side to preserve scroll/refs */}
      <animated.div
        className="flex-1 min-h-0 overflow-hidden relative"
        style={{ touchAction: 'pan-y' }}
        {...carousel.dragHandlers}
      >
        <div
          ref={carousel.containerRef}
          className="flex h-full"
          style={{ width: `${panelCount * 100}%` }}
        >
          {/* ── Page 0: Front of card ── */}
          <div className="h-full overflow-y-auto" style={{ flex: `0 0 ${panelWidth}` }}>
            <div className="px-4 py-4 min-h-full space-y-6">
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
                      const typeLabel = summarizeMarker(m)
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
            </div>
          </div>

          {/* ── Page 1: Back of card ── */}
          <div className="h-full overflow-y-auto" style={{ flex: `0 0 ${panelWidth}` }}>
            <div className="px-4 py-4 min-h-full space-y-6">
              <MARCHForm />
              <NotesPanel />
            </div>
          </div>
        </div>
      </animated.div>

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

    </div>
  )
})
