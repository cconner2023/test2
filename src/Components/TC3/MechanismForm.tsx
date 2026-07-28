import { memo, useState, useRef, useCallback } from 'react'
import { Plus, Check, RotateCcw, Crosshair, ChevronRight } from 'lucide-react'
import { useTC3Store } from '../../stores/useTC3Store'
import { TC3EditorSurface } from './TC3EditorSurface'
import { EmptyState } from '@/Components/primitives/EmptyState'
import { TextInput } from '@/Components/primitives/FormInputs'
import { Chip, ChipBar } from '@/Components/primitives/Chip'
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
  const showOther = draftTypes.includes('Other')

  return (
    <div>
      {/* Section header */}
      <div className="mb-2">
        <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider">
          Mechanism of Injury
        </p>
      </div>

      {/* Section card — same shape as Casualty Information: tap the row to edit
          (chevron affordance), no overlaid add pill. */}
      {populated ? (
        <button
          ref={cardRef}
          type="button"
          onClick={() => openPopover(cardRef)}
          className="w-full rounded-2xl bg-themewhite2 overflow-hidden text-left active:scale-95 transition-all hover:bg-themeblue2/5"
        >
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-tertiary/10">
              <Crosshair size={18} className="text-tertiary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="flex-1 min-w-0 text-sm font-medium text-primary truncate">
                  {mechanism.types.join(', ')}
                </p>
                <ChevronRight size={16} className="text-tertiary shrink-0" />
              </div>
              {mechanism.types.includes('Other') && mechanism.otherDescription && (
                <p className="text-[9pt] text-secondary truncate mt-0.5">
                  {mechanism.otherDescription}
                </p>
              )}
            </div>
          </div>
        </button>
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
      <TC3EditorSurface
        isOpen={popoverVisible}
        onClose={() => setPopoverVisible(false)}
        anchorRect={anchorRect}
        maxWidth={380}
        title="Mechanism"
        preview={
          <div>
            {/* Multi-select, but rendered with the same flat segmented row the
                Casualty Info editor uses for Sex / Blood Type — no bordered card. */}
            <div className={`px-4 py-3${showOther ? ' border-b border-primary/6' : ''}`}>
              <span className="text-[9pt] font-semibold text-tertiary uppercase tracking-widest">Mechanism</span>
              <ChipBar className="mt-1.5">
                {MECHANISM_OPTIONS.map((opt) => (
                  <Chip
                    key={opt.type}
                    active={draftTypes.includes(opt.type)}
                    title={`Mechanism: ${opt.label}`}
                    onClick={() => handleToggleDraft(opt.type)}
                  >
                    {opt.label}
                  </Chip>
                ))}
              </ChipBar>
            </div>

            {/* Other description */}
            {showOther && (
              <TextInput
                value={draftOther}
                onChange={setDraftOther}
                placeholder="Describe mechanism…"
              />
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
        ]}
        saveAction={{ icon: Check, label: 'Accept', onAction: () => { handleAccept(); setPopoverVisible(false); } }}
      />
    </div>
  )
})
