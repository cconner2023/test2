import { useState, useCallback, useMemo } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { PreviewOverlay } from '../PreviewOverlay'
import type { AdminClinic, AdminLocation } from '../../lib/adminService'
import { LocationBreadcrumb } from './LocationBreadcrumb'

// ── Shared UIC chip ─────────────────────────────────────────────────────────

function UicChip({ uic }: { uic: string }) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9pt] font-medium border bg-themeyellow/10 text-themeyellow border-themeyellow/30">
      {uic}
    </span>
  )
}

// ── ClinicPickerInput (single-select) ────────────────────────────────────────

export const ClinicPickerInput = ({
  value,
  onChange,
  allClinics,
  placeholder = 'Select clinic...',
  label,
  excludeId,
}: {
  value: string
  onChange: (id: string) => void
  allClinics: AdminClinic[]
  placeholder?: string
  label?: string
  excludeId?: string
}) => {
  const [visible, setVisible] = useState(false)
  const close = useCallback(() => setVisible(false), [])

  const selected = allClinics.find(c => c.id === value) ?? null

  return (
    <div className="block border-b border-primary/6 last:border-b-0">
      <button
        type="button"
        onClick={() => setVisible(true)}
        className={`w-full bg-transparent px-4 py-3 text-left text-base md:text-sm
                   flex items-center justify-between gap-3 focus:outline-none ${
                     value ? 'text-primary' : 'text-tertiary'
                   }`}
      >
        <div className="flex-1 min-w-0 flex items-center gap-2 truncate">
          <span className="truncate">{selected ? selected.name : (placeholder || label)}</span>
          {selected && selected.uics.length > 0 && (
            <span className="text-tertiary text-[10pt] shrink-0">{selected.uics.join(' · ')}</span>
          )}
        </div>
        <ChevronDown size={16} className="shrink-0 text-tertiary" />
      </button>

      <PreviewOverlay
        isOpen={visible}
        onClose={close}
        anchorRect={null}
        maxWidth={320}
        title={label ?? placeholder}
        searchPlaceholder="Search by name or UIC..."
        preview={(filter) => {
          const q = filter.toLowerCase()
          const filtered = allClinics.filter(c => {
            if (c.id === excludeId) return false
            if (!filter) return true
            return c.name.toLowerCase().includes(q) || c.uics.some(u => u.toLowerCase().includes(q))
          })
          if (filtered.length === 0) {
            return <p className="text-[9pt] text-tertiary text-center py-4">No clusters match.</p>
          }
          return (
            <div role="listbox">
              {filtered.map(c => {
                const sel = c.id === value
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="option"
                    aria-selected={sel}
                    onClick={() => { onChange(c.id); close() }}
                    className="w-full text-left px-3.5 py-2.5 hover:bg-primary/5 active:bg-primary/10 transition-colors flex items-center justify-between gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${sel ? 'text-themeblue2 font-medium' : 'text-primary'}`}>{c.name}</p>
                      {c.uics.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {c.uics.map(uic => <UicChip key={uic} uic={uic} />)}
                        </div>
                      )}
                    </div>
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

// ── LocationPickerInput (single-select, grouped by country) ─────────────────

export const LocationPickerInput = ({
  value,
  onChange,
  allLocations,
  placeholder = 'Select location...',
  label,
  excludeId,
  excludeDescendantsOf,
}: {
  value: string | null
  onChange: (id: string | null) => void
  allLocations: AdminLocation[]
  placeholder?: string
  label?: string
  /** Hide this id from the option list — used to prevent self-selection. */
  excludeId?: string | null
  /** Hide any descendant of this id — used when picking a parent to avoid cycles
   *  (the trigger would reject anyway, but this prevents the bad option from showing). */
  excludeDescendantsOf?: string | null
}) => {
  const [visible, setVisible] = useState(false)
  const close = useCallback(() => setVisible(false), [])

  const selected = useMemo(
    () => allLocations.find(l => l.id === value) ?? null,
    [allLocations, value],
  )

  /** Set of ids descended from excludeDescendantsOf (inclusive). */
  const blockedIds = useMemo(() => {
    const blocked = new Set<string>()
    if (excludeId) blocked.add(excludeId)
    if (!excludeDescendantsOf) return blocked
    // BFS down the parent_id graph
    blocked.add(excludeDescendantsOf)
    let added = true
    while (added) {
      added = false
      for (const l of allLocations) {
        if (l.parent_id && blocked.has(l.parent_id) && !blocked.has(l.id)) {
          blocked.add(l.id)
          added = true
        }
      }
    }
    return blocked
  }, [allLocations, excludeId, excludeDescendantsOf])

  const visibleLocations = useMemo(
    () => allLocations.filter(l => !blockedIds.has(l.id)),
    [allLocations, blockedIds],
  )

  return (
    <div className="block border-b border-primary/6 last:border-b-0">
      <button
        type="button"
        onClick={() => setVisible(true)}
        className={`w-full bg-transparent px-4 py-3 text-left text-base md:text-sm
                   flex items-center justify-between gap-3 focus:outline-none ${
                     value ? 'text-primary' : 'text-tertiary'
                   }`}
      >
        <div className="flex-1 min-w-0 flex items-center gap-2 truncate">
          <span className="truncate">{selected ? selected.display_name : (placeholder || label)}</span>
          {selected?.command && (
            <span className="text-tertiary text-[10pt] shrink-0">{selected.command}</span>
          )}
        </div>
        <ChevronDown size={16} className="shrink-0 text-tertiary" />
      </button>

      <PreviewOverlay
        isOpen={visible}
        onClose={close}
        anchorRect={null}
        maxWidth={360}
        title={label ?? 'Location'}
        searchPlaceholder="Search by post, country, or code..."
        preview={(filter) => {
          const q = filter.toLowerCase().trim()
          const filtered = visibleLocations.filter(l => {
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

          if (filtered.length === 0) {
            return <p className="text-[9pt] text-tertiary text-center py-4">No locations match.</p>
          }

          // Group consecutive rows by country_code (data is pre-sorted by country, installation, sub_area).
          const groups: Array<{ country: string; rows: AdminLocation[] }> = []
          for (const row of filtered) {
            const last = groups[groups.length - 1]
            if (last && last.country === row.country_code) last.rows.push(row)
            else groups.push({ country: row.country_code, rows: [row] })
          }

          return (
            <div role="listbox">
              {value && (
                <button
                  type="button"
                  onClick={() => { onChange(null); close() }}
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
                    const sel = l.id === value
                    return (
                      <button
                        key={l.id}
                        type="button"
                        role="option"
                        aria-selected={sel}
                        onClick={() => { onChange(l.id); close() }}
                        className="w-full text-left px-3.5 py-2.5 hover:bg-primary/5 active:bg-primary/10 transition-colors flex items-center justify-between gap-2"
                      >
                        <div className="flex-1 min-w-0">
                          {l.parent_id && (
                            <LocationBreadcrumb
                              locationId={l.id}
                              allLocations={allLocations}
                              excludeLeaf
                              className="block text-[8pt] text-tertiary/70 mb-0.5"
                            />
                          )}
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
        }}
      />
    </div>
  )
}
