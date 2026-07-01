import { useRef, useState } from 'react'
import { Plus, Check, Trash2 } from 'lucide-react'
import { TextInput } from './FormInputs'
import { EmptyState } from './EmptyState'
import { ActionPill } from './ActionPill'
import { ActionButton } from './ActionButton'
import { PreviewOverlay } from './PreviewOverlay'
import { ConfirmDialog } from './ConfirmDialog'
import { SwipeToDeleteRow } from './SwipeToDeleteRow'
import type { SubCluster } from '../lib/subClusterService'

/**
 * Sub-cluster (platoon/squad) manager — matches Beacon's card pattern: the
 * EmptyState primitive when empty (bordered card + overlay ActionPill corner
 * action), a populated card whose corner pill adds, and tap-a-row-to-edit via a
 * PreviewOverlay anchored to the row (rename + delete). Caller wires the
 * create/rename/delete callbacks to the right RPC path (own-clinic supervisor
 * RPCs in ClinicPanel, clinic-targeted dev RPCs in the admin drawer). Render-only
 * grouping layer; see v2/supervisor sub-cluster drawer.
 */
interface SubClusterManagerProps {
  subClusters: SubCluster[]
  onCreate: (name: string) => Promise<boolean>
  onRename: (id: string, name: string) => Promise<boolean>
  onDelete: (id: string) => Promise<boolean>
}

export function SubClusterManager({ subClusters, onCreate, onRename, onDelete }: SubClusterManagerProps) {
  const addPillRef = useRef<HTMLDivElement>(null)
  const [addRect, setAddRect] = useState<DOMRect | null>(null)
  const [editTarget, setEditTarget] = useState<{ sc: SubCluster; rect: DOMRect } | null>(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<SubCluster | null>(null)

  const openAdd = (anchor: HTMLElement) => { setDraft(''); setAddRect(anchor.getBoundingClientRect()) }
  const openEdit = (sc: SubCluster, anchor: HTMLElement) => { setDraft(sc.name); setEditTarget({ sc, rect: anchor.getBoundingClientRect() }) }

  const saveAdd = async () => {
    const name = draft.trim()
    if (!name || busy) return
    setBusy(true)
    const ok = await onCreate(name)
    setBusy(false)
    if (ok) setAddRect(null)
  }

  const saveEdit = async () => {
    const name = draft.trim()
    if (!name || busy || !editTarget) return
    setBusy(true)
    const ok = await onRename(editTarget.sc.id, name)
    setBusy(false)
    if (ok) setEditTarget(null)
  }

  const confirmDelete = async () => {
    if (!pendingDelete || busy) return
    setBusy(true)
    await onDelete(pendingDelete.id)
    setBusy(false)
    setPendingDelete(null)
  }

  // Shared overlay body — just the name field; commit lives in the footer pills.
  const nameField = (onSave: () => void) => (
    <div className="px-4 py-3">
      <TextInput value={draft} onChange={setDraft} placeholder="Sub-unit (platoon / squad)"
        onKeyDown={(e) => { if (e.key === 'Enter') onSave() }} />
    </div>
  )

  return (
    <>
      {subClusters.length === 0 ? (
        <EmptyState
          title="No sub-units yet"
          action={{ icon: Plus, label: 'Add sub-unit', onClick: openAdd }}
        />
      ) : (
        <div className="relative">
          <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden divide-y divide-tertiary/10">
            {subClusters.map((sc) => (
              <SwipeToDeleteRow key={sc.id} onDelete={() => setPendingDelete(sc)}>
                <button
                  type="button"
                  onClick={(e) => openEdit(sc, e.currentTarget)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all active:scale-[0.98] hover:bg-themeblue2/5"
                >
                  <span className="text-sm font-medium text-primary truncate flex-1">{sc.name}</span>
                </button>
              </SwipeToDeleteRow>
            ))}
          </div>
          <ActionPill ref={addPillRef} shadow="sm" placement="overlay">
            <ActionButton
              icon={Plus}
              label="Add sub-unit"
              onClick={() => addPillRef.current && openAdd(addPillRef.current)}
            />
          </ActionPill>
        </div>
      )}

      {/* Add overlay — header X cancels, footer pill commits. */}
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

      {/* Edit overlay — header X cancels, footer Delete (left) + Save (right). */}
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
    </>
  )
}
