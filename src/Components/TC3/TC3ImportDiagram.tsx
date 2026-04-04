import { memo } from 'react'
import type { TC3Marker } from '../../Types/TC3Types'
import { TC3BodyDiagramSvg } from './TC3BodyDiagramSvg'

interface TC3ImportDiagramProps {
  markers: TC3Marker[]
}

/** Read-only body diagram showing markers (colored by type) — used for import preview. */
export const TC3ImportDiagram = memo(function TC3ImportDiagram({ markers }: TC3ImportDiagramProps) {
  return (
    <div className="px-2 py-1">
      <TC3BodyDiagramSvg
        markers={markers}
        readOnly
        compact
      />
    </div>
  )
})
