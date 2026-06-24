import { useCallback, useMemo, useState } from 'react'
import { ChevronDown, Package } from 'lucide-react'
import { PreviewOverlay } from '../PreviewOverlay'
import type { PropertyItemOption } from './EventForm'

interface EquipmentPickerProps {
  items: readonly PropertyItemOption[]
  selectedIds: readonly string[]
  onChange: (ids: string[]) => void
}

/**
 * Equipment selection mirrors LocationPicker (map overlays): a collapsed summary
 * row that opens a searchable PreviewOverlay. Same toggle visuals — active row
 * gets bg-themeblue3/8 + a themeblue3 dot, names at text-[10pt]. No header count.
 */
export function EquipmentPicker({ items, selectedIds, onChange }: EquipmentPickerProps) {
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

  return (
    <div className="block border-b border-primary/6 last:border-b-0">
      <button
        type="button"
        onClick={() => setVisible(true)}
        className={`w-full bg-transparent px-4 py-3 text-left text-base md:text-sm flex items-center justify-between gap-3 focus:outline-none ${summary ? 'text-primary' : 'text-tertiary'}`}
      >
        <span className="truncate">{summary || 'Equipment'}</span>
        <ChevronDown size={16} className="shrink-0 text-tertiary" />
      </button>

      <PreviewOverlay
        isOpen={visible}
        onClose={close}
        anchorRect={null}
        maxWidth={360}
        previewMaxHeight="60dvh"
        title="Equipment"
        searchPlaceholder="Search equipment…"
        preview={(filter) => {
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
                      onClick={() => toggle(item.id)}
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
        }}
      />
    </div>
  )
}
