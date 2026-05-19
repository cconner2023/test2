import { useMemo } from 'react'
import { Check, MapPin, Package, Type } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { PCCAttachment, PCCSubtask } from '../../Types/CalendarTypes'
import { useAuthStore } from '../../stores/useAuthStore'
import { usePropertyStore } from '../../stores/usePropertyStore'
import { SectionHeader } from '../Section'

interface Props {
  pcc: PCCAttachment
  /** Event assignees — anyone in this list may tick subtasks. */
  assignedIds: string[]
  /** Writes the updated PCC snapshot back to the event. */
  onUpdatePcc: (next: PCCAttachment) => void
  isMobile: boolean
}

const KIND_ICON: Record<PCCSubtask['kind'], LucideIcon> = {
  property_item:     Package,
  property_location: MapPin,
  task:              Type,
}

export function PCCChecklistCard({ pcc, assignedIds, onUpdatePcc, isMobile }: Props) {
  const currentUserId = useAuthStore(s => s.user?.id ?? null)
  const propertyItems = usePropertyStore(s => s.items)
  const propertyLocations = usePropertyStore(s => s.locations)

  const canTick = !!currentUserId && assignedIds.includes(currentUserId)

  const labelFor = useMemo(() => (sub: PCCSubtask): string => {
    switch (sub.kind) {
      case 'task':              return sub.label
      case 'property_item':     return sub.label_override ?? propertyItems.find(p => p.id === sub.ref)?.name ?? '(deleted item)'
      case 'property_location': return propertyLocations.find(p => p.id === sub.ref)?.name ?? '(deleted location)'
    }
  }, [propertyItems, propertyLocations])

  const toggle = (subtaskId: string) => {
    if (!canTick) return
    const next: PCCAttachment = {
      ...pcc,
      subtasks: pcc.subtasks.map(s => {
        if (s.id !== subtaskId) return s
        const isDone = !!s.done_at
        if (isDone) return { ...s, done_by: null, done_at: null }
        return { ...s, done_by: currentUserId, done_at: new Date().toISOString() }
      }),
    }
    onUpdatePcc(next)
  }

  return (
    <div>
      <SectionHeader>Pre-Combat Check</SectionHeader>
      <div>
        {pcc.subtasks.length === 0 ? (
          <p className={`text-tertiary ${isMobile ? 'text-sm px-1 py-2' : 'text-[10pt] px-1 py-1.5'}`}>No items in this check.</p>
        ) : pcc.subtasks.map((sub) => {
          const Icon = KIND_ICON[sub.kind]
          const isDone = !!sub.done_at
          return (
            <button
              key={sub.id}
              type="button"
              onClick={() => toggle(sub.id)}
              disabled={!canTick}
              className={`w-full flex items-center text-left transition-all ${
                isMobile ? 'gap-3 py-2' : 'gap-2 py-1.5'
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
          )
        })}
      </div>
      {!canTick && (
        <p className="px-1 pt-2 text-[9pt] text-tertiary">Only event assignees can tick items.</p>
      )}
    </div>
  )
}
