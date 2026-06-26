/**
 * AdminLocationDetail.tsx
 *
 * View + edit a single location row. Mirrors AdminClinicDetail structure
 * (single rounded-2xl card, no Section wrappers, save/cancel via header
 * actions). display_name auto-derives from the other fields unless the admin
 * explicitly overrides; timezone is auto-filled from the device on create and
 * not surfaced in the UI (see beacon.locations.timezone).
 */

import { useEffect, useCallback, useMemo, useState, useRef } from 'react'
import { ChevronDown, Check, X } from 'lucide-react'
import { PreviewOverlay } from '../PreviewOverlay'
import { ActionButton } from '../ActionButton'
import { TextInput } from '../FormInputs'
import { ErrorDisplay } from '../ErrorDisplay'
import { LocationPickerInput } from './AdminPickers'
import { LocationBreadcrumb } from './LocationBreadcrumb'
import {
  listLocations,
  listClinics,
  createLocation,
  updateLocation,
  archiveLocation,
} from '../../lib/adminService'
import type { AdminLocation, AdminClinic } from '../../lib/adminService'
import { invalidate } from '../../stores/useInvalidationStore'
import { ISO_COUNTRIES, COMMAND_OPTIONS, findCountry, findSubdivisionName } from '../../lib/iso3166'

interface AdminLocationDetailProps {
  location: AdminLocation | null
  onLocationUpdated: (location: AdminLocation) => void
  editing: boolean
  onEditingChange: (editing: boolean) => void
  saveRequested: boolean
  onSaveComplete: () => void
  onPendingChangesChange?: (hasPending: boolean) => void
  onCreated?: (locationId: string) => void
  onArchived?: () => void
}

function deriveDisplayName(
  country: string,
  subdivision: string | null,
  installation: string,
  sub_area: string | null,
): string {
  const base = sub_area ? `${installation} — ${sub_area}` : installation
  const geo = subdivision ? `${country}-${subdivision}` : country
  if (!installation) return ''
  return `${base} (${geo})`
}

export function AdminLocationDetail({
  location,
  onLocationUpdated,
  editing,
  onEditingChange,
  saveRequested,
  onSaveComplete,
  onPendingChangesChange,
  onCreated,
  onArchived,
}: AdminLocationDetailProps) {
  const [allLocations, setAllLocations] = useState<AdminLocation[]>([])
  const [clinicsAtLocation, setClinicsAtLocation] = useState<AdminClinic[]>([])

  const [editCountry, setEditCountry] = useState('')
  const [editSubdivision, setEditSubdivision] = useState<string | null>(null)
  const [editInstallation, setEditInstallation] = useState('')
  const [editSubArea, setEditSubArea] = useState('')
  const [editDisplayName, setEditDisplayName] = useState('')
  const [displayOverridden, setDisplayOverridden] = useState(false)
  const [editCommand, setEditCommand] = useState<string | null>(null)
  const [commandIsOther, setCommandIsOther] = useState(false)
  const [editLat, setEditLat] = useState('')
  const [editLon, setEditLon] = useState('')
  const [editParentId, setEditParentId] = useState<string | null>(null)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmingArchive, setConfirmingArchive] = useState(false)

  const isCreateMode = location === null

  const onLocationUpdatedRef = useRef(onLocationUpdated)
  onLocationUpdatedRef.current = onLocationUpdated

  const loadData = useCallback(async () => {
    const [locs, clinics] = await Promise.all([listLocations(), listClinics()])
    setAllLocations(locs)
    if (!isCreateMode) {
      const refreshed = locs.find(l => l.id === location?.id)
      if (refreshed) onLocationUpdatedRef.current(refreshed)
      setClinicsAtLocation(clinics.filter(c => c.location_id === location?.id))
    } else {
      setClinicsAtLocation([])
    }
  }, [isCreateMode, location?.id])

  useEffect(() => { loadData() }, [loadData])

  const prevEditingRef = useRef(false)
  useEffect(() => {
    if (editing && !prevEditingRef.current) {
      setEditCountry(location?.country_code ?? '')
      setEditSubdivision(location?.subdivision ?? null)
      setEditInstallation(location?.installation ?? '')
      setEditSubArea(location?.sub_area ?? '')
      setEditDisplayName(location?.display_name ?? '')
      const derived = deriveDisplayName(
        location?.country_code ?? '',
        location?.subdivision ?? null,
        location?.installation ?? '',
        location?.sub_area ?? null,
      )
      setDisplayOverridden(!!location && location.display_name !== derived)
      const cmd = location?.command ?? null
      setEditCommand(cmd)
      setCommandIsOther(!!cmd && !COMMAND_OPTIONS.includes(cmd as typeof COMMAND_OPTIONS[number]))
      setEditLat(location?.lat != null ? String(location.lat) : '')
      setEditLon(location?.lon != null ? String(location.lon) : '')
      setEditParentId(location?.parent_id ?? null)
      setError(null)
    }
    prevEditingRef.current = editing
  }, [editing, location])

  /** Auto-update display_name as the source fields change, unless overridden. */
  useEffect(() => {
    if (!editing || displayOverridden) return
    setEditDisplayName(deriveDisplayName(editCountry, editSubdivision, editInstallation, editSubArea || null))
  }, [editing, displayOverridden, editCountry, editSubdivision, editInstallation, editSubArea])

  useEffect(() => {
    if (!editing) { onPendingChangesChange?.(false); return }
    const latNum = editLat ? parseFloat(editLat) : null
    const lonNum = editLon ? parseFloat(editLon) : null
    const changed =
      editCountry !== (location?.country_code ?? '') ||
      (editSubdivision ?? null) !== (location?.subdivision ?? null) ||
      editInstallation !== (location?.installation ?? '') ||
      (editSubArea || null) !== (location?.sub_area ?? null) ||
      editDisplayName !== (location?.display_name ?? '') ||
      (editCommand || null) !== (location?.command ?? null) ||
      latNum !== (location?.lat ?? null) ||
      lonNum !== (location?.lon ?? null) ||
      editParentId !== (location?.parent_id ?? null)
    onPendingChangesChange?.(changed)
  }, [editing, editCountry, editSubdivision, editInstallation, editSubArea, editDisplayName,
      editCommand, editLat, editLon, editParentId, location, onPendingChangesChange])

  const handleSave = useCallback(async () => {
    if (!editCountry.trim()) { setError('Country required.'); return }
    if (!editInstallation.trim()) { setError('Installation required.'); return }
    if (!editDisplayName.trim()) { setError('Display name required.'); return }

    const latNum = editLat.trim() ? parseFloat(editLat) : null
    const lonNum = editLon.trim() ? parseFloat(editLon) : null
    if (editLat.trim() && (latNum === null || Number.isNaN(latNum) || latNum < -90 || latNum > 90)) {
      setError('Latitude must be between -90 and 90.'); return
    }
    if (editLon.trim() && (lonNum === null || Number.isNaN(lonNum) || lonNum < -180 || lonNum > 180)) {
      setError('Longitude must be between -180 and 180.'); return
    }

    setSaving(true); setError(null)
    const payload = {
      country_code: editCountry.trim().toUpperCase(),
      subdivision: editSubdivision || null,
      installation: editInstallation.trim(),
      sub_area: editSubArea.trim() || null,
      display_name: editDisplayName.trim(),
      command: editCommand?.trim() || null,
      lat: latNum,
      lon: lonNum,
      parent_id: editParentId,
    }

    if (isCreateMode) {
      const result = await createLocation(payload)
      setSaving(false)
      if (result.success) {
        invalidate('locations')
        onCreated?.(result.id)
      } else {
        setError(result.error || 'Failed to create location')
      }
      return
    }

    const result = await updateLocation(location!.id, payload)
    setSaving(false)
    if (result.success) {
      onEditingChange(false)
      invalidate('locations')
      loadData()
    } else {
      setError(result.error || 'Failed to update location')
    }
  }, [editCountry, editSubdivision, editInstallation, editSubArea, editDisplayName,
      editCommand, editLat, editLon, editParentId, isCreateMode, location, onEditingChange,
      loadData, onCreated])

  useEffect(() => {
    if (saveRequested) {
      handleSave()
      onSaveComplete()
    }
  }, [saveRequested, handleSave, onSaveComplete])

  const handleArchive = useCallback(async () => {
    if (!location) return
    if (clinicsAtLocation.length > 0) {
      // Name the blockers so the admin can act on them without walking the
      // clinic list. Cap at 3 to keep the inline banner one short line.
      const names = clinicsAtLocation.map(c => c.name)
      const preview = names.slice(0, 3).join(', ')
      const remainder = names.length > 3 ? ` and ${names.length - 3} more` : ''
      setError(`Cannot archive — referenced by ${preview}${remainder}. Reassign or archive ${names.length === 1 ? 'it' : 'them'} first.`)
      setConfirmingArchive(false)
      return
    }
    setSaving(true); setError(null)
    const result = await archiveLocation(location.id)
    setSaving(false)
    setConfirmingArchive(false)
    if (result.success) {
      invalidate('locations')
      onArchived?.()
    } else {
      setError(result.error || 'Failed to archive location')
    }
  }, [location, clinicsAtLocation, onArchived])

  const currentCountry = useMemo(() => findCountry(editing ? editCountry : location?.country_code), [editing, editCountry, location])
  const availableSubdivisions = currentCountry?.subdivisions ?? []

  if (editing) {
    return (
      <div className={saving ? 'opacity-50 pointer-events-none' : undefined}>
        {error && <div className="mb-3"><ErrorDisplay message={error} /></div>}

        <div className="rounded-2xl bg-themewhite2 overflow-hidden">
          <CountryPickerRow value={editCountry} onChange={(c) => { setEditCountry(c); setEditSubdivision(null) }} />
          {availableSubdivisions.length > 0 && (
            <SubdivisionPickerRow
              value={editSubdivision}
              onChange={setEditSubdivision}
              subdivisions={availableSubdivisions}
            />
          )}
          <TextInput value={editInstallation} onChange={setEditInstallation} placeholder="Installation (e.g., Fort Bragg)" />
          <TextInput value={editSubArea} onChange={setEditSubArea} placeholder="Sub-area (optional, e.g., Tower Barracks)" />
          <TextInput
            value={editDisplayName}
            onChange={(v) => { setEditDisplayName(v); setDisplayOverridden(true) }}
            placeholder="Display name"
            hint={displayOverridden ? 'Auto-derive disabled (manually edited).' : null}
          />
          <CommandPickerRow
            value={editCommand}
            isOther={commandIsOther}
            onChange={(val, isOther) => { setEditCommand(val); setCommandIsOther(isOther) }}
          />
          <div className="flex border-b border-primary/6">
            <input
              type="number"
              step="any"
              value={editLat}
              onChange={(e) => setEditLat(e.target.value)}
              placeholder="Latitude"
              className="flex-1 bg-transparent px-4 py-3 text-base md:text-[10pt] text-primary placeholder:text-tertiary focus:outline-none border-r border-primary/6"
            />
            <input
              type="number"
              step="any"
              value={editLon}
              onChange={(e) => setEditLon(e.target.value)}
              placeholder="Longitude"
              className="flex-1 bg-transparent px-4 py-3 text-base md:text-[10pt] text-primary placeholder:text-tertiary focus:outline-none"
            />
          </div>
          <LocationPickerInput
            value={editParentId}
            onChange={setEditParentId}
            allLocations={allLocations}
            placeholder="Parent location (optional)"
            excludeDescendantsOf={location?.id ?? null}
          />
        </div>

        {!isCreateMode && (
          <div className="mt-4 flex justify-end">
            <ActionButton
              icon={X}
              label="Archive"
              variant="danger"
              onClick={() => setConfirmingArchive(true)}
            />
          </div>
        )}

        {confirmingArchive && (
          <div className="mt-3 rounded-xl bg-themeredred/5 border border-themeredred/30 p-3 flex items-center justify-between gap-3">
            <p className="text-[10pt] text-themeredred">
              Archive this location? Clinics will lose their location reference.
            </p>
            <div className="flex gap-2 shrink-0">
              <ActionButton icon={X} label="Cancel" onClick={() => setConfirmingArchive(false)} />
              <ActionButton icon={Check} label="Confirm" variant="danger" onClick={handleArchive} />
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── View mode ──
  if (!location) return null
  return (
    <div>
      {error && <div className="mb-3"><ErrorDisplay message={error} /></div>}

      <div className="rounded-2xl bg-themewhite2 overflow-hidden">
        <div className="px-4 py-3">
          <LocationBreadcrumb
            locationId={location.id}
            allLocations={allLocations}
            excludeLeaf
            className="block text-[9pt] text-tertiary mb-1"
          />
          <p className="text-sm font-semibold text-primary">{location.display_name}</p>
          <p className="text-[9pt] text-tertiary mt-0.5">
            {[
              location.installation,
              location.sub_area,
              [location.country_code, location.subdivision].filter(Boolean).join('-'),
              findSubdivisionName(location.country_code, location.subdivision),
              location.command,
            ].filter(Boolean).join(' · ')}
          </p>
          {(location.lat != null || location.lon != null) && (
            <p className="text-[9pt] text-tertiary mt-1 font-mono">
              {location.lat?.toFixed(4) ?? '—'}, {location.lon?.toFixed(4) ?? '—'}
            </p>
          )}
        </div>
      </div>

      {clinicsAtLocation.length > 0 && (
        <section className="mt-4">
          <p className="px-1 mb-1.5 text-[9pt] tracking-widest uppercase text-tertiary">
            Clinics here
          </p>
          <div className="rounded-2xl bg-themewhite2 overflow-hidden divide-y divide-primary/6">
            {clinicsAtLocation.map(c => (
              <div key={c.id} className="px-4 py-2.5 text-sm text-primary">{c.name}</div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// ── Inline pickers for the location form ────────────────────────────────────

function CountryPickerRow({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const [open, setOpen] = useState(false)
  const selected = findCountry(value)
  return (
    <div className="block border-b border-primary/6 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`w-full bg-transparent px-4 py-3 text-left text-base md:text-sm flex items-center justify-between gap-3 focus:outline-none ${value ? 'text-primary' : 'text-tertiary'}`}
      >
        <span>{selected ? `${selected.name} (${selected.code})` : 'Country'}</span>
        <ChevronDown size={16} className="shrink-0 text-tertiary" />
      </button>
      <PreviewOverlay
        isOpen={open}
        onClose={() => setOpen(false)}
        anchorRect={null}
        maxWidth={360}
        title="Country"
        searchPlaceholder="Search by name or ISO code..."
        preview={(filter) => {
          const q = filter.toLowerCase().trim()
          const rows = ISO_COUNTRIES.filter(c =>
            !q || c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
          )
          if (rows.length === 0) return <p className="text-[9pt] text-tertiary text-center py-4">No matches.</p>
          return (
            <div role="listbox">
              {rows.map(c => {
                const sel = c.code === value
                return (
                  <button
                    key={c.code}
                    type="button"
                    role="option"
                    aria-selected={sel}
                    onClick={() => { onChange(c.code); setOpen(false) }}
                    className="w-full text-left px-3.5 py-2.5 hover:bg-primary/5 active:bg-primary/10 flex items-center justify-between gap-2"
                  >
                    <span className={`text-sm ${sel ? 'text-themeblue2 font-medium' : 'text-primary'}`}>
                      {c.name} <span className="text-tertiary font-normal">({c.code})</span>
                    </span>
                    {sel && <Check size={16} className="shrink-0 text-themeblue2" />}
                  </button>
                )
              })}
            </div>
          )
        }}
      />
    </div>
  )
}

function SubdivisionPickerRow({
  value, onChange, subdivisions,
}: {
  value: string | null
  onChange: (code: string | null) => void
  subdivisions: Array<{ code: string; name: string }>
}) {
  const [open, setOpen] = useState(false)
  const selected = subdivisions.find(s => s.code === value)
  return (
    <div className="block border-b border-primary/6 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`w-full bg-transparent px-4 py-3 text-left text-base md:text-sm flex items-center justify-between gap-3 focus:outline-none ${value ? 'text-primary' : 'text-tertiary'}`}
      >
        <span>{selected ? `${selected.name} (${selected.code})` : 'Subdivision (optional)'}</span>
        <ChevronDown size={16} className="shrink-0 text-tertiary" />
      </button>
      <PreviewOverlay
        isOpen={open}
        onClose={() => setOpen(false)}
        anchorRect={null}
        maxWidth={360}
        title="Subdivision"
        searchPlaceholder="Search..."
        preview={(filter) => {
          const q = filter.toLowerCase().trim()
          const rows = subdivisions.filter(s =>
            !q || s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)
          )
          return (
            <div role="listbox">
              {value && (
                <button
                  type="button"
                  onClick={() => { onChange(null); setOpen(false) }}
                  className="w-full text-left px-3.5 py-2.5 hover:bg-primary/5 text-[10pt] text-tertiary border-b border-primary/6"
                >
                  Clear selection
                </button>
              )}
              {rows.map(s => {
                const sel = s.code === value
                return (
                  <button
                    key={s.code}
                    type="button"
                    role="option"
                    aria-selected={sel}
                    onClick={() => { onChange(s.code); setOpen(false) }}
                    className="w-full text-left px-3.5 py-2.5 hover:bg-primary/5 active:bg-primary/10 flex items-center justify-between gap-2"
                  >
                    <span className={`text-sm ${sel ? 'text-themeblue2 font-medium' : 'text-primary'}`}>
                      {s.name} <span className="text-tertiary font-normal">({s.code})</span>
                    </span>
                    {sel && <Check size={16} className="shrink-0 text-themeblue2" />}
                  </button>
                )
              })}
            </div>
          )
        }}
      />
    </div>
  )
}

function CommandPickerRow({
  value, isOther, onChange,
}: {
  value: string | null
  isOther: boolean
  onChange: (val: string | null, isOther: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <div className="block border-b border-primary/6 last:border-b-0">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`w-full bg-transparent px-4 py-3 text-left text-base md:text-sm flex items-center justify-between gap-3 focus:outline-none ${value ? 'text-primary' : 'text-tertiary'}`}
        >
          <span>{value || 'Command (optional)'}</span>
          <ChevronDown size={16} className="shrink-0 text-tertiary" />
        </button>
        <PreviewOverlay
          isOpen={open}
          onClose={() => setOpen(false)}
          anchorRect={null}
          maxWidth={300}
          title="Command"
          preview={() => (
            <div role="listbox">
              {value && (
                <button
                  type="button"
                  onClick={() => { onChange(null, false); setOpen(false) }}
                  className="w-full text-left px-3.5 py-2.5 hover:bg-primary/5 text-[10pt] text-tertiary border-b border-primary/6"
                >
                  Clear selection
                </button>
              )}
              {COMMAND_OPTIONS.map(cmd => {
                const sel = cmd === value && !isOther
                return (
                  <button
                    key={cmd}
                    type="button"
                    role="option"
                    aria-selected={sel}
                    onClick={() => { onChange(cmd, false); setOpen(false) }}
                    className="w-full text-left px-3.5 py-2.5 hover:bg-primary/5 flex items-center justify-between"
                  >
                    <span className={`text-sm ${sel ? 'text-themeblue2 font-medium' : 'text-primary'}`}>{cmd}</span>
                    {sel && <Check size={16} className="shrink-0 text-themeblue2" />}
                  </button>
                )
              })}
              <button
                type="button"
                onClick={() => { onChange('', true); setOpen(false) }}
                className="w-full text-left px-3.5 py-2.5 hover:bg-primary/5 border-t border-primary/6"
              >
                <span className={`text-sm ${isOther ? 'text-themeblue2 font-medium' : 'text-primary'}`}>Other (type below)</span>
              </button>
            </div>
          )}
        />
      </div>
      {isOther && (
        <TextInput
          value={value ?? ''}
          onChange={(v) => onChange(v, true)}
          placeholder="Custom command"
        />
      )}
    </>
  )
}

