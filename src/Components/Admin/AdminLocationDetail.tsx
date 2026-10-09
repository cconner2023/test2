/**
 * AdminLocationDetail.tsx
 *
 * View + edit a single location — the same shape as the user / cluster details:
 * an identity card that taps open an anchored edit overlay (footer: Archive ·
 * Save), and an inline form with a header Save in create mode. display_name
 * auto-derives from the other fields unless the admin overrides it; timezone is
 * device-filled on create and not surfaced (see beacon.locations.timezone).
 */

import { useEffect, useCallback, useMemo, useState, useRef, type ReactNode } from 'react'
import { ChevronDown, ChevronRight, Check, Archive, Building2 } from 'lucide-react'
import { PreviewOverlay } from '../PreviewOverlay'
import { ActionButton } from '@/Components/primitives/ActionButton'
import { FooterPill } from '@/Components/primitives/FooterPill'
import { HeaderPill, PillButton } from '@/Components/primitives/HeaderPill'
import { ConfirmDialog } from '@/Components/primitives/ConfirmDialog'
import { SectionCard, SectionHeader } from '@/Components/primitives/Section'
import { ListItemRow } from '@/Components/primitives/ListItemRow'
import { Z } from '@/Components/primitives/BaseOverlay'
import { TextInput } from '@/Components/primitives/FormInputs'
import { ErrorDisplay } from '@/Components/primitives/ErrorDisplay'
import { useEntityForm } from '../../Hooks/useEntityForm'
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
  /** Lateral hop to a cluster sitting at this location. */
  onSelectClinic?: (clinic: AdminClinic) => void
  onDirtyChange?: (dirty: boolean) => void
  /** Publishes header pills to the host pane (create-mode Save). */
  onHeaderActions?: (node: ReactNode | null) => void
  onCreated?: (locationId: string) => void
  onArchived?: () => void
}

interface LocationForm extends Record<string, unknown> {
  country: string
  subdivision: string | null
  installation: string
  subArea: string
  displayName: string
  command: string | null
  lat: string
  lon: string
  parentId: string | null
}

const seedForm = (l: AdminLocation | null): LocationForm => ({
  country: l?.country_code ?? '',
  subdivision: l?.subdivision ?? null,
  installation: l?.installation ?? '',
  subArea: l?.sub_area ?? '',
  displayName: l?.display_name ?? '',
  command: l?.command ?? null,
  lat: l?.lat != null ? String(l.lat) : '',
  lon: l?.lon != null ? String(l.lon) : '',
  parentId: l?.parent_id ?? null,
})

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

const isCustomCommand = (cmd: string | null) =>
  !!cmd && !COMMAND_OPTIONS.includes(cmd as typeof COMMAND_OPTIONS[number])

export function AdminLocationDetail({
  location,
  onLocationUpdated,
  onSelectClinic,
  onDirtyChange,
  onHeaderActions,
  onCreated,
  onArchived,
}: AdminLocationDetailProps) {
  const [allLocations, setAllLocations] = useState<AdminLocation[]>([])
  const [clinicsAtLocation, setClinicsAtLocation] = useState<AdminClinic[]>([])

  const isCreateMode = location === null
  const form = useEntityForm<LocationForm>(seedForm(location))
  const { set: setField, bind: bindField, reset: resetForm, commit: commitForm } = form
  const v = form.values
  // UI flags, not record fields — kept out of the form so they never read as edits.
  const [displayOverridden, setDisplayOverridden] = useState(false)
  const [commandIsOther, setCommandIsOther] = useState(false)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmArchive, setConfirmArchive] = useState(false)

  // Edit overlay — tap card → PreviewOverlay anchored to the card rect.
  const cardRef = useRef<HTMLDivElement>(null)
  const [editAnchor, setEditAnchor] = useState<DOMRect | null>(null)
  const editing = isCreateMode || !!editAnchor

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

  const openEdit = () => {
    const rect = cardRef.current?.getBoundingClientRect()
    if (!rect || !location) return
    resetForm(seedForm(location))
    setDisplayOverridden(location.display_name !== deriveDisplayName(
      location.country_code, location.subdivision, location.installation, location.sub_area,
    ))
    setCommandIsOther(isCustomCommand(location.command))
    setError(null)
    setEditAnchor(rect)
  }

  const closeEdit = () => {
    setEditAnchor(null)
    setError(null)
  }

  /** Auto-update display_name as the source fields change, unless overridden. */
  useEffect(() => {
    if (!editing || displayOverridden) return
    setField('displayName', deriveDisplayName(v.country, v.subdivision, v.installation, v.subArea || null))
  }, [editing, displayOverridden, v.country, v.subdivision, v.installation, v.subArea, setField])

  useEffect(() => {
    onDirtyChange?.(editing && form.dirty)
  }, [editing, form.dirty, onDirtyChange])

  const handleSave = useCallback(async () => {
    if (!v.country.trim()) { setError('Country required.'); return }
    if (!v.installation.trim()) { setError('Installation required.'); return }
    if (!v.displayName.trim()) { setError('Display name required.'); return }

    const latNum = v.lat.trim() ? parseFloat(v.lat) : null
    const lonNum = v.lon.trim() ? parseFloat(v.lon) : null
    if (latNum !== null && (Number.isNaN(latNum) || latNum < -90 || latNum > 90)) {
      setError('Latitude must be between -90 and 90.'); return
    }
    if (lonNum !== null && (Number.isNaN(lonNum) || lonNum < -180 || lonNum > 180)) {
      setError('Longitude must be between -180 and 180.'); return
    }

    setSaving(true); setError(null)
    const payload = {
      country_code: v.country.trim().toUpperCase(),
      subdivision: v.subdivision || null,
      installation: v.installation.trim(),
      sub_area: v.subArea.trim() || null,
      display_name: v.displayName.trim(),
      command: v.command?.trim() || null,
      lat: latNum,
      lon: lonNum,
      parent_id: v.parentId,
    }

    if (isCreateMode) {
      const r = await createLocation(payload)
      setSaving(false)
      if (!r.success) { setError(r.error || 'Failed to create location'); return }
      commitForm()
      invalidate('locations')
      onCreated?.(r.id)
      return
    }
    const r = await updateLocation(location!.id, payload)
    setSaving(false)
    if (!r.success) { setError(r.error || 'Failed to update location'); return }
    commitForm()
    invalidate('locations')
    setEditAnchor(null)
    loadData()
  }, [v, isCreateMode, location, commitForm, onCreated, loadData])

  // Create mode publishes its Save pill (via ref so typing doesn't churn it).
  const handleSaveRef = useRef(handleSave)
  handleSaveRef.current = handleSave
  useEffect(() => {
    onHeaderActions?.(isCreateMode ? (
      <HeaderPill>
        <PillButton icon={Check} iconSize={18} accent="success" label="Save" onClick={() => handleSaveRef.current()} />
      </HeaderPill>
    ) : null)
    return () => onHeaderActions?.(null)
  }, [isCreateMode, onHeaderActions])

  // A referenced location can't be archived — name the blockers instead of
  // offering a confirm that would only fail.
  const requestArchive = () => {
    if (clinicsAtLocation.length === 0) { setConfirmArchive(true); return }
    const names = clinicsAtLocation.map(c => c.name)
    const remainder = names.length > 3 ? ` and ${names.length - 3} more` : ''
    setError(`Cannot archive — referenced by ${names.slice(0, 3).join(', ')}${remainder}. Reassign or archive ${names.length === 1 ? 'it' : 'them'} first.`)
  }

  const handleArchive = async () => {
    if (!location) return
    setSaving(true); setError(null)
    const result = await archiveLocation(location.id)
    setSaving(false)
    setConfirmArchive(false)
    if (!result.success) { setError(result.error || 'Failed to archive location'); return }
    invalidate('locations')
    onArchived?.()
  }

  const currentCountry = useMemo(
    () => findCountry(editing ? v.country : location?.country_code),
    [editing, v.country, location],
  )
  const availableSubdivisions = currentCountry?.subdivisions ?? []

  const formBody = (
    <div className={saving ? 'opacity-50 pointer-events-none' : undefined}>
      <CountryPickerRow value={v.country} onChange={(c) => { setField('country', c); setField('subdivision', null) }} />
      {availableSubdivisions.length > 0 && (
        <SubdivisionPickerRow value={v.subdivision} onChange={bindField('subdivision')} subdivisions={availableSubdivisions} />
      )}
      <TextInput value={v.installation} onChange={bindField('installation')} placeholder="Installation (e.g., Fort Bragg)" />
      <TextInput value={v.subArea} onChange={bindField('subArea')} placeholder="Sub-area (optional, e.g., Tower Barracks)" />
      <TextInput
        value={v.displayName}
        onChange={(val) => { setField('displayName', val); setDisplayOverridden(true) }}
        placeholder="Display name"
        hint={displayOverridden ? 'Auto-derive disabled (manually edited).' : null}
      />
      <CommandPickerRow
        value={v.command}
        isOther={commandIsOther}
        onChange={(val, isOther) => { setField('command', val); setCommandIsOther(isOther) }}
      />
      <div className="flex items-stretch border-b border-primary/6">
        <div className="flex-1 min-w-0">
          <TextInput value={v.lat} onChange={bindField('lat')} placeholder="Latitude" type="number" />
        </div>
        <div className="flex-1 min-w-0 border-l border-primary/6">
          <TextInput value={v.lon} onChange={bindField('lon')} placeholder="Longitude" type="number" />
        </div>
      </div>
      <LocationPickerInput
        value={v.parentId}
        onChange={bindField('parentId')}
        allLocations={allLocations}
        placeholder="Parent location (optional)"
        excludeDescendantsOf={location?.id ?? null}
      />
    </div>
  )

  return (
    <div>
      {error && !editAnchor && <div className="mb-3"><ErrorDisplay message={error} /></div>}

      <div ref={cardRef}>
        <SectionCard onClick={isCreateMode ? undefined : openEdit}>
          {isCreateMode ? formBody : location && (
            <div className="px-4 py-3">
              <LocationBreadcrumb
                locationId={location.id}
                allLocations={allLocations}
                excludeLeaf
                className="block text-[9pt] text-tertiary mb-1"
              />
              <p className="text-[10pt] font-semibold text-primary">{location.display_name}</p>
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
          )}
        </SectionCard>
      </div>

      {clinicsAtLocation.length > 0 && (
        <section className="mt-4">
          <SectionHeader>Clusters here</SectionHeader>
          <SectionCard className="divide-y divide-primary/6">
            {clinicsAtLocation.map(c => (
              <ListItemRow
                key={c.id}
                onClick={onSelectClinic && (() => onSelectClinic(c))}
                className="px-4 py-3 hover:bg-themeblue2/5 transition-colors"
                left={<Building2 size={16} className="text-themeblue2 shrink-0" />}
                center={<p className="text-[10pt] text-primary truncate">{c.name}</p>}
                right={onSelectClinic && <ChevronRight size={16} className="text-tertiary shrink-0" />}
              />
            ))}
          </SectionCard>
        </section>
      )}

      <PreviewOverlay
        isOpen={!!editAnchor}
        onClose={closeEdit}
        anchorRect={editAnchor}
        title={`Edit ${location?.display_name ?? 'location'}`}
        maxWidth={400}
        previewMaxHeight="70dvh"
        footer={editAnchor && (
          <FooterPill>
            <ActionButton icon={Archive} label="Archive location" variant="danger" onClick={requestArchive} />
          </FooterPill>
        )}
        rightFooter={editAnchor && (
          <FooterPill side="right">
            <ActionButton icon={Check} label="Save" variant="confirm" onClick={handleSave} />
          </FooterPill>
        )}
      >
        {editAnchor && (
          <div>
            {error && <div className="px-4 pt-3"><ErrorDisplay message={error} /></div>}
            {formBody}
          </div>
        )}
      </PreviewOverlay>

      <ConfirmDialog
        visible={confirmArchive}
        title={`Archive ${location?.display_name ?? 'location'}?`}
        subtitle="It disappears from location pickers."
        confirmLabel="Archive"
        variant="danger"
        processing={saving}
        onConfirm={handleArchive}
        onCancel={() => setConfirmArchive(false)}
        zIndex={Z.POPOVER + 30}
      />
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

