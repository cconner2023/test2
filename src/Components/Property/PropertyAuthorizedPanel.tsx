import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { MoreHorizontal, Eye, Pencil, Trash2 } from 'lucide-react'
import { Section, SectionCard } from '../Section'
import { SearchInput } from '../SearchInput'
import { LiftedRowMenu } from '../LiftedRowMenu'
import { usePropertyStore } from '../../stores/usePropertyStore'
import { groupAuthorized } from '../../Utilities/propertyAuthorized'
import type { LocalPropertyItem } from '../../Types/PropertyTypes'

interface PropertyAuthorizedPanelProps {
  /** Present for host-call symmetry; the host owns the close affordance. */
  onClose?: () => void
  /** Open the canonical item form on a line — the host MORPHS this surface (right
   *  pane desktop / detail sheet mobile) from the list into the form, and back on save. */
  onEdit: (item: LocalPropertyItem) => void
  /** Open the read-only item detail — the host morphs the surface the same way. */
  onView: (item: LocalPropertyItem) => void
}

/** Surfaceless authorized-items (BOM) LIST. Hosted in the Property right pane (desktop) /
 *  detail sheet (mobile) by PropertyPanel — the host owns the header (ellipsis · + · close)
 *  AND the add/edit/view MORPH: tapping +, a row, or a row menu action calls back up so the
 *  host swaps the surface between this list and the canonical PropertyItemForm /
 *  PropertyItemDetail (no nested overlay). Shows the COMPLETE authorized list grouped by
 *  SKO, lines sorted by LIN; a search bar appears once populated. The list persists across
 *  devices (offline-first sync). Row "Delete" DE-AUTHORIZES (clears quantity_authorized) —
 *  the item stays on-hand as excess; it is NEVER deleted from the book. */
export function PropertyAuthorizedPanel({ onEdit, onView }: PropertyAuthorizedPanelProps) {
  const items = usePropertyStore(useShallow((s) => s.items))
  const editItem = usePropertyStore((s) => s.editItem)

  const { groups, trackedCount } = useMemo(() => groupAuthorized(items), [items])

  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()

  // Filter lines by name / NSN / LIN; drop groups left with no surviving lines.
  const shownGroups = useMemo(() => {
    if (!q) return groups
    return groups
      .map((g) => ({
        ...g,
        lines: g.lines.filter(
          (l) =>
            l.name.toLowerCase().includes(q) ||
            (l.nsn?.toLowerCase().includes(q) ?? false) ||
            (l.lin?.toLowerCase().includes(q) ?? false),
        ),
      }))
      .filter((g) => g.lines.length > 0)
  }, [groups, q])

  // Tap a row = edit; the trailing ellipsis opens View · Edit · Delete (de-authorize).
  const openEdit = (itemId: string) => {
    const item = items.find((i) => i.id === itemId)
    if (item) onEdit(item)
  }
  const [menu, setMenu] = useState<{ item: LocalPropertyItem; rect: DOMRect } | null>(null)
  const openRowMenu = (itemId: string, rect: DOMRect) => {
    const item = items.find((i) => i.id === itemId)
    if (item) setMenu({ item, rect })
  }

  // Remove-from-BOM = de-authorize (stays on-hand as excess), NEVER delete the item.
  const deauthorize = (itemId: string) => { void editItem(itemId, { quantity_authorized: null }) }

  // Empty state — no icon (USR), just the explanation; add via the header +.
  if (trackedCount === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 px-6 text-center">
        <p className="text-sm text-secondary">No authorized quantities yet.</p>
        <p className="text-[10pt] text-tertiary max-w-[260px]">
          Import a property CSV with a <span className="font-medium">Quantity Authorized</span> column,
          or add lines by hand with the <span className="font-medium">+</span> above.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <SearchInput value={query} onChange={setQuery} placeholder="Search authorized items" />

      {shownGroups.map((g) => (
        <Section key={g.skoId ?? '__top__'} title={g.skoName ?? 'Top-level items'}>
          <SectionCard>
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
                  <tr
                    key={l.itemId}
                    onClick={() => openEdit(l.itemId)}
                    className="border-b border-themeblue3/10 last:border-b-0 cursor-pointer active:bg-primary/5 transition-colors"
                  >
                    <td className="px-3 py-2 text-primary truncate max-w-[150px]">
                      {l.name}
                      {l.lin && <span className="block text-[9pt] text-tertiary">LIN {l.lin}</span>}
                      {l.nsn && <span className="block text-[9pt] text-tertiary">NSN {l.nsn}</span>}
                    </td>
                    <td className="px-3 py-2 text-right text-primary">
                      {l.authorized}
                      {l.unitOfIssue && <span className="text-[9pt] uppercase text-tertiary"> {l.unitOfIssue}</span>}
                      {/* Pack units (PR/SET/BOT) aren't 1:1 with individually-counted on-hand —
                          show the base-unit equivalent so the two columns are comparable. */}
                      {l.packSize != null && l.packSize > 1 && (
                        <span className="block text-[9pt] text-tertiary">= {l.authorizedBase} EA</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-secondary text-right">{l.onHand}<span className="text-[9pt] text-tertiary"> EA</span></td>
                    <td className="px-1 py-2 text-right">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openRowMenu(l.itemId, (e.currentTarget as HTMLElement).getBoundingClientRect()) }}
                        aria-label="Line actions"
                        className="w-7 h-7 rounded-full flex items-center justify-center text-tertiary active:scale-95 transition-all"
                      >
                        <MoreHorizontal size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionCard>
        </Section>
      ))}

      {menu && (
        <LiftedRowMenu
          isOpen
          anchorRect={menu.rect}
          onClose={() => setMenu(null)}
          layout="list"
          align="right"
          items={[
            { key: 'view', label: 'View', icon: Eye, onAction: () => onView(menu.item) },
            { key: 'edit', label: 'Edit', icon: Pencil, onAction: () => onEdit(menu.item) },
            { key: 'delete', label: 'Delete', icon: Trash2, destructive: true, onAction: () => deauthorize(menu.item.id) },
          ]}
        />
      )}
    </div>
  )
}
