import { useMemo, useState, forwardRef, useImperativeHandle } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { ChevronRight, ChevronDown, FileText, PackageCheck, ClipboardList } from 'lucide-react'
import { SearchInput } from '@/Components/primitives/SearchInput'
import { LiftedRowMenu } from '@/Components/primitives/LiftedRowMenu'
import { type ContextMenuItem } from '@/Components/primitives/ContextMenu'
import { usePropertyStore } from '../../stores/usePropertyStore'
import { useDA2062Export } from '../../Hooks/useDA2062Export'
import { Da2062Preview } from './Da2062Preview'
import { computeShortages, type ShortageLine } from '../../Utilities/propertyShortage'
import type { DA2062Params } from '../../Utilities/DA2062Export'
import type { HolderInfo, LocalPropertyItem } from '../../Types/PropertyTypes'

export interface PropertyShortageHandle {
  /** Open the action menu (DA 2062 shortage annex) anchored to the host header's
   *  ellipsis. The host renders the trigger; the menu + its export/preview live here so
   *  the annex stays co-located with the report it's built from. */
  openMenu: (anchor: DOMRect) => void
}

interface PropertyShortagePanelProps {
  /** Present for host-call symmetry with the other pane bodies; the host owns the
   *  close affordance, so this body never needs to call it. */
  onClose?: () => void
  /** Items staged for turn-in (open pending marker) — counted as on-hand 0 so a staged
   *  line surfaces its shortage immediately. Lifted in PropertyPanel from useHandReceipts. */
  stagedTurnInIds?: Set<string>
  /** Locate a short line's item ON THE MAP: drops this book view, selects it on the
   *  canvas, breadcrumb → its parent zone. Wired to the host's handleSelectItem. */
  onLocate?: (item: LocalPropertyItem) => void
}

/** A LIN's short lines grouped under it — the tree node. */
interface ShortGroup {
  key: string
  /** LIN (SKO parent) name; null = top-level bucket. */
  linName: string | null
  /** LIN code off the parent container (subtext under the name). */
  lin: string | null
  lines: ShortageLine[]
  totalShort: number
}

/** A synthetic holder for the annex header (no real recipient — this is a unit
 *  shortage listing, not a hand receipt to a person). */
function annexHolder(displayName: string): HolderInfo {
  return { id: '', rank: null, firstName: null, lastName: null, displayName }
}

/** Surfaceless Cluster Shortages report rendered as a TREE — each LIN is a collapsible
 *  node; its short component lines nest beneath it (Name · Nomenclature · NSN · short qty).
 *  Mirrors the Cluster Hand Receipt (PropertyAuthorizedPanel) idiom for a consistent look.
 *  Shortage = authorized − on-hand, a pure client fold over the already-loaded items
 *  (see computeShortages). A line TAP opens the line's detail (onLocate → host
 *  handleSelectItem), where the "On hand" section lists the located stacks that ARE present
 *  (and taps through to locate each on the map). The DA 2062 shortage annex export lives in
 *  the host header's ellipsis (opened via the openMenu handle). Hosted in the
 *  Property right pane (desktop) / detail sheet (mobile) by PropertyPanel. */
export const PropertyShortagePanel = forwardRef<PropertyShortageHandle, PropertyShortagePanelProps>(
  function PropertyShortagePanel({ stagedTurnInIds, onLocate }, ref) {
    const items = usePropertyStore(useShallow(s => s.items))
    const { exportDA2062, da2062Preview, downloadDA2062, clearDA2062Preview, status: da2062Status } = useDA2062Export()

    const report = useMemo(() => computeShortages(items, stagedTurnInIds), [items, stagedTurnInIds])

    // Group the short lines under their LIN (SKO parent) so the report reads as a tree that
    // matches the hand receipt. The rep item's parent_item_id resolves the LIN container
    // (its name + LIN code); lines with no parent fall into a "Top-level items" bucket last.
    const groups = useMemo<ShortGroup[]>(() => {
      const map = new Map<string, ShortGroup>()
      for (const l of report.lines) {
        const rep = items.find(i => i.id === l.itemId)
        const parentId = rep?.parent_item_id ?? null
        const key = parentId ?? '__top__'
        let g = map.get(key)
        if (!g) {
          const container = parentId ? items.find(i => i.id === parentId) ?? null : null
          g = { key, linName: container?.name ?? l.skoName ?? null, lin: container?.lin ?? null, lines: [], totalShort: 0 }
          map.set(key, g)
        }
        g.lines.push(l)
        g.totalShort += l.short
      }
      return [...map.values()].sort((a, b) => {
        if (a.key === '__top__') return 1
        if (b.key === '__top__') return -1
        return (a.linName ?? '').localeCompare(b.linName ?? '')
      })
    }, [report.lines, items])

    const [query, setQuery] = useState('')
    const q = query.trim().toLowerCase()

    // Collapse state per LIN node (keyed by group key). Default expanded.
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
    const toggle = (key: string) =>
      setCollapsed(prev => {
        const next = new Set(prev)
        if (next.has(key)) next.delete(key)
        else next.add(key)
        return next
      })

    // Filter lines by name / nomenclature / NSN / LIN; drop groups left with no lines.
    const shownGroups = useMemo(() => {
      if (!q) return groups
      return groups
        .map(g => ({
          ...g,
          lines: g.lines.filter(
            l =>
              l.name.toLowerCase().includes(q) ||
              (l.nomenclature?.toLowerCase().includes(q) ?? false) ||
              (l.nsn?.toLowerCase().includes(q) ?? false) ||
              (g.lin?.toLowerCase().includes(q) ?? false) ||
              (g.linName?.toLowerCase().includes(q) ?? false),
          ),
        }))
        .filter(g => g.lines.length > 0)
    }, [groups, q])

    const exportAnnex = () => {
      const params: DA2062Params = {
        items: report.lines.map(l => ({
          name: l.name,
          nomenclature: l.nomenclature,
          nsn: l.nsn,
          serial_number: l.serialNumber,
          quantity: l.short,
        })),
        fromHolder: annexHolder('SHORTAGE ANNEX'),
        toHolder: annexHolder('SUPPLY'),
        handReceiptNumber: 'SHORTAGE ANNEX',
        date: new Date().toLocaleDateString(),
      }
      void exportDA2062(params)
    }

    // Action menu (host-triggered ellipsis) — the DA 2062 shortage annex export.
    const [menuAnchor, setMenuAnchor] = useState<{ rect: DOMRect } | null>(null)
    useImperativeHandle(ref, () => ({
      openMenu: (anchor: DOMRect) => setMenuAnchor({ rect: anchor }),
    }), [])

    const menuItems: ContextMenuItem[] = [
      { key: 'annex', label: 'DA 2062 shortage annex', icon: FileText, onAction: exportAnnex },
    ]

    // Nothing authorized yet → point the user at the BOM upload.
    if (report.trackedCount === 0) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
          <ClipboardList className="w-10 h-10 text-tertiary" />
          <p className="text-sm text-secondary">No authorized quantities yet.</p>
          <p className="text-[10pt] text-tertiary max-w-[260px]">
            Upload a property CSV with a <span className="font-medium">Quantity Authorized</span> column
            to set the baseline — shortages are computed from authorized vs on-hand.
          </p>
        </div>
      )
    }

    // Tracked, but everything is stocked.
    if (report.lines.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
          <PackageCheck className="w-10 h-10 text-themegreen" />
          <p className="text-sm text-secondary">Fully stocked — no shortages.</p>
          <p className="text-[10pt] text-tertiary">{report.trackedCount} authorized lines, all on hand.</p>
        </div>
      )
    }

    return (
      <div className="flex flex-col gap-2">
        <SearchInput value={query} onChange={setQuery} placeholder="Search shortages" />

        <div className="flex flex-col py-1">
          {shownGroups.map(g => {
            const isCollapsed = collapsed.has(g.key)
            return (
              <div key={g.key}>
                {/* LIN node header — name + LIN code, trailing rollup short count. */}
                <div
                  className="flex items-center gap-2 py-2 pr-3 border-l-2 border-l-transparent hover:bg-secondary/5 transition-colors"
                  style={{ paddingLeft: '16px' }}
                >
                  <button
                    type="button"
                    className="p-0.5 rounded hover:bg-secondary/10 text-tertiary shrink-0"
                    onClick={() => toggle(g.key)}
                    aria-label={isCollapsed ? 'Expand' : 'Collapse'}
                  >
                    {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <span className="block text-[10pt] font-bold text-primary truncate">{g.linName ?? 'Top-level items'}</span>
                    {g.lin && <span className="block text-[9pt] text-tertiary">LIN {g.lin}</span>}
                  </div>
                </div>

                {/* Short lines — Name · Nomenclature · NSN, with the per-line short qty. A tap
                    opens the line's detail (onLocate), where the "On hand" section lists what
                    IS present and where. */}
                {!isCollapsed &&
                  g.lines.map(l => {
                    const item = items.find(i => i.id === l.itemId) ?? null
                    return (
                      <div
                        key={l.itemId}
                        className="flex items-center gap-2 py-2 pr-3 border-l-2 border-l-transparent hover:bg-secondary/5 transition-colors"
                        style={{ paddingLeft: '38px' }}
                      >
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left"
                          onClick={() => item && onLocate?.(item)}
                        >
                          <span className="block text-[10pt] text-primary truncate">{l.name}</span>
                          {l.nomenclature && <span className="block text-[9pt] text-tertiary truncate">{l.nomenclature}</span>}
                          {l.nsn && <span className="block text-[9pt] text-tertiary truncate">Material/NSN {l.nsn}</span>}
                        </button>
                        {/* Signed shortfall for this (LIN + NSN) line — negative = short. */}
                        <span className="text-[10pt] font-semibold text-themeredred tabular-nums shrink-0">-{l.short}</span>
                      </div>
                    )
                  })}
              </div>
            )
          })}
        </div>

        {/* Action menu — opened from the host header ellipsis (openMenu handle). */}
        {menuAnchor && (
          <LiftedRowMenu
            isOpen
            anchorRect={menuAnchor.rect}
            onClose={() => setMenuAnchor(null)}
            layout="list"
            align="right"
            items={menuItems}
          />
        )}

        <Da2062Preview
          preview={da2062Preview}
          generating={da2062Status === 'generating'}
          onDownload={downloadDA2062}
          onClose={clearDA2062Preview}
        />
      </div>
    )
  },
)
