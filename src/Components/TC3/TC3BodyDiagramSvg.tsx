import { useCallback } from 'react'
import { useNavigationStore } from '../../stores/useNavigationStore'
import { ALL_TC3_RECTS } from './tc3RegionRects'
import type { TC3Marker } from '../../Types/TC3Types'
import type { RegionRect } from '../BurnDiagram/burnRegionRects'
import bodyOutline from './tc3-body-outline.svg'

/* ── Constants matching the SVG viewBox ──────────────────────────────────── */

const VB_X = 0
const VB_Y = 0
const VB_W = 600
const VB_H = 512

const MOBILE_W = 360
const MOBILE_H = Math.round(MOBILE_W * (VB_H / VB_W))
const DESKTOP_W = 520
const DESKTOP_H = Math.round(DESKTOP_W * (VB_H / VB_W))

const INJURY_COLORS: Record<string, string> = {
    GSW: '#ef4444',
    blast: '#f97316',
    burn: '#eab308',
    laceration: '#3b82f6',
    fracture: '#8b5cf6',
    amputation: '#dc2626',
    other: '#6b7280',
}

const INJURY_LABELS: Record<string, string> = {
    GSW: 'G',
    blast: 'B',
    burn: 'Bn',
    laceration: 'L',
    fracture: 'F',
    amputation: 'A',
    other: 'O',
}

const PROCEDURE_COLORS: Record<string, string> = {
    IV: '#22c55e',
    IO: '#14b8a6',
}


/* ── Helpers ──────────────────────────────────────────────────────────────── */

function rectCenter(rect: RegionRect): { cx: number; cy: number; svgX: number; svgY: number; svgW: number; svgH: number } {
    const svgX = (rect.x / 100) * VB_W + VB_X
    const svgY = (rect.y / 100) * VB_H + VB_Y
    const svgW = (rect.w / 100) * VB_W
    const svgH = (rect.h / 100) * VB_H
    return { cx: svgX + svgW / 2, cy: svgY + svgH / 2, svgX, svgY, svgW, svgH }
}

/** Determine the visual style for a unified marker */
function getMarkerVisual(marker: TC3Marker): { color: string; label: string; mode: 'injury' | 'procedure' | 'treatment' } {
    if (marker.injuries.length > 0) {
        const first = marker.injuries[0]
        return {
            color: INJURY_COLORS[first] ?? '#6b7280',
            label: INJURY_LABELS[first] ?? '?',
            mode: 'injury',
        }
    }
    if (marker.procedures.length > 0) {
        const first = marker.procedures[0]
        return {
            color: PROCEDURE_COLORS[first] ?? '#22c55e',
            label: first,
            mode: 'procedure',
        }
    }
    // Treatments only
    return { color: '#f59e0b', label: 'T', mode: 'treatment' }
}

/* ── Props ────────────────────────────────────────────────────────────────── */

interface Props {
    markers?: TC3Marker[]
    editingMarker?: string | null
    onAddMarker?: (x: number, y: number) => void
    onEditMarker?: (id: string | null) => void
    readOnly?: boolean
    compact?: boolean
}

/* ── Component ────────────────────────────────────────────────────────────── */

export function TC3BodyDiagramSvg({ markers = [], editingMarker = null, onAddMarker, onEditMarker, readOnly, compact }: Props) {
    const isMobile = useNavigationStore(s => s.isMobile)
    const w = compact ? 260 : isMobile ? MOBILE_W : DESKTOP_W
    const h = compact ? Math.round(260 * (VB_H / VB_W)) : isMobile ? MOBILE_H : DESKTOP_H

    const handleSvgClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
        if (readOnly || !onAddMarker) return
        const svg = e.currentTarget
        const pt = svg.createSVGPoint()
        pt.x = e.clientX
        pt.y = e.clientY
        const svgPt = pt.matrixTransform(svg.getScreenCTM()!.inverse())
        const xPct = ((svgPt.x - VB_X) / VB_W) * 100
        const yPct = ((svgPt.y - VB_Y) / VB_H) * 100
        if (xPct < 0 || xPct > 100 || yPct < 0 || yPct > 100) return
        onAddMarker(xPct, yPct)
    }, [readOnly, onAddMarker])

    return (
        <div className="flex flex-col items-center">
            <svg
                viewBox={`${VB_X} ${VB_Y} ${VB_W} ${VB_H}`}
                width={w}
                height={h}
                className={readOnly ? 'select-none' : 'select-none cursor-crosshair'}
                onClick={handleSvgClick}
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

                {/* Invisible region hit zones (debug: change opacity to see them) */}
                {!readOnly && ALL_TC3_RECTS.map(rect => {
                    const { cx, cy, svgX, svgY, svgW, svgH } = rectCenter(rect)
                    const rotation = rect.angle ? `rotate(${rect.angle} ${cx} ${cy})` : undefined
                    const isOval = rect.shape === 'oval'

                    return (
                        <g key={rect.id} transform={rotation}>
                            {isOval ? (
                                <ellipse
                                    cx={cx} cy={cy} rx={svgW / 2} ry={svgH / 2}
                                    fill="rgba(0, 0, 0, 0.0)"
                                    stroke="rgba(0, 0, 0, 0.0)"
                                    strokeWidth={1}
                                />
                            ) : (
                                <rect
                                    x={svgX} y={svgY} width={svgW} height={svgH} rx={8}
                                    fill="rgba(0, 0, 0, 0.0)"
                                    stroke="rgba(0, 0, 0, 0.0)"
                                    strokeWidth={1}
                                />
                            )}
                        </g>
                    )
                })}

                {/* Unified markers */}
                {markers.map(marker => {
                    const mx = (marker.x / 100) * VB_W + VB_X
                    const my = (marker.y / 100) * VB_H + VB_Y
                    const isEditing = editingMarker === marker.id
                    const r = compact ? 8 : 12
                    const { color, label, mode } = getMarkerVisual(marker)

                    return (
                        <g
                            key={marker.id}
                            onClick={(e) => {
                                e.stopPropagation()
                                onEditMarker?.(isEditing ? null : marker.id)
                            }}
                            className="cursor-pointer"
                        >
                            {/* White outline */}
                            <circle cx={mx} cy={my} r={r + 2} fill="white" opacity={0.9} />
                            {/* Colored dot */}
                            <circle cx={mx} cy={my} r={r} fill={color} />

                            {mode === 'procedure' ? (
                                <>
                                    {/* Cross icon for procedure-only markers */}
                                    <line x1={mx - r * 0.45} y1={my} x2={mx + r * 0.45} y2={my} stroke="white" strokeWidth={2} strokeLinecap="round" className="pointer-events-none" />
                                    <line x1={mx} y1={my - r * 0.45} x2={mx} y2={my + r * 0.45} stroke="white" strokeWidth={2} strokeLinecap="round" className="pointer-events-none" />
                                    {/* Type label below cross */}
                                    <text
                                        x={mx}
                                        y={my + r + (compact ? 6 : 9)}
                                        textAnchor="middle"
                                        fill={color}
                                        style={{ fontSize: compact ? 7 : 9, fontWeight: 700 }}
                                        className="pointer-events-none select-none"
                                    >
                                        {label}
                                    </text>
                                </>
                            ) : (
                                /* Letter label for injury / treatment markers */
                                <text
                                    x={mx}
                                    y={my}
                                    textAnchor="middle"
                                    dominantBaseline="central"
                                    fill="white"
                                    style={{ fontSize: compact ? 8 : 11, fontWeight: 700 }}
                                    className="pointer-events-none select-none"
                                >
                                    {label}
                                </text>
                            )}

                            {/* Procedure badge — shown on injury markers that also have procedures */}
                            {mode === 'injury' && marker.procedures.length > 0 && (
                                <circle
                                    cx={mx + r * 0.7}
                                    cy={my - r * 0.7}
                                    r={compact ? 3 : 5}
                                    fill={PROCEDURE_COLORS[marker.procedures[0]] ?? '#22c55e'}
                                    stroke="white"
                                    strokeWidth={1.5}
                                />
                            )}

                            {/* Treatment badge — shown on injury markers that have treatments (no procedures) */}
                            {mode === 'injury' && marker.procedures.length === 0 && marker.treatments.length > 0 && (
                                <circle
                                    cx={mx + r * 0.7}
                                    cy={my - r * 0.7}
                                    r={compact ? 3 : 5}
                                    fill="#22c55e"
                                    stroke="white"
                                    strokeWidth={1.5}
                                />
                            )}

                            {/* Editing ring */}
                            {isEditing && (
                                <circle
                                    cx={mx} cy={my} r={r + 5}
                                    fill="none"
                                    stroke={color}
                                    strokeWidth={2}
                                    strokeDasharray="4 3"
                                    opacity={0.6}
                                />
                            )}
                        </g>
                    )
                })}
            </svg>

            {/* Labels outside SVG canvas */}
            <div className="flex mt-1" style={{ width: w }}>
                <p className="flex-1 text-center text-[9px] font-semibold text-tertiary/50 uppercase tracking-widest">Anterior</p>
                <p className="flex-1 text-center text-[9px] font-semibold text-tertiary/50 uppercase tracking-widest">Posterior</p>
            </div>
        </div>
    )
}
