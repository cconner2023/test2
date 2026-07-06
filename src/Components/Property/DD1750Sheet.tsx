import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { PickerInput } from '@/Components/primitives/FormInputs'
import { OverlayStack } from '@/Components/primitives/OverlayStack'
import { PillButton } from '@/Components/primitives/HeaderPill'
import { useClinicMedics } from '../../Hooks/useClinicMedics'
import { useAuthStore } from '../../stores/useAuthStore'

/**
 * DD1750Sheet — the packed-by / reviewed-by picker for a zone's DD 1750 packing
 * list. Mirrors PmcsSheet/DispatchSheet: an OverlayStack scoped to the property
 * drawer (containerRef), launched from the zone ellipsis. Two roster pickers →
 * "Create" hands the chosen names back to the host, which runs the PDF export +
 * PdfPreviewModal. Names are "RANK LAST FIRST" (the DD 1750 convention);
 * operational identity only, no PHI.
 */

interface DD1750SheetProps {
  isOpen: boolean
  onClose: () => void
  /** Fires with the two chosen names; the host generates the PDF. */
  onCreate: (opts: { packedBy?: string; reviewedBy?: string }) => void
  /** Scopes the overlay to the property drawer (desktop); float+stack on mobile. */
  containerRef?: React.RefObject<HTMLElement | null>
  zIndex?: number
}

/** Format a roster member (or profile) as "RANK LAST FIRST". */
function memberName(m: { rank?: string; lastName?: string; firstName?: string }): string {
  return [m.rank, m.lastName, m.firstName].filter(Boolean).join(' ').trim()
}

export function DD1750Sheet({ isOpen, onClose, onCreate, containerRef, zIndex }: DD1750SheetProps) {
  const { medics } = useClinicMedics()
  const profile = useAuthStore((s) => s.profile)
  const selfName = memberName({ rank: profile.rank, lastName: profile.lastName, firstName: profile.firstName })

  const [packedBy, setPackedBy] = useState('')
  const [reviewedBy, setReviewedBy] = useState('')

  // Default "packed by" to the current user; clear both on each open.
  useEffect(() => {
    if (isOpen) { setPackedBy(selfName); setReviewedBy('') }
  }, [isOpen, selfName])

  const options = medics.map(memberName).filter((n) => n.length > 0).sort((a, b) => a.localeCompare(b))
  // Keep the current user selectable even if not yet in the medics roster.
  const packedOptions = selfName && !options.includes(selfName) ? [selfName, ...options] : options

  const create = () => {
    onCreate({ packedBy: packedBy.trim() || undefined, reviewedBy: reviewedBy.trim() || undefined })
    onClose()
  }

  const body = (
    <div className="divide-y divide-tertiary/8">
      <PickerInput value={packedBy} onChange={setPackedBy} options={packedOptions} placeholder="Packed by" />
      <PickerInput value={reviewedBy} onChange={setReviewedBy} options={options} placeholder="Reviewed by" />
    </div>
  )

  const screens = {
    pick: {
      title: 'DD 1750',
      rightFooter: (
        <div className="bg-themewhite rounded-2xl px-1.5 py-1.5">
          <PillButton icon={Check} iconSize={16} accent="success" onClick={create} label="Create" />
        </div>
      ),
      render: () => body,
    },
  }

  return (
    <OverlayStack
      isOpen={isOpen}
      onClose={onClose}
      containerRef={containerRef}
      zIndex={zIndex}
      initial={{ key: 'pick' }}
      screens={screens}
      maxWidth={360}
      previewMaxHeight="60dvh"
    />
  )
}
