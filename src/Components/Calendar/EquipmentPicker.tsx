import { useCallback, useContext, useMemo, useState } from 'react'
import { ChevronDown, Package } from 'lucide-react'
import { PreviewOverlay } from '../PreviewOverlay'
import { StackNavContext } from '../stackNav'
import type { PropertyItemOption } from './EventForm'

interface EquipmentPickerProps {
  items: readonly PropertyItemOption[]
  selectedIds: readonly string[]
  onChange: (ids: string[]) => void
}

/** Pure list body — same rows whether drilled or in the nested-overlay fallback. */
function EquipmentRows({ items, filter, selectedSet, onToggle }: {
  items: readonly PropertyItemOption[]
  filter: string
  selectedSet: Set<string>
  onToggle: (id: string) => void
}) {
  const q = filter.trim().toLowerCase()
  const matched = q
    ? items.filter(i =>
        i.name.toLowerCase().includes(q)
        || (i.nsn ?? '').toLowerCase().includes(q)
        || (i.serial_number ?? '').toLowerCase().includes(q))
    : items

  if (matched.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-[10pt] text-tertiary">
        {q ? 'No equipment matches' : 'No equipment yet'}
      </div>
    )
  }

  return (
    <ul className="flex flex-col py-1">
      {matched.map(item => {
        const isSel = selectedSet.has(item.id)
        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onToggle(item.id)}
              className={`w-full flex items-center gap-2 px-4 py-3 text-left active:scale-[0.99] transition-all ${isSel ? 'bg-themeblue3/8' : ''}`}
            >
              <Package size={14} className={isSel ? 'text-themeblue2 shrink-0' : 'text-tertiary shrink-0'} />
              <span className={`flex-1 truncate text-[10pt] text-primary ${isSel ? 'font-medium' : ''}`}>
                {item.name}
              </span>
              {item.nsn && !isSel && (
                <span className="text-[9pt] text-tertiary shrink-0 truncate max-w-[40%]">{item.nsn}</span>
              )}
              {isSel && <div className="w-2 h-2 rounded-full bg-themeblue3 shrink-0" />}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * The DRILLED screen body. A pushScreen render is frozen at push time, so it can't
 * read the host's live `selectedIds` for the checkmarks — it owns a local selection
 * seeded from `initial` and commits every toggle through `onChange` (which stays in
 * sync with the host). Back (the stack header chevron) closes it; changes are live.
 */
function EquipmentSelectScreen({ items, initial, filter, onChange }: {
  items: readonly PropertyItemOption[]
  initial: string[]
  filter: string
  onChange: (ids: string[]) => void
}) {
  const [sel, setSel] = useState<string[]>(initial)
  const selSet = useMemo(() => new Set(sel), [sel])
  const toggle = (id: string) => {
    const next = selSet.has(id) ? sel.filter(x => x !== id) : [...sel, id]
    setSel(next)
    onChange(next)
  }
  return <EquipmentRows items={items} filter={filter} selectedSet={selSet} onToggle={toggle} />
}

/**
 * Equipment selection: a collapsed summary row that reveals a searchable
 * multi-select list. Inside an OverlayStack/Sheet drill stack it MORPHS the surface
 * in place (StackNavContext → pushScreen); with no stack it falls back to its own
 * nested PreviewOverlay. Toggle visuals are identical either way — active row gets
 * bg-themeblue3/8 + a themeblue3 dot. Multi-select commits live, so Back (not a
 * Done) closes the drill.
 */
export function EquipmentPicker({ items, selectedIds, onChange }: EquipmentPickerProps) {
  const stackNav = useContext(StackNavContext)
  const [visible, setVisible] = useState(false)
  const close = useCallback(() => setVisible(false), [])

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  const summary = useMemo(() => {
    const picked = items.filter(i => selectedSet.has(i.id))
    return picked.map(i => i.name).join(' · ')
  }, [items, selectedSet])

  const toggle = useCallback((id: string) => {
    if (selectedSet.has(id)) onChange(selectedIds.filter(x => x !== id))
    else onChange([...selectedIds, id])
  }, [selectedIds, selectedSet, onChange])

  const open = () => {
    if (stackNav) {
      stackNav.pushScreen({
        title: 'Equipment',
        searchPlaceholder: 'Search equipment…',
        render: (_p, _nav, filter) => (
          <EquipmentSelectScreen items={items} initial={[...selectedIds]} filter={filter} onChange={onChange} />
        ),
      })
    } else {
      setVisible(true)
    }
  }

  return (
    <div className="block border-b border-primary/6 last:border-b-0">
      <button
        type="button"
        onClick={open}
        className={`w-full bg-transparent px-4 py-3 text-left text-base md:text-sm flex items-center justify-between gap-3 focus:outline-none ${summary ? 'text-primary' : 'text-tertiary'}`}
      >
        <span className="truncate">{summary || 'Equipment'}</span>
        <ChevronDown size={16} className="shrink-0 text-tertiary" />
      </button>

      {!stackNav && (
        <PreviewOverlay
          isOpen={visible}
          onClose={close}
          anchorRect={null}
          maxWidth={360}
          previewMaxHeight="60dvh"
          title="Equipment"
          searchPlaceholder="Search equipment…"
          preview={(filter) => (
            <EquipmentRows items={items} filter={filter} selectedSet={selectedSet} onToggle={toggle} />
          )}
        />
      )}
    </div>
  )
}
