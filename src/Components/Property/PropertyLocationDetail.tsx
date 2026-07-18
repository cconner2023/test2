import { useCallback } from 'react'
import { Download } from 'lucide-react'
import type { LocalPropertyItem, LocalPropertyLocation, HolderInfo } from '../../Types/PropertyTypes'
import { downloadBlob } from '../../Utilities/downloadUtils'
import { dataUrlToBlob } from '../../Utilities/imageUtils'
import { PropertyLocationTree } from './PropertyLocationTree'
import { useIsMobile } from '../../Hooks/useIsMobile'
import { ItemTimeline } from '../Timeline/ItemTimeline'

/** Stable empty holders map for vehicle timelines (no custody/move events). */
const EMPTY_HOLDERS: Map<string, HolderInfo> = new Map()

interface PropertyLocationDetailProps {
  location: LocalPropertyLocation
  locations: LocalPropertyLocation[]
  items: LocalPropertyItem[]
  holders?: Map<string, HolderInfo>
  /** Tap a child zone → navigate to it (canvas on desktop / re-point the sheet on mobile). */
  onNavigateZone: (locationId: string) => void
  onSelectItem: (item: LocalPropertyItem) => void
  /** Open the shared item action menu for a tree item row (panel-hosted). */
  onOpenItemMenu?: (item: LocalPropertyItem, rect: DOMRect) => void
  /** Open the shared zone action menu for a child-zone row (panel-hosted) — the same
   *  menu the header ellipsis and the main tree use. */
  onOpenLocationMenu?: (loc: LocalPropertyLocation, rect: DOMRect) => void
}

/**
 * PropertyLocationDetail — the selected-zone CONTENT surface (photo + the zone's
 * subtree rendered with the shared PropertyLocationTree, scoped via rootId, so
 * children/items use the canonical tree rows + lifted-clone menus instead of
 * bespoke bordered rows). Used in the desktop right pane and the mobile sheet.
 * The header + row actions all route through the panel-hosted LocationActionMenu /
 * ItemActionMenu (openMenu), so this surface is purely presentational.
 */
export function PropertyLocationDetail({
  location,
  locations,
  items,
  holders,
  onNavigateZone,
  onSelectItem,
  onOpenItemMenu,
  onOpenLocationMenu,
}: PropertyLocationDetailProps) {
  const isMobile = useIsMobile()

  // The zone photo already IS the map tile background — so the detail doesn't
  // re-preview it. Instead we surface it as a downloadable file (edit lives in
  // the zone Edit form). resizeImage always writes JPEG; older data may be PNG.
  const photoExt = location.photo_data?.startsWith('data:image/png') ? 'png' : 'jpg'
  const photoFilename = `${(location.name || 'photo').trim().replace(/[^\w.-]+/g, '_') || 'photo'}.${photoExt}`
  const handleDownloadPhoto = useCallback(() => {
    if (location.photo_data) downloadBlob(dataUrlToBlob(location.photo_data), photoFilename)
  }, [location.photo_data, photoFilename])

  return (
    <div className="flex flex-col pt-1 pb-2">
      {location.photo_data && (
        <button
          type="button"
          onClick={handleDownloadPhoto}
          className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-secondary/5 active:opacity-70 transition-colors"
        >
          <span className="flex-1 min-w-0 text-[10pt] text-primary truncate">{photoFilename}</span>
          <Download size={15} className="shrink-0 text-tertiary" />
        </button>
      )}

      <PropertyLocationTree
        rootId={location.id}
        hoverActions={!isMobile}
        locations={locations}
        items={items}
        holders={holders}
        onSelectLocation={(loc) => onNavigateZone(loc.id)}
        onSelectItem={onSelectItem}
        onOpenItemMenu={onOpenItemMenu}
        onOpenLocationMenu={onOpenLocationMenu}
      />

      {/* A vehicle is property too — its own 5988 paper trail below the BII/
          components it holds (the tree above). PMCS itself is the overlay,
          launched from the header ellipsis via the panel-hosted LocationActionMenu. */}
      {location.kind === 'vehicle' && (
        <div className="px-4 pt-1 pb-3 space-y-4">
          <ItemTimeline
            subjectId={location.id}
            clinicId={location.clinic_id}
            locations={locations}
            holders={holders ?? EMPTY_HOLDERS}
            hideWhenEmpty
          />
        </div>
      )}
    </div>
  )
}
