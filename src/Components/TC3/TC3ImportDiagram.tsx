import { memo } from 'react'
import type { TC3Injury, InjuryType } from '../../Types/TC3Types'

const INJURY_COLORS: Record<InjuryType, string> = {
  GSW: '#ef4444',
  blast: '#f97316',
  burn: '#eab308',
  laceration: '#3b82f6',
  fracture: '#8b5cf6',
  amputation: '#dc2626',
  other: '#6b7280',
}

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

function InjuryDot({ injury }: { injury: TC3Injury }) {
  const color = INJURY_COLORS[injury.type] ?? '#6b7280'
  return (
    <div
      className="absolute"
      style={{
        left: `${injury.x}%`,
        top: `${injury.y}%`,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <div
        className="w-3 h-3 rounded-full border border-white shadow-sm"
        style={{ backgroundColor: color }}
      />
    </div>
  )
}

interface TC3ImportDiagramProps {
  injuries: TC3Injury[]
}

/** Read-only body diagram showing front + back with injury dots (colored by type). */
export const TC3ImportDiagram = memo(function TC3ImportDiagram({ injuries }: TC3ImportDiagramProps) {
  const frontInjuries = injuries.filter(i => i.side === 'front')
  const backInjuries = injuries.filter(i => i.side === 'back')

  return (
    <div className="flex gap-2 px-2 py-1">
      <div className="flex-1 min-w-0">
        <p className="text-[8px] font-semibold text-tertiary/40 tracking-widest uppercase text-center mb-0.5">Front</p>
        <div className="relative text-tertiary/20 mx-auto" style={{ maxWidth: '80px', aspectRatio: '200/400' }}>
          <BodyFrontSVG />
          {frontInjuries.map(inj => <InjuryDot key={inj.id} injury={inj} />)}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[8px] font-semibold text-tertiary/40 tracking-widest uppercase text-center mb-0.5">Back</p>
        <div className="relative text-tertiary/20 mx-auto" style={{ maxWidth: '80px', aspectRatio: '200/400' }}>
          <BodyBackSVG />
          {backInjuries.map(inj => <InjuryDot key={inj.id} injury={inj} />)}
        </div>
      </div>
    </div>
  )
})
