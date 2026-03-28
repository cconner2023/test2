import { useCallback } from 'react'
import { useNavigationStore } from '../../stores/useNavigationStore'
import { ALL_TC3_RECTS } from './tc3RegionRects'
import { getBodyRegion } from '../../Utilities/bodyRegionMap'
import type { TC3Injury } from '../../Types/TC3Types'
import type { RegionRect } from '../BurnDiagram/burnRegionRects'
import bodyOutline from './tc3-body-outline.svg'

/* ── Constants matching the SVG viewBox ─────���────────────────────────────── */

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

/* ── Helpers ────────���────────────────────────────────────────────────────── */

function rectCenter(rect: RegionRect): { cx: number; cy: number; svgX: number; svgY: number; svgW: number; svgH: number } {
    const svgX = (rect.x / 100) * VB_W + VB_X
    const svgY = (rect.y / 100) * VB_H + VB_Y
    const svgW = (rect.w / 100) * VB_W
    const svgH = (rect.h / 100) * VB_H
    return { cx: svgX + svgW / 2, cy: svgY + svgH / 2, svgX, svgY, svgW, svgH }
}

/* ── Props ──────────────────────���──────────────���─────────────────────────── */

interface Props {
    injuries: TC3Injury[]
    editingInjury: string | null
    onAddInjury: (x: number, y: number) => void
    onEditInjury: (id: string | null) => void
    /** Read-only mode (export views) — hides hit zones, disables clicks */
    readOnly?: boolean
    /** Override width for compact layouts */
    compact?: boolean
}

/* ── Component ──────────────��───────────────────────────────��────────────── */

export function TC3BodyDiagramSvg({ injuries, editingInjury, onAddInjury, onEditInjury, readOnly, compact }: Props) {
    const isMobile = useNavigationStore(s => s.isMobile)
    const w = compact ? 260 : isMobile ? MOBILE_W : DESKTOP_W
    const h = compact ? Math.round(260 * (VB_H / VB_W)) : isMobile ? MOBILE_H : DESKTOP_H

    const handleSvgClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
        if (readOnly) return
        const svg = e.currentTarget
        const pt = svg.createSVGPoint()
        pt.x = e.clientX
        pt.y = e.clientY
        const svgPt = pt.matrixTransform(svg.getScreenCTM()!.inverse())
        // Convert SVG coordinates to percentages of viewBox
        const xPct = ((svgPt.x - VB_X) / VB_W) * 100
        const yPct = ((svgPt.y - VB_Y) / VB_H) * 100
        if (xPct < 0 || xPct > 100 || yPct < 0 || yPct > 100) return
        onAddInjury(xPct, yPct)
    }, [readOnly, onAddInjury])

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

                {/* Injury markers */}
                {injuries.map(inj => {
                    const ix = (inj.x / 100) * VB_W + VB_X
                    const iy = (inj.y / 100) * VB_H + VB_Y
                    const color = INJURY_COLORS[inj.type] ?? '#6b7280'
                    const label = INJURY_LABELS[inj.type] ?? '?'
                    const isEditing = editingInjury === inj.id
                    const r = compact ? 8 : 12

                    return (
                        <g
                            key={inj.id}
                            onClick={(e) => {
                                e.stopPropagation()
                                onEditInjury(isEditing ? null : inj.id)
                            }}
                            className="cursor-pointer"
                        >
                            {/* White outline */}
                            <circle cx={ix} cy={iy} r={r + 2} fill="white" opacity={0.9} />
                            {/* Colored dot */}
                            <circle cx={ix} cy={iy} r={r} fill={color} />
                            {/* Type label */}
                            <text
                                x={ix}
                                y={iy}
                                textAnchor="middle"
                                dominantBaseline="central"
                                fill="white"
                                style={{ fontSize: compact ? 8 : 11, fontWeight: 700 }}
                                className="pointer-events-none select-none"
                            >
                                {label}
                            </text>
                            {/* Treatment link indicator */}
                            {inj.treatmentLinks.length > 0 && (
                                <circle
                                    cx={ix + r * 0.7}
                                    cy={iy - r * 0.7}
                                    r={compact ? 3 : 5}
                                    fill="#22c55e"
                                    stroke="white"
                                    strokeWidth={1.5}
                                />
                            )}
                            {/* Editing ring */}
                            {isEditing && (
                                <circle
                                    cx={ix} cy={iy} r={r + 5}
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
            <div className="flex justify-around mt-1" style={{ width: w }}>
                <p className="text-[9px] font-semibold text-tertiary/50 uppercase tracking-widest">Posterior</p>
                <p className="text-[9px] font-semibold text-tertiary/50 uppercase tracking-widest">Anterior</p>
            </div>
        </div>
    )
}
