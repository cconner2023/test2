import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { RefreshCw, Trash2, ArrowUpDown, Calendar, Archive, Map, MessageSquare, Loader2 } from 'lucide-react'
import { ActionButton } from '../ActionButton'
import { ActionPill } from '../ActionPill'
import { getStorageStats, type StorageStats } from '../../lib/storageService'
import { clearTileCache, resetAllFailedItems } from '../../lib/offlineDb'
import { useAuth } from '../../Hooks/useAuth'

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface StorageCardProps {
    preview: ReactNode
    icon: ReactNode
    label: string
    tagline: string
    action?: ReactNode
    indicator?: boolean
}

function StorageCard({ preview, icon, label, tagline, action, indicator }: StorageCardProps) {
    return (
        <div className="rounded-2xl border border-themeblue3/10 overflow-hidden">
            <div className="w-full h-16 bg-themewhite3 flex items-center justify-center overflow-hidden">
                {preview}
            </div>
            <div className="flex items-center gap-3 px-4 py-3 bg-themewhite2">
                <div className="w-8 h-8 rounded-full bg-tertiary/10 flex items-center justify-center shrink-0 text-tertiary">
                    {icon}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-primary">{label}</p>
                    <p className="text-[9pt] text-tertiary mt-0.5">{tagline}</p>
                </div>
                {action && (
                    <ActionPill shadow="sm" className="gap-0 shrink-0">
                        {action}
                    </ActionPill>
                )}
                {!action && indicator && (
                    <div className="w-1.5 h-1.5 rounded-full bg-themeblue2 shrink-0" />
                )}
            </div>
        </div>
    )
}

function SpinnerSlot() {
    return (
        <div className="w-9 h-9 flex items-center justify-center">
            <Loader2 size={15} className="text-tertiary animate-spin" />
        </div>
    )
}

export function StoragePanel() {
    const { user } = useAuth()
    const [stats, setStats] = useState<StorageStats | null>(null)
    const [retrying, setRetrying]  = useState(false)
    const [clearing, setClearing]  = useState(false)

    const load = useCallback(async () => {
        const s = await getStorageStats()
        setStats(s)
    }, [])

    useEffect(() => { load() }, [load])

    const handleRetry = async () => {
        if (!user?.id || retrying) return
        setRetrying(true)
        await resetAllFailedItems(user.id)
        await load()
        setRetrying(false)
    }

    const handleClearTiles = async () => {
        if (clearing) return
        setClearing(true)
        await clearTileCache()
        await load()
        setClearing(false)
    }

    const sq       = stats?.syncQueue
    const sqTotal  = (sq?.pending ?? 0) + (sq?.synced ?? 0) + (sq?.failed ?? 0)
    const hasFailed = (sq?.failed ?? 0) > 0
    const hasTiles  = (stats?.map.tileSizeBytes ?? 0) > 0

    return (
        <div className="px-5 py-4 space-y-3">
            {/* Sync Queue */}
            <StorageCard
                preview={
                    !stats ? (
                        <div className="w-3/4 h-2 rounded-full bg-tertiary/10 animate-pulse" />
                    ) : sqTotal === 0 ? (
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-themegreen" />
                            <span className="text-[9pt] font-medium text-themegreen">All synced</span>
                        </div>
                    ) : (
                        <div className="w-3/4 flex h-2 rounded-full overflow-hidden gap-px">
                            {(sq?.pending ?? 0) > 0 && (
                                <div className="h-full bg-themeblue2" style={{ flex: sq!.pending }} />
                            )}
                            {(sq?.synced ?? 0) > 0 && (
                                <div className="h-full bg-themegreen" style={{ flex: sq!.synced }} />
                            )}
                            {(sq?.failed ?? 0) > 0 && (
                                <div className="h-full bg-themeredred" style={{ flex: sq!.failed }} />
                            )}
                        </div>
                    )
                }
                icon={<ArrowUpDown size={15} />}
                label="Sync Queue"
                tagline={
                    !stats
                        ? 'Loading…'
                        : sqTotal === 0
                        ? 'Nothing pending'
                        : `${sq!.pending} pending · ${sq!.failed} failed`
                }
                action={hasFailed ? (
                    retrying ? <SpinnerSlot /> : (
                        <ActionButton icon={RefreshCw} label="Retry failed" onClick={handleRetry} />
                    )
                ) : undefined}
            />

            {/* Calendar */}
            <StorageCard
                preview={
                    <div className="flex items-end gap-1 px-4 w-full pb-3 pt-2">
                        {Array.from({ length: 7 }, (_, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                <div className={`w-1 h-1 rounded-full transition-colors ${[1, 3, 5].includes(i) ? 'bg-themeblue2/60' : 'bg-transparent'}`} />
                                <div className="w-full h-5 rounded-[3px] bg-tertiary/10" />
                            </div>
                        ))}
                    </div>
                }
                icon={<Calendar size={15} />}
                label="Calendar"
                tagline={
                    !stats
                        ? 'Loading…'
                        : `${stats.calendar.events} events · ${stats.calendar.pendingVaultSends} pending`
                }
                indicator={(stats?.calendar.pendingVaultSends ?? 0) > 0}
            />

            {/* Property */}
            <StorageCard
                preview={
                    <div className="flex-1 px-6 space-y-2 w-full">
                        {([56, 40, 48] as number[]).map((w, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-[3px] border border-tertiary/20 bg-tertiary/5 shrink-0" />
                                <div className="h-1.5 rounded-full bg-tertiary/15" style={{ width: w }} />
                            </div>
                        ))}
                    </div>
                }
                icon={<Archive size={15} />}
                label="Property"
                tagline={
                    !stats
                        ? 'Loading…'
                        : `${stats.property.items} items · ${stats.property.locations} locations`
                }
                indicator={(stats?.property.discrepancies ?? 0) > 0}
            />

            {/* Map Cache */}
            <StorageCard
                preview={
                    <div className="grid grid-cols-5 gap-1 px-4">
                        {Array.from({ length: 10 }, (_, i) => (
                            <div
                                key={i}
                                className={`h-5 rounded-[3px] transition-colors ${
                                    hasTiles && [2, 3, 7, 8].includes(i)
                                        ? 'bg-themeblue2/25 border border-themeblue2/30'
                                        : 'bg-tertiary/10'
                                }`}
                            />
                        ))}
                    </div>
                }
                icon={<Map size={15} />}
                label="Map Cache"
                tagline={
                    !stats
                        ? 'Loading…'
                        : hasTiles
                        ? `${stats.map.overlays} overlays · ${formatBytes(stats.map.tileSizeBytes)} cached`
                        : `${stats.map.overlays} overlays · No tiles cached`
                }
                action={hasTiles ? (
                    clearing ? <SpinnerSlot /> : (
                        <ActionButton icon={Trash2} label="Clear tile cache" onClick={handleClearTiles} variant="danger" />
                    )
                ) : undefined}
            />

            {/* Messages */}
            <StorageCard
                preview={
                    <div className="flex flex-col gap-1.5 px-6 w-full">
                        <div className="flex justify-start">
                            <div className="h-4 w-24 rounded-full rounded-bl-sm bg-tertiary/15" />
                        </div>
                        <div className="flex justify-end">
                            <div className="h-4 w-20 rounded-full rounded-br-sm bg-themeblue2/20" />
                        </div>
                    </div>
                }
                icon={<MessageSquare size={15} />}
                label="Messages"
                tagline={
                    !stats
                        ? 'Loading…'
                        : `${stats.messages.messages} stored · ${stats.messages.outboundPending} outbound`
                }
                indicator={(stats?.messages.outboundPending ?? 0) > 0}
            />
        </div>
    )
}
