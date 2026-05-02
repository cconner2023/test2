import { memo, useState, useRef, useCallback } from 'react'
import { Plus, Check, RotateCcw, Crosshair } from 'lucide-react'
import { useTC3Store } from '../../stores/useTC3Store'
import { PreviewOverlay } from '../PreviewOverlay'
import { SectionHeader } from '../Section'
import { ActionButton } from '../ActionButton'
import { ActionPill } from '../ActionPill'
import { EmptyState } from '../EmptyState'
import type { MechanismType } from '../../Types/TC3Types'

const MECHANISM_OPTIONS: { type: MechanismType; label: string }[] = [
  { type: 'Artillery', label: 'Artillery' },
  { type: 'Blunt', label: 'Blunt' },
  { type: 'Burn', label: 'Burn' },
  { type: 'Fall', label: 'Fall' },
  { type: 'Grenade', label: 'Grenade' },
  { type: 'GSW', label: 'GSW' },
  { type: 'IED', label: 'IED' },
  { type: 'Landmine', label: 'Landmine' },
  { type: 'MVC', label: 'MVC' },
  { type: 'RPG', label: 'RPG' },
  { type: 'Other', label: 'Other' },
]

export const MechanismForm = memo(function MechanismForm() {
  const mechanism = useTC3Store((s) => s.card.mechanism)
  const toggleMechanism = useTC3Store((s) => s.toggleMechanism)
  const setMechanismOther = useTC3Store((s) => s.setMechanismOther)

  const [popoverVisible, setPopoverVisible] = useState(false)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)
  const fabRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLButtonElement>(null)

  const [draftTypes, setDraftTypes] = useState<MechanismType[]>([])
  const [draftOther, setDraftOther] = useState('')

  const openPopover = useCallback((ref: React.RefObject<HTMLElement | null>) => {
    setDraftTypes([...mechanism.types])
    setDraftOther(mechanism.otherDescription)
    setAnchorRect(ref.current?.getBoundingClientRect() ?? null)
    setPopoverVisible(true)
  }, [mechanism.types, mechanism.otherDescription])

  const handleToggleDraft = useCallback((type: MechanismType) => {
    setDraftTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    )
  }, [])

  const handleAccept = useCallback(() => {
    const current = new Set(mechanism.types)
    const draft = new Set(draftTypes)
    for (const t of current) {
      if (!draft.has(t)) toggleMechanism(t)
    }
    for (const t of draft) {
      if (!current.has(t)) toggleMechanism(t)
    }
    setMechanismOther(draftOther)
  }, [mechanism.types, draftTypes, draftOther, toggleMechanism, setMechanismOther])

  const handleReset = useCallback(() => {
    setDraftTypes([])
    setDraftOther('')
    for (const t of mechanism.types) toggleMechanism(t)
    setMechanismOther('')
  }, [mechanism.types, toggleMechanism, setMechanismOther])

  const populated = mechanism.types.length > 0

  return (
    <div>
      {/* Section header */}
      <div className="mb-2">
        <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider">
          Mechanism of Injury
        </p>
      </div>

      {/* Section card */}
      {populated ? (
        <div className="relative rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
          <button
            ref={cardRef}
            type="button"
            onClick={() => openPopover(cardRef)}
            className="w-full text-left active:scale-95 transition-all hover:bg-themeblue2/5"
          >
            <div className="flex items-center gap-3 px-4 py-3.5 pr-12">
              <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-tertiary/10">
                <Crosshair size={18} className="text-tertiary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-primary">
                  {mechanism.types.join(', ')}
                </p>
                {mechanism.types.includes('Other') && mechanism.otherDescription && (
                  <p className="text-[9pt] text-tertiary mt-0.5 truncate">
                    {mechanism.otherDescription}
                  </p>
                )}
              </div>
            </div>
          </button>
          <ActionPill ref={fabRef} shadow="sm" className="absolute top-2 right-2 z-10">
            <ActionButton icon={Plus} label="Edit mechanism" onClick={() => openPopover(fabRef)} />
          </ActionPill>
        </div>
      ) : (
        <EmptyState
          title="No mechanism recorded"
          action={{
            icon: Plus,
            label: 'Add mechanism',
            onClick: (anchor) => openPopover({ current: anchor }),
          }}
        />
      )}

      {/* Edit popover */}
      <PreviewOverlay
        isOpen={popoverVisible}
        onClose={() => setPopoverVisible(false)}
        anchorRect={anchorRect}
        maxWidth={380}
        preview={
          <div className="px-4 py-3 space-y-3">
            <SectionHeader>Select All That Apply</SectionHeader>
            <div className="rounded-2xl border border-themeblue3/10 bg-themewhite overflow-hidden divide-y divide-tertiary/8 mt-1.5">
              {MECHANISM_OPTIONS.map((opt) => {
                const isSelected = draftTypes.includes(opt.type)
                return (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => handleToggleDraft(opt.type)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-themeblue2/5 transition-colors"
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 transition-colors ${isSelected ? 'bg-themeredred' : 'bg-tertiary/20'}`} />
                    <span className={`text-sm flex-1 ${isSelected ? 'font-medium text-primary' : 'text-tertiary'}`}>
                      {opt.label}
                    </span>
                    {isSelected && <Check size={14} className="text-themeredred shrink-0" />}
                  </button>
                )
              })}
            </div>

            {/* Other description */}
            {draftTypes.includes('Other') && (
              <div className="space-y-1 pt-1">
                <span className="text-[10pt] font-medium text-tertiary uppercase tracking-wide">Describe Other</span>
                <input
                  type="text"
                  value={draftOther}
                  onChange={(e) => setDraftOther(e.target.value)}
                  placeholder="Describe mechanism..."
                  className="w-full px-4 py-2.5 rounded-full text-sm bg-themewhite border border-themeblue3/10 shadow-xs focus:border-themeblue1/30 focus:bg-themewhite2 focus:outline-none transition-all duration-300 placeholder:text-tertiary"
                />
              </div>
            )}
          </div>
        }
        actions={[
          {
            key: 'reset',
            label: 'Reset',
            icon: RotateCcw,
            onAction: handleReset,
            variant: 'danger',
          },
          {
            key: 'accept',
            label: 'Accept',
            icon: Check,
            onAction: handleAccept,
          },
        ]}
      />
    </div>
  )
})
