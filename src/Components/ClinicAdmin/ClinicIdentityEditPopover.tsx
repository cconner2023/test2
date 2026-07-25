import { useEffect, useState, useCallback, useMemo } from 'react'
import { Check, Loader2, ChevronDown } from 'lucide-react'
import { PreviewOverlay } from '../PreviewOverlay'
import { ActionButton } from '@/Components/primitives/ActionButton'
import { FooterPill } from '@/Components/primitives/FooterPill'
import { ErrorPill } from '@/Components/primitives/ErrorPill'
import {
  getClinicEncryptionKey,
  updateSupervisorClinic,
  updateSupervisorClinicLocationId,
} from '../../lib/supervisorService'
import type { AdminLocation } from '../../lib/adminService'
import { invalidate } from '../../stores/useInvalidationStore'

export interface ClinicIdentitySaved {
  name: string
  location: string | null
  location_id: string | null
  uics: string[]
}

interface ClinicIdentityEditPopoverProps {
  isOpen: boolean
  anchorRect: DOMRect | null
  clinicId: string | null
  initialName: string
  initialLocation: string | null
  initialLocationId: string | null
  initialUics: string[]
  locations: AdminLocation[]
  onClose: () => void
  onSaved: (next: ClinicIdentitySaved) => void
}

export function ClinicIdentityEditPopover({
  isOpen,
  anchorRect,
  clinicId,
  initialName,
  initialLocation,
  initialLocationId,
  initialUics,
  locations,
  onClose,
  onSaved,
}: ClinicIdentityEditPopoverProps) {
  const [mode, setMode] = useState<'edit' | 'pickLocation'>('edit')
  const [name, setName] = useState(initialName)
  const [locationId, setLocationId] = useState<string | null>(initialLocationId)
  const [uics, setUics] = useState(initialUics.join(', '))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Re-seed on open / when underlying values change while closed
  useEffect(() => {
    if (isOpen) {
      setMode('edit')
      setName(initialName)
      setLocationId(initialLocationId)
      setUics(initialUics.join(', '))
      setError(null)
    }
  }, [isOpen, initialName, initialLocationId, initialUics])

  const selectedLocation = useMemo(
    () => locations.find(l => l.id === locationId) ?? null,
    [locations, locationId],
  )

  const handleSave = useCallback(async () => {
    if (!clinicId) return
    if (!name.trim()) {
      setError('Cluster name is required')
      return
    }
    setSaving(true)
    setError(null)

    const encKey = await getClinicEncryptionKey(clinicId)
    const uicsArray = uics
      .split(',')
      .map((u) => u.trim().toUpperCase())
      .filter(Boolean)

    // name / uics / legacy-location go through the existing RPC; pass current
    // legacy location through unchanged (supervisors edit it via picker now).
    const detailResult = await updateSupervisorClinic(
      clinicId,
      {
        name: name.trim(),
        location: initialLocation ?? null,
        uics: uicsArray.length > 0 ? uicsArray : undefined,
      },
      encKey,
    )
    if (!detailResult.success) {
      setSaving(false)
      setError(detailResult.error)
      return
    }

    if (locationId !== initialLocationId) {
      const locResult = await updateSupervisorClinicLocationId(clinicId, locationId)
      if (!locResult.success) {
        setSaving(false)
        setError(locResult.error)
        return
      }
    }

    setSaving(false)
    invalidate('clinics')
    onSaved({
      name: name.trim(),
      location: initialLocation ?? null,
      location_id: locationId,
      uics: uicsArray,
    })
    onClose()
  }, [clinicId, name, locationId, uics, initialLocation, initialLocationId, onSaved, onClose])

  const buildGroups = useCallback((filterStr: string) => {
    const q = filterStr.toLowerCase().trim()
    const filtered = locations.filter(l => {
      if (!q) return true
      return (
        l.installation.toLowerCase().includes(q) ||
        (l.sub_area?.toLowerCase().includes(q) ?? false) ||
        l.display_name.toLowerCase().includes(q) ||
        l.country_code.toLowerCase() === q ||
        (l.subdivision?.toLowerCase() === q) ||
        (l.command?.toLowerCase().includes(q) ?? false)
      )
    })
    const groups: Array<{ country: string; rows: AdminLocation[] }> = []
    for (const row of filtered) {
      const last = groups[groups.length - 1]
      if (last && last.country === row.country_code) last.rows.push(row)
      else groups.push({ country: row.country_code, rows: [row] })
    }
    return groups
  }, [locations])

  const isPickMode = mode === 'pickLocation'

  return (
    <PreviewOverlay
      isOpen={isOpen}
      onClose={onClose}
      anchorRect={anchorRect}
      title={isPickMode ? 'Location' : 'Edit cluster'}
      onBack={isPickMode ? () => setMode('edit') : undefined}
      maxWidth={360}
      previewMaxHeight="60dvh"
      searchPlaceholder={isPickMode ? 'Search by post, country, or code...' : undefined}
      preview={isPickMode ? (q) => {
        const groups = buildGroups(q)
        if (groups.length === 0) {
          return <p className="text-[9pt] text-tertiary text-center py-4">No locations match.</p>
        }
        return (
          <div role="listbox">
            {locationId && (
              <button
                type="button"
                onClick={() => { setLocationId(null); setMode('edit') }}
                className="w-full text-left px-3.5 py-2.5 hover:bg-primary/5 active:bg-primary/10 transition-colors text-[10pt] text-tertiary border-b border-primary/6"
              >
                Clear selection
              </button>
            )}
            {groups.map(g => (
              <div key={g.country}>
                <div className="px-3.5 pt-2 pb-1 text-[8pt] uppercase tracking-widest text-tertiary">
                  {g.country}
                </div>
                {g.rows.map(l => {
                  const sel = l.id === locationId
                  return (
                    <button
                      key={l.id}
                      type="button"
                      role="option"
                      aria-selected={sel}
                      onClick={() => { setLocationId(l.id); setMode('edit') }}
                      className="w-full text-left px-3.5 py-2.5 hover:bg-primary/5 active:bg-primary/10 transition-colors flex items-center justify-between gap-2"
                    >
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${sel ? 'text-themeblue2 font-medium' : 'text-primary'}`}>
                          {l.installation}
                          {l.sub_area && <span className="text-tertiary font-normal"> — {l.sub_area}</span>}
                        </p>
                        <p className="text-[9pt] text-tertiary mt-0.5">
                          {[l.subdivision, l.command].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      {sel && <Check size={16} className="shrink-0 text-themeblue2" />}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        )
      } : undefined}
      rightFooter={
        isOpen && !isPickMode ? (
          <FooterPill side="right">
            <ActionButton
              icon={saving ? Loader2 : Check}
              label={saving ? 'Saving…' : 'Save'}
              variant={saving || !name.trim() ? 'disabled' : 'confirm'}
              onClick={handleSave}
            />
          </FooterPill>
        ) : undefined
      }
    >
      {isOpen && !isPickMode && (
        <div>
          <div className="flex items-center border-b border-primary/6 px-4 py-3">
            <span className="text-[9pt] font-semibold text-tertiary uppercase tracking-widest w-20 shrink-0">Name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Cluster name"
              className="flex-1 bg-transparent text-primary placeholder:text-tertiary focus:outline-none text-sm min-w-0"
            />
          </div>
          <button
            type="button"
            onClick={() => setMode('pickLocation')}
            className="w-full flex items-center border-b border-primary/6 px-4 py-3 active:bg-primary/5 transition-colors"
          >
            <span className="text-[9pt] font-semibold text-tertiary uppercase tracking-widest w-20 shrink-0 text-left">Location</span>
            <span className={`flex-1 text-left text-sm truncate ${selectedLocation ? 'text-primary' : 'text-tertiary'}`}>
              {selectedLocation ? selectedLocation.display_name : (initialLocation || 'Select location')}
            </span>
            <ChevronDown size={16} className="shrink-0 text-tertiary ml-2" />
          </button>
          {!selectedLocation && initialLocation && (
            <p className="px-4 py-2 text-[9pt] text-tertiary border-b border-primary/6">
              Legacy location text — tap above to pick a canonical post.
            </p>
          )}
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
