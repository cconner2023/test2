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
import { invalidate } from '../../stores/useInvalidationStore'
import { ActionButton } from '../ActionButton'
import { ActionPill } from '../ActionPill'
import { ConfirmDialog } from '../ConfirmDialog'
import { ErrorPill } from '../ErrorPill'
import { PreviewOverlay, type ContextMenuAction } from '../PreviewOverlay'
import { TextInput } from '../FormInputs'

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

export function PreCombatChecksSection() {
  const { clinicId: assignedClinicId, supervisingClinicId, isSupervisorRole } = useAuth()
  const canEditTemplates = isSupervisorRole
  const clinicId = supervisingClinicId ?? assignedClinicId
  const templates = useClinicPreCombatChecks(clinicId)
  const { items: propertyItems, locations: propertyLocations } = useClinicPropertyPickers(clinicId)

  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const fabRef = useRef<HTMLDivElement>(null)
  const addFabRef = useRef<HTMLDivElement>(null)
  const [editor, setEditor] = useState<PCCEditorState | null>(null)
  const [draftName, setDraftName] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [draftItems, setDraftItems] = useState<PCCItem[]>([])
  const [addMenu, setAddMenu] = useState<{ anchor: DOMRect; kind: ItemKind | null } | null>(null)
  const [freeTextDraft, setFreeTextDraft] = useState('')

  const [confirmDelete, setConfirmDelete] = useState<ClinicPreCombatCheck | null>(null)

  const closeEditor = useCallback(() => {
    setEditor(null)
    setDraftName('')
    setNameError(null)
    setDraftItems([])
    setAddMenu(null)
    setFreeTextDraft('')
    setSaving(false)
  }, [])

  const openNew = useCallback(() => {
    if (!fabRef.current) return
    setEditor({ mode: 'new', anchor: fabRef.current.getBoundingClientRect() })
    setDraftName('')
    setDraftItems([])
  }, [])

  const openEdit = useCallback((template: ClinicPreCombatCheck, target: HTMLElement) => {
    setEditor({ mode: 'edit', target, anchor: target.getBoundingClientRect() })
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
    invalidate('clinics')
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

  const addItem = useCallback((item: PCCItem) => {
    setDraftItems(prev => [...prev, item])
    setAddMenu(null)
    setFreeTextDraft('')
  }, [])

  const removeItem = useCallback((id: string) => {
    setDraftItems(prev => prev.filter(i => i.id !== id))
  }, [])

  const activeKind = addMenu?.kind ?? null

  // Pickers — feed the second-stage selector once a kind is chosen.
  const kindPickerOptions = useMemo(() => {
    if (!activeKind) return []
    switch (activeKind) {
      case 'property_item':     return propertyItems.map(p => ({ id: p.id, label: p.name }))
      case 'property_location': return propertyLocations.map(p => ({ id: p.id, label: p.name }))
      case 'task':              return []
    }
  }, [activeKind, propertyItems, propertyLocations])

  const addActions: ContextMenuAction[] = useMemo(() => (
    (Object.keys(KIND_META) as ItemKind[]).map(kind => ({
      key: kind,
      icon: KIND_META[kind].icon,
      label: `Add ${KIND_META[kind].label.toLowerCase()}`,
      closesOnAction: false,
      onAction: () => setAddMenu(prev => prev ? { ...prev, kind } : null),
    }))
  ), [])

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
                      onClick={(e) => canEditTemplates && openEdit(tpl, e.currentTarget)}
                      disabled={!canEditTemplates}
                      className="w-full flex items-center gap-3 py-2 px-2 rounded-lg text-left hover:bg-secondary/5 active:scale-95 disabled:active:scale-100 transition-all"
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
          {canEditTemplates && (
            <ActionPill ref={fabRef} shadow="sm" placement="overlay">
              <ActionButton icon={Plus} label="New checklist" onClick={openNew} />
            </ActionPill>
          )}
        </div>
      </section>

      <PreviewOverlay
        isOpen={!!editor}
        onClose={closeEditor}
        anchorRect={editor?.anchor ?? null}
        maxWidth={560}
        previewMaxHeight="60dvh"
        headerCard={
          editor ? (
            <div className="bg-themewhite rounded-2xl overflow-hidden">
              <TextInput
                value={draftName}
                onChange={(v) => { setDraftName(v); setNameError(null) }}
                placeholder={editor.mode === 'new' ? 'New checklist…' : 'Checklist name'}
                hint={nameError}
              />
            </div>
          ) : undefined
        }
        footer={
          editor ? (
            <div className="flex gap-1 bg-themewhite rounded-2xl shadow-lg px-1.5 py-1.5">
              {editor.mode === 'edit' && (
                <ActionButton
                  icon={Trash2}
                  label="Delete"
                  variant="danger"
                  onClick={() => {
                    const target = editor.target
                    if (!target) return
                    closeEditor()
                    setTimeout(() => setConfirmDelete(target), 320)
                  }}
                />
              )}
              <ActionButton
                icon={saving ? Loader2 : Check}
                label={saving ? 'Saving…' : 'Save'}
                variant={saving || !draftName.trim() ? 'disabled' : 'success'}
                onClick={handleSave}
              />
            </div>
          ) : undefined
        }
        rightFooter={
          editor ? (
            <ActionPill ref={addFabRef} shadow="sm">
              <ActionButton
                icon={Plus}
                label="Add check"
                onClick={() => {
                  const rect = addFabRef.current?.getBoundingClientRect()
                  if (!rect) return
                  setAddMenu({ anchor: rect, kind: null })
                }}
              />
            </ActionPill>
          ) : undefined
        }
      >
        {editor && (
          <div className="px-4 pb-3">
            {draftItems.length === 0 ? (
              <p className="text-[10pt] text-tertiary py-6 text-center">
                No checks yet — tap “Add check” to add equipment, locations, rooms, or free-text tasks.
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
        )}
      </PreviewOverlay>

      {/* Add-check picker — morphs between kind selection and ref/free-text picker */}
      {addMenu && (
        <PreviewOverlay
          isOpen
          onClose={() => { setAddMenu(null); setFreeTextDraft('') }}
          anchorRect={addMenu.anchor}
          title={activeKind ? `Add ${KIND_META[activeKind].label.toLowerCase()}` : 'Add check'}
          onBack={activeKind ? () => { setAddMenu(prev => prev ? { ...prev, kind: null } : null); setFreeTextDraft('') } : undefined}
          maxWidth={activeKind ? 320 : 280}
          previewMaxHeight={activeKind ? '50dvh' : 'auto'}
          actions={activeKind ? [] : addActions}
          zIndex={95}
          footer={activeKind === 'task' ? (
            <div className="flex gap-1 bg-themewhite rounded-2xl shadow-lg px-1.5 py-1.5">
              <ActionButton
                icon={Check}
                label="Add"
                variant={freeTextDraft.trim() ? 'success' : 'disabled'}
                onClick={() => {
                  if (!freeTextDraft.trim()) return
                  addItem({ id: crypto.randomUUID(), kind: 'task', label: freeTextDraft.trim() })
                }}
              />
            </div>
          ) : undefined}
        >
          {!activeKind ? (
            <div className="px-4 pb-3 text-[10pt] text-tertiary">
              Pick the kind of check to add.
            </div>
          ) : activeKind === 'task' ? (
            <TextInput
              value={freeTextDraft}
              onChange={setFreeTextDraft}
              placeholder="e.g. Brief OPORD"
              maxLength={120}
            />
          ) : kindPickerOptions.length === 0 ? (
            <p className="px-4 pb-3 text-[10pt] text-tertiary">None available.</p>
          ) : (
            <div className="px-2 pb-2 space-y-1">
              {kindPickerOptions.map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    const id = crypto.randomUUID()
                    if (activeKind === 'property_item')     addItem({ id, kind: 'property_item', ref: opt.id })
                    if (activeKind === 'property_location') addItem({ id, kind: 'property_location', ref: opt.id })
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-themeblue3/5 active:scale-[0.98] transition-all text-[10pt] text-primary truncate"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </PreviewOverlay>
      )}

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
