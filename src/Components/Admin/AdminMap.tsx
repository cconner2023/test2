/**
 * AdminMap.tsx
 *
 * The Admin "Map" tab — a relational node-web over the same users / clusters /
 * locations the Directory lists, drawn as geographic containment instead of
 * three flat lists. Instead of one giant ring of ~100 locations, the top tier
 * groups by country → region(state) → location → cluster → user, so every
 * level is a readable handful of nodes.
 *
 * Each level renders as an organic force-relaxed web (Obsidian-style) on a
 * single pan/zoom canvas: the focused entity sits at the hub, the things it
 * *contains* float around it, spokes join them. Tapping a child re-centres on
 * it (drill in); tapping the hub opens that entity's detail; the Back control
 * (or a tap on empty space) backs out one ring. Pinch / wheel zooms, drag pans
 * — the scale gives the "2.5D" depth feel without a 3D camera or WebGL
 * (iOS-Safari PWA constraint).
 *
 * Containment + the dashed peer/loan link layer are computed in adminGraph.ts;
 * the force layout in forceLayout.ts; this file is layout-fit + interaction.
 */

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { MapPin, Building2, User, Network, ChevronRight, ChevronLeft, Link2, Link2Off, X, Globe, Map as MapIcon } from 'lucide-react'
import { AdminListSkeleton } from './AdminSkeletons'
import { EmptyState } from '../EmptyState'
import { useMinLoadTime } from '../../Hooks/useMinLoadTime'
import { useInvalidation } from '../../stores/useInvalidationStore'
import { listAllUsers, listClinics, listLocations } from '../../lib/adminService'
import type { AdminUser, AdminClinic, AdminLocation } from '../../lib/adminService'
import {
    buildGraphIndex,
    childrenOf,
    nodeFor,
    ancestryOf,
    linksAmong,
    ROOT_ID,
    type GraphNode,
    type GraphNodeType,
} from './adminGraph'
import { relaxRing, boundsOf } from './forceLayout'

interface AdminMapProps {
    searchQuery?: string
    onClearSearch?: () => void
    onSelectUser: (u: AdminUser) => void
    onSelectClinic: (c: AdminClinic) => void
    onSelectLocation: (l: AdminLocation) => void
}

const TYPE_ICON: Record<GraphNodeType, typeof MapPin> = {
    root: Network,
    country: Globe,
    region: MapIcon,
    location: MapPin,
    clinic: Building2,
    user: User,
}

// Per-type chrome — keeps the legend obvious at a glance (containment anchor).
const TYPE_CHROME: Record<GraphNodeType, string> = {
    root: 'bg-primary/10 border-primary/25 text-primary',
    country: 'bg-primary/10 border-primary/30 text-primary',
    region: 'bg-themeblue2/10 border-themeblue2/30 text-themeblue2',
    location: 'bg-themeblue2/15 border-themeblue2/35 text-themeblue2',
    clinic: 'bg-themeblue3/15 border-themeblue3/35 text-themeblue3',
    user: 'bg-tertiary/10 border-tertiary/25 text-tertiary',
}

// Virtual-space node diameters (px before zoom). Geography tiers read as bigger
// "bubbles"; leaves are smaller. The pan/zoom transform handles visual scale.
const NODE_SIZE: Record<GraphNodeType, number> = {
    root: 96, country: 84, region: 78, location: 66, clinic: 60, user: 52,
}
const HUB_SIZE = 96

const MIN_SCALE = 0.1
const MAX_SCALE = 4
const TAP_SLOP = 6 // px of movement under which a pointer-up counts as a tap

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
    return Math.hypot(a.x - b.x, a.y - b.y)
}

export function AdminMap({ searchQuery, onClearSearch, onSelectUser, onSelectClinic, onSelectLocation }: AdminMapProps) {
    const gen = useInvalidation('users', 'clinics', 'locations')
    const [users, setUsers] = useState<AdminUser[]>([])
    const [clinics, setClinics] = useState<AdminClinic[]>([])
    const [locations, setLocations] = useState<AdminLocation[]>([])
    const [loading, setLoading] = useState(true)
    const showLoading = useMinLoadTime(loading)

    const [focusId, setFocusId] = useState<string | null>(ROOT_ID)
    const [showLinks, setShowLinks] = useState(false)

    // ── Data ────────────────────────────────────────────────────────────────
    useEffect(() => {
        let alive = true
        setLoading(true)
        Promise.all([listAllUsers(), listClinics(), listLocations()]).then(([u, c, l]) => {
            if (!alive) return
            setUsers(u); setClinics(c); setLocations(l); setLoading(false)
        })
        return () => { alive = false }
    }, [gen])

    const idx = useMemo(() => buildGraphIndex(users, clinics, locations), [users, clinics, locations])

    // Focus may point at a row that vanished after an invalidation — fall back to root.
    const focusNode = useMemo(() => nodeFor(focusId, idx), [focusId, idx])
    useEffect(() => {
        if (focusId && focusId !== ROOT_ID && !nodeFor(focusId, idx)) setFocusId(ROOT_ID)
    }, [focusId, idx])

    const children = useMemo(() => childrenOf(focusId, idx), [focusId, idx])
    const ancestry = useMemo(() => ancestryOf(focusId, idx), [focusId, idx])

    // Back out one ring (declared early — the pointer handlers below close over it).
    const goUp = useCallback(() => {
        const parent = ancestry[ancestry.length - 1]
        setFocusId(parent ? parent.id : ROOT_ID)
    }, [ancestry])

    // ── Force layout (virtual space, hub at origin) ───────────────────────────
    const positioned = useMemo(() => {
        const pts = relaxRing(children.length)
        return children.map((node, i) => ({ node, x: pts[i].x, y: pts[i].y }))
    }, [children])

    // ── Container measurement ────────────────────────────────────────────────
    // Callback ref, NOT a mount effect: the canvas only enters the tree once the
    // loading skeleton clears (the `showLoading` early-return below). A `[]`-deps
    // effect would run while the ref is still null and never re-subscribe.
    const roRef = useRef<ResizeObserver | null>(null)
    const outerRef = useRef<HTMLDivElement | null>(null)
    const wheelRef = useRef<((e: WheelEvent) => void) | null>(null)
    // zoomAt is defined below; the native wheel listener calls it via this ref so
    // we can register wheel as non-passive (React's onWheel is passive → can't
    // preventDefault the page from scrolling under a desktop zoom).
    const zoomAtRef = useRef<(x: number, y: number, f: number) => void>(() => {})
    const [size, setSize] = useState({ w: 0, h: 0 })
    const measureRef = useCallback((el: HTMLDivElement | null) => {
        roRef.current?.disconnect()
        if (wheelRef.current && outerRef.current) outerRef.current.removeEventListener('wheel', wheelRef.current)
        outerRef.current = el
        if (!el) { roRef.current = null; return }
        const r = el.getBoundingClientRect()
        setSize({ w: r.width, h: r.height })
        const ro = new ResizeObserver(([entry]) => {
            const cr = entry.contentRect
            setSize({ w: cr.width, h: cr.height })
        })
        ro.observe(el)
        roRef.current = ro
        const onWheelNative = (e: WheelEvent) => {
            e.preventDefault()
            zoomAtRef.current(e.clientX, e.clientY, e.deltaY < 0 ? 1.12 : 1 / 1.12)
        }
        el.addEventListener('wheel', onWheelNative, { passive: false })
        wheelRef.current = onWheelNative
    }, [])

    // ── Pan / zoom view transform ─────────────────────────────────────────────
    // Inner plane is anchored at the canvas centre (left/top 50%, origin 0 0).
    // A world point (wx,wy) renders at  centre + (tx + s·wx, ty + s·wy).
    const [view, setView] = useState({ s: 1, tx: 0, ty: 0 })
    const [animate, setAnimate] = useState(false)

    // Fit the current ring to the canvas whenever the focus or size changes.
    const fit = useMemo(() => {
        const { w, h } = size
        if (!w || !h) return { s: 1, tx: 0, ty: 0 }
        const b = boundsOf(positioned.map(p => ({ x: p.x, y: p.y })))
        const pad = 90 // room for the biggest bubble + its label
        const contentW = (b.maxX - b.minX) + NODE_SIZE.country + pad
        const contentH = (b.maxY - b.minY) + NODE_SIZE.country + pad
        const s = Math.min(1.3, Math.max(MIN_SCALE, Math.min((w - 32) / contentW, (h - 32) / contentH)))
        const cx = (b.minX + b.maxX) / 2
        const cy = (b.minY + b.maxY) / 2
        return { s, tx: -s * cx, ty: -s * cy }
    }, [positioned, size])

    useEffect(() => {
        setAnimate(true)
        setView(fit)
    }, [fit])

    // ── Pointer gestures (pan + pinch); wheel zoom ────────────────────────────
    const pointers = useRef(new Map<number, { x: number; y: number }>())
    const moved = useRef(false)
    const pinchDist = useRef(0)

    const zoomAt = useCallback((clientX: number, clientY: number, factor: number) => {
        const el = outerRef.current
        if (!el) return
        const rect = el.getBoundingClientRect()
        const px = clientX - rect.left - rect.width / 2
        const py = clientY - rect.top - rect.height / 2
        setAnimate(false)
        setView(v => {
            const ns = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.s * factor))
            const wx = (px - v.tx) / v.s
            const wy = (py - v.ty) / v.s
            return { s: ns, tx: px - wx * ns, ty: py - wy * ns }
        })
    }, [])
    zoomAtRef.current = zoomAt

    const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        outerRef.current?.setPointerCapture(e.pointerId)
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
        moved.current = false
        if (pointers.current.size === 2) {
            const [a, b] = [...pointers.current.values()]
            pinchDist.current = dist(a, b)
        }
    }, [])

    const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        const prev = pointers.current.get(e.pointerId)
        if (!prev) return
        const cur = { x: e.clientX, y: e.clientY }
        pointers.current.set(e.pointerId, cur)

        if (pointers.current.size >= 2) {
            const [a, b] = [...pointers.current.values()]
            const d = dist(a, b)
            if (pinchDist.current > 0) {
                zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / pinchDist.current)
            }
            pinchDist.current = d
            moved.current = true
            return
        }
        const dx = cur.x - prev.x
        const dy = cur.y - prev.y
        if (Math.abs(dx) > TAP_SLOP || Math.abs(dy) > TAP_SLOP) moved.current = true
        setAnimate(false)
        setView(v => ({ ...v, tx: v.tx + dx, ty: v.ty + dy }))
    }, [zoomAt])

    const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        const wasSingle = pointers.current.size === 1
        pointers.current.delete(e.pointerId)
        if (pointers.current.size < 2) pinchDist.current = 0
        // A clean tap on empty canvas backs out one ring.
        if (wasSingle && !moved.current) goUp()
    }, [goUp])

    // ── Navigation ───────────────────────────────────────────────────────────
    const openDetail = useCallback((node: GraphNode) => {
        if (node.type === 'user') onSelectUser(node.raw as AdminUser)
        else if (node.type === 'clinic') onSelectClinic(node.raw as AdminClinic)
        else if (node.type === 'location') onSelectLocation(node.raw as AdminLocation)
        // country / region are synthetic — no detail row to open.
    }, [onSelectUser, onSelectClinic, onSelectLocation])

    const handleNodeTap = useCallback((node: GraphNode) => {
        // Drillable nodes re-centre; leaves (users, empty groups) open detail.
        if (node.childCount > 0) setFocusId(node.id)
        else openDetail(node)
    }, [openDetail])

    // ── Search → jump list ───────────────────────────────────────────────────
    const searchMatches = useMemo<GraphNode[]>(() => {
        const q = searchQuery?.trim().toLowerCase()
        if (!q) return []
        const out: GraphNode[] = []
        for (const l of locations) {
            if (l.display_name.toLowerCase().includes(q) || l.installation.toLowerCase().includes(q))
                out.push(nodeFor(l.id, idx)!)
        }
        for (const c of clinics) {
            if (c.name.toLowerCase().includes(q) || c.uics.some(u => u.toLowerCase().includes(q)) || c.location?.toLowerCase().includes(q))
                out.push(nodeFor(c.id, idx)!)
        }
        for (const u of users) {
            const name = [u.first_name, u.last_name].filter(Boolean).join(' ').toLowerCase()
            if (name.includes(q) || u.email?.toLowerCase().includes(q) || u.uic?.toLowerCase().includes(q))
                out.push(nodeFor(u.id, idx)!)
        }
        return out.filter(Boolean).slice(0, 40)
    }, [searchQuery, locations, clinics, users, idx])

    const jumpTo = useCallback((node: GraphNode) => {
        // Drill *into* containers; centre a user on its home cluster so siblings show.
        if (node.childCount > 0) setFocusId(node.id)
        else if (node.type === 'user') {
            const home = (node.raw as AdminUser).clinic_id
            setFocusId(home && idx.clinicById.has(home) ? home : ROOT_ID)
        } else setFocusId(node.id)
        onClearSearch?.()
    }, [idx, onClearSearch])

    // ── Link layer among on-screen nodes ──────────────────────────────────────
    const posById = useMemo(() => {
        const m = new Map<string, { x: number; y: number }>()
        for (const p of positioned) m.set(p.node.id, { x: p.x, y: p.y })
        if (focusNode) m.set(focusNode.id, { x: 0, y: 0 })
        return m
    }, [positioned, focusNode])

    const links = useMemo(() => {
        if (!showLinks) return []
        const visible = new Set<string>(children.map(c => c.id))
        if (focusNode) visible.add(focusNode.id)
        return linksAmong(visible, idx)
            .map(l => {
                const a = posById.get(l.fromId)
                const b = posById.get(l.toId)
                return a && b ? { ...l, a, b } : null
            })
            .filter(Boolean) as Array<{ kind: 'association' | 'loan'; a: { x: number; y: number }; b: { x: number; y: number } }>
    }, [showLinks, children, focusNode, posById, idx])

    // ── Render ────────────────────────────────────────────────────────────────
    if (showLoading) return <div className="p-5"><AdminListSkeleton /></div>

    const isEmpty = !focusNode && children.length === 0
    const FocusIcon = focusNode ? TYPE_ICON[focusNode.type] : Network
    const rootCounts = `${locations.length} locations · ${clinics.length} clusters · ${users.length} users`
    const innerTransform = `translate(${view.tx}px, ${view.ty}px) scale(${view.s})`
    const labelVisible = (d: number) => view.s * d >= 30

    return (
        <div className="relative h-full w-full overflow-hidden">
            {/* Breadcrumb trail + Back */}
            <div className="absolute top-2 left-2 right-2 z-20 flex items-center gap-1 overflow-x-auto rounded-xl bg-themewhite2/90 backdrop-blur-sm px-2 py-1.5 shadow-sm">
                {focusId !== ROOT_ID && (
                    <button
                        type="button"
                        onClick={goUp}
                        aria-label="Back one level"
                        className="shrink-0 -ml-0.5 mr-0.5 flex items-center text-tertiary hover:text-primary active:scale-90"
                    >
                        <ChevronLeft size={16} />
                    </button>
                )}
                <button
                    type="button"
                    onClick={() => setFocusId(ROOT_ID)}
                    className={`shrink-0 text-[9pt] active:scale-95 ${focusId === ROOT_ID ? 'font-semibold text-primary' : 'text-tertiary hover:text-primary'}`}
                >
                    Network
                </button>
                {ancestry.map(a => (
                    <span key={a.id} className="flex shrink-0 items-center gap-1">
                        <ChevronRight size={11} className="text-tertiary/50" />
                        <button
                            type="button"
                            onClick={() => setFocusId(a.id)}
                            className="text-[9pt] text-tertiary hover:text-primary active:scale-95 max-w-[120px] truncate"
                        >
                            {a.label}
                        </button>
                    </span>
                ))}
                {focusNode && (
                    <span className="flex shrink-0 items-center gap-1">
                        <ChevronRight size={11} className="text-tertiary/50" />
                        <span className="text-[9pt] font-semibold text-primary max-w-[140px] truncate">{focusNode.label}</span>
                    </span>
                )}
            </div>

            {/* Link-layer toggle */}
            <button
                type="button"
                onClick={() => setShowLinks(v => !v)}
                aria-label={showLinks ? 'Hide associations' : 'Show associations'}
                className={`absolute bottom-3 left-3 z-20 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[9pt] shadow-sm active:scale-95 ${
                    showLinks ? 'bg-themeblue3 text-themewhite' : 'bg-themewhite2/90 backdrop-blur-sm text-tertiary'
                }`}
            >
                {showLinks ? <Link2 size={13} /> : <Link2Off size={13} />}
                Links
            </button>

            {/* Canvas — drag to pan, pinch/scroll to zoom, tap empty space to back out */}
            <div
                ref={measureRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                className="absolute inset-0 touch-none cursor-grab active:cursor-grabbing"
            >
                {isEmpty ? (
                    <div className="flex h-full items-center justify-center p-8">
                        <EmptyState title="Nothing to map yet" />
                    </div>
                ) : size.w > 0 && (
                    <div
                        className="absolute left-1/2 top-1/2"
                        style={{
                            transform: innerTransform,
                            transformOrigin: '0 0',
                            transition: animate ? 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1)' : 'none',
                        }}
                    >
                        {/* Spokes + dashed links (vector-effect keeps strokes crisp under zoom) */}
                        <svg className="pointer-events-none absolute overflow-visible" style={{ left: 0, top: 0, width: 1, height: 1 }} aria-hidden>
                            <g className="text-themeblue3/25" stroke="currentColor" strokeWidth={1.5} vectorEffect="non-scaling-stroke">
                                {positioned.map(p => (
                                    <line key={`spoke-${p.node.id}`} x1={0} y1={0} x2={p.x} y2={p.y} vectorEffect="non-scaling-stroke" />
                                ))}
                            </g>
                            {links.map((l, i) => (
                                <line
                                    key={`link-${i}`}
                                    x1={l.a.x} y1={l.a.y} x2={l.b.x} y2={l.b.y}
                                    stroke={l.kind === 'loan' ? 'var(--color-themered, #c0392b)' : 'var(--color-themeblue2, #2d6cdf)'}
                                    strokeWidth={1.5}
                                    strokeDasharray="4 4"
                                    opacity={0.7}
                                    vectorEffect="non-scaling-stroke"
                                />
                            ))}
                        </svg>

                        {/* Hub (focused entity) at the origin */}
                        <button
                            type="button"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => { e.stopPropagation(); if (focusNode) openDetail(focusNode) }}
                            style={{ left: 0, top: 0 }}
                            className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 active:scale-95"
                        >
                            <div
                                style={{ width: HUB_SIZE, height: HUB_SIZE }}
                                className={`flex flex-col items-center justify-center rounded-full border-2 shadow-md ${focusNode ? TYPE_CHROME[focusNode.type] : TYPE_CHROME.root}`}
                            >
                                <FocusIcon size={HUB_SIZE * 0.3} />
                                {!focusNode && <span className="mt-0.5 px-2 text-center text-[7pt] leading-tight text-primary/70">{rootCounts}</span>}
                            </div>
                            <span className="max-w-[150px] truncate text-[10pt] font-semibold text-primary">
                                {focusNode ? focusNode.label : 'Network'}
                            </span>
                            {focusNode && focusNode.type !== 'country' && focusNode.type !== 'region' && (
                                <span className="text-[8pt] text-tertiary">Tap to open</span>
                            )}
                        </button>

                        {/* Ring (contained entities) */}
                        {positioned.map(p => {
                            const Icon = TYPE_ICON[p.node.type]
                            const nodeSize = NODE_SIZE[p.node.type]
                            return (
                                <button
                                    key={p.node.id}
                                    type="button"
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onClick={(e) => { e.stopPropagation(); handleNodeTap(p.node) }}
                                    style={{ left: p.x, top: p.y }}
                                    className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 active:scale-95"
                                >
                                    <div
                                        style={{ width: nodeSize, height: nodeSize }}
                                        className={`relative flex items-center justify-center rounded-full border shadow-sm ${TYPE_CHROME[p.node.type]}`}
                                    >
                                        <Icon size={nodeSize * 0.4} />
                                        {p.node.childCount > 0 && (
                                            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-themeblue3 px-1 text-[7pt] font-semibold text-themewhite">
                                                {p.node.childCount}
                                            </span>
                                        )}
                                    </div>
                                    {labelVisible(nodeSize) && (
                                        <span className="max-w-[96px] truncate text-[8pt] text-primary/80">{p.node.label}</span>
                                    )}
                                </button>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Search → jump-to list (overlays the canvas) */}
            {searchQuery?.trim() && (
                <div className="absolute inset-x-2 top-12 bottom-2 z-30 overflow-y-auto rounded-2xl border border-themeblue3/10 bg-themewhite2 shadow-lg">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-themeblue3/10">
                        <span className="text-[9pt] font-semibold uppercase tracking-widest text-tertiary">
                            {searchMatches.length} match{searchMatches.length !== 1 ? 'es' : ''}
                        </span>
                        {onClearSearch && (
                            <button type="button" onClick={onClearSearch} aria-label="Clear search" className="text-tertiary active:scale-95">
                                <X size={15} />
                            </button>
                        )}
                    </div>
                    {searchMatches.length === 0 ? (
                        <div className="p-5"><EmptyState title="No matches" /></div>
                    ) : (
                        <div className="divide-y divide-themeblue3/10">
                            {searchMatches.map(m => {
                                const Icon = TYPE_ICON[m.type]
                                return (
                                    <button
                                        key={`${m.type}-${m.id}`}
                                        type="button"
                                        onClick={() => jumpTo(m)}
                                        className="flex w-full items-center gap-3 px-4 py-3 text-left active:scale-[0.99] hover:bg-themeblue2/5"
                                    >
                                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${TYPE_CHROME[m.type]}`}>
                                            <Icon size={15} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium text-primary">{m.label}</p>
                                            {m.sublabel && <p className="truncate text-[9pt] text-tertiary">{m.sublabel}</p>}
                                        </div>
                                        <ChevronRight size={15} className="shrink-0 text-tertiary" />
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
