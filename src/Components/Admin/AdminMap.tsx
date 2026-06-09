/**
 * AdminMap.tsx
 *
 * The Admin "Map" tab — a relational node-web over the same users / clusters /
 * locations the Directory lists, drawn as containment instead of three flat
 * lists. One ring at a time: the focused entity sits at the hub, the things it
 * *contains* orbit it, spokes join them. Tapping a child re-centres on it
 * (drill in); tapping the hub opens that entity's detail. The recenter +
 * scale/blur transition is the "2.5D orientation" feel without a 3D camera —
 * touch-reliable, tour-anchorable, no WebGL.
 *
 * Containment + the dashed peer/loan link layer are computed in adminGraph.ts;
 * this file is layout + interaction only.
 */

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { MapPin, Building2, User, Network, ChevronRight, Link2, Link2Off, X } from 'lucide-react'
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

interface AdminMapProps {
    searchQuery?: string
    onClearSearch?: () => void
    onSelectUser: (u: AdminUser) => void
    onSelectClinic: (c: AdminClinic) => void
    onSelectLocation: (l: AdminLocation) => void
}

const TYPE_ICON: Record<GraphNodeType, typeof MapPin> = {
    root: Network,
    location: MapPin,
    clinic: Building2,
    user: User,
}

// Per-type chrome — keeps the legend obvious at a glance (containment anchor).
const TYPE_CHROME: Record<GraphNodeType, string> = {
    root: 'bg-primary/10 border-primary/25 text-primary',
    location: 'bg-themeblue2/15 border-themeblue2/35 text-themeblue2',
    clinic: 'bg-themeblue3/15 border-themeblue3/35 text-themeblue3',
    user: 'bg-tertiary/10 border-tertiary/25 text-tertiary',
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

    // ── Container measurement ────────────────────────────────────────────────
    const containerRef = useRef<HTMLDivElement>(null)
    const [size, setSize] = useState({ w: 0, h: 0 })
    useEffect(() => {
        const el = containerRef.current
        if (!el) return
        const ro = new ResizeObserver(([entry]) => {
            const r = entry.contentRect
            setSize({ w: r.width, h: r.height })
        })
        ro.observe(el)
        return () => ro.disconnect()
    }, [])

    // ── Navigation ───────────────────────────────────────────────────────────
    const openDetail = useCallback((node: GraphNode) => {
        if (node.type === 'user') onSelectUser(node.raw as AdminUser)
        else if (node.type === 'clinic') onSelectClinic(node.raw as AdminClinic)
        else if (node.type === 'location') onSelectLocation(node.raw as AdminLocation)
    }, [onSelectUser, onSelectClinic, onSelectLocation])

    const handleNodeTap = useCallback((node: GraphNode) => {
        // Drillable nodes re-centre; leaves (users, empty clusters) open detail.
        if (node.childCount > 0) setFocusId(node.id)
        else openDetail(node)
    }, [openDetail])

    const goUp = useCallback(() => {
        const parent = ancestry[ancestry.length - 1]
        setFocusId(parent ? parent.id : ROOT_ID)
    }, [ancestry])

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

    // ── Layout math ──────────────────────────────────────────────────────────
    const { w, h } = size
    const cx = w / 2
    const cy = h / 2
    const n = children.length
    const childSize = n <= 8 ? 60 : n <= 14 ? 48 : n <= 22 ? 40 : 34
    const focusSize = 84
    // Ring radius leaves room for both node radii + labels; clamp to stay on-canvas.
    const radius = Math.max(72, Math.min(w, h) / 2 - focusSize / 2 - childSize / 2 - 30)

    const positioned = useMemo(() => children.map((node, i) => {
        const angle = (i / Math.max(n, 1)) * Math.PI * 2 - Math.PI / 2
        return { node, x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) }
    }), [children, n, cx, cy, radius])

    // Dashed link layer among everything on screen (hub + ring).
    const links = useMemo(() => {
        if (!showLinks) return []
        const visible = new Set<string>(children.map(c => c.id))
        if (focusNode) visible.add(focusNode.id)
        const posById = new Map<string, { x: number; y: number }>()
        for (const p of positioned) posById.set(p.node.id, { x: p.x, y: p.y })
        if (focusNode) posById.set(focusNode.id, { x: cx, y: cy })
        return linksAmong(visible, idx)
            .map(l => {
                const a = posById.get(l.fromId)
                const b = posById.get(l.toId)
                return a && b ? { ...l, a, b } : null
            })
            .filter(Boolean) as Array<{ kind: 'association' | 'loan'; a: { x: number; y: number }; b: { x: number; y: number } }>
    }, [showLinks, children, focusNode, positioned, cx, cy, idx])

    // ── Render ────────────────────────────────────────────────────────────────
    if (showLoading) return <div className="p-5"><AdminListSkeleton /></div>

    const isEmpty = !focusNode && children.length === 0
    const FocusIcon = focusNode ? TYPE_ICON[focusNode.type] : Network
    const rootCounts = `${locations.length} locations · ${clinics.length} clusters · ${users.length} users`

    return (
        <div className="relative h-full w-full overflow-hidden">
            {/* Breadcrumb trail */}
            <div className="absolute top-2 left-2 right-2 z-20 flex items-center gap-1 overflow-x-auto rounded-xl bg-themewhite2/90 backdrop-blur-sm px-2 py-1.5 shadow-sm">
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

            {/* Canvas — tap empty space to back out one ring */}
            <div
                ref={containerRef}
                onClick={goUp}
                className="absolute inset-0"
            >
                {isEmpty ? (
                    <div className="flex h-full items-center justify-center p-8">
                        <EmptyState title="Nothing to map yet" />
                    </div>
                ) : (
                    <>
                        {/* Spokes + dashed links */}
                        {w > 0 && (
                        <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
                            <g className="text-themeblue3/25" stroke="currentColor" strokeWidth={1.5}>
                                {positioned.map(p => (
                                    <line key={`spoke-${p.node.id}`} x1={cx} y1={cy} x2={p.x} y2={p.y} />
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
                                />
                            ))}
                        </svg>
                        )}

                        {/* Hub (focused entity) */}
                        {w > 0 && (
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); if (focusNode) openDetail(focusNode) }}
                                style={{ left: cx, top: cy }}
                                className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 active:scale-95"
                            >
                                <div
                                    style={{ width: focusSize, height: focusSize }}
                                    className={`flex flex-col items-center justify-center rounded-full border-2 shadow-md ${focusNode ? TYPE_CHROME[focusNode.type] : TYPE_CHROME.root}`}
                                >
                                    <FocusIcon size={focusSize * 0.32} />
                                    {!focusNode && <span className="mt-0.5 px-2 text-center text-[7pt] leading-tight text-primary/70">{rootCounts}</span>}
                                </div>
                                <span className="max-w-[150px] truncate text-[10pt] font-semibold text-primary">
                                    {focusNode ? focusNode.label : 'Network'}
                                </span>
                                {focusNode && <span className="text-[8pt] text-tertiary">Tap to open</span>}
                            </button>
                        )}

                        {/* Ring (contained entities) */}
                        {w > 0 && positioned.map(p => {
                            const Icon = TYPE_ICON[p.node.type]
                            return (
                                <button
                                    key={p.node.id}
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleNodeTap(p.node) }}
                                    style={{ left: p.x, top: p.y }}
                                    className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 active:scale-95"
                                >
                                    <div
                                        style={{ width: childSize, height: childSize }}
                                        className={`relative flex items-center justify-center rounded-full border shadow-sm ${TYPE_CHROME[p.node.type]}`}
                                    >
                                        <Icon size={childSize * 0.4} />
                                        {p.node.childCount > 0 && (
                                            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-themeblue3 px-1 text-[7pt] font-semibold text-themewhite">
                                                {p.node.childCount}
                                            </span>
                                        )}
                                    </div>
                                    {childSize >= 40 && (
                                        <span className="max-w-[88px] truncate text-[8pt] text-primary/80">{p.node.label}</span>
                                    )}
                                </button>
                            )
                        })}
                    </>
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
