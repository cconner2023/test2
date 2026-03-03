/**
 * LoRaPanel — LoRa mesh radio connection management.
 *
 * Displays connection status, connect/disconnect controls,
 * and mesh health stats (witness + route counts).
 */

import { Radio, Wifi, WifiOff, Activity } from 'lucide-react'
import { useLoRaStatus } from '../../Hooks/useLoRaStatus'

const STATE_COLORS: Record<string, string> = {
  disconnected: 'bg-tertiary/40',
  connecting: 'bg-themeyellow animate-pulse',
  connected: 'bg-themegreen',
  error: 'bg-themeredred',
}

const STATE_LABELS: Record<string, string> = {
  disconnected: 'Disconnected',
  connecting: 'Connecting…',
  connected: 'Connected',
  error: 'Error',
}

export function LoRaPanel() {
  const { state, witnessCount, routeCount, connect, disconnect } = useLoRaStatus()
  const isConnected = state === 'connected'
  const isConnecting = state === 'connecting'

  const handleConnect = async () => {
    const result = await connect()
    if (!result.ok) {
      // User cancellation is expected — no error toast needed
      if (!result.error.includes('cancel')) {
        console.warn('LoRa connect failed:', result.error)
      }
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-4 py-3 md:p-5 space-y-4">

        {/* Status Card */}
        <div className="bg-themewhite2 rounded-xl p-4 border border-tertiary/10">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/5">
              <Radio size={20} className="text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-primary">Radio Status</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`inline-block w-2 h-2 rounded-full ${STATE_COLORS[state]}`} />
                <span className="text-xs text-tertiary">{STATE_LABELS[state]}</span>
              </div>
            </div>
          </div>

          {/* Connect / Disconnect button */}
          {isConnected ? (
            <button
              onClick={disconnect}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-themeredred/10 text-themeredred text-sm font-medium hover:bg-themeredred/20 transition-colors"
            >
              <WifiOff size={16} />
              Disconnect
            </button>
          ) : (
            <button
              onClick={handleConnect}
              disabled={isConnecting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-themegreen/10 text-themegreen text-sm font-medium hover:bg-themegreen/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Wifi size={16} />
              {isConnecting ? 'Connecting…' : 'Connect to Radio'}
            </button>
          )}
        </div>

        {/* Mesh Stats — visible only when connected */}
        {isConnected && (
          <div className="bg-themewhite2 rounded-xl p-4 border border-tertiary/10">
            <div className="flex items-center gap-2 mb-3">
              <Activity size={16} className="text-tertiary" />
              <h3 className="text-sm font-medium text-primary">Mesh Health</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-themewhite rounded-lg p-3 text-center">
                <p className="text-2xl font-semibold text-primary">{witnessCount}</p>
                <p className="text-xs text-tertiary mt-0.5">Witnesses</p>
              </div>
              <div className="bg-themewhite rounded-lg p-3 text-center">
                <p className="text-2xl font-semibold text-primary">{routeCount}</p>
                <p className="text-xs text-tertiary mt-0.5">Routes</p>
              </div>
            </div>
          </div>
        )}

        {/* Info section */}
        <div className="bg-themewhite2 rounded-xl p-4 border border-tertiary/10">
          <h3 className="text-sm font-medium text-primary mb-2">About LoRa Mesh</h3>
          <p className="text-xs text-tertiary leading-relaxed">
            LoRa mesh enables offline, encrypted messaging by connecting to a LoRa
            radio module via Bluetooth. Messages are relayed through nearby nodes
            when the internet is unavailable, using the same end-to-end encryption
            as online messages.
          </p>
          <p className="text-xs text-tertiary leading-relaxed mt-2">
            To get started, power on your LoRa radio module and tap
            &ldquo;Connect to Radio&rdquo; above. Your browser will prompt you to
            select the Bluetooth device.
          </p>
        </div>

      </div>
    </div>
  )
}
