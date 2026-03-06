import { memo } from 'react'
import { MARCHForm } from './MARCHForm'
import { MedicationsForm } from './MedicationsForm'
import { FluidsPanel } from './FluidsPanel'
import { NotesPanel } from './NotesPanel'
import { EvacuationForm } from './EvacuationForm'
import { TC3ReviewExport } from './TC3ReviewExport'

/** Right column of the desktop DD1380 layout — back of the card. */
export const TC3BackColumn = memo(function TC3BackColumn() {
  return (
    <div className="h-full overflow-y-auto bg-themewhite">
      <div className="px-3 py-4 space-y-6">
        {/* Header */}
        <div className="px-1">
          <p className="text-[10px] font-semibold text-themeredred/60 tracking-widest uppercase">
            DD 1380 — TC3 Card (Back)
          </p>
        </div>

        {/* MARCH Protocol */}
        <MARCHForm />

        {/* Medications */}
        <MedicationsForm />

        {/* Fluids & Blood Products (extracted from Circulation) */}
        <FluidsPanel />

        {/* Notes */}
        <NotesPanel />

        {/* Evacuation */}
        <EvacuationForm />

        {/* Review & Export */}
        <TC3ReviewExport />
      </div>
    </div>
  )
})
