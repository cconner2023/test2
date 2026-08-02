import { useState, useCallback, useEffect } from 'react'
import bwipjs from 'bwip-js'
import { RefreshCw } from 'lucide-react'
import { useLinkeeChannel } from '../Hooks/useDeviceLink'
import { LoadingSpinner } from '@/Components/primitives/LoadingSpinner'

/**
 * Linkee side of a device link: subscribes to Realtime and shows the QR another
 * logged-in device scans to hand this one a session.
 *
 * Hosted by LoginScreen (qr mode) and by the lock screens, which is the case that
 * matters — a browser holding a stale session never reaches LoginScreen, so this
 * is the only recovery lane left when both the password and the PIN are gone.
 */
export function DeviceLinkQrView({ onSettledChange }: { onSettledChange?: (settled: boolean) => void }) {
  const { channelId, status, error, channelState, regenerate, handoffPublicKey } = useLinkeeChannel()
  // Wait for the handoff public key too, so the QR always carries a seal target.
  const ready = channelState === 'ready' && !!handoffPublicKey

  // Bound the connection wait. A relay that never comes up would park the HUD
  // forever, so if we haven't gone ready (or errored) within the window, treat it
  // as a failure and surface the SAME "try again" affordance a channel error does
  // — no password fallback, no inline error. Tapping retry regenerates + clears it.
  const [timedOut, setTimedOut] = useState(false)
  const LINK_CONNECT_TIMEOUT_MS = 5000
  useEffect(() => {
    if (ready || channelState === 'error' || timedOut) return
    const t = window.setTimeout(() => setTimedOut(true), LINK_CONNECT_TIMEOUT_MS)
    return () => window.clearTimeout(t)
  }, [ready, channelState, timedOut])
  const retry = useCallback(() => { setTimedOut(false); regenerate() }, [regenerate])

  // Failure = the channel errored, or the connection window elapsed.
  const failed = channelState === 'error' || timedOut

  // Tell the host when there's something to reveal — the QR is up, or it failed
  // into a retry. The HUD morph parks until this flips so we never expand onto the
  // bare "Connecting…" state.
  const settled = ready || failed
  useEffect(() => { onSettledChange?.(settled) }, [settled, onSettledChange])

  // Once the channel is ready, flip `reveal` on the next frame so the QR panel
  // fades + slides up via CSS transition instead of snapping in after load. Height
  // is owned by the enclosing StackBody (ResizeObserver), so no max-h juggling here.
  const [reveal, setReveal] = useState(false)
  useEffect(() => {
    if (!ready) { setReveal(false); return }
    const id = requestAnimationFrame(() => setReveal(true))
    return () => cancelAnimationFrame(id)
  }, [ready])

  const qrCanvasRef = useCallback((canvas: HTMLCanvasElement | null) => {
    if (!canvas || !channelId || !handoffPublicKey) return
    try {
      bwipjs.toCanvas(canvas, {
        // Device-link payload (Option A): channelId + the linkee's ephemeral handoff
        // public key. The scanner (SessionsDevicesPanel) parses this JSON.
        bcid: 'qrcode',
        text: JSON.stringify({ v: 1, c: channelId, k: handoffPublicKey }),
        scale: 4,
        padding: 3,
      })
    } catch {
      // non-critical
    }
  }, [channelId, handoffPublicKey])

  return (
    <div className="relative">
      {/* Connecting / try-again placeholder — fades out as the QR reveals. While
          connecting it spins; on failure (error or timeout) it becomes a bare
          tap-to-try-again (no inline error copy). */}
      <div
        className={`flex flex-col items-center justify-center gap-2 transition-opacity duration-300 ease-out ${
          ready ? 'absolute inset-0 opacity-0 pointer-events-none' : 'py-4 opacity-100'
        }`}
      >
        {failed ? (
          <button
            onClick={retry}
            className="flex flex-col items-center gap-2 text-[10pt] text-tertiary active:opacity-70 transition-opacity"
          >
            <RefreshCw size={20} />
            Tap to try again
          </button>
        ) : (
          <LoadingSpinner className="text-tertiary" />
        )}
      </div>

      {/* QR panel — fades up (opacity + translate) on ready; height morph is the StackBody's job */}
      {ready && (
        <div
          className={`transition-all duration-500 ease-out ${
            reveal ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
          }`}
        >
          <div className="py-2 overflow-hidden">
            <div className="float-right ml-3 mb-1 w-[38%]">
              <canvas ref={qrCanvasRef} className="block w-full border border-themegreen/30 bg-white rounded-xl" />
            </div>
            <p className="text-sm font-semibold text-primary mb-1.5">Link This Device</p>
            <p className="text-[10pt] text-secondary leading-relaxed">
              Open the application on another logged-in device, go to <span className="font-medium text-primary">Settings → Linked Devices</span>, and scan this code to log in.
            </p>
            {status === 'receiving' && (
              <p className="text-[10pt] text-themegreen font-medium mt-1.5">Linking device…</p>
            )}
            {status === 'error' && error && (
              <p className="text-[10pt] text-themeredred mt-1.5">{error}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
