import { useState } from 'react'
import { Check } from 'lucide-react'
import { SectionCard } from '@/Components/primitives/Section'
import { AddFab } from '@/Components/primitives/AddFab'
import { useIsMobile } from '../../../Hooks/useIsMobile'
import { CertOverlayFields } from '../../Certifications/CertOverlayFields'
import { emptyCertForm, type CertFormData } from '../../Certifications/certHelpers'

/**
 * Filing a certification a supervisor holds in their hand for a soldier who has
 * not entered it themselves.
 *
 * It is a TERMINAL, not a center screen, on the same test everything else in the
 * pane meets: it acts on one person rather than offering a list to scan, and
 * walking away from a half-typed card by re-pointing the rail would file it
 * against whoever was selected next — which is exactly what collapsing the rail
 * prevents.
 *
 * The FIELDS are the personal profile's fields (CertOverlayFields), not a second
 * form. A cert a supervisor files and a cert a soldier files are the same row,
 * and two authoring surfaces for one row is how the two drift.
 *
 * The document is deliberately NOT here: a new row has no id yet, and the
 * document's path is derived from that id (certDocumentService). Upload is on the
 * terminal the save lands on.
 */
interface CertComposeProps {
  /** Who the cert is filed against — named by the pane's eyebrow, so the body
   *  does not restate it. */
  onSave: (form: CertFormData) => void
}

export function CertCompose({ onSave }: CertComposeProps) {
  const isMobile = useIsMobile()
  const [form, setForm] = useState<CertFormData>(emptyCertForm)

  // A title is the only field the row cannot be written without. No disabled
  // Save — the action appears once there is something to save.
  const ready = !!form.title.trim()

  return (
    <div className="px-4 py-4">
      <SectionCard>
        <CertOverlayFields
          form={form}
          setForm={setForm}
          isMobile={isMobile}
          datalistId="supervisor-cert-compose-titles"
          hidePrimary
        />
      </SectionCard>

      {ready && (
        <div className="sticky bottom-4 z-10 flex justify-end pt-4 pb-2 pointer-events-none">
          <AddFab icon={Check} label="Save certification" onClick={() => onSave(form)} />
        </div>
      )}
    </div>
  )
}
