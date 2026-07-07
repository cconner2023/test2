import { useCallback, useContext, useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { PreviewOverlay } from '../PreviewOverlay'
import { StackNavContext } from '../stackNav'
import { UserAvatar } from '../Settings/UserAvatar'

export interface MedicOption {
  id: string
  initials: string
  name: string
  credential?: string
  avatarId?: string | null
  firstName?: string | null
  lastName?: string | null
}

interface PersonnelPickerProps {
  medics: readonly MedicOption[]
  selectedIds: readonly string[]
  onChange: (ids: string[]) => void
  isMobile?: boolean
}

/** Pure list body — same rows whether drilled or in the nested-overlay fallback. */
function PersonnelRows({ medics, filter, selectedSet, onToggle, isMobile }: {
  medics: readonly MedicOption[]
  filter: string
  selectedSet: Set<string>
  onToggle: (id: string) => void
  isMobile: boolean
}) {
  const q = filter.trim().toLowerCase()
  const matched = q
    ? medics.filter(m =>
        m.name.toLowerCase().includes(q)
        || (m.credential ?? '').toLowerCase().includes(q))
    : medics

  if (matched.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-[10pt] text-tertiary">
        {q ? 'No personnel match' : 'No personnel available'}
      </div>
    )
  }

  return (
    <ul className="flex flex-col py-1">
      {matched.map(medic => {
        const isSel = selectedSet.has(medic.id)
        return (
          <li key={medic.id}>
            <button
              type="button"
              onClick={() => onToggle(medic.id)}
              className={`w-full flex items-center text-left transition-all duration-150 active:scale-[0.99] ${
                isMobile ? 'gap-3 px-4 py-3' : 'gap-2 px-4 py-2.5'
              } ${isSel ? 'bg-themeblue3/8' : ''}`}
            >
              <UserAvatar
                avatarId={medic.avatarId}
                firstName={medic.firstName}
                lastName={medic.lastName}
                className={isMobile ? 'w-10 h-10' : 'w-7 h-7'}
              />
              <div className="flex-1 min-w-0">
                <p className={`font-medium text-primary truncate ${isMobile ? 'text-sm' : 'text-[10pt]'} ${isSel ? 'text-themeblue2' : ''}`}>{medic.name}</p>
                {medic.credential && (
                  <p className="text-[9pt] text-tertiary truncate">{medic.credential}</p>
                )}
              </div>
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
function PersonnelSelectScreen({ medics, initial, filter, onChange, isMobile }: {
  medics: readonly MedicOption[]
  initial: string[]
  filter: string
  onChange: (ids: string[]) => void
  isMobile: boolean
}) {
  const [sel, setSel] = useState<string[]>(initial)
  const selSet = useMemo(() => new Set(sel), [sel])
  const toggle = (id: string) => {
    const next = selSet.has(id) ? sel.filter(x => x !== id) : [...sel, id]
    setSel(next)
    onChange(next)
  }
  return <PersonnelRows medics={medics} filter={filter} selectedSet={selSet} onToggle={toggle} isMobile={isMobile} />
}

/**
 * Personnel assignment: a collapsed summary row that reveals a searchable
 * multi-select roster. Mirrors EquipmentPicker — inside an OverlayStack/Sheet drill
 * stack it MORPHS the surface in place (StackNavContext → pushScreen); with no stack
 * it falls back to its own nested PreviewOverlay. Toggle visuals match — active row
 * gets bg-themeblue3/8 + a themeblue3 dot. Multi-select commits live, so Back (not a
 * Done) closes the drill.
 */
export function PersonnelPicker({ medics, selectedIds, onChange, isMobile = false }: PersonnelPickerProps) {
  const stackNav = useContext(StackNavContext)
  const [visible, setVisible] = useState(false)
  const close = useCallback(() => setVisible(false), [])

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  const summary = useMemo(() => {
    const picked = medics.filter(m => selectedSet.has(m.id))
    return picked.map(m => m.name).join(' · ')
  }, [medics, selectedSet])

  const toggle = useCallback((id: string) => {
    if (selectedSet.has(id)) onChange(selectedIds.filter(x => x !== id))
    else onChange([...selectedIds, id])
  }, [selectedIds, selectedSet, onChange])

  const open = () => {
    if (stackNav) {
      stackNav.pushScreen({
        title: 'Personnel',
        searchPlaceholder: 'Search personnel…',
        render: (_p, _nav, filter) => (
          <PersonnelSelectScreen medics={medics} initial={[...selectedIds]} filter={filter} onChange={onChange} isMobile={isMobile} />
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
        <span className="truncate">{summary || 'Personnel'}</span>
        <ChevronDown size={16} className="shrink-0 text-tertiary" />
      </button>

      {!stackNav && (
        <PreviewOverlay
          isOpen={visible}
          onClose={close}
          anchorRect={null}
          maxWidth={360}
          previewMaxHeight="60dvh"
          title="Personnel"
          searchPlaceholder="Search personnel…"
          preview={(filter) => (
            <PersonnelRows medics={medics} filter={filter} selectedSet={selectedSet} onToggle={toggle} isMobile={isMobile} />
          )}
        />
      )}
    </div>
  )
}
