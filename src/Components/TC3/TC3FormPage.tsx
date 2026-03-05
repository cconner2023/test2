import { memo } from 'react'
import { useTC3Store } from '../../stores/useTC3Store'
import { CasualtyInfoForm } from './CasualtyInfoForm'
import { MechanismForm } from './MechanismForm'
import { MARCHForm } from './MARCHForm'
import { MedicationsForm } from './MedicationsForm'
import { VitalsForm } from './VitalsForm'
import { EvacuationForm } from './EvacuationForm'
import { TC3ReviewExport } from './TC3ReviewExport'

export const TC3FormPage = memo(function TC3FormPage() {
  const selectedSection = useTC3Store((s) => s.selectedSection)

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-3 py-4 min-h-full">
        {selectedSection === 'casualty' && <CasualtyInfoForm />}
        {selectedSection === 'mechanism' && <MechanismForm />}
        {selectedSection === 'march' && <MARCHForm />}
        {selectedSection === 'medications' && <MedicationsForm />}
        {selectedSection === 'vitals' && <VitalsForm />}
        {selectedSection === 'evacuation' && <EvacuationForm />}
        {selectedSection === 'review' && <TC3ReviewExport />}
      </div>
    </div>
  )
})
