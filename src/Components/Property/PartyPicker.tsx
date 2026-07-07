import { useCallback, useContext, useState } from 'react'
import { Check, ChevronDown, Plus } from 'lucide-react'
import { TextInput } from '@/Components/primitives/FormInputs'
import { StackNavContext } from '@/Components/stackNav'
import { PreviewOverlay } from '../PreviewOverlay'

/**
 * PartyPicker — the ONE "who is this attributed to" control shared by every
 * property surface that names a person or entity: DA 2062 recipient (SignOutForm),
 * PMCS operator + mechanic (PmcsSheet), dispatch operator + TC (DispatchSheet).
 *
 * A party is either a CLUSTER MEMBER (searchable roster, carries the profile `id`
 * for custody linkage) or an OUTSIDE-CLUSTER entity (free-text name — no profile,
 * no id; the no-BAA-safe operational-vocabulary model). Callers that only persist
 * a display string (PMCS/Dispatch payloads) read `partyLabel(value)`; the DA 2062
 * keeps the discriminated `Party` so an internal recipient still maps to a real
 * `current_holder_id`.
 *
 * Rendering mirrors the FormInputs pickers: inside an OverlayStack / property sheet
 * stack it MORPHS the card in place (stackNav.pushScreen); with no stack (desktop
 * right pane) it falls back to the anchored PreviewOverlay popover. The row owns its
 * own hairline border so it drops straight into a stacked form card.
 */

export type Party =
  | { kind: 'member'; id: string; displayName: string }
  | { kind: 'external'; name: string }

/** The display string for a party — the single source both the picker row and any
 *  string-only payload (operator / mechanic / TC) read. Empty string when unset. */
export function partyLabel(p: Party | null): string {
  if (!p) return ''
  return p.kind === 'member' ? p.displayName : p.name
}

type Member = { id: string; displayName: string }

/** Cluster-member rows, filtered by the live search value. Single-select: tap = pick.
 *  `selectedId` is null whenever an external party is chosen, so the check only ever
 *  rides the currently-picked member. */
function MemberRows({ members, filter, selectedId, onPick }: {
  members: Member[]
  filter: string
  selectedId: string | null
  onPick: (m: Member) => void
}) {
  const q = filter.trim().toLowerCase()
  const shown = q ? members.filter((m) => m.displayName.toLowerCase().includes(q)) : members
  return (
    <div className="py-1">
      {shown.map((m) => {
        const selected = selectedId === m.id
        return (
          <button
            key={m.id}
            onClick={() => onPick(m)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-left active:bg-tertiary/5 border-b border-primary/6 last:border-b-0"
          >
            <span className={`text-sm ${selected ? 'text-primary font-medium' : 'text-secondary'}`}>{m.displayName}</span>
            {selected && <Check size={16} className="text-themeblue3 shrink-0" />}
          </button>
        )
      })}
      {shown.length === 0 && <p className="px-4 py-3 text-[10pt] text-tertiary">No members match.</p>}
    </div>
  )
}

/** Inline "add outside-cluster party" row for the drill screen (the desktop
 *  PreviewOverlay gets this via its own add-custom input). Primitive inline-add
 *  pattern: bare TextInput + circular Plus. */
function AddExternalRow({ placeholder, onAdd }: { placeholder: string; onAdd: (name: string) => void }) {
  const [name, setName] = useState('')
  const commit = () => { const n = name.trim(); if (n) { onAdd(n); setName('') } }
  return (
    <div className="flex items-center gap-2 border-t border-primary/6 px-4 py-2.5">
      <TextInput
        bare
        value={name}
        onChange={setName}
        placeholder={placeholder}
        inputClassName="flex-1 bg-transparent text-base md:text-sm text-primary placeholder:text-tertiary focus:outline-none"
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit() } }}
      />
      <button
        type="button"
        onClick={commit}
        aria-label="Add party"
        className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-themeblue3 text-white active:scale-95 transition-all"
      >
        <Plus size={16} />
      </button>
    </div>
  )
}

interface PartyPickerProps {
  /** Cluster roster — anything with an id + displayName (HolderInfo / mapped medic). */
  members: Member[]
  value: Party | null
  onChange: (party: Party) => void
  /** Row placeholder shown when nothing is picked (e.g. "Operator", "Sign to…"). */
  placeholder: string
  /** Picker overlay / drill-screen title. Defaults to `placeholder`. */
  title?: string
  searchPlaceholder?: string
  /** Placeholder for the add-outside-cluster input. */
  externalPlaceholder?: string
  /** Offer the free-text outside-cluster path. Default true. */
  allowExternal?: boolean
}

export function PartyPicker({
  members,
  value,
  onChange,
  placeholder,
  title = placeholder,
  searchPlaceholder = 'Search members…',
  externalPlaceholder = 'Outside cluster…',
  allowExternal = true,
}: PartyPickerProps) {
  // Inside a stack (OverlayStack / property sheet), morph the card; outside one
  // (desktop right pane), fall back to the anchored PreviewOverlay below.
  const stackNav = useContext(StackNavContext)
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState<DOMRect | null>(null)

  const selectedId = value?.kind === 'member' ? value.id : null
  const label = partyLabel(value)

  const pickMember = useCallback(
    (m: Member) => onChange({ kind: 'member', id: m.id, displayName: m.displayName }),
    [onChange],
  )
  const pickExternal = useCallback((name: string) => onChange({ kind: 'external', name }), [onChange])

  const openPicker = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (stackNav) {
      stackNav.pushScreen({
        title,
        searchPlaceholder,
        render: (_p, nav, filter = '') => (
          <>
            <MemberRows
              members={members}
              filter={filter}
              selectedId={selectedId}
              onPick={(m) => { pickMember(m); nav.pop() }}
            />
            {allowExternal && (
              <AddExternalRow placeholder={externalPlaceholder} onAdd={(name) => { pickExternal(name); nav.pop() }} />
            )}
          </>
        ),
      })
      return
    }
    setAnchor(e.currentTarget.getBoundingClientRect())
    setOpen(true)
  }

  return (
    <div className="block border-b border-primary/6 last:border-b-0">
      <button
        type="button"
        onClick={openPicker}
        className={`w-full bg-transparent px-4 py-3 text-left text-base md:text-sm flex items-center justify-between gap-3 focus:outline-none ${
          label ? 'text-primary' : 'text-tertiary'
        }`}
      >
        <span className="truncate">{label || placeholder}</span>
        <ChevronDown size={16} className="shrink-0 text-tertiary" />
      </button>

      {!stackNav && (
        <PreviewOverlay
          isOpen={open}
          onClose={() => setOpen(false)}
          anchorRect={anchor}
          title={title}
          searchPlaceholder={searchPlaceholder}
          onAdd={allowExternal ? (name) => { pickExternal(name); setOpen(false) } : undefined}
          addPlaceholder={externalPlaceholder}
          preview={(filter, clearFilter) => (
            <MemberRows
              members={members}
              filter={filter}
              selectedId={selectedId}
              onPick={(m) => { pickMember(m); clearFilter(); setOpen(false) }}
            />
          )}
        />
      )}
    </div>
  )
}
