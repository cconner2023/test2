import { useCallback, useMemo, useRef, useState } from 'react'
import { Check, ClipboardCheck, Loader2, MapPin, Package, Plus, Trash2, Type, X } from 'lucide-react'
import { useAuth } from '../../Hooks/useAuth'
import { useClinicPreCombatChecks } from '../../Hooks/useClinicPreCombatChecks'
import { useClinicPropertyPickers } from '../../Hooks/useClinicPropertyPickers'
import {
  updateSupervisorClinicPreCombatChecks,
  type ClinicPreCombatCheck,
  type PCCItem,
} from '../../lib/supervisorService'
import { patchClinicConfig } from '../../Hooks/useClinicConfig'
import { ActionButton } from '../ActionButton'
import { OverlayActionMenu } from '../OverlayActionMenu'
import { ConfirmDialog } from '../ConfirmDialog'
import { ErrorPill } from '../ErrorPill'
import { ActionPill } from '../ActionPill'
import { OverlayStack, type StackNav, type StackScreen } from '../OverlayStack'
import { TextInput } from '../FormInputs'
import type { ContextMenuItem } from '../ContextMenu'

type ItemKind = PCCItem['kind']

const KIND_META: Record<ItemKind, { label: string; icon: typeof Package }> = {
  property_item:     { label: 'Equipment',  icon: Package },
  property_location: { label: 'Location',   icon: MapPin },
  task:              { label: 'Free text',  icon: Type },
}

interface PCCEditorState {
  mode: 'new' | 'edit'
  target?: ClinicPreCombatCheck
  anchor: DOMRect
}

interface PreCombatChecksSectionProps {
  /** Extra corner actions (e.g. CSV import/export) folded into the single
   *  consolidated corner ⋯ alongside the New checklist action this section owns. */
  cornerItems?: ContextMenuItem[]
}

export function PreCombatChecksSection({ cornerItems }: PreCombatChecksSectionProps = {}) {
  // No role gate here — the sole entry (Settings → App Content → Checklists) is
  // already supervisor/dev-gated (NoteContentPanel canSeeChecklists). One blocker,
  // not two: this section assumes whoever reached it may edit.
  const { clinicId: assignedClinicId, supervisingClinicId } = useAuth()
  const clinicId = supervisingClinicId ?? assignedClinicId
  const templates = useClinicPreCombatChecks(clinicId)
  const { items: propertyItems, locations: propertyLocations } = useClinicPropertyPickers(clinicId)

  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const fabRef = useRef<HTMLDivElement>(null)
  const navRef = useRef<StackNav | null>(null)
  const [editor, setEditor] = useState<PCCEditorState | null>(null)
  const [draftName, setDraftName] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [draftItems, setDraftItems] = useState<PCCItem[]>([])
  // Footer-morph flag — true == the "Add check" pill has morphed into its kind
  // options in place (no nested overlay), mirroring TemplateBuilder's AddStepFooter.
  const [addOpen, setAddOpen] = useState(false)
  const [freeTextDraft, setFreeTextDraft] = useState('')

  const [confirmDelete, setConfirmDelete] = useState<ClinicPreCombatCheck | null>(null)

  const closeEditor = useCallback(() => {
    setEditor(null)
    setDraftName('')
    setNameError(null)
    setDraftItems([])
    setAddOpen(false)
    setFreeTextDraft('')
    setSaving(false)
  }, [])

  const openNew = useCallback(() => {
    if (!fabRef.current) return
    setEditor({ mode: 'new', anchor: fabRef.current.getBoundingClientRect() })
    setDraftName('')
    setDraftItems([])
  }, [])

  const openEdit = useCallback((template: ClinicPreCombatCheck, anchorEl: HTMLElement) => {
    setEditor({ mode: 'edit', target: template, anchor: anchorEl.getBoundingClientRect() })
    setDraftName(template.name)
    setDraftItems([...template.items])
  }, [])

  const persist = useCallback(async (next: ClinicPreCombatCheck[]): Promise<boolean> => {
    if (!clinicId) return false
    setSaving(true)
    setError(null)
    const result = await updateSupervisorClinicPreCombatChecks(clinicId, next)
    setSaving(false)
    if (!result.success) {
      setError(result.error)
      return false
    }
    patchClinicConfig(clinicId, { preCombatChecks: next })
    return true
  }, [clinicId])

  const handleSave = useCallback(async () => {
    if (!editor) return
    const trimmed = draftName.trim()
    if (!trimmed) return
    const lower = trimmed.toLowerCase()
    let next: ClinicPreCombatCheck[]
    if (editor.mode === 'new') {
      if (templates.some(t => t.name.toLowerCase() === lower)) {
        setNameError('A check with that name already exists')
        return
      }
      const nextSort = templates.reduce((m, t) => Math.max(m, t.sort_order), -1) + 1
      next = [...templates, { id: crypto.randomUUID(), name: trimmed, sort_order: nextSort, items: draftItems }]
    } else {
      const target = editor.target!
      if (templates.some(t => t.id !== target.id && t.name.toLowerCase() === lower)) {
        setNameError('A check with that name already exists')
        return
      }
      next = templates.map(t => t.id === target.id ? { ...t, name: trimmed, items: draftItems } : t)
    }
    const ok = await persist(next)
    if (ok) closeEditor()
  }, [editor, draftName, draftItems, templates, persist, closeEditor])

  const handleConfirmDelete = useCallback(async () => {
    if (!confirmDelete) return
    const next = templates.filter(t => t.id !== confirmDelete.id)
    const ok = await persist(next)
    setConfirmDelete(null)
    if (ok) closeEditor()
  }, [confirmDelete, templates, persist, closeEditor])

  // Delete rides the editor footer; drop the overlay first (close the parent-owned
  // `editor` prop, not a bare anchor) so the confirm animates in cleanly after.
  const handleDeleteTap = useCallback(() => {
    const target = editor?.target
    if (!target) return
    closeEditor()
    setTimeout(() => setConfirmDelete(target), 320)
  }, [editor, closeEditor])

  const addItem = useCallback((item: PCCItem) => {
    setDraftItems(prev => [...prev, item])
  }, [])

  const removeItem = useCallback((id: string) => {
    setDraftItems(prev => prev.filter(i => i.id !== id))
  }, [])

  // Kind picked from the morphed footer → drill into the matching sub-screen in the
  // SAME card (property kinds → a ref list; free text → a text field). No overlay.
  const startAdd = useCallback((kind: ItemKind) => {
    setAddOpen(false)
    if (kind === 'task') navRef.current?.push('freetext')
    else navRef.current?.push('pick', { kind })
  }, [])

  const sortedTemplates = useMemo(
    () => [...templates].sort((a, b) => a.sort_order - b.sort_order),
    [templates],
  )

  const resolveItemLabel = useCallback((item: PCCItem): string => {
    switch (item.kind) {
      case 'task':              return item.label
      case 'property_item':     return item.label_override ?? propertyItems.find(p => p.id === item.ref)?.name ?? '(deleted item)'
      case 'property_location': return propertyLocations.find(p => p.id === item.ref)?.name ?? '(deleted location)'
    }
  }, [propertyItems, propertyLocations])

  const saveDisabled = saving || !draftName.trim()

  // ── OverlayStack screens: one morphing card (checklist → pick / freetext) ──
  const screens: Record<string, StackScreen> = {
    checklist: {
      // Footer-LEFT: Delete (edit only) + Add; tapping Add morphs the pill into the
      // three kind options IN PLACE, then drills the picker into this same card.
      footer: addOpen ? (
        <ActionPill>
          <ActionButton icon={X} label="Cancel" onClick={() => setAddOpen(false)} />
          {(Object.keys(KIND_META) as ItemKind[]).map(kind => (
            <ActionButton
              key={kind}
              icon={KIND_META[kind].icon}
              label={KIND_META[kind].label}
              onClick={() => startAdd(kind)}
            />
          ))}
        </ActionPill>
      ) : (
        <ActionPill>
          {editor?.mode === 'edit' && (
            <ActionButton icon={Trash2} label="Delete" variant="danger" onClick={handleDeleteTap} />
          )}
          <ActionButton icon={Plus} label="Add check" onClick={() => setAddOpen(true)} />
        </ActionPill>
      ),
      rightFooter: (
        <ActionPill>
          <ActionButton
            icon={saving ? Loader2 : Check}
            label={saving ? 'Saving…' : 'Save'}
            variant={saveDisabled ? 'disabled' : 'success'}
            onClick={saveDisabled ? () => {} : handleSave}
          />
        </ActionPill>
      ),
      render: () => (
        <div className="px-4 pb-3 space-y-3">
          <div className="bg-themewhite2 rounded-xl overflow-hidden">
            <TextInput
              value={draftName}
              onChange={(v) => { setDraftName(v); setNameError(null) }}
              placeholder={editor?.mode === 'new' ? 'New checklist…' : 'Checklist name'}
              hint={nameError}
            />
          </div>
          {draftItems.length === 0 ? (
            <p className="text-[10pt] text-tertiary py-6 text-center">
              No checks yet — tap “Add check” to add equipment, locations, or free-text tasks.
            </p>
          ) : (
            <div className="space-y-1">
              {draftItems.map((item) => {
                const Icon = KIND_META[item.kind].icon
                return (
                  <div key={item.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-themewhite2">
                    <Icon size={13} className="text-tertiary shrink-0" />
                    <p className="flex-1 min-w-0 text-[10pt] text-primary truncate">{resolveItemLabel(item)}</p>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      aria-label="Remove item"
                      className="w-6 h-6 rounded-full flex items-center justify-center text-tertiary hover:text-themeredred active:scale-95 transition-all"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ),
    },
    // Ref picker (equipment / locations) — tap adds and pops back to the checklist.
    pick: {
      title: (p: { kind: ItemKind }) => `Add ${KIND_META[p.kind].label.toLowerCase()}`,
      maxWidth: 320,
      previewMaxHeight: '50dvh',
      render: (p: { kind: ItemKind }, nav: StackNav) => {
        const options = p.kind === 'property_item' ? propertyItems : propertyLocations
        if (options.length === 0) {
          return <p className="px-4 pb-3 text-[10pt] text-tertiary">None available.</p>
        }
        return (
          <div className="px-2 pb-2 space-y-1">
            {options.map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  const id = crypto.randomUUID()
                  addItem(
                    p.kind === 'property_item'
                      ? { id, kind: 'property_item', ref: opt.id }
                      : { id, kind: 'property_location', ref: opt.id },
                  )
                  nav.pop()
                }}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-themeblue3/5 active:scale-[0.98] transition-all text-[10pt] text-primary truncate"
              >
                {opt.name}
              </button>
            ))}
          </div>
        )
      },
    },
    // Free-text task — type + Add, then pop back to the checklist.
    freetext: {
      title: 'Add free text',
      maxWidth: 320,
      onBack: (nav: StackNav) => { setFreeTextDraft(''); nav.pop() },
      rightFooter: (_: unknown, nav: StackNav) => (
        <ActionPill>
          <ActionButton
            icon={Check}
            label="Add"
            variant={freeTextDraft.trim() ? 'success' : 'disabled'}
            onClick={() => {
              const label = freeTextDraft.trim()
              if (!label) return
              addItem({ id: crypto.randomUUID(), kind: 'task', label })
              setFreeTextDraft('')
              nav.pop()
            }}
          />
        </ActionPill>
      ),
      render: () => (
        <TextInput
          value={freeTextDraft}
          onChange={setFreeTextDraft}
          placeholder="e.g. Brief OPORD"
          maxLength={120}
        />
      ),
    },
  }

  return (
    <>
      {error && (
        <div className="px-1 pb-2">
          <ErrorPill>{error}</ErrorPill>
        </div>
      )}

      <section data-tour="clinic-pre-combat-checks">
        <div className="pb-2">
          <p className="text-[9pt] font-semibold text-tertiary tracking-widest uppercase">Checklists</p>
        </div>
        <div className="relative">
          <div className="rounded-xl bg-themewhite2 overflow-hidden">
            <div className="px-4 py-3">
              {templates.length === 0 ? (
                <p className="text-[10pt] text-tertiary py-4 text-center">No checklists</p>
              ) : (
                <div className="space-y-1">
                  {sortedTemplates.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={(e) => openEdit(tpl, e.currentTarget)}
                      className="w-full flex items-center gap-3 py-2 px-2 rounded-lg text-left hover:bg-secondary/5 active:scale-95 transition-all"
                    >
                      <div className="w-8 h-8 rounded-full flex items-center justify-center bg-tertiary/10 shrink-0">
                        <ClipboardCheck size={14} className="text-tertiary" />
                      </div>
                      <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-primary truncate">{tpl.name}</p>
                        <span className="text-[10pt] text-tertiary tabular-nums shrink-0">{tpl.items.length} item{tpl.items.length === 1 ? '' : 's'}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <OverlayActionMenu
            ref={fabRef}
            shadow="sm"
            items={[
              { key: 'new', label: 'New checklist', icon: Plus, onAction: openNew },
              ...(cornerItems ?? []),
            ]}
          />
        </div>
      </section>

      <OverlayStack
        isOpen={!!editor}
        onClose={closeEditor}
        anchorRect={editor?.anchor ?? null}
        initial={{ key: 'checklist' }}
        screens={screens}
        navRef={navRef}
        maxWidth={560}
        previewMaxHeight="60dvh"
      />

      <ConfirmDialog
        visible={!!confirmDelete}
        title="Delete this checklist?"
        subtitle="Events with an attached snapshot keep their checklist; future attachments are blocked."
        confirmLabel="Delete"
        variant="danger"
        processing={saving}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </>
  )
}
