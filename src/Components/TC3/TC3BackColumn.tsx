import { memo, useState } from 'react'
import { ChevronRight, RotateCcw } from 'lucide-react'
import { ConfirmDialog } from '../ConfirmDialog'
import { useTC3Store } from '../../stores/useTC3Store'
import { MARCHForm } from './MARCHForm'
import { NotesPanel } from './NotesPanel'
import { TC3WriteNote } from './TC3WriteNote'

// ── OTHER Section ─────────────────────────────
const OtherSection = memo(function OtherSection() {
  const other = useTC3Store((s) => s.card.other)
  const updateOther = useTC3Store((s) => s.updateOther)

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-primary mb-1">Other</h3>
        <p className="text-[11px] text-tertiary/70">DD 1380 — Additional treatments</p>
      </div>

      {/* Combat Pill Pack */}
      <button
        onClick={() => updateOther({ combatPillPack: !other.combatPillPack })}
        className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-all text-left w-full
          ${other.combatPillPack ? 'border-themeredred/25 bg-themeredred/10' : 'border-tertiary/15 bg-themewhite2'}`}
      >
        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors
          ${other.combatPillPack ? 'border-themeredred bg-themeredred' : 'border-tertiary/30'}`}>
          {other.combatPillPack && (
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        <span className={`text-xs font-medium ${other.combatPillPack ? 'text-primary' : 'text-tertiary'}`}>Combat Pill Pack</span>
      </button>

      {/* Eye Shield */}
      <div className="space-y-2">
        <button
          onClick={() => updateOther({ eyeShield: { ...other.eyeShield, applied: !other.eyeShield.applied } })}
          className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-all text-left w-full
            ${other.eyeShield.applied ? 'border-themeredred/25 bg-themeredred/10' : 'border-tertiary/15 bg-themewhite2'}`}
        >
          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors
            ${other.eyeShield.applied ? 'border-themeredred bg-themeredred' : 'border-tertiary/30'}`}>
            {other.eyeShield.applied && (
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
          <span className={`text-xs font-medium ${other.eyeShield.applied ? 'text-primary' : 'text-tertiary'}`}>Eye Shield</span>
        </button>
        {other.eyeShield.applied && (
          <div className="pl-6 flex gap-2">
            {(['R', 'L', 'both'] as const).map((side) => (
              <button
                key={side}
                onClick={() => updateOther({ eyeShield: { ...other.eyeShield, side } })}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all
                  ${other.eyeShield.side === side
                    ? 'border-themeredred/25 bg-themeredred/10 text-primary'
                    : 'border-tertiary/15 text-tertiary hover:bg-tertiary/5'
                  }`}
              >
                {side === 'both' ? 'Both' : side}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Splint */}
      <button
        onClick={() => updateOther({ splint: !other.splint })}
        className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-all text-left w-full
          ${other.splint ? 'border-themeredred/25 bg-themeredred/10' : 'border-tertiary/15 bg-themewhite2'}`}
      >
        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors
          ${other.splint ? 'border-themeredred bg-themeredred' : 'border-tertiary/30'}`}>
          {other.splint && (
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        <span className={`text-xs font-medium ${other.splint ? 'text-primary' : 'text-tertiary'}`}>Splint</span>
      </button>

      {/* Hypothermia Prevention */}
      <div className="space-y-2">
        <button
          onClick={() => updateOther({ hypothermiaPrevention: { ...other.hypothermiaPrevention, applied: !other.hypothermiaPrevention.applied } })}
          className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-all text-left w-full
            ${other.hypothermiaPrevention.applied ? 'border-themeredred/25 bg-themeredred/10' : 'border-tertiary/15 bg-themewhite2'}`}
        >
          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors
            ${other.hypothermiaPrevention.applied ? 'border-themeredred bg-themeredred' : 'border-tertiary/30'}`}>
            {other.hypothermiaPrevention.applied && (
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
          <span className={`text-xs font-medium ${other.hypothermiaPrevention.applied ? 'text-primary' : 'text-tertiary'}`}>Hypothermia Prevention</span>
        </button>
        {other.hypothermiaPrevention.applied && (
          <div className="pl-6">
            <input
              type="text"
              value={other.hypothermiaPrevention.type}
              onChange={(e) => updateOther({ hypothermiaPrevention: { ...other.hypothermiaPrevention, type: e.target.value } })}
              placeholder="Method (Blanket, HPMK, Ready-Heat...)"
              className="w-full text-xs px-3 py-2 rounded-lg border border-tertiary/20 bg-themewhite outline-none focus:border-themeredred/40 text-tertiary"
            />
          </div>
        )}
      </div>
    </div>
  )
})

// ── First Responder Section ───────────────────
const FirstResponderSection = memo(function FirstResponderSection() {
  const firstResponder = useTC3Store((s) => s.card.firstResponder)
  const updateFirstResponder = useTC3Store((s) => s.updateFirstResponder)

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-primary mb-1">First Responder</h3>
        <p className="text-[11px] text-tertiary/70">DD 1380 — First responder signature block</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">Last Name</label>
          <input
            type="text"
            value={firstResponder.lastName}
            onChange={(e) => updateFirstResponder({ lastName: e.target.value })}
            placeholder="Last name"
            className="w-full text-base px-3 py-2 rounded-lg border border-tertiary/20 bg-themewhite outline-none focus:border-themeredred/40 text-tertiary"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">First Name</label>
          <input
            type="text"
            value={firstResponder.firstName}
            onChange={(e) => updateFirstResponder({ firstName: e.target.value })}
            placeholder="First name"
            className="w-full text-base px-3 py-2 rounded-lg border border-tertiary/20 bg-themewhite outline-none focus:border-themeredred/40 text-tertiary"
          />
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">Last 4</label>
        <input
          type="text"
          value={firstResponder.last4}
          onChange={(e) => updateFirstResponder({ last4: e.target.value.slice(0, 4) })}
          placeholder="0000"
          className="w-32 text-base px-3 py-2 rounded-lg border border-tertiary/20 bg-themewhite outline-none focus:border-themeredred/40 text-tertiary"
        />
      </div>
    </div>
  )
})

/** Right column of the desktop DD1380 layout — back of the card. */
export const TC3BackColumn = memo(function TC3BackColumn() {
  const resetCard = useTC3Store((s) => s.resetCard)
  const [showWriteNote, setShowWriteNote] = useState(false)
  const [showConfirmReset, setShowConfirmReset] = useState(false)

  const handleReset = () => {
    resetCard()
    setShowConfirmReset(false)
  }

  return (
    <div className="h-full overflow-y-auto bg-themewhite">
      <div className="px-3 py-4 space-y-6">
        {/* Header */}
        <div className="px-1">
          <p className="text-[10px] font-semibold text-themeredred/60 tracking-widest uppercase">
            DD 1380 — TC3 Card (Back)
          </p>
        </div>

        {/* Interventions (unified MARCH + Meds/Fluids) */}
        <MARCHForm />

        {/* OTHER Section */}
        <OtherSection />

        {/* Notes */}
        <NotesPanel />

        {/* First Responder */}
        <FirstResponderSection />

        {/* Export — disposition card style */}
        <div className="space-y-3">
          <div
            onClick={() => setShowWriteNote(true)}
            className="flex flex-col rounded-md w-full overflow-hidden shadow-sm bg-themewhite2 border border-themeredred/30 cursor-pointer active:scale-95 transition-all"
          >
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="px-3 py-2 shrink-0 rounded-md flex items-center justify-center bg-themeredred font-bold text-sm text-white">
                    TC3
                  </div>
                  <div className="min-w-0 flex-1 flex flex-col">
                    <p className="text-sm text-primary">Export Note & Barcode</p>
                    <p className="text-xs text-secondary mt-0.5">Generate encoded card for transfer</p>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-themeredred/60 hover:bg-themeredred/30 text-white">
                  <ChevronRight className="w-5 h-5" />
                </div>
              </div>
            </div>
          </div>

          {/* New Card */}
          <div className="pt-2 border-t border-tertiary/10">
            <button
              onClick={() => setShowConfirmReset(true)}
              className="flex items-center gap-1.5 text-[11px] text-tertiary hover:text-themeredred transition-colors px-1 py-1"
            >
              <RotateCcw size={14} /> <span>New Card</span>
            </button>
            <ConfirmDialog
              visible={showConfirmReset}
              title="Clear card? Current entries will be lost."
              confirmLabel="Clear"
              variant="danger"
              onConfirm={handleReset}
              onCancel={() => setShowConfirmReset(false)}
            />
          </div>
        </div>

        {/* Export drawer */}
        <TC3WriteNote
          isVisible={showWriteNote}
          onClose={() => setShowWriteNote(false)}
        />
      </div>
    </div>
  )
})
