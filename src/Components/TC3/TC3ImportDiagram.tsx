import { memo } from 'react'
import type { TC3Injury } from '../../Types/TC3Types'
import { TC3BodyDiagramSvg } from './TC3BodyDiagramSvg'

interface TC3ImportDiagramProps {
  injuries: TC3Injury[]
}

/** Read-only body diagram showing injury dots (colored by type) — used for import preview. */
export const TC3ImportDiagram = memo(function TC3ImportDiagram({ injuries }: TC3ImportDiagramProps) {
  return (
    <div className="px-2 py-1">
      <TC3BodyDiagramSvg
        injuries={injuries}
        editingInjury={null}
        onAddInjury={() => {}}
        onEditInjury={() => {}}
        readOnly
        compact
      />
    </div>
  )
})
