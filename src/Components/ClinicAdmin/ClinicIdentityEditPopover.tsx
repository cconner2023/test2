import { useEffect, useState, useCallback } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { PreviewOverlay } from '../PreviewOverlay'
import { ActionButton } from '../ActionButton'
import { ErrorPill } from '../ErrorPill'
import {
  getClinicEncryptionKey,
  updateSupervisorClinic,
} from '../../lib/supervisorService'
import { invalidate } from '../../stores/useInvalidationStore'

export interface ClinicIdentitySaved {
  name: string
  location: string | null
  uics: string[]
}

interface ClinicIdentityEditPopoverProps {
  isOpen: boolean
  anchorRect: DOMRect | null
  clinicId: string | null
  initialName: string
  initialLocation: string | null
  initialUics: string[]
  onClose: () => void
  onSaved: (next: ClinicIdentitySaved) => void
}

export function ClinicIdentityEditPopover({
  isOpen,
  anchorRect,
  clinicId,
  initialName,
  initialLocation,
  initialUics,
  onClose,
  onSaved,
}: ClinicIdentityEditPopoverProps) {
  const [name, setName] = useState(initialName)
  const [location, setLocation] = useState(initialLocation ?? '')
  const [uics, setUics] = useState(initialUics.join(', '))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Re-seed on open / when underlying values change while closed
  useEffect(() => {
    if (isOpen) {
      setName(initialName)
      setLocation(initialLocation ?? '')
      setUics(initialUics.join(', '))
      setError(null)
    }
  }, [isOpen, initialName, initialLocation, initialUics])

  const handleSave = useCallback(async () => {
    if (!clinicId) return
    if (!name.trim()) {
      setError('Clinic name is required')
      return
    }
    setSaving(true)
    setError(null)
    const encKey = await getClinicEncryptionKey(clinicId)
    const uicsArray = uics
      .split(',')
      .map((u) => u.trim().toUpperCase())
      .filter(Boolean)
    const result = await updateSupervisorClinic(
      clinicId,
      {
        name: name.trim(),
        location: location.trim() || null,
        uics: uicsArray.length > 0 ? uicsArray : undefined,
      },
      encKey,
    )
    setSaving(false)
    if (!result.success) {
      setError(result.error)
      return
    }
    invalidate('clinics')
    onSaved({
      name: name.trim(),
      location: location.trim() || null,
      uics: uicsArray,
    })
    onClose()
  }, [clinicId, name, location, uics, onSaved, onClose])

  return (
    <PreviewOverlay
      isOpen={isOpen}
      onClose={onClose}
      anchorRect={anchorRect}
      title="Edit clinic"
      maxWidth={360}
      previewMaxHeight="60dvh"
      footer={
        isOpen ? (
          <div className="flex gap-1 bg-themewhite rounded-2xl shadow-lg px-1.5 py-1.5">
            <ActionButton
              icon={saving ? Loader2 : Check}
              label={saving ? 'Saving…' : 'Save'}
              variant={saving || !name.trim() ? 'disabled' : 'success'}
              onClick={handleSave}
            />
          </div>
        ) : undefined
      }
    >
      {isOpen && (
        <div>
          <div className="flex items-center border-b border-primary/6 px-4 py-3">
            <span className="text-[9pt] font-semibold text-tertiary uppercase tracking-widest w-20 shrink-0">Name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Clinic name"
              className="flex-1 bg-transparent text-primary placeholder:text-tertiary focus:outline-none text-sm min-w-0"
            />
          </div>
          <div className="flex items-center border-b border-primary/6 px-4 py-3">
            <span className="text-[9pt] font-semibold text-tertiary uppercase tracking-widest w-20 shrink-0">Location</span>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Building / Room"
              className="flex-1 bg-transparent text-primary placeholder:text-tertiary focus:outline-none text-sm min-w-0"
            />
          </div>
          <div className="flex items-center px-4 py-3">
            <span className="text-[9pt] font-semibold text-tertiary uppercase tracking-widest w-20 shrink-0">UICs</span>
            <input
              type="text"
              value={uics}
              onChange={(e) => setUics(e.target.value.toUpperCase())}
              placeholder="W0ABCD, W0EFGH"
              className="flex-1 bg-transparent font-mono tracking-wider text-primary placeholder:font-sans placeholder:tracking-normal placeholder:text-tertiary focus:outline-none text-sm min-w-0"
            />
          </div>
          {error && (
            <div className="px-4 py-2">
              <ErrorPill>{error}</ErrorPill>
            </div>
          )}
        </div>
      )}
    </PreviewOverlay>
  )
}
