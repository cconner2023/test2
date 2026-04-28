/**
 * LoRaPanel — LoRa mesh radio connection management.
 *
 * Displays connection status, connect/disconnect controls,
 * and mesh health stats (witness + route counts).
 */

import { Radio, Activity } from 'lucide-react'
import { useLoRaStatus } from '../../Hooks/useLoRaStatus'
import { ToggleSwitch } from './ToggleSwitch'

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
          <button
            onClick={isConnected ? disconnect : handleConnect}
            disabled={isConnecting}
            className="w-full flex items-center gap-3 active:scale-95 transition-transform disabled:opacity-50"
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/5">
              <Radio size={20} className="text-primary" />
            </div>
            <div className="flex-1 text-left">
              <h3 className="text-sm font-medium text-primary">Radio Status</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`inline-block w-2 h-2 rounded-full ${STATE_COLORS[state]}`} />
                <span className="text-[10pt] text-tertiary">{STATE_LABELS[state]}</span>
              </div>
            </div>
            <ToggleSwitch checked={isConnected || isConnecting} />
          </button>
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
                <p className="text-[10pt] text-tertiary mt-0.5">Guardians</p>
              </div>
              <div className="bg-themewhite rounded-lg p-3 text-center">
                <p className="text-2xl font-semibold text-primary">{routeCount}</p>
                <p className="text-[10pt] text-tertiary mt-0.5">Routes</p>
              </div>
            </div>
          </div>
        )}

        {/* Info section */}
        <div className="bg-themewhite2 rounded-xl p-4 border border-tertiary/10">
          <h3 className="text-sm font-medium text-primary mb-2">About WhisperNet</h3>
          <p className="text-[10pt] text-tertiary leading-relaxed">
            WhisperNet enables offline, encrypted messaging by combining a bluetooth LoRa external radio with custom signal-protocol messaging. Your device becomes a witness node in a network of all authenticated users — relaying messages through nearby nodes when the internet is unavailable. <br></br><br></br> Currently this feature is in beta because it requires external hardware. For users who do have a LoRa external device (meshtastic etc.), you can toggle this to offline message through nearby WhisperNet nodes.
          </p>
          <p className="text-[10pt] text-tertiary leading-relaxed mt-2">
            To get started, power on your radio module and toggle the
            radio switch above. Your browser will prompt you to select
            the Bluetooth device.
          </p>
        </div>

      </div>
    </div>
  )
}
