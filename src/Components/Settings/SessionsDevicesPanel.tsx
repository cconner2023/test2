/**
 * SessionsDevicesPanel — view and manage registered devices.
 *
 * Shows all devices registered to the current user, highlights the
 * current device, and allows removing individual devices (swipe left)
 * or signing out all other sessions (primary device only).
 */

import { useState, useEffect, useCallback } from 'react'
import { Crown, Trash2, Smartphone, LogOut, Info, Loader2, Check } from 'lucide-react'
import { useAuth } from '../../Hooks/useAuth'
import { useAuthStore } from '../../stores/useAuthStore'
import { getLocalDeviceId } from '../../lib/signal/keyManager'
import { unregisterDevice, deleteKeyBundle, primaryLogoutAll } from '../../lib/signal/signalService'
import { fetchOwnDevicesWithRole, type DeviceWithRole } from '../../lib/signal/deviceService'
import { CardContextMenu } from '../CardContextMenu'
import { CardActionBar } from '../CardActionBar'
import { SwipeableCard } from '../SwipeableCard'
import { StatusBanner } from './StatusBanner'
import { UI_TIMING } from '../../Utilities/constants'

export function SessionsDevicesPanel() {
  const { user } = useAuth()
  const deviceRole = useAuthStore((s) => s.deviceRole)

  const [devices, setDevices] = useState<DeviceWithRole[]>([])
  const [localDeviceId, setLocalDeviceId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [confirmLogoutAll, setConfirmLogoutAll] = useState(false)
  const [openSwipeId, setOpenSwipeId] = useState<string | null>(null)
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<Set<string>>(new Set())
  const [contextMenu, setContextMenu] = useState<{ deviceId: string; x: number; y: number } | null>(null)
  const multiSelectMode = selectedDeviceIds.size > 0

  // Clear status banner after a delay
  useEffect(() => {
    if (!status) return
    const t = setTimeout(() => setStatus(null), UI_TIMING.FEEDBACK_DURATION)
    return () => clearTimeout(t)
  }, [status])

  // Load devices on mount
  const loadDevices = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    setError(null)

    const [deviceIdResult, devicesResult] = await Promise.all([
      getLocalDeviceId(),
      fetchOwnDevicesWithRole(user.id),
    ])

    setLocalDeviceId(deviceIdResult)

    if (!devicesResult.ok) {
      setError(devicesResult.error)
      setLoading(false)
      return
    }

    // Sort: current device first, then primary, then by recency
    const sorted = [...devicesResult.data].sort((a, b) => {
      const aIsCurrent = a.deviceId === deviceIdResult
      const bIsCurrent = b.deviceId === deviceIdResult
      if (aIsCurrent !== bIsCurrent) return aIsCurrent ? -1 : 1
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1
      return new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime()
    })

    setDevices(sorted)
    setLoading(false)
  }, [user?.id])

  useEffect(() => { loadDevices() }, [loadDevices])

  // Remove a single device
  const handleRemove = useCallback(async (deviceId: string) => {
    if (!user?.id) return
    setOpenSwipeId(null)

    const [unreg, delKey] = await Promise.all([
      unregisterDevice(user.id, deviceId),
      deleteKeyBundle(user.id, deviceId),
    ])

    if (!unreg.ok) {
      setStatus({ type: 'error', message: unreg.error })
      return
    }
    if (!delKey.ok) {
      setStatus({ type: 'error', message: delKey.error })
      return
    }

    setStatus({ type: 'success', message: 'Device removed' })
    setDevices((prev) => prev.filter((d) => d.deviceId !== deviceId))
  }, [user?.id])

  // Sign out all other sessions
  const handleLogoutAll = useCallback(async () => {
    setConfirmLogoutAll(false)

    const result = await primaryLogoutAll()
    if (!result.ok) {
      setStatus({ type: 'error', message: result.error })
      return
    }

    setStatus({ type: 'success', message: `Signed out ${result.data.devicesDeleted} device(s)` })
    loadDevices()
  }, [loadDevices])

  // Activity dot color + label
  const activityInfo = (lastActiveAt: string) => {
    const diffMs = Date.now() - new Date(lastActiveAt).getTime()
    const hours = diffMs / (1000 * 60 * 60)
    const days = hours / 24

    if (hours < 24) return { color: 'bg-themegreen', label: formatRelative(diffMs) }
    if (days < 7) return { color: 'bg-themeyellow', label: formatRelative(diffMs) }
    return { color: 'bg-tertiary/30', label: formatRelative(diffMs) }
  }

  const isPrimary = deviceRole === 'primary'
  const otherDevicesExist = devices.some((d) => d.deviceId !== localDeviceId)

  // --- Loading state ---
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 size={24} className="text-tertiary animate-spin" />
      </div>
    )
  }

  // --- Error state ---
  if (error) {
    return (
      <div className="px-5 py-4">
        <StatusBanner type="error" message={error} />
      </div>
    )
  }

  // --- Empty state ---
  if (devices.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 text-tertiary px-6">
        <Smartphone size={32} className="text-tertiary/50" />
        <p className="text-sm text-center">No devices registered</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-5 py-4 space-y-3">

        <p className="text-xs text-tertiary leading-relaxed">
          Devices registered to your account. Tap or swipe left on a device to remove it.
        </p>

        {status && <StatusBanner type={status.type} message={status.message} />}

        {/* Device list */}
        {devices.map((device) => {
          const isCurrent = device.deviceId === localDeviceId
          const activity = activityInfo(device.lastActiveAt)
          const shortId = device.deviceId.slice(0, 8)
          const canSwipe = !isCurrent
          const isDeviceSelected = selectedDeviceIds.has(device.deviceId)

          return (
            <SwipeableCard
              key={device.deviceId}
              isOpen={openSwipeId === device.deviceId}
              enabled={canSwipe && !multiSelectMode}
              actions={canSwipe ? [
                { key: 'remove', label: 'Remove', icon: Trash2, iconBg: 'bg-themeredred/15', iconColor: 'text-themeredred', onAction: () => handleRemove(device.deviceId) },
              ] : []}
              onOpen={() => { setOpenSwipeId(device.deviceId) }}
              onClose={() => { if (openSwipeId === device.deviceId) setOpenSwipeId(null) }}
              onContextMenu={canSwipe ? (e) => { e.preventDefault(); setContextMenu({ deviceId: device.deviceId, x: e.clientX, y: e.clientY }) } : undefined}
              onTap={canSwipe ? () => {
                if (multiSelectMode) {
                  setSelectedDeviceIds(prev => {
                    const next = new Set(prev)
                    if (next.has(device.deviceId)) next.delete(device.deviceId)
                    else next.add(device.deviceId)
                    return next
                  })
                  return
                }
                setOpenSwipeId(null)
                // Single-tap selects (shows bottom bar)
                const isTogglingOff = selectedDeviceIds.has(device.deviceId)
                setSelectedDeviceIds(isTogglingOff ? new Set() : new Set([device.deviceId]))
              } : undefined}
            >
              <div
                className={`rounded-xl border px-4 py-3.5 transition-colors ${
                  isCurrent
                    ? 'border-themeblue2/25 bg-themeblue2/10'
                    : isDeviceSelected
                      ? 'border-themeblue2/30 bg-themeblue2/5'
                      : 'border-tertiary/15 bg-themewhite2'
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Icon — show checkmark when selected in multi-select */}
                  {isDeviceSelected ? (
                    <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-themeblue2">
                      <Check size={16} className="text-white" />
                    </div>
                  ) : (
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                      isCurrent ? 'bg-themeblue2/15' : device.isPrimary ? 'bg-themeyellow/15' : 'bg-tertiary/10'
                    }`}>
                      {device.isPrimary ? (
                        <Crown size={18} className={isCurrent ? 'text-themeblue2' : 'text-themeyellow'} />
                      ) : (
                        <Smartphone size={18} className={isCurrent ? 'text-themeblue2' : 'text-tertiary/50'} />
                      )}
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-primary">
                        {device.deviceLabel || 'Unknown'}
                      </span>
                      {isCurrent && (
                        <span className="text-[9pt] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-themeblue2/15 text-themeblue2">
                          This device
                        </span>
                      )}
                      {device.isPrimary && (
                        <span className="text-[9pt] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-themeyellow/15 text-themeyellow">
                          Primary
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`inline-block w-1.5 h-1.5 rounded-full ${activity.color}`} />
                      <span className="text-[11px] text-tertiary/70">{activity.label}</span>
                      <span className="text-[11px] text-tertiary/30">&middot;</span>
                      <span className="text-[11px] text-tertiary/30 font-mono">{shortId}</span>
                    </div>
                  </div>
                </div>
              </div>
            </SwipeableCard>
          )
        })}

        {/* Sign Out All Other Sessions (primary only) */}
        {isPrimary && otherDevicesExist && (
          <div className="pt-2">
            {confirmLogoutAll ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleLogoutAll}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-themeredred/10 text-themeredred text-sm font-medium active:scale-[0.98] transition-all"
                >
                  <LogOut size={16} />
                  Confirm Sign Out All
                </button>
                <button
                  onClick={() => setConfirmLogoutAll(false)}
                  className="px-4 py-2.5 rounded-xl border border-tertiary/15 bg-themewhite2 text-tertiary text-sm font-medium active:scale-[0.98] transition-all"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmLogoutAll(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-themeredred/10 text-themeredred text-sm font-medium active:scale-[0.98] transition-all"
              >
                <LogOut size={16} />
                Sign Out All Other Sessions
              </button>
            )}
          </div>
        )}

        {/* Info note for non-primary devices */}
        {!isPrimary && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-tertiary/5">
            <Info size={14} className="text-tertiary/60 shrink-0 mt-0.5" />
            <p className="text-[11px] text-tertiary/70 leading-relaxed">
              Only the primary device can sign out all other sessions. Tap or swipe left on
              individual devices to remove them.
            </p>
          </div>
        )}
      </div>

      {/* Bottom action bar for multi-select */}
      {multiSelectMode && (
        <CardActionBar
          selectedCount={selectedDeviceIds.size}
          onClear={() => setSelectedDeviceIds(new Set())}
          actions={[
            {
              key: 'delete',
              label: 'Delete',
              icon: Trash2,
              iconBg: 'bg-themeredred/15',
              iconColor: 'text-themeredred',
              onAction: async () => {
                const ids = [...selectedDeviceIds]
                setSelectedDeviceIds(new Set())
                for (const id of ids) await handleRemove(id)
              },
            },
          ]}
        />
      )}

      {/* Right-click context menu */}
      {contextMenu && (
        <CardContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            {
              key: 'delete',
              label: 'Delete',
              icon: Trash2,
              destructive: true,
              onAction: () => handleRemove(contextMenu.deviceId),
            },
          ]}
        />
      )}
    </div>
  )
}

/** Format a millisecond duration into a human-readable relative string. */
function formatRelative(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}
