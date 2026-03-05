import { memo, useCallback, useState } from 'react'
import {
  User, Zap, Activity, Pill, HeartPulse, Truck, FileCheck, RotateCcw, X,
} from 'lucide-react'
import { useTC3Store } from '../../stores/useTC3Store'
import { TC3_SECTIONS, type TC3Section, type TC3Injury, type InjuryType, type BodySide } from '../../Types/TC3Types'
import { useNavigationStore } from '../../stores/useNavigationStore'

// Filter out the 'injuries' section — body diagram is now inline in this panel
const NAV_SECTIONS = TC3_SECTIONS.filter(s => s.id !== 'injuries')

const SECTION_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  user: User,
  zap: Zap,
  activity: Activity,
  pill: Pill,
  'heart-pulse': HeartPulse,
  truck: Truck,
  'file-check': FileCheck,
}

const INJURY_COLORS: Record<InjuryType, string> = {
  GSW: '#ef4444',
  blast: '#f97316',
  burn: '#eab308',
  laceration: '#3b82f6',
  fracture: '#8b5cf6',
  amputation: '#dc2626',
  other: '#6b7280',
}

// ── Inline body SVGs ─────────────────────────────────────────

const BodyFrontSVG = () => (
  <svg viewBox="0 0 200 400" className="w-full h-full" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="100" cy="35" rx="22" ry="28" />
    <line x1="92" y1="62" x2="92" y2="75" />
    <line x1="108" y1="62" x2="108" y2="75" />
    <path d="M70 75 L60 85 L55 140 L60 200 L75 210 L80 200 L100 205 L120 200 L125 210 L140 200 L145 140 L140 85 L130 75 Z" />
    <path d="M60 85 L40 120 L30 170 L25 200 L30 205 L38 200 L45 170 L55 140" />
    <path d="M140 85 L160 120 L170 170 L175 200 L170 205 L162 200 L155 170 L145 140" />
    <path d="M75 210 L70 270 L68 330 L65 370 L62 385 L78 385 L80 370 L82 330 L85 270 L100 205" />
    <path d="M125 210 L130 270 L132 330 L135 370 L138 385 L122 385 L120 370 L118 330 L115 270 L100 205" />
  </svg>
)

const BodyBackSVG = () => (
  <svg viewBox="0 0 200 400" className="w-full h-full" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="100" cy="35" rx="22" ry="28" />
    <line x1="92" y1="62" x2="92" y2="75" />
    <line x1="108" y1="62" x2="108" y2="75" />
    <path d="M70 75 L60 85 L55 140 L58 200 L75 215 L100 210 L125 215 L142 200 L145 140 L140 85 L130 75 Z" />
    <line x1="100" y1="75" x2="100" y2="200" strokeDasharray="4 3" opacity="0.4" />
    <path d="M60 85 L40 120 L30 170 L25 200 L30 205 L38 200 L45 170 L55 140" />
    <path d="M140 85 L160 120 L170 170 L175 200 L170 205 L162 200 L155 170 L145 140" />
    <path d="M75 215 L70 270 L68 330 L65 370 L62 385 L78 385 L80 370 L82 330 L85 270 L100 210" />
    <path d="M125 215 L130 270 L132 330 L135 370 L138 385 L122 385 L120 370 L118 330 L115 270 L100 210" />
    <path d="M75 215 Q100 225 125 215" strokeDasharray="3 3" opacity="0.3" />
  </svg>
)

// ── Injury marker overlay ────────────────────────────────────

function MarkerDot({ injury, onRemove }: { injury: TC3Injury; onRemove: () => void }) {
  const color = INJURY_COLORS[injury.type] ?? '#6b7280'
  return (
    <div
      className="absolute group"
      style={{ left: `${injury.x}%`, top: `${injury.y}%`, transform: 'translate(-50%, -50%)', zIndex: 10 }}
    >
      <div
        className="w-3.5 h-3.5 rounded-full border border-white shadow-sm"
        style={{ backgroundColor: color }}
      />
      <button
        onClick={(e) => { e.stopPropagation(); onRemove() }}
        className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full bg-themewhite border border-tertiary/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <X size={7} className="text-themeredred" />
      </button>
    </div>
  )
}

// ── Clickable body panel ─────────────────────────────────────

function BodyPanel({ side, label }: { side: BodySide; label: string }) {
  const injuries = useTC3Store((s) => s.card.injuries)
  const addInjury = useTC3Store((s) => s.addInjury)
  const removeInjury = useTC3Store((s) => s.removeInjury)

  const sideInjuries = injuries.filter(inj => inj.side === side)

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    addInjury({
      id: crypto.randomUUID(),
      x, y,
      side,
      type: 'GSW',
      description: '',
    })
  }, [side, addInjury])

  return (
    <div className="flex-1 min-w-0">
      <p className="text-[9px] font-semibold text-tertiary/40 tracking-widest uppercase text-center mb-0.5">{label}</p>
      <div
        className="relative cursor-crosshair text-tertiary/25 mx-auto"
        style={{ maxWidth: '110px', aspectRatio: '200/400' }}
        onClick={handleClick}
      >
        {side === 'front' ? <BodyFrontSVG /> : <BodyBackSVG />}
        {sideInjuries.map(inj => (
          <MarkerDot key={inj.id} injury={inj} onRemove={() => removeInjury(inj.id)} />
        ))}
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────

interface TC3SectionListProps {
  onSelectSection: (section: TC3Section) => void
}

export const TC3SectionList = memo(function TC3SectionList({ onSelectSection }: TC3SectionListProps) {
  const selectedSection = useTC3Store((s) => s.selectedSection)
  const card = useTC3Store((s) => s.card)
  const resetCard = useTC3Store((s) => s.resetCard)
  const isMobile = useNavigationStore((s) => s.isMobile)

  const [showConfirmReset, setShowConfirmReset] = useState(false)

  const getSectionStatus = (id: TC3Section): 'empty' | 'partial' | 'complete' => {
    switch (id) {
      case 'casualty':
        if (card.casualty.lastName && card.casualty.firstName) return 'complete'
        if (card.casualty.lastName || card.casualty.firstName || card.casualty.battleRosterNo) return 'partial'
        return 'empty'
      case 'mechanism':
        return card.mechanism.types.length > 0 ? 'complete' : 'empty'
      case 'injuries':
        return card.injuries.length > 0 ? 'complete' : 'empty'
      case 'march': {
        const m = card.march
        const hasTq = m.massiveHemorrhage.tourniquets.length > 0
        const hasAirway = m.airway.intact || m.airway.npa || m.airway.cric || m.airway.ett || m.airway.supraglottic || m.airway.chinLift
        const hasResp = m.respiration.needleDecomp.performed || m.respiration.chestSeal.applied || m.respiration.o2
        const hasCirc = m.circulation.ivAccess.length > 0 || m.circulation.fluids.length > 0
        const hasHypo = m.hypothermia.prevention
        if (hasTq || hasAirway || hasResp || hasCirc || hasHypo) return 'partial'
        return 'empty'
      }
      case 'medications':
        return card.medications.length > 0 ? 'complete' : 'empty'
      case 'vitals':
        return card.vitals.length > 0 ? 'complete' : 'empty'
      case 'evacuation':
        return card.evacuation.priority ? 'complete' : 'empty'
      case 'review':
        return 'empty'
      default:
        return 'empty'
    }
  }

  const handleReset = () => {
    if (!showConfirmReset) { setShowConfirmReset(true); return }
    resetCard()
    setShowConfirmReset(false)
  }

  const injuryCount = card.injuries.length

  return (
    <div
      className="h-full overflow-y-auto bg-themewhite"
      style={isMobile ? { paddingTop: 'calc(env(safe-area-inset-top, 0px) + 4rem)' } : undefined}
    >
      <div className="px-2 pb-4">
        {/* Header */}
        <div className="px-2 pt-2 pb-1">
          <p className="text-[10px] font-semibold text-themeredred/60 tracking-widest uppercase">
            DD 1380 — TC3 Card
          </p>
        </div>

        {/* Body diagram — front on left, back on right */}
        <div className="flex gap-1 px-1 py-2">
          <BodyPanel side="front" label="Front" />
          <BodyPanel side="back" label="Back" />
        </div>
        {injuryCount > 0 && (
          <p className="text-[9px] text-tertiary/50 text-center -mt-1 mb-1">
            {injuryCount} injur{injuryCount === 1 ? 'y' : 'ies'} marked — tap body to add
          </p>
        )}
        {injuryCount === 0 && (
          <p className="text-[9px] text-tertiary/30 text-center -mt-1 mb-1">
            Tap body to mark injuries
          </p>
        )}

        {/* Section buttons */}
        <div className="space-y-0.5 mt-1">
          {NAV_SECTIONS.map((section) => {
            const Icon = SECTION_ICONS[section.icon]
            const isActive = selectedSection === section.id
            const status = getSectionStatus(section.id)

            return (
              <button
                key={section.id}
                onClick={() => onSelectSection(section.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all text-left
                  ${isActive
                    ? 'bg-themeredred/10 border border-themeredred/20'
                    : 'border border-transparent hover:bg-tertiary/5'
                  }`}
              >
                {Icon && (
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                    isActive ? 'bg-themeredred/15' : 'bg-tertiary/10'
                  }`}>
                    <Icon size={14} className={isActive ? 'text-themeredred' : 'text-tertiary/50'} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium ${isActive ? 'text-primary' : 'text-tertiary'}`}>
                    {section.label}
                  </p>
                </div>
                {status !== 'empty' && (
                  <div className={`w-2 h-2 rounded-full shrink-0 ${
                    status === 'complete' ? 'bg-green-500' : 'bg-amber-400'
                  }`} />
                )}
              </button>
            )
          })}
        </div>

        {/* Reset card */}
        <div className="mt-3 px-2">
          {showConfirmReset ? (
            <div className="flex items-center gap-2 py-1">
              <span className="text-[10px] text-themeredred">Clear all data?</span>
              <button
                onClick={handleReset}
                className="text-[10px] px-2.5 py-1 rounded-md bg-themeredred text-white hover:bg-themeredred/90 transition-colors"
              >
                Confirm
              </button>
              <button
                onClick={() => setShowConfirmReset(false)}
                className="text-[10px] px-2.5 py-1 rounded-md text-tertiary hover:bg-tertiary/10 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 text-[10px] text-tertiary/50 hover:text-themeredred transition-colors py-1"
            >
              <RotateCcw size={12} /> <span>New Card</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
})
