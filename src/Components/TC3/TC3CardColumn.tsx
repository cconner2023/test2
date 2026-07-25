import { memo, useState } from 'react'
import { ChevronRight, Crosshair, FileText } from 'lucide-react'
import { SectionHeader } from '@/Components/primitives/Section'
import { useTQAlerts } from '../../Hooks/useTQAlerts'
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
 *
 * SURFACE: themewhite3 — the drawer's own surface, matching the roster rail and
 * the detail pane either side of it. It is NOT a canvas-coloured full-bleed
 * center like the map drawers (Property / MapOverlay); TC3 has no canvas, so a
 * canvas colour here just read as a darker column between two lighter panes.
 *
 * HEADER CLEARANCE: on mobile TC3Drawer floats a glass header, so the clearance
 * lives INSIDE this column rather than on the host wrapper — content has to
 * scroll UNDER the frosted band or the glass has nothing to blur and degrades
 * to a static bar. The TQ banner is the one thing that must never sit under it
 * (a blurred casualty alert is useless), so when a banner is showing IT takes
 * the clearance and the scroller starts below it. `--drawer-header-h` is only
 * published while the header floats, so the `0px` fallback makes every one of
 * these a no-op on desktop.
 */
export const TC3CardColumn = memo(function TC3CardColumn() {
  const card = useTC3Store((s) => s.card)
  const openExport = useTC3Store((s) => s.openExport)
  const [editingMarker, setEditingMarker] = useState<string | null>(null)
  const { alerts } = useTQAlerts()
  const hasTQBanner = alerts.length > 0

  const markerCount = card.markers.length
  const hasData = isPopulated(card)

  return (
    <div
      className="h-full flex flex-col bg-themewhite3"
      style={hasTQBanner ? { paddingTop: 'var(--drawer-header-h, 0px)' } : undefined}
    >
      <TQAlertBanner alerts={alerts} />

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div
          className="mx-auto w-full max-w-2xl px-3 pb-4 space-y-6"
          style={{ paddingTop: hasTQBanner ? '1rem' : 'calc(var(--drawer-header-h, 0px) + 1rem)' }}
        >
          <CasualtyInfoForm />

          <MechanismForm />

          <div>
            <BodyDiagram editingMarkerId={editingMarker} onEditMarker={setEditingMarker} />
          </div>

          {/* Marker list summary */}
          {markerCount > 0 && (
            <div className="space-y-1.5">
              <SectionHeader>Markers</SectionHeader>
              <div className="rounded-2xl bg-themewhite2 overflow-hidden divide-y divide-tertiary/8">
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
              type="button"
              onClick={() => openExport()}
              className="w-full rounded-2xl bg-themewhite2 overflow-hidden text-left active:scale-95 transition-all hover:bg-themeblue2/5"
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
