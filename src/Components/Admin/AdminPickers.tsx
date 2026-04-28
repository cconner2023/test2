import { useState, useCallback, useMemo } from 'react'
import { X, Check, ChevronDown } from 'lucide-react'
import { PreviewOverlay } from '../PreviewOverlay'
import { ActionButton } from '../ActionButton'
import type { AdminUser, AdminClinic } from '../../lib/adminService'

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
            return <p className="text-[9pt] text-tertiary text-center py-4">No clinics match.</p>
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
        footer={
          <div className="bg-themewhite rounded-2xl shadow-lg px-1.5 py-1.5">
            <ActionButton icon={X} label="Cancel" onClick={close} />
          </div>
        }
      />
    </div>
  )
}

// ── ClinicMultiPickerInput (multi-select) ────────────────────────────────────

export const ClinicMultiPickerInput = ({
  selectedIds,
  onChange,
  allClinics,
  label,
  placeholder = 'Add clinic...',
  excludeId,
}: {
  selectedIds: string[]
  onChange: (ids: string[]) => void
  allClinics: AdminClinic[]
  label?: string
  placeholder?: string
  excludeId?: string
}) => {
  const [visible, setVisible] = useState(false)
  const close = useCallback(() => setVisible(false), [])

  const clinicMap = useMemo(() => new Map(allClinics.map(c => [c.id, c])), [allClinics])

  const toggle = useCallback((id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(sid => sid !== id))
    } else {
      onChange([...selectedIds, id])
    }
  }, [selectedIds, onChange])

  return (
    <div className="block border-b border-primary/6 last:border-b-0">
      {selectedIds.length > 0 && (
        <div className="px-4 pt-3 flex flex-wrap gap-1.5">
          {selectedIds.map(id => {
            const c = clinicMap.get(id)
            return (
              <span key={id} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-themeblue2/10 text-themeblue2 text-[10pt] font-medium border border-themeblue2/30">
                <span>{c ? c.name : id.slice(0, 8)}</span>
                {c && c.uics.length > 0 && (
                  <span className="text-themeblue2/60">{c.uics[0]}</span>
                )}
                <button
                  type="button"
                  onClick={() => onChange(selectedIds.filter(sid => sid !== id))}
                  className="hover:text-themeredred transition-colors"
                >
                  <X size={12} />
                </button>
              </span>
            )
          })}
        </div>
      )}
      <button
        type="button"
        onClick={() => setVisible(true)}
        className="w-full bg-transparent px-4 py-3 text-left text-base md:text-sm
                   flex items-center justify-between gap-3 focus:outline-none text-tertiary"
      >
        <span>{placeholder || label}</span>
        <ChevronDown size={16} className="shrink-0 text-tertiary" />
      </button>

      <PreviewOverlay
        isOpen={visible}
        onClose={close}
        anchorRect={null}
        maxWidth={320}
        title={label}
        searchPlaceholder="Search by name or UIC..."
        preview={(filter) => {
          const q = filter.toLowerCase()
          const filtered = allClinics.filter(c => {
            if (c.id === excludeId) return false
            if (!filter) return true
            return c.name.toLowerCase().includes(q) || c.uics.some(u => u.toLowerCase().includes(q))
          })
          if (filtered.length === 0) {
            return <p className="text-[9pt] text-tertiary text-center py-4">No clinics match.</p>
          }
          return (
            <div role="listbox" aria-multiselectable="true">
              {filtered.map(c => {
                const sel = selectedIds.includes(c.id)
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="option"
                    aria-selected={sel}
                    onClick={() => toggle(c.id)}
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
        footer={
          <div className="bg-themewhite rounded-2xl shadow-lg px-1.5 py-1.5">
            <ActionButton icon={Check} label="Done" onClick={close} />
          </div>
        }
      />
    </div>
  )
}

// ── UserPicker ───────────────────────────────────────────────────────────────

export const UserPicker = ({
  label, selectedIds, allUsers, onChange,
}: {
  label?: string; selectedIds: string[]; allUsers: AdminUser[]; onChange: (ids: string[]) => void
}) => {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)

  const userMap = new Map(allUsers.map((u) => [u.id, u]))

  const filtered = allUsers.filter((u) => {
    if (selectedIds.includes(u.id)) return false
    if (!search) return false
    const q = search.toLowerCase()
    return (
      u.email?.toLowerCase().includes(q) ||
      u.first_name?.toLowerCase().includes(q) ||
      u.last_name?.toLowerCase().includes(q)
    )
  }).slice(0, 8)

  const removeUser = (id: string) => onChange(selectedIds.filter((uid) => uid !== id))
  const addUser = (id: string) => {
    onChange([...selectedIds, id])
    setSearch('')
    setOpen(false)
  }

  return (
    <div className="block border-b border-primary/6 last:border-b-0">
      {selectedIds.length > 0 && (
        <div className="px-4 pt-3 flex flex-wrap gap-1.5">
          {selectedIds.map((id) => {
            const u = userMap.get(id)
            const display = u ? `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email : id.slice(0, 8)
            return (
              <span key={id} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-themepurple/10 text-themepurple text-[10pt] font-medium border border-themepurple/30">
                {display}
                <button type="button" onClick={() => removeUser(id)} className="hover:text-themeredred transition-colors">
                  <X size={12} />
                </button>
              </span>
            )
          })}
        </div>
      )}
      <div className="relative">
        <input
          type="text" value={search}
          onChange={(e) => { setSearch(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder={label ?? 'Search users by name or email'}
          className="w-full bg-transparent px-4 py-3 text-base md:text-sm text-primary placeholder:text-tertiary focus:outline-none"
        />
        {open && filtered.length > 0 && (
          <div className="absolute z-10 mt-1 left-2 right-2 rounded-2xl bg-themewhite shadow-lg max-h-48 overflow-y-auto">
            {filtered.map((u) => (
              <button key={u.id} type="button"
                onClick={() => addUser(u.id)}
                className="w-full text-left px-4 py-2 text-sm hover:bg-themeblue2/10 active:scale-95 transition-all border-b border-primary/6 last:border-b-0">
                <span className="text-primary font-medium">{u.first_name} {u.last_name}</span>
                <span className="text-tertiary ml-2">{u.email}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
