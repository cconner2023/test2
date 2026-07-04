import { memo, useState } from 'react'
import { ChevronRight, Crosshair, FileText } from 'lucide-react'
import { SectionHeader } from '../Section'
import { useTC3Store } from '../../stores/useTC3Store'
import type { TC3Card } from '../../Types/TC3Types'
import { CasualtyInfoForm } from './CasualtyInfoForm'
import { MechanismForm } from './MechanismForm'
import { BodyDiagram } from './BodyDiagram'
import { VitalsForm } from './VitalsForm'
import { MARCHForm } from './MARCHForm'
import { NotesPanel } from './NotesPanel'
import { getRegionLabel, summarizeMarker } from '../../Utilities/bodyRegionMap'
import { TQAlertBanner } from './TQAlertBanner'

function isPopulated(card: TC3Card): boolean {
  return (
    card.markers.length > 0 ||
    card.medications.length > 0 ||
    card.vitals.length > 0 ||
    card.mechanism.types.length > 0 ||
    !!card.casualty.lastName ||
    !!card.casualty.firstName ||
    !!card.notes
  )
}

/**
 * The whole patient card as ONE scrollable column — the DD1380 front and back
 * merged (casualty · mechanism · body diagram · markers · vitals · MARCH · notes
 * · export). Replaces the old desktop 2-column grid and the mobile front/back
 * wizard carousel; used by TC3Drawer on both platforms. The TQ alert banner
 * stays pinned above the scroll; export is the final section.
 */
export const TC3CardColumn = memo(function TC3CardColumn() {
  const card = useTC3Store((s) => s.card)
  const openExport = useTC3Store((s) => s.openExport)
  const [editingMarker, setEditingMarker] = useState<string | null>(null)

  const markerCount = card.markers.length
  const hasData = isPopulated(card)

  return (
    <div className="h-full flex flex-col bg-themewhite">
      <TQAlertBanner />

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl px-3 py-4 space-y-6">
          <CasualtyInfoForm />

          <MechanismForm />

          <div data-tour="tc3-body-diagram">
            <BodyDiagram editingMarkerId={editingMarker} onEditMarker={setEditingMarker} />
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
                        {regionLabel && <p className="text-[9pt] text-secondary mt-0.5">{regionLabel}</p>}
                        {m.description && <p className="text-[9pt] text-tertiary mt-0.5 truncate">{m.description}</p>}
                      </div>
                      <ChevronRight size={16} className="text-tertiary shrink-0" />
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <VitalsForm />

          <MARCHForm />

          <NotesPanel />

          {/* Export — final section of the column */}
          {hasData && (
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
                  <p className="text-sm font-medium text-primary">Export Note &amp; Barcode</p>
                  <p className="text-[9pt] text-secondary mt-0.5">Generate encoded card for transfer</p>
                </div>
                <ChevronRight size={16} className="text-tertiary shrink-0" />
              </div>
            </button>
          )}
        </div>
      </div>
    </div>
  )
})
