/**
 * ClusterRosterSection.tsx
 *
 * THE cluster roster surface — one card of sub-unit groups, where the group
 * header IS the sub-unit: tap it to rename or delete.
 *
 * SUPERSEDES SubClusterManager. That component managed sub-units in a card of
 * its own, which meant the roster rendered group headers while the thing that
 * creates/renames/deletes those very groups sat in a separate section below it
 * — the "sub-clusters and then a roster feels separated" complaint.
 *
 * Generic over the member type so both consumers share one surface:
 *   - Admin (AdminClinicDetail) — AdminUser rows via UserRow, dev-scoped RPCs.
 *   - Settings (ClinicPanel)    — ClinicMedic rows, own-clinic supervisor RPCs.
 *
 * Grouping is render-only, NOT an access boundary. See Utilities/subCluster.ts.
 * Per USR: no count indicators, no collapse, section cards carry no border,
 * and adds go through the ActionPill/ActionButton primitive — not a bespoke
 * circular button in the section header.
 */

import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { Check, Trash2, Layers, MoreHorizontal } from 'lucide-react'
import { TextInput } from '@/Components/primitives/FormInputs'
import { ActionPill } from '@/Components/primitives/ActionPill'
import { ActionButton } from '@/Components/primitives/ActionButton'
import { ConfirmDialog } from '@/Components/primitives/ConfirmDialog'
import { AnchoredMenu } from '@/Components/primitives/LiftedRowMenu'
import { type ContextMenuItem } from '@/Components/primitives/ContextMenu'
import { PreviewOverlay } from './PreviewOverlay'
import { HQ_BUCKET } from '../Utilities/subCluster'
import type { SubCluster } from '../lib/subClusterService'

/** Group id for the headerless list used when a cluster defines no sub-units. */
export const BARE_GROUP = '__bare__'

/** A bucket appended after the structural groups — loans, pending, etc. */
export interface ExtraRosterGroup<T> {
  id: string
  name: string
  items: T[]
}

interface Group<T> {
  id: string
  name: string
  items: T[]
  bare?: boolean
  /** Non-null only for real sub-units — gates tap-to-edit on the header. */
  subUnit: SubCluster | null
}

interface ClusterRosterSectionProps<T> {
  /** Section label. */
  title?: string
  /** Sub-units of THIS cluster. Empty ⇒ one headerless list, no manage UI. */
  subUnits: SubCluster[]
  /** Members whose home is this cluster. */
  members: T[]
  subUnitIdOf: (member: T) => string | null | undefined
  /** Buckets appended after HQ / Unassigned. Memoize at the call site. */
  extraGroups?: ExtraRosterGroup<T>[]
  /** groupId lets a caller vary the row (loan chips, per-bucket subtitle). */
  renderItem: (member: T, groupId: string) => ReactNode
  /** All three required to enable management — omit any and the roster is
   *  read-only (headers stop being tappable, no "New sub-unit" action). */
  onCreateSubUnit?: (name: string) => Promise<boolean>
  onRenameSubUnit?: (id: string, name: string) => Promise<boolean>
  onDeleteSubUnit?: (id: string) => Promise<boolean>
  /** Extra menu entries beyond "New sub-unit" (e.g. Add member / Create user). */
  addActions?: ContextMenuItem[]
  /** Mirrors the pill element out, so an addAction whose own overlay anchors to
   *  it (ClinicPanel's Add-member popover) still has a rect. */
  addAnchorRef?: { current: HTMLDivElement | null }
  /** Wrapper for each group's rows — e.g. 'divide-y divide-tertiary/10'. */
  itemsClassName?: string
  /** Card overrides (radius, padding). Card is borderless by default. */
  cardClassName?: string
  /** Rendered inside the card, after the groups — e.g. a LoadingOverlay. */
  children?: ReactNode
  emptyText?: string
}

export function ClusterRosterSection<T>({
  title = 'Roster',
  subUnits,
  members,
  subUnitIdOf,
  extraGroups,
  renderItem,
  onCreateSubUnit,
  onRenameSubUnit,
  onDeleteSubUnit,
  addActions,
  addAnchorRef,
  itemsClassName,
  cardClassName = 'rounded-2xl bg-themewhite2 overflow-hidden',
  children,
  emptyText = 'No members assigned',
}: ClusterRosterSectionProps<T>) {
  const pillRef = useRef<HTMLDivElement | null>(null)
  const [menuRect, setMenuRect] = useState<DOMRect | null>(null)
  const [addRect, setAddRect] = useState<DOMRect | null>(null)
  const [editTarget, setEditTarget] = useState<{ sc: SubCluster; rect: DOMRect } | null>(null)
  const [pendingDelete, setPendingDelete] = useState<SubCluster | null>(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  const canManage = !!(onCreateSubUnit && onRenameSubUnit && onDeleteSubUnit)

  /**
   * Named sub-units in fetch order — rendered EVEN WHEN EMPTY, because the
   * division is structural and the header is the only place to rename or
   * delete it. HQ / Unassigned only when it holds members. With no sub-units
   * the roster is bare: a lone "HQ / Unassigned" header over the whole cluster
   * is noise. Extras land last.
   */
  const groups = useMemo<Group<T>[]>(() => {
    const out: Group<T>[] = []
    if (subUnits.length === 0) {
      out.push({ id: BARE_GROUP, name: '', items: members, subUnit: null, bare: true })
    } else {
      const known = new Set(subUnits.map(s => s.id))
      const byKey = new Map<string, T[]>()
      for (const m of members) {
        const raw = subUnitIdOf(m)
        const key = raw && known.has(raw) ? raw : HQ_BUCKET
        const arr = byKey.get(key)
        if (arr) arr.push(m)
        else byKey.set(key, [m])
      }
      for (const s of subUnits) {
        out.push({ id: s.id, name: s.name, items: byKey.get(s.id) ?? [], subUnit: s })
      }
      const hq = byKey.get(HQ_BUCKET)
      if (hq?.length) out.push({ id: HQ_BUCKET, name: 'HQ / Unassigned', items: hq, subUnit: null })
    }
    for (const g of extraGroups ?? []) {
      if (g.items.length === 0) continue
      out.push({ id: g.id, name: g.name, items: g.items, subUnit: null })
    }
    return out
  }, [subUnits, members, subUnitIdOf, extraGroups])

  // ── Sub-unit mutations ──────────────────────────────────────────────
  const saveAdd = async () => {
    const name = draft.trim()
    if (!name || busy || !onCreateSubUnit) return
    setBusy(true)
    const ok = await onCreateSubUnit(name)
    setBusy(false)
    if (ok) setAddRect(null)
  }

  const saveEdit = async () => {
    const name = draft.trim()
    if (!name || busy || !editTarget || !onRenameSubUnit) return
    setBusy(true)
    const ok = await onRenameSubUnit(editTarget.sc.id, name)
    setBusy(false)
    if (ok) setEditTarget(null)
  }

  const confirmDelete = async () => {
    if (!pendingDelete || busy || !onDeleteSubUnit) return
    setBusy(true)
    await onDeleteSubUnit(pendingDelete.id)
    setBusy(false)
    setPendingDelete(null)
  }

  const nameField = (onSave: () => void) => (
    <div className="px-4 py-3">
      <TextInput
        value={draft}
        onChange={setDraft}
        placeholder="Sub-unit (platoon / squad)"
        onKeyDown={(e) => { if (e.key === 'Enter') onSave() }}
      />
    </div>
  )

  /** "New sub-unit" anchors its overlay to the pill it was fired from. */
  const openAdd = useCallback(() => {
    setDraft('')
    setMenuRect(null)
    setAddRect(pillRef.current?.getBoundingClientRect() ?? null)
  }, [])

  /** Tap a sub-unit header to rename/delete it — the header IS the sub-unit. */
  const openEdit = useCallback((sc: SubCluster, anchor: HTMLElement) => {
    setDraft(sc.name)
    setEditTarget({ sc, rect: anchor.getBoundingClientRect() })
  }, [])

  /** Everything the section can add, behind one ellipsis. Caller actions are
   *  wrapped so picking one dismisses the menu before it runs. */
  const menuItems = useMemo<ContextMenuItem[]>(() => {
    const items: ContextMenuItem[] = []
    if (canManage) items.push({ key: 'sub-unit', label: 'New sub-unit', icon: Layers, onAction: openAdd })
    for (const a of addActions ?? []) {
      items.push({ ...a, onAction: () => { setMenuRect(null); a.onAction?.() } })
    }
    return items
  }, [canManage, addActions, openAdd])

  const headerBase = 'w-full flex items-center gap-2 py-2 px-4 text-left bg-secondary/5 border-primary/5'

  return (
    <section className="mt-4">
      <div className="pb-2">
        <p className="text-[9pt] font-semibold text-tertiary uppercase tracking-widest">{title}</p>
      </div>

      {/* The pill rides the card's top edge, so it must be a SIBLING of the
          card under this relative wrapper — the card's overflow-hidden would
          otherwise clip the pill's negative translate (see ActionPill docs). */}
      <div className="relative">
        <div className={`relative ${cardClassName}`}>
          {/* NOTE: no blanket empty state. A cluster with sub-units but no
              members must still render its group headers — they're the only
              manage surface. */}
          {groups.map((g, idx) => {
            const rows = (
              <div className={itemsClassName}>
                {g.items.length === 0
                  ? <div className={g.bare ? 'px-4 py-3.5 text-[10pt] text-tertiary' : 'px-4 py-3 text-[9.5pt] text-tertiary/70'}>
                      {g.bare ? emptyText : 'No members'}
                    </div>
                  : g.items.map(m => renderItem(m, g.id))}
              </div>
            )
            if (g.bare) return <div key={g.id}>{rows}</div>

            const border = idx === 0 ? 'border-b' : 'border-y'
            const label = (
              <span className="flex-1 min-w-0 truncate text-[9pt] font-medium text-tertiary uppercase tracking-wide">
                {g.name}
              </span>
            )
            return (
              <div key={g.id}>
                {canManage && g.subUnit ? (
                  <button
                    type="button"
                    aria-label={`Edit ${g.name}`}
                    onClick={(e) => openEdit(g.subUnit!, e.currentTarget)}
                    className={`${headerBase} ${border} active:scale-[0.99] hover:bg-themeblue2/5 transition-all`}
                  >
                    {label}
                  </button>
                ) : (
                  <div className={`${headerBase} ${border}`}>{label}</div>
                )}
                {rows}
              </div>
            )
          })}
          {children}
        </div>

        {/* ONE ellipsis, never a row of action buttons — everything the
            section can add lives in its context menu. */}
        {menuItems.length > 0 && (
          <ActionPill
            ref={(el) => { pillRef.current = el; if (addAnchorRef) addAnchorRef.current = el }}
            shadow="sm"
            placement="overlay"
          >
            <ActionButton
              icon={MoreHorizontal}
              label={`${title} actions`}
              onClick={() => setMenuRect(pillRef.current?.getBoundingClientRect() ?? null)}
            />
          </ActionPill>
        )}
      </div>

      <AnchoredMenu
        isOpen={!!menuRect}
        anchorRect={menuRect}
        layout="list"
        items={menuItems}
        onClose={() => setMenuRect(null)}
      />

      {/* New sub-unit — header X cancels, footer pill commits. */}
      <PreviewOverlay
        isOpen={!!addRect}
        onClose={() => setAddRect(null)}
        anchorRect={addRect}
        title="New sub-unit"
        maxWidth={320}
        rightFooter={
          <ActionPill>
            <ActionButton
              icon={Check}
              label="Add"
              variant={draft.trim() && !busy ? 'success' : 'disabled'}
              onClick={() => void saveAdd()}
            />
          </ActionPill>
        }
      >
        {nameField(() => void saveAdd())}
      </PreviewOverlay>

      {/* Header tap — rename (footer Save) or delete (footer Delete). */}
      <PreviewOverlay
        isOpen={!!editTarget}
        onClose={() => setEditTarget(null)}
        anchorRect={editTarget?.rect ?? null}
        title="Sub-unit"
        maxWidth={320}
        footer={
          <div className="flex gap-1 bg-themewhite rounded-2xl shadow-lg px-1.5 py-1.5">
            <ActionButton
              icon={Trash2}
              label="Delete"
              variant="danger"
              onClick={() => { const sc = editTarget?.sc; setEditTarget(null); if (sc) setPendingDelete(sc) }}
            />
          </div>
        }
        rightFooter={
          <ActionPill>
            <ActionButton
              icon={Check}
              label="Save"
              variant={draft.trim() && !busy ? 'success' : 'disabled'}
              onClick={() => void saveEdit()}
            />
          </ActionPill>
        }
      >
        {nameField(() => void saveEdit())}
      </PreviewOverlay>

      <ConfirmDialog
        visible={!!pendingDelete}
        title="Delete sub-unit?"
        subtitle={pendingDelete ? `"${pendingDelete.name}" — its members move to HQ / Unassigned. Property and events stay; they just lose the squad tag.` : undefined}
        confirmLabel="Delete"
        variant="danger"
        processing={busy}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </section>
  )
}
