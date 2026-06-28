/**
 * ProvisionalDeviceModal — the single "No Primary Device" / install surface.
 *
 * Appears when deviceRole === 'provisional' (browser tab without a PWA primary).
 * Replaces the standalone InstallPrompt: warns that data lives in the Vault until
 * a primary returns, then conditionally renders the install affordance —
 *   • desktop / Android (beforeinstallprompt captured) → one-tap Install button
 *   • iOS                                              → Add-to-Home-Screen hint
 *   • neither                                          → generic PWA-install copy
 * Dismissible once per session (sessionStorage).
 */

import { useState, useCallback, useEffect } from 'react'
import { Download, Share } from 'lucide-react'
import { useAuthStore } from '../../stores/useAuthStore'
import { useInstallCapability } from '../../Hooks/useInstallPrompt'
import { Modal } from '../Modal'

const DISMISS_KEY = '_provisional_modal_dismissed'

export function ProvisionalDeviceModal() {
  const deviceRole = useAuthStore(s => s.deviceRole)
  const { isIOS, canInstall, install, isInstalling } = useInstallCapability()

  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(DISMISS_KEY) === '1' } catch { return false }
  })

  const dismiss = useCallback(() => {
    setDismissed(true)
    try { sessionStorage.setItem(DISMISS_KEY, '1') } catch { /* ignore */ }
  }, [])

  const isOpen = deviceRole === 'provisional' && !dismissed

  // Tour: auto-dismiss when guided tour opens self-chat
  useEffect(() => {
    window.addEventListener('tour:messaging-dismiss-provisional', dismiss)
    return () => window.removeEventListener('tour:messaging-dismiss-provisional', dismiss)
  }, [dismiss])

  const handleInstall = useCallback(async () => {
    await install()
    dismiss()
  }, [install, dismiss])

  return (
    <Modal isOpen={isOpen} onClose={dismiss} hideClose maxWidth={400}>
      <div className="px-6 py-5 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-themeyellow/15 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-themeyellow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-primary">No Primary Device</h3>
        </div>

        <p className="text-[10pt] text-tertiary leading-relaxed">
          No primary device detected. You can still message from this browser tab, and
          your encrypted data is held in a <strong>Vault</strong> until your return — or
          until a primary device is detected.
        </p>

        {/* Install affordance — conditional on platform / install support */}
        {canInstall ? (
          <p className="text-[10pt] text-tertiary leading-relaxed">
            Install the app for persistent, real-time messaging on this device.
          </p>
        ) : isIOS ? (
          <p className="text-[10pt] text-tertiary leading-relaxed">
            For persistent, real-time messaging, install the app: tap{' '}
            <Share className="inline h-3.5 w-3.5 text-themeblue2 -mt-0.5" /> in your browser
            toolbar, then <span className="font-medium text-primary">Add to Home Screen</span>.
          </p>
        ) : (
          <p className="text-[10pt] text-tertiary leading-relaxed">
            For persistent, real-time messaging, install the app as a PWA (Add to Home Screen).
          </p>
        )}

        {canInstall ? (
          <div className="flex items-center gap-2.5 mt-1">
            <button
              onClick={dismiss}
              className="flex-1 py-2 rounded-full bg-themewhite2 text-tertiary text-sm font-medium hover:bg-themegray1/40 transition-colors"
            >
              Not now
            </button>
            <button
              onClick={handleInstall}
              disabled={isInstalling}
              className="flex-1 py-2 rounded-full bg-primary text-themewhite text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isInstalling ? (
                <><Download className="h-3.5 w-3.5 animate-bounce" /> Installing…</>
              ) : (
                <><Download className="h-3.5 w-3.5" /> Install</>
              )}
            </button>
          </div>
        ) : (
          <button
            onClick={dismiss}
            className="mt-1 w-full py-2 rounded-full bg-primary text-themewhite text-sm font-medium hover:opacity-90 transition-opacity"
          >
            I understand
          </button>
        )}
      </div>
    </Modal>
  )
}
