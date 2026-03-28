import { useNavigationStore } from '../../stores/useNavigationStore'
import type { PatientType } from './burnDiagramTypes'
import { REGIONS_MAP, formatPct } from './burnRegions'
import { ALL_RECTS } from './burnRegionRects'
import bodyOutline from './burn-body-outline.svg'

interface Props {
    patientType: PatientType
    burnedRegions: Set<string>
    onToggle: (id: string) => void
}

/* ── Constants matching the SVG viewBox ──────────────────────────────────── */

const VB_X = 0
const VB_Y = 95
const VB_W = 1040
const VB_H = 909

const MOBILE_W = 360
const MOBILE_H = Math.round(MOBILE_W * (VB_H / VB_W))
const DESKTOP_W = 520
const DESKTOP_H = Math.round(DESKTOP_W * (VB_H / VB_W))

// Dashed region divider lines (in SVG coordinate space)
const DIVIDERS = [
    // Posterior: upper-back / lower-back split
    { x1: 110, y1: 490, x2: 360, y2: 490 },
    // Anterior: chest / abdomen split
    { x1: 660, y1: 480, x2: 920, y2: 480 },
    // Anterior: abdomen / genitalia split
    { x1: 700, y1: 600, x2: 880, y2: 600 },
]

/* ── Component ───────────────────────────────────────────────────────────── */

export function BodyRegionSvg({ patientType, burnedRegions, onToggle }: Props) {
    const isMobile = useNavigationStore(s => s.isMobile)
    const w = isMobile ? MOBILE_W : DESKTOP_W
    const h = isMobile ? MOBILE_H : DESKTOP_H

    return (
        <div className="flex flex-col items-center">
            <svg
                viewBox={`${VB_X} ${VB_Y} ${VB_W} ${VB_H}`}
                width={w}
                height={h}
                className="select-none"
            >
                {/* Detailed body outline */}
                <image
                    href={bodyOutline}
                    x={VB_X}
                    y={VB_Y}
                    width={VB_W}
                    height={VB_H}
                    preserveAspectRatio="xMidYMid meet"
                />

                {/* Region dividers */}
                {DIVIDERS.map((l, i) => (
                    <line
                        key={i}
                        x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
                        stroke="rgba(255, 255, 255, 0.6)" strokeWidth={2}
                        strokeDasharray="8 5"
                    />
                ))}

                {/* Region hit zones */}
                {ALL_RECTS.map(rect => {
                    const burned = burnedRegions.has(rect.id)
                    const meta = REGIONS_MAP[rect.id]
                    const pct = meta
                        ? formatPct(patientType === 'adult' ? meta.adultPct : meta.pedPct)
                        : ''

                    const x = (rect.x / 100) * VB_W + VB_X
                    const y = (rect.y / 100) * VB_H + VB_Y
                    const rw = (rect.w / 100) * VB_W
                    const rh = (rect.h / 100) * VB_H
                    const cx = x + rw / 2
                    const cy = y + rh / 2
                    const isOval = rect.shape === 'oval'

                    const fill = burned ? 'rgba(170, 65, 65, 0.45)' : 'rgba(255, 255, 255, 0.08)'
                    const stroke = burned ? 'rgba(170, 65, 65, 0.7)' : 'rgba(255, 255, 255, 0.2)'
                    const strokeWidth = burned ? 2.5 : 1.5

                    const rotation = rect.angle ? `rotate(${rect.angle} ${cx} ${cy})` : undefined

                    return (
                        <g key={rect.id} transform={rotation}>
                            {isOval ? (
                                <ellipse
                                    cx={cx} cy={cy} rx={rw / 2} ry={rh / 2}
                                    fill={fill} stroke={stroke} strokeWidth={strokeWidth}
                                    className="cursor-pointer"
                                    onClick={() => onToggle(rect.id)}
                                    role="button"
                                    aria-label={meta?.label ?? rect.id}
                                />
                            ) : (
                                <rect
                                    x={x} y={y} width={rw} height={rh} rx={8}
                                    fill={fill} stroke={stroke} strokeWidth={strokeWidth}
                                    className="cursor-pointer"
                                    onClick={() => onToggle(rect.id)}
                                    role="button"
                                    aria-label={meta?.label ?? rect.id}
                                />
                            )}
                            {burned && (
                                <text
                                    x={cx}
                                    y={cy}
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    fill="rgba(255, 255, 255, 0.95)"
                                    className="pointer-events-none select-none"
                                    style={{ fontSize: 22, fontWeight: 600 }}
                                >
                                    {pct}
                                </text>
                            )}
                        </g>
                    )
                })}
            </svg>

            {/* Labels outside SVG canvas */}
            <div className="flex justify-around mt-1" style={{ width: w }}>
                <p className="text-[9px] font-semibold text-tertiary/50 uppercase tracking-widest">Posterior</p>
                <p className="text-[9px] font-semibold text-tertiary/50 uppercase tracking-widest">Anterior</p>
            </div>
        </div>
    )
}
