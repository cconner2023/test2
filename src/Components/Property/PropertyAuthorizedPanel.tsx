import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { ChevronRight, ChevronDown, MoreHorizontal, Eye, Pencil, Trash2 } from 'lucide-react'
import { SearchInput } from '@/Components/primitives/SearchInput'
import { LiftedRowMenu } from '@/Components/primitives/LiftedRowMenu'
import { ConfirmDialog } from '@/Components/primitives/ConfirmDialog'
import { FillBar } from '@/Components/primitives/FillBar'
import { usePropertyStore } from '../../stores/usePropertyStore'
import { groupAuthorized, isAuthTarget, lineKeyOf } from '../../Utilities/propertyAuthorized'
import type { LocalPropertyItem } from '../../Types/PropertyTypes'

interface PropertyAuthorizedPanelProps {
  /** Present for host-call symmetry; the host owns the close affordance. */
  onClose?: () => void
  /** Open the canonical item form on a line — the host MORPHS this surface (right
   *  pane desktop / detail sheet mobile) from the list into the form, and back on save. */
  onEdit: (item: LocalPropertyItem) => void
  /** Open the read-only item detail — the host morphs the surface the same way. A LIN header
   *  tap and a component tap both route here; the detail's "On hand" section is where the
   *  located stacks that fill a line are listed (and tapped to locate on the map). */
  onView: (item: LocalPropertyItem) => void
}

/** Cluster Hand Receipt (authorized/BOM) rendered as a TREE: each LIN is a collapsible parent
 *  node; its authorized components nest beneath it. Mirrors the property location tree idiom —
 *  a LIN-header TAP and a COMPONENT TAP both open the read-only detail (onView). The located
 *  stacks that fill a component's on-hand are listed in that detail's "On hand" section
 *  (PropertyItemDetail), each tapping through to locate the stack on the map. The trailing
 *  ellipsis opens View · Edit · Delete. LINs (standalone item-LINs AND vehicle-LINs) are
 *  editable here.
 *  Hosted in the Property right pane (desktop) / detail sheet (mobile); the host owns the
 *  header (ellipsis · + · close) and the view/edit morph. Offline-first; persists across devices.
 *
 *  DELETE semantics: a COMPONENT "Delete" STRIPS the LIN association from every item filling the
 *  line (parent_item_id/lin cleared → drops into the Unassigned/top-level bucket, kept on-hand)
 *  and removes the bare location-less authorized target; the filler is never de-authorized in
 *  place and never deleted. A LIN "Delete" (confirm) does the same to every child, then removes
 *  the LIN container — for a vehicle-LIN this un-LINs the vehicle; its zone remains. */
export function PropertyAuthorizedPanel({ onEdit, onView }: PropertyAuthorizedPanelProps) {
  const { items, editItem, removeItem } = usePropertyStore(
    useShallow((s) => ({ items: s.items, editItem: s.editItem, removeItem: s.removeItem })),
  )

  const { groups, trackedCount, linCount } = useMemo(() => groupAuthorized(items), [items])

  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()

  // Collapse state per LIN node (keyed by group id; the top-level bucket uses '__top__').
  // Default expanded.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

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

  // The ellipsis row menu — carries whether it anchors a LIN (delete = remove the LIN) or a
  // component (delete = de-authorize).
  const [menu, setMenu] = useState<{ item: LocalPropertyItem; kind: 'lin' | 'component'; rect: DOMRect } | null>(null)
  const openMenu = (item: LocalPropertyItem, kind: 'lin' | 'component', rect: DOMRect) => setMenu({ item, kind, rect })

  // Component "Delete" = STRIP the LIN association from everything filling this line so the
  // physical stock drops into the Unassigned (top-level) bucket; the location-less authorized
  // TARGET (a bare requirement marker with no stock) is removed. Never de-authorize-in-place,
  // never delete a filler. "Everything filling this line" = live items under the same LIN that
  // fold to the same (LIN + NSN) key as the tapped row.
  const deleteComponent = async (comp: LocalPropertyItem) => {
    const key = lineKeyOf(comp)
    const members = items.filter(
      (i) => !i.deleted_at && !i.turned_in_at && i.parent_item_id === comp.parent_item_id && lineKeyOf(i) === key,
    )
    for (const m of members) {
      if (isAuthTarget(m)) await removeItem(m.id)
      else await editItem(m.id, { parent_item_id: null, lin: null, quantity_authorized: null })
    }
  }

  // LIN "Delete" (confirmed) = strip every child's LIN association so it lands in Unassigned
  // (kept on-hand), remove the location-less authorized targets, then remove the LIN container.
  // Detaching before removeItem also stops removeItem's cascade from tombstoning the survivors.
  const [pendingDeleteLin, setPendingDeleteLin] = useState<LocalPropertyItem | null>(null)
  const confirmDeleteLin = async () => {
    const lin = pendingDeleteLin
    setPendingDeleteLin(null)
    if (!lin) return
    for (const child of items.filter((i) => i.parent_item_id === lin.id && !i.deleted_at && !i.turned_in_at)) {
      if (isAuthTarget(child)) await removeItem(child.id)
      else await editItem(child.id, { parent_item_id: null, lin: null, quantity_authorized: null })
    }
    await removeItem(lin.id)
  }

  // Empty state — only when the hand receipt is truly empty (no LINs AND no lines); an empty
  // LIN still renders its node.
  if (trackedCount === 0 && linCount === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 px-6 text-center">
        <p className="text-sm text-secondary">No hand receipt yet.</p>
        <p className="text-[10pt] text-tertiary max-w-[260px]">
          Start by adding the <span className="font-medium">LINs</span> you're signed for with the{' '}
          <span className="font-medium">+</span> above — then assign your items to each. Or import a
          property CSV with a <span className="font-medium">Quantity Authorized</span> column.
        </p>
      </div>
    )
  }

  const ellipsisCls =
    'w-7 h-7 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all shrink-0'

  return (
    <div className="flex flex-col gap-2">
      <SearchInput value={query} onChange={setQuery} placeholder="Search authorized items" />

      <div className="flex flex-col py-1">
        {shownGroups.map((g) => {
          const key = g.skoId ?? '__top__'
          const container = g.skoId ? items.find((i) => i.id === g.skoId) ?? null : null
          const isCollapsed = collapsed.has(key)
          return (
            <div key={key}>
              {/* LIN node header */}
              <div
                className="group flex items-center gap-2 py-2 pr-3 border-l-2 border-l-transparent hover:bg-secondary/5 transition-colors"
                style={{ paddingLeft: '16px' }}
              >
                <button
                  type="button"
                  className="p-0.5 rounded hover:bg-secondary/10 text-tertiary shrink-0"
                  onClick={() => toggle(key)}
                  aria-label={isCollapsed ? 'Expand' : 'Collapse'}
                >
                  {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                </button>
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => container && onView(container)}
                >
                  <span className="block text-[10pt] font-bold text-primary truncate">{g.skoName ?? 'Top-level items'}</span>
                  {container?.lin && <span className="block text-[9pt] text-tertiary">LIN {container.lin}</span>}
                </button>
                {/* Fill rollup for the whole LIN — Σ on-hand vs Σ authorized (base units) as a
                    two-tone completion bar, mirroring the supervisor readiness bars. */}
                {g.authorizedBaseTotal > 0 && (
                  <FillBar percent={g.fillPercent} className="w-28 shrink-0" />
                )}
                {container && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); openMenu(container, 'lin', (e.currentTarget as HTMLElement).getBoundingClientRect()) }}
                    aria-label="LIN actions"
                    className={ellipsisCls}
                  >
                    <MoreHorizontal size={15} />
                  </button>
                )}
              </div>

              {/* Components — a TAP opens the line's read-only detail (onView), where the
                  "On hand" section lists the located stacks filling it (tap → locate on map). */}
              {!isCollapsed &&
                g.lines.map((l) => {
                  const comp = items.find((i) => i.id === l.itemId)
                  return (
                    <div
                      key={l.itemId}
                      className="group flex items-center gap-2 py-2 pr-3 border-l-2 border-l-transparent hover:bg-secondary/5 transition-colors"
                      style={{ paddingLeft: '38px' }}
                    >
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => comp && onView(comp)}
                      >
                        <span className="block text-[10pt] text-primary truncate">{l.name}</span>
                        {l.nomenclature && <span className="block text-[9pt] text-tertiary truncate">{l.nomenclature}</span>}
                        {l.nsn && <span className="block text-[9pt] text-tertiary truncate">Material/NSN {l.nsn}</span>}
                      </button>
                      {/* On-hand / authorized (base EA units, directly comparable) as a fill bar —
                          the count stays the trailing value; the bar reads red when short. */}
                      {l.authorizedBase > 0 ? (
                        <FillBar
                          percent={Math.round((Math.min(l.onHand, l.authorizedBase) / l.authorizedBase) * 100)}
                          value={`${l.onHand} / ${l.authorizedBase}`}
                          className="w-28 shrink-0"
                        />
                      ) : (
                        <span className="text-[10pt] text-tertiary tabular-nums shrink-0">
                          {l.onHand} / {l.authorizedBase}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); comp && openMenu(comp, 'component', (e.currentTarget as HTMLElement).getBoundingClientRect()) }}
                        aria-label="Line actions"
                        className={ellipsisCls}
                      >
                        <MoreHorizontal size={15} />
                      </button>
                    </div>
                  )
                })}
            </div>
          )
        })}
      </div>

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
            menu.kind === 'lin'
              ? { key: 'delete', label: 'Delete', icon: Trash2, destructive: true, onAction: () => setPendingDeleteLin(menu.item) }
              : { key: 'delete', label: 'Delete', icon: Trash2, destructive: true, onAction: () => { void deleteComponent(menu.item) } },
          ]}
        />
      )}

      <ConfirmDialog
        visible={!!pendingDeleteLin}
        title="Remove this LIN from the hand receipt? Its items move to Unassigned (kept on-hand)."
        confirmLabel="Remove"
        variant="danger"
        onConfirm={confirmDeleteLin}
        onCancel={() => setPendingDeleteLin(null)}
      />
    </div>
  )
}
