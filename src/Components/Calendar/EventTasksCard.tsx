import { useMemo, useRef, useState } from 'react'
import { Check, MapPin, Package, Plus, Type, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { EventSubtask } from '../../Types/CalendarTypes'
import { useAuthStore } from '../../stores/useAuthStore'
import { usePropertyStore } from '../../stores/usePropertyStore'
import { PreviewOverlay, type ContextMenuAction } from '../PreviewOverlay'
import { TextInput } from '@/Components/primitives/FormInputs'
import { FooterPill } from '@/Components/primitives/FooterPill'
import { ActionButton } from '@/Components/primitives/ActionButton'

interface Props {
  subtasks: EventSubtask[]
  /** Persist the full next list. Detail view writes through the event; the form mirrors into form data. */
  onChange: (next: EventSubtask[]) => void
  /** Event assignees — anyone here may tick. */
  assignedIds: string[]
  /** add / remove / seed permission (isEventEditable). Ticking is gated separately on assignee membership. */
  canEdit: boolean
  isMobile: boolean
}

type ItemKind = EventSubtask['kind']

const KIND_META: Record<ItemKind, { label: string; icon: LucideIcon }> = {
  property_item:     { label: 'Equipment', icon: Package },
  property_location: { label: 'Location',  icon: MapPin },
  task:              { label: 'Free text', icon: Type },
}

export function EventTasksCard({ subtasks, onChange, assignedIds, canEdit, isMobile }: Props) {
  const currentUserId = useAuthStore(s => s.user?.id ?? null)
  const propertyItems = usePropertyStore(s => s.items)
  const propertyLocations = usePropertyStore(s => s.locations)
  const addBtnRef = useRef<HTMLButtonElement>(null)
  const [addMenu, setAddMenu] = useState<{ anchor: DOMRect; kind: ItemKind | null } | null>(null)
  const [freeTextDraft, setFreeTextDraft] = useState('')

  const canTick = !!currentUserId && assignedIds.includes(currentUserId)

  const labelFor = useMemo(() => (sub: EventSubtask): string => {
    switch (sub.kind) {
      case 'task':              return sub.label
      case 'property_item':     return sub.label_override ?? propertyItems.find(p => p.id === sub.ref)?.name ?? '(deleted item)'
      case 'property_location': return propertyLocations.find(p => p.id === sub.ref)?.name ?? '(deleted location)'
    }
  }, [propertyItems, propertyLocations])

  const nextSort = () => subtasks.reduce((m, s) => Math.max(m, s.sort_order ?? 0), 0) + 1

  const toggle = (id: string) => {
    if (!canTick) return
    onChange(subtasks.map(s => {
      if (s.id !== id) return s
      return s.done_at
        ? { ...s, done_by: null, done_at: null }
        : { ...s, done_by: currentUserId, done_at: new Date().toISOString() }
    }))
  }

  const remove = (id: string) => {
    if (!canEdit) return
    onChange(subtasks.filter(s => s.id !== id))
  }

  // Add-new — same stepped flow as the clinic checklist editor (kind → free-text / property picker),
  // but the result is an ad-hoc `custom` subtask on this event, never mapped back to a cluster template.
  const commitNew = (built: Omit<EventSubtask, 'id' | 'source' | 'sort_order'>) => {
    if (!canEdit) return
    onChange([...subtasks, { ...built, id: crypto.randomUUID(), source: 'custom', sort_order: nextSort() } as EventSubtask])
    setAddMenu(null)
    setFreeTextDraft('')
  }

  const sorted = useMemo(
    () => [...subtasks].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [subtasks],
  )

  const openAdd = (anchor: HTMLElement) => {
    setAddMenu({ anchor: anchor.getBoundingClientRect(), kind: null })
  }

  const activeKind = addMenu?.kind ?? null

  // Second-stage selector options once a kind is chosen.
  const kindPickerOptions = useMemo(() => {
    switch (activeKind) {
      case 'property_item':     return propertyItems.map(p => ({ id: p.id, label: p.name }))
      case 'property_location': return propertyLocations.map(p => ({ id: p.id, label: p.name }))
      default:                  return []
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

  // Nothing to show and nothing the user can do → render nothing.
  if (sorted.length === 0 && !canEdit) return null

  const taskRows = sorted.map((sub) => {
    const Icon = KIND_META[sub.kind].icon
    const isDone = !!sub.done_at
    return (
      <div key={sub.id} className={`flex items-center ${isMobile ? 'gap-3 py-2' : 'gap-2 py-1.5'}`}>
        <button
          type="button"
          onClick={() => toggle(sub.id)}
          disabled={!canTick}
          className={`flex-1 min-w-0 flex items-center text-left transition-all ${
            isMobile ? 'gap-3' : 'gap-2'
          } ${canTick ? 'active:scale-[0.98]' : 'cursor-default'}`}
        >
          <div className={`shrink-0 w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
            isDone ? 'bg-themeblue3 border-themeblue3' : 'border-tertiary/30'
          }`}>
            {isDone && <Check size={12} className="text-white" />}
          </div>
          <Icon size={isMobile ? 14 : 12} className="text-tertiary shrink-0" />
          <p className={`flex-1 min-w-0 truncate ${isMobile ? 'text-sm' : 'text-[10pt]'} ${isDone ? 'text-tertiary line-through' : 'text-primary'}`}>
            {labelFor(sub)}
          </p>
        </button>
        {canEdit && (
          <button
            type="button"
            onClick={() => remove(sub.id)}
            aria-label="Remove task"
            className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-tertiary hover:text-themeredred active:scale-95 transition-all"
          >
            <X size={12} />
          </button>
        )}
      </div>
    )
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider">Tasks</p>
        {canEdit && (
          <button
            ref={addBtnRef}
            type="button"
            onClick={() => addBtnRef.current && openAdd(addBtnRef.current)}
            aria-label="Add task"
            className="shrink-0 w-7 h-7 rounded-full bg-themeblue3 flex items-center justify-center active:scale-90 transition-transform"
          >
            <Plus size={14} className="text-white" />
          </button>
        )}
      </div>

      {sorted.length === 0 ? (
        canEdit ? (
          <p className="text-[10pt] text-tertiary">No tasks yet — tap + to add.</p>
        ) : null
      ) : (
        <div>{taskRows}</div>
      )}

      {!canTick && sorted.length > 0 && (
        <p className="pt-2 text-[9pt] text-tertiary">Only event assignees can tick tasks.</p>
      )}

      {/* Add picker — morphs between kind selection and ref / free-text picker. */}
      {addMenu && (
        <PreviewOverlay
          isOpen
          onClose={() => { setAddMenu(null); setFreeTextDraft('') }}
          anchorRect={addMenu.anchor}
          title={activeKind ? `Add ${KIND_META[activeKind].label.toLowerCase()}` : 'Add task'}
          onBack={activeKind ? () => { setAddMenu(prev => prev ? { ...prev, kind: null } : null); setFreeTextDraft('') } : undefined}
          maxWidth={activeKind ? 320 : 280}
          previewMaxHeight={activeKind ? '50dvh' : 'auto'}
          actions={activeKind ? [] : addActions}
          zIndex={95}
          rightFooter={activeKind === 'task' ? (
            <FooterPill side="right">
              <ActionButton
                icon={Check}
                label="Add"
                variant={freeTextDraft.trim() ? 'confirm' : 'disabled'}
                onClick={() => {
                  if (!freeTextDraft.trim()) return
                  commitNew({ kind: 'task', label: freeTextDraft.trim() })
                }}
              />
            </FooterPill>
          ) : undefined}
        >
          {!activeKind ? (
            <div className="px-4 pb-3 text-[10pt] text-tertiary">
              Pick the kind of task to add.
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
                    if (activeKind === 'property_item')     commitNew({ kind: 'property_item', ref: opt.id, label_override: null })
                    if (activeKind === 'property_location') commitNew({ kind: 'property_location', ref: opt.id })
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
    </div>
  )
}
