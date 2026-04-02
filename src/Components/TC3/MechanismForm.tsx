import { memo, useState, useRef, useCallback } from 'react'
import { Plus, Check, RotateCcw, ChevronRight, Crosshair } from 'lucide-react'
import { useTC3Store } from '../../stores/useTC3Store'
import { ContextMenuPreview } from '../ContextMenuPreview'
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

export const MechanismForm = memo(function MechanismForm({
  panelRef,
}: {
  panelRef?: React.RefObject<HTMLElement | null>
}) {
  const mechanism = useTC3Store((s) => s.card.mechanism)
  const toggleMechanism = useTC3Store((s) => s.toggleMechanism)
  const setMechanismOther = useTC3Store((s) => s.setMechanismOther)

  const [popoverVisible, setPopoverVisible] = useState(false)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)

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
      <div className="flex items-center justify-between mb-2">
        <p className="text-[9pt] font-semibold text-primary/80 uppercase tracking-wider">
          Mechanism of Injury
        </p>
        {!populated && (
          <button
            ref={btnRef}
            type="button"
            onClick={() => openPopover(btnRef)}
            className="w-7 h-7 rounded-full flex items-center justify-center active:scale-95 transition-all bg-tertiary/8 border border-dashed border-tertiary/20 text-tertiary/40"
          >
            <Plus size={13} />
          </button>
        )}
      </div>

      {/* Section card */}
      {populated ? (
        <div ref={cardRef} className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
          <button
            type="button"
            onClick={() => openPopover(cardRef)}
            className="flex items-center gap-3 w-full px-4 py-3.5 transition-all active:scale-95 hover:bg-themeblue2/5"
          >
            <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-tertiary/10">
              <Crosshair size={18} className="text-tertiary/60" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-medium text-primary">
                {mechanism.types.join(', ')}
              </p>
              {mechanism.types.includes('Other') && mechanism.otherDescription && (
                <p className="text-[11px] text-tertiary/70 mt-0.5 truncate">
                  {mechanism.otherDescription}
                </p>
              )}
            </div>
            <span className="text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-themeredred/10 text-themeredred shrink-0">
              {mechanism.types.length}
            </span>
            <ChevronRight size={16} className="text-tertiary/40 shrink-0" />
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-tertiary/15 bg-themewhite2/50 py-6 flex flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={() => openPopover(btnRef)}
            className="w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-all bg-tertiary/8 border border-dashed border-tertiary/20 text-tertiary/40"
          >
            <Plus size={15} />
          </button>
          <p className="text-[10px] text-tertiary/40">Add mechanism of injury</p>
        </div>
      )}

      {/* Edit popover */}
      <ContextMenuPreview
        isVisible={popoverVisible}
        onClose={() => setPopoverVisible(false)}
        anchorRect={anchorRect}
        maxWidth="max-w-[380px]"
        containerRef={panelRef}
        preview={
          <div className="px-4 py-3 space-y-3">
            <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">Select All That Apply</span>
            <div className="space-y-2 mt-1.5">
              {MECHANISM_OPTIONS.map((opt) => {
                const isSelected = draftTypes.includes(opt.type)
                return (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => handleToggleDraft(opt.type)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left
                      ${isSelected
                        ? 'border-themeredred/25 bg-themeredred/10'
                        : 'border-tertiary/15 bg-themewhite2 hover:bg-themewhite2/80'
                      }`}
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors
                      ${isSelected ? 'border-themeredred bg-themeredred' : 'border-tertiary/30'}`}
                    >
                      {isSelected && (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <span className={`text-sm font-medium ${isSelected ? 'text-primary' : 'text-tertiary'}`}>
                      {opt.label}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Other description */}
            {draftTypes.includes('Other') && (
              <div className="space-y-1 pt-1">
                <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">Describe Other</span>
                <input
                  type="text"
                  value={draftOther}
                  onChange={(e) => setDraftOther(e.target.value)}
                  placeholder="Describe mechanism..."
                  className="w-full px-4 py-2.5 rounded-full text-sm bg-themewhite border border-themeblue3/10 shadow-xs focus:border-themeblue1/30 focus:bg-themewhite2 focus:outline-none transition-all duration-300 placeholder:text-tertiary/30"
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
