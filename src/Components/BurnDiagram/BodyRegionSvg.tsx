import type { PatientType } from './burnDiagramTypes'
import { REGIONS_MAP, formatPct } from './burnRegions'
import { ALL_RECTS } from './burnRegionRects'
import burnDiagramSrc from './burn-rule-of-nines.png'

interface Props {
    patientType: PatientType
    burnedRegions: Set<string>
    onToggle: (id: string) => void
}

export function BodyRegionSvg({ patientType, burnedRegions, onToggle }: Props) {
    return (
        <svg viewBox="0 0 465 478" className="w-full select-none">
            {/* Clinical diagram as background */}
            <image
                href={burnDiagramSrc}
                width="465"
                height="478"
            />

            {/* Region hit zones */}
            {ALL_RECTS.map(rect => {
                const burned = burnedRegions.has(rect.id)
                const meta = REGIONS_MAP[rect.id]
                const pct = meta
                    ? formatPct(patientType === 'adult' ? meta.adultPct : meta.pedPct)
                    : ''

                // Convert percentage coords to absolute SVG coords
                const x = (rect.x / 100) * 465
                const y = (rect.y / 100) * 478
                const w = (rect.w / 100) * 465
                const h = (rect.h / 100) * 478

                return (
                    <g key={rect.id}>
                        <rect
                            x={x}
                            y={y}
                            width={w}
                            height={h}
                            rx={3}
                            fill={burned ? 'rgba(170, 65, 65, 0.3)' : 'transparent'}
                            stroke={burned ? 'rgba(170, 65, 65, 0.6)' : 'transparent'}
                            strokeWidth={burned ? 1.5 : 0}
                            className="cursor-pointer"
                            onClick={() => onToggle(rect.id)}
                            role="button"
                            aria-label={meta?.label ?? rect.id}
                        />
                        {burned && (
                            <text
                                x={x + w / 2}
                                y={y + h / 2}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fill="rgba(170, 65, 65, 0.85)"
                                className="pointer-events-none select-none"
                                style={{ fontSize: 11, fontWeight: 600 }}
                            >
                                {pct}
                            </text>
                        )}
                    </g>
                )
            })}
        </svg>
    )
}
