/**
 * SessionsDevicesPanel — view and manage registered devices.
 *
 * Shows all devices registered to the current user, highlights the
 * current device, and allows removing individual devices (swipe left)
 * or signing out all other sessions (primary device only).
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { Smartphone, Monitor, LogOut, Info, Shield, Camera, Link2 } from 'lucide-react'
import { EmptyState } from '../EmptyState'
import { ConfirmDialog } from '../ConfirmDialog'
import { useBarcodeScanner } from '../../Hooks/useBarcodeScanner'
import { useLinkerBroadcast } from '../../Hooks/useDeviceLink'
import { LoadingSpinner } from '../LoadingSpinner'
import { useMinLoadTime } from '../../Hooks/useMinLoadTime'
import { useAuth } from '../../Hooks/useAuth'
import { useAuthStore } from '../../stores/useAuthStore'
import { getLocalDeviceId } from '../../lib/signal/keyManager'
import { VAULT_DEVICE_ID } from '../../lib/signal/vaultDevice'
import { unregisterDevice, deleteKeyBundle, primaryLogoutAll } from '../../lib/signal/signalService'
import { fetchOwnDevicesWithRole, type DeviceWithRole } from '../../lib/signal/deviceService'
import { ErrorDisplay } from '../ErrorDisplay'
import { UI_TIMING } from '../../Utilities/constants'

export function SessionsDevicesPanel() {
  const { user } = useAuth()
  const deviceRole = useAuthStore((s) => s.deviceRole)

  const [devices, setDevices] = useState<DeviceWithRole[]>([])
  const [localDeviceId, setLocalDeviceId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const showLoading = useMinLoadTime(loading)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [confirmLogoutAll, setConfirmLogoutAll] = useState(false)
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null)
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  const signOut = useAuthStore((s) => s.signOut)

  const [addPhase, setAddPhase] = useState<'idle' | 'scanning' | 'confirm' | 'sending'>('idle')
  const [pendingChannelId, setPendingChannelId] = useState<string | null>(null)
  const qrVideoRef = useRef<HTMLVideoElement>(null)

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

  const {
    isScanning: qrIsScanning,
    error: qrScanError,
    result: qrScanResult,
    startScanning: qrStartScanning,
    stopScanning: qrStopScanning,
    clearResult: qrClearResult,
  } = useBarcodeScanner()

  const { broadcast, sending: linkSending, sent: linkSent, broadcastError } = useLinkerBroadcast()

  // Remove a single device
  const handleRemove = useCallback(async (deviceId: string) => {
    if (!user?.id) return

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

  // Handle QR scan result
  useEffect(() => {
    if (!qrScanResult || addPhase !== 'scanning') return
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (uuidPattern.test(qrScanResult.trim())) {
      setPendingChannelId(qrScanResult.trim())
      setAddPhase('confirm')
    } else {
      setStatus({ type: 'error', message: 'Invalid QR code' })
      setAddPhase('idle')
      qrClearResult()
    }
  }, [qrScanResult, addPhase, qrClearResult])

  useEffect(() => {
    if (linkSent) {
      setStatus({ type: 'success', message: 'Device linked successfully' })
      setAddPhase('idle')
      setPendingChannelId(null)
      qrClearResult()
    }
  }, [linkSent, qrClearResult])

  useEffect(() => {
    if (broadcastError) {
      setStatus({ type: 'error', message: broadcastError })
      setAddPhase('idle')
      setPendingChannelId(null)
      qrClearResult()
    }
  }, [broadcastError, qrClearResult])

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
  if (showLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <LoadingSpinner className="text-tertiary" />
      </div>
    )
  }

  // --- Error state ---
  if (error) {
    return (
      <div className="px-5 py-4">
        <ErrorDisplay type="error" message={error} />
      </div>
    )
  }

  // --- Empty state ---
  if (devices.length === 0) {
    return (
      <EmptyState
        icon={<Smartphone size={28} />}
        title="No devices registered"
        className="h-full"
      />
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-5 py-4 space-y-3">

        {/* Add Device — primary only */}
        {isPrimary && addPhase === 'idle' && (
          <button
            onClick={() => {
              setAddPhase('scanning')
              requestAnimationFrame(() => {
                if (qrVideoRef.current) qrStartScanning(qrVideoRef.current)
              })
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-themeblue2/10 text-themeblue2 text-sm font-medium active:scale-95 transition-all"
          >
            <Link2 size={16} />
            Add Device
          </button>
        )}

        {addPhase === 'scanning' && (
          <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
            <div className="px-4 py-3 space-y-2">
              <p className="text-xs text-tertiary">
                Scan the QR code shown on the new device's login screen.
              </p>
              <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black/5 border border-tertiary/10">
                <video
                  ref={qrVideoRef}
                  className="absolute inset-0 w-full h-full object-cover"
                  playsInline
                  muted
                />
                {!qrIsScanning && !qrScanError && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <p className="text-xs text-tertiary">Starting camera…</p>
                  </div>
                )}
              </div>
              {qrScanError && (
                <p className="text-xs text-themeredred">{qrScanError}</p>
              )}
              <button
                onClick={() => { qrStopScanning(); setAddPhase('idle'); qrClearResult() }}
                className="w-full py-2 text-xs text-tertiary active:opacity-70 transition-opacity"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {(addPhase === 'confirm' || addPhase === 'sending') && pendingChannelId && (
          <div className="rounded-2xl border border-themeblue2/20 bg-themewhite2 overflow-hidden px-4 py-4 flex flex-col items-center gap-3">
            <Camera size={24} className="text-themeblue2" />
            <div className="text-center">
              <p className="text-sm font-semibold text-primary">Link this device?</p>
              <p className="text-xs text-tertiary mt-1">
                Device code: <span className="font-mono">{pendingChannelId.slice(0, 8).toUpperCase()}</span>
              </p>
            </div>
            <div className="flex gap-2 w-full">
              <button
                onClick={() => { setAddPhase('idle'); setPendingChannelId(null); qrClearResult() }}
                disabled={linkSending}
                className="flex-1 py-2.5 rounded-xl border border-tertiary/15 text-tertiary text-sm font-medium active:scale-95 transition-all disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setAddPhase('sending')
                  await broadcast(pendingChannelId)
                }}
                disabled={linkSending}
                className="flex-1 py-2.5 rounded-xl bg-themeblue2 text-white text-sm font-medium active:scale-95 transition-all disabled:opacity-40"
              >
                {linkSending ? 'Linking…' : 'Link Device'}
              </button>
            </div>
          </div>
        )}

        <p className="text-xs text-tertiary leading-relaxed">
          Devices registered to your account. Tap a device to remove it.
        </p>

        {status && <ErrorDisplay type={status.type} message={status.message} />}

        {/* Device list */}
        <div className="rounded-2xl border border-themeblue3/10 bg-themewhite2 overflow-hidden">
          {devices.map((device) => {
            const isCurrent = device.deviceId === localDeviceId
            const isVault = device.deviceId === VAULT_DEVICE_ID
            const activity = activityInfo(device.lastActiveAt)
            const shortId = device.deviceId.slice(0, 8)
            const isTappable = !isVault

            const handleTap = () => {
              if (isCurrent) setConfirmSignOut(true)
              else setPendingRemoveId(device.deviceId)
            }

            return (
              <div
                key={device.deviceId}
                className={`px-4 py-3.5 transition-all ${
                  isVault ? 'opacity-50' : 'cursor-pointer active:scale-95 hover:bg-themeblue2/5'
                }`}
                onClick={isTappable ? handleTap : undefined}
                role={isTappable ? 'button' : undefined}
                tabIndex={isTappable ? 0 : undefined}
                onKeyDown={isTappable ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleTap()
                  }
                } : undefined}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-tertiary/10">
                    {isVault ? (
                      <Shield size={18} className="text-tertiary" />
                    ) : /Mac|Windows|Linux/i.test(device.deviceLabel || '') ? (
                      <Monitor size={18} className="text-tertiary" />
                    ) : (
                      <Smartphone size={18} className="text-tertiary" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm font-medium ${isVault ? 'text-tertiary' : 'text-primary'}`}>
                        {device.deviceLabel || 'Unknown'}
                      </span>
                      {isCurrent && (
                        <span className="text-[9pt] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-themeblue2/15 text-themeblue2">
                          This device
                        </span>
                      )}
                      {isVault && (
                        <span className="text-[9pt] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-tertiary/10 text-tertiary">
                          Vault
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`inline-block w-1.5 h-1.5 rounded-full ${activity.color}`} />
                      <span className="text-[9pt] text-tertiary">{activity.label}</span>
                      {device.isPrimary && (
                        <>
                          <span className="text-[9pt] text-tertiary">&middot;</span>
                          <span className="text-[9pt] text-tertiary">Primary</span>
                        </>
                      )}
                      <span className="text-[9pt] text-tertiary">&middot;</span>
                      <span className="text-[9pt] text-tertiary font-mono">{shortId}</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Sign Out All Other Sessions (primary only) */}
        {isPrimary && otherDevicesExist && (
          <div className="pt-2">
            <button
              onClick={() => setConfirmLogoutAll(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-themeredred/10 text-themeredred text-sm font-medium active:scale-95 transition-all"
            >
              <LogOut size={16} />
              Sign Out All Other Sessions
            </button>
            <ConfirmDialog
              visible={confirmLogoutAll}
              title="Sign out all other sessions?"
              confirmLabel="Sign Out All"
              variant="danger"
              onConfirm={handleLogoutAll}
              onCancel={() => setConfirmLogoutAll(false)}
            />
          </div>
        )}

        {/* Info note for non-primary devices */}
        {!isPrimary && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-tertiary/5">
            <Info size={14} className="text-tertiary shrink-0 mt-0.5" />
            <p className="text-[9pt] text-tertiary leading-relaxed">
              Only the primary device can sign out all other sessions. Tap individual
              devices to remove them.
            </p>
          </div>
        )}
      </div>

      {/* Confirm remove dialog */}
      <ConfirmDialog
        visible={!!pendingRemoveId}
        title={`Remove "${devices.find(d => d.deviceId === pendingRemoveId)?.deviceLabel || 'this device'}"?`}
        confirmLabel="Remove"
        variant="danger"
        onConfirm={async () => {
          if (pendingRemoveId) {
            const id = pendingRemoveId
            setPendingRemoveId(null)
            await handleRemove(id)
          }
        }}
        onCancel={() => setPendingRemoveId(null)}
      />

      {/* Confirm sign out this device */}
      <ConfirmDialog
        visible={confirmSignOut}
        title="Sign out and remove this device?"
        confirmLabel="Sign Out"
        variant="danger"
        onConfirm={async () => {
          setConfirmSignOut(false)
          if (localDeviceId) await handleRemove(localDeviceId)
          await signOut()
        }}
        onCancel={() => setConfirmSignOut(false)}
      />
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
