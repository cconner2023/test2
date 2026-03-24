import { useState } from 'react'
import { X, Plus } from 'lucide-react'
import type { AdminUser, AdminClinic } from '../../lib/adminService'

export const ChipInput = ({
  label, values, onChange, placeholder, transform,
}: {
  label?: string; values: string[]; onChange: (vals: string[]) => void
  placeholder?: string; transform?: (val: string) => string
}) => {
  const [inputValue, setInputValue] = useState('')

  const addChip = () => {
    const val = transform ? transform(inputValue.trim()) : inputValue.trim()
    if (val && !values.includes(val)) {
      onChange([...values, val])
    }
    setInputValue('')
  }

  const removeChip = (idx: number) => {
    onChange(values.filter((_, i) => i !== idx))
  }

  return (
    <div>
      {label && <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">{label}</span>}
      <div className="mt-1 flex flex-wrap gap-1.5 mb-2">
        {values.map((val, idx) => (
          <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-themeblue2/10 text-themeblue2 text-xs font-medium border border-themeblue2/30">
            {val}
            <button type="button" onClick={() => removeChip(idx)} className="hover:text-themeredred transition-colors">
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text" value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addChip() } }}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 rounded-lg bg-themewhite2 text-primary text-sm
                     border border-tertiary/10 focus:border-themeblue2 focus:outline-none
                     transition-colors placeholder:text-tertiary/30"
        />
        <button type="button" onClick={addChip} disabled={!inputValue.trim()}
          className="shrink-0 w-10 h-10 rounded-full bg-themeblue3 text-white flex items-center justify-center disabled:opacity-30 active:scale-95 transition-all">
          <Plus size={16} />
        </button>
      </div>
    </div>
  )
}

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
    <div>
      {label && <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">{label}</span>}
      <div className="mt-1 flex flex-wrap gap-1.5 mb-2">
        {selectedIds.map((id) => {
          const u = userMap.get(id)
          const display = u ? `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email : id.slice(0, 8)
          return (
            <span key={id} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-themepurple/10 text-themepurple text-xs font-medium border border-themepurple/30">
              {display}
              <button type="button" onClick={() => removeUser(id)} className="hover:text-themeredred transition-colors">
                <X size={12} />
              </button>
            </span>
          )
        })}
      </div>
      <div className="relative">
        <input
          type="text" value={search}
          onChange={(e) => { setSearch(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Search users by name or email..."
          className="w-full px-3 py-2 rounded-lg bg-themewhite2 text-primary text-sm
                     border border-tertiary/10 focus:border-themeblue2 focus:outline-none
                     transition-colors placeholder:text-tertiary/30"
        />
        {open && filtered.length > 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-lg bg-themewhite2 border border-tertiary/10 shadow-lg max-h-48 overflow-y-auto">
            {filtered.map((u) => (
              <button key={u.id} type="button"
                onClick={() => addUser(u.id)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-themeblue2/10 active:scale-95 transition-all">
                <span className="text-primary font-medium">{u.first_name} {u.last_name}</span>
                <span className="text-tertiary/50 ml-2">{u.email}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export const ClinicPicker = ({
  label, selectedIds, allClinics, excludeId, onChange,
}: {
  label?: string; selectedIds: string[]; allClinics: AdminClinic[]; excludeId?: string; onChange: (ids: string[]) => void
}) => {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)

  const clinicMap = new Map(allClinics.map((c) => [c.id, c]))

  const filtered = allClinics.filter((c) => {
    if (selectedIds.includes(c.id)) return false
    if (c.id === excludeId) return false
    if (!search) return false
    const q = search.toLowerCase()
    return c.name.toLowerCase().includes(q) || c.uics.some((u) => u.toLowerCase().includes(q))
  }).slice(0, 8)

  const removeClinic = (id: string) => onChange(selectedIds.filter((cid) => cid !== id))
  const addClinic = (id: string) => {
    onChange([...selectedIds, id])
    setSearch('')
    setOpen(false)
  }

  return (
    <div>
      {label && <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">{label}</span>}
      <div className="mt-1 flex flex-wrap gap-1.5 mb-2">
        {selectedIds.map((id) => {
          const c = clinicMap.get(id)
          const display = c ? c.name : id.slice(0, 8)
          return (
            <span key={id} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-themeblue2/10 text-themeblue2 text-xs font-medium border border-themeblue2/30">
              {display}
              <button type="button" onClick={() => removeClinic(id)} className="hover:text-themeredred transition-colors">
                <X size={12} />
              </button>
            </span>
          )
        })}
      </div>
      <div className="relative">
        <input
          type="text" value={search}
          onChange={(e) => { setSearch(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Search clinics by name or UIC..."
          className="w-full px-3 py-2 rounded-lg bg-themewhite2 text-primary text-sm
                     border border-tertiary/10 focus:border-themeblue2 focus:outline-none
                     transition-colors placeholder:text-tertiary/30"
        />
        {open && filtered.length > 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-lg bg-themewhite2 border border-tertiary/10 shadow-lg max-h-48 overflow-y-auto">
            {filtered.map((c) => (
              <button key={c.id} type="button"
                onClick={() => addClinic(c.id)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-themeblue2/10 active:scale-95 transition-all">
                <span className="text-primary font-medium">{c.name}</span>
                {c.uics.length > 0 && <span className="text-tertiary/50 ml-2">{c.uics.join(', ')}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
