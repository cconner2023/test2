import { useMemo, useState, useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Plus, Trash2, ClipboardList, FileSpreadsheet } from 'lucide-react'
import { Section, SectionCard } from '../Section'
import { TextInput } from '../FormInputs'
import { usePropertyStore } from '../../stores/usePropertyStore'
import { groupAuthorized } from '../../Utilities/propertyAuthorized'

interface PropertyAuthorizedPanelProps {
  /** Present for host-call symmetry with the other pane bodies; the host owns the
   *  close affordance, so this body never needs to call it. */
  onClose?: () => void
  /** Jump to the CSV import surface (host-owned). When provided, renders the
   *  "Import from CSV" affordance — the bulk path that seeds this list. */
  onImport?: () => void
}

/** Editable authorized-quantity cell. Local draft so typing is smooth; commits to the
 *  store on blur / Enter. Digits only; empty or unchanged reverts to the stored value. */
function AuthQtyInput({ value, onCommit }: { value: number; onCommit: (n: number) => void }) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => { setDraft(String(value)) }, [value])
  const commit = () => {
    const n = Number(draft)
    if (draft.trim() === '' || !Number.isFinite(n)) { setDraft(String(value)); return }
    const clamped = Math.max(0, Math.round(n))
    if (clamped !== value) onCommit(clamped)
    else setDraft(String(value))
  }
  return (
    <input
      type="text"
      inputMode="numeric"
      value={draft}
      onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
      aria-label="Authorized quantity"
      className="w-14 text-right bg-transparent border-b border-themeblue3/25 focus:border-themeblue3 focus:outline-none text-primary py-1"
    />
  )
}

/** Inline-add row for a new authorized line under a given SKO (null = top-level). Creates
 *  the item at on-hand 0 / authorized 1 — the user bumps the authorized qty inline after. */
function AddLineRow({ onAdd }: { onAdd: (name: string) => void }) {
  const [name, setName] = useState('')
  const submit = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setName('')
  }
  return (
    <div className="flex items-center border-t border-themeblue3/10">
      <div className="flex-1 min-w-0">
        <TextInput
          bare
          value={name}
          onChange={setName}
          onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
          placeholder="Add authorized item"
          inputClassName="w-full bg-transparent px-3 py-2.5 text-[10pt] text-primary placeholder:text-tertiary focus:outline-none"
        />
      </div>
      <button
        type="button"
        onClick={submit}
        disabled={!name.trim()}
        aria-label="Add authorized item"
        className="shrink-0 w-9 h-9 mr-2 rounded-full bg-themeblue3 text-white flex items-center justify-center disabled:opacity-30 active:scale-95 transition-all"
      >
        <Plus size={16} />
      </button>
    </div>
  )
}

/** Surfaceless authorized-items (BOM) manager. Hosted in the Property right pane
 *  (desktop) / detail sheet (mobile) by PropertyPanel — the host owns the header + close.
 *  Shows the COMPLETE authorized list grouped by SKO, with inline edit of the authorized
 *  quantity, add-a-line, and remove-from-BOM (de-authorize, never delete). Bulk seeding is
 *  the CSV import path (onImport). Authorized = property_items.quantity_authorized; the
 *  derived shortage lives in PropertyShortagePanel. */
export function PropertyAuthorizedPanel({ onImport }: PropertyAuthorizedPanelProps) {
  const items = usePropertyStore(useShallow((s) => s.items))
  const clinicId = usePropertyStore((s) => s.clinicId)
  const editItem = usePropertyStore((s) => s.editItem)
  const addItem = usePropertyStore((s) => s.addItem)

  const { groups, trackedCount } = useMemo(() => groupAuthorized(items), [items])

  // Ensure there is always a top-level bucket to add a standalone authorized line into,
  // even when nothing is tracked there yet.
  const renderGroups = useMemo(() => {
    if (groups.some((g) => g.skoId === null)) return groups
    return [...groups, { skoId: null, skoName: null, lines: [] }]
  }, [groups])

  const setAuth = (itemId: string, n: number) => { void editItem(itemId, { quantity_authorized: n }) }
  // Remove-from-BOM = de-authorize (stays on-hand as excess), NEVER delete the item.
  const deauthorize = (itemId: string) => { void editItem(itemId, { quantity_authorized: null }) }

  const addLine = (skoId: string | null, name: string) => {
    if (!clinicId) return
    void addItem({
      clinic_id: clinicId,
      name,
      nomenclature: null,
      nsn: null,
      lin: null,
      condition_code: 'serviceable',
      location_id: null,
      current_holder_id: null,
      parent_item_id: skoId,
      expiry_date: null,
      notes: null,
      is_serialized: false,
      serial_number: null,
      quantity: 0,
      location_tag_id: null,
      photo_url: null,
      visual_fingerprint: null,
      sub_cluster_id: null,
      quantity_authorized: 1,
      unit_of_issue: null,
      pack_size: null,
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {onImport && (
        <button
          type="button"
          onClick={onImport}
          className="flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-medium bg-themewhite2 border border-tertiary/20 text-primary"
        >
          <FileSpreadsheet className="w-4 h-4" />
          Import from CSV
        </button>
      )}

      {trackedCount === 0 && (
        <div className="flex flex-col items-center gap-3 py-8 px-6 text-center">
          <ClipboardList className="w-10 h-10 text-tertiary" />
          <p className="text-sm text-secondary">No authorized quantities yet.</p>
          <p className="text-[10pt] text-tertiary max-w-[260px]">
            Import a property CSV with a <span className="font-medium">Quantity Authorized</span> column,
            or add lines below to build the authorized list by hand.
          </p>
        </div>
      )}

      {renderGroups.map((g) => (
        <Section key={g.skoId ?? '__top__'} title={g.skoName ?? 'Top-level items'}>
          <SectionCard>
            {g.lines.length > 0 && (
              <table className="w-full text-[10pt]">
                <thead>
                  <tr className="border-b border-themeblue3/10">
                    <th className="text-left px-3 py-2 text-tertiary font-medium">Item</th>
                    <th className="text-right px-3 py-2 text-tertiary font-medium">Auth</th>
                    <th className="text-right px-3 py-2 text-tertiary font-medium">On hand</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {g.lines.map((l) => (
                    <tr key={l.itemId} className="border-b border-themeblue3/10 last:border-b-0">
                      <td className="px-3 py-2 text-primary truncate max-w-[150px]">
                        {l.name}
                        {l.nsn && <span className="block text-[9pt] text-tertiary">NSN {l.nsn}</span>}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <AuthQtyInput value={l.authorized} onCommit={(n) => setAuth(l.itemId, n)} />
                      </td>
                      <td className="px-3 py-2 text-secondary text-right">{l.onHand}</td>
                      <td className="px-1 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => deauthorize(l.itemId)}
                          aria-label="Remove from authorized list"
                          className="w-7 h-7 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <AddLineRow onAdd={(name) => addLine(g.skoId, name)} />
          </SectionCard>
        </Section>
      ))}
    </div>
  )
}
