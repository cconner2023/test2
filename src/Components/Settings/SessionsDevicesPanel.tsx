/**
 * SessionsDevicesPanel — view and manage registered devices.
 *
 * Shows all devices registered to the current user, highlights the
 * current device, and allows removing individual devices (swipe left)
 * or signing out all other sessions (primary device only).
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { Crown, Trash2, Smartphone, LogOut, Info, Loader2 } from 'lucide-react'
import { useAuth } from '../../Hooks/useAuth'
import { useAuthStore } from '../../stores/useAuthStore'
import { getLocalDeviceId } from '../../lib/signal/keyManager'
import { unregisterDevice, deleteKeyBundle, primaryLogoutAll } from '../../lib/signal/signalService'
import { fetchOwnDevicesWithRole, type DeviceWithRole } from '../../lib/signal/deviceService'
import { StatusBanner } from './StatusBanner'
import { UI_TIMING } from '../../Utilities/constants'
import { GESTURE_THRESHOLDS } from '../../Utilities/GestureUtils'

const ACTION_WIDTH = 72
const OPEN_THRESHOLD = ACTION_WIDTH * 0.3

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
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

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

          const menuOpen = openMenuId === device.deviceId

          return (
            <SwipeableDeviceCard
              key={device.deviceId}
              isOpen={openSwipeId === device.deviceId}
              swipeEnabled={canSwipe}
              onOpen={() => { setOpenMenuId(null); setOpenSwipeId(device.deviceId) }}
              onClose={() => { if (openSwipeId === device.deviceId) setOpenSwipeId(null) }}
              onDelete={() => handleRemove(device.deviceId)}
              onTap={canSwipe ? () => {
                setOpenSwipeId(null)
                setOpenMenuId(menuOpen ? null : device.deviceId)
              } : undefined}
            >
              <div
                className={`rounded-xl border px-4 py-3.5 transition-colors ${
                  isCurrent
                    ? 'border-themeblue2/25 bg-themeblue2/10'
                    : 'border-tertiary/15 bg-themewhite2'
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Icon */}
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                    isCurrent ? 'bg-themeblue2/15' : device.isPrimary ? 'bg-themeyellow/15' : 'bg-tertiary/10'
                  }`}>
                    {device.isPrimary ? (
                      <Crown size={18} className={isCurrent ? 'text-themeblue2' : 'text-themeyellow'} />
                    ) : (
                      <Smartphone size={18} className={isCurrent ? 'text-themeblue2' : 'text-tertiary/50'} />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-primary">
                        {device.deviceLabel || 'Unknown'}
                      </span>
                      {isCurrent && (
                        <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-themeblue2/15 text-themeblue2">
                          This device
                        </span>
                      )}
                      {device.isPrimary && (
                        <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-themeyellow/15 text-themeyellow">
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

                  {/* Inline delete action (tap to reveal) */}
                  {menuOpen && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); handleRemove(device.deviceId) }}
                      className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-themeredred/15 active:scale-90 transition-all"
                    >
                      <Trash2 size={16} className="text-themeredred" />
                    </button>
                  )}
                </div>
              </div>
            </SwipeableDeviceCard>
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
    </div>
  )
}

// ── Swipe-to-delete wrapper ───────────────────────────────────────

function SwipeableDeviceCard({
  children,
  isOpen,
  swipeEnabled,
  onOpen,
  onClose,
  onDelete,
  onTap,
}: {
  children: React.ReactNode
  isOpen: boolean
  swipeEnabled: boolean
  onOpen: () => void
  onClose: () => void
  onDelete: () => void
  onTap?: () => void
}) {
  const rowRef = useRef<HTMLDivElement>(null)
  const touchRef = useRef<{
    startX: number
    startY: number
    swiping: boolean
    dirDecided: boolean
  } | null>(null)

  const snapTo = useCallback((x: number) => {
    const el = rowRef.current
    if (!el) return
    el.style.transition = 'transform 200ms ease-out'
    el.style.transform = `translateX(${x}px)`
  }, [])

  // Sync with external isOpen state
  useEffect(() => {
    snapTo(isOpen ? -ACTION_WIDTH : 0)
  }, [isOpen, snapTo])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0]
    touchRef.current = { startX: t.clientX, startY: t.clientY, swiping: false, dirDecided: false }
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const state = touchRef.current
    if (!state) return
    const t = e.touches[0]
    const dx = t.clientX - state.startX
    const dy = t.clientY - state.startY

    if (!state.dirDecided) {
      if (Math.abs(dx) < GESTURE_THRESHOLDS.DIRECTION_LOCK && Math.abs(dy) < GESTURE_THRESHOLDS.DIRECTION_LOCK) return
      state.dirDecided = true
      if (Math.abs(dy) > Math.abs(dx)) { touchRef.current = null; return }
      if (!swipeEnabled) { touchRef.current = null; return }
      state.swiping = true
    }
    if (!state.swiping) return

    const base = isOpen ? -ACTION_WIDTH : 0
    const offset = Math.max(-ACTION_WIDTH, Math.min(0, base + dx))
    const el = rowRef.current
    if (el) {
      el.style.transition = 'none'
      el.style.transform = `translateX(${offset}px)`
    }
  }, [swipeEnabled, isOpen])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const state = touchRef.current
    if (!state) return
    touchRef.current = null

    if (state.swiping) {
      const dx = e.changedTouches[0].clientX - state.startX
      const base = isOpen ? -ACTION_WIDTH : 0
      const shouldOpen = Math.abs(base + dx) > OPEN_THRESHOLD
      snapTo(shouldOpen ? -ACTION_WIDTH : 0)
      if (shouldOpen && !isOpen) onOpen()
      else if (!shouldOpen && isOpen) onClose()
      return
    }

    // Tap — close if swiped open, otherwise toggle action menu
    if (!state.dirDecided) {
      if (isOpen) {
        snapTo(0)
        onClose()
      } else {
        onTap?.()
      }
    }
  }, [isOpen, snapTo, onOpen, onClose, onTap])

  const handleTouchCancel = useCallback(() => {
    touchRef.current = null
    snapTo(isOpen ? -ACTION_WIDTH : 0)
  }, [isOpen, snapTo])

  // Click handler for desktop — touch devices use the touch handlers instead
  const wasTouchRef = useRef(false)

  const handleClick = useCallback(() => {
    if (wasTouchRef.current) { wasTouchRef.current = false; return }
    if (isOpen) { snapTo(0); onClose() }
    else { onTap?.() }
  }, [isOpen, snapTo, onClose, onTap])

  const handleTouchStartWrapper = useCallback((e: React.TouchEvent) => {
    wasTouchRef.current = true
    handleTouchStart(e)
  }, [handleTouchStart])

  if (!swipeEnabled) {
    return <div>{children}</div>
  }

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Delete action behind card */}
      <div className="absolute inset-y-0 right-0 flex items-center justify-center" style={{ width: ACTION_WIDTH }}>
        <button
          onClick={onDelete}
          className="flex flex-col items-center gap-1 active:scale-95 transition-transform"
        >
          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-themeredred/15">
            <Trash2 size={18} className="text-themeredred" />
          </div>
          <span className="text-[8px] font-medium text-tertiary/60">Remove</span>
        </button>
      </div>

      {/* Swipeable card layer */}
      <div
        ref={rowRef}
        onClick={handleClick}
        onTouchStart={handleTouchStartWrapper}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        style={{ touchAction: 'pan-y', cursor: swipeEnabled ? 'pointer' : undefined }}
      >
        {children}
      </div>
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
